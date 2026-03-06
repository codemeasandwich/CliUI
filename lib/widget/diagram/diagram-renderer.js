'use strict';
// @esm-group Widgets

/**
 * lib/widget/diagram/diagram-renderer.js
 *
 * Barrel module + render orchestrator for the diagram ASCII renderer.
 *
 * Sub-modules:
 *   render-buffer.js     — CharBuffer (2D character grid)
 *   render-box.js        — renderBox (borders, content, gates)
 *   render-connector.js  — renderConnector, resolveCorner, segDirection
 *   render-port-tees.js  — renderPortTees, resolveArrow, resolveTee
 *   render-labels.js     — renderLabels, findLongestSegment, renderOpaqueBlocks
 *   render-animation.js  — computePerimeterPath, overlayAnimation
 */

var CharBuffer           = require('./render-buffer').CharBuffer;
var renderBox            = require('./render-box').renderBox;
var connMod              = require('./render-connector');
var renderConnector      = connMod.renderConnector;
var resolveCorner        = connMod.resolveCorner;
var segDirection         = connMod.segDirection;
var teeMod               = require('./render-port-tees');
var renderPortTees       = teeMod.renderPortTees;
var resolveArrow         = teeMod.resolveArrow;
var labelMod             = require('./render-labels');
var renderLabels         = labelMod.renderLabels;
var findLongestSegment   = labelMod.findLongestSegment;
var renderOpaqueBlocks   = labelMod.renderOpaqueBlocks;
var animMod              = require('./render-animation');
var computePerimeterPath = animMod.computePerimeterPath;
var overlayAnimation     = animMod.overlayAnimation;
var overlayTravelDot     = animMod.overlayTravelDot;
var overlayFocusPulse    = animMod.overlayFocusPulse;
var overlayConnAnimations = animMod.overlayConnAnimations;
var OccupancyGrid        = require('./occupancy-grid').OccupancyGrid;

// ────────────────────────────────────────────────────────────────────
// § Main render function
// ────────────────────────────────────────────────────────────────────

/**
 * Render a DiagramModel to canonical ASCII text.
 *
 * This is the primary entry point for the renderer module.
 *
 * When viewport panning is active, the CharBuffer is created at
 * viewport size with an offset so model-space coordinates are
 * automatically mapped to the visible window. The OccupancyGrid
 * stays at full model size (no offset) because animation overlay
 * queries it with model coordinates for gate detection.
 *
 * @param {import('./diagram-model').DiagramModel} model - The diagram to render.
 * @param {Object}  [options]              - Render options.
 * @param {number}  [options.frame]        - Animation frame number (omit for static).
 * @param {number}  [options.width]        - Model canvas width.
 * @param {number}  [options.height]       - Model canvas height.
 * @param {number}  [options.panX]         - Viewport X offset (default 0).
 * @param {number}  [options.panY]         - Viewport Y offset (default 0).
 * @param {number}  [options.viewWidth]    - Viewport width (defaults to width).
 * @param {number}  [options.viewHeight]   - Viewport height (defaults to height).
 * @param {Object}  [options.travelState]  - Active travel-dot state (cells + cellIdx).
 * @param {number}  [options.focusedBoxId]   - Box ID with focus-pulse overlay.
 * @param {number}  [options.focusPulseFrame] - Focus-pulse animation frame.
 * @param {Map}     [options.connAnimStates] - Per-connector animation states.
 * @returns {string} The canonical ASCII diagram text.
 */
function render(model, options) {
  var opts   = options || {};
  var width  = opts.width  || model.width;
  var height = opts.height || model.height;
  var panX   = opts.panX   || 0;
  var panY   = opts.panY   || 0;
  var viewW  = opts.viewWidth  || width;
  var viewH  = opts.viewHeight || height;

  /* Buffer at viewport size with offset — model coords map automatically. */
  var buf  = new CharBuffer(viewW, viewH, panX, panY);

  /* Grid at full model size — needed for animation gate detection
   * and connector rendering queries at model coordinates. */
  var grid = new OccupancyGrid(width, height);

  /* 1. Render all boxes. */
  model.boxes.forEach(function (box) {
    renderBox(box, model, buf, grid);
  });

  /* 2. Render all connectors. */
  model.connectors.forEach(function (conn) {
    renderConnector(conn, buf, grid);
  });

  /* 2b. Write tee characters (├ ┤ ┬ ┴) at normal-box port positions. */
  renderPortTees(model, buf, grid);

  /* 3. Render all labels. */
  renderLabels(model, buf, grid);

  /* 4. Render opaque preserved blocks. */
  renderOpaqueBlocks(model.opaqueBlocks, buf);

  /* 5. Animation overlay (optional). */
  if (opts.frame != null) {
    overlayAnimation(model, buf, grid, opts.frame);
  }

  /* 6. Travel-dot overlay (active during current-work transitions). */
  if (opts.travelState) {
    overlayTravelDot(opts.travelState, buf);
  }

  /* 7. Focus-pulse overlay (keyboard navigation highlight). */
  if (opts.focusedBoxId != null) {
    overlayFocusPulse(opts.focusedBoxId, opts.focusPulseFrame || 0, model, buf, grid);
  }

  /* 8. Connection animation overlays (animated/snake/dashed/spinner). */
  if (opts.connAnimStates) {
    overlayConnAnimations(model, buf, grid, opts.connAnimStates);
  }

  return buf.toString();
}

// ────────────────────────────────────────────────────────────────────
// § Exports
// ────────────────────────────────────────────────────────────────────

module.exports = {
  render:               render,
  CharBuffer:           CharBuffer,
  renderBox:            renderBox,
  renderConnector:      renderConnector,
  renderPortTees:       renderPortTees,
  renderLabels:         renderLabels,
  renderOpaqueBlocks:   renderOpaqueBlocks,
  overlayAnimation:     overlayAnimation,
  overlayTravelDot:     overlayTravelDot,
  computePerimeterPath: computePerimeterPath,
  resolveCorner:        resolveCorner,
  resolveArrow:         resolveArrow,
  segDirection:         segDirection,
  findLongestSegment:   findLongestSegment
};
