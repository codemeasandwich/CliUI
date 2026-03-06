'use strict';

/**
 * lib/widget/sequence/seq-render-lifeline.js
 *
 * Renders dashed vertical lifelines dropping from each participant
 * box downward through the message area to the diagram bottom.
 */

/** Lifeline character: thin dashed vertical bar. */
var LIFELINE_CHAR = '\u2506';
// ┆

/**
 * Render lifelines for all participants.
 *
 * Draws a dashed vertical line from just below the top header box
 * to the bottom of the events area (or to just above bottom boxes
 * if showBottomBoxes is true).
 *
 * @param {Array<Object>} participants - Laid-out participant entities.
 * @param {import('../diagram/render-buffer').CharBuffer} buf
 * @param {number} startY - First row of the lifeline (below header).
 * @param {number} endY   - Last row of the lifeline (above bottom boxes or diagram end).
 */
function renderLifelines(participants, buf, startY, endY) {
  for (var i = 0; i < participants.length; i++) {
    var lx = participants[i].lifelineX;
    for (var y = startY; y <= endY; y++) {
      /* Only draw the lifeline if the cell is empty (space).
       * Messages and notes take priority over lifeline chars. */
      var existing = buf.get(lx, y);
      if (existing === ' ') {
        buf.put(lx, y, LIFELINE_CHAR);
      }
    }
  }
}

module.exports = {
  renderLifelines: renderLifelines,
  LIFELINE_CHAR: LIFELINE_CHAR
};
