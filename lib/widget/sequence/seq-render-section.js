'use strict';

/**
 * lib/widget/sequence/seq-render-section.js
 *
 * Renders section separator lines with centered labels.
 * Sections visually divide the sequence diagram into phases
 * (e.g. "Error flow including deletion").
 */

/** Separator dash character. */
var DASH = '\u2504';  // ┄

/**
 * Render all section separators in the events list.
 *
 * Each section draws a dashed line spanning from the leftmost to
 * rightmost participant lifeline, with the label centered in a gap.
 *
 * @param {import('./seq-model').SequenceModel} model - Laid-out model.
 * @param {import('../diagram/render-buffer').CharBuffer} buf
 */
function renderSections(model, buf) {
  if (model.participants.length === 0) return;

  var leftX  = model.participants[0].lifelineX;
  var rightX = model.participants[model.participants.length - 1].lifelineX;

  for (var i = 0; i < model.events.length; i++) {
    var evt = model.events[i];
    if (evt.type !== 'section') continue;

    /* Row 0: blank separator. Row 1: dashed line with label. */
    var lineY = evt.y + 1;

    /* Draw the full dashed line. */
    for (var x = leftX; x <= rightX; x++) {
      buf.put(x, lineY, DASH);
    }

    /* Center the label text in the line. */
    if (evt.label) {
      var labelText = ' ' + evt.label + ' ';
      var center = Math.floor((leftX + rightX) / 2);
      var labelStart = center - Math.floor(labelText.length / 2);
      for (var li = 0; li < labelText.length; li++) {
        buf.put(labelStart + li, lineY, labelText.charAt(li));
      }
    }
  }
}

module.exports = {
  renderSections: renderSections,
  DASH: DASH
};
