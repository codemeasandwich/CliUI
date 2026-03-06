'use strict';

/**
 * lib/widget/sequence/seq-widget-api.js
 *
 * Public API methods patched onto Sequence.prototype.
 */

var Sequence           = require('./seq-widget-core').Sequence;
var buildSequenceFromData = require('./seq-data-builder').buildSequenceFromData;
var layoutFn           = require('./seq-layout').layout;

/**
 * Run once after the widget is attached to a screen.
 *
 * @param {Object} options - Constructor options.
 * @private
 */
Sequence.prototype._deferredInit = function _deferredInit(options) {
  if (this._deferredInitDone) return;
  this._deferredInitDone = true;

  if (options.data) {
    this.setData(options.data);
  }
};

/**
 * Set the diagram data from a declarative descriptor.
 *
 * Builds a SequenceModel, runs layout, and renders.
 *
 * @param {Object} data - Descriptor with participants, messages, etc.
 */
Sequence.prototype.setData = function setData(data) {
  this._model = buildSequenceFromData(data);

  /* Apply show-bottom-boxes: data descriptor takes priority,
   * then fall back to the constructor-level option. */
  if (data.showBottomBoxes != null) {
    this._model.showBottomBoxes = !!data.showBottomBoxes;
  } else if (this._showBottomBoxes) {
    this._model.showBottomBoxes = true;
  }

  layoutFn(this._model);
  this._fullRender();
  this._startAnimation();
};

/**
 * Return the current data as a plain descriptor object.
 *
 * @returns {Object|null}
 */
Sequence.prototype.getData = function getData() {
  if (!this._model) return null;

  /* Reconstruct the descriptor from model events, preserving sections
   * and notes so setData(getData()) is a lossless round-trip.
   *
   * Sections track their insertion position relative to messages via
   * the `after` index (how many messages precede the section). */
  var messages = [];
  var sections = [];
  var notes    = [];
  var msgIdx   = -1;

  for (var i = 0; i < this._model.events.length; i++) {
    var e = this._model.events[i];
    if (e.type === 'message') {
      msgIdx++;
      messages.push({
        from: e.from, to: e.to, label: e.label,
        style: e.style, arrow: e.arrow, animate: e.animate,
        density: e.density
      });
    } else if (e.type === 'section') {
      sections.push({ after: msgIdx, label: e.label });
    } else if (e.type === 'note') {
      var note = { text: e.text };
      if (e.position === 'between' && e.participantId2) {
        note.between = [e.participantId, e.participantId2];
      } else {
        note.over = e.participantId;
        if (e.position && e.position !== 'over') note.position = e.position;
      }
      notes.push(note);
    }
  }

  var result = {
    participants: this._model.participants.map(function (p) {
      return { id: p.id, label: p.label, borderStyle: p.borderStyle };
    }),
    messages: messages,
    showBottomBoxes: this._model.showBottomBoxes
  };
  if (sections.length > 0) result.sections = sections;
  if (notes.length > 0)    result.notes    = notes;
  return result;
};

/**
 * Add a participant and re-render.
 *
 * @param {string} id
 * @param {string} label
 * @param {Object} [opts]
 */
Sequence.prototype.addParticipant = function addParticipant(id, label, opts) {
  if (!this._model) return;
  this._model.addParticipant(id, label, opts && opts.borderStyle);
  layoutFn(this._model);
  this._fullRender();
};

/**
 * Add a message and re-render.
 *
 * @param {string} from
 * @param {string} to
 * @param {string} label
 * @param {Object} [opts]
 */
Sequence.prototype.addMessage = function addMessage(from, to, label, opts) {
  if (!this._model) return;
  this._model.addMessage(from, to, label, opts);
  layoutFn(this._model);
  this._fullRender();
  this._startAnimation();
};

/**
 * Add a section separator and re-render.
 *
 * Sections are horizontal divider lines with a centered label that
 * visually separate groups of messages (e.g. "Error flow", "Retry").
 *
 * @param {string} label - Section label text.
 */
Sequence.prototype.addSection = function addSection(label) {
  if (!this._model) return;
  this._model.addSection(label);
  layoutFn(this._model);
  this._fullRender();
};

/**
 * Add a note and re-render.
 *
 * Notes are bordered text boxes anchored to one or two participants.
 *
 * @param {string} text - Note content.
 * @param {string} position - 'over', 'left', 'right', or 'between'.
 * @param {string} participantId - Primary anchor participant ID.
 * @param {string} [participantId2] - Second anchor (for 'between' notes).
 */
Sequence.prototype.addNote = function addNote(text, position, participantId, participantId2) {
  if (!this._model) return;
  this._model.addNote(text, position, participantId, participantId2);
  layoutFn(this._model);
  this._fullRender();
};
