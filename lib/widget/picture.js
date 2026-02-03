'use strict';
var blessed = require('../blessed')
  , Node = blessed.Node
  , Box = blessed.Box
  , pictureTube = require('picture-tuber')
  , fs = require('fs')
  , streams = require('../utils/memory-stream');

function Picture(options) {
  if (!(this instanceof Node)) {
    return new Picture(options);
  }

  options = options || {};
  options.cols = options.cols || 50;
  this.options = options;

  if (options.file || options.base64 || options.stream) {
    this.setImage(options);
  }

  Box.call(this, options);
}

Picture.prototype = Object.create(Box.prototype);

Picture.prototype.setImage = function(options) {

  var tube = pictureTube( { cols: options.cols } );

  if (options.stream) {
    options.stream.pipe(tube);
  } else if (options.file) {
    fs.createReadStream(options.file).pipe(tube);
  } else if (options.base64) {
    var memStream = streams.createBufferStream();
    memStream.pipe(tube);
    var buf = Buffer.from(options.base64, 'base64');
    memStream.write(buf);
    memStream.end();
  }

  this.writer = new streams.WritableStream();
  tube.pipe(this.writer);

  tube.on('end', function() {
    if (options.onReady) {
      options.onReady();
    }
  });

};

Picture.prototype.render = function() {
  this.setContent(this.writer.toString());
  return this._render();
};

Picture.prototype.getOptionsPrototype = function() {

  return { base64:'AAAA'
    , cols: 1 };

};

Picture.prototype.type = 'picture';

module.exports = Picture;
