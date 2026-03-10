'use strict';

/**
 * lib/widget/diagram/widget-api.js
 *
 * Public API methods patched onto Diagram.prototype.
 */

var Diagram = require('./widget-core').Diagram;
var parseDiagram = require('./diagram-parser').parse;
var renderDiagram = require('./diagram-renderer').render;
var routeAll = require('./diagram-router').routeAll;
var layoutEngine = require('./diagram-layout').layout;
var distributePorts = require('./diagram-layout').distributePorts;
var buildModelFromData = require('./data-builder').buildModelFromData;
var buildCycleFromData = require('./data-builder-cycle').buildCycleFromData;
var buildDecisionFromData = require('./data-builder-decision').buildDecisionFromData;
var buildMermaidFromData = require('./data-builder-mermaid').buildMermaidFromData;
var renderMermaid = require('./diagram-mermaid-renderer').renderMermaid;

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

  /* Keyboard navigation — enabled unless explicitly disabled. */
  if (options.focusable !== false) {
    this._bindKeyboard();
  }
};

// ────────────────────────────────────────────────────────────────────
// § Source / model
// ────────────────────────────────────────────────────────────────────

/**
 * Parse ASCII or Mermaid text and set it as the current diagram.
 *
 * Auto-detects Mermaid syntax (graph, flowchart, stateDiagram-v2)
 * and delegates to the Mermaid parser. Otherwise falls back to
 * the existing strict ASCII parser.
 *
 * @param {string} text - Diagram source (ASCII or Mermaid).
 */
Diagram.prototype.setSource = function setSource(text) {
  var t = text.trim();
  if (/^(graph|flowchart|stateDiagram(-v2)?)/i.test(t)) {
    var res = buildMermaidFromData(text);
    this._sourceFormat = res.format;
    this._mermaidReverseMap = res.reverseMap;
    this._applyBuilderResult(res);
    return;
  }

  this._sourceFormat = null;
  this._mermaidReverseMap = null;
  this._model = parseDiagram(text, { mode: 'lenient' });

  this._postModelChange();

  /* Center the viewport on the newly loaded content and re-render
   * so the centered pan offset takes effect on screen. */
  this._centerViewport();
  this._fullRender();
};

/**
 * Render the current model back to source text.
 *
 * If the diagram was loaded from Mermaid syntax, serializes back
 * to Mermaid (preserving original node IDs via the stored reverse
 * map). Otherwise returns canonical ASCII text.
 *
 * @returns {string}
 */
Diagram.prototype.getSource = function getSource() {
  if (!this._model) return '';
  if (this._sourceFormat && this._sourceFormat.startsWith('mermaid:')) {
    return renderMermaid(this._model, this._sourceFormat, this._mermaidReverseMap);
  }
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
  var t = text.trim();
  if (/^(graph|flowchart|stateDiagram(-v2)?)/i.test(t)) {
    return buildMermaidFromData(text).model;
  }
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
 * Apply a builder result (from buildModelFromData, buildCycleFromData,
 * or buildDecisionFromData) to the widget.
 *
 * Sets the model, ID maps, focus order, then runs layout and starts
 * per-connector animation timers. Must run after layout() because
 * connectors need routed segments for cell paths.
 *
 * @param {{ model: DiagramModel, idMap: Map, reverseMap: Map }} result
 * @private
 */
Diagram.prototype._applyBuilderResult = function _applyBuilderResult(result) {
  this._model = result.model;
  this._nodeIdMap = result.idMap;
  this._nodeReverseMap = result.reverseMap;

  /* Build focus order for keyboard navigation. */
  this._focusOrder = [];
  var self = this;
  this._model.boxes.forEach(function (box) {
    self._focusOrder.push(box.id);
  });

  /* Auto-layout + route, then start per-connector animation timers
   * for styled connectors (animated, snake, dashed, spinner, stream).
   *
   * Builders that position boxes manually (e.g. buildCycleFromData
   * places states inside group containers) set skipLayout: true to
   * prevent the layout engine from overwriting those positions.
   * We still distribute ports and route connectors so the diagram
   * renders correctly. */
  if (result.skipLayout) {
    distributePorts(this._model);
    this._postModelChange();
    this._centerViewport();
    this._fullRender();
  } else {
    this.layout();
  }
  this._setupConnAnimations();
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
  } else if (data && data.type === 'cycle' && Array.isArray(data.states)) {
    /* Cycle diagram: groups of states with back-edge transitions. */
    this._applyBuilderResult(buildCycleFromData(data, data.defaultBorder));
  } else if (data && data.type === 'decision' && Array.isArray(data.nodes)) {
    /* Decision diagram: flowchart with decision nodes and edge labels. */
    this._applyBuilderResult(buildDecisionFromData(data, data.defaultBorder));
  } else if (data && Array.isArray(data.nodes)) {
    /* Structured data: convert { nodes, connections } into a model. */
    this._applyBuilderResult(buildModelFromData(data, data.defaultBorder));
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

  /* Pass the widget's inner content dimensions so the layout engine
   * can compute gaps that fit boxes within the visible area.
   * ileft/iright/itop/ibottom account for borders AND padding. */
  var contentWidth = Math.max(this.width - this.ileft - this.iright, 20);
  var contentHeight = Math.max(this.height - this.itop - this.ibottom, 10);
  var opts = Object.assign({
    availableWidth: contentWidth,
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
 * Recompute all connector paths using the A* routing engine.
 *
 * Forces a full re-route of every connector through the occupancy grid,
 * finding non-overlapping orthogonal paths between each connector's
 * source and destination ports. Triggers a full render afterward.
 *
 * Use after programmatic box position changes that bypass the normal
 * setSource()/layout() flow (e.g., direct model.moveBox() calls).
 * Not needed after setData() or layout() — those already route
 * internally via _postModelChange().
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
