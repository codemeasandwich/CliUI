'use strict';

/**
 * lib/widget/sequence/seq-data-builder.js
 *
 * Converts a user-facing data descriptor into a SequenceModel.
 *
 * Descriptor format:
 *   {
 *     participants: [{ id, label, borderStyle? }],
 *     messages:     [{ from, to, label, style?, arrow?, animate? }],
 *     sections:     [{ after: N, label }],
 *     notes:        [{ over|between, text }]
 *   }
 */

var SequenceModel = require('./seq-model').SequenceModel;

/**
 * Build a SequenceModel from a declarative data descriptor.
 *
 * @param {Object} data - Descriptor object.
 * @param {Array}  data.participants
 * @param {Array}  [data.messages]
 * @param {Array}  [data.sections]
 * @param {Array}  [data.notes]
 * @param {boolean} [data.showBottomBoxes]
 * @returns {SequenceModel}
 */
function buildSequenceFromData(data) {
  var model = new SequenceModel();
  model.showBottomBoxes = !!data.showBottomBoxes;

  /* ── Phase 1: Participants ──────────────────────────────────── */
  var participants = data.participants || [];
  for (var i = 0; i < participants.length; i++) {
    var p = participants[i];
    model.addParticipant(p.id, p.label, p.borderStyle);
  }

  /* ── Phase 2: Build interleaved events timeline ─────────────── */
  /* Messages are ordered by array position. Sections are inserted
   * AFTER a specific message index. Notes are inserted in-order. */
  var messages  = data.messages  || [];
  var sections  = data.sections  || [];
  var notes     = data.notes     || [];

  /* Create a lookup: afterMessageIndex → array of sections. */
  var sectionMap = new Map();
  for (var si = 0; si < sections.length; si++) {
    var afterIdx = sections[si].after != null ? sections[si].after : messages.length - 1;
    if (!sectionMap.has(afterIdx)) sectionMap.set(afterIdx, []);
    sectionMap.get(afterIdx).push(sections[si]);
  }

  /* Track note insertion (notes appear before first message by default,
   * or can be explicitly placed — for simplicity, prepend them). */
  for (var ni = 0; ni < notes.length; ni++) {
    var n = notes[ni];
    var pos = n.position || (n.between ? 'between' : 'over');
    var pid  = n.over || (n.between ? n.between[0] : null);
    var pid2 = n.between ? n.between[1] : null;
    model.addNote(n.text, pos, pid, pid2);
  }

  /* Interleave messages and sections. */
  for (var mi = 0; mi < messages.length; mi++) {
    var m = messages[mi];
    model.addMessage(m.from, m.to, m.label, {
      style:   m.style,
      arrow:   m.arrow,
      animate: m.animate,
      density: m.density
    });

    /* Insert any sections that follow this message. */
    if (sectionMap.has(mi)) {
      var secs = sectionMap.get(mi);
      for (var sj = 0; sj < secs.length; sj++) {
        model.addSection(secs[sj].label);
      }
    }
  }

  return model;
}

module.exports = { buildSequenceFromData: buildSequenceFromData };
