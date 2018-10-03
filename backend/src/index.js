import express from 'express';
import passport from 'passport';
import session from 'express-session';
import cookie from 'cookie-parser';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import path from 'path';
import fs from 'fs';
import PouchDB from 'pouchdb';
import { google } from 'googleapis';

const app = express();
const users = new PouchDB('users');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const publicURL = `${config.publicURL}:${config.port}`;
const scope = [
  'profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use(cookie());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: config.secret,
  resave: true,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser((id, done) => users.get(id).then(user => done(null, user)).catch(done));

passport.use(new GoogleStrategy({
  clientID: config.clientID,
  clientSecret: config.clientSecret,
  callbackURL: `${publicURL}/auth/google/callback`
}, (accessToken, refreshToken, profile, cb) => {
  const client = new google.auth.OAuth2();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken
  });
  const people = google.people({
    version: 'v1',
    auth: client
  });
  users.get(profile.id)
    .then(user => cb(null, user))
    .catch(err => {
      if (err.status === 404) {
        const user = {
          _id: profile.id,
          name: profile.displayName,
          tokens: {
            accessToken, refreshToken
          }
        };
        people.people.get({
          resourceName: 'people/me',
          personFields: 'emailAddresses'
        }).then(({ data }) => {
          user.email = data.emailAddresses[0].value;
          return users.put(user);
        }).then(() => cb(null, user)).catch(cb);
        return;
      }
      cb(err);
    });
}));

app.get('/auth/google', passport.authenticate('google', { scope }));

app.get('/auth/google/callback',
  passport.authenticate('google', { scopes: ['profile'], failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/index.html');
  });

app.get('/api/user', (req, res) => {
  if (req.user) {
    res.send(JSON.stringify(req.user));
  } else {
    res.status(401).send('Unauthorized');
  }
});

app.get('/', (req, res) => res.redirect('startpage.html'));

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('startpage.html');
});

app.listen(config.port, () => console.log('Ready!'));
