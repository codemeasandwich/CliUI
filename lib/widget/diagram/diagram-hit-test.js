'use strict';
// @esm-group Widgets

/**
 * lib/widget/diagram/diagram-hit-test.js
 *
 * Maps screen (x, y) coordinates to the diagram entity under the
 * cursor.  Used by the widget layer to implement click, drag, and
 * hover interactions.
 *
 * This barrel re-exports the core hitTest and HIT_KIND from
 * hit-test-core.js and adds region and nearest-entity queries.
 */

var core     = require('./hit-test-core');
var hitTest  = core.hitTest;
var HIT_KIND = core.HIT_KIND;

// ────────────────────────────────────────────────────────────────────
// § Region hit-test
// ────────────────────────────────────────────────────────────────────

/**
 * Find all unique entities within a rectangular region.
 *
 * Used for marquee-select / area queries.  Returns an array of unique
 * hit results, one per entity.
 *
 * @param {number} x1 - Left column (inclusive).
 * @param {number} y1 - Top row (inclusive).
 * @param {number} x2 - Right column (inclusive).
 * @param {number} y2 - Bottom row (inclusive).
 * @param {import('./occupancy-grid').OccupancyGrid} grid
 * @param {import('./diagram-model').DiagramModel} model
 * @returns {import('./hit-test-core').HitResult[]}
 */
function hitTestRegion(x1, y1, x2, y2, grid, model) {
  var minX = Math.min(x1, x2);
  var maxX = Math.max(x1, x2);
  var minY = Math.min(y1, y2);
  var maxY = Math.max(y1, y2);

  var seen = new Set();
  var results = [];

  for (var ry = minY; ry <= maxY; ry++) {
    for (var rx = minX; rx <= maxX; rx++) {
      var hit = hitTest(rx, ry, grid, model);
      if (hit.kind === HIT_KIND.EMPTY) continue;

      var key = hit.kind + ':' + hit.id;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(hit);
    }
  }

  return results;
}

// ────────────────────────────────────────────────────────────────────
// § Nearest-entity search
// ────────────────────────────────────────────────────────────────────

/**
 * Find the nearest non-empty entity to the given coordinates,
 * searching outward in a spiral pattern up to `maxRadius` cells.
 *
 * @param {number} x - Column.
 * @param {number} y - Row.
 * @param {import('./occupancy-grid').OccupancyGrid} grid
 * @param {import('./diagram-model').DiagramModel} model
 * @param {number} [maxRadius=3] - Maximum search distance.
 * @returns {import('./hit-test-core').HitResult}
 */
function hitTestNearest(x, y, grid, model, maxRadius) {
  if (maxRadius === undefined) maxRadius = 3;

  var exact = hitTest(x, y, grid, model);
  if (exact.kind !== HIT_KIND.EMPTY) return exact;

  for (var r = 1; r <= maxRadius; r++) {
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;

        var hit = hitTest(x + dx, y + dy, grid, model);
        if (hit.kind !== HIT_KIND.EMPTY) return hit;
      }
    }
  }

  return { kind: HIT_KIND.EMPTY, id: null, portId: null, x: x, y: y };
}

// ────────────────────────────────────────────────────────────────────
// § Exports
// ────────────────────────────────────────────────────────────────────

module.exports = {
  hitTest:        hitTest,
  hitTestRegion:  hitTestRegion,
  hitTestNearest: hitTestNearest,
  HIT_KIND:       HIT_KIND
};
