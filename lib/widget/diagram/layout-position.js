'use strict';
// @esm-group Widgets

/**
 * lib/widget/diagram/layout-position.js
 *
 * Ordering and position-assignment helpers for the diagram
 * auto-layout engine.
 *
 * Implements predecessor-aligned coordinate assignment inspired by
 * Brandes-Köpf (used by dagre, ELK) but simplified for
 * ASCII cell-grid constraints:
 *
 *   Each box's Y = median predecessor Y-centre (horizontal chains)
 *   Sibling groups fan downward from parent (L-shaped branches)
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
 * Measure the widest box in each layer (column width for X placement).
 *
 * @param {Array<number[]>} layers
 * @param {import('./diagram-model').DiagramModel} model
 * @returns {number[]} maxWidth per layer.
 * @private
 */
function layerWidths(layers, model) {
  var widths = [];
  for (var i = 0; i < layers.length; i++) {
    var maxW = 0;
    for (var j = 0; j < layers[i].length; j++) {
      var box = model.getBox(layers[i][j]);
      if (box && box.width > maxW) maxW = box.width;
    }
    widths.push(maxW);
  }
  return widths;
}

/**
 * Compute X position for each layer column.
 *
 * Distributes layers evenly across the available width.  The gap
 * between columns grows to fill spare space but never exceeds 3×
 * the default.  When total box width exceeds available space,
 * the gap drops to 0 so boxes sit flush rather than overflowing.
 *
 * @param {number[]} colWidths   - Width of each layer column.
 * @param {Object}   opts        - gapX, startX, availableWidth.
 * @returns {number[]} X position per layer.
 * @private
 */
function computeLayerX(colWidths, opts) {
  var totalW = 0;
  for (var i = 0; i < colWidths.length; i++) totalW += colWidths[i];

  var availW = opts.availableWidth || 0;
  var gapX   = opts.gapX;

  /* Compute a gap that fills the available width.
   * When the total box width already exceeds the available space,
   * fitGap goes negative — clamp to 0 so boxes sit flush rather
   * than adding extra width that causes blessed to line-wrap. */
  if (availW && colWidths.length > 1) {
    var spare  = availW - totalW - opts.startX;
    var fitGap = Math.floor(spare / (colWidths.length - 1));
    gapX = Math.max(0, Math.min(opts.gapX * 3, fitGap));
  }

  var xs = [];
  var curX = opts.startX;
  for (var k = 0; k < colWidths.length; k++) {
    xs.push(curX);
    curX += colWidths[k] + gapX;
  }

  return xs;
}

// ────────────────────────────────────────────────────────────────────
// § Median helper
// ────────────────────────────────────────────────────────────────────

/**
 * Return the median value from an array of numbers.
 *
 * The median is more robust than the mean for predecessor alignment
 * (Brandes-Köpf insight): with 2 predecessors it picks the one
 * closer to centre; with 1 it is equivalent to the value itself.
 * This naturally spreads branches when predecessors diverge.
 *
 * @param {number[]} values - Unsorted numeric values.
 * @returns {number} Median value.
 * @private
 */
function median(values) {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];

  values.sort(function (a, b) { return a - b; });
  var mid = Math.floor(values.length / 2);

  /* Even count: average the two middle values for a centred result. */
  if (values.length % 2 === 0) {
    return Math.round((values[mid - 1] + values[mid]) / 2);
  }
  return values[mid];
}

// ────────────────────────────────────────────────────────────────────
// § Forward pass — align layer (median + sibling grouping)
// ────────────────────────────────────────────────────────────────────

/**
 * Compute Y positions for one layer using predecessor-aligned
 * placement with sibling-aware branching.
 *
 * Algorithm (inspired by dagre/Brandes-Köpf, adapted for ASCII):
 *
 * 1. For each box, compute ideal Y = median predecessor Y-centre.
 *    This centres the child on its parent, producing a straight
 *    horizontal connector for single parent→child chains.
 *    Layer 0 boxes stack from the top margin.
 *
 * 2. Detect "sibling groups" — sets of boxes that share the same
 *    sole predecessor.  Fan each group downward from the parent's
 *    Y-centre: first child aligns with parent (horizontal), rest
 *    stack below (L-shaped connectors).
 *
 * 3. Resolve overlaps by pushing boxes downward (preserving the
 *    crossing-minimised barycentric order from orderWithinLayers).
 *
 * 4. Compact proportionally if the layer exceeds available height.
 *
 * @param {number[]}  layerIds - Box IDs in barycentric order.
 * @param {import('./diagram-model').DiagramModel} model
 * @param {Map<number, Set<number>>} reverse - predecessors map.
 * @param {Map<number, {y: number, h: number}>} placed - already-placed boxes.
 * @param {number}   layerIdx    - 0 for root layer.
 * @param {number}   availH      - Available content height (0 = unconstrained).
 * @param {number}   startY      - Top margin.
 * @param {number}   minGap      - Minimum vertical gap between boxes.
 * @returns {Array<{id: number, y: number, h: number}>}
 * @private
 */
function alignLayer(layerIds, model, reverse, placed, layerIdx, availH, startY, minGap) {

  /* ── Step 1: Compute ideal Y positions ─────────────────────── */
  var items = [];
  for (var i = 0; i < layerIds.length; i++) {
    var id  = layerIds[i];
    var box = model.getBox(id);
    if (!box) continue;

    var idealY;
    if (layerIdx === 0) {
      /* Layer 0: start from the top, stacking downward.
       * No vertical centering — the diagonal cascade starts here. */
      var cumY = startY;
      for (var ei = 0; ei < i; ei++) {
        var eb = model.getBox(layerIds[ei]);
        if (eb) cumY += eb.height + minGap;
      }
      idealY = cumY;
    } else {
      /* Layer 1+: MEDIAN Y-centre of predecessors.
       *
       * Each box is vertically centred on the median of its
       * predecessors' Y-centres.  For a single parent→child
       * chain this places the child at the parent's level,
       * producing a straight horizontal connector.
       *
       * Diagonal cascade emerges naturally from branching:
       * when siblings fan out (step 2), the lower sibling's
       * descendants inherit that lower Y through this median
       * computation — each branch point creates a new "floor". */
      var preds = reverse ? reverse.get(id) : null;
      if (preds && preds.size > 0) {
        var centres = [];
        for (var pred of preds) {
          var pp = placed.get(pred);
          if (pp) centres.push(pp.y + Math.floor(pp.h / 2));
        }
        idealY = centres.length > 0
          ? median(centres) - Math.floor(box.height / 2)
          : startY;
      } else {
        /* No predecessors — place at the top margin. */
        idealY = startY;
      }
    }

    /* Clamp to at least startY. */
    if (idealY < startY) idealY = startY;
    items.push({ id: id, y: idealY, h: box.height });
  }

  /* ── Step 2: Sibling grouping ──────────────────────────────── */
  /*
   * Detect boxes that share the same sole predecessor and fan them
   * symmetrically around that predecessor's Y-centre.  This is the
   * key insight from dagre/ELK: siblings of a branch point should
   * spread out rather than cluster at the parent's centre.
   *
   * Only applies to boxes with exactly one predecessor — boxes with
   * multiple predecessors are merge points and keep their median
   * ideal Y from step 1.
   */
  if (layerIdx > 0 && items.length > 1 && reverse) {
    /* Build a map: predecessorId → [item indices]. */
    var siblingGroups = {};
    for (var gi = 0; gi < items.length; gi++) {
      var preds2 = reverse.get(items[gi].id);
      /* Only group boxes with exactly one predecessor (branch children). */
      if (preds2 && preds2.size === 1) {
        var parentId = preds2.values().next().value;
        if (!siblingGroups[parentId]) siblingGroups[parentId] = [];
        siblingGroups[parentId].push(gi);
      }
    }

    /* Fan each sibling group symmetrically around the parent's centre. */
    for (var pid in siblingGroups) {
      var indices = siblingGroups[pid];
      /* Only spread groups of 2+ siblings — single children keep
       * their median-aligned position from step 1. */
      if (indices.length < 2) continue;

      var parentPlaced = placed.get(Number(pid));
      if (!parentPlaced) continue;

      var parentCentre = parentPlaced.y + Math.floor(parentPlaced.h / 2);

      /* Compute total height of the sibling group. */
      var groupH = 0;
      for (var si = 0; si < indices.length; si++) {
        groupH += items[indices[si]].h;
      }
      groupH += (indices.length - 1) * minGap;

      /* Fan downward from the parent's Y-centre: the first sibling
       * aligns with the parent, subsequent siblings stack below.
       * This creates a natural downward cascade for branches
       * (e.g. Y branch at parent level, N branch below). */
      var groupStart = parentCentre - Math.floor(items[indices[0]].h / 2);
      if (groupStart < startY) groupStart = startY;

      var gy = groupStart;
      for (var fi = 0; fi < indices.length; fi++) {
        items[indices[fi]].y = gy;
        gy += items[indices[fi]].h + minGap;
      }
    }
  }

  /* ── Step 3: Resolve overlaps (preserve barycentric order) ─── */
  for (var oi = 1; oi < items.length; oi++) {
    var prevBottom = items[oi - 1].y + items[oi - 1].h + minGap;
    if (items[oi].y < prevBottom) {
      items[oi].y = prevBottom;
    }
  }

  /* ── Step 4: Compact if exceeding available height ─────────── */
  /*
   * No vertical centering — the per-layer stagger and predecessor
   * alignment produce the desired top-left → bottom-right flow.
   * Centering would collapse everything back to the middle.
   * Only compress when the layer physically overflows.
   */
  if (availH && items.length > 0) {
    var lastBottom = items[items.length - 1].y + items[items.length - 1].h;
    var totalSpan  = lastBottom - items[0].y;

    if (totalSpan > availH - startY) {
      /* Compress: scale all positions proportionally to fit. */
      var contentH = 0;
      for (var ci = 0; ci < items.length; ci++) contentH += items[ci].h;
      var availForGaps = (availH - startY) - contentH;
      var gapPerSlot   = items.length > 1
        ? Math.max(minGap, Math.floor(availForGaps / (items.length - 1)))
        : 0;
      var cy = startY;
      for (var csi = 0; csi < items.length; csi++) {
        items[csi].y = cy;
        cy += items[csi].h + gapPerSlot;
      }
    }
  }

  return items;
}

// ────────────────────────────────────────────────────────────────────
// § Orchestrator — assignPositions
// ────────────────────────────────────────────────────────────────────

/**
 * Assign absolute (x, y) positions using predecessor-aligned
 * coordinate assignment (inspired by Brandes-Köpf / dagre).
 *
 * Flow is always left-to-right (layers = columns).
 *
 * Each box's Y = median predecessor Y-centre, so single
 * parent→child chains form straight horizontal connectors.
 * Sibling groups (boxes sharing one predecessor) fan downward
 * from the parent's centre, creating L-shaped branches.
 * Overlaps are resolved by pushing down.  Layers are compressed
 * to fit when they exceed available height.
 *
 * @param {Array<number[]>} layers
 * @param {import('./diagram-model').DiagramModel} model
 * @param {Object} opts - Layout options.
 * @param {Object} adj  - Adjacency maps from buildAdjacency.
 * @private
 */
function assignPositions(layers, model, opts, adj) {
  var availH  = opts.availableHeight || 0;
  var minGap  = Math.max(1, opts.gapY);
  var reverse = adj ? adj.reverse : null;

  /* ── X positions (one per layer column) ─────────────────────── */
  var colW   = layerWidths(layers, model);
  var layerX = computeLayerX(colW, opts);

  /* ── Forward pass: Y positions (layer by layer, left → right) ─ */
  var placed = new Map();

  for (var i = 0; i < layers.length; i++) {
    var items = alignLayer(
      layers[i], model, reverse, placed, i, availH, opts.startY, minGap
    );

    /* Write positions to boxes and record for the next layer. */
    for (var j = 0; j < items.length; j++) {
      var box = model.getBox(items[j].id);
      if (!box) continue;
      box.x = layerX[i];
      box.y = items[j].y;
      placed.set(items[j].id, { y: items[j].y, h: items[j].h });
    }
  }

  /*
   * No backward centering pass.
   *
   * Backward centering (shifting parents toward children's midpoint)
   * undoes the diagonal cascade by pulling early-layer boxes down
   * toward late-layer boxes, collapsing everything to a horizontal
   * line through the vertical centre.  The forward-pass stagger +
   * predecessor alignment already produces the correct top-left →
   * bottom-right flow, so backward adjustment is counter-productive.
   */
}

// ────────────────────────────────────────────────────────────────────
// § Model size adjustment
// ────────────────────────────────────────────────────────────────────

/**
 * Expand the model's width/height to fit all boxes with a margin.
 *
 * Clamps to the container dimensions so the rendered text never
 * exceeds the widget content area, which would cause blessed to
 * line-wrap and corrupt the visual output.
 *
 * @param {import('./diagram-model').DiagramModel} model
 * @param {number} margin - Extra cells of padding.
 * @param {number} [availW] - Container width to clamp to.
 * @param {number} [availH] - Container height to clamp to.
 * @private
 */
function fitModelSize(model, margin, availW, availH) {
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

  /* Clamp to the container dimensions so the rendered text never
   * exceeds the widget content area, which would cause blessed to
   * line-wrap and corrupt the visual output. */
  if (availW && model.width > availW) model.width = availW;
  if (availH && model.height > availH) model.height = availH;
}

// ────────────────────────────────────────────────────────────────────
// § Exports
// ────────────────────────────────────────────────────────────────────

module.exports = {
  orderWithinLayers: orderWithinLayers,
  assignPositions:   assignPositions,
  fitModelSize:      fitModelSize
};
