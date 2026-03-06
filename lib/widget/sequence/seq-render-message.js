'use strict';

/**
 * lib/widget/sequence/seq-render-message.js
 *
 * Renders horizontal message arrows between lifelines.
 * Handles left-to-right, right-to-left, and self-message loop-back arrows.
 */

/** Arrow characters for message endpoints. */
var ARROW_RIGHT = '\u25B6';  // ▶
var ARROW_LEFT  = '\u25C0';  // ◀
var OPEN_RIGHT  = '>';
var OPEN_LEFT   = '<';

/** Shaft characters for different line styles. */
var SHAFT = {
  solid:  '\u2500',  // ─
  dashed: '\u254C',  // ╌
  dotted: '\u00B7'   // ·
};

/** Corner characters for self-message loop-back. */
var CORNER_TR = '\u2510';  // ┐
var CORNER_BR = '\u2518';  // ┘

/**
 * Render all messages in the events list.
 *
 * Each message draws:
 *   - A label on the row above the arrow
 *   - A horizontal line (shaft) between source and dest lifelines
 *   - An arrowhead at the destination end
 *
 * Self-messages (from === to) draw a loop-back pattern:
 *   ──┐  (label above)
 *     │
 *   <─┘
 *
 * @param {import('./seq-model').SequenceModel} model - Laid-out model.
 * @param {import('../diagram/render-buffer').CharBuffer} buf
 */
function renderMessages(model, buf) {
  for (var i = 0; i < model.events.length; i++) {
    var evt = model.events[i];
    if (evt.type !== 'message') continue;

    var fromP = model.getParticipant(evt.from);
    var toP   = model.getParticipant(evt.to);
    if (!fromP || !toP) continue;

    if (evt.from === evt.to) {
      renderSelfMessage(evt, fromP, buf);
    } else {
      renderNormalMessage(evt, fromP, toP, buf);
    }
  }
}

/**
 * Render a normal (non-self) message arrow between two lifelines.
 *
 * @param {Object} msg  - Message entity with y, label, style, arrow.
 * @param {Object} from - Source participant (with lifelineX).
 * @param {Object} to   - Destination participant (with lifelineX).
 * @param {import('../diagram/render-buffer').CharBuffer} buf
 */
function renderNormalMessage(msg, from, to, buf) {
  var y = msg.y;
  var leftToRight = from.lifelineX < to.lifelineX;
  var startX = leftToRight ? from.lifelineX : to.lifelineX;
  var endX   = leftToRight ? to.lifelineX   : from.lifelineX;

  /* Row 0: label text above the arrow, positioned after source lifeline. */
  var labelX = (leftToRight ? from.lifelineX : to.lifelineX) + 1;
  for (var li = 0; li < msg.label.length; li++) {
    buf.put(labelX + li, y, msg.label.charAt(li));
  }

  /* Row 1: arrow shaft + arrowhead. */
  var arrowY = y + 1;
  var shaftChar = SHAFT[msg.style] || SHAFT.solid;

  /* Draw shaft between lifelines (exclusive of endpoints). */
  for (var sx = startX + 1; sx < endX; sx++) {
    buf.put(sx, arrowY, shaftChar);
  }

  /* Source endpoint (lifeline crossing). */
  buf.put(startX, arrowY, shaftChar);

  /* Destination endpoint (arrowhead). */
  var headChar;
  if (msg.arrow === 'none') {
    headChar = shaftChar;
  } else if (msg.arrow === 'open') {
    headChar = leftToRight ? OPEN_RIGHT : OPEN_LEFT;
  } else {
    headChar = leftToRight ? ARROW_RIGHT : ARROW_LEFT;
  }
  buf.put(endX, arrowY, headChar);
}

/**
 * Render a self-message (loop-back to the same participant).
 *
 * Pattern occupies 4 rows:
 *   Row 0: label
 *   Row 1: ──┐
 *   Row 2:   │
 *   Row 3: <─┘
 *
 * @param {Object} msg  - Message entity.
 * @param {Object} part - Participant (source and destination).
 * @param {import('../diagram/render-buffer').CharBuffer} buf
 */
function renderSelfMessage(msg, part, buf) {
  var y = msg.y;
  var lx = part.lifelineX;
  var loopW = 4;

  /* Row 0: label above the loop. */
  for (var li = 0; li < msg.label.length; li++) {
    buf.put(lx + 1 + li, y, msg.label.charAt(li));
  }

  /* Row 1: outgoing arm ──┐ */
  var shaftChar = SHAFT[msg.style] || SHAFT.solid;
  buf.put(lx, y + 1, shaftChar);
  for (var si = 1; si < loopW; si++) {
    buf.put(lx + si, y + 1, shaftChar);
  }
  buf.put(lx + loopW, y + 1, CORNER_TR);

  /* Row 2: vertical descent │ */
  buf.put(lx + loopW, y + 2, '\u2502');  // │

  /* Row 3: return arm <─┘ */
  var headChar = (msg.arrow === 'none') ? shaftChar
    : (msg.arrow === 'open') ? OPEN_LEFT : ARROW_LEFT;
  buf.put(lx, y + 3, headChar);
  for (var ri = 1; ri < loopW; ri++) {
    buf.put(lx + ri, y + 3, shaftChar);
  }
  buf.put(lx + loopW, y + 3, CORNER_BR);
}

module.exports = {
  renderMessages: renderMessages,
  ARROW_RIGHT: ARROW_RIGHT,
  ARROW_LEFT: ARROW_LEFT,
  SHAFT: SHAFT
};
