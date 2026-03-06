'use strict';

/**
 * lib/widget/diagram/render-animation.js
 *
 * Current-work animation overlay (perimeter path + ● dots).
 */

var CHARSETS   = require('../../border/charsets').CHARSETS;
var CELL_TYPE  = require('./occupancy-grid').CELL_TYPE;

/**
 * Compute the perimeter path of a current-work box border.
 *
 * Returns an ordered array of { x, y } positions tracing the border
 * clockwise, starting from one cell right of the top-left corner.
 *
 * @param {import('./diagram-model').DiagramBox} box
 * @returns {Array<{x: number, y: number}>}
 */
function computePerimeterPath(box) {
  var x = box.x, y = box.y, w = box.width, h = box.height;
  var path = [];

  /* Top edge: left-to-right (excluding corners). */
  for (var c = 1; c < w - 1; c++) path.push({ x: x + c, y: y });

  /* Top-right corner. */
  path.push({ x: x + w - 1, y: y });

  /* Right edge: top-to-bottom (excluding corners). */
  for (var r = 1; r < h - 1; r++) path.push({ x: x + w - 1, y: y + r });

  /* Bottom-right corner. */
  path.push({ x: x + w - 1, y: y + h - 1 });

  /* Bottom edge: right-to-left (excluding corners). */
  for (var c2 = w - 2; c2 >= 1; c2--) path.push({ x: x + c2, y: y + h - 1 });

  /* Bottom-left corner. */
  path.push({ x: x, y: y + h - 1 });

  /* Left edge: bottom-to-top (excluding corners). */
  for (var r2 = h - 2; r2 >= 1; r2--) path.push({ x: x, y: y + r2 });

  /* Top-left corner. */
  path.push({ x: x, y: y });

  return path;
}

/**
 * Overlay current-work animation dots onto the buffer.
 *
 * Places exactly two ● characters on the perimeter path of each
 * current-work box, at positions determined by the frame number.
 * The dots advance clockwise by one step per frame.
 *
 * Gate cells (╢) are never overwritten by animation dots —
 * connectors have priority (spec §19.6.1).
 *
 * @param {import('./diagram-model').DiagramModel} model - Diagram model.
 * @param {import('./render-buffer').CharBuffer}    buf   - Target buffer.
 * @param {import('./occupancy-grid').OccupancyGrid} grid  - For gate detection.
 * @param {number} frame - Current animation frame number (0-based).
 */
function overlayAnimation(model, buf, grid, frame) {
  var dotChar = CHARSETS.currentWork.dot;

  model.boxes.forEach(function (box) {
    if (!box.currentWork) return;

    var path = computePerimeterPath(box);
    if (path.length === 0) return;

    var pathLen = path.length;
    var dot1Idx = frame % pathLen;
    var dot2Idx = (frame + Math.floor(pathLen / 2)) % pathLen;

    var indices = [dot1Idx, dot2Idx];
    for (var i = 0; i < indices.length; i++) {
      var idx = indices[i];
      var px = path[idx].x;
      var py = path[idx].y;
      var cell = grid.query(px, py);
      if (cell.type === CELL_TYPE.GATE || cell.type === CELL_TYPE.PORT) continue;
      buf.put(px, py, dotChar);
    }
  });
}

module.exports = {
  computePerimeterPath: computePerimeterPath,
  overlayAnimation:     overlayAnimation
};
