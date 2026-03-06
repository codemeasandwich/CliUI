'use strict';

/**
 * lib/widget/diagram/grid-core.js
 *
 * Core OccupancyGrid class — constructor and read/write primitives.
 *
 * The occupancy grid is a 2D array whose dimensions match the diagram
 * canvas.  Each cell records *what* occupies that character position and
 * *who* owns it.  This serves three critical purposes:
 *
 *   1. **Router obstacle map** — the A* pathfinder queries `isBlocked()`
 *      to avoid routing through box interiors and borders, except at
 *      explicit port cells.
 *
 *   2. **Hit-test backing store** — the hit-test module calls `query()`
 *      to translate a screen coordinate into a semantic target.
 *
 *   3. **Collision detection** — the renderer checks occupancy before
 *      placing labels, to avoid overwriting existing content.
 */

var CELL_TYPE = require('./grid-constants').CELL_TYPE;

/**
 * 2D character-cell occupancy map for a diagram canvas.
 * @class OccupancyGrid
 */
class OccupancyGrid {

  /**
   * @param {number} width  - Grid width (columns).
   * @param {number} height - Grid height (rows).
   */
  constructor(width, height) {
    /** @type {number} */
    this.width = width;
    /** @type {number} */
    this.height = height;
    /**
     * Flat cell array — index for (x, y) = y * width + x.
     * Each cell: { type: string, ownerId: number|null, char: string }
     * @type {Array<{type: string, ownerId: number|null, char: string}>}
     * @private
     */
    this._cells = [];
    this._initCells();
  }

  /**
   * Fill the entire grid with empty cells.
   * Called by the constructor and by `clear()`.
   * @private
   */
  _initCells() {
    var total = this.width * this.height;
    this._cells = new Array(total);
    for (var i = 0; i < total; i++) {
      this._cells[i] = { type: CELL_TYPE.EMPTY, ownerId: null, char: ' ' };
    }
  }

  /**
   * Check whether (x, y) is inside the grid bounds.
   * @param {number} x - Column.
   * @param {number} y - Row.
   * @returns {boolean}
   */
  inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /**
   * Compute the flat-array index for (x, y).
   * @param {number} x @param {number} y @returns {number}
   * @private
   */
  _idx(x, y) {
    return y * this.width + x;
  }

  /**
   * Query the semantic content of a cell.
   * Returns a default empty-cell object if out of bounds (rather than
   * throwing) so that boundary-adjacent code doesn't need guards.
   * @param {number} x - Column.
   * @param {number} y - Row.
   * @returns {{ type: string, ownerId: number|null, char: string }}
   */
  query(x, y) {
    if (!this.inBounds(x, y)) {
      return { type: CELL_TYPE.EMPTY, ownerId: null, char: ' ' };
    }
    return this._cells[this._idx(x, y)];
  }

  /**
   * Test whether the router may *not* pass through this cell.
   * Blocked: border, content, arrow.  Not blocked: connector, junction,
   * empty, label, port, gate.
   * @param {number} x @param {number} y @returns {boolean}
   */
  isBlocked(x, y) {
    if (!this.inBounds(x, y)) return true;
    var cell = this._cells[this._idx(x, y)];
    switch (cell.type) {
      case CELL_TYPE.BORDER:
      case CELL_TYPE.CONTENT:
      case CELL_TYPE.ARROW:
        return true;
      default:
        return false;
    }
  }

  /**
   * Test whether a cell is completely empty.
   * @param {number} x @param {number} y @returns {boolean}
   */
  isEmpty(x, y) {
    if (!this.inBounds(x, y)) return false;
    return this._cells[this._idx(x, y)].type === CELL_TYPE.EMPTY;
  }

  /**
   * Set a single cell's occupancy.
   * @param {number}      x       - Column.
   * @param {number}      y       - Row.
   * @param {string}      type    - One of CELL_TYPE values.
   * @param {number|null} ownerId - Entity ID that owns this cell.
   * @param {string}      ch      - The canonical character to render.
   */
  set(x, y, type, ownerId, ch) {
    if (!this.inBounds(x, y)) return;
    var cell = this._cells[this._idx(x, y)];
    cell.type    = type;
    cell.ownerId = ownerId;
    cell.char    = ch;
  }

  /**
   * Reset all cells to empty.
   * Reuses existing cell objects and just overwrites their fields.
   */
  clear() {
    var len = this._cells.length;
    for (var i = 0; i < len; i++) {
      var c = this._cells[i];
      c.type    = CELL_TYPE.EMPTY;
      c.ownerId = null;
      c.char    = ' ';
    }
  }

  /**
   * Resize the grid, discarding all cell data.
   * @param {number} width  - New column count.
   * @param {number} height - New row count.
   */
  resize(width, height) {
    this.width  = width;
    this.height = height;
    this._initCells();
  }
}

module.exports = { OccupancyGrid: OccupancyGrid };
