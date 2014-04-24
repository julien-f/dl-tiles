'use strict';

//====================================================================

var queryString = require('querystring');

//--------------------------------------------------------------------

var _ = require('lodash');
var Promise = require('bluebird');

//====================================================================

var readStream = function (stream) {
  return new Promise(function (resolve, reject) {
    var chunks, cleanUp, onEnd, onError, onReadable;

    chunks = [];

    cleanUp = function () {
      stream.removeListener('end', onEnd);
      stream.removeListener('error', onError);
      stream.removeListener('onReadable', onReadable);
    };

    onEnd = function () {
      cleanUp();
      resolve(Buffer.concat(chunks));
    };
    stream.on('end', onEnd);

    onError = function (error) {
      cleanUp();
      reject(error);
    };
    stream.on('error', onError);

    onReadable = function () {
      var chunk = stream.read();
      if (chunk)
      {
        chunks.push(chunk);
      }
    };
    stream.on('readable', onReadable);
  });
};
var got = function (url) {
  return new Promise(function (resolve, reject) {
    require('http').get(url, function (res) {
      if (res.statusCode !== 200)
      {
        res.destroy();
        return reject(res.statusCode);
      }

      readStream(res).then(resolve, reject);
    });
  });
};

// Returns (a promise for) the bounding box for a given location.
//
// A location might be:
// - 'Paris, France'
// - {
//   street: undefined,
//   postalcode: undefined,
//   city: 'Paris',
//   county: undefined,
//   state: undefined,
//   country: 'France',
// }
//
// A bounding box is: {
//   north: 0,
//   east: 0,
//   south: 0,
//   west: 0,
// }
var getBoundingBox = function (location) {
  var query = {
      format: 'json',

      // Hopefully there will be just one result.
      limit: 1,

      // Avoids duplicates if possible.
      dedup: 1,

      // This data are not needed.
      addressdetails: 0,
      'polygon_geojson': 0,
      'polygon_kml': 0,
      'polygon_svg': 0,
      'polygon_text': 0,
  };

  if (_.isString(location))
  {
    query.q = location;
  }
  else
  {
    _.extend(query, _.pick(location,
      'street', 'postalcode', 'city', 'county', 'state', 'country'
    ));
  }

  var url = 'http://nominatim.openstreetmap.org/search?'+
    queryString.stringify(query);
  return got(url).then(function (data) {
    data = JSON.parse(data.toString())[0];
    var bbox = data.boundingbox;

    return {
      // FIXME: should not be there but needed for logging.
      name: data['display_name'],

      north: +bbox[1],
      east: +bbox[3],
      south: +bbox[0],
      west: +bbox[2],
    };
  });
};

// Source: http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#ECMAScript_.28JavaScript.2FActionScript.2C_etc..29
var longitudeToTile = function (lng, zoom) {
  return Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
};
var latitudeToTile = function (lat, zoom) {
  return Math.floor((1 - Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom));
};

// Returns the list of tiles in a bounding box.
//
// A list of tiles is: [
//   {z: 2, x: 0, y: 0},
//   {z: 2, x: 0, y: 1},
//   {z: 2, x: 1, y: 0},
//   {z: 2, x: 1, y: 1},
// ]
var getTilesList = function (bbox, zoom) {
  var yMin = latitudeToTile(bbox.north, zoom);
  var yMax = latitudeToTile(bbox.south, zoom);
  var xMin = longitudeToTile(bbox.west, zoom);
  var xMax = longitudeToTile(bbox.east, zoom);

  var tiles = [];
  for (var y = yMin; y <= yMax; ++y)
  {
    for (var x = xMin; x <= xMax; ++x)
    {
      tiles.push({
        z: zoom,
        x: x,
        y: y,
      });
    }
  }

  return tiles;
};

// Creates a tile URL on OSM.
var getTileUrl = function (tile) {
  return [
    'http://tile.openstreetmap.org/',
    tile.z,
    '/',
    tile.x,
    '/',
    tile.y,
    '.png'
  ].join('');
};

// Inserts the tiles of a given location in a mbTiles store.
exports = module.exports = function (location, zoom) {
  return getBoundingBox(location).then(function (bbox) {
    // FIXME: a library should not log.
    console.log([
      bbox.name,
      '- n: '+ bbox.north,
      '- e: '+ bbox.east,
      '- s: '+ bbox.south,
      '- w: '+ bbox.west,
    ].join('\n'));

    var tiles = getTilesList(bbox, zoom);

    // Starts downloading the tiles.
    tiles.forEach(function (tile) {
      tile.data = got(getTileUrl(tile));
    });

    return tiles;
  });
};

exports.getBoundingBox = getBoundingBox;
exports.getTilesList = getTilesList;
exports.getTileUrl = getTileUrl;
