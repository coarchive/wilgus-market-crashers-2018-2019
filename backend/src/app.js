import morgan from "morgan";
import express from "express";
import cookie from "cookie-parser";
import session from "express-session";

import { secret } from "./config";

const app = express();
app.use(cookie());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret,
  resave: true,
  saveUninitialized: true,
}));
app.use(morgan("tiny"));
export default app;
