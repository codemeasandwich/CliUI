'use strict';

/**
 * lib/widget/diagram/grid-stamp-box.js
 *
 * Prototype patches: stamp (orchestrator), _stampBox, _stampLabel.
 */

var CELL_TYPE      = require('./grid-constants').CELL_TYPE;
var OccupancyGrid  = require('./grid-core').OccupancyGrid;

/**
 * Rebuild the entire grid from a model snapshot.
 *
 * Stamp order matters:  boxes first (so their borders and content
 * establish the obstacle field), then connectors (which route around
 * those obstacles), then labels (placed in remaining free space).
 *
 * This method does NOT call the router — it stamps whatever segments
 * are already stored in each connector.
 *
 * @param {import('./diagram-model').DiagramModel} model
 * @param {Object} charsets - Resolved character sets.
 */
OccupancyGrid.prototype.stamp = function stamp(model, charsets) {
  this.clear();

  var light = charsets.light;
  var cw    = charsets.currentWork;
  var conn  = charsets.connector;

  /* 1. Stamp boxes */
  for (var _b of model.boxes) {
    this._stampBox(_b[1], _b[1].currentWork ? cw : light, model);
  }

  /* 2. Stamp connectors */
  for (var _c of model.connectors) {
    this._stampConnector(_c[1], conn);
  }

  /* 3. Stamp labels */
  for (var _l of model.labels) {
    this._stampLabel(_l[1]);
  }
};

/**
 * Stamp a single box's border and content into the grid.
 *
 * Border cells are written with CELL_TYPE.BORDER.  Interior text cells
 * are written with CELL_TYPE.CONTENT.  Port cells on the border are
 * written as CELL_TYPE.PORT (or CELL_TYPE.GATE for current-work gate
 * attachments).  Horizontal borders use ╤ (gateH); vertical borders use ╢ (gate).
 *
 * @param {import('./diagram-model').DiagramBox} box
 * @param {Object} charset - Border charset to use.
 * @param {import('./diagram-model').DiagramModel} model
 * @private
 */
OccupancyGrid.prototype._stampBox = function _stampBox(box, charset, model) {
  var id = box.id, x = box.x, y = box.y, w = box.width, h = box.height;
  var text = box.text, checked = box.checked, currentWork = box.currentWork;

  /* Determine which border cells are port/gate locations. */
  var portCells = new Map();
  for (var pi = 0; pi < box.ports.length; pi++) {
    var pos = model.getPortPosition(box.ports[pi].id);
    if (pos) {
      var key = pos.x + ',' + pos.y;
      portCells.set(key, currentWork ? CELL_TYPE.GATE : CELL_TYPE.PORT);
    }
  }

  var borderType = function (bx, by) {
    return portCells.get(bx + ',' + by) || CELL_TYPE.BORDER;
  };
  var gateOrChar = function (bx, by, normalChar, gateChar) {
    if (portCells.has(bx + ',' + by) && currentWork) return gateChar || charset.gate || normalChar;
    return normalChar;
  };

  /* ── Top border ─────────────────────────────────────────── */
  if (this.inBounds(x, y)) {
    this.set(x, y, borderType(x, y), id, charset.topLeft);
  }
  for (var c = 1; c < w - 1; c++) {
    var bx = x + c;
    if (this.inBounds(bx, y)) {
      this.set(bx, y, borderType(bx, y), id, gateOrChar(bx, y, charset.horizontal, charset.gateH));
    }
  }
  if (this.inBounds(x + w - 1, y)) {
    this.set(x + w - 1, y, borderType(x + w - 1, y), id, charset.topRight);
  }

  /* ── Bottom border ──────────────────────────────────────── */
  var by2 = y + h - 1;
  if (this.inBounds(x, by2)) {
    this.set(x, by2, borderType(x, by2), id, charset.bottomLeft);
  }
  for (var c2 = 1; c2 < w - 1; c2++) {
    var bx2 = x + c2;
    if (this.inBounds(bx2, by2)) {
      this.set(bx2, by2, borderType(bx2, by2), id, gateOrChar(bx2, by2, charset.horizontal, charset.gateH));
    }
  }
  if (this.inBounds(x + w - 1, by2)) {
    this.set(x + w - 1, by2, borderType(x + w - 1, by2), id, charset.bottomRight);
  }

  /* ── Left and Right borders ─────────────────────────────── */
  for (var r = 1; r < h - 1; r++) {
    var ry = y + r;
    if (this.inBounds(x, ry)) {
      this.set(x, ry, borderType(x, ry), id, gateOrChar(x, ry, charset.vertical));
    }
    if (this.inBounds(x + w - 1, ry)) {
      this.set(x + w - 1, ry, borderType(x + w - 1, ry), id,
        gateOrChar(x + w - 1, ry, charset.vertical));
    }
  }

  /* ── Interior content ───────────────────────────────────── */
  var innerW = w - 2;
  var innerH = h - 2;
  if (innerW <= 0 || innerH <= 0) return;

  var contentText = text || '';
  if (checked) {
    contentText = '\u2714 ' + contentText; // ✔ prefix
  }
  var rawLines = contentText.split('\n');

  /* Simple word-wrap / clip — hard wrap at innerW. */
  var displayLines = [];
  for (var ri = 0; ri < rawLines.length; ri++) {
    var raw = rawLines[ri];
    if (raw.length <= innerW) {
      displayLines.push(raw);
    } else {
      for (var i = 0; i < raw.length; i += innerW) {
        displayLines.push(raw.substring(i, i + innerW));
      }
    }
    if (displayLines.length >= innerH) break;
  }

  /* Write content characters into the grid. */
  for (var row = 0; row < innerH; row++) {
    var line = displayLines[row] || '';
    for (var col = 0; col < innerW; col++) {
      var cx = x + 1 + col;
      var cy = y + 1 + row;
      var ch = col < line.length ? line[col] : ' ';
      if (this.inBounds(cx, cy)) {
        this.set(cx, cy, CELL_TYPE.CONTENT, id, ch);
      }
    }
  }
};

/**
 * Stamp a label's characters into the grid.
 *
 * Each character overwrites its cell only if the cell is currently
 * EMPTY — prevents labels from corrupting borders or connectors.
 *
 * @param {import('./diagram-model').DiagramLabel} label
 * @private
 */
OccupancyGrid.prototype._stampLabel = function _stampLabel(label) {
  for (var i = 0; i < label.text.length; i++) {
    var lx = label.x + i;
    var ly = label.y;
    if (this.inBounds(lx, ly) && this.isEmpty(lx, ly)) {
      this.set(lx, ly, CELL_TYPE.LABEL, label.id, label.text[i]);
    }
  }
};
