'use strict';

/**
 * lib/widget/sequence/seq-widget-render.js
 *
 * Render pipeline patched onto Sequence.prototype.
 * Handles full rendering from model → ASCII text → blessed content.
 */

var Sequence  = require('./seq-widget-core').Sequence;
var renderSeq = require('./seq-renderer').render;

/**
 * Render the model to ASCII, set widget content, request repaint.
 *
 * @private
 */
Sequence.prototype._fullRender = function _fullRender() {
  if (!this._model) return;

  var viewW = Math.max(this.width  - this.ileft - this.iright, 20);
  var viewH = Math.max(this.height - this.itop  - this.ibottom, 10);

  var text = renderSeq(this._model, {
    viewWidth: viewW,
    viewHeight: viewH,
    frame: this._animFrame
  });

  this.setContent(text);

  if (this.screen) {
    this.screen.render();
  }
};

/**
 * Override blessed's render to ensure content is up-to-date.
 *
 * @returns {Object} Blessed render coordinates.
 */
Sequence.prototype.render = function renderOverride() {
  if (this._model && !this.getContent()) {
    this._fullRender();
  }

  /* Guard: ensure all child elements have _clines initialised. */
  var children = this.children || [];
  for (var i = 0; i < children.length; i++) {
    if (children[i]._clines == null) {
      children[i].parseContent();
    }
    if (children[i]._clines == null) {
      var empty = [];
      empty.width = 0;
      empty.content = '';
      empty.mwidth = 0;
      empty.attr = [];
      empty.ci = [];
      children[i]._clines = empty;
    }
  }

  return this._render();
};
