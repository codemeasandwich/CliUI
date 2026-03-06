'use strict';

/**
 * lib/widget/sequence/seq-model.js
 *
 * SequenceModel — the data model for a sequence diagram.
 * Holds participants, and an ordered events timeline (messages,
 * sections, notes) that represents the vertical flow of interactions.
 */

var entities = require('./seq-entities');

/**
 * Data model for a sequence diagram.
 *
 * Participants are displayed as header boxes across the top.
 * Events (messages, sections, notes) are stacked vertically
 * in insertion order beneath the participant headers.
 *
 * @constructor
 */
function SequenceModel() {
  /** @type {Array<Object>} Ordered array of participants (display order). */
  this.participants = [];

  /** @type {Array<Object>} Ordered timeline of messages, sections, notes. */
  this.events = [];

  /** Whether to repeat participant boxes at the diagram bottom. */
  this.showBottomBoxes = false;

  /** Computed canvas width after layout. */
  this.width = 80;

  /** Computed canvas height after layout. */
  this.height = 24;

  /** @private Next unique ID for events. */
  this._nextId = 1;
}

/**
 * Add a participant (actor / component) to the diagram.
 *
 * @param {string} id    - Unique participant identifier.
 * @param {string} label - Display text.
 * @param {string} [borderStyle] - Border charset name.
 * @returns {Object} The created participant.
 */
SequenceModel.prototype.addParticipant = function addParticipant(id, label, borderStyle) {
  var p = entities.createParticipant(id, label, borderStyle);
  this.participants.push(p);
  return p;
};

/**
 * Add a message (arrow) between two participants.
 *
 * @param {string} from  - Source participant ID.
 * @param {string} to    - Destination participant ID.
 * @param {string} label - Arrow label text.
 * @param {Object} [opts] - style, arrow, animate options.
 * @returns {Object} The created message.
 */
SequenceModel.prototype.addMessage = function addMessage(from, to, label, opts) {
  var msg = entities.createMessage(this._nextId++, from, to, label, opts);
  this.events.push(msg);
  return msg;
};

/**
 * Add a section separator with a label.
 *
 * @param {string} label - Section heading text.
 * @returns {Object} The created section.
 */
SequenceModel.prototype.addSection = function addSection(label) {
  var sec = entities.createSection(this._nextId++, label);
  this.events.push(sec);
  return sec;
};

/**
 * Add a note near or between lifelines.
 *
 * @param {string} text     - Note content.
 * @param {string} position - NOTE_POSITION value.
 * @param {string} [participantId]  - Primary anchor.
 * @param {string} [participantId2] - Second anchor for 'between'.
 * @returns {Object} The created note.
 */
SequenceModel.prototype.addNote = function addNote(text, position, participantId, participantId2) {
  var note = entities.createNote(this._nextId++, text, position, participantId, participantId2);
  this.events.push(note);
  return note;
};

/**
 * Find a participant by ID.
 *
 * @param {string} id - Participant ID.
 * @returns {Object|null}
 */
SequenceModel.prototype.getParticipant = function getParticipant(id) {
  for (var i = 0; i < this.participants.length; i++) {
    if (this.participants[i].id === id) return this.participants[i];
  }
  return null;
};

module.exports = { SequenceModel: SequenceModel };
