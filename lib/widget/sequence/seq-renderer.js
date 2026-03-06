'use strict';

/**
 * lib/widget/sequence/seq-renderer.js
 *
 * Render orchestrator for the sequence diagram.
 * Creates a CharBuffer, then calls each sub-renderer in order:
 *   1. Participant header boxes (top)
 *   2. Messages (arrows with labels)
 *   3. Sections (separator lines)
 *   4. Notes (bordered text boxes)
 *   5. Lifelines (dashed vertical lines — rendered last so messages
 *      take priority, but before animation overlay)
 *   6. Message animation overlays (optional — dot/snake/stream)
 *   7. Bottom participant boxes (optional)
 */

var CharBuffer                = require('../diagram/render-buffer').CharBuffer;
var renderParticipantBoxes    = require('./seq-render-participant').renderParticipantBoxes;
var BOX_HEIGHT                = require('./seq-render-participant').BOX_HEIGHT;
var renderLifelines           = require('./seq-render-lifeline').renderLifelines;
var renderMessages            = require('./seq-render-message').renderMessages;
var renderSections            = require('./seq-render-section').renderSections;
var renderNotes               = require('./seq-render-note').renderNotes;
var overlayMessageAnimations  = require('./seq-animation').overlayMessageAnimations;

/**
 * Render a laid-out SequenceModel to ASCII text.
 *
 * @param {import('./seq-model').SequenceModel} model - Laid-out model.
 * @param {Object}  [options]
 * @param {number}  [options.panX]       - Viewport X offset.
 * @param {number}  [options.panY]       - Viewport Y offset.
 * @param {number}  [options.viewWidth]  - Viewport width.
 * @param {number}  [options.viewHeight] - Viewport height.
 * @param {number}  [options.frame]      - Animation frame counter (omit for static).
 * @returns {string} The rendered ASCII text.
 */
function render(model, options) {
  var opts  = options || {};
  var panX  = opts.panX  || 0;
  var panY  = opts.panY  || 0;
  var viewW = opts.viewWidth  || model.width;
  var viewH = opts.viewHeight || model.height;

  var buf = new CharBuffer(viewW, viewH, panX, panY);

  /* 1. Top participant boxes. */
  renderParticipantBoxes(model.participants, buf, 0);

  /* 2. Messages (arrows with labels). */
  renderMessages(model, buf);

  /* 3. Sections (separator lines with centered labels). */
  renderSections(model, buf);

  /* 4. Notes (bordered text boxes near lifelines). */
  renderNotes(model, buf);

  /* 5. Lifelines (dashed vertical lines — drawn after messages/notes
   *    so those elements take visual priority at intersection points). */
  var lifelineStart = BOX_HEIGHT;
  var lifelineEnd = model.showBottomBoxes
    ? model.height - BOX_HEIGHT - 2
    : model.height - 2;
  renderLifelines(model.participants, buf, lifelineStart, lifelineEnd);

  /* 6. Message animation overlays (optional — dot/snake/stream effects). */
  if (opts.frame != null) {
    overlayMessageAnimations(model, buf, opts.frame);
  }

  /* 7. Bottom participant boxes (if enabled). */
  if (model.showBottomBoxes) {
    var bottomY = model.height - BOX_HEIGHT - 1;
    renderParticipantBoxes(model.participants, buf, bottomY);
  }

  return buf.toString();
}

module.exports = { render: render };
