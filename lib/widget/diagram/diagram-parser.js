'use strict';
// @esm-group Widgets

/**
 * lib/widget/diagram/diagram-parser.js
 *
 * Barrel module — re-exports the diagram parser from its split sub-modules.
 *
 * Sub-modules:
 *   parser-chars.js        — Character classification tables + textToGrid
 *   parser-boxes.js        — detectBoxes (Pass 1)
 *   parser-conn-helpers.js — buildSegments, determineSideAndOffset, helpers
 *   parser-connectors.js   — traceConnectors (Pass 2)
 *   parser-labels.js       — detectLabels (Pass 3) + parse orchestrator
 */

var chars      = require('./parser-chars');
var boxes      = require('./parser-boxes');
var connHelp   = require('./parser-conn-helpers');
var connectors = require('./parser-connectors');
var labels     = require('./parser-labels');

module.exports = {
  parse:                  labels.parse,
  textToGrid:             chars.textToGrid,
  detectBoxes:            boxes.detectBoxes,
  traceConnectors:        connectors.traceConnectors,
  detectLabels:           labels.detectLabels,
  buildSegments:          connHelp.buildSegments,
  determineSideAndOffset: connHelp.determineSideAndOffset,

  /* Character classification — exported for tests and the renderer. */
  TOP_LEFT_CORNERS:       chars.TOP_LEFT_CORNERS,
  TOP_RIGHT_CORNERS:      chars.TOP_RIGHT_CORNERS,
  BOTTOM_LEFT_CORNERS:    chars.BOTTOM_LEFT_CORNERS,
  BOTTOM_RIGHT_CORNERS:   chars.BOTTOM_RIGHT_CORNERS,
  HORIZONTAL_CHARS:       chars.HORIZONTAL_CHARS,
  VERTICAL_CHARS:         chars.VERTICAL_CHARS,
  JUNCTION_CHARS:         chars.JUNCTION_CHARS,
  ARROW_MAP:              chars.ARROW_MAP,
  ARROW_CHARS:            chars.ARROW_CHARS,
  GATE_CHAR:              chars.GATE_CHAR,
  GATE_CHARS:             chars.GATE_CHARS,
  GATE_H_CHAR:            chars.GATE_H_CHAR,
  GATE_H_CHARS:           chars.GATE_H_CHARS,
  DOT_CHAR:               chars.DOT_CHAR,
  CHECK_CHAR:             chars.CHECK_CHAR
};
