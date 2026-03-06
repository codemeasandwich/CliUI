'use strict';

/**
 * lib/widget/diagram/widget-keyboard.js
 *
 * Keyboard navigation patched onto Diagram.prototype.
 * Follows the same prototype-patching pattern as widget-mouse.js.
 *
 * Provides:
 *   Tab / Shift-Tab   — cycle focus among boxes
 *   Arrow keys        — move focus to a connected box in that direction
 *   Enter / Space     — emit 'action' event on the focused box
 *
 * Focus is indicated visually by a pulsing border effect rendered
 * by the focus-pulse overlay in render-animation.js.
 */

var Diagram = require('./widget-core').Diagram;

/** Focus pulse animation interval in ms (~5 fps). */
var FOCUS_PULSE_INTERVAL = 200;

// ────────────────────────────────────────────────────────────────────
// § Keyboard binding
// ────────────────────────────────────────────────────────────────────

/**
 * Bind keyboard handlers for diagram navigation.
 *
 * Called from `_deferredInit()` when `options.focusable !== false`.
 * Uses blessed's `.key()` API to register key handlers.
 *
 * @private
 */
Diagram.prototype._bindKeyboard = function _bindKeyboard() {
  var self = this;

  /* Tab cycles focus forward through boxes. */
  this.key(['tab'], function () {
    self._cycleFocus(1);
  });

  /* Shift-Tab cycles focus backward. */
  this.key(['S-tab'], function () {
    self._cycleFocus(-1);
  });

  /* Enter/Space emits action on the focused box. */
  this.key(['enter', 'space'], function () {
    self._emitAction();
  });

  /* Arrow keys move focus to a connected box in that direction. */
  this.key(['up'], function () { self._moveFocusByDirection('up'); });
  this.key(['down'], function () { self._moveFocusByDirection('down'); });
  this.key(['left'], function () { self._moveFocusByDirection('left'); });
  this.key(['right'], function () { self._moveFocusByDirection('right'); });
};

// ────────────────────────────────────────────────────────────────────
// § Focus cycling
// ────────────────────────────────────────────────────────────────────

/**
 * Cycle focus forward (dir=1) or backward (dir=-1) through focusable boxes.
 *
 * If no boxes exist, this is a no-op. If no box is currently focused,
 * focuses the first (or last) box.
 *
 * @param {number} dir - +1 for forward, -1 for backward.
 * @private
 */
Diagram.prototype._cycleFocus = function _cycleFocus(dir) {
  if (!this._model || this._focusOrder.length === 0) {
    /* Build focus order from current model if not yet set. */
    this._focusOrder = [];
    if (this._model) {
      var self = this;
      this._model.boxes.forEach(function (box) {
        self._focusOrder.push(box.id);
      });
    }
    if (this._focusOrder.length === 0) return;
  }

  var order = this._focusOrder;
  var currentIdx = -1;

  if (this._focusedBoxId != null) {
    currentIdx = order.indexOf(this._focusedBoxId);
  }

  /* Compute next index, wrapping around. */
  var nextIdx;
  if (currentIdx === -1) {
    nextIdx = dir > 0 ? 0 : order.length - 1;
  } else {
    nextIdx = (currentIdx + dir + order.length) % order.length;
  }

  this._focusedBoxId = order[nextIdx];
  this._startFocusPulse();
  this._fullRender();

  /* Emit focus event with both numeric and string ID. */
  var stringId = this._nodeReverseMap ? this._nodeReverseMap.get(this._focusedBoxId) : null;
  this.emit('focus:box', { boxId: this._focusedBoxId, nodeId: stringId });
};

// ────────────────────────────────────────────────────────────────────
// § Action emission
// ────────────────────────────────────────────────────────────────────

/**
 * Emit an 'action' event for the currently focused box.
 *
 * Provides both the internal numeric ID and the user-defined string
 * ID (from structured data) so consumers can work with either.
 *
 * @private
 */
Diagram.prototype._emitAction = function _emitAction() {
  if (this._focusedBoxId == null) return;
  var stringId = this._nodeReverseMap ? this._nodeReverseMap.get(this._focusedBoxId) : null;
  this.emit('action', { boxId: this._focusedBoxId, nodeId: stringId });
};

// ────────────────────────────────────────────────────────────────────
// § Directional focus movement
// ────────────────────────────────────────────────────────────────────

/**
 * Move focus to a connected box in the given direction.
 *
 * Uses `getConnectorsForBox()` to find connected boxes, then picks
 * the one whose center is closest to the desired direction relative
 * to the currently focused box's center.
 *
 * @param {string} key - 'up', 'down', 'left', 'right'.
 * @private
 */
Diagram.prototype._moveFocusByDirection = function _moveFocusByDirection(key) {
  if (!this._model || this._focusedBoxId == null) return;

  var model = this._model;
  var currentBox = model.getBox(this._focusedBoxId);
  if (!currentBox) return;

  /* Compute center of current box. */
  var cx = currentBox.x + currentBox.width / 2;
  var cy = currentBox.y + currentBox.height / 2;

  /* Gather connected box IDs. */
  var conns = model.getConnectorsForBox(this._focusedBoxId);
  var candidates = [];
  for (var i = 0; i < conns.length; i++) {
    var conn = conns[i];
    var srcPort = model.getPort(conn.sourcePortId);
    var dstPort = model.getPort(conn.destPortId);
    if (!srcPort || !dstPort) continue;

    var otherBoxId = srcPort.boxId === this._focusedBoxId ? dstPort.boxId : srcPort.boxId;
    var otherBox = model.getBox(otherBoxId);
    if (!otherBox) continue;

    var ox = otherBox.x + otherBox.width / 2;
    var oy = otherBox.y + otherBox.height / 2;
    var dx = ox - cx;
    var dy = oy - cy;

    /* Filter by direction: only consider boxes that are in the
     * specified direction relative to the current box. */
    var valid = false;
    switch (key) {
      case 'up':    valid = dy < 0; break;
      case 'down':  valid = dy > 0; break;
      case 'left':  valid = dx < 0; break;
      case 'right': valid = dx > 0; break;
    }
    if (!valid) continue;

    var dist = Math.abs(dx) + Math.abs(dy);
    candidates.push({ boxId: otherBoxId, dist: dist });
  }

  if (candidates.length === 0) return;

  /* Pick the nearest candidate. */
  candidates.sort(function (a, b) { return a.dist - b.dist; });
  this._focusedBoxId = candidates[0].boxId;
  this._startFocusPulse();
  this._fullRender();

  var stringId = this._nodeReverseMap ? this._nodeReverseMap.get(this._focusedBoxId) : null;
  this.emit('focus:box', { boxId: this._focusedBoxId, nodeId: stringId });
};

// ────────────────────────────────────────────────────────────────────
// § Focus pulse animation
// ────────────────────────────────────────────────────────────────────

/**
 * Start the focus pulse animation timer.
 *
 * Increments `_focusPulseFrame` at a fixed interval and triggers
 * an incremental re-render to update the pulse overlay.
 *
 * @private
 */
Diagram.prototype._startFocusPulse = function _startFocusPulse() {
  if (this._focusPulseTimer) return;
  var self = this;
  this._focusPulseFrame = 0;
  this._focusPulseTimer = setInterval(function () {
    self._focusPulseFrame++;
    if (self._model) self._incrementalRender();
  }, FOCUS_PULSE_INTERVAL);

  /* Allow process to exit even while the focus pulse timer runs. */
  if (this._focusPulseTimer && typeof this._focusPulseTimer.unref === 'function') {
    this._focusPulseTimer.unref();
  }
};

/**
 * Stop the focus pulse animation and clear the timer.
 *
 * @private
 */
Diagram.prototype._stopFocusPulse = function _stopFocusPulse() {
  if (this._focusPulseTimer) {
    clearInterval(this._focusPulseTimer);
    this._focusPulseTimer = null;
  }
  this._focusPulseFrame = 0;
};

module.exports = { FOCUS_PULSE_INTERVAL: FOCUS_PULSE_INTERVAL };
