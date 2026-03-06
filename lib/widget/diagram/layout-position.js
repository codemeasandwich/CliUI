'use strict';
// @esm-group Widgets

/**
 * lib/widget/diagram/layout-position.js
 *
 * Ordering and position-assignment helpers for the diagram
 * auto-layout engine.
 *
 * Exports:
 *   orderWithinLayers — barycentric ordering within each layer
 *   assignPositions   — absolute (x, y) placement per box
 *   fitModelSize      — expand model bounds to fit all boxes
 */

// ────────────────────────────────────────────────────────────────────
// § Ordering within layers (barycentric heuristic)
// ────────────────────────────────────────────────────────────────────

/**
 * Sort boxes within each layer by the barycentric position of their
 * predecessors in the previous layer.
 *
 * For stability, ties are broken by the box's current Y position.
 *
 * @param {Array<number[]>} layers
 * @param {Map<number, Set<number>>} reverse - predecessor map
 * @param {import('./diagram-model').DiagramModel} model
 * @returns {Array<number[]>} Layers with reordered box IDs.
 * @private
 */
function orderWithinLayers(layers, reverse, model) {
  /*
   * Build a position-in-layer index so we can look up the ordinal
   * position of any box in its layer quickly.
   */
  var posInLayer = new Map();

  /* Layer 0 has no predecessors — keep original order, seeded by Y. */
  layers[0].sort(function (a, b) {
    var ba = model.getBox(a);
    var bb = model.getBox(b);
    return (ba ? ba.y : 0) - (bb ? bb.y : 0);
  });
  layers[0].forEach(function (id, idx) { posInLayer.set(id, idx); });

  /* Subsequent layers: barycentric ordering. */
  for (var li = 1; li < layers.length; li++) {
    var layer = layers[li];

    /** Map<boxId, barycentre>. */
    var bary = new Map();

    for (var j = 0; j < layer.length; j++) {
      var id = layer[j];
      var preds = reverse.get(id);
      if (!preds || preds.size === 0) {
        /* No predecessors — use current Y as tie-breaker. */
        var box = model.getBox(id);
        bary.set(id, box ? box.y : 0);
        continue;
      }

      var sum = 0;
      var count = 0;
      for (var pred of preds) {
        if (posInLayer.has(pred)) {
          sum += posInLayer.get(pred);
          count += 1;
        }
      }
      bary.set(id, count > 0 ? sum / count : 0);
    }

    layer.sort(function (a, b) { return bary.get(a) - bary.get(b); });
    layer.forEach(function (id, idx) { posInLayer.set(id, idx); });
  }

  return layers;
}

// ────────────────────────────────────────────────────────────────────
// § Position assignment
// ────────────────────────────────────────────────────────────────────

/**
 * Assign absolute (x, y) positions to each box based on its layer
 * and order index.
 *
 * @param {Array<number[]>} layers
 * @param {import('./diagram-model').DiagramModel} model
 * @param {Object} opts - Layout options.
 * @param {number} opts.gapX  - Horizontal gap between layers.
 * @param {number} opts.gapY  - Vertical gap within a layer.
 * @param {number} opts.startX
 * @param {number} opts.startY
 * @private
 */
function assignPositions(layers, model, opts) {
  var curX = opts.startX;

  for (var i = 0; i < layers.length; i++) {
    var layer = layers[i];
    var maxW = 0;
    var curY = opts.startY;

    for (var j = 0; j < layer.length; j++) {
      var id  = layer[j];
      var box = model.getBox(id);
      if (!box) continue;

      model.moveBox(id, curX, curY);
      curY += box.height + opts.gapY;

      if (box.width > maxW) maxW = box.width;
    }

    curX += maxW + opts.gapX;
  }
}

// ────────────────────────────────────────────────────────────────────
// § Model size adjustment
// ────────────────────────────────────────────────────────────────────

/**
 * Expand the model's width/height to fit all boxes with a margin.
 *
 * @param {import('./diagram-model').DiagramModel} model
 * @param {number} margin - Extra cells of padding.
 * @private
 */
function fitModelSize(model, margin) {
  var maxX = 0;
  var maxY = 0;

  for (var entry of model.boxes) {
    var box    = entry[1];
    var right  = box.x + box.width;
    var bottom = box.y + box.height;
    if (right  > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }

  model.width  = maxX + margin;
  model.height = maxY + margin;
}

// ────────────────────────────────────────────────────────────────────
// § Exports
// ────────────────────────────────────────────────────────────────────

module.exports = {
  orderWithinLayers: orderWithinLayers,
  assignPositions:   assignPositions,
  fitModelSize:      fitModelSize
};
