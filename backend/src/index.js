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
import morgan from 'morgan';

PouchDB.plugin(pfind);

const app = express();
const users = new PouchDB('users');
const iex = new IEXClient(fetch);

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const publicURL = `${config.publicURL}:${config.port}`;
const scope = [
  'profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

function createHandler(res) {
  return err => {
    console.error(err); // eslint-disable-line no-console
    if (err.statusCode) {
      return res.status(err.statusCode).send(err.statusText || 'External server error');
    }
    return res.status(500).send(`Internal server error: ${JSON.stringify(err)}`);
  };
}

function error(str) {
  return { error: str };
}

function ensureLogin(req, res, next) {
  if (req.user) {
    next();
  } else {
    res.status(401).send(error('Unauthorized'));
  }
}

function scrubUser(user) {
  const userCopy = Object.assign({}, user);
  delete userCopy.tokens;
  delete userCopy._rev;
  delete userCopy._id;
  return userCopy;
}

app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use(cookie());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: config.secret,
  resave: true,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(morgan('tiny'));

passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser((id, done) => users.get(id).then(user => done(null, user)).catch(done));

passport.use(new GoogleStrategy({
  clientID: config.clientID,
  clientSecret: config.clientSecret,
  callbackURL: `${publicURL}/auth/google/callback`
}, (accessToken, refreshToken, profile, cb) => {
  const client = new google.auth.OAuth2();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken
  });
  const people = google.people({
    version: 'v1',
    auth: client
  });
  users.get(profile.id)
    .then(user => {
      user.tokens.accessToken = accessToken;
      user.tokens.refreshToken = refreshToken;
      users.put(user).then(() => cb(null, user)).catch(cb);
    })
    .catch(err => {
      if (err.status === 404) {
        const user = {
          _id: profile.id,
          name: profile.displayName,
          tokens: {
            accessToken, refreshToken
          },
          stocks: [],
          money: 0,
          history: []
        };
        people.people.get({
          resourceName: 'people/me',
          personFields: 'emailAddresses'
        }).then(({ data }) => {
          const email = data.emailAddresses[0].value;
          user.email = email;
          if (email.slice(email.indexOf('@')) !== '@dtechhs.org') {
            return Promise.reject(new Error('You are not in the correct orginization'));
          }
          user.type = /\d/.test(email) ? 'student' : 'teacher';
          return users.put(user);
        }).then(() => cb(null, user)).catch(err => {
          console.error(err); // eslint-disable-line no-console
          cb(err);
        });
        return;
      }
      cb(err);
    });
}));

app.get('/auth/google', passport.authenticate('google', { scope }));

app.get('/auth/google/callback',
  passport.authenticate('google', { scopes: ['profile'], failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/dashboard');
  });

app.get('/api/user', ensureLogin, (req, res) => {
  res.send(req.user);
});

app.get('/api/stock/:ticker', (req, res) => {
  const includeChart = req.query.chart == null ? false : Boolean(req.query.chart);
  const includeNews = req.query.news == null ? false : Boolean(req.query.news);
  const { ticker } = req.params;
  if (!ticker || ticker !== ticker.toString()) {
    res.status(400).send(error('Invalid or missing ticker'));
    return;
  }
  const stock = {};
  iex.stockCompany(ticker)
    .then(company => {
      stock.company = company;
      return iex.stockPrice(ticker);
    })
    .then(price => {
      stock.price = price;
      return includeChart ? iex.stockChart(ticker, '1m') : false;
    })
    .then(chart => {
      if (chart) {
        stock.chart = chart;
      }
      return includeNews ? iex.stockNews(ticker, 2) : false;
    })
    .then(news => {
      if (news) {
        stock.news = news;
      }
      res.send(stock);
    })
    .catch(createHandler(res));
});

app.get('/api/buy/:ticker', ensureLogin, (req, res) => {
  const { ticker } = req.params;
  const amount = req.query.amount == null ? 1 : +req.query.amount;
  if (!Number.isInteger(amount)) {
    res.status(400).send(error('Amount must be an integer'));
  }
  const stocks = req.user.stocks.filter(stock => stock.ticker === ticker);
  if (stocks.length > 1) {
    throw new Error('ERROR: Database Corrupt');
  }
  let stock = stocks.length === 0 ? null : stocks[0];
  iex.stockPrice(ticker)
    .then(price => {
      if (price === 'Unknown symbol') {
        res.status(400).send(error(price));
        return false;
      }
      const onMargin = req.user.money < price * amount;
      req.user.history.push({
        type: 'buy',
        ticker,
        amount,
        price,
        onMargin
      });
      if (stock) {
        if (onMargin) {
          res.status(400).send(error('Not enough money')); // TODO: Buy the same stock on and off margin
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
        onMargin
      };
      req.user.stocks.push(stock);
      return users.put(req.user);
    })
    .then(done => done && res.send(stock))
    .catch(createHandler(res));
});

app.get('/api/sell/:ticker', ensureLogin, (req, res) => {
  const { ticker } = req.params;
  const amount = req.query.amount == null ? 1 : +req.query.amount;
  if (!Number.isInteger(amount)) {
    res.status(400).send(error('Amount must be an integer'));
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
    req.status(400).send(error(`User doesn't have stock "${ticker}"`));
  }
  if (stocks.length !== 1) {
    throw new Error('ERROR: Database Corrupt');
  }
  const stock = stocks[0];
  if (stock.amount < amount) {
    res.status(400).send(error('Cannot sell more than owned'));
  }
  iex.stockPrice(ticker)
    .then(price => {
      req.user.history.push({
        type: 'sell',
        ticker,
        amount,
        price,
        onMargin: stock.onMargin,
        loan: stock.onMargin ? stock.price * amount : undefined
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
    .then(() => res.send({ ok: true }))
    .catch(createHandler(res));
});

app.get('/api/user/:email', ensureLogin, (req, res) => {
  const { email } = req.params;
  users.find({
    selector: { email },
    sort: ['_id']
  }).then(result => {
    if (result.warning) {
      console.error(result.warning); // eslint-disable-line no-console
    }
    if (result.docs.length === 1) {
      res.send(scrubUser(result.docs[0]));
    } else if (result.docs.length === 0) {
      res.status(404).send(error(`No user with email ${email}`));
    } else {
      throw new Error('ERROR: Database Corrupt');
    }
  }).catch(createHandler(res));
});

app.get('/api/users', ensureLogin, (req, res) => {
  const limit = req.query.limit == null ? 1 : +req.query.limit;
  if (!Number.isInteger(limit)) {
    res.status(400).send(error('limit must be an integer'));
  }
  users.find({
    selector: {
      $or: [
        { type: 'student' },
        { type: 'teacher' }
      ]
    }
  }).then(result => res.send(result.docs.map(scrubUser)))
    .catch(createHandler(res));
});

app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => {
  if (req.user) {
    res.redirect('/dashboard.html');
  } else {
    res.redirect('/login.html');
  }
});

app.get('/dashboard', (req, res) => {
  if (req.user) {
    res.redirect('/dashboard.html');
  } else {
    res.redirect('/login.html');
  }
});

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/login');
});

app.listen(config.port, () => console.log('Ready!')); // eslint-disable-line no-console
