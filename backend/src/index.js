import fs from "fs";
import app from "./app";
import chalk from "chalk";
import { sync as rimraf } from "rimraf";
import { port } from "./config";
// DEVELOPMENT ONLY!
// remove the database every time the app starts

// if (fs.existsSync("./users")) {
//   console.log(chalk.bgYellow.black`./users exists`);
//   rimraf("./users");
//   console.log(chalk.green`Removed ./users`);
// }
app.listen(port, () => console.log(`Serving on port ${port}!`));
