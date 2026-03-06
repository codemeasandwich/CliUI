'use strict';

/**
 * lib/widget/diagram/parser-chars.js
 *
 * Character classification tables and grid helper for the diagram parser.
 */

/** Standard box top-left corners. */
var TOP_LEFT_CORNERS = new Set(['\u250C', '\u256D']); // ┌ ╭

/** Standard box top-right corners. */
var TOP_RIGHT_CORNERS = new Set(['\u2510', '\u256E']); // ┐ ╮

/** Standard box bottom-left corners. */
var BOTTOM_LEFT_CORNERS = new Set(['\u2514', '\u2570']); // └ ╰

/** Standard box bottom-right corners. */
var BOTTOM_RIGHT_CORNERS = new Set(['\u2518', '\u256F']); // ┘ ╯

/** All horizontal border/connector characters. */
var HORIZONTAL_CHARS = new Set([
  '\u2500', // ─  light horizontal
  '\u2501', // ━  heavy horizontal
  '\u2550', // ═  double horizontal
  '\u254D', // ╍  dashed horizontal (current-work)
  '\u2504', // ┄  triple-dash horizontal
  '\u2508'  // ┈  quadruple-dash horizontal
]);

/** All vertical border/connector characters. */
var VERTICAL_CHARS = new Set([
  '\u2502', // │  light vertical
  '\u2503', // ┃  heavy vertical
  '\u2551', // ║  double vertical
  '\u2507', // ┇  dashed vertical (current-work)
  '\u2506', // ┆  triple-dash vertical
  '\u250A'  // ┊  quadruple-dash vertical
]);

/** Cross-resume stub (vertical line resuming below an arc crossing). */
var CROSS_RESUME_CHAR = '\u2577'; // ╷

/** Connector junction / tee characters. */
var JUNCTION_CHARS = new Set([
  '\u251C', // ├
  '\u2524', // ┤
  '\u252C', // ┬
  '\u2534', // ┴
  '\u253C', // ┼  (legacy cross)
  '\u23DC'  // ⏜  (arc-over crossing)
]);

/** Arrowhead characters → direction mapping. */
var ARROW_MAP = new Map([
  ['\u25B6', 'right'],   // ▶
  ['\u25C0', 'left'],    // ◀
  ['\u25BC', 'down'],    // ▼
  ['\u2193', 'down'],    // ↓
  ['\u25B2', 'up']       // ▲
]);

/** All arrowhead characters as a Set for quick membership tests. */
var ARROW_CHARS = new Set(ARROW_MAP.keys());

/** Current-work specific characters. */
var CURRENT_WORK_CHARS = new Set([
  '\u256D', '\u256E', '\u2570', '\u256F',
  '\u254D', '\u2507', '\u2562', '\u2564', '\u255F', '\u2567', '\u25CF'
]);

/** Gate characters — vertical borders (spec §6.4.1). */
var GATE_CHAR = '\u255F'; // ╟
var GATE_CHARS = new Set(['\u255F', '\u2562', '\u2564']); // ╟ + legacy ╢ ╤

/** Gate characters — horizontal borders (spec §6.4.1). */
var GATE_H_CHAR = '\u2567'; // ╧
var GATE_H_CHARS = new Set(['\u2567', '\u2562', '\u2564']); // ╧ + legacy ╢ ╤

/** Animated dot character. */
var DOT_CHAR = '\u25CF';  // ●

/** Check mark for completed boxes (spec §6.5). */
var CHECK_CHAR = '\u2714'; // ✔

/**
 * Characters that are part of connectors (union of lines, junctions,
 * arrows, corners used in connector paths).
 */
var CONNECTOR_PATH_CHARS = new Set([
  ...HORIZONTAL_CHARS,
  ...VERTICAL_CHARS,
  ...JUNCTION_CHARS,
  ...ARROW_CHARS,
  ...TOP_LEFT_CORNERS,
  ...TOP_RIGHT_CORNERS,
  ...BOTTOM_LEFT_CORNERS,
  ...BOTTOM_RIGHT_CORNERS,
  CROSS_RESUME_CHAR
]);

// ────────────────────────────────────────────────────────────────────
// § Grid helper — convert text to 2D character array
// ────────────────────────────────────────────────────────────────────

/**
 * Split ASCII text into a row-major 2D array of single characters.
 *
 * Each row is padded to `maxWidth` with spaces so that index-based
 * access never goes out of bounds within a row.
 *
 * @param {string} text - Raw ASCII chart text.
 * @returns {{ grid: string[][], width: number, height: number }}
 */
function textToGrid(text) {
  var rawLines = text.split('\n');

  /* Strip trailing carriage returns for cross-platform reliability. */
  for (var ri = 0; ri < rawLines.length; ri++) {
    if (rawLines[ri].length > 0 && rawLines[ri][rawLines[ri].length - 1] === '\r') {
      rawLines[ri] = rawLines[ri].slice(0, -1);
    }
  }

  /* Remove a single trailing empty line if present. */
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') {
    rawLines.pop();
  }

  var maxWidth = 0;
  for (var i = 0; i < rawLines.length; i++) {
    if (rawLines[i].length > maxWidth) maxWidth = rawLines[i].length;
  }

  var grid = [];
  for (var j = 0; j < rawLines.length; j++) {
    var row = [];
    for (var k = 0; k < maxWidth; k++) {
      row.push(k < rawLines[j].length ? rawLines[j][k] : ' ');
    }
    grid.push(row);
  }

  return { grid: grid, width: maxWidth, height: grid.length };
}

// ────────────────────────────────────────────────────────────────────
// § Exports
// ────────────────────────────────────────────────────────────────────

module.exports = {
  TOP_LEFT_CORNERS:      TOP_LEFT_CORNERS,
  TOP_RIGHT_CORNERS:     TOP_RIGHT_CORNERS,
  BOTTOM_LEFT_CORNERS:   BOTTOM_LEFT_CORNERS,
  BOTTOM_RIGHT_CORNERS:  BOTTOM_RIGHT_CORNERS,
  HORIZONTAL_CHARS:      HORIZONTAL_CHARS,
  VERTICAL_CHARS:        VERTICAL_CHARS,
  JUNCTION_CHARS:        JUNCTION_CHARS,
  ARROW_MAP:             ARROW_MAP,
  ARROW_CHARS:           ARROW_CHARS,
  CURRENT_WORK_CHARS:    CURRENT_WORK_CHARS,
  GATE_CHAR:             GATE_CHAR,
  GATE_CHARS:            GATE_CHARS,
  GATE_H_CHAR:           GATE_H_CHAR,
  GATE_H_CHARS:          GATE_H_CHARS,
  DOT_CHAR:              DOT_CHAR,
  CHECK_CHAR:            CHECK_CHAR,
  CONNECTOR_PATH_CHARS:  CONNECTOR_PATH_CHARS,
  textToGrid:            textToGrid
};
