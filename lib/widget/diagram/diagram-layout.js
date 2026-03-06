'use strict';
// @esm-group Widgets

/**
 * lib/widget/diagram/diagram-layout.js
 *
 * Barrel module + public API for the diagram auto-layout engine.
 *
 * Delegates graph-building and layering to ./layout-graph and
 * ordering / positioning to ./layout-position.  This file contains
 * the `layout()` orchestrator and `distributePorts()`.
 *
 *   const { layout } = require('./diagram-layout');
 *   layout(model, { gapX: 6, gapY: 2, startX: 1, startY: 1 });
 *   routeAll(model);
 */

var { SIDE } = require('./diagram-model');
var graph    = require('./layout-graph');
var position = require('./layout-position');

var DEFAULTS          = graph.DEFAULTS;
var buildAdjacency    = graph.buildAdjacency;
var assignLayers      = graph.assignLayers;
var orderWithinLayers = position.orderWithinLayers;
var assignPositions   = position.assignPositions;
var fitModelSize      = position.fitModelSize;

// ────────────────────────────────────────────────────────────────────
// § Public API — layout orchestrator
// ────────────────────────────────────────────────────────────────────

/**
 * Run the full auto-layout pipeline on the model.
 *
 * 1. Build adjacency from connectors.
 * 2. Assign boxes to layers (Kahn's algorithm).
 * 3. Order boxes within layers (barycentric heuristic).
 * 4. Assign (x, y) positions.
 * 5. Expand model bounds to fit.
 *
 * After calling `layout()`, invoke `routeAll()` to compute connector
 * paths that respect the new positions.
 *
 * @param {import('./diagram-model').DiagramModel} model - Model to
 *   lay out.  Box positions are mutated in-place.
 * @param {Object} [options]
 * @param {number} [options.gapX=6]  - Horizontal gap between layers.
 * @param {number} [options.gapY=2]  - Vertical gap within a layer.
 * @param {number} [options.startX=1] - Left margin.
 * @param {number} [options.startY=1] - Top margin.
 * @param {number} [options.margin=2] - Padding around the diagram.
 */
function layout(model, options) {
  var opts = Object.assign({}, DEFAULTS, options);
  var margin = opts.margin != null ? opts.margin : 2;

  /* Skip if there are no boxes. */
  if (model.boxes.size === 0) return;

  /* 1. Build adjacency. */
  var adj = buildAdjacency(model);

  /* 2. Assign layers. */
  var layers = assignLayers(model, adj.forward, adj.indegree);

  /* 3. Order within layers. */
  layers = orderWithinLayers(layers, adj.reverse, model);

  /* 4. Place boxes (predecessor-aligned coordinate assignment). */
  assignPositions(layers, model, opts, adj);

  /* 5. Fit model size (clamped to container to prevent line-wrap). */
  fitModelSize(model, margin, opts.availableWidth, opts.availableHeight);
}

// ────────────────────────────────────────────────────────────────────
// § Public API — port distribution
// ────────────────────────────────────────────────────────────────────

/**
 * Distribute ports evenly along each side of a box.
 *
 * When multiple connectors attach to the same side of a box, their
 * ports should be spaced evenly to avoid overlap.  This function
 * reassigns port offsets for every box in the model.
 *
 * @param {import('./diagram-model').DiagramModel} model
 */
function distributePorts(model) {
  for (var bEntry of model.boxes) {
    var boxId = bEntry[0];
    var box   = bEntry[1];

    /* Collect ports by side. */
    var sides = {};
    sides[SIDE.TOP]    = [];
    sides[SIDE.BOTTOM] = [];
    sides[SIDE.LEFT]   = [];
    sides[SIDE.RIGHT]  = [];

    for (var pEntry of model.ports) {
      var port = pEntry[1];
      if (port.boxId !== boxId) continue;
      if (sides[port.side]) {
        sides[port.side].push(port);
      }
    }

    /* For each side, distribute ports evenly. */
    var sideKeys = Object.keys(sides);
    for (var si = 0; si < sideKeys.length; si++) {
      var side  = sideKeys[si];
      var ports = sides[side];
      if (ports.length === 0) continue;

      /*
       * The available span depends on the side:
       *   TOP / BOTTOM: horizontal span = box.width - 2
       *   LEFT / RIGHT: vertical span   = box.height - 2
       */
      var span = (side === SIDE.TOP || side === SIDE.BOTTOM)
        ? box.width - 2
        : box.height - 2;

      if (span <= 0) continue;

      var gap = span / (ports.length + 1);
      for (var pi = 0; pi < ports.length; pi++) {
        ports[pi].offset = Math.round(gap * (pi + 1));
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────────
// § Exports
// ────────────────────────────────────────────────────────────────────

module.exports = {
  layout:            layout,
  distributePorts:   distributePorts,
  /* Re-exported from layout-graph.js */
  buildAdjacency:    buildAdjacency,
  assignLayers:      assignLayers,
  DEFAULTS:          DEFAULTS,
  /* Re-exported from layout-position.js */
  orderWithinLayers: orderWithinLayers,
  assignPositions:   assignPositions,
  fitModelSize:      fitModelSize
};
