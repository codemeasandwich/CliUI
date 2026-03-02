'use strict';
var blessed = require('../blessed')
  , Node = blessed.Node
  , Box = blessed.Box
  , InnerCanvas = require('drawille-canvas-blessed-contrib').Canvas;

function Canvas(options, canvasType) {

  var self = this;

  if (!(this instanceof Node)) {
    return new Canvas(options);
  }

  options = options || {};
  this.options = options;
  Box.call(this, options);

  this.on('attach', function() {
    self._initCanvas(canvasType);

    if (self.options.data) {
      self.setData(self.options.data);
    }
  });

  this.on('resize', function() {
    self._initCanvas(canvasType);
    process.nextTick(function() {
      if (self._lastSetData != null) {
        self.setData(self._lastSetData);
      }
    });
  });
}

Canvas.prototype = Object.create(Box.prototype);

Canvas.prototype.type = 'canvas';

Canvas.prototype._initCanvas = function(canvasType) {
  this.calcSize();
  this.canvasSize.width = Math.max(1, this.canvasSize.width);
  this.canvasSize.height = Math.max(1, this.canvasSize.height);
  this._canvas = new InnerCanvas(this.canvasSize.width, this.canvasSize.height, canvasType);
  this.ctx = this._canvas.getContext();
};

Canvas.prototype.calcSize = function() {
  this.canvasSize = {width: this.width*2-12, height: this.height*4};
};

Canvas.prototype.clear = function() {
  // Guard: ctx is only available after the 'attach' handler runs _initCanvas().
  // Calling clearRect before ctx exists would throw; safe to no-op since there
  // is nothing to clear if the canvas was never initialized.
  if (!this.ctx) return;
  this.ctx.clearRect(0, 0, this.canvasSize.width, this.canvasSize.height);
};

Canvas.prototype.render = function() {
  // Guard: ctx is set by _initCanvas() inside the 'attach' event handler.
  // If render fires before attach (bad dimensions, resize race, or premature
  // screen.render() call), ctx is undefined and frame() would throw.
  // Fall back to Element._render() which draws the bordered box safely.
  if (!this.ctx) return this._render();

  this.clearPos(true);
  var inner = this.ctx._canvas.frame();
  this.setContent(inner);
  return this._render();
};

module.exports = Canvas;
