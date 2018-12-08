import { readFileSync } from "fs";
import { join } from "path";

const config = JSON.parse(readFileSync(join(__dirname, "config.json"), "utf8"));

const publicURL = `${config.publicURL}:${config.port}`;
const scope = config.gscope;
const {
  clientID,
  secret,
  port,
  clientSecret,
} = config;

export {
  publicURL,
  scope,
  clientID,
  secret,
  port,
  clientSecret,
  config,
};
