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
  SPINNER:  'spinner'
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

module.exports = {
  SIDE: SIDE, BOX_STATE: BOX_STATE, LABEL_TYPE: LABEL_TYPE,
  CONN_STYLE: CONN_STYLE, STATUS: STATUS
};
