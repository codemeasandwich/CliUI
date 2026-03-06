'use strict';

/**
 * lib/widget/diagram/render-box.js
 *
 * Renders a single diagram box (border, content, gates) into a CharBuffer.
 */

var CHARSETS        = require('../../border/charsets').CHARSETS;
var resolveCharset  = require('../../border/charsets').resolveCharset;
var CELL_TYPE       = require('./occupancy-grid').CELL_TYPE;

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

  /*
   * Resolve the charset for this box:
   *   1. currentWork → always use the currentWork charset (animated border)
   *   2. box.borderStyle → use the named charset (heavy, double, etc.)
   *   3. fallback → light charset (default)
   */
  var cs = currentWork
    ? CHARSETS.currentWork
    : resolveCharset(box.borderStyle ? { charset: box.borderStyle } : null);

  /* Build a set of port cells for gate rendering. */
  var portPositions = new Map();
  for (var pi = 0; pi < box.ports.length; pi++) {
    var pos = model.getPortPosition(box.ports[pi].id);
    if (pos) {
      portPositions.set(pos.x + ',' + pos.y, box.ports[pi]);
    }
  }

  /*
   * Determine the character for a border cell, applying gate precedence.
   *
   * Gate characters (╟ for vertical sides, ╤ for horizontal) replace
   * normal border characters at port positions on current-work boxes.
   * This visual indicator marks connection attachment points on animated
   * borders. Non-current-work boxes skip gate rendering — their tee
   * characters are handled by render-port-tees.js instead.
   *
   * @param {number} bx - Border cell X in model coords.
   * @param {number} by - Border cell Y in model coords.
   * @param {string} base - Default border character (horizontal/vertical).
   * @param {string} [gateChar] - Override character for gate positions.
   * @returns {string} The resolved character.
   */
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

/**
 * Map STATUS enum values to blessed foreground colour codes.
 *
 * These values are written into the attribute word (bits 9-17) of
 * each border cell in the screen buffer.  The exact bit layout
 * matches blessed's internal `sattr()` format.
 *
 * @type {Record<string, number>}
 */
var STATUS_FG = {
  success: 2,  /* green  */
  error:   1,  /* red    */
  pending: 3   /* yellow */
};

/**
 * Apply a status foreground colour to a box's border cells in the
 * blessed screen line buffer.
 *
 * Iterates the perimeter of the box geometry and writes the colour
 * attribute into `screen.lines[row][col][0]`.  The attribute word
 * format is: `(attr & ~(0x1ff << 9)) | (fg << 9)`.
 *
 * Must be called after `this.setContent(text)` and after blessed has
 * written the content into the screen buffer (i.e. after screen.render
 * or during the render pass when lpos is available).
 *
 * @param {import('./model-entities').DiagramBox} box - Box with status.
 * @param {Object} screenLines - blessed `screen.lines` array.
 * @param {number} xi - Left edge of widget content area in screen coords.
 * @param {number} yi - Top edge of widget content area in screen coords.
 * @param {number} panX - Current viewport X offset.
 * @param {number} panY - Current viewport Y offset.
 */
function applyStatusStyle(box, screenLines, xi, yi, panX, panY) {
  var fg = STATUS_FG[box.status];
  if (fg == null) return;

  var x = box.x, y = box.y, w = box.width, h = box.height;

  /* Iterate all border cells (top, bottom, left, right edges). */
  for (var c = 0; c < w; c++) {
    writeFg(screenLines, yi + y - panY, xi + x + c - panX, fg);            /* top */
    writeFg(screenLines, yi + y + h - 1 - panY, xi + x + c - panX, fg);    /* bottom */
  }
  for (var r = 1; r < h - 1; r++) {
    writeFg(screenLines, yi + y + r - panY, xi + x - panX, fg);            /* left */
    writeFg(screenLines, yi + y + r - panY, xi + x + w - 1 - panX, fg);    /* right */
  }
}

/**
 * Write a foreground colour into a single screen buffer cell.
 *
 * @param {Object} lines - blessed screen.lines array.
 * @param {number} row   - Screen row.
 * @param {number} col   - Screen column.
 * @param {number} fg    - Foreground colour code (0-255).
 */
function writeFg(lines, row, col, fg) {
  if (row < 0 || row >= lines.length) return;
  var line = lines[row];
  if (!line || col < 0 || col >= line.length) return;
  /* Blessed attr format: bits 9-17 = fg colour. */
  line[col][0] = (line[col][0] & ~(0x1ff << 9)) | (fg << 9);
  line.dirty = true;
}

module.exports = {
  renderBox: renderBox,
  applyStatusStyle: applyStatusStyle,
  STATUS_FG: STATUS_FG
};
