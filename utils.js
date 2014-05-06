'use strict';

//====================================================================

var Promise = require('bluebird');

//====================================================================

// Reads all the content of a stream in a buffer.
var readStream = exports.readStream = function (stream) {
  return new Promise(function (resolve, reject) {
    var chunks, n, cleanUp, onEnd, onError, onReadable;

    chunks = [];
    n = 0;

    cleanUp = function () {
      stream.removeListener('end', onEnd);
      stream.removeListener('error', onError);
      stream.removeListener('onReadable', onReadable);
    };

    onEnd = function () {
      cleanUp();
      resolve(Buffer.concat(chunks, n));
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
        n += chunk.length;
      }
    };
    stream.on('readable', onReadable);
  });
};

var got = exports.got = function (url) {
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
