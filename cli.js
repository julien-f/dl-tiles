'use strict';

//====================================================================

var resolvePath = require('path').resolve;

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

var parseRange = require('range-parser2');

var Promise = require('bluebird');

var eventToPromise = require('event-to-promise');

var tilelive = require('tilelive');
require('mbtiles').registerProtocols(tilelive);
require('tilelive-http').registerProtocols(tilelive);

//--------------------------------------------------------------------

var searchLocation = require('./osm').search;

//====================================================================

var dlTiles = function (store, bbox, zooms) {
  var scheme = tilelive.Scheme.create('scanline', {
    minzoom: zooms[0],
    maxzoom: zooms[zooms.length - 1],
    bbox: bbox && [bbox.west, bbox.south, bbox.east, bbox.north],
  });

  var task = new tilelive.CopyTask(
    'http://tile.openstreetmap.org/{z}/{x}/{y}.png',
    store,
    scheme
  );
  task.on('progress', function (info) {
    console.log([
      info.processed, '/', info.total,
      ' downloaded (', info.remaining, ' remaining)'
    ].join(''));
  });
  task.start();

  return eventToPromise(task, 'finished');
};

//====================================================================

module.exports = function (args) {
  var opts = yargs
    .usage('Usage: $0 [<option>...] <mbTiles> <location>')
    .example(
      '$0 paris.mbtiles "Paris, France"',
      'Download tiles for a location'
    )
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
      g: {
        alias: 'global-zoom',
        default: '0-3',
        describe: 'zoom level for the whole map (can be a range)',
      },
      z: {
        alias: 'zoom',
        default: '0-12',
        describe: 'zoom level (can be a range)',
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

  var globalZooms = parseRange.withoutUnions(opts['global-zoom']);
  var zooms = parseRange.withoutUnions(opts.zoom);
  var store = 'mbtiles://'+ resolvePath(opts._[0]);

  return Promise.all([
    dlTiles(store, null, globalZooms),
    searchLocation(opts._[1]).then(function (info) {
      var bbox = info.boundingbox;
      bbox = {
        south: +bbox[0],
        north: +bbox[1],
        west: +bbox[2],
        east: +bbox[3],
      };

      console.log([
        info.display_name,
        '- n: '+ bbox.north,
        '- e: '+ bbox.east,
        '- s: '+ bbox.south,
        '- w: '+ bbox.west,
      ].join('\n'));

      return bbox;
    }).then(function (bbox) {
      return dlTiles(store, bbox, zooms);
    }),
  ]).return();
};
