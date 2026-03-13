'use strict';

/**
 * lib/widget/diagram/diagram-errors.js
 *
 * Custom error types for the diagram widget.
 *
 * These errors provide clear, actionable messages when developers
 * pass invalid configuration to the diagram API. They are thrown
 * at the boundary between user input and the model layer.
 */

var BORDER_STYLES = require('../../border/charsets').BORDER_STYLES;

// ────────────────────────────────────────────────────────────────────
// § BorderStyleError
// ────────────────────────────────────────────────────────────────────

/**
 * Thrown when an unknown border style name is passed to a Box or
 * diagram widget. Lists the valid style names in the message so
 * the developer can fix the issue without consulting docs.
 *
 * @param {string} value - The invalid border style that was provided.
 */
function BorderStyleError(value) {
  var msg = 'Unknown border style: ' + value +
    '. Expected one of: ' + BORDER_STYLES.join(', ');
  Error.call(this, msg);
  this.message = msg;
  this.name = 'BorderStyleError';
}
BorderStyleError.prototype = Object.create(Error.prototype);
BorderStyleError.prototype.constructor = BorderStyleError;

// ────────────────────────────────────────────────────────────────────
// § ConnectionError
// ────────────────────────────────────────────────────────────────────

/**
 * Thrown when an Arrow or connection is created with invalid source
 * or target references (e.g. referencing a node ID that does not
 * exist in the diagram).
 *
 * @param {string} msg - Description of what went wrong.
 */
function ConnectionError(msg) {
  Error.call(this, msg);
  this.message = msg;
  this.name = 'ConnectionError';
}
ConnectionError.prototype = Object.create(Error.prototype);
ConnectionError.prototype.constructor = ConnectionError;

// ────────────────────────────────────────────────────────────────────
// § ParseError
// ────────────────────────────────────────────────────────────────────

/**
 * Thrown when the parser encounters invalid or unsupported syntax.
 *
 * @param {string} msg - Description of what went wrong.
 */
function ParseError(msg) {
  Error.call(this, msg);
  this.message = msg;
  this.name = 'ParseError';
}
ParseError.prototype = Object.create(Error.prototype);
ParseError.prototype.constructor = ParseError;

// ────────────────────────────────────────────────────────────────────
// § Exports
// ────────────────────────────────────────────────────────────────────

module.exports = {
  BorderStyleError: BorderStyleError,
  ConnectionError: ConnectionError,
  ParseError: ParseError
};
