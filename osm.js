'use strict';

//====================================================================

var queryString = require('querystring');

//--------------------------------------------------------------------

var _ = require('lodash');

//--------------------------------------------------------------------

var got = require('./utils').got;

//====================================================================

// Returns (a promise for) information about location.
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
exports.search = function (location) {
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
    return JSON.parse(data.toString())[0];
  });
};
