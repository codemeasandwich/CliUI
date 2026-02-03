'use strict';

var stream = require('stream');

/**
 * Creates a writable stream that collects all written data.
 * Access collected data via toString() method.
 *
 * @returns {stream.Writable} Writable stream with toString() method
 */
function createWritableCollector() {
  var chunks = [];

  var writable = new stream.Writable({
    write: function(chunk, encoding, callback) {
      chunks.push(chunk);
      callback();
    }
  });

  writable.toString = function() {
    return Buffer.concat(chunks).toString();
  };

  return writable;
}

/**
 * Creates a PassThrough stream for buffering data.
 * Replacement for memorystream - can be written to and piped from.
 *
 * @returns {stream.PassThrough}
 */
function createBufferStream() {
  return new stream.PassThrough();
}

module.exports = {
  WritableStream: createWritableCollector,
  createWritableCollector: createWritableCollector,
  createBufferStream: createBufferStream
};
