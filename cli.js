'use strict';

//====================================================================

var path = require('path');

//--------------------------------------------------------------------

var yargs = require('yargs');

// Makes yargs throws instead of exiting.
yargs.fail(function (msg) {
  var help = yargs.help();

  if (msg)
  {
    help += '\n' + msg;
  }

  throw help;
});

var Promise = require('bluebird');

var tilelive = require('tilelive');
require('mbtiles').registerProtocols(tilelive);

//--------------------------------------------------------------------
//--------------------------------------------------------------------

var dlTiles = require('./');

//====================================================================

module.exports = function (args) {
  var opts = yargs
    .usage('Usage: $0 [<option>...] <mbTiles> <location>')
    .options({
      h: {
        alias: 'help',
        boolean: true,
        describe: 'display this help message',
      },
      v: {
        alias: 'version',
        boolean: true,
        describe: 'display the version number',
      },
      z: {
        alias: 'zoom',
        default: 12,
        describe: 'zoom level',
      },
    })
    .demand(2)
    .parse(args)
  ;

  if (opts.help)
  {
    return yargs.help();
  }

  if (opts.version)
  {
    return require('./package').version;
  }

  var url = 'mbtiles://'+ path.resolve(opts._[0]);
  return Promise.all([
    Promise.promisify(tilelive.load, tilelive)(url),
    dlTiles(opts._[1], opts.zoom),
  ]).spread(function (store, tiles) {
    var putInfo = Promise.promisify(store.putInfo, store);
    var putTile = Promise.promisify(store.putTile, store);
    var start = Promise.promisify(store.startWriting, store);
    var stop = Promise.promisify(store.stopWriting, store);

    var n = tiles.length;
    console.log('Downloading', n, 'tiles...');

    return start().then(function () {
      return putInfo({
        description: '',
        format: 'png',
        name: 'dl-tiles',
        type: 'baselayer',
        version: '0.1.0',
      });
    }).then(function () {
      return tiles.map(function (tile, i) {
        return tile.data.then(function (data) {
          console.log((i+1) +'/'+ n, 'downloaded:', tile.x +'×'+ tile.y);
          return putTile(tile.z, tile.x, tile.y, data);
        });
      });
    }).all().return().finally(stop);
  });
};
