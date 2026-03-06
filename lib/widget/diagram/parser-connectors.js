'use strict';

/**
 * lib/widget/diagram/parser-connectors.js
 *
 * Pass 2 — Connector tracing for the diagram parser.
 */

var chars   = require('./parser-chars');
var helpers = require('./parser-conn-helpers');

var ARROW_CHARS      = chars.ARROW_CHARS;
var ARROW_MAP        = chars.ARROW_MAP;
var HORIZONTAL_CHARS = chars.HORIZONTAL_CHARS;
var VERTICAL_CHARS   = chars.VERTICAL_CHARS;
var JUNCTION_CHARS   = chars.JUNCTION_CHARS;

var isConnectorCell        = helpers.isConnectorCell;
var getNeighbours          = helpers.getNeighbours;
var buildSegments          = helpers.buildSegments;
var determineSideAndOffset = helpers.determineSideAndOffset;

/**
 * Trace connector paths from unvisited connector-character seeds.
 *
 * For each unvisited cell containing a connector character (line,
 * junction, arrow), this function flood-traces orthogonally to
 * reconstruct the connector's segment list, then identifies which
 * box ports anchor its endpoints.
 *
 * @param {string[][]} grid
 * @param {number}     width
 * @param {number}     height
 * @param {Set<string>} visited - Cells already claimed.
 * @param {import('./diagram-model').DiagramModel} model
 */
function traceConnectors(grid, width, height, visited, model) {
  /* Build borderMap: "x,y" → boxId for box border cells. */
  var borderMap = new Map();
  model.boxes.forEach(function(box) {
    for (var c = 0; c < box.width; c++) {
      borderMap.set((box.x + c) + ',' + box.y, box.id);
      borderMap.set((box.x + c) + ',' + (box.y + box.height - 1), box.id);
    }
    for (var r = 0; r < box.height; r++) {
      borderMap.set(box.x + ',' + (box.y + r), box.id);
      borderMap.set((box.x + box.width - 1) + ',' + (box.y + r), box.id);
    }
  });

  /* Scan for unvisited connector seed cells (arrowheads first). */
  var seeds = [];
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      if (visited.has(x + ',' + y)) continue;
      var ch = grid[y][x];
      if (ARROW_CHARS.has(ch)) {
        seeds.push({ x: x, y: y, priority: 0 });
      } else if (HORIZONTAL_CHARS.has(ch) || VERTICAL_CHARS.has(ch) ||
                 JUNCTION_CHARS.has(ch)) {
        seeds.push({ x: x, y: y, priority: 1 });
      }
    }
  }
  seeds.sort(function(a, b) { return a.priority - b.priority; });

  /* Process each seed — trace the full connected path. */
  for (var si = 0; si < seeds.length; si++) {
    var seed = seeds[si];
    if (visited.has(seed.x + ',' + seed.y)) continue;

    /* BFS to collect all cells in this connected path. */
    var pathCells = [];
    var queue = [{ x: seed.x, y: seed.y }];
    var localVisited = new Set();
    localVisited.add(seed.x + ',' + seed.y);

    while (queue.length > 0) {
      var cur = queue.shift();
      pathCells.push({ x: cur.x, y: cur.y, ch: grid[cur.y][cur.x] });

      var neighbours = getNeighbours(grid, width, height, cur.x, cur.y);
      for (var ni = 0; ni < neighbours.length; ni++) {
        var nx = neighbours[ni].nx, ny = neighbours[ni].ny;
        var nk = nx + ',' + ny;
        if (localVisited.has(nk)) continue;

        if (visited.has(nk)) {
          /* Box border cell — record adjacency but don't trace into box. */
          if (borderMap.has(nk)) {
            pathCells.push({
              x: nx, y: ny, ch: grid[ny][nx],
              isBoxBorder: true, boxId: borderMap.get(nk)
            });
          }
          localVisited.add(nk);
          continue;
        }

        if (isConnectorCell(grid, width, height, nx, ny)) {
          localVisited.add(nk);
          queue.push({ x: nx, y: ny });
        }
      }
    }

    /* Mark path cells as visited (except box border cells). */
    for (var pi = 0; pi < pathCells.length; pi++) {
      if (!pathCells[pi].isBoxBorder) {
        visited.add(pathCells[pi].x + ',' + pathCells[pi].y);
      }
    }

    /* Identify endpoints and build segments. */
    var arrowCells = pathCells.filter(function(c) {
      return ARROW_CHARS.has(c.ch) && !c.isBoxBorder;
    });
    var borderTouches = pathCells.filter(function(c) {
      return c.isBoxBorder;
    });
    var coreCells = pathCells.filter(function(c) {
      return !c.isBoxBorder;
    });
    if (coreCells.length === 0) continue;

    var segments = buildSegments(coreCells);

    var arrowDir = null;
    if (arrowCells.length > 0) {
      arrowDir = ARROW_MAP.get(arrowCells[0].ch) || null;
    }

    /* Create ports on boxes that this connector touches. */
    var sourcePortId = null;
    var destPortId = null;

    for (var bi = 0; bi < borderTouches.length; bi++) {
      var bt = borderTouches[bi];
      var box = model.getBox(bt.boxId);
      if (!box) continue;

      var info = determineSideAndOffset(box, bt.x, bt.y);
      if (info.side === null) continue;

      var port = model.findOrCreatePort(bt.boxId, info.side, info.offset);
      if (!port) continue;

      if (sourcePortId === null) {
        sourcePortId = port.id;
      } else if (destPortId === null) {
        destPortId = port.id;
      }
    }

    /* Swap source/dest if arrow points toward first border touch. */
    if (arrowDir && arrowCells.length > 0 && borderTouches.length >= 2) {
      var ac = arrowCells[0];
      var ft = borderTouches[0];
      var d1 = Math.abs(ac.x - ft.x) + Math.abs(ac.y - ft.y);
      var lt = borderTouches[borderTouches.length - 1];
      var d2 = Math.abs(ac.x - lt.x) + Math.abs(ac.y - lt.y);
      if (d1 < d2 && sourcePortId !== null && destPortId !== null) {
        var tmp = sourcePortId;
        sourcePortId = destPortId;
        destPortId = tmp;
      }
    }

    /* Only create a connector if we have at least two endpoints. */
    if (sourcePortId !== null && destPortId !== null) {
      var conn = model.addConnector(sourcePortId, destPortId, arrowDir);
      if (conn) {
        model.setConnectorSegments(conn.id, segments);
      }
    }
  }
}

module.exports = { traceConnectors: traceConnectors };
