'use strict';

/**
 * lib/widget/sequence/seq-render-note.js
 *
 * Renders note boxes positioned near or between lifelines.
 * Notes are bordered boxes with text content, anchored to
 * one or two participants.
 */

var CHARSETS = require('../../border/charsets').CHARSETS;

/**
 * Render all notes in the events list.
 *
 * Notes are positioned at their computed (x, y) with the width and
 * height determined during layout. Uses the light charset for borders.
 *
 * @param {import('./seq-model').SequenceModel} model - Laid-out model.
 * @param {import('../diagram/render-buffer').CharBuffer} buf
 */
function renderNotes(model, buf) {
  for (var i = 0; i < model.events.length; i++) {
    var evt = model.events[i];
    if (evt.type !== 'note') continue;

    /* Compute note X position based on anchor participant(s). */
    var noteX = computeNoteX(evt, model);
    evt.x = noteX;

    var cs = CHARSETS.light;
    var w = evt.width;
    var h = evt.height;
    var y = evt.y;

    /* Top border. */
    buf.put(noteX, y, cs.topLeft);
    for (var c = 1; c < w - 1; c++) buf.put(noteX + c, y, cs.horizontal);
    buf.put(noteX + w - 1, y, cs.topRight);

    /* Content rows. */
    var lines = evt.text.split('\n');
    for (var r = 0; r < h - 2; r++) {
      var row = y + 1 + r;
      buf.put(noteX, row, cs.vertical);
      buf.put(noteX + w - 1, row, cs.vertical);
      var line = r < lines.length ? lines[r] : '';
      for (var li = 0; li < line.length; li++) {
        buf.put(noteX + 1 + li, row, line.charAt(li));
      }
    }

    /* Bottom border. */
    buf.put(noteX, y + h - 1, cs.bottomLeft);
    for (var c2 = 1; c2 < w - 1; c2++) buf.put(noteX + c2, y + h - 1, cs.horizontal);
    buf.put(noteX + w - 1, y + h - 1, cs.bottomRight);
  }
}

/**
 * Compute the X position for a note based on its anchor position.
 *
 * @param {Object} note - Note entity.
 * @param {import('./seq-model').SequenceModel} model
 * @returns {number} X position.
 */
function computeNoteX(note, model) {
  var p = note.participantId ? model.getParticipant(note.participantId) : null;
  var p2 = note.participantId2 ? model.getParticipant(note.participantId2) : null;

  if (note.position === 'between' && p && p2) {
    /* Center between the two participants. */
    var center = Math.floor((p.lifelineX + p2.lifelineX) / 2);
    return center - Math.floor(note.width / 2);
  }

  if (!p) return 2;

  switch (note.position) {
    case 'left':
      return p.lifelineX - note.width - 1;
    case 'right':
      return p.lifelineX + 2;
    case 'over':
    default:
      return p.lifelineX - Math.floor(note.width / 2);
  }
}

module.exports = {
  renderNotes: renderNotes
};
