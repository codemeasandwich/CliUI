'use strict';

/**
 * lib/widget/sequence/seq-render-participant.js
 *
 * Renders participant header boxes at the top (and optionally bottom)
 * of the sequence diagram using border charsets.
 */

var CHARSETS = require('../../border/charsets').CHARSETS;
var resolveCharset = require('../../border/charsets').resolveCharset;

/** Height of a participant box (top border + content + bottom border). */
var BOX_HEIGHT = 3;

/**
 * Render participant boxes at a given Y row.
 *
 * Draws bordered boxes for each participant, centered around their
 * lifelineX position.
 *
 * @param {Array<Object>} participants - Laid-out participant entities.
 * @param {import('../diagram/render-buffer').CharBuffer} buf
 * @param {number} y - Top row of the header area.
 */
function renderParticipantBoxes(participants, buf, y) {
  for (var i = 0; i < participants.length; i++) {
    var p = participants[i];
    var cs = resolveCharset(p.borderStyle) || CHARSETS.light;
    var x = p.x;
    var w = p.width;

    /* Top border: ┌──────┐ */
    buf.put(x, y, cs.topLeft);
    for (var c = 1; c < w - 1; c++) buf.put(x + c, y, cs.horizontal);
    buf.put(x + w - 1, y, cs.topRight);

    /* Content row: │ Label │ */
    buf.put(x, y + 1, cs.vertical);
    buf.put(x + w - 1, y + 1, cs.vertical);

    /* Center the label inside the box. */
    var label = p.label;
    var pad = Math.max(0, Math.floor((w - 2 - label.length) / 2));
    for (var li = 0; li < label.length; li++) {
      buf.put(x + 1 + pad + li, y + 1, label.charAt(li));
    }

    /* Bottom border: └──────┘ */
    buf.put(x, y + 2, cs.bottomLeft);
    for (var c2 = 1; c2 < w - 1; c2++) buf.put(x + c2, y + 2, cs.horizontal);
    buf.put(x + w - 1, y + 2, cs.bottomRight);
  }
}

module.exports = {
  renderParticipantBoxes: renderParticipantBoxes,
  BOX_HEIGHT: BOX_HEIGHT
};
