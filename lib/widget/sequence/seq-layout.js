'use strict';

/**
 * lib/widget/sequence/seq-layout.js
 *
 * Auto-layout for sequence diagrams: computes participant X positions,
 * lifeline centers, and event Y positions for vertical stacking.
 */

/** Minimum horizontal gap between participant centers. */
var MIN_GAP = 16;

/** Height of a participant header box (including borders). */
var HEADER_HEIGHT = 3;

/** Rows consumed by a regular message (label + arrow). */
var MSG_ROWS = 2;

/** Rows consumed by a self-message (label + loop-back). */
var SELF_MSG_ROWS = 4;

/** Rows consumed by a section separator. */
var SECTION_ROWS = 2;

/**
 * Run the full layout on a SequenceModel.
 *
 * Mutates participant x/width/lifelineX and event y values in-place.
 * Sets model.width and model.height to the computed bounding box.
 *
 * @param {import('./seq-model').SequenceModel} model
 */
function layout(model) {
  if (model.participants.length === 0) return;

  /* ── Phase 1: Compute participant widths ───────────────────── */
  for (var i = 0; i < model.participants.length; i++) {
    var p = model.participants[i];
    p.width = Math.max(p.label.length + 4, 10);
  }

  /* ── Phase 2: Compute minimum gaps between adjacent pairs ──── */
  /* The gap must accommodate the longest message label spanning
   * between each pair of adjacent participants. */
  var gaps = [];
  for (var gi = 0; gi < model.participants.length - 1; gi++) {
    gaps.push(MIN_GAP);
  }

  /* Scan messages to find required gaps. */
  for (var ei = 0; ei < model.events.length; ei++) {
    var evt = model.events[ei];
    if (evt.type !== 'message') continue;
    if (evt.from === evt.to) continue;

    var fromIdx = participantIndex(model, evt.from);
    var toIdx = participantIndex(model, evt.to);
    if (fromIdx < 0 || toIdx < 0) continue;

    var lo = Math.min(fromIdx, toIdx);
    var hi = Math.max(fromIdx, toIdx);

    /* The label must fit in the span between these participants.
     * Distribute the required width across all gaps in the range. */
    var labelLen = evt.label.length + 4;
    var spanGaps = hi - lo;
    var perGap = Math.ceil(labelLen / spanGaps);

    for (var sg = lo; sg < hi; sg++) {
      if (perGap > gaps[sg]) gaps[sg] = perGap;
    }
  }

  /* ── Phase 3: Assign participant X positions ───────────────── */
  var x = 2;
  for (var pi = 0; pi < model.participants.length; pi++) {
    var part = model.participants[pi];
    part.x = x;
    part.lifelineX = x + Math.floor(part.width / 2);
    if (pi < gaps.length) {
      x += part.width + gaps[pi];
    }
  }

  /* ── Phase 4: Assign event Y positions ─────────────────────── */
  var y = HEADER_HEIGHT + 1;

  for (var vi = 0; vi < model.events.length; vi++) {
    var ev = model.events[vi];
    ev.y = y;

    switch (ev.type) {
      case 'message':
        y += (ev.from === ev.to) ? SELF_MSG_ROWS : MSG_ROWS;
        break;
      case 'section':
        y += SECTION_ROWS;
        break;
      case 'note':
        var noteLines = ev.text.split('\n');
        var noteH = noteLines.length + 2;
        ev.height = noteH;
        /* Compute note width and position. */
        var maxNoteLen = 0;
        for (var nl = 0; nl < noteLines.length; nl++) {
          if (noteLines[nl].length > maxNoteLen) maxNoteLen = noteLines[nl].length;
        }
        ev.width = maxNoteLen + 4;
        y += noteH;
        break;
      default:
        y += 1;
        break;
    }
  }

  /* Bottom boxes add another header height. */
  if (model.showBottomBoxes) y += HEADER_HEIGHT + 1;

  /* ── Phase 5: Set model bounds ─────────────────────────────── */
  var lastP = model.participants[model.participants.length - 1];
  model.width = Math.max(lastP.x + lastP.width + 2, 40);
  model.height = Math.max(y + 1, 10);
}

/**
 * Find the index of a participant by ID.
 *
 * @param {import('./seq-model').SequenceModel} model
 * @param {string} id
 * @returns {number} Index or -1 if not found.
 */
function participantIndex(model, id) {
  for (var i = 0; i < model.participants.length; i++) {
    if (model.participants[i].id === id) return i;
  }
  return -1;
}

module.exports = {
  layout: layout,
  participantIndex: participantIndex,
  MIN_GAP: MIN_GAP,
  HEADER_HEIGHT: HEADER_HEIGHT,
  MSG_ROWS: MSG_ROWS,
  SELF_MSG_ROWS: SELF_MSG_ROWS,
  SECTION_ROWS: SECTION_ROWS
};
