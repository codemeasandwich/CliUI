'use strict';

/**
 * lib/widget/diagram/widget-api-transition.js
 *
 * Current-work transition animation patched onto Diagram.prototype.
 *
 * Extracted from widget-api.js to keep that module under 200 NCLOC.
 * Provides transitionCurrentWork() — the animated handoff of the
 * current-work marker from one box to another via a travel dot.
 */

var Diagram         = require('./widget-core').Diagram;
var segmentsToCells = require('./render-animation').segmentsToCells;

// ────────────────────────────────────────────────────────────────────
// § Current-work transition
// ────────────────────────────────────────────────────────────────────

/**
 * Transition current-work from one box to another with a travel-dot
 * animation along the connecting line.
 *
 * The ● dot travels cell-by-cell from the old CW box to the new box
 * at 1 cell per 100ms. During travel, perimeter animation is paused.
 * When the dot arrives, the new box becomes the active CW with
 * orbiting dots.
 *
 * If no connector path exists between the two boxes, the transition
 * falls back to an instant switch (no travel animation).
 *
 * @param {number}   fromBoxId - Box currently marked as current-work.
 * @param {number}   toBoxId   - Box to become the new current-work.
 * @param {Function} [callback] - Called after the transition completes.
 */
Diagram.prototype.transitionCurrentWork = function transitionCurrentWork(fromBoxId, toBoxId, callback) {
  if (!this._model) return;

  var model = this._model;
  var self = this;

  /* Find a connector that links the two boxes. */
  var connector = this._findConnectorBetween(fromBoxId, toBoxId);

  if (!connector || !connector.segments || connector.segments.length === 0) {
    /* No connecting path — fall back to instant switch. */
    model.setCurrentWork(fromBoxId, false);
    model.setCurrentWork(toBoxId, true);
    this._postModelChange();
    this.emit('model:change');
    if (callback) callback();
    return;
  }

  /* Expand segments into cell-by-cell path. */
  var cells = segmentsToCells(connector.segments);

  /*
   * Determine direction: the travel dot should move FROM the old box
   * TOWARD the new box. Check which end of the cell path is closer
   * to the source box and reverse if needed.
   */
  var fromBox = model.getBox(fromBoxId);
  if (fromBox && cells.length > 1) {
    var first = cells[0];
    var last = cells[cells.length - 1];
    /* Distance from the first cell to the centre of the source box. */
    var fromCx = fromBox.x + Math.floor(fromBox.width / 2);
    var fromCy = fromBox.y + Math.floor(fromBox.height / 2);
    var d1 = Math.abs(first.x - fromCx) + Math.abs(first.y - fromCy);
    var d2 = Math.abs(last.x - fromCx) + Math.abs(last.y - fromCy);
    if (d2 < d1) {
      cells.reverse();
    }
  }

  /* Remove CW from old box, render without CW active. */
  model.setCurrentWork(fromBoxId, false);
  this._postModelChange();

  /* Start the travel-dot animation along the connector cells. */
  this._startTravelAnimation(cells, function onTravelComplete() {
    /* Travel finished — activate CW on the destination box. */
    model.setCurrentWork(toBoxId, true);
    self._postModelChange();
    self.emit('model:change');
    if (callback) callback();
  });
};

/**
 * Find a connector that links two boxes (in either direction).
 *
 * Searches through all connectors attached to `boxA` and returns the
 * first one whose other endpoint is on `boxB`.
 *
 * @param {number} boxA - First box ID.
 * @param {number} boxB - Second box ID.
 * @returns {import('./diagram-model').DiagramConnector|null}
 * @private
 */
Diagram.prototype._findConnectorBetween = function _findConnectorBetween(boxA, boxB) {
  var model = this._model;
  if (!model) return null;

  var conns = model.getConnectorsForBox(boxA);
  for (var i = 0; i < conns.length; i++) {
    var conn = conns[i];
    /* Resolve the box at the other end via the source and dest ports. */
    var srcPort = model.ports.get(conn.sourcePortId);
    var dstPort = model.ports.get(conn.destPortId);
    if (!srcPort || !dstPort) continue;

    if ((srcPort.boxId === boxA && dstPort.boxId === boxB) ||
        (srcPort.boxId === boxB && dstPort.boxId === boxA)) {
      return conn;
    }
  }
  return null;
};
