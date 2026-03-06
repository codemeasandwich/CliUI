'use strict';

/**
 * lib/widget/sequence/seq-animation.js
 *
 * Message arrow animation overlays for the sequence diagram widget.
 *
 * Provides density-based dot travel, snake patterns, and stream
 * multi-marker animations that overlay onto rendered message arrows.
 * Mirrors the diagram widget's connector animation approach
 * (render-conn-overlay.js) but adapted for horizontal sequence arrows
 * and self-message loop-back paths.
 *
 * Exports:
 *   buildMessageCells(msg, fromP, toP) — pure geometry → cell path
 *   overlayMessageAnimations(model, buf, frame) — render overlay
 */

var CHARSETS        = require('../../border/charsets').CHARSETS;
var connOverlay    = require('../diagram/render-conn-overlay');
var SNAKE_PATTERN  = connOverlay.SNAKE_PATTERN;
var SPINNER_FRAMES = connOverlay.SPINNER_FRAMES;

/** Marker dot character — matches the diagram widget's travel dot. */
var DOT_CHAR = CHARSETS.currentWork.dot;

/** Width of the self-message loop-back arm (matches seq-render-message). */
var LOOP_W = 4;

// ────────────────────────────────────────────────────────────────────
// § Cell path computation
// ────────────────────────────────────────────────────────────────────

/**
 * Build an ordered cell path for a message arrow.
 *
 * Returns an array of {x, y} positions tracing the arrow from source
 * to destination, suitable for stepping an animation marker through.
 *
 * Normal messages produce a horizontal line along the arrow row.
 * Self-messages produce an L-shaped loop (out → down → back) matching
 * the geometry in seq-render-message.js.
 *
 * @param {Object} msg   - Message entity with y position.
 * @param {Object} fromP - Source participant (with lifelineX).
 * @param {Object} toP   - Destination participant (with lifelineX).
 * @returns {Array<{x: number, y: number}>}
 */
function buildMessageCells(msg, fromP, toP) {
  var cells = [];

  if (fromP.id === toP.id) {
    /* Self-message loop: right along row+1, down, left along row+3. */
    var lx = fromP.lifelineX;
    var y1 = msg.y + 1;

    /* Outgoing arm: lx → lx + LOOP_W (row y+1). */
    for (var ox = lx; ox <= lx + LOOP_W; ox++) {
      cells.push({ x: ox, y: y1 });
    }
    /* Vertical descent (row y+2). */
    cells.push({ x: lx + LOOP_W, y: msg.y + 2 });
    /* Return arm: lx + LOOP_W → lx (row y+3). */
    for (var rx = lx + LOOP_W; rx >= lx; rx--) {
      cells.push({ x: rx, y: msg.y + 3 });
    }
  } else {
    /* Normal message: horizontal walk along arrow row (y+1). */
    var arrowY = msg.y + 1;
    var startX = fromP.lifelineX;
    var endX   = toP.lifelineX;
    var step   = startX < endX ? 1 : -1;

    for (var cx = startX; cx !== endX + step; cx += step) {
      cells.push({ x: cx, y: arrowY });
    }
  }

  return cells;
}

// ────────────────────────────────────────────────────────────────────
// § Animation overlay
// ────────────────────────────────────────────────────────────────────

/**
 * Overlay message arrow animations onto the character buffer.
 *
 * Iterates model events and for each message with a truthy `animate`
 * property, builds a cell path and overlays markers based on style:
 *   - 'animated': single dot traveling source-to-destination
 *   - 'snake': shifting SNAKE_PATTERN along the shaft
 *   - 'dashed': blinking dashed chars (alternating visibility)
 *   - 'spinner': braille spinner at the midpoint
 *   - 'stream': density-based evenly-spaced dots advancing per frame
 *
 * @param {import('./seq-model').SequenceModel} model - Laid-out model.
 * @param {import('../diagram/render-buffer').CharBuffer} buf - Target buffer.
 * @param {number} frame - Current animation frame counter.
 */
function overlayMessageAnimations(model, buf, frame) {
  for (var i = 0; i < model.events.length; i++) {
    var evt = model.events[i];
    if (evt.type !== 'message' || !evt.animate) continue;

    var fromP = model.getParticipant(evt.from);
    var toP   = model.getParticipant(evt.to);
    if (!fromP || !toP) continue;

    var cells = buildMessageCells(evt, fromP, toP);
    if (cells.length === 0) continue;

    switch (evt.animate) {
      case 'animated':
        /* Single dot traveling along the arrow path. */
        var idx = frame % cells.length;
        buf.put(cells[idx].x, cells[idx].y, DOT_CHAR);
        break;

      case 'snake':
        /* Shifting snake pattern along all cells. */
        for (var si = 0; si < cells.length; si++) {
          var patIdx = (si + frame) % SNAKE_PATTERN.length;
          buf.put(cells[si].x, cells[si].y, SNAKE_PATTERN[patIdx]);
        }
        break;

      case 'dashed':
        /* Alternate visibility of dashed chars per frame (blink).
         * Even frames hide every other cell; odd frames show all. */
        if (frame % 2 === 0) {
          for (var di = 0; di < cells.length; di += 2) {
            buf.put(cells[di].x, cells[di].y, ' ');
          }
        }
        break;

      case 'spinner':
        /* Write a braille spinner at the midpoint of the arrow. */
        var midIdx   = Math.floor(cells.length / 2);
        var spinChar = SPINNER_FRAMES[frame % SPINNER_FRAMES.length];
        buf.put(cells[midIdx].x, cells[midIdx].y, spinChar);
        break;

      case 'stream':
        /* Density-based evenly-spaced dots advancing per frame.
         * density (0.0-1.0) controls the fraction of cells that
         * carry a marker. Falls back to 3 markers when density
         * is not specified for backward compatibility. */
        var density = evt.density;
        var count   = density != null
          ? Math.max(1, Math.round(density * cells.length))
          : 3;
        var spacing = Math.max(1, Math.floor(cells.length / count));
        for (var mi = 0; mi < count; mi++) {
          var mpos = (frame + mi * spacing) % cells.length;
          buf.put(cells[mpos].x, cells[mpos].y, DOT_CHAR);
        }
        break;

      default:
        break;
    }
  }
}

module.exports = {
  buildMessageCells:          buildMessageCells,
  overlayMessageAnimations:   overlayMessageAnimations
};
