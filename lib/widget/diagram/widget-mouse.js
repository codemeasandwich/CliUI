'use strict';

/**
 * lib/widget/diagram/widget-mouse.js
 *
 * Click and double-click handling patched onto Diagram.prototype.
 */

var Diagram        = require('./widget-core').Diagram;
var DOUBLE_CLICK_MS = require('./widget-core').DOUBLE_CLICK_MS;
var hitTest        = require('./diagram-hit-test').hitTest;
var HIT_KIND       = require('./diagram-hit-test').HIT_KIND;

// ────────────────────────────────────────────────────────────────────
// § Mouse — click / double-click
// ────────────────────────────────────────────────────────────────────

/**
 * Bind click and double-click mouse handlers.
 *
 * Also ensures the screen has mouse tracking enabled.
 *
 * @private
 */
Diagram.prototype._bindMouse = function _bindMouse() {
  var self = this;

  /*
   * Ensure the screen has mouse tracking enabled.
   * Explicitly registering now guarantees xterm mouse escape
   * sequences are active before the user clicks or drags.
   */
  if (this.screen) {
    this.screen._listenMouse(this);
  }

  /* ── Click / double-click ──────────────────────────────────── */
  this.on('click', function onClick(mouse) {
    if (!self._model || !self._grid) return;

    var pos = self._mouseToLocal(mouse);
    if (!pos) return;

    var hit = hitTest(pos.x, pos.y, self._grid, self._model);

    /* Double-click detection (must match both entity id AND kind). */
    var now = Date.now();
    if (now - self._lastClickTime < DOUBLE_CLICK_MS
        && hit.id === self._lastClickId
        && hit.kind === self._lastClickKind) {
      self._handleDoubleClick(hit);
      self._lastClickTime = 0;
      self._lastClickId = null;
      self._lastClickKind = null;
      return;
    }
    self._lastClickTime = now;
    self._lastClickId = hit.id;
    self._lastClickKind = hit.kind;

    /* Emit typed click events. */
    self._emitClickEvent(hit);
  });
};

// ────────────────────────────────────────────────────────────────────
// § Coordinate conversion
// ────────────────────────────────────────────────────────────────────

/**
 * Convert a blessed mouse event to diagram-local coordinates.
 *
 * @param {{ x: number, y: number }} mouse
 * @returns {{ x: number, y: number }|null}
 * @private
 */
Diagram.prototype._mouseToLocal = function _mouseToLocal(mouse) {
  var oX = (this.aleft || 0) + this.ileft;
  var oY = (this.atop  || 0) + this.itop;
  var lx = mouse.x - oX;
  var ly = mouse.y - oY;

  if (lx < 0 || ly < 0) return null;
  return { x: lx, y: ly };
};

// ────────────────────────────────────────────────────────────────────
// § Click dispatch
// ────────────────────────────────────────────────────────────────────

/**
 * Emit a typed click event based on the hit result.
 *
 * @param {import('./diagram-hit-test').HitResult} hit
 * @private
 */
Diagram.prototype._emitClickEvent = function _emitClickEvent(hit) {
  switch (hit.kind) {
    case HIT_KIND.BOX_INTERIOR:
    case HIT_KIND.BOX_BORDER:
      this.emit('box:click', { boxId: hit.id, hit: hit });
      break;
    case HIT_KIND.GATE:
      this.emit('gate:click', { boxId: hit.id, portId: hit.portId, hit: hit });
      break;
    case HIT_KIND.PORT:
      this.emit('gate:click', { boxId: hit.id, portId: hit.portId, hit: hit });
      break;
    case HIT_KIND.CONNECTOR:
    case HIT_KIND.JUNCTION:
    case HIT_KIND.ARROW:
      this.emit('connector:click', { connectorId: hit.id, hit: hit });
      break;
    case HIT_KIND.LABEL:
      this.emit('label:click', { labelId: hit.id, hit: hit });
      break;
    default:
      break;
  }
};

// ────────────────────────────────────────────────────────────────────
// § Double-click
// ────────────────────────────────────────────────────────────────────

/**
 * Handle a double-click on a diagram entity.
 * Default behaviour: toggle checked on boxes.
 *
 * @param {import('./diagram-hit-test').HitResult} hit
 * @private
 */
Diagram.prototype._handleDoubleClick = function _handleDoubleClick(hit) {
  var self = this;

  if (hit.kind === HIT_KIND.BOX_INTERIOR || hit.kind === HIT_KIND.BOX_BORDER) {
    this.toggleChecked(hit.id);
    this.emit('box:dblclick', { boxId: hit.id, hit: hit });
  } else if (hit.kind === HIT_KIND.LABEL) {
    this.emit('label:dblclick', { labelId: hit.id, hit: hit });
    /* Defer to nextTick so blessed's "element click" auto-focus on the
       diagram widget finishes before the textbox grabs focus. */
    process.nextTick(function () { self.editLabel(hit.id, hit); });
  } else if (hit.kind === HIT_KIND.CONNECTOR || hit.kind === HIT_KIND.JUNCTION || hit.kind === HIT_KIND.ARROW) {
    process.nextTick(function () { self.editConnectorLabel(hit.id, hit); });
  }
};
