'use strict';

/**
 * lib/widget/diagram/model-constants.js
 *
 * Enums shared across all diagram-model sub-modules.
 */

/**
 * The four sides of a rectangular box.
 * @readonly
 * @enum {string}
 */
const SIDE = Object.freeze({
  TOP:    'top',
  RIGHT:  'right',
  BOTTOM: 'bottom',
  LEFT:   'left'
});

/**
 * Visual / semantic states a box can be in.
 * @readonly
 * @enum {string}
 */
const BOX_STATE = Object.freeze({
  STANDARD:     'standard',
  CHECKED:      'checked',
  CURRENT_WORK: 'currentWork'
});

/**
 * Label placement category (spec §6.6).
 * @readonly
 * @enum {string}
 */
const LABEL_TYPE = Object.freeze({
  LINE:     'line',
  ENDPOINT: 'endpoint',
  ENTRY:    'entry'
});

/**
 * Connector visual styles (spec §6.3).
 * Controls how the connector path is drawn and animated.
 * @readonly
 * @enum {string}
 */
const CONN_STYLE = Object.freeze({
  STATIC:   'static',
  ANIMATED: 'animated',
  DASHED:   'dashed',
  SNAKE:    'snake',
  SPINNER:  'spinner',
  STREAM:   'stream'
});

/**
 * Semantic node kinds for diagram boxes.
 * Controls rendering treatment (e.g. decision nodes get bracket text).
 * @readonly
 * @enum {string}
 */
const NODE_KIND = Object.freeze({
  PROCESS:  'process',
  DECISION: 'decision',
  TERMINAL: 'terminal',
  STATE:    'state'
});

/**
 * Box status indicators (spec §9).
 * Controls border colour overlay in the render pass.
 * @readonly
 * @enum {string}
 */
const STATUS = Object.freeze({
  SUCCESS: 'success',
  ERROR:   'error',
  PENDING: 'pending'
});

/**
 * Convert a SIDE constant to the corresponding arrow direction string.
 *
 * Used by data builders (data-builder.js, data-builder-decision.js)
 * to set the arrowDir property on connectors based on which side of
 * the destination box the connector enters.
 *
 * @param {string} side - SIDE enum value.
 * @returns {string} Arrow direction ('left', 'right', 'up', or 'down').
 */
function sideToArrowDir(side) {
  switch (side) {
    case SIDE.LEFT:   return 'left';
    case SIDE.RIGHT:  return 'right';
    case SIDE.TOP:    return 'up';
    case SIDE.BOTTOM: return 'down';
    default:          return 'right';
  }
}

module.exports = {
  SIDE: SIDE, BOX_STATE: BOX_STATE, LABEL_TYPE: LABEL_TYPE,
  CONN_STYLE: CONN_STYLE, STATUS: STATUS, NODE_KIND: NODE_KIND,
  sideToArrowDir: sideToArrowDir
};
