const SpotifyWebApi = require('spotify-web-api-node');
const express = require('express')
const mkdirp = require('mkdirp')
const fs = require('fs')

module.exports = class Spotify {
  static name () {
    return 'spotify'
  }

  constructor({ config, cache, logger, program }) {
    this.config = config
    this.cache = cache
    this.logger = logger

    this.page_size = 50

    program
      .command('spotify:auth')
      .action(this.authenticate.bind(this))

    program
      .command('spotify:playlists')
      .arguments('<user>')
      .action(this.playlists.bind(this))

    this.api = new SpotifyWebApi({
      clientId: this.config.spotify.key,
      clientSecret: this.config.spotify.secret,
      redirectUri: this.config.spotify.redirectUrl || 'http://localhost:9999'
    })

  }

  async refresh () {
    const response = await this.api.refreshAccessToken() 

    this.cache.set('token', response.body.access_token)
    this.api.setAccessToken(response.body.access_token)
  }

  async loadKeys () {
    this.api.setAccessToken(this.cache.get('token'))
    this.api.setRefreshToken(this.cache.get('refresh'))

    await this.refresh()
  }

  async username () {
    return (await this.api.getMe()).body
  }

  async paginate (callback, offset) {
    if (!offset) offset = 0

    try {
      const result = await callback({ limit: this.page_size, offset })

      if (!result.body.next) return result.body.items

      return [...result.body.items, ...(await this.paginate(callback, offset + this.page_size))]
    } catch (error) {
      if (error.statusCode != 429) throw error

      return new Promise((resolve, reject) => {
        const timeout = error.headers['retry-after'] * 1000
        this.logger('Retrying in', timeout, 'ms')

        setTimeout(() => {
          this.logger('Retrying')
          resolve(this.paginate(callback, offset))
        }, timeout)
      })
    }
  }

  authenticate () {
    console.log('Please visit', this.api.createAuthorizeURL(['playlist-read-private', 'playlist-read-collaborative'], 'create'))
    
    const app = express()
    
    app.get('/', async (req, res) => {
      if (!req.query.code) {
        const error = 'No auth code provided'
        res.send(error)
        return console.log(error)
      }

      const response = await this.api.authorizationCodeGrant(req.query.code) 

      this.cache.set('token', response.body.access_token)
      this.cache.set('refresh', response.body.refresh_token)

      res.send('done')
      httpServer.close()

      console.log('Authentication completed. Tokens are now in cache.')
    })

    const httpServer = require('http').createServer(app)
    httpServer.listen(this.config.spotify.listenPort || 9999)
  }

  async playlists (user) {
    this.loadKeys()  

    const playlists = await this.paginate(limit => this.api.getUserPlaylists(user, limit))
    const info = await Promise.all(playlists.map(async meta => {
      const content = await this.paginate(limit => this.api.getPlaylistTracks(meta.id, limit)) 

      return { meta, content }
    }))

    const profile = (await this.api.getUser(user)).body
    const basePath = `${this.config.storage}/spotify/${profile.id}`
    mkdirp.sync(basePath)

    info.forEach(playlist => {
      fs.writeFile(`${basePath}/${playlist.meta.name.replace(/\//g, '')}_${playlist.meta.id}.json`, JSON.stringify(playlist), (err, info) => {
        if (err) throw err

        this.logger('Saved', playlist.meta.name)
      })
    })
  }
}
