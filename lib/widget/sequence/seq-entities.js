'use strict';

/**
 * lib/widget/sequence/seq-entities.js
 *
 * Factory functions for sequence diagram entities.
 * Returns plain JSON-serialisable objects (no prototype overhead).
 */

/**
 * Create a participant (actor / component header box).
 *
 * @param {string} id          - Unique participant identifier.
 * @param {string} label       - Display text inside the header box.
 * @param {string} [borderStyle] - Named border charset (light/heavy/double/etc).
 * @returns {Object} Participant entity.
 */
function createParticipant(id, label, borderStyle) {
  return {
    id:          id,
    label:       label || id,
    borderStyle: borderStyle || null,
    /* Computed by layout: */
    x:           0,
    width:       0,
    lifelineX:   0
  };
}

/**
 * Create a message (horizontal arrow between two lifelines).
 *
 * @param {number} id    - Unique message ID.
 * @param {string} from  - Source participant ID.
 * @param {string} to    - Destination participant ID (same as from = self-message).
 * @param {string} label - Text displayed above the arrow.
 * @param {Object} [opts]
 * @param {string} [opts.style]   - MSG_STYLE value.
 * @param {string} [opts.arrow]   - ARROW_TYPE value.
 * @param {string} [opts.animate] - Animation style (animated/snake/dashed/spinner/stream).
 * @param {number} [opts.density] - Stream animation fill fraction (0.0-1.0).
 * @returns {Object} Message entity.
 */
function createMessage(id, from, to, label, opts) {
  var o = opts || {};
  return {
    type:    'message',
    id:      id,
    from:    from,
    to:      to,
    label:   label || '',
    style:   o.style   || 'solid',
    arrow:   o.arrow   || 'filled',
    animate: o.animate || null,
    density: o.density != null ? o.density : null,
    /* Computed by layout: */
    y:       0
  };
}

/**
 * Create a section separator with a centered label.
 *
 * @param {number} id    - Unique section ID.
 * @param {string} label - Section heading text.
 * @returns {Object} Section entity.
 */
function createSection(id, label) {
  return {
    type:  'section',
    id:    id,
    label: label || '',
    /* Computed by layout: */
    y:     0
  };
}

/**
 * Create a note positioned near or between lifelines.
 *
 * @param {number} id     - Unique note ID.
 * @param {string} text   - Note content.
 * @param {string} position - NOTE_POSITION value.
 * @param {string} [participantId]  - Primary anchor participant.
 * @param {string} [participantId2] - Second participant for 'between'.
 * @returns {Object} Note entity.
 */
function createNote(id, text, position, participantId, participantId2) {
  return {
    type:           'note',
    id:             id,
    text:           text || '',
    position:       position || 'over',
    participantId:  participantId || null,
    participantId2: participantId2 || null,
    /* Computed by layout: */
    x:              0,
    y:              0,
    width:          0,
    height:         0
  };
}

module.exports = {
  createParticipant: createParticipant,
  createMessage:     createMessage,
  createSection:     createSection,
  createNote:        createNote
};
