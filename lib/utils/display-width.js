'use strict';
// @esm-group Utils

/**
 * lib/utils/display-width.js
 *
 * Canonical character-width utility for terminal cell calculations.
 *
 * Provides code-point-based width detection for combining characters,
 * double-wide CJK/emoji, and standard single-width characters. Used by
 * chrome.js for combining-char-safe painting (logo, footer) and by
 * consumers (e.g. TARS template validation) for display-width measurements
 * that agree with the renderer.
 *
 * Self-contained — no dependency on blessed/lib/unicode.js (which has a
 * circular require for tab handling). Uses the same combining table and
 * double-wide ranges so results are identical.
 */

// Combining character ranges — identical to blessed/lib/unicode.js combiningTable.
// Sorted by first element for consistency. Pre-expanded into a Set below for
// O(1) lookups during charWidth/isCombining calls.
var COMBINING = [
  [0x0300, 0x036F], [0x0483, 0x0486], [0x0488, 0x0489],
  [0x0591, 0x05BD], [0x05BF, 0x05BF], [0x05C1, 0x05C2],
  [0x05C4, 0x05C5], [0x05C7, 0x05C7], [0x0600, 0x0603],
  [0x0610, 0x0615], [0x064B, 0x065E], [0x0670, 0x0670],
  [0x06D6, 0x06E4], [0x06E7, 0x06E8], [0x06EA, 0x06ED],
  [0x070F, 0x070F], [0x0711, 0x0711], [0x0730, 0x074A],
  [0x07A6, 0x07B0], [0x07EB, 0x07F3], [0x0901, 0x0902],
  [0x093C, 0x093C], [0x0941, 0x0948], [0x094D, 0x094D],
  [0x0951, 0x0954], [0x0962, 0x0963], [0x0981, 0x0981],
  [0x09BC, 0x09BC], [0x09C1, 0x09C4], [0x09CD, 0x09CD],
  [0x09E2, 0x09E3], [0x0A01, 0x0A02], [0x0A3C, 0x0A3C],
  [0x0A41, 0x0A42], [0x0A47, 0x0A48], [0x0A4B, 0x0A4D],
  [0x0A70, 0x0A71], [0x0A81, 0x0A82], [0x0ABC, 0x0ABC],
  [0x0AC1, 0x0AC5], [0x0AC7, 0x0AC8], [0x0ACD, 0x0ACD],
  [0x0AE2, 0x0AE3], [0x0B01, 0x0B01], [0x0B3C, 0x0B3C],
  [0x0B3F, 0x0B3F], [0x0B41, 0x0B43], [0x0B4D, 0x0B4D],
  [0x0B56, 0x0B56], [0x0B82, 0x0B82], [0x0BC0, 0x0BC0],
  [0x0BCD, 0x0BCD], [0x0C3E, 0x0C40], [0x0C46, 0x0C48],
  [0x0C4A, 0x0C4D], [0x0C55, 0x0C56], [0x0CBC, 0x0CBC],
  [0x0CBF, 0x0CBF], [0x0CC6, 0x0CC6], [0x0CCC, 0x0CCD],
  [0x0CE2, 0x0CE3], [0x0D41, 0x0D43], [0x0D4D, 0x0D4D],
  [0x0DCA, 0x0DCA], [0x0DD2, 0x0DD4], [0x0DD6, 0x0DD6],
  [0x0E31, 0x0E31], [0x0E34, 0x0E3A], [0x0E47, 0x0E4E],
  [0x0EB1, 0x0EB1], [0x0EB4, 0x0EB9], [0x0EBB, 0x0EBC],
  [0x0EC8, 0x0ECD], [0x0F18, 0x0F19], [0x0F35, 0x0F35],
  [0x0F37, 0x0F37], [0x0F39, 0x0F39], [0x0F71, 0x0F7E],
  [0x0F80, 0x0F84], [0x0F86, 0x0F87], [0x0F90, 0x0F97],
  [0x0F99, 0x0FBC], [0x0FC6, 0x0FC6], [0x102D, 0x1030],
  [0x1032, 0x1032], [0x1036, 0x1037], [0x1039, 0x1039],
  [0x1058, 0x1059], [0x1160, 0x11FF], [0x135F, 0x135F],
  [0x1712, 0x1714], [0x1732, 0x1734], [0x1752, 0x1753],
  [0x1772, 0x1773], [0x17B4, 0x17B5], [0x17B7, 0x17BD],
  [0x17C6, 0x17C6], [0x17C9, 0x17D3], [0x17DD, 0x17DD],
  [0x180B, 0x180D], [0x18A9, 0x18A9], [0x1920, 0x1922],
  [0x1927, 0x1928], [0x1932, 0x1932], [0x1939, 0x193B],
  [0x1A17, 0x1A18], [0x1B00, 0x1B03], [0x1B34, 0x1B34],
  [0x1B36, 0x1B3A], [0x1B3C, 0x1B3C], [0x1B42, 0x1B42],
  [0x1B6B, 0x1B73], [0x1DC0, 0x1DCA], [0x1DFE, 0x1DFF],
  [0x200B, 0x200F], [0x202A, 0x202E], [0x2060, 0x2063],
  [0x206A, 0x206F], [0x20D0, 0x20EF], [0x302A, 0x302F],
  [0x3099, 0x309A], [0xA806, 0xA806], [0xA80B, 0xA80B],
  [0xA825, 0xA826], [0xFB1E, 0xFB1E], [0xFE00, 0xFE0F],
  [0xFE20, 0xFE23], [0xFEFF, 0xFEFF], [0xFFF9, 0xFFFB],
  [0x10A01, 0x10A03], [0x10A05, 0x10A06], [0x10A0C, 0x10A0F],
  [0x10A38, 0x10A3A], [0x10A3F, 0x10A3F], [0x1D167, 0x1D169],
  [0x1D173, 0x1D182], [0x1D185, 0x1D18B], [0x1D1AA, 0x1D1AD],
  [0x1D242, 0x1D244], [0xE0001, 0xE0001], [0xE0020, 0xE007F],
  [0xE0100, 0xE01EF],
];

// Pre-expand combining ranges into a flat Set for O(1) membership checks.
// The total number of code points is ~2500, well within memory budget.
var combiningSet = new Set();
for (var ri = 0; ri < COMBINING.length; ri++) {
  for (var cp = COMBINING[ri][0]; cp <= COMBINING[ri][1]; cp++) {
    combiningSet.add(cp);
  }
}

/**
 * Check whether a code point is a double-wide character (CJK, fullwidth, emoji).
 * Mirrors the double-wide ranges from blessed/lib/unicode.js charWidth.
 *
 * @param {number} cp - Unicode code point
 * @returns {boolean}
 */
function isDoubleWide(cp) {
  if (cp === 0x3000) return true;
  if (cp >= 0xFF01 && cp <= 0xFF60) return true;
  if (cp >= 0xFFE0 && cp <= 0xFFE6) return true;
  if (cp >= 0x1100 && cp <= 0x115F) return true;
  if (cp >= 0x2E80 && cp <= 0x303E && cp !== 0x303F) return true;
  if (cp >= 0x3041 && cp <= 0x33FF) return true;
  if (cp >= 0x3400 && cp <= 0x4DBF) return true;
  if (cp >= 0x4E00 && cp <= 0xA4C6) return true;
  if (cp >= 0xA960 && cp <= 0xA97C) return true;
  if (cp >= 0xAC00 && cp <= 0xD7FB) return true;
  if (cp >= 0xF900 && cp <= 0xFAFF) return true;
  if (cp >= 0xFE10 && cp <= 0xFE6B) return true;
  if (cp >= 0x1F200 && cp <= 0x1F251) return true;
  if (cp >= 0x1F300 && cp <= 0x1F9FF) return true;
  if (cp >= 0x1FA00 && cp <= 0x1FAFF) return true;
  if (cp >= 0x20000 && cp <= 0x3FFFD) return true;
  return false;
}

/**
 * Check whether a code point is a combining character (zero-width diacritical
 * mark that attaches to the previous cell). Covers U+0300–U+036F (Latin
 * combining diacriticals including U+0336 long stroke overlay used by the
 * TARS logo) and all other Unicode combining ranges.
 *
 * @param {number} cp - Unicode code point
 * @returns {boolean}
 */
exports.isCombining = function isCombining(cp) {
  return combiningSet.has(cp);
};

/**
 * Terminal cell width of a single Unicode code point.
 * Returns 0 for control characters and combining marks, 2 for double-wide
 * CJK/fullwidth/emoji, 1 for everything else.
 *
 * @param {number} cp - Unicode code point
 * @returns {number} 0, 1, or 2
 */
exports.charWidth = function charWidth(cp) {
  if (cp === 0) return 0;
  if (cp < 32 || (cp >= 0x7F && cp < 0xA0)) return 0;
  if (combiningSet.has(cp)) return 0;
  if (isDoubleWide(cp)) return 2;
  return 1;
};

/**
 * Terminal display width of a string (total cell columns consumed).
 * Handles surrogate pairs for code points above U+FFFF.
 *
 * @param {string} str - Input string
 * @returns {number} Total cell columns
 */
exports.displayWidth = function displayWidth(str) {
  var w = 0;
  for (var i = 0; i < str.length; i++) {
    var point = str.codePointAt(i);
    w += exports.charWidth(point);
    // Skip the low surrogate of a surrogate pair (code points above U+FFFF
    // are encoded as two UTF-16 code units in JavaScript strings).
    if (point > 0xFFFF) i++;
  }
  return w;
};

/**
 * Slice a string by terminal cell columns (not JavaScript char indices).
 * Returns the substring occupying cells [start, start + width).
 * Combining characters attached to a base character within the range are
 * included in the result.
 *
 * @param {string} str   - Input string
 * @param {number} start - Starting cell column (0-based)
 * @param {number} width - Number of cells to extract
 * @returns {string} Substring spanning the requested cell range
 */
exports.sliceCells = function sliceCells(str, start, width) {
  var col = 0;
  var beginIdx = -1;
  var endIdx = str.length;

  for (var i = 0; i < str.length; i++) {
    var point = str.codePointAt(i);
    var cw = exports.charWidth(point);

    // Mark the start position when we reach the target cell column
    if (beginIdx < 0 && col >= start) beginIdx = i;
    // Mark the end position when we've consumed enough cells
    if (beginIdx >= 0 && col >= start + width) { endIdx = i; break; }

    col += cw;
    if (point > 0xFFFF) i++;
  }

  if (beginIdx < 0) return '';
  return str.slice(beginIdx, endIdx);
};
