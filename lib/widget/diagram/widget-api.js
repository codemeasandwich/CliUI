'use strict';

/**
 * lib/widget/diagram/widget-api.js
 *
 * Public API methods patched onto Diagram.prototype.
 */

var Diagram        = require('./widget-core').Diagram;
var parseDiagram   = require('./diagram-parser').parse;
var renderDiagram  = require('./diagram-renderer').render;
var routeAll       = require('./diagram-router').routeAll;
var layoutEngine   = require('./diagram-layout').layout;
var distributePorts = require('./diagram-layout').distributePorts;

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
 * Auto-arrange all boxes using the layout engine.
 *
 * @param {Object} [options] - Layout options (gapX, gapY, etc.).
 */
Diagram.prototype.layout = function layoutDiagram(options) {
  if (!this._model) return;
  layoutEngine(this._model, options);
  distributePorts(this._model);
  this._postModelChange();
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
