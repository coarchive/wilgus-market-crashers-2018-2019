const c = require("ansi-colors");
const { join } = require("path");

const {
  existsSync, writeFileSync, promises: { copyFile, readFile }
} = require("fs");

// directories
const backend = __dirname;
const projectRoot = join(backend, "..");
const dist = join(projectRoot, "dist");

const copied = join(dist, ".copied");
if (existsSync(copied)) {
  process.exit(0);
}
const log = (msg, path) => console.log(c.yellow(msg[0]) + c.cyan(path));
// files
const backendPackageJSON = join(backend, "package.json");
const backendConfigJSON = join(backend, "config.json");
const distPackageJSON = join(dist, "package.json");
const distConfigJSON = join(dist, "config.json");

log`Setting up ${dist}`;
const { parse, stringify } = JSON;
Promise.all([
  readFile(backendPackageJSON, "utf8")
    .then(parse)
    .then(({ version, name }) => writeFileSync(distPackageJSON, stringify({name, version})))
    .then(() => log`Finished setting up ${distPackageJSON}`),
  copyFile(backendConfigJSON, distConfigJSON)
    .then(() => console.log(c.cyan(backendConfigJSON) + c.yellow(" => ") + c.cyan(distConfigJSON)))
]).then(() => {
  writeFileSync(copied);
  log`Wrote ${copied}`;
  process.exit(0);
});
