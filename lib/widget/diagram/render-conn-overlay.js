'use strict';

/**
 * lib/widget/diagram/render-conn-overlay.js
 *
 * Connection animation overlays for diagram connectors.
 *
 * Extracted from render-animation.js to keep each module under 200 NCLOC.
 * Contains: segmentsToCells, overlayConnAnimations, and the related
 * pattern/frame constants (SNAKE_PATTERN, SPINNER_FRAMES).
 *
 * Focus-pulse and perimeter-path logic live in render-focus-pulse.js.
 */

var CHARSETS   = require('../../border/charsets').CHARSETS;

// ────────────────────────────────────────────────────────────────────
// § Connector segment expansion
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

// ────────────────────────────────────────────────────────────────────
// § Connection animation overlays
// ────────────────────────────────────────────────────────────────────

/**
 * Braille spinner frames for the SPINNER connector style.
 * 10 frames for a smooth rotation cycle.
 * @type {string[]}
 */
var SPINNER_FRAMES = ['\u280B','\u2819','\u2839','\u2838','\u283C','\u2834','\u2826','\u2827','\u2807','\u280F'];
// ⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏

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

      case 'stream':
        /* Density-based multi-marker: fill the path with evenly spaced
         * markers that advance forward each frame. density (0.0-1.0)
         * controls the fraction of cells that carry a marker. */
        var density = conn.density != null ? conn.density : 0.5;
        var markerCount = Math.max(1, Math.round(density * cells.length));
        var spacing = Math.max(1, Math.floor(cells.length / markerCount));
        var streamMarker = conn.marker || CHARSETS.currentWork.dot;

        if (!conn.bidirectional) {
          /* Unidirectional stream: all markers travel forward. */
          for (var mi = 0; mi < markerCount; mi++) {
            var mpos = (frame + mi * spacing) % cells.length;
            buf.put(cells[mpos].x, cells[mpos].y, streamMarker);
          }
        } else {
          /* Bidirectional stream: half forward, half backward. */
          var halfCount = Math.max(1, Math.floor(markerCount / 2));
          var totalStreamF = cells.length * 2 - 2;
          for (var fi = 0; fi < halfCount; fi++) {
            var fpos = (frame + fi * spacing) % cells.length;
            buf.put(cells[fpos].x, cells[fpos].y, streamMarker);
          }
          for (var bi = 0; bi < halfCount; bi++) {
            var braw = (frame + bi * spacing) % (totalStreamF || 1);
            var bpos2 = braw >= cells.length ? totalStreamF - braw : braw;
            buf.put(cells[bpos2].x, cells[bpos2].y, streamMarker);
          }
        }
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
  segmentsToCells:         segmentsToCells,
  overlayConnAnimations:   overlayConnAnimations,
  SPINNER_FRAMES:          SPINNER_FRAMES,
  SNAKE_PATTERN:           SNAKE_PATTERN
};
