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

var dlTiles = function (store, bbox, zooms, opts) {
  opts || (opts = {});

  var minZoom = zooms[0];
  var maxZoom = zooms[zooms.length - 1];

  var scheme = tilelive.Scheme.create('scanline', {
    minzoom: minZoom,
    maxzoom: maxZoom,
    bbox: bbox && [bbox.west, bbox.south, bbox.east, bbox.north],
  });

  var nTiles = scheme.stats.total;
  if (opts.maxTiles && (opts.maxTiles < nTiles))
  {
    if (opts.autoScale)
    {
      --maxZoom;
      zooms = [Math.min(minZoom, maxZoom), maxZoom];
      console.log('max zoom is now:'+ maxZoom);
      return dlTiles(store, bbox, zooms, opts);
    }

    throw new Error('too much tiles: '+ nTiles);
  }

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

require('http').globalAgent.maxSockets = 2;

//====================================================================

module.exports = function (args) {
  var opts = yargs
    .usage('Usage: $0 [<option>...] <mbTiles> <location>')
    .example(
      '$0 paris.mbtiles "Paris, France"',
      'Download tiles from a named location'
    )
    .example(
      '$0 -n 34.337 -e -118.155 -s 33.704 -w -118.668 LA.mbtiles',
      'Download tiles from a bounding box'
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
      m: {
        alias: 'max-tiles',
        default: 1e3,
        describe: 'maximum number of tiles',
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
      n: {
        alias: 'north',
        describe: 'North component of the bounding box'
      },
      s: {
        alias: 'south',
        describe: 'South component of the bounding box'
      },
      e: {
        alias: 'east',
        describe: 'East component of the bounding box'
      },
      w: {
        alias: 'west',
        describe: 'West component of the bounding box'
      },
    })
    .demand(1)
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

  var store = 'mbtiles://'+ resolvePath(opts._[0]);

  var globalTiles = dlTiles(
    store, null,
    parseRange.withoutUnions(opts['global-zoom']),
    {
      autoScale: true,
      maxTiles: opts['max-tiles'],
    }
  );
  var tiles = Promise.try(function () {
    var north = opts.north;
    var south = opts.south;
    var east = opts.east;
    var west = opts.west;
    if (north && south && east && west)
    {
      return {
        north: +north,
        south: +south,
        east: +east,
        west: +west,
      };
    }

    if (north || south || east || west)
    {
      throw new Error('missing components for bounding box');
    }

    var location = opts._[1];
    if (!location)
    {
      throw new Error('you must specify either a location or a bounding box');
    }

    return searchLocation(opts._[1]).then(function (info) {
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
    });
  }).then(function (bbox) {
    return dlTiles(
      store, bbox,
      parseRange.withoutUnions(opts.zoom),
      {
        autoScale: true,
        maxTiles: opts['max-tiles'],
      }
    );
  });

  return Promise.all([globalTiles, tiles]).return();
};
