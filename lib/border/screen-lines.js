'use strict';

/**
 * lib/border/screen-lines.js
 *
 * Shared helpers for writing characters to blessed's screen.lines buffer.
 * Used by the chrome frame renderer (lib/layout/chrome.js) and available
 * to any module that needs direct screen buffer manipulation.
 *
 * blessed's screen buffer is a 2D array: screen.lines[y][x] = [attr, ch]
 *   attr: 32-bit integer — packed color/style bitmask (fg, bg, bold, etc.)
 *   ch:   string — character(s) to display (usually 1, may include combining)
 *
 * Each row has a .dirty flag — set to true to tell blessed to repaint that
 * line on the next draw() pass. Unchanged lines are skipped for performance.
 */

/**
 * Write a single character into screen.lines at (y, x) with the given attr.
 * Marks the line as dirty so blessed repaints it on the next draw() cycle.
 *
 * Bounds-checked: silently no-ops if y or x is outside the buffer. This
 * prevents crashes when the terminal is resized mid-render or when layout
 * data references positions beyond the current screen dimensions.
 *
 * @param {Array} lines - screen.lines array (2D: lines[y][x] = [attr, ch])
 * @param {number} y    - Row index (0-based)
 * @param {number} x    - Column index (0-based)
 * @param {number} attr - Cell attribute (packed color/style bitmask)
 * @param {string} ch   - Character to write
 */
exports.writeCell = function writeCell(lines, y, x, attr, ch) {
  if (!lines[y] || x < 0 || x >= (lines[y].length || 0)) return;
  lines[y][x] = [attr, ch];
  lines[y].dirty = true;
};

/**
 * Get the attribute (color/style bitmask) from a cell, defaulting to 0.
 *
 * Used to extract the current styling from an existing cell so new characters
 * can be painted with consistent coloring (e.g. matching the screen's default
 * fg/bg without hardcoding color values).
 *
 * @param {Array} lines - screen.lines array
 * @param {number} y    - Row index
 * @param {number} x    - Column index
 * @returns {number} Cell attribute bitmask, or 0 if cell doesn't exist
 */
exports.cellAttr = function cellAttr(lines, y, x) {
  return lines[y] && lines[y][x] ? lines[y][x][0] : 0;
};
