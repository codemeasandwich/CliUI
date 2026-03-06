'use strict';

/**
 * lib/widget/diagram/widget-api.js
 *
 * Public API methods patched onto Diagram.prototype.
 */

var Diagram          = require('./widget-core').Diagram;
var parseDiagram     = require('./diagram-parser').parse;
var renderDiagram    = require('./diagram-renderer').render;
var routeAll         = require('./diagram-router').routeAll;
var layoutEngine     = require('./diagram-layout').layout;
var distributePorts  = require('./diagram-layout').distributePorts;
var segmentsToCells  = require('./render-animation').segmentsToCells;

// ────────────────────────────────────────────────────────────────────
// § Deferred initialisation
// ────────────────────────────────────────────────────────────────────

/**
 * Run once after the widget is attached to a screen.
 *
 * @param {Object} options - Constructor options.
 * @private
 */
Diagram.prototype._deferredInit = function _deferredInit(options) {
  if (this._deferredInitDone) return;
  this._deferredInitDone = true;

  if (options.source) {
    this.setSource(options.source);
  } else if (options.data) {
    this.setData(options.data);
  }

  if (this._interactive) {
    this._bindMouse();
    this._bindDrag();
  }
};

// ────────────────────────────────────────────────────────────────────
// § Source / model
// ────────────────────────────────────────────────────────────────────

/**
 * Parse ASCII text and set it as the current diagram.
 *
 * @param {string} text - Canonical ASCII diagram.
 */
Diagram.prototype.setSource = function setSource(text) {
  this._model = parseDiagram(text, { mode: 'lenient' });

  this._postModelChange();

  /* Center the viewport on the newly loaded content and re-render
   * so the centered pan offset takes effect on screen. */
  this._centerViewport();
  this._fullRender();
};

/**
 * Render the current model back to canonical ASCII text.
 *
 * @returns {string}
 */
Diagram.prototype.getSource = function getSource() {
  if (!this._model) return '';
  return renderDiagram(this._model);
};

/**
 * Replace the model directly.
 *
 * @param {DiagramModel} model
 */
Diagram.prototype.setModel = function setModel(model) {
  this._model = model;
  this._postModelChange();
};

/**
 * Return the live model (mutable).
 *
 * @returns {DiagramModel|null}
 */
Diagram.prototype.getModel = function getModel() {
  return this._model;
};

/**
 * Parse text without applying — useful for preview or validation.
 *
 * @param {string} text
 * @returns {DiagramModel}
 */
Diagram.prototype.parse = function parseSrc(text) {
  return parseDiagram(text, { mode: 'lenient' });
};

/**
 * Alias for `setSource()`.
 *
 * @param {string} text
 */
Diagram.prototype.load = function load(text) {
  this.setSource(text);
};

/**
 * Alias for `getSource()`.
 *
 * @returns {string}
 */
Diagram.prototype.serialize = function serialize() {
  return this.getSource();
};

/**
 * Standard CliUI data setter.
 *
 * @param {string|Object} data
 */
Diagram.prototype.setData = function setData(data) {
  if (typeof data === 'string') {
    this.setSource(data);
  } else if (data && typeof data.source === 'string') {
    this.setSource(data.source);
  }
};

// ────────────────────────────────────────────────────────────────────
// § Box interaction
// ────────────────────────────────────────────────────────────────────

/**
 * Toggle the checked state of a box.
 *
 * @param {number} boxId
 */
Diagram.prototype.toggleChecked = function toggleChecked(boxId) {
  if (!this._model) return;
  this._model.toggleChecked(boxId);
  this._fullRender();
  this.emit('model:change');
};

/**
 * Mark a box as current-work (dashed border + animation).
 *
 * @param {number} boxId
 */
Diagram.prototype.startCurrentWork = function startCurrentWork(boxId) {
  if (!this._model) return;
  this._model.setCurrentWork(boxId, true);
  this._fullRender();
  this._startAnimation();
  this.emit('model:change');
};

/**
 * Remove current-work state from a box.
 *
 * @param {number} boxId
 */
Diagram.prototype.stopCurrentWork = function stopCurrentWork(boxId) {
  if (!this._model) return;
  this._model.setCurrentWork(boxId, false);
  this._fullRender();

  /* Stop animation if no current-work boxes remain. */
  var hasCurrentWork = false;
  for (var entry of this._model.boxes) {
    if (entry[1].currentWork) { hasCurrentWork = true; break; }
  }
  if (!hasCurrentWork) this._stopAnimation();

  this.emit('model:change');
};

/**
 * Transition current-work from one box to another with a travel-dot
 * animation along the connecting line.
 *
 * The ● dot travels cell-by-cell from the old CW box to the new box
 * at 1 cell per 100ms. During travel, perimeter animation is paused.
 * When the dot arrives, the new box becomes the active CW with
 * orbiting dots.
 *
 * If no connector path exists between the two boxes, the transition
 * falls back to an instant switch (no travel animation).
 *
 * @param {number}   fromBoxId - Box currently marked as current-work.
 * @param {number}   toBoxId   - Box to become the new current-work.
 * @param {Function} [callback] - Called after the transition completes.
 */
Diagram.prototype.transitionCurrentWork = function transitionCurrentWork(fromBoxId, toBoxId, callback) {
  if (!this._model) return;

  var model = this._model;
  var self = this;

  /* Find a connector that links the two boxes. */
  var connector = this._findConnectorBetween(fromBoxId, toBoxId);

  if (!connector || !connector.segments || connector.segments.length === 0) {
    /* No connecting path — fall back to instant switch. */
    model.setCurrentWork(fromBoxId, false);
    model.setCurrentWork(toBoxId, true);
    this._postModelChange();
    this.emit('model:change');
    if (callback) callback();
    return;
  }

  /* Expand segments into cell-by-cell path. */
  var cells = segmentsToCells(connector.segments);

  /*
   * Determine direction: the travel dot should move FROM the old box
   * TOWARD the new box. Check which end of the cell path is closer
   * to the source box and reverse if needed.
   */
  var fromBox = model.getBox(fromBoxId);
  if (fromBox && cells.length > 1) {
    var first = cells[0];
    var last = cells[cells.length - 1];
    /* Distance from the first cell to the centre of the source box. */
    var fromCx = fromBox.x + Math.floor(fromBox.width / 2);
    var fromCy = fromBox.y + Math.floor(fromBox.height / 2);
    var d1 = Math.abs(first.x - fromCx) + Math.abs(first.y - fromCy);
    var d2 = Math.abs(last.x - fromCx) + Math.abs(last.y - fromCy);
    if (d2 < d1) {
      cells.reverse();
    }
  }

  /* Remove CW from old box, render without CW active. */
  model.setCurrentWork(fromBoxId, false);
  this._postModelChange();

  /* Start the travel-dot animation along the connector cells. */
  this._startTravelAnimation(cells, function onTravelComplete() {
    /* Travel finished — activate CW on the destination box. */
    model.setCurrentWork(toBoxId, true);
    self._postModelChange();
    self.emit('model:change');
    if (callback) callback();
  });
};

/**
 * Find a connector that links two boxes (in either direction).
 *
 * Searches through all connectors attached to `boxA` and returns the
 * first one whose other endpoint is on `boxB`.
 *
 * @param {number} boxA - First box ID.
 * @param {number} boxB - Second box ID.
 * @returns {import('./diagram-model').DiagramConnector|null}
 * @private
 */
Diagram.prototype._findConnectorBetween = function _findConnectorBetween(boxA, boxB) {
  var model = this._model;
  if (!model) return null;

  var conns = model.getConnectorsForBox(boxA);
  for (var i = 0; i < conns.length; i++) {
    var conn = conns[i];
    /* Resolve the box at the other end via the source and dest ports. */
    var srcPort = model.ports.get(conn.sourcePortId);
    var dstPort = model.ports.get(conn.destPortId);
    if (!srcPort || !dstPort) continue;

    if ((srcPort.boxId === boxA && dstPort.boxId === boxB) ||
        (srcPort.boxId === boxB && dstPort.boxId === boxA)) {
      return conn;
    }
  }
  return null;
};

/**
 * Auto-arrange all boxes using the layout engine.
 *
 * @param {Object} [options] - Layout options (gapX, gapY, etc.).
 */
Diagram.prototype.layout = function layoutDiagram(options) {
  if (!this._model) return;

  /* Pass the widget's inner content dimensions so the layout engine
   * can compute gaps that fit boxes within the visible area.
   * ileft/iright/itop/ibottom account for borders AND padding. */
  var contentWidth  = Math.max(this.width  - this.ileft - this.iright, 20);
  var contentHeight = Math.max(this.height - this.itop  - this.ibottom, 10);
  var opts = Object.assign({
    availableWidth:  contentWidth,
    availableHeight: contentHeight
  }, options);

  layoutEngine(this._model, opts);
  distributePorts(this._model);

  this._postModelChange();

  /* Center the viewport on the laid-out content and re-render
   * so the centered pan offset takes effect on screen. */
  this._centerViewport();
  this._fullRender();

  this.emit('model:change');
};

/**
 * Recompute all connector paths.
 */
Diagram.prototype.route = function routeDiagram() {
  if (!this._model) return;
  this._grid = routeAll(this._model);
  this._fullRender();
};

// ────────────────────────────────────────────────────────────────────
// § Viewport panning
// ────────────────────────────────────────────────────────────────────

/**
 * Pan the viewport by a delta.
 *
 * Positive dx/dy shift the viewport right/down (revealing content
 * further into the model). Negative values shift left/up.
 * Pan is clamped to keep the viewport within half-a-viewport
 * of the content bounding box in each direction.
 *
 * @param {number} dx - Horizontal delta in model cells.
 * @param {number} dy - Vertical delta in model cells.
 */
Diagram.prototype.pan = function pan(dx, dy) {
  this._panX += dx;
  this._panY += dy;
  this._clampPan();
  this._fullRender();
  this.emit('pan', { panX: this._panX, panY: this._panY });
};

/**
 * Pan the viewport to an absolute model coordinate.
 *
 * @param {number} x - Model X coordinate for the left viewport edge.
 * @param {number} y - Model Y coordinate for the top viewport edge.
 */
Diagram.prototype.panTo = function panTo(x, y) {
  this._panX = x;
  this._panY = y;
  this._clampPan();
  this._fullRender();
  this.emit('pan', { panX: this._panX, panY: this._panY });
};

/**
 * Re-center the viewport on the content bounding box.
 *
 * Equivalent to the initial centering that happens after setSource()
 * or layout(). Useful as a "reset view" action.
 */
Diagram.prototype.resetPan = function resetPan() {
  this._centerViewport();
  this._fullRender();
  this.emit('pan', { panX: this._panX, panY: this._panY });
};
