'use strict';

/**
 * lib/widget/diagram/widget-drag.js
 *
 * Drag state machine patched onto Diagram.prototype.
 *
 * Two drag modes:
 *   1. **Box drag** — mousedown on a box starts a box drag.
 *      Screen-level mouse events track movement; mouseup ends it.
 *   2. **Pan drag** — mousedown on empty space starts a viewport
 *      pan. Cursor delta shifts _panX/_panY in the opposite
 *      direction (standard pan convention); mouseup ends it.
 */

var Diagram        = require('./widget-core').Diagram;
var hitTest        = require('./diagram-hit-test').hitTest;
var HIT_KIND       = require('./diagram-hit-test').HIT_KIND;
var rerouteAffected = require('./diagram-router').rerouteAffected;

// ────────────────────────────────────────────────────────────────────
// § Mouse — drag (box drag + viewport pan)
// ────────────────────────────────────────────────────────────────────

/**
 * Bind drag handlers.
 *
 * Uses the same pattern as blessed's built-in `enableDrag()`:
 * capture mousedown on the element, then track via
 * `onScreenEvent('mouse')` which receives ALL mouse data
 * regardless of cursor position.
 *
 * @private
 */
Diagram.prototype._bindDrag = function _bindDrag() {
  var self = this;

  /* ── mousedown starts drag ──────────────────────────────────── */
  this.on('mousedown', function onMouseDown(mouse) {
    if (!self._model || !self._grid) return;

    /*
     * Guard: skip when a drag or pan is already active.
     *
     * On Windows (and other non-VTE terminals) SGR drag-motion
     * events arrive with action='mousedown' rather than 'mousemove'.
     * Without this guard every motion tick resets _dragLast.
     */
    if (self._dragBoxId != null || self._isPanning) return;

    var pos = self._mouseToLocal(mouse);
    if (!pos) return;

    var hit = hitTest(pos.x, pos.y, self._grid, self._model);

    /*
     * Box interior or border → start box drag.
     * Gates, connectors, and labels are not draggable.
     */
    if (hit.kind === HIT_KIND.BOX_INTERIOR || hit.kind === HIT_KIND.BOX_BORDER) {
      self._dragBoxId = hit.id;
      self._dragLast = pos;
      self.emit('drag:start', { boxId: hit.id, x: pos.x, y: pos.y });
      return;
    }

    /*
     * Empty space → start viewport pan drag.
     * Screen-local coords (without pan offset) are used for delta
     * calculation so the pan direction is correct.
     */
    if (hit.kind === HIT_KIND.EMPTY) {
      self._isPanning = true;
      self._panLast = self._mouseToScreen(mouse);
    }
  });

  /* ── screen-level mouse: drag move + drag end ───────────────── */
  this.onScreenEvent('mouse', function onScreenMouse(mouse) {
    /* ── mousemove while panning ───────────────────────────────── */
    if (mouse.action === 'mousemove' || mouse.action === 'mousedown') {

      /* Pan-drag: shift viewport in opposite direction of cursor. */
      if (self._isPanning && self._panLast) {
        var screenPos = self._mouseToScreen(mouse);
        if (!screenPos) return;

        var pdx = screenPos.x - self._panLast.x;
        var pdy = screenPos.y - self._panLast.y;
        if (pdx === 0 && pdy === 0) return;

        /* Opposite direction: dragging right reveals content on left. */
        self._panX -= pdx;
        self._panY -= pdy;

        /* Clamp to non-negative model coordinates. */
        if (self._panX < 0) self._panX = 0;
        if (self._panY < 0) self._panY = 0;

        self._panLast = screenPos;
        self._fullRender();
        self.emit('pan', { panX: self._panX, panY: self._panY });
        return;
      }

      /* Box-drag: move the box by the cursor delta. */
      if (self._dragBoxId == null || !self._dragLast) return;

      var pos = self._mouseToLocal(mouse);
      if (!pos) return;

      var dx = pos.x - self._dragLast.x;
      var dy = pos.y - self._dragLast.y;
      if (dx === 0 && dy === 0) return;

      var box = self._model.getBox(self._dragBoxId);
      if (!box) { self._dragBoxId = null; return; }

      /* Clamp so the box doesn't move above/left of the origin. */
      var clampedDx = box.x + dx < 0 ? -box.x : dx;
      var clampedDy = box.y + dy < 0 ? -box.y : dy;
      if (clampedDx === 0 && clampedDy === 0) return;

      self._model.moveBox(self._dragBoxId, clampedDx, clampedDy);

      /* Re-anchor ports so connectors exit from the correct edge. */
      self._model.reanchorPorts(self._dragBoxId);

      self._dragLast = pos;

      /* Incremental reroute — updates connector segments. */
      self._grid = rerouteAffected(self._dragBoxId, self._model);

      /* Stamp labels into grid for hit-testing. */
      self._model.labels.forEach(function (label) {
        self._grid._stampLabel(label);
      });

      /* Reposition labels AFTER reroute so both port-anchored and
         connector-anchored labels have up-to-date position data. */
      self._model.repositionLabelsForBox(self._dragBoxId);

      self._incrementalRender();

      self.emit('drag:move', { boxId: self._dragBoxId, dx: dx, dy: dy });
      return;
    }

    /* ── mouseup ends drag or pan ──────────────────────────────── */
    if (mouse.action === 'mouseup') {
      /* End pan-drag. */
      if (self._isPanning) {
        self._isPanning = false;
        self._panLast = null;
      }

      /* End box-drag. */
      if (self._dragBoxId != null) {
        var boxId = self._dragBoxId;
        self._dragBoxId = null;
        self._dragLast = null;

        /* Full reroute as correctness backstop. */
        self._postModelChange();
        self.emit('drag:end', { boxId: boxId });
        self.emit('model:change');
      }
    }
  });
};
