import fs from "fs";
import path from "path";
import chalk from "chalk";
import morgan from "morgan";
import express from "express";
import PouchDB from "pouchdb";
import fetch from "node-fetch";
import passport from "passport";
import cookie from "cookie-parser";
import { google } from "googleapis";
import { IEXClient } from "iex-api";
import session from "express-session";
import { sync as rimraf } from "rimraf";
import { parse as jsonParse } from "JSONStream";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
// that's OCD

function scrubUser(user) {
  // contrary to it's name, scrubUser does not scrub the user information from the database
  // it just removes things like tokens and other private items I guess
  const userCopy = Object.assign({}, user);
  // object assign because we don't want to mutate the user object
  delete userCopy.tokens;
  delete userCopy._rev;
  delete userCopy._id;
  return userCopy;
}
if (fs.existsSync("./users")) {
  console.log(chalk.bgYellow.black`./users exists`);
  rimraf("./users");
  console.log(chalk.green`Removed ./users`);
}
const users = new PouchDB("users");

const iex = new IEXClient(fetch);
const app = express();

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));

const publicURL = `${config.publicURL}:${config.port}`;
const scope = config.gscope;

function createHandler(res) {
  return err => {
    console.error(err);
    if (err.statusCode) {
      return res.status(err.statusCode).send(err.statusText || "External server error");
    }
    return res.status(500).send(`Internal server error: ${JSON.stringify(err)}`);
  };
}
const errorWrapper = str => ({ error: str });

const notLoggedIn = req => !req.user;
const currentFileIsHtml = req => /.html$/.test(req.path);
const redirect2Login = res => res.status(401).redirect("/login");
function noHTMLWithoutLogin(req, res, next) {
  if (notLoggedIn(req) && currentFileIsHtml(req)) {
    console.log(chalk.bgRed("Serving HTML not allowed without auth!"));
    redirect2Login(res);
  }
  next();
}
const ensureLogin = (req, res, next) => (notLoggedIn(req) ? redirect2Login(res) : next());
const publicPath = path.join(__dirname, "public");
const sendFile = fileName => (_, res) => res.sendFile(path.join(publicPath, fileName));
app.use(cookie());
// parse cookies
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: config.secret,
  resave: true,
  saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(morgan("tiny"));
// log everything
app.get("/login", sendFile("login.html"));
// maybe serve the login pages
app.use(noHTMLWithoutLogin);
app.use(express.static(publicPath, { index: false }));

passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser((id, done) => users.get(id).then(user => done(null, user)).catch(done));

async function putUser(user, cb) {
  try {
    await users.put(user);
    cb(null, user);
  } catch (putError) {
    console.log(chalk.bgRed`pouchdb put error!`);
    cb(putError);
  }
}
passport.use(
  new GoogleStrategy({
    clientID: config.clientID,
    clientSecret: config.clientSecret,
    callbackURL: `${publicURL}/auth/google/callback`,
  },
  async (accessToken, refreshToken, profile, cb) => {
    const client = new google.auth.OAuth2();
    client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    const people = google.people({
      version: "v1",
      auth: client,
    });
    try {
      const user = await users.get(profile.id);
      // check database
      user.tokens.accessToken = accessToken;
      user.tokens.refreshToken = refreshToken;
      putUser(user);
      // no need to await since there's no more code that executes in this function
    } catch (userError) {
      // if fetching the user fails
      if (userError.status !== 404) {
        // wasn't expecting this error
        cb(userError);
        return;
      }
      console.log(chalk.yellow`Failed to find user within the database`);
      // the user wasn't found in the db
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
      console.log(chalk.cyan`Making new user Object`);
      // as the code continues, this object is going to be mutated
      // it will then be stored in the database
      try {
        const { data } = await people.people.get({
          resourceName: "people/me",
          personFields: "emailAddresses,photos",
        });
        const email = data.emailAddresses.filter(v => v.metadata.primary && v.metadata.verified)[0].value;
        user.email = email;
        if (email.slice(email.indexOf("@")) !== "@dtechhs.org") {
          const aEError = Error("You have to login with an @dtechhs.org email.");
          aEError.name = "ArtificialRestriction";
          cb(aEError);
          return;
        }
        console.log(chalk.green`Email OK`);
        user.type = /\d/.test(email) ? "student" : "teacher";
        // cgannon19@dtechhs.org is a student while mmizel@dtechhs.org is a teacher / non student
        user.profilePictureURL = data.photos.filter(v => v.metadata.primary)[0].url || "cannot find";
        putUser(user, cb);
      } catch (fetchError) {
        console.log(chalk.bgRed`Error fetching data from Google`);
        cb(fetchError);
      }
    }
  }),
);

app.get("/auth/google", passport.authenticate("google", { scope }));

app.get("/auth/google/callback",
  passport.authenticate("google", { scopes: ["profile"], failureRedirect: "/login" }),
  (req, res) => {
    res.redirect("/dashboard");
  },
);

app.get("/api/user", ensureLogin, (req, res) => res.send(scrubUser(req.user)));

app.get("/api/stock/:ticker", ensureLogin, (req, res) => {
  const includeChart = req.query.chart == null ? false : Boolean(req.query.chart);
  const includeNews = req.query.news == null ? false : Boolean(req.query.news);
  const { ticker } = req.params;
  if (!ticker || ticker !== ticker.toString()) {
    res.status(400).send(errorWrapper("Invalid or missing ticker"));
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
      return includeChart ? iex.stockChart(ticker, "1m") : false;
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

app.get("/api/buy/:ticker", ensureLogin, (req, res) => {
  const { ticker } = req.params;
  const amount = req.query.amount == null ? 1 : Number(req.query.amount);
  if (!Number.isInteger(amount)) {
    res.status(400).send(errorWrapper("Amount must be an integer"));
  }
  const stocks = req.user.stocks.filter(stock => stock.ticker === ticker);
  if (stocks.length > 1) {
    throw new Error("ERROR: Database Corrupt");
  }
  let stock = stocks.length === 0 ? null : stocks[0];
  iex.stockPrice(ticker)
    .then(price => {
      if (price === "Unknown symbol") {
        res.status(400).send(errorWrapper(price));
        return false;
      }
      const onMargin = req.user.money < price * amount;
      req.user.history.push({
        type: "buy",
        ticker,
        amount,
        price,
        onMargin,
      });
      if (stock) {
        if (onMargin) {
          res.status(400).send(errorWrapper("Not enough money")); // TODO: Buy the same stock on and off margin
          return false;
        }
        stock.amount += amount;
        req.user.money -= price * amount;
        return users.put(req.user);
      }
      if (!req.user.stocks) {
        req.user.stocks = [];
      }
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
    .catch(createHandler(res));
});

app.get("/api/sell/:ticker", ensureLogin, (req, res) => {
  const { ticker } = req.params;
  const amount = req.query.amount == null ? 1 : +req.query.amount;
  if (!Number.isInteger(amount)) {
    res.status(400).send(errorWrapper("Amount must be an integer"));
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
    req.status(400).send(errorWrapper(`User doesn't have stock "${ticker}"`));
  }
  if (stocks.length !== 1) {
    throw new Error("ERROR: Database Corrupt");
  }
  const stock = stocks[0];
  if (stock.amount < amount) {
    res.status(400).send(errorWrapper("Cannot sell more than owned"));
  }
  iex.stockPrice(ticker)
    .then(price => {
      req.user.history.push({
        type: "sell",
        ticker,
        amount,
        price,
        onMargin: stock.onMargin,
        loan: stock.onMargin ? stock.price * amount : undefined,
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

app.get("/api/user/:email", ensureLogin, (req, res) => {
  const { email } = req.params;
  users.find({
    selector: { email },
    sort: ["_id"],
  }).then(result => {
    if (result.warning) {
      console.error(result.warning);
    }
    if (result.docs.length === 1) {
      res.send(scrubUser(result.docs[0]));
    } else if (result.docs.length === 0) {
      res.status(404).send(errorWrapper(`No user with email ${email}`));
    } else {
      throw new Error("ERROR: Database Corrupt");
    }
  }).catch(createHandler(res));
});

app.get("/api/users", ensureLogin, (req, res) => {
  const limit = req.query.limit == null ? 1 : +req.query.limit;
  if (!Number.isInteger(limit)) {
    res.status(400).send(errorWrapper("limit must be an integer"));
  }
  users.find({
    selector: {
      $or: [
        { type: "student" },
        { type: "teacher" },
      ],
    },
  }).then(result => res.send(result.docs.map(scrubUser)))
    .catch(createHandler(res));
});

app.get("/api/stocks/search/:query", ensureLogin, async (req, res) => {
  const { query } = req.params;
  if (!query) {
    res.status(400).send(errorWrapper("Must provide a query"));
  }
  fetch("https://api.iextrading.com/1.0/ref-data/symbols").then(result => {
    const stream = result.body.pipe(jsonParse("*"));
    const stocks = [];
    let success = true;
    stream.on("data", data => {
      if (
        data.symbol.toLowerCase().includes(query.toLowerCase())
        || data.name.toLowerCase().includes(query.toLowerCase())
      ) {
        stocks.push(data);
      }
    });
    result.body.on("error", err => {
      res.status(500).send(errorWrapper(`Internal server error: ${err}`));
      success = false;
    });
    result.body.on("finish", () => {
      if (success) {
        res.send({ stocks, query });
      }
    });
  }).catch(createHandler());
});

app.get("/", (req, res) => res.redirect("/login"));
// app.get("/dashboard", ensureLogin, sendFile("dashboard.html"));
app.get("/dashboard", ensureLogin, (req, res) => res.redirect("/api/user"));
app.get("/logout", ensureLogin, (req, res) => {
  req.logout();
  res.redirect("/login");
});

app.listen(config.port, () => console.log(`Serving on port ${config.port}!`));
/* eslint-disable */
