'use strict';
// @esm-group Widgets

/**
 * lib/widget/diagram/router-min-heap.js
 *
 * Cost constants and binary min-heap for A* open set.
 */

// ────────────────────────────────────────────────────────────────────
// § Constants — cost weights
// ────────────────────────────────────────────────────────────────────

/**
 * Movement cost weights.
 *
 * These are tuning knobs that control the aesthetic quality of routed
 * paths.  Higher bend cost produces straighter paths; higher adjacency
 * cost keeps connectors further from boxes; higher crossing cost
 * discourages overlap.
 *
 * @readonly
 */
var COST = Object.freeze({
  /** Base cost of moving one cell in the same direction. */
  STRAIGHT:  1,
  /** Additional cost when changing direction (bend). */
  BEND:      3,
  /** Additional cost for a cell adjacent to a box border. */
  ADJACENT:  2,
  /** Additional cost for crossing an existing connector cell. */
  CROSSING:  5
});

/**
 * The four cardinal directions as (dx, dy) vectors.
 *
 * Order: right, down, left, up — matches standard enum ordering.
 *
 * @type {ReadonlyArray<{dx: number, dy: number, name: string}>}
 */
var DIRECTIONS = Object.freeze([
  { dx:  1, dy:  0, name: 'right' },
  { dx:  0, dy:  1, name: 'down'  },
  { dx: -1, dy:  0, name: 'left'  },
  { dx:  0, dy: -1, name: 'up'    }
]);

// ────────────────────────────────────────────────────────────────────
// § Priority queue — binary min-heap
// ────────────────────────────────────────────────────────────────────

/**
 * Minimal binary min-heap for A* open set.
 *
 * Each item has an `f` property (total estimated cost).  Lower `f`
 * values are dequeued first.
 *
 * Why a custom heap instead of a sorted array:
 *   Sorted arrays have O(n) insertion.  The heap gives O(log n)
 *   insert and O(log n) extract-min, which matters for large grids.
 *
 * @class MinHeap
 * @private
 */
class MinHeap {
  constructor() {
    /** @type {Array<{f: number, [key: string]: any}>} */
    this._data = [];
  }

  /** @returns {number} Number of items in the heap. */
  get size() { return this._data.length; }

  /**
   * Insert an item.
   * @param {{f: number}} item
   */
  push(item) {
    this._data.push(item);
    this._bubbleUp(this._data.length - 1);
  }

  /**
   * Extract the item with the smallest `f` value.
   * @returns {{f: number}|undefined}
   */
  pop() {
    var data = this._data;
    if (data.length === 0) return undefined;
    var top = data[0];
    var last = data.pop();
    if (data.length > 0) {
      data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  /**
   * Restore heap property upward from index `i`.
   * @param {number} i
   * @private
   */
  _bubbleUp(i) {
    var data = this._data;
    while (i > 0) {
      var parent = (i - 1) >> 1;
      if (data[i].f >= data[parent].f) break;
      var tmp = data[i]; data[i] = data[parent]; data[parent] = tmp;
      i = parent;
    }
  }

  /**
   * Restore heap property downward from index `i`.
   * @param {number} i
   * @private
   */
  _sinkDown(i) {
    var data = this._data;
    var len  = data.length;
    while (true) {
      var smallest = i;
      var left  = 2 * i + 1;
      var right = 2 * i + 2;
      if (left  < len && data[left].f  < data[smallest].f) smallest = left;
      if (right < len && data[right].f < data[smallest].f) smallest = right;
      if (smallest === i) break;
      var tmp = data[i]; data[i] = data[smallest]; data[smallest] = tmp;
      i = smallest;
    }
  }
}

// ────────────────────────────────────────────────────────────────────
// § Exports
// ────────────────────────────────────────────────────────────────────

module.exports = {
  COST:       COST,
  DIRECTIONS: DIRECTIONS,
  MinHeap:    MinHeap
};
