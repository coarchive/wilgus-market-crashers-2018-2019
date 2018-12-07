import chalk from "chalk";
import PouchDB from "pouchdb";

export const users = new PouchDB("users");
export async function putUser(user, cb) {
  // cb in this case is the express callback
  // cb(error, data)
  try {
    await users.put(user);
    cb(null, user);
  } catch (putError) {
    console.log(chalk.bgRed`pouchdb put error!`);
    cb(putError);
  }
}
