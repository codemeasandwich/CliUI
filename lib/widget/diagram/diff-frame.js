'use strict';
// @esm-group Widgets

/**
 * lib/widget/diagram/diff-frame.js
 *
 * Frame representation for the minimal-change diff engine.
 * Stores a rendered diagram snapshot as a flat cell array for O(1) lookups.
 */

// ────────────────────────────────────────────────────────────────────
// § PaintOp type
// ────────────────────────────────────────────────────────────────────

/**
 * A single cell write operation.
 *
 * @typedef {Object} PaintOp
 * @property {number} x    - Column (0-based).
 * @property {number} y    - Row (0-based).
 * @property {string} ch   - Character to write.
 * @property {string} [fg] - Foreground colour name (optional).
 * @property {string} [bg] - Background colour name (optional).
 */

// ────────────────────────────────────────────────────────────────────
// § Frame representation
// ────────────────────────────────────────────────────────────────────

/**
 * An immutable snapshot of a rendered diagram frame.
 *
 * Stores the ASCII text as a flat string and the width, allowing
 * O(1) cell lookups.  Colour attribution is stored in a parallel
 * array.
 *
 * @class Frame
 */
class Frame {
  /**
   * @param {string}   text   - Rendered ASCII text (newline-separated rows).
   * @param {number}   width  - Width in columns.
   * @param {number}   height - Height in rows.
   * @param {string[]} [colors] - Optional parallel colour array, one
   *   entry per cell in row-major order.  Each entry is a colour name
   *   or empty string.
   */
  constructor(text, width, height, colors) {
    /**
     * Grid cells stored as a flat array of single characters.
     *
     * Index: y * width + x.
     * @type {string[]}
     */
    this.cells = Frame.textToCells(text, width, height);

    /** @type {number} */
    this.width = width;

    /** @type {number} */
    this.height = height;

    /**
     * Optional per-cell colour names (row-major, same indexing as cells).
     * @type {string[]}
     */
    this.colors = colors || [];
  }

  /**
   * Read a single cell.
   *
   * @param {number} x
   * @param {number} y
   * @returns {string} Single character, or space if out of bounds.
   */
  get(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return ' ';
    return this.cells[y * this.width + x];
  }

  /**
   * Read the colour of a single cell.
   *
   * @param {number} x
   * @param {number} y
   * @returns {string} Colour name or empty string.
   */
  getColor(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return '';
    return this.colors[y * this.width + x] || '';
  }

  /**
   * Convert multi-line text to a flat cell array, padding short lines.
   *
   * @param {string} text
   * @param {number} width
   * @param {number} height
   * @returns {string[]}
   * @static
   */
  static textToCells(text, width, height) {
    var lines = text.split('\n');
    var cells = new Array(width * height);

    for (var y = 0; y < height; y++) {
      var line = lines[y] || '';
      for (var x = 0; x < width; x++) {
        cells[y * width + x] = x < line.length ? line[x] : ' ';
      }
    }
    return cells;
  }
}

// ────────────────────────────────────────────────────────────────────
// § Exports
// ────────────────────────────────────────────────────────────────────

module.exports = {
  Frame: Frame
};
