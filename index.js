import {} from 'dotenv/config'
import cors from 'cors'
import express from 'express'
import bodyParser from 'body-parser'
import { theIDs } from './ids.json'
import { twitchAuth } from './auth'

const fs = require('fs')
// TWITCH APIS/IDS
// const api = require('twitch-api-v5')
const axios = require('axios')
const ffmpeg = require('fluent-ffmpeg')
const fetch = require('node-fetch')

const clientID = process.env.CLIENT_ID
const twitchStreams = require('twitch-get-stream')(clientID)

const app = express()

const corsOptions = [
  'http://localhost:1234',
  'https://strymer.gg',
  'https://www.strymer.gg'
]

app
  .use('*', cors(corsOptions))
  .use(bodyParser.json())
  .use(twitchAuth)
  .get('/api/get-playlist', (req, res) => {
    const { stream, quality } = req.query

    const getRawURL = streamName =>
      twitchStreams
        .rawParsed(streamName)
        .then(back => back.filter(s => s.title.includes('audio_only'))[0].file)
        .catch(err => {
          console.log('ERROR GETTING TWITCH STREAM -- POSSIBLY PRIVATE?', err)
        })

    if (
      fs.existsSync(
        `/var/www/strymer.dev/html/${stream}-${quality || 'raw'}.m3u8`
      )
    ) {
      console.log('THIS PLAYLIST ALREADY EXISTS!')
      res.json(`https://strymer.dev/${stream}-${quality || 'raw'}.m3u8`)
    } else {
      console.log('GETTING PLAYLIST FILE')

      getRawURL(stream)
        .then(async audioOnly => {
          const audioToStream = !audioOnly
            ? `/var/www/strymer.dev/html/${stream}.m3u8`
            : audioOnly

          const bitRate = !quality ? 320 : quality
          ffmpeg(audioToStream, { timeout: 0 })
            .audioBitrate(bitRate)
            .noVideo()
            .addOptions(['-hls_flags delete_segments'])
            .on('error', err => console.log('ERRPR!@', err))
            .save(`/var/www/strymer.dev/html/${stream}-${quality}.m3u8`)
        })
        .then(() => {
          res.json(`https://strymer.dev/${stream}-${quality}.m3u8`)
        })
        .catch(err =>
          console.log('There was an error sending the encoded file back', err)
        )
    }
  })

  .get('/api/meta', (req, res) => {
    const streamInfo = theIDs.map(id =>
      axios
        .get(`https://api.twitch.tv/helix/streams/${id}`, {
          headers: {
            'Client-ID': clientID
          }
        })
        .then(v => v.data.stream)
    )

    Promise.all(streamInfo).then(streams =>
      res.json(
        streams
          .filter(x => x)
          .map(s => {
            const { name, logo, url, display_name, status, game } = s.channel

            return {
              stream: name,
              logo,
              game,
              url,
              title: display_name,
              status
            }
          })
      )
    )
  })

  .post('/api/tourney', (req, res) => {
    const { search } = req.body
    console.log('SEA', search)

    axios
      .get(
        `https://api.twitch.tv/helix/search/streams?query=${search.toLowerCase()}`,
        {
          headers: {
            'Client-ID': clientID
          }
        }
      )
      .then(raw => {
        console.log('RAW', raw)
        const isStream = raw.data.streams.length
          ? raw.data.streams[0].channel
          : null

        if (isStream) {
          const { name, logo, url, display_name, status, game, _id } = isStream
          res.json({
            _id,
            stream: name,
            logo,
            url,
            title: display_name,
            status,
            game
          })
        }
      })
      .catch(err => console.log('Err getting tourney data', err))
  })

  .get('/api/top-streams', async (req, res) => {
    const topRaw = await fetch('https://api.twitch.tv/helix/streams?limit=12', {
      headers: {
        'Client-ID': clientID
      }
    })
    const top = await topRaw.json()

    res.json(top)
  })

  .listen(process.env.PORT || 5000, () => console.log('Server up!'))
