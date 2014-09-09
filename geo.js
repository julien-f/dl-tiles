'use strict';

//====================================================================

var queryString = require('querystring');

//--------------------------------------------------------------------

var assign = require('lodash.assign');
var got = require('bluebird').promisify(require('got'));
var isString = require('lodash.isstring');
var pick = require('lodash.pick');

//====================================================================

/**
 * Returns (a promise for) information about location.
 *
 * A location might be:
 * - 'Paris, France'
 * - {
 *   street: undefined,
 *   postalcode: undefined,
 *   city: 'Paris',
 *   county: undefined,
 *   state: undefined,
 *   country: 'France',
 * }
 */
exports.search = function search(location) {
  var query = {
      format: 'json',

      // Hopefully there will be just one result.
      limit: 1,

      // Avoids duplicates if possible.
      dedup: 1,

      // This data are not needed.
      // addressdetails: 0,
      // 'polygon_geojson': 0,
      // 'polygon_kml': 0,
      // 'polygon_svg': 0,
      // 'polygon_text': 0,
  };

  if (isString(location))
  {
    query.q = location;
  }
  else
  {
    assign(query, pick(location,
      'street', 'postalcode', 'city', 'county', 'state', 'country'
    ));
  }

  var url = 'http://nominatim.openstreetmap.org/search?'+
    queryString.stringify(query);
  return got(url).spread(function (data) {
    return JSON.parse(data)[0];
  }).tap(function (info) {
    if (!info)
    {
      throw new Error('no result found');
    }
  });
};

var DEG_TO_RAD = Math.PI / 180;
var RAD_TO_DEG = 180 / Math.PI;

var MIN_LAT_RAD = -90 * DEG_TO_RAD;
var MAX_LAT_RAD = 90 * DEG_TO_RAD;
var MIN_LON_RAD = -180 * DEG_TO_RAD;
var MAX_LON_RAD = 180 * DEG_TO_RAD;

// https://en.wikipedia.org/wiki/Earth
var EARTH_RADIUS = 6371 * 1e3;

/**
 * Create a square box from coordinates of a center and a radius in
 * meters.
 *
 * Source: http://janmatuschek.de/LatitudeLongitudeBoundingCoordinates
 */
function createBox(lat, lon, distance) {
  // To radians.
  lat *= DEG_TO_RAD;
  lon *= DEG_TO_RAD;

  // Angular distance in radians on a great circle.
  var angDist = distance / EARTH_RADIUS;

  var minLat = lat - angDist;
  var maxLat = lat + angDist;

  var minLon, maxLon;
  if ((MIN_LAT_RAD < minLat) && (maxLat < MAX_LAT_RAD)) {
    var delta = Math.asin(Math.sin(angDist) / Math.cos(lat));

    minLon = lon - delta;
    maxLon = lon + delta;

    if (minLon < MIN_LON_RAD) {
      minLon += 2 * Math.PI;
    }
    if (maxLon > MAX_LON_RAD) {
      maxLon -= 2 * Math.PI;
    }
  } else {
    // A pole is within the distance.
    minLat = Math.max(minLat, MIN_LAT_RAD);
    maxLat = Math.min(maxLat, MAX_LAT_RAD);
    minLon = MIN_LON_RAD;
    maxLon = MAX_LON_RAD;
  }

  return {
    north: maxLat * RAD_TO_DEG,
    east: maxLon * RAD_TO_DEG,
    south: minLat * RAD_TO_DEG,
    west: minLon * RAD_TO_DEG,
  };
}
exports.createBox = createBox;
