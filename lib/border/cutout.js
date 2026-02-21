'use strict';

var blessed = require('../../blessed');
var Element = blessed.Element;
var resolveCharset = require('./charsets').resolveCharset;
var geometry = require('./geometry');
var rightAlign = geometry.rightAlign;
var leftAlign  = geometry.leftAlign;

var VALID_POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

/**
 * setCutout(position, content, style)
 *
 * Attach a text cutout to a corner of a bordered element.
 * The border steps around the cutout text.
 *
 * @param {string} position - one of: top-left, top-right, bottom-left, bottom-right
 * @param {string} content  - text content; \n separates lines
 * @param {object} [style]  - optional { fg: '...' }
 */
Element.prototype.setCutout = function(position, content, style) {
  if (VALID_POSITIONS.indexOf(position) === -1) {
    // Warn and return — do not throw so callers can ignore unknown positions
    if (this.screen && this.screen.log) {
      this.screen.log('setCutout: invalid position "' + position + '"');
    }
    return;
  }

  // Guard: must have a line border
  if (!this.border || this.border.type !== 'line') {
    return;
  }

  // Parse content into lines and compute dimensions
  var lines = (content || '').split('\n');
  var CH = lines.length;
  var CW = 0;
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].length > CW) CW = lines[i].length;
  }

  // Initialise _cutouts map
  if (!this._cutouts) {
    this._cutouts = {};
  }

  this._cutouts[position] = {
    lines: lines,
    width: CW,
    height: CH,
    style: style || null
  };

  // Wrap render() on first cutout (§5.1 hook pattern)
  if (!this._origRender) {
    this._origRender = this.render;
    var self = this;
    this.render = function() {
      var ret = self._origRender.apply(self, arguments);
      if (self._cutouts && Object.keys(self._cutouts).length > 0) {
        self._paintCutouts();
      }
      return ret;
    };
  }

  // Trigger re-render
  if (this.screen) {
    this.screen.render();
  }
};

/**
 * clearCutout(position)
 *
 * Remove a cutout from the given corner.
 */
Element.prototype.clearCutout = function(position) {
  if (this._cutouts) {
    delete this._cutouts[position];
  }
  if (this.screen) {
    this.screen.render();
  }
};

/**
 * getCutoutInner(position)
 *
 * Return absolute screen bounds of the inner tab space for a given corner.
 * Returns null when no cutout is set, CH < 2, or lpos not yet set.
 */
Element.prototype.getCutoutInner = function(position) {
  if (!this._cutouts || !this._cutouts[position]) return null;

  var cutout = this._cutouts[position];
  var CH = cutout.height;
  var CW = cutout.width;

  if (CH < 2) return null;

  if (!this.lpos) return null;

  var pos = this.lpos;
  // Compute aleft, atop, width, height from lpos if not already cached
  var aleft = pos.aleft != null ? pos.aleft : pos.xi;
  var atop  = pos.atop  != null ? pos.atop  : pos.yi;
  var width = pos.width != null ? pos.width : (pos.xl - pos.xi);

  // Per §4.7 table
  // Note: CW is the raw max line length; the spec says "(CW includes the +1 spacer from §4.1)"
  // but the spec geometry table uses CW directly. Using raw CW here as measured.
  var inner = {
    height: CH - 1
  };

  switch (position) {
  case 'top-right':
    inner.top   = atop - CH + 1;
    inner.left  = aleft + CW + 2;
    inner.width = width - CW - 3;
    break;
  case 'top-left':
    inner.top   = atop - CH + 1;
    inner.left  = aleft + 1;
    inner.width = width - CW - 3;
    break;
  case 'bottom-right':
    inner.top   = atop + (pos.height != null ? pos.height : (pos.yl - pos.yi));
    inner.left  = aleft + CW + 2;
    inner.width = width - CW - 3;
    break;
  case 'bottom-left':
    inner.top   = atop + (pos.height != null ? pos.height : (pos.yl - pos.yi));
    inner.left  = aleft + 1;
    inner.width = width - CW - 3;
    break;
  default:
    return null;
  }

  if (inner.width <= 0) return null;

  return inner;
};

/**
 * _paintCutouts()
 *
 * Called after each render(); writes cutout step characters and text
 * directly to screen.lines[].
 */
Element.prototype._paintCutouts = function() {
  var screen = this.screen;
  if (!screen || !screen.lines) return;

  var pos = this.lpos;
  if (!pos) return;

  // Resolve absolute coords from lpos
  var xi = pos.xi;  // absolute left col of element (includes border)
  var xl = pos.xl;  // absolute right col (exclusive)
  var yi = pos.yi;  // absolute top row
  var yl = pos.yl;  // absolute bottom row (exclusive)

  var charset = resolveCharset(this.border);

  // Resolve the fg to use for border-colored characters
  var borderFg = (this.style && this.style.border && this.style.border.fg)
    ? this.style.border.fg
    : null;
  var borderAttr = this.sattr({ fg: borderFg, bg: -1 });

  // Helper: write a single character to screen.lines, preserving bg
  function writeChar(y, x, attr, ch) {
    if (y < 0 || y >= screen.rows) return;
    if (x < 0 || x >= screen.cols) return;
    if (!screen.lines[y] || !screen.lines[y][x]) return;
    screen.lines[y][x][0] = attr;
    screen.lines[y][x][1] = ch;
    screen.lines[y].dirty = true;
  }

  // Helper: write a character using only fg, preserving existing bg bits
  function writeCharFgOnly(y, x, fg, ch) {
    if (y < 0 || y >= screen.rows) return;
    if (x < 0 || x >= screen.cols) return;
    if (!screen.lines[y] || !screen.lines[y][x]) return;
    var existingAttr = screen.lines[y][x][0];
    // Extract bg bits (lower 9 bits) from existing attr, blend with new fg
    var bgBits = existingAttr & 0x1ff;
    var flagBits = existingAttr & (0x3f << 18);
    var fgColor = (typeof fg === 'string')
      ? blessed.colors.convert(fg)
      : (fg != null ? fg : 0x1ff);
    var newAttr = flagBits | (fgColor << 9) | bgBits;
    screen.lines[y][x][0] = newAttr;
    screen.lines[y][x][1] = ch;
    screen.lines[y].dirty = true;
  }

  // Helper: write a horizontal run of chars (border style)
  function writeHoriz(y, x, count, attr, ch) {
    for (var i = 0; i < count; i++) {
      writeChar(y, x + i, attr, ch);
    }
  }

  var cutouts = this._cutouts;

  Object.keys(cutouts).forEach(function(position) {
    var cutout = cutouts[position];
    var lines  = cutout.lines;
    var CW     = cutout.width;
    var CH     = cutout.height;
    var cutoutFg = (cutout.style && cutout.style.fg)
      ? cutout.style.fg
      : borderFg;

    // Element width in chars (including borders)
    var elemWidth  = xl - xi;  // xl is exclusive, so this is total cols

    // Clamp CW so the step doesn't exceed the element width
    var maxCW = elemWidth - 3;  // need at least 1 border char + 1 horiz + 1 corner
    if (maxCW < 0) maxCW = 0;
    var effectiveCW = Math.min(CW, maxCW);

    paintCutout(position, lines, effectiveCW, CH, cutoutFg);
  });

  function paintCutout(position, lines, CW, CH, cutoutFg) {
    switch (position) {
    case 'top-right':
      paintTopRight(lines, CW, CH, cutoutFg);
      break;
    case 'top-left':
      paintTopLeft(lines, CW, CH, cutoutFg);
      break;
    case 'bottom-right':
      paintBottomRight(lines, CW, CH, cutoutFg);
      break;
    case 'bottom-left':
      paintBottomLeft(lines, CW, CH, cutoutFg);
      break;
    }
  }

  /**
   * top-right: step sits above the box, spanning most of the top border.
   *
   * Step box is at columns [stepLeftX .. xl-1], stepLeftX = xi+CW+1.
   * Text (CW chars, right-aligned) sits to the LEFT of the step, at xi+1..xi+CW.
   *
   * For ALL CH:
   *   - Row yi-CH (step top):  topLeft at stepLeftX, ─ fill to xl-2, topRight at xl-1
   *   - Rows yi-CH+1..yi-1 (wall rows, count=CH-1):
   *       vertical at stepLeftX, vertical at xl-1; text to left of stepLeftX
   *   - Row yi (junction): topLeft at xi (keep), ─ xi+1..stepLeftX-1 (keep),
   *       bottomRight at stepLeftX, clear stepLeftX+1..xl-2, vertical at xl-1
   *   - Text on step-top row: right-aligned in cols xi+1..xi+CW (outside, left of step)
   *   - Text on wall rows: right-aligned in cols xi+1..xi+CW
   *
   * Note: for CH=1 there are no wall rows. Text sits only on the step-top row.
   */
  function paintTopRight(lines, CW, CH, cutoutFg) {
    var junctionY  = yi;
    var stepTopY   = junctionY - CH;           // first step row (top border of step box)
    var stepLeftX  = xi + CW + 1;              // step left wall column
    var textStartX = xi + 1;                   // text left edge
    var stepInteriorW = xl - stepLeftX - 2;    // horizontal chars in step top border

    // Step top row: top border of step box (wide)
    writeChar(stepTopY, stepLeftX, borderAttr, charset.topLeft);
    writeHoriz(stepTopY, stepLeftX + 1, stepInteriorW, borderAttr, charset.horizontal);
    writeChar(stepTopY, xl - 1, borderAttr, charset.topRight);

    // Text on step top row (outside step, to the left)
    var padded0 = rightAlign(lines[0], CW);
    for (var ci0 = 0; ci0 < CW; ci0++) {
      writeCharFgOnly(stepTopY, textStartX + ci0, cutoutFg, padded0[ci0] || ' ');
    }

    // Wall rows (rows yi-CH+1 .. yi-1): vertical on both sides, text to the left
    for (var w = 1; w < CH; w++) {
      var wallY = stepTopY + w;
      writeChar(wallY, stepLeftX, borderAttr, charset.vertical);
      writeChar(wallY, xl - 1, borderAttr, charset.vertical);
      var paddedW = rightAlign(lines[w], CW);
      for (var ciW = 0; ciW < CW; ciW++) {
        writeCharFgOnly(wallY, textStartX + ciW, cutoutFg, paddedW[ciW] || ' ');
      }
    }

    // Junction row (yi = box top border row):
    // - topLeft at xi: already drawn by box, keep
    // - horizontal xi+1..stepLeftX-1: already drawn by box, keep
    // - bottomRight at stepLeftX: replaces one ─ char
    // - clear stepLeftX+1..xl-2 (was ─ from box top, now open step interior)
    // - vertical at xl-1: replaces original topRight (box right wall continues down)
    writeChar(junctionY, stepLeftX, borderAttr, charset.bottomRight);
    for (var clr = stepLeftX + 1; clr <= xl - 2; clr++) {
      writeChar(junctionY, clr, borderAttr, ' ');
    }
    writeChar(junctionY, xl - 1, borderAttr, charset.vertical);
  }

  /**
   * top-left: step sits above the box, spanning most of the top border.
   *
   * Step box is at columns [xi .. stepRightX], stepRightX = xl-CW-2.
   * Text (CW chars, left-aligned) sits to the RIGHT of the step, at xl-CW-1..xl-2.
   *
   * For ALL CH:
   *   - Row yi-CH (step top): topLeft at xi, ─ fill to stepRightX-1, topRight at stepRightX
   *   - Rows yi-CH+1..yi-1 (wall rows): vertical at xi, vertical at stepRightX; text to right
   *   - Row yi (junction): vertical at xi (replaces topLeft), clear xi+1..stepRightX-1,
   *       bottomLeft at stepRightX, ─ stepRightX+1..xl-2, topRight at xl-1 (keep)
   *   - Text on step-top row: left-aligned in cols xl-CW-1..xl-2
   *   - Text on wall rows: left-aligned in cols xl-CW-1..xl-2
   */
  function paintTopLeft(lines, CW, CH, cutoutFg) {
    var junctionY  = yi;
    var stepTopY   = junctionY - CH;
    var stepRightX = xl - CW - 2;              // step right wall column
    var textStartX = stepRightX + 1;           // text left edge (right of step)
    var stepInteriorW = stepRightX - xi - 1;   // horizontal chars in step top border

    // Step top row (wide)
    writeChar(stepTopY, xi, borderAttr, charset.topLeft);
    writeHoriz(stepTopY, xi + 1, stepInteriorW, borderAttr, charset.horizontal);
    writeChar(stepTopY, stepRightX, borderAttr, charset.topRight);

    // Text on step top row (outside step, to the right)
    var padded0 = leftAlign(lines[0], CW);
    for (var ci0 = 0; ci0 < CW; ci0++) {
      writeCharFgOnly(stepTopY, textStartX + ci0, cutoutFg, padded0[ci0] || ' ');
    }

    // Wall rows
    for (var w = 1; w < CH; w++) {
      var wallY = stepTopY + w;
      writeChar(wallY, xi, borderAttr, charset.vertical);
      writeChar(wallY, stepRightX, borderAttr, charset.vertical);
      var paddedW = leftAlign(lines[w], CW);
      for (var ciW = 0; ciW < CW; ciW++) {
        writeCharFgOnly(wallY, textStartX + ciW, cutoutFg, paddedW[ciW] || ' ');
      }
    }

    // Junction row:
    // - vertical at xi: replaces original topLeft
    // - clear xi+1..stepRightX-1 (open step interior)
    // - bottomLeft at stepRightX: step right wall bottom meets box top going right
    // - horizontal stepRightX+1..xl-2: box top continues right (already drawn, keep)
    // - topRight at xl-1: keep
    writeChar(junctionY, xi, borderAttr, charset.vertical);
    for (var clr = xi + 1; clr <= stepRightX - 1; clr++) {
      writeChar(junctionY, clr, borderAttr, ' ');
    }
    writeChar(junctionY, stepRightX, borderAttr, charset.bottomLeft);
    // horizontal xi+stepRightX+1..xl-2 already there from box render; keep
  }

  /**
   * bottom-right: step sits below the box, spanning most of the bottom border.
   *
   * Step box is at columns [stepLeftX .. xl-1], stepLeftX = xi+CW+1.
   * Text (CW chars, right-aligned) sits to the LEFT of the step, at xi+1..xi+CW.
   *
   * Structure (reading downward from box bottom):
   *   Row yl-1 (junction = box bottom border):
   *     - bottomLeft at xi (keep), ─ xi+1..stepLeftX-1 (keep),
   *       topRight at stepLeftX, clear stepLeftX+1..xl-2, vertical at xl-1
   *   Rows yl..yl+CH-2 (wall rows, count=CH-1):
   *     - text (right-aligned) at xi+1..xi+CW
   *     - vertical at stepLeftX (LEFT wall), vertical at xl-1 (RIGHT wall)
   *   Row yl+CH-1 (closing = last row):
   *     - text (right-aligned) at xi+1..xi+CW
   *     - bottomLeft at stepLeftX, ─ stepLeftX+1..xl-2, bottomRight at xl-1
   *
   * Note: for CH=1 there are no wall rows; closing row is yl.
   */
  function paintBottomRight(lines, CW, CH, cutoutFg) {
    var junctionY  = yl - 1;
    var closingY   = yl - 1 + CH;
    var stepLeftX  = xi + CW + 1;              // step left wall column
    var textStartX = xi + 1;                   // text left edge

    // Junction row: step entrance (wide)
    // bottomLeft at xi: already drawn by box, keep
    // horizontal xi+1..stepLeftX-1: already drawn by box, keep
    writeChar(junctionY, stepLeftX, borderAttr, charset.topRight);
    for (var clr = stepLeftX + 1; clr <= xl - 2; clr++) {
      writeChar(junctionY, clr, borderAttr, ' ');
    }
    writeChar(junctionY, xl - 1, borderAttr, charset.vertical);

    // Wall rows: text to the left, vertical on both walls
    for (var w = 1; w < CH; w++) {
      var wallY = junctionY + w;
      var paddedW = rightAlign(lines[w - 1], CW);
      for (var ciW = 0; ciW < CW; ciW++) {
        writeCharFgOnly(wallY, textStartX + ciW, cutoutFg, paddedW[ciW] || ' ');
      }
      writeChar(wallY, stepLeftX, borderAttr, charset.vertical);
      writeChar(wallY, xl - 1, borderAttr, charset.vertical);
    }

    // Closing row: text to the left, then step bottom border
    var paddedLast = rightAlign(lines[CH - 1], CW);
    for (var ci2 = 0; ci2 < CW; ci2++) {
      writeCharFgOnly(closingY, textStartX + ci2, cutoutFg, paddedLast[ci2] || ' ');
    }
    writeChar(closingY, stepLeftX, borderAttr, charset.bottomLeft);
    writeHoriz(closingY, stepLeftX + 1, xl - stepLeftX - 2, borderAttr, charset.horizontal);
    writeChar(closingY, xl - 1, borderAttr, charset.bottomRight);
  }

  /**
   * bottom-left: step sits below the box, spanning most of the bottom border.
   *
   * Step box is at columns [xi .. stepRightX], stepRightX = xl-CW-2.
   * Text (CW chars, left-aligned) sits to the RIGHT of the step, at xl-CW-1..xl-2.
   *
   * Structure (reading downward from box bottom):
   *   Row yl-1 (junction = box bottom border):
   *     - vertical at xi (replaces bottomLeft), clear xi+1..stepRightX-1,
   *       topLeft at stepRightX, ─ stepRightX+1..xl-2, bottomRight at xl-1 (keep)
   *   Rows yl..yl+CH-2 (wall rows, count=CH-1):
   *     - vertical at xi (LEFT wall), vertical at stepRightX (RIGHT wall)
   *     - text (left-aligned) at stepRightX+1..stepRightX+CW
   *   Row yl+CH-1 (closing = last row):
   *     - bottomLeft at xi, ─ xi+1..stepRightX-1, bottomRight at stepRightX
   *     - text (left-aligned) at stepRightX+1..stepRightX+CW
   *
   * Note: for CH=1 there are no wall rows; closing row is yl.
   */
  function paintBottomLeft(lines, CW, CH, cutoutFg) {
    var junctionY  = yl - 1;
    var closingY   = yl - 1 + CH;
    var stepRightX = xl - CW - 2;              // step right wall column
    var textStartX = stepRightX + 1;           // text left edge (right of step)

    // Junction row: step entrance (wide)
    writeChar(junctionY, xi, borderAttr, charset.vertical);
    for (var clr = xi + 1; clr <= stepRightX - 1; clr++) {
      writeChar(junctionY, clr, borderAttr, ' ');
    }
    writeChar(junctionY, stepRightX, borderAttr, charset.topLeft);
    writeHoriz(junctionY, stepRightX + 1, CW, borderAttr, charset.horizontal);
    // bottomRight at xl-1: already drawn by box, keep

    // Wall rows: vertical on both walls, text to the right
    for (var w = 1; w < CH; w++) {
      var wallY = junctionY + w;
      writeChar(wallY, xi, borderAttr, charset.vertical);
      writeChar(wallY, stepRightX, borderAttr, charset.vertical);
      var paddedW = leftAlign(lines[w - 1], CW);
      for (var ciW = 0; ciW < CW; ciW++) {
        writeCharFgOnly(wallY, textStartX + ciW, cutoutFg, paddedW[ciW] || ' ');
      }
    }

    // Closing row: step bottom border, then text to the right
    writeChar(closingY, xi, borderAttr, charset.bottomLeft);
    writeHoriz(closingY, xi + 1, stepRightX - xi - 1, borderAttr, charset.horizontal);
    writeChar(closingY, stepRightX, borderAttr, charset.bottomRight);
    var paddedLast = leftAlign(lines[CH - 1], CW);
    for (var ci2 = 0; ci2 < CW; ci2++) {
      writeCharFgOnly(closingY, textStartX + ci2, cutoutFg, paddedLast[ci2] || ' ');
    }
  }
};

// Text alignment helpers are imported from lib/border/geometry.js
