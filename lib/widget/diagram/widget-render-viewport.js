'use strict';

/**
 * lib/widget/diagram/widget-render-viewport.js
 *
 * Viewport math methods patched onto Diagram.prototype.
 *
 * Extracted from widget-render.js to keep each module within
 * the 200 NCLOC limit. These methods are self-contained viewport
 * geometry calculations: model sizing, content bounding box,
 * pan centering/clamping, and the lazy re-center button.
 *
 * Domain context:
 *   The diagram model may be larger than the blessed widget's
 *   visible area. Viewport panning offsets (_panX, _panY) select
 *   which portion of model space the renderer writes to screen.
 *   These methods compute and constrain those offsets.
 */

var blessed = require('../../blessed');
var Diagram = require('./widget-core').Diagram;

// ────────────────────────────────────────────────────────────────────
// § Model sizing
// ────────────────────────────────────────────────────────────────────

/**
 * Synchronise model width/height to encompass all entities.
 *
 * The model must be at least as large as the widget content area
 * (so rendering fills the viewport), and large enough to contain
 * every box plus a margin for connector routing.
 *
 * With viewport panning the model may be larger than the widget —
 * the renderer windows into the model using the pan offset.
 *
 * @private
 */
Diagram.prototype._syncModelSize = function _syncModelSize() {
  if (!this._model) return;

  /* ileft/iright/itop/ibottom account for borders AND padding. */
  var contentWidth  = Math.max(this.width  - this.ileft - this.iright, 20);
  var contentHeight = Math.max(this.height - this.itop  - this.ibottom, 10);

  /* Start with at least the viewport size. */
  var maxX = contentWidth;
  var maxY = contentHeight;

  /* Expand to encompass the bounding box of all entities. */
  this._model.boxes.forEach(function (box) {
    var right  = box.x + box.width;
    var bottom = box.y + box.height;
    if (right  > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  });

  /* Add margin for connectors that route around the outermost boxes. */
  maxX += 4;
  maxY += 2;

  this._model.width  = maxX;
  this._model.height = maxY;
};

// ────────────────────────────────────────────────────────────────────
// § Content bounding box
// ────────────────────────────────────────────────────────────────────

/**
 * Compute the bounding box of all boxes in the model.
 *
 * Returns `{ minX, minY, maxX, maxY }` where maxX/maxY are the
 * right/bottom edges (exclusive). Used by centering and pan-clamp
 * logic to determine where content lives in model space.
 *
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
 * @private
 */
Diagram.prototype._contentBBox = function _contentBBox() {
  var minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;

  this._model.boxes.forEach(function (box) {
    if (box.x < minX) minX = box.x;
    if (box.y < minY) minY = box.y;
    if (box.x + box.width  > maxX) maxX = box.x + box.width;
    if (box.y + box.height > maxY) maxY = box.y + box.height;
  });

  /* Empty model — return zero-sized bbox at origin. */
  if (minX === Infinity) { minX = 0; minY = 0; maxX = 0; maxY = 0; }

  return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
};

// ────────────────────────────────────────────────────────────────────
// § Pan centering and clamping
// ────────────────────────────────────────────────────────────────────

/**
 * Set _panX/_panY so the content bounding box is centered in the viewport.
 *
 * When content is smaller than the viewport, pan becomes negative —
 * the CharBuffer renders empty space around the model content.
 * When content is larger, the viewport centers on the content middle.
 *
 * @private
 */
Diagram.prototype._centerViewport = function _centerViewport() {
  if (!this._model) return;

  var viewW = Math.max(this.width  - this.ileft - this.iright, 20);
  var viewH = Math.max(this.height - this.itop  - this.ibottom, 10);
  var bbox  = this._contentBBox();

  var contentW = bbox.maxX - bbox.minX;
  var contentH = bbox.maxY - bbox.minY;

  /* Pan offset that places content center at viewport center. */
  this._panX = bbox.minX - Math.floor((viewW - contentW) / 2);
  this._panY = bbox.minY - Math.floor((viewH - contentH) / 2);
};

/**
 * Clamp _panX/_panY to keep the viewport within reasonable bounds.
 *
 * Allows the user to pan up to half a viewport beyond the content
 * bounding box in each direction. When the content fits entirely
 * inside the viewport, pan is locked to the centered position
 * (no scrolling needed).
 *
 * @private
 */
Diagram.prototype._clampPan = function _clampPan() {
  if (!this._model) return;

  var viewW = Math.max(this.width  - this.ileft - this.iright, 20);
  var viewH = Math.max(this.height - this.itop  - this.ibottom, 10);
  var bbox  = this._contentBBox();

  var contentW = bbox.maxX - bbox.minX;
  var contentH = bbox.maxY - bbox.minY;

  /* Pan range: half a viewport of margin beyond content edges. */
  var panMinX = bbox.minX - Math.floor(viewW / 2);
  var panMinY = bbox.minY - Math.floor(viewH / 2);
  var panMaxX = bbox.maxX - Math.ceil(viewW / 2);
  var panMaxY = bbox.maxY - Math.ceil(viewH / 2);

  /* When content fits in viewport, lock to center (no drift). */
  if (panMinX > panMaxX) {
    panMinX = panMaxX = bbox.minX - Math.floor((viewW - contentW) / 2);
  }
  if (panMinY > panMaxY) {
    panMinY = panMaxY = bbox.minY - Math.floor((viewH - contentH) / 2);
  }

  if (this._panX < panMinX) this._panX = panMinX;
  if (this._panX > panMaxX) this._panX = panMaxX;
  if (this._panY < panMinY) this._panY = panMinY;
  if (this._panY > panMaxY) this._panY = panMaxY;
};

// ────────────────────────────────────────────────────────────────────
// § Re-center button
// ────────────────────────────────────────────────────────────────────

/**
 * Check whether the viewport is currently centered and show/hide
 * a small "re-center" button in the bottom-right corner accordingly.
 *
 * The button is created lazily on first need so non-interactive
 * diagrams never pay the cost.  Clicking it calls `resetPan()`.
 *
 * @private
 */
Diagram.prototype._updateCenterButton = function _updateCenterButton() {
  if (!this._model || !this._interactive) return;

  /* Compute what the centered pan values would be. */
  var viewW = Math.max(this.width  - this.ileft - this.iright, 20);
  var viewH = Math.max(this.height - this.itop  - this.ibottom, 10);
  var bbox  = this._contentBBox();
  var contentW = bbox.maxX - bbox.minX;
  var contentH = bbox.maxY - bbox.minY;
  var centerX = bbox.minX - Math.floor((viewW - contentW) / 2);
  var centerY = bbox.minY - Math.floor((viewH - contentH) / 2);

  var isCentered = (this._panX === centerX && this._panY === centerY);

  if (isCentered) {
    /* Hide the button if it exists. */
    if (this._centerBtn) {
      this._centerBtn.hide();
    }
    return;
  }

  /* Not centered — create button lazily or show it. */
  if (!this._centerBtn) {
    var self = this;
    this._centerBtn = blessed.box({
      parent: this,
      content: '\u256d\u2500\u2500\u2500\u256e\n\u2502 \u21f2 \u2502\n\u2570\u2500\u2500\u2500\u256f',
      bottom: 0,
      right: 0,
      width: 5,
      height: 3,
      tags: false,
      mouse: true,
      clickable: true,
      style: {
        fg: 'white',
        bg: 'default',
        transparent: true
      }
    });

    /* Clicking the button re-centers the viewport. */
    this._centerBtn.on('click', function () {
      self.resetPan();
    });
  }

  this._centerBtn.show();
};
