'use strict';

/**
 * lib/widget/diagram/grid-constants.js
 *
 * Cell-type vocabulary for the occupancy grid.
 */

/**
 * Allowed cell `type` values.
 *
 * Frozen to prevent accidental mutation and to serve as an exhaustive
 * reference for every consumer of the grid.
 *
 * @readonly
 * @enum {string}
 */
var CELL_TYPE = Object.freeze({
  EMPTY:     'empty',
  BORDER:    'border',
  CONTENT:   'content',
  CONNECTOR: 'connector',
  JUNCTION:  'junction',
  ARROW:     'arrow',
  LABEL:     'label',
  GATE:      'gate',
  PORT:      'port'
});

module.exports = { CELL_TYPE: CELL_TYPE };
