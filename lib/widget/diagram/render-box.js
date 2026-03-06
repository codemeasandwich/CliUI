'use strict';

/**
 * lib/widget/diagram/render-box.js
 *
 * Renders a single diagram box (border, content, gates) into a CharBuffer.
 */

var CHARSETS   = require('../../border/charsets').CHARSETS;
var CELL_TYPE  = require('./occupancy-grid').CELL_TYPE;

/**
 * Render a single box into the character buffer.
 *
 * Draws the border using the appropriate charset (light for standard
 * boxes, currentWork for current-work boxes), fills interior content,
 * and marks gate cells (╢ / ╤) where ports exist on current-work borders.
 *
 * @param {import('./diagram-model').DiagramBox} box - Box to render.
 * @param {import('./diagram-model').DiagramModel} model - For port lookup.
 * @param {import('./render-buffer').CharBuffer} buf  - Target buffer.
 * @param {import('./occupancy-grid').OccupancyGrid} grid - For collision tracking.
 */
function renderBox(box, model, buf, grid) {
  var id = box.id, x = box.x, y = box.y, w = box.width, h = box.height;
  var text = box.text, checked = box.checked, currentWork = box.currentWork;
  var cs = currentWork ? CHARSETS.currentWork : CHARSETS.light;

  /* Build a set of port cells for gate rendering. */
  var portPositions = new Map();
  for (var pi = 0; pi < box.ports.length; pi++) {
    var pos = model.getPortPosition(box.ports[pi].id);
    if (pos) {
      portPositions.set(pos.x + ',' + pos.y, box.ports[pi]);
    }
  }

  var borderChar = function (bx, by, base, gateChar) {
    var key = bx + ',' + by;
    if (portPositions.has(key) && currentWork) {
      return gateChar || cs.gate;
    }
    return base;
  };

  /* ── Top border ─────────────────────────────────────────────── */
  buf.put(x, y, cs.topLeft);
  grid.set(x, y, CELL_TYPE.BORDER, id, cs.topLeft);
  for (var c = 1; c < w - 1; c++) {
    var ch = borderChar(x + c, y, cs.horizontal, cs.gateH);
    buf.put(x + c, y, ch);
    grid.set(x + c, y, portPositions.has((x + c) + ',' + y) ? CELL_TYPE.PORT : CELL_TYPE.BORDER, id, ch);
  }
  buf.put(x + w - 1, y, cs.topRight);
  grid.set(x + w - 1, y, CELL_TYPE.BORDER, id, cs.topRight);

  /* ── Bottom border ──────────────────────────────────────────── */
  var by = y + h - 1;
  buf.put(x, by, cs.bottomLeft);
  grid.set(x, by, CELL_TYPE.BORDER, id, cs.bottomLeft);
  for (var c2 = 1; c2 < w - 1; c2++) {
    var ch2 = borderChar(x + c2, by, cs.horizontal, cs.gateH);
    buf.put(x + c2, by, ch2);
    grid.set(x + c2, by, portPositions.has((x + c2) + ',' + by) ? CELL_TYPE.PORT : CELL_TYPE.BORDER, id, ch2);
  }
  buf.put(x + w - 1, by, cs.bottomRight);
  grid.set(x + w - 1, by, CELL_TYPE.BORDER, id, cs.bottomRight);

  /* ── Left and right borders ─────────────────────────────────── */
  for (var r = 1; r < h - 1; r++) {
    var ry = y + r;
    var lch = borderChar(x, ry, cs.vertical, cs.gate);
    buf.put(x, ry, lch);
    grid.set(x, ry,
      portPositions.has(x + ',' + ry) ? (currentWork ? CELL_TYPE.GATE : CELL_TYPE.PORT) : CELL_TYPE.BORDER,
      id, lch);

    var rch = borderChar(x + w - 1, ry, cs.vertical, cs.gate);
    buf.put(x + w - 1, ry, rch);
    grid.set(x + w - 1, ry,
      portPositions.has((x + w - 1) + ',' + ry) ? (currentWork ? CELL_TYPE.GATE : CELL_TYPE.PORT) : CELL_TYPE.BORDER,
      id, rch);
  }

  /* ── Interior content ───────────────────────────────────────── */
  var innerW = w - 2;
  var innerH = h - 2;
  if (innerW <= 0 || innerH <= 0) return;

  var contentText = text || '';
  if (checked) {
    contentText = '\u2714 ' + contentText;
  }
  var rawLines = contentText.split('\n');
  var displayLines = [];
  for (var li = 0; li < rawLines.length; li++) {
    var raw = rawLines[li];
    if (raw.length <= innerW) {
      displayLines.push(raw);
    } else {
      for (var i = 0; i < raw.length; i += innerW) {
        displayLines.push(raw.substring(i, i + innerW));
      }
    }
    if (displayLines.length >= innerH) break;
  }

  /* Write content cells. */
  for (var row = 0; row < innerH; row++) {
    var line = displayLines[row] || '';
    for (var col = 0; col < innerW; col++) {
      var cx = x + 1 + col;
      var cy = y + 1 + row;
      var cch = col < line.length ? line[col] : ' ';
      buf.put(cx, cy, cch);
      grid.set(cx, cy, CELL_TYPE.CONTENT, id, cch);
    }
  }
}

module.exports = { renderBox: renderBox };
