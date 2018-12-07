import fs from "fs";
import path from "path";

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));

const publicURL = `${config.publicURL}:${config.port}`;
const scope = config.gscope;
const { clientID, secret, port } = config;

export {
  publicURL,
  scope,
  clientID,
  secret,
  port,
  config,
};
