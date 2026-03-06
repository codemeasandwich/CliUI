'use strict';

/**
 * lib/widget/diagram/render-focus-pulse.js
 *
 * Focus-pulse overlay and perimeter path computation for diagram boxes.
 *
 * Extracted from render-conn-overlay.js to keep each module under 200 NCLOC.
 * Contains the keyboard-focus pulsing border effect that cycles through
 * light → heavy → double charsets, and the shared perimeter-path helper
 * used by both this module and the current-work animation overlay.
 */

var CHARSETS   = require('../../border/charsets').CHARSETS;
var CELL_TYPE  = require('./occupancy-grid').CELL_TYPE;

// ────────────────────────────────────────────────────────────────────
// § Perimeter path (shared with render-animation.js)
// ────────────────────────────────────────────────────────────────────

/**
 * Compute the perimeter path of a box border.
 *
 * Returns an ordered array of { x, y } positions tracing the border
 * clockwise, starting from one cell right of the top-left corner.
 * Used by both focus-pulse overlay (this module) and current-work
 * animation (render-animation.js).
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

// ────────────────────────────────────────────────────────────────────
// § Focus-pulse overlay
// ────────────────────────────────────────────────────────────────────

/**
 * Charset cycle for focus-pulse: the border alternates between
 * light, heavy, and double charsets to create a visual pulse.
 */
var PULSE_CHARSETS = [CHARSETS.light, CHARSETS.heavy, CHARSETS.double];

/**
 * Overlay a pulsing border effect on the focused box.
 *
 * The pulse cycles through light → heavy → double charsets at each
 * frame, giving the focused box a rhythmic border throb.
 *
 * @param {number} focusedBoxId - The box ID to pulse.
 * @param {number} pulseFrame   - Current pulse frame counter.
 * @param {import('./diagram-model').DiagramModel} model
 * @param {import('./render-buffer').CharBuffer}    buf
 * @param {import('./occupancy-grid').OccupancyGrid} grid
 */
function overlayFocusPulse(focusedBoxId, pulseFrame, model, buf, grid) {
  var box = model.getBox(focusedBoxId);
  if (!box) return;

  var cs = PULSE_CHARSETS[pulseFrame % PULSE_CHARSETS.length];
  var path = computePerimeterPath(box);

  for (var i = 0; i < path.length; i++) {
    var px = path[i].x;
    var py = path[i].y;
    var cell = grid.query(px, py);

    /* Don't overwrite gate/port cells — connectors have priority. */
    if (cell.type === CELL_TYPE.GATE || cell.type === CELL_TYPE.PORT) continue;

    /* Determine which character to use based on position. */
    var isCorner = (px === box.x && py === box.y)              ||
                   (px === box.x + box.width - 1 && py === box.y)  ||
                   (px === box.x && py === box.y + box.height - 1) ||
                   (px === box.x + box.width - 1 && py === box.y + box.height - 1);

    if (isCorner) {
      /* Corners — determine which one. */
      if (px === box.x && py === box.y) buf.put(px, py, cs.topLeft);
      else if (px === box.x + box.width - 1 && py === box.y) buf.put(px, py, cs.topRight);
      else if (px === box.x && py === box.y + box.height - 1) buf.put(px, py, cs.bottomLeft);
      else buf.put(px, py, cs.bottomRight);
    } else if (py === box.y || py === box.y + box.height - 1) {
      buf.put(px, py, cs.horizontal);
    } else {
      buf.put(px, py, cs.vertical);
    }
  }
}

module.exports = {
  computePerimeterPath: computePerimeterPath,
  overlayFocusPulse:    overlayFocusPulse,
  PULSE_CHARSETS:       PULSE_CHARSETS
};
