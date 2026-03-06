'use strict';
// @esm-group Widgets

/**
 * lib/widget/diagram/router-astar.js
 *
 * A*-based orthogonal pathfinder on the character-cell grid.
 */

var COST       = require('./router-min-heap').COST;
var DIRECTIONS = require('./router-min-heap').DIRECTIONS;
var MinHeap    = require('./router-min-heap').MinHeap;
var CELL_TYPE  = require('./occupancy-grid').CELL_TYPE;

// ────────────────────────────────────────────────────────────────────
// § A* pathfinder
// ────────────────────────────────────────────────────────────────────

/**
 * Find the shortest orthogonal path between two points on the grid.
 *
 * The search operates on a 3D state space: (x, y, dirIndex).
 * Including direction avoids re-evaluating bend costs retrospectively.
 *
 * @param {number} srcX - Source column.
 * @param {number} srcY - Source row.
 * @param {number} dstX - Destination column.
 * @param {number} dstY - Destination row.
 * @param {import('./occupancy-grid').OccupancyGrid} grid - Obstacle map.
 * @param {Set<string>} [allowedCells] - Additional cells that are passable
 *   even if the grid marks them as blocked (used for source/dest port cells).
 * @returns {Array<{x: number, y: number}>|null} Ordered list of cells from
 *   source to destination, or null if no path exists.
 */
function astarFind(srcX, srcY, dstX, dstY, grid, allowedCells) {
  var w = grid.width;
  var h = grid.height;
  var numDirs = DIRECTIONS.length; // 4

  /* Manhattan distance heuristic. */
  var heuristic = function (x, y) { return Math.abs(x - dstX) + Math.abs(y - dstY); };

  /*
   * State encoding: pack (x, y, dir) into a single integer.
   *   key = (y * w + x) * numDirs + dir
   */
  var encode = function (x, y, d) { return (y * w + x) * numDirs + d; };

  /* Cost maps: gCost[key] = best-known cost to reach this state. */
  var gCost = new Map();

  /* Parent map for path reconstruction: key → parentKey. */
  var cameFrom = new Map();

  /* Open set (priority queue). */
  var open = new MinHeap();

  /* Allowed-cell set for port cells that would normally be blocked. */
  var allowed = allowedCells || new Set();
  allowed.add(srcX + ',' + srcY);
  allowed.add(dstX + ',' + dstY);

  /**
   * Test whether a cell is passable.
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  var isPassable = function (x, y) {
    if (allowed.has(x + ',' + y)) return true;
    return !grid.isBlocked(x, y);
  };

  /* Seed the open set with all four directions from the source. */
  var d, key, g, f;
  for (d = 0; d < numDirs; d++) {
    key = encode(srcX, srcY, d);
    g = 0;
    f = g + heuristic(srcX, srcY);
    gCost.set(key, g);
    open.push({ f: f, g: g, x: srcX, y: srcY, d: d, key: key });
  }

  /* ── Main A* loop ──────────────────────────────────────────── */
  while (open.size > 0) {
    var cur = open.pop();

    /* Goal check. */
    if (cur.x === dstX && cur.y === dstY) {
      /* Reconstruct path. */
      var path = [];
      var k = cur.key;
      while (k !== undefined) {
        var pos = Math.floor(k / numDirs);
        path.push({ x: pos % w, y: Math.floor(pos / w) });
        k = cameFrom.get(k);
      }
      path.reverse();
      return path;
    }

    /* Skip if we've already found a cheaper route to this state. */
    if (gCost.has(cur.key) && cur.g > gCost.get(cur.key)) continue;

    /* Expand neighbours in all four directions. */
    for (d = 0; d < numDirs; d++) {
      var dir = DIRECTIONS[d];
      var nx = cur.x + dir.dx;
      var ny = cur.y + dir.dy;

      /* Bounds check. */
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;

      /* Obstacle check. */
      if (!isPassable(nx, ny)) continue;

      /* ── Compute movement cost ─────────────────────────────── */
      var moveCost = COST.STRAIGHT;

      /* Bend penalty: direction changed from current. */
      if (d !== cur.d) moveCost += COST.BEND;

      /* Adjacency penalty: cell next to a box border. */
      if (isAdjacentToBox(nx, ny, grid)) moveCost += COST.ADJACENT;

      /* Crossing penalty: cell is an existing connector. */
      var cell = grid.query(nx, ny);
      if (cell.type === CELL_TYPE.CONNECTOR || cell.type === CELL_TYPE.JUNCTION) {
        moveCost += COST.CROSSING;
      }

      var tentativeG = cur.g + moveCost;
      var nKey = encode(nx, ny, d);

      if (!gCost.has(nKey) || tentativeG < gCost.get(nKey)) {
        gCost.set(nKey, tentativeG);
        cameFrom.set(nKey, cur.key);
        open.push({
          f: tentativeG + heuristic(nx, ny),
          g: tentativeG,
          x: nx,
          y: ny,
          d: d,
          key: nKey
        });
      }
    }
  }

  /* No path found. */
  return null;
}

/**
 * Test whether a cell is orthogonally adjacent to a box border cell.
 *
 * Used to apply the adjacency cost penalty, which pushes connectors
 * away from box edges for visual clarity.
 *
 * @param {number} x
 * @param {number} y
 * @param {import('./occupancy-grid').OccupancyGrid} grid
 * @returns {boolean}
 */
function isAdjacentToBox(x, y, grid) {
  for (var i = 0; i < DIRECTIONS.length; i++) {
    var dir = DIRECTIONS[i];
    var nx = x + dir.dx;
    var ny = y + dir.dy;
    var c = grid.query(nx, ny);
    if (c.type === CELL_TYPE.BORDER || c.type === CELL_TYPE.CONTENT) {
      return true;
    }
  }
  return false;
}

// ────────────────────────────────────────────────────────────────────
// § Exports
// ────────────────────────────────────────────────────────────────────

module.exports = {
  astarFind:      astarFind,
  isAdjacentToBox: isAdjacentToBox
};
