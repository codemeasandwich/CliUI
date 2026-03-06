'use strict';
// @esm-group Widgets

/**
 * lib/widget/diagram/layout-graph.js
 *
 * Graph-building and layer-assignment helpers for the diagram
 * auto-layout engine.
 *
 * Exports:
 *   DEFAULTS        — default gap / margin constants
 *   buildAdjacency  — directed adjacency lists from model connectors
 *   assignLayers    — Kahn's topological-sort layer assignment
 */

// ────────────────────────────────────────────────────────────────────
// § Constants — default gap sizes
// ────────────────────────────────────────────────────────────────────

/**
 * Default layout configuration.
 *
 * @readonly
 */
var DEFAULTS = Object.freeze({
  /** Horizontal gap between layers (columns of boxes). */
  gapX:   6,
  /** Vertical gap between boxes within the same layer. */
  gapY:   2,
  /** Left margin (column where the first layer starts). */
  startX: 1,
  /** Top margin (row where the first box in a layer starts). */
  startY: 1
});

// ────────────────────────────────────────────────────────────────────
// § Build adjacency from model
// ────────────────────────────────────────────────────────────────────

/**
 * Build directed adjacency lists from the model's connectors.
 *
 * Each connector has a source port (on box A) and a destination port
 * (on box B).  The direction of the edge is A → B.
 *
 * Returns:
 *   - `forward`:  Map<boxId, Set<boxId>> — successors
 *   - `reverse`:  Map<boxId, Set<boxId>> — predecessors
 *   - `indegree`: Map<boxId, number>     — count of incoming edges
 *
 * @param {import('./diagram-model').DiagramModel} model
 * @returns {{ forward: Map<number, Set<number>>, reverse: Map<number, Set<number>>, indegree: Map<number, number> }}
 * @private
 */
function buildAdjacency(model) {
  var forward  = new Map();
  var reverse  = new Map();
  var indegree = new Map();

  /* Initialise every box. */
  for (var entry of model.boxes) {
    var id = entry[0];
    forward.set(id, new Set());
    reverse.set(id, new Set());
    indegree.set(id, 0);
  }

  /* Walk connectors. */
  for (var cEntry of model.connectors) {
    var conn = cEntry[1];
    var srcPort = model.getPort(conn.sourcePortId);
    var dstPort = model.getPort(conn.destPortId);
    if (!srcPort || !dstPort) continue;

    var srcBox = srcPort.boxId;
    var dstBox = dstPort.boxId;

    /* Self-loops and back-edges don't affect layering.
     * Back-edges (cycle/decision diagrams) are excluded from the
     * forward adjacency so Kahn's algorithm sees a DAG. The connector
     * is still routed normally after layout. */
    if (srcBox === dstBox) continue;
    if (conn.backEdge) continue;

    if (!forward.get(srcBox).has(dstBox)) {
      forward.get(srcBox).add(dstBox);
      reverse.get(dstBox).add(srcBox);
      indegree.set(dstBox, indegree.get(dstBox) + 1);
    }
  }

  return { forward: forward, reverse: reverse, indegree: indegree };
}

// ────────────────────────────────────────────────────────────────────
// § Layer assignment (Kahn's topological sort)
// ────────────────────────────────────────────────────────────────────

/**
 * Assign each box to a horizontal layer using Kahn's algorithm.
 *
 * Handles cycles by breaking them: if no zero-indegree nodes are
 * available but unassigned nodes remain, the unassigned node with the
 * lowest current indegree is forced into the current layer.  This
 * makes the layout resilient to cyclic connector graphs.
 *
 * @param {import('./diagram-model').DiagramModel} model
 * @param {Map<number, Set<number>>} forward
 * @param {Map<number, number>} indegree
 * @returns {Array<number[]>} Array of layers, each an array of box IDs.
 * @private
 */
function assignLayers(model, forward, indegree) {
  /* Clone indegree so we can mutate it. */
  var deg = new Map(indegree);
  var assigned = new Set();
  var layers = [];

  while (assigned.size < model.boxes.size) {
    /* Collect all zero-indegree, unassigned boxes. */
    var layer = [];
    for (var pair of deg) {
      var id = pair[0];
      var d  = pair[1];
      if (!assigned.has(id) && d === 0) {
        layer.push(id);
      }
    }

    /*
     * Cycle breaker: if no zero-indegree nodes, force the node with
     * the smallest remaining indegree.
     */
    if (layer.length === 0) {
      var minDeg  = Infinity;
      var minId   = -1;
      for (var pair2 of deg) {
        var id2 = pair2[0];
        var d2  = pair2[1];
        if (!assigned.has(id2) && d2 < minDeg) {
          minDeg = d2;
          minId  = id2;
        }
      }
      if (minId >= 0) layer.push(minId);
    }

    /* Mark layer members as assigned, decrement successors' indegree. */
    for (var i = 0; i < layer.length; i++) {
      var lid = layer[i];
      assigned.add(lid);
      for (var succ of forward.get(lid)) {
        if (!assigned.has(succ)) {
          deg.set(succ, deg.get(succ) - 1);
        }
      }
    }

    layers.push(layer);
  }

  return layers;
}

// ────────────────────────────────────────────────────────────────────
// § Exports
// ────────────────────────────────────────────────────────────────────

module.exports = {
  DEFAULTS:       DEFAULTS,
  buildAdjacency: buildAdjacency,
  assignLayers:   assignLayers
};
