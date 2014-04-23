'use strict';

//====================================================================

var dlTiles = require('./');

//--------------------------------------------------------------------

var expect = require('chai').expect;

//====================================================================

describe('getBoundingBox()', function () {
  it('works with `City, CountryCode`', function () {
    return dlTiles.getBoundingBox('Paris, FR').then(function (bbox) {
      expect(bbox.north).to.be.closeTo(48.90, 1e-2);
      expect(bbox.east).to.be.closeTo(2.46, 1e-2);
      expect(bbox.south).to.be.closeTo(48.81, 1e-2);
      expect(bbox.west).to.be.closeTo(2.22, 1e-2);
    });
  });

  it('works with an object', function () {
    return dlTiles.getBoundingBox({
      city: 'Paris',
      country: 'France',
    }).then(function (bbox) {
      expect(bbox.north).to.be.closeTo(48.90, 1e-2);
      expect(bbox.east).to.be.closeTo(2.46, 1e-2);
      expect(bbox.south).to.be.closeTo(48.81, 1e-2);
      expect(bbox.west).to.be.closeTo(2.22, 1e-2);
    });
  });
});

describe('getTilesList()', function () {
  it('works', function () {
    return dlTiles.getBoundingBox({country: 'France'}).then(function (bbox) {
      expect(dlTiles.getTilesList(bbox, 2)).to.deep.equal([
        { z: 2, x: 0, y: 1 },
        { z: 2, x: 1, y: 1 },
        { z: 2, x: 2, y: 1 },
        { z: 2, x: 3, y: 1 },
        { z: 2, x: 0, y: 2 },
        { z: 2, x: 1, y: 2 },
        { z: 2, x: 2, y: 2 },
        { z: 2, x: 3, y: 2 },
        { z: 2, x: 0, y: 3 },
        { z: 2, x: 1, y: 3 },
        { z: 2, x: 2, y: 3 },
        { z: 2, x: 3, y: 3 }
      ]);
    });
  });
});
