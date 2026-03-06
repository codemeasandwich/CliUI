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
 *   render-connector.js  — renderConnector, resolveCorner, segDirection, resolveArrow
 *   render-labels.js     — renderLabels, findLongestSegment, renderOpaqueBlocks
 *   render-animation.js  — computePerimeterPath, overlayAnimation
 */

var CharBuffer           = require('./render-buffer').CharBuffer;
var renderBox            = require('./render-box').renderBox;
var connMod              = require('./render-connector');
var renderConnector      = connMod.renderConnector;
var renderPortTees       = connMod.renderPortTees;
var resolveCorner        = connMod.resolveCorner;
var segDirection         = connMod.segDirection;
var resolveArrow         = connMod.resolveArrow;
var labelMod             = require('./render-labels');
var renderLabels         = labelMod.renderLabels;
var findLongestSegment   = labelMod.findLongestSegment;
var renderOpaqueBlocks   = labelMod.renderOpaqueBlocks;
var animMod              = require('./render-animation');
var computePerimeterPath = animMod.computePerimeterPath;
var overlayAnimation     = animMod.overlayAnimation;
var overlayTravelDot     = animMod.overlayTravelDot;
var OccupancyGrid        = require('./occupancy-grid').OccupancyGrid;

// ────────────────────────────────────────────────────────────────────
// § Main render function
// ────────────────────────────────────────────────────────────────────

/**
 * Render a DiagramModel to canonical ASCII text.
 *
 * This is the primary entry point for the renderer module.
 *
 * @param {import('./diagram-model').DiagramModel} model - The diagram to render.
 * @param {Object}  [options]            - Render options.
 * @param {number}  [options.frame]      - Animation frame number (omit for static).
 * @param {number}  [options.width]      - Override canvas width.
 * @param {number}  [options.height]     - Override canvas height.
 * @param {Object}  [options.travelState] - Active travel-dot state (cells + cellIdx).
 * @returns {string} The canonical ASCII diagram text.
 */
function render(model, options) {
  var opts   = options || {};
  var width  = opts.width  || model.width;
  var height = opts.height || model.height;

  var buf  = new CharBuffer(width, height);
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
