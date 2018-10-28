# cloud archiver

[Cloud archiver](https://github.com/cloud-archiver/core) helps you to backup data from different cloud services. This plugins is intend to work with [spotify](https://www.spotify.com).

## setup

Install the plugin into your cloud archiver configuration directory.

```shell
$ npm install --save @cloud-archiver/spotify
```

Edit your configuration to load the plugin and set your [developer keys](https://developer.spotify.com/).

```javascript
plugins: [
// ...
  require('@cloud-archiver/spotify')
// ...
]

spotify: {
  key: '...',
  secret: '...'
}
```

To backup any private playlists you will need to authenticate yourself.

```shell
$ node_modules/.bin/cloud-archiver spotify:auth
```

After you vist the link printed by this command and log into your spotify account all api requests will be done as your account.

