'use strict';
// @esm-group Widgets

/**
 * lib/widget/diagram/diagram-diff.js
 *
 * Minimal-change write-back for the Diegetic diagram editor.
 *
 * Computes the character-level delta between the previous frame and
 * the current frame, returning a list of PaintOp entries that the
 * widget can apply to the blessed screen buffer.
 *
 * Re-exports Frame from diff-frame.js for backwards compatibility.
 */

var Frame = require('./diff-frame').Frame;

// ────────────────────────────────────────────────────────────────────
// § Diff computation
// ────────────────────────────────────────────────────────────────────

/**
 * Compute the character-level delta between two frames.
 *
 * Both frames must have the same width and height.
 *
 * @param {Frame} prev - Previous frame.
 * @param {Frame} curr - Current frame.
 * @returns {import('./diff-frame').PaintOp[]}
 */
function diff(prev, curr) {
  var ops = [];
  var w = curr.width;
  var h = curr.height;

  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var idx = y * w + x;
      var prevCh = prev.cells[idx] || ' ';
      var currCh = curr.cells[idx] || ' ';
      var prevColor = prev.colors[idx] || '';
      var currColor = curr.colors[idx] || '';

      if (prevCh !== currCh || prevColor !== currColor) {
        var op = { x: x, y: y, ch: currCh };
        if (currColor) op.fg = currColor;
        ops.push(op);
      }
    }
  }

  return ops;
}

// ────────────────────────────────────────────────────────────────────
// § Region diff
// ────────────────────────────────────────────────────────────────────

/**
 * Compute the diff restricted to a rectangular region.
 *
 * @param {Frame}  prev
 * @param {Frame}  curr
 * @param {number} x1 - Left column (inclusive).
 * @param {number} y1 - Top row (inclusive).
 * @param {number} x2 - Right column (inclusive).
 * @param {number} y2 - Bottom row (inclusive).
 * @returns {import('./diff-frame').PaintOp[]}
 */
function diffRegion(prev, curr, x1, y1, x2, y2) {
  var ops = [];
  var minX = Math.max(0, Math.min(x1, x2));
  var maxX = Math.min(curr.width - 1, Math.max(x1, x2));
  var minY = Math.max(0, Math.min(y1, y2));
  var maxY = Math.min(curr.height - 1, Math.max(y1, y2));

  for (var y = minY; y <= maxY; y++) {
    for (var x = minX; x <= maxX; x++) {
      var idx = y * curr.width + x;
      var prevCh = prev.cells[idx] || ' ';
      var currCh = curr.cells[idx] || ' ';
      var prevColor = prev.colors[idx] || '';
      var currColor = curr.colors[idx] || '';

      if (prevCh !== currCh || prevColor !== currColor) {
        var op = { x: x, y: y, ch: currCh };
        if (currColor) op.fg = currColor;
        ops.push(op);
      }
    }
  }

  return ops;
}

// ────────────────────────────────────────────────────────────────────
// § Dirty rect computation
// ────────────────────────────────────────────────────────────────────

/**
 * Compute the bounding box of all changed cells between two frames.
 *
 * Returns null if the frames are identical.
 *
 * @param {Frame} prev
 * @param {Frame} curr
 * @returns {{ x1: number, y1: number, x2: number, y2: number }|null}
 */
function dirtyRect(prev, curr) {
  var minX = Infinity;
  var minY = Infinity;
  var maxX = -1;
  var maxY = -1;

  var w = curr.width;
  var h = curr.height;

  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var idx = y * w + x;
      if ((prev.cells[idx] || ' ') !== (curr.cells[idx] || ' ') ||
          (prev.colors[idx] || '') !== (curr.colors[idx] || '')) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;
  return { x1: minX, y1: minY, x2: maxX, y2: maxY };
}

// ────────────────────────────────────────────────────────────────────
// § Box dirty rect helper
// ────────────────────────────────────────────────────────────────────

/**
 * Compute the union bounding rect of a box at its old and new
 * positions (with a 1-cell margin for connectors touching the border).
 *
 * @param {{ x: number, y: number, width: number, height: number }} oldPos
 * @param {{ x: number, y: number, width: number, height: number }} newPos
 * @returns {{ x1: number, y1: number, x2: number, y2: number }}
 */
function boxDirtyRect(oldPos, newPos) {
  var margin = 1;
  return {
    x1: Math.min(oldPos.x, newPos.x) - margin,
    y1: Math.min(oldPos.y, newPos.y) - margin,
    x2: Math.max(oldPos.x + oldPos.width,  newPos.x + newPos.width)  + margin,
    y2: Math.max(oldPos.y + oldPos.height, newPos.y + newPos.height) + margin
  };
}

// ────────────────────────────────────────────────────────────────────
// § Exports
// ────────────────────────────────────────────────────────────────────

module.exports = {
  Frame:         Frame,
  diff:          diff,
  diffRegion:    diffRegion,
  dirtyRect:     dirtyRect,
  boxDirtyRect:  boxDirtyRect
};
