'use strict';

/**
 * lib/widget/diagram/widget-render-travel.js
 *
 * Travel-dot animation timer management patched onto Diagram.prototype.
 *
 * Extracted from widget-render.js to keep that module under 200 NCLOC.
 * Manages the cell-by-cell travel dot animation that plays when
 * current-work transitions between boxes via transitionCurrentWork().
 */

var Diagram = require('./widget-core').Diagram;

/** Travel dot interval: 1 cell every 100ms as specified. */
var TRAVEL_INTERVAL_MS = 100;

// ────────────────────────────────────────────────────────────────────
// § Travel animation (connector dot transition)
// ────────────────────────────────────────────────────────────────────

/**
 * Start a travel-dot animation along a pre-computed cell path.
 *
 * Pauses the normal perimeter animation while the dot is in flight.
 * Advances the dot by one cell every 100ms via a dedicated interval.
 * When the dot reaches the end of the path, calls `onComplete` and
 * resumes normal animation management via `_postModelChange`.
 *
 * @param {Array<{x: number, y: number}>} cells - Ordered cell path.
 * @param {Function} onComplete - Called when travel reaches the end.
 * @private
 */
Diagram.prototype._startTravelAnimation = function _startTravelAnimation(cells, onComplete) {
  /* Cancel any existing travel animation to prevent overlapping timers. */
  this._stopTravelAnimation();

  /* Pause the perimeter dot animation during travel. */
  this._stopAnimation();

  this._travelState = {
    cells: cells,
    cellIdx: 0,
    timer: null,
    onComplete: onComplete || null
  };

  var self = this;
  this._travelState.timer = setInterval(function travelTick() {
    if (!self._travelState) return;

    self._travelState.cellIdx += 1;

    /* Check if the dot has reached the end of the path. */
    if (self._travelState.cellIdx >= self._travelState.cells.length) {
      var cb = self._travelState.onComplete;
      self._stopTravelAnimation();
      if (cb) cb();
      return;
    }

    /* Render the updated dot position. */
    self._incrementalRender();
  }, TRAVEL_INTERVAL_MS);

  /* Allow process to exit even if travel timer is running. */
  if (this._travelState.timer && typeof this._travelState.timer.unref === 'function') {
    this._travelState.timer.unref();
  }

  /* Render the initial dot position (cellIdx = 0). */
  this._incrementalRender();
};

/**
 * Stop an active travel-dot animation and clean up state.
 *
 * Safe to call when no travel animation is active (no-op).
 *
 * @private
 */
Diagram.prototype._stopTravelAnimation = function _stopTravelAnimation() {
  if (!this._travelState) return;

  if (this._travelState.timer) {
    clearInterval(this._travelState.timer);
  }
  this._travelState = null;
};
