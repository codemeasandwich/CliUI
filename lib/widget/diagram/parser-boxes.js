'use strict';

/**
 * lib/widget/diagram/parser-boxes.js
 *
 * Pass 1 — Box detection for the diagram parser.
 */

var chars = require('./parser-chars');
var TOP_LEFT_CORNERS     = chars.TOP_LEFT_CORNERS;
var TOP_RIGHT_CORNERS    = chars.TOP_RIGHT_CORNERS;
var BOTTOM_LEFT_CORNERS  = chars.BOTTOM_LEFT_CORNERS;
var BOTTOM_RIGHT_CORNERS = chars.BOTTOM_RIGHT_CORNERS;
var HORIZONTAL_CHARS     = chars.HORIZONTAL_CHARS;
var VERTICAL_CHARS       = chars.VERTICAL_CHARS;
var DOT_CHAR             = chars.DOT_CHAR;
var GATE_CHAR            = chars.GATE_CHAR;
var GATE_CHARS           = chars.GATE_CHARS;
var GATE_H_CHAR          = chars.GATE_H_CHAR;
var GATE_H_CHARS         = chars.GATE_H_CHARS;
var CHECK_CHAR           = chars.CHECK_CHAR;
var CORNER_TO_STYLE      = chars.CORNER_TO_STYLE;

/**
 * Detect all rectangular boxes in the character grid.
 *
 * @param {string[][]} grid   - 2D character array.
 * @param {number}     width  - Grid width.
 * @param {number}     height - Grid height.
 * @param {Set<string>} visited - Set of "x,y" keys already claimed.
 * @param {import('./diagram-model').DiagramModel} model - Model to populate.
 * @returns {Array<{box: object, cells: Set<string>}>}
 */
function detectBoxes(grid, width, height, visited, model) {
  var results = [];

  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      var ch = grid[y][x];

      /* Only proceed for top-left corner candidates. */
      if (!TOP_LEFT_CORNERS.has(ch)) continue;
      if (visited.has(x + ',' + y)) continue;

      /*
       * Determine the corner family from the top-left character.
       * cornerFamily groups corners that must match (e.g. heavy TL must
       * pair with heavy TR/BL/BR). Each family maps to a set of valid
       * TR/BL/BR partners.
       */
      var cornerFamily = identifyCornerFamily(ch);

      /* Trace top border rightward to find top-right corner. */
      var trX = -1;
      for (var tx = x + 1; tx < width; tx++) {
        var tc = grid[y][tx];
        if (TOP_RIGHT_CORNERS.has(tc)) {
          if (matchesCornerFamily(tc, cornerFamily, 'tr')) {
            trX = tx;
          }
          break;
        }
        if (!HORIZONTAL_CHARS.has(tc) && tc !== DOT_CHAR &&
            !GATE_H_CHARS.has(tc) &&
            tc !== '\u252C' /* ┬ */ && tc !== '\u2534' /* ┴ */ &&
            tc !== '\u253C' /* ┼ */ && tc !== '\u23DC' /* ⏜ */) {
          break;
        }
      }

      if (trX === -1) continue;

      var boxW = trX - x + 1;
      if (boxW < 3) continue;

      /* Trace left side downward to find bottom-left corner. */
      var blY = -1;
      for (var ty = y + 1; ty < height; ty++) {
        var lc = grid[ty][x];
        if (BOTTOM_LEFT_CORNERS.has(lc)) {
          if (matchesCornerFamily(lc, cornerFamily, 'bl')) {
            blY = ty;
          }
          break;
        }
        if (!VERTICAL_CHARS.has(lc) && lc !== DOT_CHAR &&
            !GATE_CHARS.has(lc) &&
            lc !== '\u251C' /* ├ */ && lc !== '\u2524' /* ┤ */ &&
            lc !== '\u253C' /* ┼ */ && lc !== '\u23DC' /* ⏜ */) {
          break;
        }
      }

      if (blY === -1) continue;

      var boxH = blY - y + 1;
      if (boxH < 3) continue;

      /* Verify bottom-right corner matches the same family. */
      var brCh = grid[blY][trX];
      if (!BOTTOM_RIGHT_CORNERS.has(brCh)) continue;
      if (!matchesCornerFamily(brCh, cornerFamily, 'br')) continue;

      /* Verify right side. */
      var rightOk = true;
      for (var ty = y + 1; ty < blY; ty++) {
        var rc = grid[ty][trX];
        if (!VERTICAL_CHARS.has(rc) && rc !== DOT_CHAR &&
            !GATE_CHARS.has(rc) &&
            rc !== '\u251C' /* ├ */ && rc !== '\u2524' /* ┤ */ &&
            rc !== '\u253C' /* ┼ */ && rc !== '\u23DC' /* ⏜ */) {
          rightOk = false;
          break;
        }
      }
      if (!rightOk) continue;

      /* Verify bottom border. */
      var bottomOk = true;
      for (var tx = x + 1; tx < trX; tx++) {
        var bc = grid[blY][tx];
        if (!HORIZONTAL_CHARS.has(bc) && bc !== DOT_CHAR &&
            !GATE_H_CHARS.has(bc) &&
            bc !== '\u251C' /* ├ */ && bc !== '\u2524' /* ┤ */ &&
            bc !== '\u252C' /* ┬ */ && bc !== '\u2534' /* ┴ */ &&
            bc !== '\u253C' /* ┼ */ && bc !== '\u23DC' /* ⏜ */) {
          bottomOk = false;
          break;
        }
      }
      if (!bottomOk) continue;

      /* Check for overlap with already-detected boxes. */
      var overlaps = false;
      for (var ry = y; ry <= blY && !overlaps; ry++) {
        for (var rx = x; rx <= trX && !overlaps; rx++) {
          if (visited.has(rx + ',' + ry)) overlaps = true;
        }
      }
      if (overlaps) continue;

      /* ── Extract interior text ──────────────────────────────── */
      var textLines = [];
      for (var ry = y + 1; ry < blY; ry++) {
        var line = '';
        for (var rx = x + 1; rx < trX; rx++) {
          line += grid[ry][rx];
        }
        textLines.push(line);
      }
      var bodyText = textLines.map(function(l) { return l.trimEnd(); }).join('\n');

      /* Detect checked state: leading ✔ in the first line. */
      var checked = false;
      var trimmed = bodyText.trimStart();
      if (trimmed.startsWith(CHECK_CHAR)) {
        checked = true;
        bodyText = trimmed.substring(1).replace(/^ /, '');
      }

      /*
       * Classify border style from the corner character and the first
       * horizontal border character (to disambiguate dashed variants).
       */
      var detectedStyle = classifyBorderStyle(ch, grid[y][x + 1]);
      var isCurrentWork = (detectedStyle === 'currentWork');

      /* Create the box in the model with detected border style. */
      var box = model.addBox(x, y, boxW, boxH, bodyText, {
        checked:     checked,
        currentWork: isCurrentWork,
        borderStyle: isCurrentWork ? null : (detectedStyle !== 'light' ? detectedStyle : null)
      });

      /* Mark all cells as visited so they aren't re-used. */
      var cells = new Set();
      for (var ry = y; ry <= blY; ry++) {
        for (var rx = x; rx <= trX; rx++) {
          var key = rx + ',' + ry;
          visited.add(key);
          cells.add(key);
        }
      }

      results.push({ box: box, cells: cells });
    }
  }

  return results;
}

// ────────────────────────────────────────────────────────────────────
// § Corner family classification
// ────────────────────────────────────────────────────────────────────

/**
 * Corner family identifiers — groups of corner chars that must all
 * belong to the same border style for a valid box.
 *
 * 'light_rounded' covers both ┌ (light) and ╭ (rounded/currentWork)
 * because they share the same partner sets and are disambiguated later
 * by the horizontal character.
 */
var CORNER_FAMILIES = {
  light:   { tl: '\u250C', tr: '\u2510', bl: '\u2514', br: '\u2518' },
  rounded: { tl: '\u256D', tr: '\u256E', bl: '\u2570', br: '\u256F' },
  heavy:   { tl: '\u250F', tr: '\u2513', bl: '\u2517', br: '\u251B' },
  double:  { tl: '\u2554', tr: '\u2557', bl: '\u255A', br: '\u255D' }
};

/**
 * Identify which corner family a top-left character belongs to.
 *
 * @param {string} tlChar - Top-left corner character.
 * @returns {string} Family key ('light', 'rounded', 'heavy', 'double').
 */
function identifyCornerFamily(tlChar) {
  for (var fam in CORNER_FAMILIES) {
    if (CORNER_FAMILIES[fam].tl === tlChar) return fam;
  }
  return 'light';
}

/**
 * Check whether a corner character matches the expected family + position.
 *
 * @param {string} ch       - Corner character to test.
 * @param {string} family   - Family key from identifyCornerFamily().
 * @param {string} position - 'tr', 'bl', or 'br'.
 * @returns {boolean}
 */
function matchesCornerFamily(ch, family, position) {
  var fam = CORNER_FAMILIES[family];
  return fam ? fam[position] === ch : false;
}

/**
 * Classify the full border style from the top-left corner and the
 * first horizontal border character (the cell at [y][x+1]).
 *
 * Disambiguation rules:
 *   ┌ + ╌  → 'dashed'       ┌ + ─  → 'light'
 *   ╭ + ╍  → 'currentWork'  ╭ + ─  → 'rounded'
 *   ┏ + ╍  → 'dashedHeavy'  ┏ + ━  → 'heavy'
 *   ╔ + ═  → 'double'       (no variant needed)
 *
 * @param {string} tlChar    - Top-left corner character.
 * @param {string} horizChar - First horizontal border character.
 * @returns {string} Border style name.
 */
function classifyBorderStyle(tlChar, horizChar) {
  switch (tlChar) {
    case '\u250C': // ┌ — light family
      return horizChar === '\u254C' ? 'dashed' : 'light';     // ╌ → dashed
    case '\u256D': // ╭ — rounded family
      return horizChar === '\u254D' ? 'currentWork' : 'rounded'; // ╍ → currentWork
    case '\u250F': // ┏ — heavy family
      return horizChar === '\u254D' ? 'dashedHeavy' : 'heavy';  // ╍ → dashedHeavy
    case '\u2554': // ╔ — double
      return 'double';
    default:
      return 'light';
  }
}

module.exports = { detectBoxes: detectBoxes };
