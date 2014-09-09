#!/usr/bin/env node

'use strict';

//====================================================================

var Bluebird = require('bluebird');
Bluebird.longStackTraces();

var fs = require('fs');

var eventToPromise = require('event-to-promise');
var parseRange = require('range-parser2');
var progress = require('progress-stream');
var promisify = Bluebird.promisify;
var tilelive = require('tilelive');
var yargs = require('yargs');

var searchLocation = require('./osm').search;

//====================================================================

// Makes yargs throws instead of exiting.
yargs.fail(function handleYargsFailure(msg) {
  var help = yargs.help();

  if (msg)
  {
    help += '\n' + msg;
  }

  throw help;
});

// Registers protocols for Tilelive.
require('mbtiles').registerProtocols(tilelive);
require('tilelive-file').registerProtocols(tilelive);
require('tilelive-http')(tilelive);

var loadStore = promisify(tilelive.load, tilelive);

//--------------------------------------------------------------------

// Limit concurrent queries to OpenStreetMap.
require('http').globalAgent.maxSockets = 2;

function dlTiles(dst, bbox, zooms, opts) {
  opts || (opts = {});

  var minZoom = zooms[0];
  var maxZoom = zooms[zooms.length - 1];

  return Bluebird.join(
    loadStore('http://tile.openstreetmap.org/{z}/{x}/{y}.png'),
    loadStore(dst),
    function (src, dst) {
      var input = tilelive.createReadStream(src, {
        type: 'scanline',
        bounds: bbox && [bbox.west, bbox.south, bbox.east, bbox.north],
        minzoom: minZoom,
        maxzoom: maxZoom,
      });

      var nTiles = input.stats.total;
      if (opts.maxTiles && (opts.maxTiles < nTiles))
      {
        if (opts.autoScale)
        {
          --maxZoom;
          zooms = [Math.min(minZoom, maxZoom), maxZoom];
          console.log('max zoom is now:'+ maxZoom);
          return dlTiles(dst, bbox, zooms, opts);
        }

        throw new Error('too much tiles: '+ nTiles);
      }

      var output = tilelive.createWriteStream(dst);

      if (opts.progress) {
        var prog = progress({
          objectMode: true,
          time: 100,
        });

        input.on('length', function (length) {
          // Number of tiles + metadata (1).
          prog.setLength(length + 1);
        });
        prog.on('progress', (function (fn) {
          return function onProgress(info) {
            // var stats = input.stats;
            fn({
              percentage: info.percentage,
              done: info.transferred,
              total: info.length,

              eta: info.eta,
              speed: info.speed,
            });
          };
        })(opts.progress));

        input.pipe(prog).pipe(output);
      } else {
        input.pipe(output);
      }

      return eventToPromise(output, 'finish');
    }
  );
}

var saveBbox = (function () {
  var readFile = promisify(fs.readFile);
  var writeFile = promisify(fs.writeFile);
  var promise = Bluebird.resolve();

  return function (file, code, bbox) {
    promise = promise.then(function () {
      return readFile(file, {encoding: 'utf8'});
    }).then(JSON.parse).catch(function () {
      return {};
    }).then(function (collection) {
      var cur = collection[code] || (collection[code] = {});
      cur = cur.map || (cur.map = {});
      cur.viewport = {
        ne: { lat: bbox.north, lng: bbox.east },
        sw: { lat: bbox.south, lng: bbox.west }
      };

      return writeFile(file, JSON.stringify(collection, null, 2));
    });

    return promise;
  };
})();

//====================================================================

function onProgress(info) {
  console.log('%s%: %s/%s @ %s/s | %ss left',
    info.percentage.toFixed(2),
    info.done,
    info.total,
    info.speed.toFixed(1),
    info.eta
  );
}

function main(args) {
  var opts = yargs
    .usage('Usage: $0 [<option>...] <mbTiles> <location>')
    .example(
      '$0 mbtiles:./paris.mbtiles "Paris, France"',
      'Download tiles from a named location'
    )
    .example(
      '$0 -n 34.337 -e -118.155 -s 33.704 -w -118.668 mbtiles:./LA.mbtiles',
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
      'viewport-file': {
        describe: 'JSON file in which to save the viewport',
      },
      'city-code': {
        describe: 'IATA code of the current city required to save the viewport',
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

  var storeUri = opts._[0];//'mbtiles://'+ resolvePath(opts._[0]);
  var zooms = parseRange.withoutUnions(opts.zoom);
  var globalZooms = parseRange.withoutUnions(opts['global-zoom']);

  return loadStore(storeUri).then(function (store) {
    var putInfo = promisify(store.putInfo, store);
    var startWriting = promisify(store.startWriting, store);
    var stopWriting = promisify(store.stopWriting, store);

    return startWriting().then(function () {
      return putInfo({
        description: '',
        format: 'png',
        name: 'dl-tiles',
        type: 'baselayer',
        version: '0.1.0',
      });
    }).finally(stopWriting);
  }).then(function () {
    // Local tiles.
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
  }).tap(function (bbox) {
    var code = opts['city-code'];
    var file = opts['viewport-file'];

    if (file && code)
    {
      return saveBbox(file, code, bbox);
    }
  }).then(function (bbox) {
    return dlTiles(
      storeUri, bbox,
      zooms,
      {
        autoScale: true,
        maxTiles: opts['max-tiles'],
        progress: onProgress,
      }
    );
  }).then(function () {
    // Global tiles.
    return dlTiles(
      storeUri, undefined,
      globalZooms,
      {
        autoScale: true,
        maxTiles: opts['max-tiles'],
        progress: onProgress,
      }
    );
  }).return();
}

//====================================================================

exports = module.exports = main;
exports.dlTiles = dlTiles;

if (!module.parent) {
  require('exec-promise')(main);
}
