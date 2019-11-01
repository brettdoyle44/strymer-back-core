const express = require('express')
const session = require('express-session')
const passport = require('passport')
const request = require('request')
const cors = require('cors')

const { OAuth2Strategy } = require('passport-oauth')

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID
const TWITCH_SECRET = process.env.TWITCH_SECRET
const SESSION_SECRET = process.env.SESSION_SECRET
const CALLBACK_URL = process.env.CALLBACK_URL

export const twitchAuth = express()
twitchAuth.use(
  session({ secret: SESSION_SECRET, resave: false, saveUninitialized: false })
)
twitchAuth.use(express.static('public'))
twitchAuth.use(passport.initialize())
twitchAuth.use(passport.session())

OAuth2Strategy.prototype.userProfile = (accessToken, done) => {
  const options = {
    url: 'https://api.twitch.tv/helix/users',
    method: 'GET',
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      Accept: 'application/vnd.twitchtv.v5+json',
      Authorization: `Bearer ${accessToken}`
    }
  }

  request(options, (error, response, body) => {
    if (response && response.statusCode === 200) {
      done(null, JSON.parse(body))
    } else {
      done(JSON.parse(body))
    }
  })
}

passport.serializeUser((user, done) => {
  done(null, user)
})

passport.deserializeUser((user, done) => {
  done(null, user)
})

passport.use(
  'twitch',
  new OAuth2Strategy(
    {
      authorizationURL: 'https://id.twitch.tv/oauth2/authorize',
      tokenURL: 'https://id.twitch.tv/oauth2/token',
      clientID: TWITCH_CLIENT_ID,
      clientSecret: TWITCH_SECRET,
      callbackURL: CALLBACK_URL,
      state: true
    },
    (accessToken, refreshToken, profile, done) => {
      console.log('profile', profile)
      profile.accessToken = accessToken
      profile.refreshToken = refreshToken

      done(null, profile)
    }
  )
)

twitchAuth.get(
  '/api/auth/twitch',
  passport.authenticate('twitch', { scope: 'user_read' })
)

twitchAuth.get(
  '/api/auth/twitch/callback',
  passport.authenticate('twitch', {
    successRedirect: '/api/twitch/main'
  })
)

// needs to be strymer-test-new.herokuapp.com or production when deployed
twitchAuth.get('/api/twitch/main', cors(), (req, res) => {
  if (req.session && req.session.passport && req.session.passport.user) {
    res.redirect(
      `https://strymer.gg/profile?${req.session.passport.user.data[0].id}--${req.session.passport.user.accessToken}`
    )
  }
})
