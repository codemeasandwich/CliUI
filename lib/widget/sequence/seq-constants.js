'use strict';

/**
 * lib/widget/sequence/seq-constants.js
 *
 * Enums for the sequence diagram widget.
 */

/**
 * Message line styles for arrows between participants.
 * @readonly
 * @enum {string}
 */
const MSG_STYLE = Object.freeze({
  SOLID:  'solid',
  DASHED: 'dashed',
  DOTTED: 'dotted'
});

/**
 * Arrow types for message line endpoints.
 * @readonly
 * @enum {string}
 */
const ARROW_TYPE = Object.freeze({
  FILLED: 'filled',
  OPEN:   'open',
  NONE:   'none'
});

/**
 * Position of a note relative to a lifeline.
 * @readonly
 * @enum {string}
 */
const NOTE_POSITION = Object.freeze({
  LEFT:    'left',
  RIGHT:   'right',
  OVER:    'over',
  BETWEEN: 'between'
});

module.exports = {
  MSG_STYLE: MSG_STYLE,
  ARROW_TYPE: ARROW_TYPE,
  NOTE_POSITION: NOTE_POSITION
};
