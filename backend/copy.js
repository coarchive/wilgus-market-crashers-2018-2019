const fs = require("fs");
const chalk = require("chalk");
const { join } = require("path");
const { exec } = require("child_process");
require("console-group").install();
// this file runs in projectRoot/backend/

const fsp = fs.promises;
const dist = join(__dirname, "..", "dist");
// projectRoot/dist
const copied = join(dist, ".copied");
if (fs.existsSync(copied)) {
  process.exit(0);
}
console.group(chalk.yellow("Setting up dist!"));
Promise.all([
  fsp.readFile(join(__dirname, "package.json"), "utf8")
    .then(JSON.parse)
    .then(({
      buildDependencies,
      dependencies,
      version,
      name,
    }) => {
      fs.writeFileSync(
        join(dist, "package.json"),
        JSON.stringify({
          dependencies: Object.assign(buildDependencies, dependencies),
          name,
          version,
        }),
      );
    })
    .then(() => {
      console.log(chalk.green("Finished setting up dist/package.json"));
    }),
  fsp.copyFile(join(__dirname, "config.json"), join(dist, "config.json")),
])
  .then(() => {
    console.log(chalk.green("Copied config.json"));
    fs.writeFileSync(copied);
    console.log(chalk.yellow("Installing Modules"));
    exec("npm i --no-audit", dist);
    exec("npm i --no-audit", dist);
    console.groupEnd();
    process.exit(0);
  });
