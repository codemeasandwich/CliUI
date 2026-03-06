'use strict';
// @esm-group Widgets

/**
 * lib/widget/diagram/router-segments.js
 *
 * Path-to-segments conversion and small utility helpers used by the
 * connector router.
 */

var SIDE = require('./diagram-model').SIDE;

// ────────────────────────────────────────────────────────────────────
// § Path → Segments conversion
// ────────────────────────────────────────────────────────────────────

/**
 * Convert an ordered list of grid cells into orthogonal segments.
 *
 * Consecutive cells moving in the same direction are collapsed into
 * a single `{ x1, y1, x2, y2 }` segment.  A new segment starts when
 * the direction changes (i.e. at a bend).
 *
 * @param {Array<{x: number, y: number}>} path - Ordered cells.
 * @returns {import('./diagram-model').Segment[]}
 */
function pathToSegments(path) {
  if (path.length < 2) return [];

  var segments = [];
  var startIdx = 0;

  for (var i = 2; i < path.length; i++) {
    var dx1 = path[i - 1].x - path[i - 2].x;
    var dy1 = path[i - 1].y - path[i - 2].y;
    var dx2 = path[i].x     - path[i - 1].x;
    var dy2 = path[i].y     - path[i - 1].y;

    if (dx1 !== dx2 || dy1 !== dy2) {
      /* Direction changed at path[i-1] — close current segment. */
      segments.push({
        x1: path[startIdx].x,
        y1: path[startIdx].y,
        x2: path[i - 1].x,
        y2: path[i - 1].y
      });
      startIdx = i - 1;
    }
  }

  /* Close the final segment. */
  segments.push({
    x1: path[startIdx].x,
    y1: path[startIdx].y,
    x2: path[path.length - 1].x,
    y2: path[path.length - 1].y
  });

  return segments;
}

// ────────────────────────────────────────────────────────────────────
// § Small utility helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Compute the first cell outside a box in the outward direction from
 * a port.
 *
 * @param {{ x: number, y: number }} portPos - Port grid position.
 * @param {string} side - Port side.
 * @returns {{ x: number, y: number }}
 */
function exitCell(portPos, side) {
  switch (side) {
    case SIDE.TOP:    return { x: portPos.x,     y: portPos.y - 1 };
    case SIDE.BOTTOM: return { x: portPos.x,     y: portPos.y + 1 };
    case SIDE.LEFT:   return { x: portPos.x - 1, y: portPos.y     };
    case SIDE.RIGHT:  return { x: portPos.x + 1, y: portPos.y     };
    default:          return { x: portPos.x,     y: portPos.y     };
  }
}

/**
 * Map a port side to the arrowhead direction for a connector arriving
 * at that port.
 *
 * A connector arriving at the TOP side of a box entered from above,
 * so the arrow points DOWN (into the box).
 *
 * @param {string} side
 * @returns {string}
 */
function sideToArrowDir(side) {
  switch (side) {
    case SIDE.TOP:    return 'down';
    case SIDE.BOTTOM: return 'up';
    case SIDE.LEFT:   return 'right';
    case SIDE.RIGHT:  return 'left';
    default:          return 'right';
  }
}

/**
 * Test whether three points are collinear (all on the same row or
 * same column).
 *
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @param {{ x: number, y: number }} c
 * @returns {boolean}
 */
function isCollinear(a, b, c) {
  return (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
}

/**
 * Generate a simple L-shaped path (horizontal then vertical) as a
 * fallback when A* fails.
 *
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 * @returns {Array<{x: number, y: number}>}
 */
function simpleLPath(from, to) {
  var path = [];

  /* Horizontal leg. */
  var dx = from.x < to.x ? 1 : -1;
  for (var x = from.x; x !== to.x; x += dx) {
    path.push({ x: x, y: from.y });
  }

  /* Vertical leg. */
  var dy = from.y < to.y ? 1 : -1;
  for (var y = from.y; y !== to.y; y += dy) {
    path.push({ x: to.x, y: y });
  }

  path.push({ x: to.x, y: to.y });
  return path;
}

// ────────────────────────────────────────────────────────────────────
// § Exports
// ────────────────────────────────────────────────────────────────────

module.exports = {
  pathToSegments: pathToSegments,
  exitCell:       exitCell,
  sideToArrowDir: sideToArrowDir,
  isCollinear:    isCollinear,
  simpleLPath:    simpleLPath
};
