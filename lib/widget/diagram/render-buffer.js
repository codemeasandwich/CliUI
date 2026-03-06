'use strict';

/**
 * lib/widget/diagram/render-buffer.js
 *
 * 2D character buffer used by the diagram renderer.
 */

/**
 * A 2D character buffer representing the rendered diagram.
 *
 * Internally stored as an array of row-arrays for O(1) cell access.
 * Each cell is a single character string.
 *
 * @class CharBuffer
 */
class CharBuffer {
  /**
   * @param {number} width    - Columns.
   * @param {number} height   - Rows.
   * @param {number} [offsetX] - Viewport X offset for panning.
   *   When set, all put/get coordinates are shifted by -offsetX so
   *   model-space coordinates map transparently into the viewport.
   * @param {number} [offsetY] - Viewport Y offset for panning.
   */
  constructor(width, height, offsetX, offsetY) {
    /** @type {number} */
    this.width = width;

    /** @type {number} */
    this.height = height;

    /** @type {number} Model X coordinate of the left viewport column. */
    this.offsetX = offsetX || 0;

    /** @type {number} Model Y coordinate of the top viewport row. */
    this.offsetY = offsetY || 0;

    /**
     * Row-major storage: rows[y][x] = character.
     * @type {string[][]}
     */
    this.rows = [];
    for (var y = 0; y < height; y++) {
      var row = new Array(width);
      for (var x = 0; x < width; x++) {
        row[x] = ' ';
      }
      this.rows.push(row);
    }
  }

  /**
   * Write a character at (x, y) in model coordinates.
   *
   * The offset is subtracted to convert model coords to buffer coords.
   * Silently ignored if the resulting position is out of bounds.
   *
   * @param {number} x  - Column (model space).
   * @param {number} y  - Row (model space).
   * @param {string} ch - Single character.
   */
  put(x, y, ch) {
    x -= this.offsetX;
    y -= this.offsetY;
    if (y >= 0 && y < this.height && x >= 0 && x < this.width) {
      this.rows[y][x] = ch;
    }
  }

  /**
   * Read a character at (x, y) in model coordinates.
   *
   * @param {number} x - Column (model space).
   * @param {number} y - Row (model space).
   * @returns {string} The character, or ' ' if out of bounds.
   */
  get(x, y) {
    x -= this.offsetX;
    y -= this.offsetY;
    if (y >= 0 && y < this.height && x >= 0 && x < this.width) {
      return this.rows[y][x];
    }
    return ' ';
  }

  /**
   * Convert the buffer to a canonical text string.
   *
   * Each row is right-trimmed to remove trailing spaces (produces
   * cleaner output for version control), then rows are joined with
   * newline characters.
   *
   * @returns {string} The complete ASCII diagram.
   */
  toString() {
    return this.rows
      .map(function (row) { return row.join('').trimEnd(); })
      .join('\n');
  }
}

module.exports = { CharBuffer: CharBuffer };
