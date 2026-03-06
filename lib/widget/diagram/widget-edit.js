'use strict';

/**
 * lib/widget/diagram/widget-edit.js
 *
 * Inline text editing for labels and connector line labels.
 *
 * Double-clicking a label or a connector opens a small Textbox overlay
 * at the entity's position.  Pressing Enter commits; Escape cancels.
 * After commit the model is updated and the diagram re-rendered.
 */

var blessed  = require('../../blessed');
var Diagram  = require('./widget-core').Diagram;
var HIT_KIND = require('./diagram-hit-test').HIT_KIND;

// ────────────────────────────────────────────────────────────────────
// § Edit state helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Open an inline Textbox overlay for editing.
 *
 * The editor is centred on `spec.midX / spec.midY` (the connector or
 * label midpoint in diagram-local coordinates).  Content is displayed
 * with 1-space padding on each side; the box expands symmetrically as
 * the user types.
 *
 * The border uses blessed's standard single-line edges (─ │) with
 * double-line corners (╔ ╗ ╚ ╝) and a directional arrow indicator
 * pointing back toward the connector:
 *
 *   ╔──────╗              │╔──────╗
 *   │ text │              │⮜ text │
 *   ╚──⮟──╝              │╚──────╝
 *   ───────── (horiz)     │ (vert)
 *
 * @param {{ midX: number, midY: number, value: string, orientation?: string }} spec
 * @param {function(string|null)} callback - Called with new text or null on cancel.
 * @private
 */
Diagram.prototype._openEditor = function _openEditor(spec, callback) {
  var self = this;

  /* Discard any editor already open. */
  if (this._editBox) {
    this._closeEditor();
  }

  /* Pause animation so re-render ticks don't steal focus. */
  this._editPrevAnim = !!this._animTimer;
  if (this._animTimer) this._stopAnimation();

  /* Absolute origin of the diagram content area on the screen. */
  var originX = (this.aleft || 0) + this.ileft;
  var originY = (this.atop  || 0) + this.itop;

  /* 'h' = horizontal connector → box above, arrow ▼ bottom-centre
     'v' = vertical connector   → box right, arrow ◀ left-centre  */
  var orient = spec.orientation || 'h';

  /* Minimum interior width (so the box isn't tiny when empty). */
  var MIN_INNER = 8;

  /**
   * Compute the box geometry so the editor is centred on the
   * midpoint.  Returns { left, top, width }.
   */
  function computeGeometry(text) {
    /* inner = text + 1-space padding each side */
    var inner = Math.max(text.length + 2, MIN_INNER);
    /* total width = inner + 2 border columns */
    var totalW = inner + 2;
    var halfW  = Math.floor(totalW / 2);

    var left, top;
    if (orient === 'v') {
      /* Vertical connector — box to the right of the line, arrow ⮜
         on left wall points back at the connector.
         Vertically centred on midY; adjacent to the line. */
      left = originX + spec.midX + 1;
      top  = originY + spec.midY - 1;
    } else {
      /* Horizontal connector — box sits 1 row above the line,
         arrow ⮟ on bottom border points down at the connector.
         Horizontally centred on midX. */
      left = originX + spec.midX - halfW;
      top  = originY + spec.midY - 3;  /* 3 rows tall, 1 gap row below */
    }
    return { left: Math.max(left, 0), top: Math.max(top, 0), width: totalW };
  }

  var geom = computeGeometry(spec.value);

  var textbox = blessed.textbox({
    parent: this.screen,
    top:    geom.top,
    left:   geom.left,
    width:  geom.width,
    height: 3,
    border: { type: 'line' },
    padding: { left: 1, right: 1, top: 0, bottom: 0 },
    style: {
      fg: 'white',
      bg: 'blue',
      border: { fg: 'cyan' },
      focus: { fg: 'white', bg: 'blue' }
    },
    inputOnFocus: true,
    keys: true
  });

  this._editBox = textbox;
  textbox.setValue(spec.value);

  /* ── Double-line border + arrow overlay ─────────────────────── */
  /* After blessed paints the standard single-line border (┌─┐│└─┘)
     we overwrite just the four corners with double-line characters
     (╔╗╚╝) and inject the directional arrow indicator (⮟ or ⮜).
     The horizontal ─ and vertical │ edges stay as-is.

     Result:  ╔──────╗
              │ text │
              ╚──⮟──╝  */
  textbox.on('render', function () {
    var lines = self.screen.lines;
    var pos   = textbox.lpos;
    if (!pos || !lines) return;

    var xi = pos.xi, xl = pos.xl, yi = pos.yi, yl = pos.yl;
    var battr = textbox.sattr(textbox.style.border || {});

    /* ── Corners ──────────────────────────────────────────────── */
    if (lines[yi] && lines[yi][xi])       { lines[yi][xi][0]       = battr; lines[yi][xi][1]       = '\u2554'; lines[yi].dirty = true; }       // ╔
    if (lines[yi] && lines[yi][xl - 1])   { lines[yi][xl - 1][0]   = battr; lines[yi][xl - 1][1]   = '\u2557'; lines[yi].dirty = true; }       // ╗
    if (lines[yl - 1] && lines[yl - 1][xi])     { lines[yl - 1][xi][0]     = battr; lines[yl - 1][xi][1]     = '\u255a'; lines[yl - 1].dirty = true; } // ╚
    if (lines[yl - 1] && lines[yl - 1][xl - 1]) { lines[yl - 1][xl - 1][0] = battr; lines[yl - 1][xl - 1][1] = '\u255d'; lines[yl - 1].dirty = true; } // ╝

    /* ── Arrow indicator ──────────────────────────────────────── */
    if (orient === 'v') {
      /* Arrow ⮜ on left wall, vertically centred. */
      var arrowY = yi + 1;
      if (lines[arrowY] && lines[arrowY][xi]) {
        lines[arrowY][xi][0] = battr;
        lines[arrowY][xi][1] = '\u2b9c'; // ⮜
        lines[arrowY].dirty = true;
      }
    } else {
      /* Arrow ⮟ on bottom border, horizontally centred. */
      var arrowX = xi + Math.floor((xl - xi) / 2);
      if (lines[yl - 1] && lines[yl - 1][arrowX]) {
        lines[yl - 1][arrowX][0] = battr;
        lines[yl - 1][arrowX][1] = '\u2b9f'; // ⮟
        lines[yl - 1].dirty = true;
      }
    }
  });

  /* Dynamically resize & re-centre as the user types. */
  textbox.on('keypress', function () {
    process.nextTick(function () {
      if (!self._editBox) return;
      var g = computeGeometry(textbox.value || '');
      textbox.left   = g.left;
      textbox.width  = g.width;
      self.screen.render();
    });
  });

  this.screen.render();

  textbox.readInput(function onDone(err, value) {
    self._closeEditor();

    if (err || value == null) {
      callback(null);
    } else {
      callback(value);
    }
  });
};

/**
 * Tear down the current inline editor overlay.
 *
 * @private
 */
Diagram.prototype._closeEditor = function _closeEditor() {
  if (this._editBox) {
    this._editBox.detach();
    this._editBox.destroy();
    this._editBox = null;
    this.screen.render();
  }
  /* Resume animation if it was running before editing. */
  if (this._editPrevAnim) {
    this._editPrevAnim = false;
    this._startAnimation();
  }
};

// ────────────────────────────────────────────────────────────────────
// § Entity-specific edit entry points
// ────────────────────────────────────────────────────────────────────

/**
 * Return the midpoint and orientation of a connector's longest segment.
 *
 * @param {Object} conn - A connector entity with `.segments`.
 * @returns {{ x: number, y: number, horizontal: boolean }|null}
 * @private
 */
function _connectorMidpoint(conn) {
  if (!conn || !conn.segments || conn.segments.length === 0) return null;
  var best = conn.segments[0], bestLen = 0;
  for (var i = 0; i < conn.segments.length; i++) {
    var s = conn.segments[i];
    var len = Math.abs(s.x2 - s.x1) + Math.abs(s.y2 - s.y1);
    if (len > bestLen) { bestLen = len; best = s; }
  }
  return {
    x: Math.round((best.x1 + best.x2) / 2),
    y: Math.round((best.y1 + best.y2) / 2),
    horizontal: best.y1 === best.y2
  };
}

/**
 * Start editing a label's text inline.
 *
 * The editor is centred on the midpoint of the connector or port
 * the label is anchored to.  If unanchored, it centres on the
 * label's own position.
 *
 * @param {number} labelId
 * @param {import('./diagram-hit-test').HitResult} hit
 */
Diagram.prototype.editLabel = function editLabel(labelId, hit) {
  var self = this;
  var label = this._model ? this._model.getLabel(labelId) : null;
  if (!label) return;

  /* Determine the centre point for the editor. */
  var midX = label.x + Math.floor(label.text.length / 2);
  var midY = label.y;
  var orient = 'h';

  /* If the label is anchored to a connector, use the connector midpoint. */
  if (label.anchorId != null) {
    var conn = this._model.connectors.get(label.anchorId);
    if (conn) {
      var mp = _connectorMidpoint(conn);
      if (mp) { midX = mp.x; midY = mp.y; orient = mp.horizontal ? 'h' : 'v'; }
    }
  }

  this._openEditor(
    { midX: midX, midY: midY, orientation: orient, value: label.text },
    function (newText) {
      if (newText != null && newText !== label.text) {
        label.text = newText;
        self._postModelChange();
        self.emit('label:edit', { labelId: labelId, text: newText });
        self.emit('model:change');
      }
    }
  );
};

/**
 * Start editing a connector's line label inline.
 *
 * The editor is centred on the midpoint of the connector's longest
 * segment.  If the connector has no `lineLabel` yet, an empty string
 * is used as the starting value and a new label entity will be
 * created if the user provides text.
 *
 * @param {number} connectorId
 * @param {import('./diagram-hit-test').HitResult} hit
 */
Diagram.prototype.editConnectorLabel = function editConnectorLabel(connectorId, hit) {
  var self = this;
  var conn = this._model ? this._model.getConnector(connectorId) : null;
  if (!conn) return;

  /* Find existing labels anchored to this connector. */
  var existing = [];
  this._model.labels.forEach(function (label) {
    if (label.anchorId === connectorId) existing.push(label);
  });

  var currentText = '';
  if (existing.length > 0) {
    currentText = existing.map(function (l) { return l.text; }).join(' ');
  } else if (conn.lineLabel) {
    currentText = conn.lineLabel;
  }

  /* Centre the editor on the connector's longest segment midpoint. */
  var mp = _connectorMidpoint(conn);
  var midX = mp ? mp.x : hit.x;
  var midY = mp ? mp.y : hit.y;
  var orient = mp ? (mp.horizontal ? 'h' : 'v') : 'h';

  this._openEditor(
    { midX: midX, midY: midY, orientation: orient, value: currentText },
    function (newText) {
      if (newText == null) return; /* cancelled */

      if (existing.length > 0) {
        /* Update first existing label, remove extras. */
        existing[0].text = newText;
        for (var i = 1; i < existing.length; i++) {
          self._model.removeLabel(existing[i].id);
        }
      } else if (newText.length > 0) {
        /* Create a new label anchored to the connector. */
        var LABEL_TYPE = require('./diagram-model').LABEL_TYPE;
        self._model.addLabel(LABEL_TYPE.LINE, newText, midX, midY - 1, connectorId);
      }

      self._postModelChange();
      self.emit('connector:edit', { connectorId: connectorId, text: newText });
      self.emit('model:change');
    }
  );
};
