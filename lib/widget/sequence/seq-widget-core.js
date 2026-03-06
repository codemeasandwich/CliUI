'use strict';

/**
 * lib/widget/sequence/seq-widget-core.js
 *
 * Sequence diagram widget constructor and prototype chain.
 * Follows the same CliUI prototypal pattern as the Diagram widget.
 */

var blessed = require('../../blessed');
var Node    = blessed.Node;
var Box     = blessed.Box;

/**
 * Sequence diagram widget constructor.
 *
 * Renders participants as header boxes, vertical lifelines, and
 * horizontal message arrows in a time-flows-downward layout.
 *
 * @param {Object} options - Blessed Box options plus sequence extras.
 * @param {Object}  [options.data]           - Declarative data descriptor.
 * @param {boolean} [options.showBottomBoxes] - Repeat participant boxes at bottom.
 * @param {boolean} [options.animate]        - Enable message animations.
 * @constructor
 */
function Sequence(options) {
  /* Factory guard — allow `Sequence(opts)` without `new`. */
  if (!(this instanceof Node)) {
    return new Sequence(options);
  }

  options = options || {};

  Box.call(this, options);

  /** @private The sequence model after setData(). */
  this._model = null;

  /** @private Animation frame counter. */
  this._animFrame = 0;

  /** @private setInterval timer for animations. */
  this._animTimer = null;

  /** @private Whether animation is enabled. */
  this._animateEnabled = options.animate !== false;

  /** @private Constructor-level showBottomBoxes preference.
   *  Applied to the model in setData() / _deferredInit(). */
  this._showBottomBoxes = !!options.showBottomBoxes;

  /* Deferred init: wait until attached to a screen to process data,
   * because layout depends on widget dimensions. */
  var self = this;
  var opts = options;
  this.on('attach', function onAttach() {
    process.nextTick(function () {
      self._deferredInit(opts);
    });
  });

  /* Clean up timers on detach. */
  this.on('detach', function onDetach() {
    self._stopAnimation();
  });
}

/* Inherit from blessed.Box. */
Sequence.prototype = Object.create(Box.prototype);
Sequence.prototype.constructor = Sequence;
Sequence.prototype.type = 'sequence';

/**
 * Stop the animation timer.
 * @private
 */
Sequence.prototype._stopAnimation = function _stopAnimation() {
  if (this._animTimer) {
    clearInterval(this._animTimer);
    this._animTimer = null;
  }
};

/**
 * Check if the model contains any animated messages.
 *
 * @returns {boolean} True if at least one message has a truthy animate property.
 * @private
 */
Sequence.prototype._hasAnimatedMessages = function _hasAnimatedMessages() {
  if (!this._model) return false;
  for (var i = 0; i < this._model.events.length; i++) {
    var evt = this._model.events[i];
    if (evt.type === 'message' && evt.animate) return true;
  }
  return false;
};

/**
 * Start the animation timer if enabled and the model has animated messages.
 *
 * Increments the frame counter every 150ms (~6-7 fps) and triggers a
 * full re-render so the animation overlay advances.
 *
 * @private
 */
Sequence.prototype._startAnimation = function _startAnimation() {
  if (!this._animateEnabled || this._animTimer) return;
  if (!this._hasAnimatedMessages()) return;

  var self = this;
  this._animTimer = setInterval(function () {
    /* Wrap the counter to avoid Number.MAX_SAFE_INTEGER overflow
     * after ~49 days of continuous animation. 1 000 000 is large
     * enough to prevent visible pattern repetition with any
     * realistic cell count or marker spacing. */
    self._animFrame = (self._animFrame + 1) % 1000000;
    self._fullRender();
  }, 150);
};

module.exports = {
  Sequence: Sequence
};
