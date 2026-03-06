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

    /*
     * Identify target-entry and source-exit arrow directions.
     *
     * When there are 2+ arrow cells, the one closest to the dest
     * border touch is the target arrow; the one closest to the source
     * border touch is the source-exit arrow.  With only 1 arrow cell,
     * it is always the target-entry arrow.
     */
    var arrowDir = null;
    var sourceArrowDir = null;
    if (arrowCells.length > 0) {
      arrowDir = ARROW_MAP.get(arrowCells[0].ch) || null;
    }

    /* Create ports on boxes that this connector touches.
     * Collect ALL touch ports so that branching paths (via ┬/┴/├/┤
     * junctions) with 3+ border touches produce multiple connectors
     * rather than silently dropping the extra destinations. */
    var touchPorts = [];

    for (var bi = 0; bi < borderTouches.length; bi++) {
      var bt = borderTouches[bi];
      var box = model.getBox(bt.boxId);
      if (!box) continue;

      var info = determineSideAndOffset(box, bt.x, bt.y);
      if (info.side === null) continue;

      var port = model.findOrCreatePort(bt.boxId, info.side, info.offset);
      if (!port) continue;

      touchPorts.push({ portId: port.id, bt: bt });
    }

    if (touchPorts.length < 2) continue;

    /*
     * Determine the source touch: the border touch FARTHEST from any
     * arrow cell.  Arrows point toward destinations, so the touch with
     * no nearby arrow is the source (outgoing) endpoint.
     */
    var srcIdx = 0;
    var srcMaxMinDist = 0;
    for (var si = 0; si < touchPorts.length; si++) {
      var minDist = Infinity;
      for (var sai = 0; sai < arrowCells.length; sai++) {
        var sd = Math.abs(arrowCells[sai].x - touchPorts[si].bt.x) +
                 Math.abs(arrowCells[sai].y - touchPorts[si].bt.y);
        if (sd < minDist) minDist = sd;
      }
      if (arrowCells.length === 0) minDist = 0;
      if (minDist > srcMaxMinDist) {
        srcMaxMinDist = minDist;
        srcIdx = si;
      }
    }
    var sourcePortId = touchPorts[srcIdx].portId;

    /*
     * Create a connector from the source to each other border touch.
     * For 2-touch paths this produces one connector (the common case).
     * For 3+-touch branching paths (via ┬/┴/├/┤ junctions) this
     * produces one connector per destination branch.
     *
     * Arrow direction for each destination is determined by the
     * nearest arrow cell.  Source-exit arrow uses the arrow nearest
     * to the source border touch (only for the first connector).
     */
    var firstConn = true;
    for (var di = 0; di < touchPorts.length; di++) {
      if (di === srcIdx) continue;

      /* Find nearest arrow to this destination for target-entry dir. */
      var destArrowDir = null;
      var nearestDestDist = Infinity;
      for (var dai = 0; dai < arrowCells.length; dai++) {
        var dd = Math.abs(arrowCells[dai].x - touchPorts[di].bt.x) +
                 Math.abs(arrowCells[dai].y - touchPorts[di].bt.y);
        if (dd < nearestDestDist) {
          nearestDestDist = dd;
          destArrowDir = ARROW_MAP.get(arrowCells[dai].ch) || null;
        }
      }

      var conn = model.addConnector(sourcePortId, touchPorts[di].portId, destArrowDir);
      if (conn) {
        /* Source-exit arrow: nearest arrow to the source border. */
        if (firstConn && arrowCells.length >= 2) {
          var srcArrow = null;
          var srcArrowDist = Infinity;
          for (var xai = 0; xai < arrowCells.length; xai++) {
            var xd = Math.abs(arrowCells[xai].x - touchPorts[srcIdx].bt.x) +
                     Math.abs(arrowCells[xai].y - touchPorts[srcIdx].bt.y);
            if (xd < srcArrowDist) {
              srcArrowDist = xd;
              srcArrow = arrowCells[xai];
            }
          }
          if (srcArrow) {
            conn.sourceArrowDir = ARROW_MAP.get(srcArrow.ch) || null;
          }
        }
        model.setConnectorSegments(conn.id, segments);
        firstConn = false;
      }
    }
  }
}

module.exports = { traceConnectors: traceConnectors };
