'use strict';
// @esm-group Widgets

/**
 * lib/widget/diagram/diagram-router.js  (barrel)
 *
 * Re-exports the A*-based orthogonal connector router, which is split
 * across four implementation files:
 *
 *   router-min-heap.js  — COST, DIRECTIONS constants + MinHeap class
 *   router-astar.js     — astarFind + isAdjacentToBox helper
 *   router-segments.js  — pathToSegments, exitCell, sideToArrowDir,
 *                          isCollinear, simpleLPath
 *   router-route.js     — routeConnector, routeAll, rerouteAffected
 */

var heap     = require('./router-min-heap');
var astar    = require('./router-astar');
var segments = require('./router-segments');
var route    = require('./router-route');

module.exports = {
  COST:            heap.COST,
  DIRECTIONS:      heap.DIRECTIONS,
  MinHeap:         heap.MinHeap,
  astarFind:       astar.astarFind,
  isAdjacentToBox: astar.isAdjacentToBox,
  pathToSegments:  segments.pathToSegments,
  exitCell:        segments.exitCell,
  sideToArrowDir:  segments.sideToArrowDir,
  isCollinear:     segments.isCollinear,
  simpleLPath:     segments.simpleLPath,
  routeConnector:  route.routeConnector,
  routeAll:        route.routeAll,
  rerouteAffected: route.rerouteAffected
};
