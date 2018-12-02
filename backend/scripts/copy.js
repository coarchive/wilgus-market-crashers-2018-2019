const fs = require("fs");
const chalk = require("chalk");
const { join } = require("path");
const { exec } = require('child_process');
require("console-group").install();

const fsp = fs.promises;
// this file runs in projectRoot/backend/scripts
const backend = join(__dirname, "..");
const dist = join(backend, "..", "dist");
// projectRoot/dist
const copied = join(dist, ".copied");
if (fs.existsSync(copied)) {
  process.exit(0);
}
console.group(chalk.yellow("Setting up dist!"));
Promise.all([
  fsp.readFile(join(backend, "package.json"), "utf8")
    .then(JSON.parse)
    .then(json => {
      const { dependencies, name, version } = json;
      fs.writeFileSync(
        join(dist, "package.json"),
        JSON.stringify({ dependencies, name, version }),
      );
    })
    .then(() => {
      console.log(chalk.green("Finished setting up dist/package.json"));
    }),
  fsp.copyFile(join(backend, "config.json"), join(dist, "config.json")),
])
  .then(() => {
    console.log(chalk.green("Copied config.json"));
    fs.writeFileSync(copied);
    console.log(chalk.yellow("Installing Modules"));
    exec("npm i", dist);
    // const lockFile = join(dist, "package-lock.json");
    // if (fs.existsSync(lockFile)) {
    //   fs.unlinkSync(lockFile);
    //   console.log(chalk.green("❌ Removed dist/package-lock.json"));
    // }
    console.groupEnd();
    process.exit(0);
  });
