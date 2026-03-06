'use strict';

/**
 * lib/widget/diagram/widget-render.js
 *
 * Render pipeline, animation, and blessed render override
 * patched onto Diagram.prototype.
 */

var Diagram               = require('./widget-core').Diagram;
var ANIMATION_INTERVAL_MS = require('./widget-core').ANIMATION_INTERVAL_MS;
var renderModel           = require('./diagram-renderer').render;
var routeAll              = require('./diagram-router').routeAll;
var Frame                 = require('./diff-frame').Frame;
var diffFn                = require('./diagram-diff').diff;

// ────────────────────────────────────────────────────────────────────
// § Render pipeline
// ────────────────────────────────────────────────────────────────────

/**
 * Run after any model mutation: route, stamp grid, render, repaint.
 *
 * @private
 */
Diagram.prototype._postModelChange = function _postModelChange() {
  if (!this._model) return;

  /* Ensure model dimensions are at least as big as the widget. */
  this._syncModelSize();

  /* Re-anchor every port to the optimal side/offset. */
  this._model.reanchorPorts();

  /* Route all connectors. */
  this._grid = routeAll(this._model);

  /* Reposition labels anchored to ports/connectors so they track
   * the new box positions after layout or drag operations. */
  var model = this._model;
  model.boxes.forEach(function (box) {
    model.repositionLabelsForBox(box.id);
  });

  /* Stamp labels into the routing grid so hit-testing can find them. */
  var self = this;
  this._model.labels.forEach(function (label) {
    self._grid._stampLabel(label);
  });

  /* Full render + screen update. */
  this._fullRender();

  /* Start animation if needed. */
  if (this._animateEnabled) {
    var hasCurrentWork = false;
    for (var entry of this._model.boxes) {
      if (entry[1].currentWork) { hasCurrentWork = true; break; }
    }
    if (hasCurrentWork) this._startAnimation();
    else                this._stopAnimation();
  }
};

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

/**
 * Render the model to ASCII, set widget content, request repaint.
 *
 * When panning is active, the renderer receives pan offset and
 * viewport dimensions so the CharBuffer is viewport-sized and
 * only the visible portion of the model is written to content.
 *
 * @private
 */
Diagram.prototype._fullRender = function _fullRender() {
  if (!this._model) return;

  var viewW = Math.max(this.width  - this.ileft - this.iright, 20);
  var viewH = Math.max(this.height - this.itop  - this.ibottom, 10);

  var text = renderModel(this._model, {
    frame: this._animFrame,
    width: this._model.width,
    height: this._model.height,
    panX: this._panX,
    panY: this._panY,
    viewWidth: viewW,
    viewHeight: viewH,
    travelState: this._travelState
  });

  /* Snapshot uses viewport dimensions (what blessed receives). */
  this._prevFrame = new Frame(text, viewW, viewH);

  this.setContent(text);

  if (this.screen) {
    this.screen.render();
  }
};

/**
 * Incremental render for animation ticks and drag frames.
 *
 * Instead of replacing the full content string, this renders the
 * current frame, diffs it against the previous snapshot, and writes
 * only the changed cells into the blessed screen buffer.
 *
 * Falls back to _fullRender when no previous frame exists or when
 * the screen lines are not accessible.
 *
 * @private
 */
Diagram.prototype._incrementalRender = function _incrementalRender() {
  if (!this._model || !this._prevFrame) {
    return this._fullRender();
  }

  var viewW = Math.max(this.width  - this.ileft - this.iright, 20);
  var viewH = Math.max(this.height - this.itop  - this.ibottom, 10);

  var text = renderModel(this._model, {
    frame: this._animFrame,
    width: this._model.width,
    height: this._model.height,
    panX: this._panX,
    panY: this._panY,
    viewWidth: viewW,
    viewHeight: viewH,
    travelState: this._travelState
  });

  var curr = new Frame(text, viewW, viewH);
  var ops = diffFn(this._prevFrame, curr);
  this._prevFrame = curr;

  /* If nothing changed, skip the repaint altogether. */
  if (ops.length === 0) return;

  /* Attempt direct screen-buffer patching. */
  if (this.screen && this.screen.lines && this.lpos) {
    var xi = this.lpos.xi + this.ileft;
    var yi = this.lpos.yi + this.itop;
    var lines = this.screen.lines;

    for (var i = 0; i < ops.length; i++) {
      var op  = ops[i];
      var row = yi + op.y;
      var col = xi + op.x;
      if (row >= 0 && row < lines.length && lines[row] && col >= 0 && col < lines[row].length) {
        lines[row][col][1] = op.ch;
        lines[row].dirty = true;
      }
    }

    /* Also update the content string so blessed stays in sync. */
    this.setContent(text);

    this.screen.render();
    return;
  }

  /* Fallback: full content replacement. */
  this.setContent(text);
  if (this.screen) {
    this.screen.render();
  }
};

// ────────────────────────────────────────────────────────────────────
// § Animation
// ────────────────────────────────────────────────────────────────────

/**
 * Start the dot-pair animation timer.
 *
 * @private
 */
Diagram.prototype._startAnimation = function _startAnimation() {
  if (this._animTimer) return;

  var self = this;
  this._animTimer = setInterval(function animTick() {
    self._animFrame += 1;
    self._incrementalRender();
  }, ANIMATION_INTERVAL_MS);

  if (this._animTimer && typeof this._animTimer.unref === 'function') {
    this._animTimer.unref();
  }
};

/**
 * Stop the animation timer.
 *
 * @private
 */
Diagram.prototype._stopAnimation = function _stopAnimation() {
  if (this._animTimer) {
    clearInterval(this._animTimer);
    this._animTimer = null;
  }
};

// ────────────────────────────────────────────────────────────────────
// § Travel animation (connector dot transition)
// ────────────────────────────────────────────────────────────────────

/** Travel dot interval: 1 cell every 100ms as specified. */
var TRAVEL_INTERVAL_MS = 100;

/**
 * Start a travel-dot animation along a pre-computed cell path.
 *
 * Pauses the normal perimeter animation while the dot is in flight.
 * Advances the dot by one cell every 100ms via a dedicated interval.
 * When the dot reaches the end of the path, calls `onComplete` and
 * resumes normal animation management via `_postModelChange`.
 *
 * @param {Array<{x: number, y: number}>} cells - Ordered cell path.
 * @param {Function} onComplete - Called when travel reaches the end.
 * @private
 */
Diagram.prototype._startTravelAnimation = function _startTravelAnimation(cells, onComplete) {
  /* Cancel any existing travel animation to prevent overlapping timers. */
  this._stopTravelAnimation();

  /* Pause the perimeter dot animation during travel. */
  this._stopAnimation();

  this._travelState = {
    cells: cells,
    cellIdx: 0,
    timer: null,
    onComplete: onComplete || null
  };

  var self = this;
  this._travelState.timer = setInterval(function travelTick() {
    if (!self._travelState) return;

    self._travelState.cellIdx += 1;

    /* Check if the dot has reached the end of the path. */
    if (self._travelState.cellIdx >= self._travelState.cells.length) {
      var cb = self._travelState.onComplete;
      self._stopTravelAnimation();
      if (cb) cb();
      return;
    }

    /* Render the updated dot position. */
    self._incrementalRender();
  }, TRAVEL_INTERVAL_MS);

  /* Allow process to exit even if travel timer is running. */
  if (this._travelState.timer && typeof this._travelState.timer.unref === 'function') {
    this._travelState.timer.unref();
  }

  /* Render the initial dot position (cellIdx = 0). */
  this._incrementalRender();
};

/**
 * Stop an active travel-dot animation and clean up state.
 *
 * Safe to call when no travel animation is active (no-op).
 *
 * @private
 */
Diagram.prototype._stopTravelAnimation = function _stopTravelAnimation() {
  if (!this._travelState) return;

  if (this._travelState.timer) {
    clearInterval(this._travelState.timer);
  }
  this._travelState = null;
};

// ────────────────────────────────────────────────────────────────────
// § Blessed render override
// ────────────────────────────────────────────────────────────────────

/**
 * Override blessed's render to ensure content is up-to-date.
 *
 * @returns {Object} Blessed render coordinates.
 */
Diagram.prototype.render = function renderOverride() {
  if (this._model && !this.getContent()) {
    this._syncModelSize();
    var viewW = Math.max(this.width  - this.ileft - this.iright, 20);
    var viewH = Math.max(this.height - this.itop  - this.ibottom, 10);
    var text = renderModel(this._model, {
      frame: this._animFrame,
      width: this._model.width,
      height: this._model.height,
      panX: this._panX,
      panY: this._panY,
      viewWidth: viewW,
      viewHeight: viewH,
      travelState: this._travelState
    });
    this.setContent(text);
  }

  /*
   * Guard: ensure all child elements have their _clines initialised.
   * Blessed's setLabel() may create a shrink-to-fit child Box while
   * the widget is still detached, leaving _clines undefined.
   */
  var children = this.children || [];
  for (var i = 0; i < children.length; i++) {
    if (children[i]._clines == null) {
      children[i].parseContent();
    }
    if (children[i]._clines == null) {
      var empty = [];
      empty.width = 0;
      empty.content = '';
      empty.mwidth = 0;
      empty.attr = [];
      empty.ci = [];
      children[i]._clines = empty;
    }
  }

  return this._render();
};
