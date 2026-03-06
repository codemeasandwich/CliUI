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

// ────────────────────────────────────────────────────────────────────
// § Connector-travel animation helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Expand connector segments into an ordered cell-by-cell path.
 *
 * Each segment is an orthogonal line `{x1,y1,x2,y2}`.  This function
 * walks every cell along each segment in order, producing a flat array
 * of `{x, y}` positions suitable for stepping a travel dot through.
 *
 * Consecutive segments share their junction cell (the end of segment N
 * equals the start of segment N+1), so we skip the first cell of each
 * segment after the first to avoid duplicates.
 *
 * @param {Array<{x1:number, y1:number, x2:number, y2:number}>} segments
 * @returns {Array<{x: number, y: number}>}
 */
function segmentsToCells(segments) {
  var cells = [];
  for (var si = 0; si < segments.length; si++) {
    var seg = segments[si];
    var dx = seg.x2 === seg.x1 ? 0 : (seg.x2 > seg.x1 ? 1 : -1);
    var dy = seg.y2 === seg.y1 ? 0 : (seg.y2 > seg.y1 ? 1 : -1);
    var x = seg.x1;
    var y = seg.y1;

    /*
     * For the first segment, include the starting cell.
     * For subsequent segments, skip the first cell (it was the last
     * cell of the previous segment — the shared junction point).
     */
    var skip = si > 0;
    while (true) {
      if (!skip) {
        cells.push({ x: x, y: y });
      }
      skip = false;
      if (x === seg.x2 && y === seg.y2) break;
      x += dx;
      y += dy;
    }
  }
  return cells;
}

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

// ────────────────────────────────────────────────────────────────────
// § Focus-pulse overlay
// ────────────────────────────────────────────────────────────────────

/**
 * Braille spinner frames for the SPINNER connector style.
 * 10 frames for a smooth rotation cycle.
 * @type {string[]}
 */
var SPINNER_FRAMES = ['\u280B','\u2819','\u2839','\u2838','\u283C','\u2834','\u2826','\u2827','\u2807','\u280F'];
// ⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏

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

// ────────────────────────────────────────────────────────────────────
// § Connection animation overlays
// ────────────────────────────────────────────────────────────────────

/**
 * Snake pattern characters for the SNAKE connector style.
 * The pattern shifts along the connector path each frame.
 * @type {string[]}
 */
var SNAKE_PATTERN = ['\u2501', '\u2509', '\u2505', '\u254D', '\u2578'];
// ━ ┉ ┅ ╍ ╸

/**
 * Overlay connection animations for all animated connectors.
 *
 * Each entry in `connAnimStates` maps a connector ID to its animation
 * state ({ frame, style, speed }).  This function renders the visual
 * effect for each animated connector.
 *
 * @param {import('./diagram-model').DiagramModel} model
 * @param {import('./render-buffer').CharBuffer}    buf
 * @param {import('./occupancy-grid').OccupancyGrid} grid
 * @param {Map<number,{frame:number, style:string}>} connAnimStates
 */
function overlayConnAnimations(model, buf, grid, connAnimStates) {
  if (!connAnimStates) return;

  connAnimStates.forEach(function (state, connId) {
    var conn = model.getConnector(connId);
    if (!conn || !conn.segments || conn.segments.length === 0) return;

    var cells = segmentsToCells(conn.segments);
    if (cells.length === 0) return;

    var frame = state.frame || 0;

    switch (state.style) {
      case 'animated':
        if (!conn.bidirectional) {
          /* Unidirectional: place a marker dot at frame % cellCount. */
          var markerIdx = frame % cells.length;
          var marker = conn.marker || CHARSETS.currentWork.dot;
          buf.put(cells[markerIdx].x, cells[markerIdx].y, marker);
        }
        /* Bidirectional animated connectors are handled by the bounce
         * logic below the switch — skip the linear marker here to
         * avoid rendering two overlapping markers. */
        break;

      case 'snake':
        /* Write the snake pattern shifted by frame along the cells. */
        for (var si = 0; si < cells.length; si++) {
          var patIdx = (si + frame) % SNAKE_PATTERN.length;
          buf.put(cells[si].x, cells[si].y, SNAKE_PATTERN[patIdx]);
        }
        break;

      case 'dashed':
        /* Alternate visibility of dashed chars per frame (blink). */
        if (frame % 2 === 0) {
          for (var di = 0; di < cells.length; di += 2) {
            buf.put(cells[di].x, cells[di].y, ' ');
          }
        }
        break;

      case 'spinner':
        /* Write spinner at the connector midpoint. */
        var midIdx = Math.floor(cells.length / 2);
        var spinChar = SPINNER_FRAMES[frame % SPINNER_FRAMES.length];
        buf.put(cells[midIdx].x, cells[midIdx].y, spinChar);
        break;

      default:
        break;
    }

    /* Bidirectional bounce: marker travels forward then backward. */
    if (conn.bidirectional && state.style === 'animated') {
      var totalFrames = cells.length * 2 - 2;
      var bouncePos = frame % (totalFrames || 1);
      if (bouncePos >= cells.length) {
        bouncePos = totalFrames - bouncePos;
      }
      var bMarker = conn.marker || CHARSETS.currentWork.dot;
      buf.put(cells[bouncePos].x, cells[bouncePos].y, bMarker);
    }
  });
}

module.exports = {
  computePerimeterPath:    computePerimeterPath,
  overlayAnimation:        overlayAnimation,
  segmentsToCells:         segmentsToCells,
  overlayTravelDot:        overlayTravelDot,
  overlayFocusPulse:       overlayFocusPulse,
  overlayConnAnimations:   overlayConnAnimations,
  SPINNER_FRAMES:          SPINNER_FRAMES
};
