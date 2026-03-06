'use strict';

/**
 * lib/widget/diagram/render-animation.js
 *
 * Box-level animation overlays: current-work perimeter dots and
 * travel-dot connector animation.
 *
 * Connection-level overlays (snake, spinner, dashed, stream, focus-pulse)
 * live in render-conn-overlay.js to keep each module under 200 NCLOC.
 */

var CHARSETS   = require('../../border/charsets').CHARSETS;
var CELL_TYPE  = require('./occupancy-grid').CELL_TYPE;

/* Re-export connection overlay and focus-pulse modules — loaded once
 * here, re-exported at module.exports for backward compatibility
 * with existing consumers. */
var connOverlay          = require('./render-conn-overlay');
var focusPulse           = require('./render-focus-pulse');
var computePerimeterPath = focusPulse.computePerimeterPath;

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

// ────────────────────────────────────────────────────────────────────
// § Connector-travel animation helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Overlay a single ● travel dot onto the render buffer.
 *
 * Called during the render pipeline when a travel animation is active.
 * Places the dot character at the current cell position indicated by
 * `travelState.cellIdx` within the pre-computed `travelState.cells` path.
 *
 * @param {{ cells: Array<{x:number, y:number}>, cellIdx: number }} travelState
 * @param {import('./render-buffer').CharBuffer} buf - Target character buffer.
 */
function overlayTravelDot(travelState, buf) {
  if (!travelState || !travelState.cells) return;
  var idx = travelState.cellIdx;
  if (idx < 0 || idx >= travelState.cells.length) return;

  var pos = travelState.cells[idx];
  buf.put(pos.x, pos.y, CHARSETS.currentWork.dot);
}

module.exports = {
  computePerimeterPath:    computePerimeterPath,
  overlayAnimation:        overlayAnimation,
  overlayTravelDot:        overlayTravelDot,
  segmentsToCells:         connOverlay.segmentsToCells,
  overlayFocusPulse:       focusPulse.overlayFocusPulse,
  overlayConnAnimations:   connOverlay.overlayConnAnimations,
  SPINNER_FRAMES:          connOverlay.SPINNER_FRAMES,
  SNAKE_PATTERN:           connOverlay.SNAKE_PATTERN
};
