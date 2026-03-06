'use strict';

/**
 * lib/widget/diagram/widget-render-conn-anim.js
 *
 * Connection animation timer management patched onto Diagram.prototype.
 *
 * Extracted from widget-render.js to keep that module under 200 NCLOC.
 * Creates per-connector timers for styled connectors (animated, snake,
 * dashed, spinner) and manages their lifecycle.
 */

var Diagram = require('./widget-core').Diagram;

// ────────────────────────────────────────────────────────────────────
// § Connection animation timers
// ────────────────────────────────────────────────────────────────────

/**
 * Set up per-connector animation timers for styled connectors.
 *
 * Iterates all connectors in the model and creates a timer for each
 * that has an animated style (animated, snake, dashed, spinner).
 * Each timer increments the per-connector frame counter and triggers
 * an incremental re-render.
 *
 * @private
 */
Diagram.prototype._setupConnAnimations = function _setupConnAnimations() {
  /* Clear any existing timers first to prevent leaks on re-setData. */
  this._clearConnAnimations();

  if (!this._model) return;

  var self = this;
  var states = new Map();

  this._model.connectors.forEach(function (conn) {
    if (!conn.style || conn.style === 'static') return;

    var speed = conn.speed || 150;
    var state = { frame: 0, style: conn.style };

    var timer = setInterval(function connAnimTick() {
      state.frame++;
      if (self._model) self._incrementalRender();
    }, speed);

    /* Allow process to exit even while animation timers run. */
    if (timer && typeof timer.unref === 'function') timer.unref();

    state.timer = timer;
    states.set(conn.id, state);
  });

  this._connAnimStates = states.size > 0 ? states : null;
};

/**
 * Clear all connection animation timers.
 *
 * Safe to call when no animations are active (no-op).
 *
 * @private
 */
Diagram.prototype._clearConnAnimations = function _clearConnAnimations() {
  if (!this._connAnimStates) return;

  this._connAnimStates.forEach(function (state) {
    if (state.timer) clearInterval(state.timer);
  });
  this._connAnimStates = null;
};
