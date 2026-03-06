'use strict';
// @esm-group Widgets

/**
 * lib/widget/diagram/occupancy-grid.js
 *
 * Barrel module — re-exports CELL_TYPE and OccupancyGrid from sub-files.
 *
 * The implementation is split across:
 *   grid-constants.js       — CELL_TYPE frozen enum
 *   grid-core.js            — OccupancyGrid class (constructor + primitives)
 *   grid-stamp-box.js       — stamp, _stampBox, _stampLabel (prototype patches)
 *   grid-stamp-connector.js — _stampConnector, _resolveCorner, etc. (prototype patches)
 */

var CELL_TYPE     = require('./grid-constants').CELL_TYPE;
var OccupancyGrid = require('./grid-core').OccupancyGrid;

/* Prototype patches — must be loaded after grid-core exports OccupancyGrid */
require('./grid-stamp-box');
require('./grid-stamp-connector');

module.exports = {
  CELL_TYPE:     CELL_TYPE,
  OccupancyGrid: OccupancyGrid
};
