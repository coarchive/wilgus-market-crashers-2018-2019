import express from 'express';
import passport from 'passport';
import session from 'express-session';
import cookie from 'cookie-parser';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import path from 'path';
import fs from 'fs';
import PouchDB from 'pouchdb';
import { google } from 'googleapis';
import fetch from 'node-fetch';
import { IEXClient } from 'iex-api';
import pfind from 'pouchdb-find';

PouchDB.plugin(pfind);

const app = express();
const users = new PouchDB('users');
const iex = new IEXClient(fetch);

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const publicURL = `${config.publicURL}:${config.port}`;
const scope = [
  'profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use(cookie());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: config.secret,
  resave: true,
  saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser((id, done) => users.get(id).then(user => done(null, user)).catch(done));

passport.use(new GoogleStrategy({
  clientID: config.clientID,
  clientSecret: config.clientSecret,
  callbackURL: `${publicURL}/auth/google/callback`,
}, (accessToken, refreshToken, profile, cb) => {
  const client = new google.auth.OAuth2();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  const people = google.people({
    version: 'v1',
    auth: client,
  });
  users.get(profile.id)
    .then((user) => {
      user.tokens.accessToken = accessToken;
      user.tokens.refreshToken = refreshToken;
      users.put(user).then(() => cb(null, user)).catch(cb);
    })
    .catch((err) => {
      if (err.status === 404) {
        const user = {
          _id: profile.id,
          name: profile.displayName,
          tokens: {
            accessToken, refreshToken,
          },
          stocks: [],
          money: 0,
          history: [],
        };
        people.people.get({
          resourceName: 'people/me',
          personFields: 'emailAddresses',
        }).then(({ data }) => {
          user.email = data.emailAddresses[0].value;
          return users.put(user);
        }).then(() => cb(null, user)).catch(cb);
        return;
      }
      cb(err);
    });
}));

app.get('/auth/google', passport.authenticate('google', { scope }));

app.get('/auth/google/callback',
  passport.authenticate('google', { scopes: ['profile'], failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/dashboard.html');
  });

app.get('/api/user', (req, res) => {
  if (req.user) {
    res.send(req.user);
  } else {
    res.status(401).send('Unauthorized');
  }
});

app.get('/api/stock/:ticker', (req, res) => {
  const includeChart = req.query.chart == null ? false : Boolean(req.query.chart);
  const includeNews = req.query.news == null ? false : Boolean(req.query.news);
  const { ticker } = req.params;
  if (!ticker || ticker !== ticker.toString()) {
    res.status(400).send('Invalid or missing ticker');
    return;
  }
  const stock = {};
  iex.stockCompany(ticker)
    .then((company) => {
      stock.company = company;
      return iex.stockPrice(ticker);
    })
    .then((price) => {
      stock.price = price;
      return includeChart ? iex.stockChart(ticker, '1m') : false;
    })
    .then((chart) => {
      if (chart) {
        stock.chart = chart;
      }
      return includeNews ? iex.stockNews(ticker, 2) : false;
    })
    .then((news) => {
      if (news) {
        stock.news = news;
      }
      res.send(stock);
    })
    .catch((err) => {
      if (err.statusCode) {
        return res.status(err.statusCode).send(err.statusText || 'External server error');
      }
      return res.status(500).send('Internal server error');
    });
});

app.get('/api/buy/:ticker', (req, res) => {
  if (!req.user) {
    res.status(401).send('Unauthorized');
    return;
  }
  const { ticker } = req.params;
  const amount = req.query.amount == null ? 1 : +req.query.amount;
  if (!Number.isInteger(amount)) {
    res.status(400).send('Amount must be an integer');
  }
  const stocks = req.user.stocks.filter(stock => stock.ticker === ticker);
  if (stocks.length > 1) {
    throw new Error('ERROR: Database Corrupt');
  }
  let stock = stocks.length === 0 ? null : stocks[0];
  iex.stockPrice(ticker)
    .then((price) => {
      if (req.user.history == null) req.user.history = [];
      const onMargin = req.user.money < price * amount;
      req.user.history.push({
        type: 'buy',
        ticker,
        amount,
        price,
        onMargin,
      });
      if (stock) {
        if (onMargin) {
          res.status(400).send('Not enough money'); // TODO: Buy the same stock on and off margin
          return false;
        }
        stock.amount += amount;
        req.user.money -= price * amount;
        return users.put(req.user);
      }
      if (!req.user.stocks) req.user.stocks = [];
      stock = {
        ticker,
        price,
        amount,
        onMargin,
      };
      req.user.stocks.push(stock);
      return users.put(req.user);
    })
    .then(done => done && res.send(stock))
    .catch((err) => {
      if (err.statusCode) {
        return res.status(err.statusCode).send(err.statusText || 'External server error');
      }
      return res.status(500).send('Internal server error');
    });
});

app.get('/api/sell/:ticker', (req, res) => {
  if (!req.user) {
    res.status(401).send('Unauthorized');
    return;
  }
  const { ticker } = req.params;
  const amount = req.query.amount == null ? 1 : +req.query.amount;
  if (!Number.isInteger(amount)) {
    res.status(400).send('Amount must be an integer');
  }
  let idx;
  const stocks = req.user.stocks.filter((stock, i) => {
    if (stock.ticker === ticker) {
      idx = i;
      return true;
    }
    return false;
  });
  if (stocks.length === 0) {
    req.status(400).send(`User doesn't have stock "${ticker}"`);
  }
  if (stocks.length !== 1) {
    throw new Error('ERROR: Database Corrupt');
  }
  const stock = stocks[0];
  if (stock.amount < amount) {
    res.status(400).send('Cannot sell more than owned');
  }
  iex.stockPrice(ticker)
    .then((price) => {
      req.user.history.push({
        type: 'sell',
        ticker,
        amount,
        price,
        onMargin: stock.onMargin,
      });
      stock.amount -= amount;
      req.user.money += price * amount;
      if (stock.onMargin) {
        req.user.money -= stock.price * amount;
      }
      if (stock.amount === 0) {
        req.user.stocks.splice(idx, 1);
      }
      return users.put(req.user);
    })
    .then(() => res.send('OK'))
    .catch((err) => {
      if (err.statusCode) {
        return res.status(err.statusCode).send(err.statusText || 'External server error');
      }
      return res.status(500).send('Internal server error');
    });
});

app.get('/api/user/:email', (req, res) => {
  const { email } = req.params;
});

app.get('/api/users', (req, res) => {
  const limit = req.query.limit == null ? 1 : +req.query.limit;
  if (!Number.isInteger(limit)) {
    res.status(400).send('Amount must be an integer');
  }
});

app.get('/', (req, res) => res.redirect('/login.html'));

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/login.html');
});

app.listen(config.port, () => console.log('Ready!')); // eslint-disable-line
