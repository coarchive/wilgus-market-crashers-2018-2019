import express from 'express';
import passport from 'passport';
import serve from 'serve-static';
import { urlencoded } from 'body-parser';
import session from 'express-session';
import cookie from 'cookie-parser';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import path from 'path';
import fs from 'fs';
import PouchDB from 'pouchdb';

const app = express();
const users = new PouchDB('users');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const publicURL = `${config.publicURL}:${config.port}`;

app.use(serve(path.join(__dirname, 'public'), {
  extensions: ['html']
}));
app.use(cookie());
app.use(urlencoded({ extended: true }));
app.use(session({
  secret: config.secret,
  resave: true,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => users.get(id).then(user => done(null, user)).catch(done));

passport.use(new GoogleStrategy({
  clientID: config.clientID,
  clientSecret: config.clientSecret,
  callbackURL: `${publicURL}/auth/google/callback`
}, (accessToken, refreshToken, profile, cb) => {
  users.get(profile.id)
    .then(user => cb(null, user))
    .catch(err => {
      if (err.status === 404) {
        const user = {
          _id: profile.id,
          name: profile.displayName
        };
        users.put(user).then(() => cb(null, user)).catch(cb);
        console.log(profile);
        return;
      }
      cb(err);
    });
}));

app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { scopes: ['profile'], failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/');
  });

app.listen(config.port, () => console.log('Ready!'));
