'use strict';

/**
 * lib/widget/diagram/parser-conn-helpers.js
 *
 * Connector-tracing helpers: cell classification, neighbour
 * discovery, segment construction, and port-side determination.
 */

var chars = require('./parser-chars');
var HORIZONTAL_CHARS     = chars.HORIZONTAL_CHARS;
var VERTICAL_CHARS       = chars.VERTICAL_CHARS;
var JUNCTION_CHARS       = chars.JUNCTION_CHARS;
var ARROW_CHARS          = chars.ARROW_CHARS;
var TOP_LEFT_CORNERS     = chars.TOP_LEFT_CORNERS;
var TOP_RIGHT_CORNERS    = chars.TOP_RIGHT_CORNERS;
var BOTTOM_LEFT_CORNERS  = chars.BOTTOM_LEFT_CORNERS;
var BOTTOM_RIGHT_CORNERS = chars.BOTTOM_RIGHT_CORNERS;

var SIDE = require('./diagram-model').SIDE;

/**
 * Test whether (x,y) is a connector-traceable cell.
 * Includes lines, junctions, arrows, plus corner characters that
 * appear outside boxes (i.e. connector bends).
 *
 * @param {string[][]} grid
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
function isConnectorCell(grid, width, height, x, y) {
  if (x < 0 || x >= width || y < 0 || y >= height) return false;
  var ch = grid[y][x];
  return HORIZONTAL_CHARS.has(ch) || VERTICAL_CHARS.has(ch) ||
         JUNCTION_CHARS.has(ch) || ARROW_CHARS.has(ch) ||
         TOP_LEFT_CORNERS.has(ch) || TOP_RIGHT_CORNERS.has(ch) ||
         BOTTOM_LEFT_CORNERS.has(ch) || BOTTOM_RIGHT_CORNERS.has(ch);
}

/**
 * Find orthogonal neighbours that could continue a connector path.
 *
 * Connectivity rules:
 *   ─  LEFT / RIGHT          │  UP / DOWN
 *   ┌  RIGHT / DOWN          ┐  LEFT / DOWN
 *   └  RIGHT / UP            ┘  LEFT / UP
 *   ├  UP / DOWN / RIGHT     ┤  UP / DOWN / LEFT
 *   ┬  LEFT / RIGHT / DOWN   ┴  LEFT / RIGHT / UP
 *   ┼  all four              Arrows: both dirs along their axis
 *
 * @param {string[][]} grid
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @returns {Array<{nx: number, ny: number}>}
 */
function getNeighbours(grid, width, height, x, y) {
  var results = [];
  var ch = grid[y][x];

  var isHorizArrow = (ch === '\u25B6' || ch === '\u25C0'); // ▶ ◀
  var isVertArrow  = (ch === '\u25BC' || ch === '\u2193' || ch === '\u25B2'); // ▼ ↓ ▲

  var canLeft  = HORIZONTAL_CHARS.has(ch) || JUNCTION_CHARS.has(ch) ||
                 TOP_RIGHT_CORNERS.has(ch) || BOTTOM_RIGHT_CORNERS.has(ch) ||
                 isHorizArrow;
  var canRight = HORIZONTAL_CHARS.has(ch) || JUNCTION_CHARS.has(ch) ||
                 TOP_LEFT_CORNERS.has(ch) || BOTTOM_LEFT_CORNERS.has(ch) ||
                 isHorizArrow;
  var canUp    = VERTICAL_CHARS.has(ch) || JUNCTION_CHARS.has(ch) ||
                 BOTTOM_LEFT_CORNERS.has(ch) || BOTTOM_RIGHT_CORNERS.has(ch) ||
                 isVertArrow;
  var canDown  = VERTICAL_CHARS.has(ch) || JUNCTION_CHARS.has(ch) ||
                 TOP_LEFT_CORNERS.has(ch) || TOP_RIGHT_CORNERS.has(ch) ||
                 isVertArrow;

  if (canLeft  && x > 0)          results.push({ nx: x - 1, ny: y });
  if (canRight && x < width - 1)  results.push({ nx: x + 1, ny: y });
  if (canUp    && y > 0)          results.push({ nx: x, ny: y - 1 });
  if (canDown  && y < height - 1) results.push({ nx: x, ny: y + 1 });

  return results;
}

// ────────────────────────────────────────────────────────────────────
// § buildSegments
// ────────────────────────────────────────────────────────────────────

/**
 * Build orthogonal segments from an ordered list of path cells.
 *
 * Groups consecutive cells into runs that share the same row or column,
 * producing `{ x1, y1, x2, y2 }` segment objects.
 *
 * @param {Array<{x: number, y: number, ch: string}>} cells
 * @returns {import('./diagram-model').Segment[]}
 */
function buildSegments(cells) {
  if (cells.length === 0) return [];

  var segments = [];
  var startX = cells[0].x;
  var startY = cells[0].y;
  var prevX  = startX;
  var prevY  = startY;

  for (var i = 1; i < cells.length; i++) {
    var cx = cells[i].x;
    var cy = cells[i].y;
    var dx = cx - prevX;
    var dy = cy - prevY;
    var dist = Math.abs(dx) + Math.abs(dy);

    if (dist !== 1) {
      /* Non-adjacent cell — close current segment and start fresh. */
      if (startX !== prevX || startY !== prevY) {
        segments.push({ x1: startX, y1: startY, x2: prevX, y2: prevY });
      }
      startX = cx;
      startY = cy;
    } else {
      var curHoriz = (startY === prevY && startX !== prevX);
      var curVert  = (startX === prevX && startY !== prevY);
      var newHoriz = (dy === 0);
      var newVert  = (dx === 0);

      if (startX === prevX && startY === prevY) {
        /* First step from a single-cell — just extend. */
      } else if ((curHoriz && !newHoriz) || (curVert && !newVert)) {
        /* Direction changed — close segment at the bend point. */
        segments.push({ x1: startX, y1: startY, x2: prevX, y2: prevY });
        startX = prevX;
        startY = prevY;
      }
    }

    prevX = cx;
    prevY = cy;
  }

  /* Close the final segment. */
  if (startX !== prevX || startY !== prevY) {
    segments.push({ x1: startX, y1: startY, x2: prevX, y2: prevY });
  }

  return segments;
}

// ────────────────────────────────────────────────────────────────────
// § determineSideAndOffset
// ────────────────────────────────────────────────────────────────────

/**
 * Determine which side and offset a border-adjacent cell is on,
 * relative to a box.
 *
 * @param {import('./diagram-model').DiagramBox} box
 * @param {number} x
 * @param {number} y
 * @returns {{ side: string|null, offset: number }}
 */
function determineSideAndOffset(box, x, y) {
  /* Top border */
  if (y === box.y && x > box.x && x < box.x + box.width - 1) {
    return { side: SIDE.TOP, offset: x - box.x - 1 };
  }
  /* Bottom border */
  if (y === box.y + box.height - 1 && x > box.x && x < box.x + box.width - 1) {
    return { side: SIDE.BOTTOM, offset: x - box.x - 1 };
  }
  /* Left border */
  if (x === box.x && y > box.y && y < box.y + box.height - 1) {
    return { side: SIDE.LEFT, offset: y - box.y - 1 };
  }
  /* Right border */
  if (x === box.x + box.width - 1 && y > box.y && y < box.y + box.height - 1) {
    return { side: SIDE.RIGHT, offset: y - box.y - 1 };
  }
  return { side: null, offset: 0 };
}

// ────────────────────────────────────────────────────────────────────
// § Exports
// ────────────────────────────────────────────────────────────────────

module.exports = {
  isConnectorCell:        isConnectorCell,
  getNeighbours:          getNeighbours,
  buildSegments:          buildSegments,
  determineSideAndOffset: determineSideAndOffset
};
