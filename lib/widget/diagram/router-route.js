'use strict';
// @esm-group Widgets

/**
 * lib/widget/diagram/router-route.js
 *
 * High-level routing API: routeConnector, routeAll, rerouteAffected.
 */

var astarFind      = require('./router-astar').astarFind;
var pathToSegments = require('./router-segments').pathToSegments;
var exitCell       = require('./router-segments').exitCell;
var sideToArrowDir = require('./router-segments').sideToArrowDir;
var sideToExitDir  = require('./router-segments').sideToExitDir;
var isCollinear    = require('./router-segments').isCollinear;
var simpleLPath    = require('./router-segments').simpleLPath;

var OccupancyGrid  = require('./occupancy-grid').OccupancyGrid;
var CHARSETS       = require('../../border/charsets').CHARSETS;

// ────────────────────────────────────────────────────────────────────
// § Single-connector routing
// ────────────────────────────────────────────────────────────────────

/**
 * Route a single connector.
 *
 * Looks up the source and destination port positions, runs A* between
 * them, and stores the resulting segments on the connector.
 *
 * Returns the connector (with updated segments) on success, or null
 * if no path was found.
 *
 * @param {number} connectorId - Connector to route.
 * @param {import('./diagram-model').DiagramModel} model
 * @param {import('./occupancy-grid').OccupancyGrid} grid
 * @returns {import('./diagram-model').DiagramConnector|null}
 */
function routeConnector(connectorId, model, grid) {
  var conn = model.getConnector(connectorId);
  if (!conn) return null;

  var srcPos = model.getPortPosition(conn.sourcePortId);
  var dstPos = model.getPortPosition(conn.destPortId);
  if (!srcPos || !dstPos) return null;

  /* Determine arrow direction from port side if not set. */
  if (!conn.arrowDir) {
    var dp = model.getPort(conn.destPortId);
    if (dp) {
      conn.arrowDir = sideToArrowDir(dp.side);
    }
  }

  /* The first step out of a port is one cell in the outward direction. */
  var srcPort = model.getPort(conn.sourcePortId);
  var dstPort = model.getPort(conn.destPortId);
  if (!srcPort || !dstPort) return null;

  var srcExit  = exitCell(srcPos, srcPort.side);
  var dstEntry = exitCell(dstPos, dstPort.side);

  /*
   * Compute the exit direction from the source port for a potential
   * source-side arrow.  The arrow is only placed when the connector
   * has enough geometry (multiple segments separated by bends) so
   * both arrows live on different legs and remain unambiguous.
   */
  var srcExitDir = sideToExitDir(srcPort.side);

  /* If source exit and dest entry are the same, connect directly. */
  if (srcExit.x === dstEntry.x && srcExit.y === dstEntry.y) {
    var seg = [{ x1: srcPos.x, y1: srcPos.y, x2: srcExit.x, y2: srcExit.y }];
    model.setConnectorSegments(connectorId, seg);
    /* Single segment — source arrow would compete with target; omit. */
    conn.sourceArrowDir = null;
    return conn;
  }

  /* Source and destination port cells are explicitly allowed. */
  var allowed = new Set([
    srcPos.x + ',' + srcPos.y,
    dstPos.x + ',' + dstPos.y,
    srcExit.x + ',' + srcExit.y,
    dstEntry.x + ',' + dstEntry.y
  ]);

  /* Run A* from exit cell to entry cell. */
  var path = astarFind(srcExit.x, srcExit.y, dstEntry.x, dstEntry.y, grid, allowed);

  if (!path) {
    /* Fallback: simple L-shaped path when A* fails. */
    var fallback = simpleLPath(srcExit, dstEntry);
    var segments = [
      { x1: srcPos.x, y1: srcPos.y, x2: srcExit.x, y2: srcExit.y }
    ].concat(pathToSegments(fallback)).concat([
      { x1: dstEntry.x, y1: dstEntry.y, x2: dstPos.x, y2: dstPos.y }
    ]);
    model.setConnectorSegments(connectorId, segments);
    conn.sourceArrowDir = computeSourceArrow(segments, srcExitDir);
    return conn;
  }

  /* Build segments: port → exit → …path… → entry → port. */
  var coreSegments = pathToSegments(path);
  var segments = [];

  /* Port-to-exit stub. */
  if (srcPos.x !== srcExit.x || srcPos.y !== srcExit.y) {
    if (coreSegments.length > 0 &&
        coreSegments[0].x1 === srcExit.x && coreSegments[0].y1 === srcExit.y &&
        isCollinear(srcPos, srcExit, { x: coreSegments[0].x2, y: coreSegments[0].y2 })) {
      /* Merge stub into the first core segment. */
      coreSegments[0] = {
        x1: srcPos.x, y1: srcPos.y,
        x2: coreSegments[0].x2, y2: coreSegments[0].y2
      };
    } else {
      segments.push({ x1: srcPos.x, y1: srcPos.y, x2: srcExit.x, y2: srcExit.y });
    }
  }

  /* Core segments. */
  for (var i = 0; i < coreSegments.length; i++) segments.push(coreSegments[i]);

  /* Entry-to-port stub. */
  if (dstPos.x !== dstEntry.x || dstPos.y !== dstEntry.y) {
    var last = segments[segments.length - 1];
    if (last && last.x2 === dstEntry.x && last.y2 === dstEntry.y &&
        isCollinear({ x: last.x1, y: last.y1 }, dstEntry, dstPos)) {
      /* Merge stub into the last segment. */
      segments[segments.length - 1] = {
        x1: last.x1, y1: last.y1,
        x2: dstPos.x, y2: dstPos.y
      };
    } else {
      segments.push({ x1: dstEntry.x, y1: dstEntry.y, x2: dstPos.x, y2: dstPos.y });
    }
  }

  model.setConnectorSegments(connectorId, segments);
  conn.sourceArrowDir = computeSourceArrow(segments, srcExitDir);
  return conn;
}

/**
 * Determine whether a source-side arrow should be placed.
 *
 * A source arrow is added only when the connector has multiple
 * segments (at least one bend) so the arrow lives on its own leg,
 * and the first segment is long enough (manhattan length >= 2) to
 * hold the arrow without crowding the border tee.
 *
 * @param {import('./diagram-model').Segment[]} segments
 * @param {string} exitDir - Direction the connector exits the source port.
 * @returns {string|null} Arrow direction string, or null if ineligible.
 */
function computeSourceArrow(segments, exitDir) {
  if (segments.length < 2) return null;

  /* Manhattan length of the first segment (cell count minus 1). */
  var first = segments[0];
  var len = Math.abs(first.x2 - first.x1) + Math.abs(first.y2 - first.y1);
  if (len < 2) return null;

  return exitDir;
}

// ────────────────────────────────────────────────────────────────────
// § Batch routing
// ────────────────────────────────────────────────────────────────────

/**
 * Route all connectors in the model.
 *
 * @param {import('./diagram-model').DiagramModel} model
 * @returns {import('./occupancy-grid').OccupancyGrid}
 */
function routeAll(model) {
  var grid = new OccupancyGrid(model.width, model.height);
  var charsets = {
    light:       CHARSETS.light,
    currentWork: CHARSETS.currentWork,
    connector:   CHARSETS.connector
  };

  /* Stamp only boxes into the grid. */
  for (var entry of model.boxes) {
    var box = entry[1];
    var cs = box.currentWork ? charsets.currentWork : charsets.light;
    grid._stampBox(box, cs, model);
  }

  /* Sort connectors by ID for deterministic order. */
  var connIds = Array.from(model.connectors.keys()).sort(function (a, b) { return a - b; });

  for (var ci = 0; ci < connIds.length; ci++) {
    var cid = connIds[ci];
    routeConnector(cid, model, grid);

    /* Stamp routed segments so subsequent routing sees them. */
    var conn = model.getConnector(cid);
    if (conn) {
      grid._stampConnector(conn, charsets.connector);
    }
  }

  return grid;
}

/**
 * Re-route only connectors attached to a specific box.
 *
 * Used during drag for responsive incremental updates.
 *
 * 1. Rebuild the occupancy grid from scratch (boxes only).
 * 2. Stamp all connectors NOT touching the moved box.
 * 3. Re-route only the affected connectors through the updated grid.
 *
 * Falls back to routeAll() for diagrams with fewer than 3 connectors
 * since the optimisation overhead is not worthwhile.
 *
 * @param {number} boxId - ID of the moved box.
 * @param {import('./diagram-model').DiagramModel} model
 * @returns {import('./occupancy-grid').OccupancyGrid}
 */
function rerouteAffected(boxId, model) {
  /* For tiny diagrams, just reroute everything. */
  if (model.connectors.size < 3) {
    return routeAll(model);
  }

  /* Determine which connectors are attached to the moved box. */
  var affectedIds = new Set();
  var affected = model.getConnectorsForBox(boxId);
  for (var a = 0; a < affected.length; a++) {
    affectedIds.add(affected[a].id);
  }

  /* If no connectors are attached, just re-stamp boxes. */
  if (affectedIds.size === 0) {
    return routeAll(model);
  }

  var grid = new OccupancyGrid(model.width, model.height);
  var charsets = {
    light:       CHARSETS.light,
    currentWork: CHARSETS.currentWork,
    connector:   CHARSETS.connector
  };

  /* Stamp all boxes into the grid. */
  for (var entry of model.boxes) {
    var box = entry[1];
    var cs = box.currentWork ? charsets.currentWork : charsets.light;
    grid._stampBox(box, cs, model);
  }

  /* Stamp unaffected connectors into the grid (sorted for determinism). */
  var allIds = Array.from(model.connectors.keys()).sort(function (a, b) { return a - b; });
  for (var ui = 0; ui < allIds.length; ui++) {
    var uid = allIds[ui];
    if (affectedIds.has(uid)) continue;
    var uc = model.getConnector(uid);
    if (uc) {
      grid._stampConnector(uc, charsets.connector);
    }
  }

  /* Re-route only the affected connectors, stamping each in order. */
  var sortedAffected = Array.from(affectedIds).sort(function (a, b) { return a - b; });
  for (var ri = 0; ri < sortedAffected.length; ri++) {
    var rid = sortedAffected[ri];
    routeConnector(rid, model, grid);
    var rc = model.getConnector(rid);
    if (rc) {
      grid._stampConnector(rc, charsets.connector);
    }
  }

  return grid;
}

// ────────────────────────────────────────────────────────────────────
// § Exports
// ────────────────────────────────────────────────────────────────────

module.exports = {
  routeConnector:  routeConnector,
  routeAll:        routeAll,
  rerouteAffected: rerouteAffected
};
