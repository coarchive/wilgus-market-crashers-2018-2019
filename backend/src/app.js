import path from "path";
import morgan from "morgan";
import express from "express";
import cookie from "cookie-parser";
import session from "express-session";
import passport from "passport";
import {
  noHTMLWithoutLogin,
  serializeUser,
  deserializeUser,
  strategy,
  authConfig,
  ensureLogin,
  scrubUser,
} from "./auth";
import { byEmail as userEmail, allUsers } from "./routes/users";
import * as stocks from "./routes/stocks";

import { secret, scope } from "./config";

const app = express();
app.use(cookie());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret,
  resave: true,
  saveUninitialized: true,
}));
app.use(morgan("tiny"));
app.use(passport.initialize());
app.use(passport.session());
const publicPath = path.join(__dirname, "public");
const sendFile = fileName => (_, res) => res.sendFile(path.join(publicPath, fileName));
app.use(morgan("tiny"));
// log everything
app.get("/", (req, res) => res.redirect("/login"));
app.get("/login", sendFile("login.html"));
// maybe serve the login pages before we get angEry about the html
app.use(noHTMLWithoutLogin);
app.use(express.static(publicPath, { index: false }));
passport.serializeUser(serializeUser);
passport.deserializeUser(deserializeUser);
passport.use(strategy);

app.get("/auth/google", passport.authenticate("google", { scope }));
app.get("/auth/google/callback", passport.authenticate("google", authConfig), (_, res) => res.redirect("/dashboard"));

app.use(ensureLogin);

app.get("/api/user", (req, res) => res.send(scrubUser(req.user)));
app.get("/api/user/:email", userEmail);
app.get("/api/users", allUsers);

app.get("/api/buy/:ticker", stocks.buy);
app.get("/api/sell/:ticker", stocks.sell);
app.get("/api/stock/:ticker", stocks.get);

app.get("/api/stocks/search/:query", stocks.search);
// app.get("/dashboard", ensureLogin, sendFile("dashboard.html"));
app.get("/dashboard", (req, res) => res.redirect("/api/user"));
app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/login");
});
export default app;
