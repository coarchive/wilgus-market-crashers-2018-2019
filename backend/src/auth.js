import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { google } from "googleapis";
import { clientID, clientSecret, publicURL } from "./config";
import { users, putUser } from "./database";
import chalk from "chalk";

export const strategy = new GoogleStrategy({
  clientID,
  clientSecret,
  callbackURL: `${publicURL}/auth/google/callback`,
}, async (accessToken, refreshToken, profile, cb) => {
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
      user.profilePictureURL = data.photos.filter(v => v.metadata.primary)[0].url || "/default.png";
      putUser(user, cb);
    } catch (fetchError) {
      console.log(chalk.bgRed`Error fetching data from Google`);
      cb(fetchError);
    }
  }
});

export const serializeUser = (user, done) => done(null, user._id);
export const deserializeUser = (id, done) => users.get(id).then(user => done(null, user)).catch(done);
export const authConfig = { scopes: ["profile"], failureRedirect: "/login" };
export const notLoggedIn = req => !req.user;
export const currentFileIsHtml = req => /.html$/.test(req.path);
export const redirect2Login = res => res.status(401).redirect("/login");
export function noHTMLWithoutLogin(req, res, next) {
  if (notLoggedIn(req) && currentFileIsHtml(req)) {
    console.log(chalk.bgRed("Serving HTML not allowed without auth!"));
    redirect2Login(res);
  }
  next();
}
export const ensureLogin = (req, res, next) => (notLoggedIn(req) ? redirect2Login(res) : next());
export function scrubUser(user) {
  // contrary to it's name, scrubUser does not scrub the user information from the database
  // it just removes things like tokens and other private items I guess
  const userCopy = Object.assign({}, user);
  // object assign because we don't want to mutate the user object
  delete userCopy.tokens;
  delete userCopy._rev;
  delete userCopy._id;
  return userCopy;
}
