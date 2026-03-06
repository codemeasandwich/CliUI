'use strict';
// @esm-group Widgets

/**
 * lib/widget/sequence/index.js
 *
 * Barrel export for the Sequence diagram widget module.
 *
 * Side-effect requires load the API and render patches onto
 * Sequence.prototype before the constructor is exported.
 */

/* Load prototype patches (order matters: api before render). */
require('./seq-widget-api');
require('./seq-widget-render');

var Sequence          = require('./seq-widget-core').Sequence;
var SequenceModel     = require('./seq-model').SequenceModel;
var render            = require('./seq-renderer').render;
var buildSequenceFromData = require('./seq-data-builder').buildSequenceFromData;
var layout            = require('./seq-layout').layout;
var constants         = require('./seq-constants');
var animation         = require('./seq-animation');
var lifeline          = require('./seq-render-lifeline');
var message           = require('./seq-render-message');
var section           = require('./seq-render-section');

module.exports = {
  /* Widget constructor (primary export). */
  Sequence: Sequence,

  /* Model. */
  SequenceModel: SequenceModel,

  /* Renderer. */
  render: render,

  /* Data builder. */
  buildSequenceFromData: buildSequenceFromData,

  /* Layout. */
  layout: layout,

  /* Animation. */
  overlayMessageAnimations: animation.overlayMessageAnimations,
  buildMessageCells:        animation.buildMessageCells,

  /* Constants. */
  MSG_STYLE:     constants.MSG_STYLE,
  ARROW_TYPE:    constants.ARROW_TYPE,
  NOTE_POSITION: constants.NOTE_POSITION,

  /* Render constants (for fixture-based assertions). */
  LIFELINE_CHAR: lifeline.LIFELINE_CHAR,
  ARROW_RIGHT:   message.ARROW_RIGHT,
  ARROW_LEFT:    message.ARROW_LEFT,
  SHAFT:         message.SHAFT,
  DASH:          section.DASH
};
