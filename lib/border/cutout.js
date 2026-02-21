'use strict';

var blessed = require('../../blessed');
var Element = blessed.Element;
var resolveCharset = require('./charsets').resolveCharset;

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
    inner.left  = aleft + 1;
    inner.width = width - CW - 3;
    break;
  case 'top-left':
    inner.top   = atop - CH + 1;
    inner.left  = aleft + CW + 2;
    inner.width = width - CW - 3;
    break;
  case 'bottom-right':
    inner.top   = atop + (pos.height != null ? pos.height : (pos.yl - pos.yi));
    inner.left  = aleft + 1;
    inner.width = width - CW - 3;
    break;
  case 'bottom-left':
    inner.top   = atop + (pos.height != null ? pos.height : (pos.yl - pos.yi));
    inner.left  = aleft + CW + 2;
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
   * top-right: step sits above the box, text extends left.
   *
   * For CH=1:
   *   text line ┐          ← step top (text + topRight corner at xl-1)
   *   ┌─────────┘ ...      ← junction: box top row, step replaces topRight with bottomRight
   *
   * For CH=2:
   *   text line 1 ┌────┐   ← step top row (CW+1 before topLeft, horiz fill, topRight at xl-1)
   *   text line 2 │    │   ← wall rows
   *   ┌───────────┘    │   ← junction row (box top, bottomRight replaces the step col)
   */
  function paintTopRight(lines, CW, CH, cutoutFg) {
    // junction row is yi (box top border row)
    var junctionY = yi;

    if (CH === 1) {
      // Step top = junction - 1
      var stepY = junctionY - 1;
      // Text sits to the left of the topRight corner character
      // Text is right-aligned, flush against step border at xl-1
      var textX = xl - 1 - CW;  // text starts here
      var textLine = lines[0];
      var padded = rightAlign(textLine, CW);
      for (var ci = 0; ci < CW; ci++) {
        writeCharFgOnly(stepY, textX + ci, cutoutFg, padded[ci] || ' ');
      }
      // The original topRight corner (xl-1, yi) stays — it IS the step top-right corner
      // No need to overwrite it; the step top-right char is already topRight

      // On junction row: replace topRight corner with bottomRight
      // The box right wall (xl-1) runs vertically; the box top edge meets it
      // At the step junction, the box top edge (─) turns up into the step (via bottomRight)
      // Position: xl-1 - CW - 1 = step entrance column
      var stepCol = xl - 1 - CW - 1;  // column of bottomRight on junction
      // Fill from that col+1 to xl-2 with spaces (was: ─ chars for border top)
      // Actually the border rendering already drew ─ chars; we need to replace
      // the corner topRight with bottomRight, and paint a gap
      writeChar(junctionY, xl - 1, borderAttr, charset.bottomRight);
      // Draw ─ from stepCol+1 to xl-2 (step top edge)
      writeHoriz(stepY, xl - 1 - CW - 1, 1, borderAttr, charset.topLeft); // step topLeft
      writeHoriz(stepY, xl - 1 - CW, CW, borderAttr, charset.horizontal);  // step top horiz
      // bottomRight at xl-1 on stepY is the original corner — keep it
      // On junction row, erase old top-border chars and replace with step
      writeHoriz(junctionY, stepCol + 1, CW, borderAttr, charset.horizontal);
      writeChar(junctionY, stepCol, borderAttr, charset.bottomRight);

    } else {
      // CH >= 2: step top row is above the box by CH rows
      // step top row: topLeft at (xl-CW-2), horizontal fill, topRight at xl-1
      // wall rows: vertical at (xl-CW-2) and at (xl-1)
      // junction row (yi): bottomRight at (xl-CW-2), horizontal fill continues box top edge

      var stepTopY = junctionY - CH;
      var stepLeftX = xl - 1 - CW - 1;  // step left wall column

      // Step top row
      writeChar(stepTopY, stepLeftX, borderAttr, charset.topLeft);
      writeHoriz(stepTopY, stepLeftX + 1, CW, borderAttr, charset.horizontal);
      writeChar(stepTopY, xl - 1, borderAttr, charset.topRight);

      // Wall rows (CH-1 rows between step top and junction)
      for (var w = 1; w < CH; w++) {
        var wallY = stepTopY + w;
        writeChar(wallY, stepLeftX, borderAttr, charset.vertical);
        writeChar(wallY, xl - 1, borderAttr, charset.vertical);
      }

      // Junction row: replace topRight corner with bottomRight at stepLeftX
      writeChar(junctionY, stepLeftX, borderAttr, charset.bottomRight);
      writeHoriz(junctionY, stepLeftX + 1, CW, borderAttr, charset.horizontal);
      // xl-1 on junction row: the original topRight corner is now the step's inner corner
      // bottomRight or topRight? The box right wall goes up (xl-1), and the step top goes left.
      // The character that was topRight stays as-is (the box top edge meets the right wall)
      // Actually the box corner is unchanged (xl-1, yi) — but the step wall is at xl-1 too.
      // The step right wall merges with the original box right wall at xl-1, yi.
      // The horizontal chars in the junction row from stepLeftX+1 to xl-2 are the step top.
      // At xl-1,yi: originally was topRight (right+down). Now it joins left (step top) + down (box right).
      // That's still topRight (left coming in from step, down going to box body). Keep it.

      // Text: right-aligned in columns [stepLeftX+1 .. xl-2] i.e. CW wide area
      for (var li = 0; li < CH; li++) {
        var textY = stepTopY + li;
        var textLine2 = lines[li];
        var padded2 = rightAlign(textLine2, CW);
        for (var ci2 = 0; ci2 < CW; ci2++) {
          writeCharFgOnly(textY, stepLeftX + 1 + ci2, cutoutFg, padded2[ci2] || ' ');
        }
      }
    }
  }

  /**
   * top-left: step sits above the box, text extends right.
   *
   * For CH=1:
   *   ┌ text line  ← topLeft corner + text (fully outside border to the right)
   *   └───... box  ← junction: bottomLeft replaces original topLeft
   *
   * For CH>=2:
   *   ┌────┐ text line 1   ← step top row
   *   │    │ text line 2   ← wall rows
   *   │    └───────... box ← junction row: bottomLeft at step right wall col
   */
  function paintTopLeft(lines, CW, CH, cutoutFg) {
    var junctionY = yi;
    var stepRightX = xi + CW + 1;  // step right wall column (1 past the CW text area + 1 for left border)

    if (CH === 1) {
      var stepY = junctionY - 1;
      // topLeft corner at xi, text starts at xi+1 (to the right of corner)
      writeChar(stepY, xi, borderAttr, charset.topLeft);
      var padded = leftAlign(lines[0], CW);
      for (var ci = 0; ci < CW; ci++) {
        writeCharFgOnly(stepY, xi + 1 + ci, cutoutFg, padded[ci] || ' ');
      }
      // Junction row: replace topLeft corner with bottomLeft
      writeChar(junctionY, xi, borderAttr, charset.bottomLeft);
      writeHoriz(junctionY, xi + 1, CW, borderAttr, charset.horizontal);
      writeChar(junctionY, stepRightX, borderAttr, charset.bottomLeft);

    } else {
      var stepTopY = junctionY - CH;

      // Step top row
      writeChar(stepTopY, xi, borderAttr, charset.topLeft);
      writeHoriz(stepTopY, xi + 1, CW, borderAttr, charset.horizontal);
      writeChar(stepTopY, stepRightX, borderAttr, charset.topRight);

      // Wall rows
      for (var w = 1; w < CH; w++) {
        var wallY = stepTopY + w;
        writeChar(wallY, xi, borderAttr, charset.vertical);
        writeChar(wallY, stepRightX, borderAttr, charset.vertical);
      }

      // Junction row: bottomLeft at stepRightX, box top continues right
      writeChar(junctionY, xi, borderAttr, charset.vertical); // box left wall continues
      writeChar(junctionY, stepRightX, borderAttr, charset.bottomLeft);
      writeHoriz(junctionY, stepRightX + 1, xl - stepRightX - 2, borderAttr, charset.horizontal);
      // xl-1 stays as original topRight

      // Text: left-aligned in columns [xi+1 .. xi+CW] beside the step
      for (var li = 0; li < CH; li++) {
        var textY = stepTopY + li;
        var padded2 = leftAlign(lines[li], CW);
        for (var ci2 = 0; ci2 < CW; ci2++) {
          writeCharFgOnly(textY, xi + 1 + ci2, cutoutFg, padded2[ci2] || ' ');
        }
      }
    }
  }

  /**
   * bottom-right: step sits below the box, text extends right.
   *
   * For CH=1:
   *   │         ┌──────┘  ← junction (yl-1): topLeft at step col, horizontal fill, bottomRight
   *   └─────────┘ text    ← closing (yl): bottomLeft, horiz, bottomRight, then text
   *
   * For CH>=2:
   *   │         ┌─────────┘  ← junction (yl-1)
   *   │         │ text ln 1  ← wall rows
   *   └─────────┘ text ln 2  ← closing row
   */
  function paintBottomRight(lines, CW, CH, cutoutFg) {
    var junctionY = yl - 1;  // last row of element (bottom border)
    var closingY = yl - 1 + CH;  // last text row, below element

    // stepLeftX: where the step entrance corner goes on junction row
    var stepLeftX = xl - 1 - CW - 1;

    // Junction row: replace bottomRight corner (xl-1, yl-1) with step entrance
    // The box bottom edge runs from xi to stepLeftX; then step goes down
    writeChar(junctionY, stepLeftX, borderAttr, charset.topLeft);
    writeHoriz(junctionY, stepLeftX + 1, CW, borderAttr, charset.horizontal);
    // xl-1 on junctionY: was bottomRight; becomes bottomRight (unchanged — box right wall going up meets step top going left)
    // Actually it stays bottomRight. The step top (─) runs left to stepLeftX; the box right wall (│) goes up from here.
    // So (xl-1, junctionY) = bottomRight (left + up). Keep it.

    // Wall rows (CH-1 rows below junction, above closing)
    for (var w = 1; w < CH; w++) {
      var wallY = junctionY + w;
      writeChar(wallY, stepLeftX, borderAttr, charset.vertical);
      // Text on wall rows: left-aligned, starts at stepLeftX+1
      if (w <= lines.length - 1) {
        var padded = leftAlign(lines[w - 1], CW);
        for (var ci = 0; ci < CW; ci++) {
          writeCharFgOnly(wallY, stepLeftX + 1 + ci, cutoutFg, padded[ci] || ' ');
        }
      }
    }

    // Closing row
    writeChar(closingY, xi, borderAttr, charset.bottomLeft);
    writeHoriz(closingY, xi + 1, stepLeftX - xi - 1, borderAttr, charset.horizontal);
    writeChar(closingY, stepLeftX, borderAttr, charset.bottomRight);
    // Last text line on closing row
    var lastLine = lines[CH - 1];
    var paddedLast = leftAlign(lastLine, CW);
    writeCharFgOnly(closingY, stepLeftX + 1, cutoutFg, ' ');
    for (var ci2 = 0; ci2 < CW; ci2++) {
      writeCharFgOnly(closingY, stepLeftX + 1 + ci2, cutoutFg, paddedLast[ci2] || ' ');
    }
  }

  /**
   * bottom-left: step sits below the box, text extends left.
   *
   * For CH=1:
   *   └──────┐      │  ← junction (yl-1): bottomLeft, horiz, topRight at step col
   *   text   └──────┘  ← closing: text, bottomLeft at step col, horiz, bottomRight
   *
   * For CH>=2:
   *   └──────┐      │  ← junction (yl-1)
   *   text 1 │      │  ← wall rows
   *   text 2 └──────┘  ← closing row
   */
  function paintBottomLeft(lines, CW, CH, cutoutFg) {
    var junctionY = yl - 1;
    var closingY  = yl - 1 + CH;

    // stepRightX: column where the step right wall goes
    var stepRightX = xi + CW + 1;

    // Junction row: replace bottomLeft corner at xi with step entrance
    writeChar(junctionY, xi, borderAttr, charset.bottomLeft);
    writeHoriz(junctionY, xi + 1, stepRightX - xi - 1, borderAttr, charset.horizontal);
    writeChar(junctionY, stepRightX, borderAttr, charset.topRight);
    // xi on junctionY: was bottomLeft; step replaces with... the box left wall goes up, bottom goes right.
    // Actually xi (junctionY) was bottomLeft (up+right). The step takes the right branch down (topRight).
    // But the box left wall still needs to close. The bottomLeft at xi stays on the closing row.

    // Wall rows
    for (var w = 1; w < CH; w++) {
      var wallY = junctionY + w;
      writeChar(wallY, stepRightX, borderAttr, charset.vertical);
      // Text: right-aligned, to the left of stepRightX
      if (w <= lines.length - 1) {
        var padded = rightAlign(lines[w - 1], CW);
        for (var ci = 0; ci < CW; ci++) {
          writeCharFgOnly(wallY, xi + 1 + ci, cutoutFg, padded[ci] || ' ');
        }
      }
    }

    // Closing row
    writeChar(closingY, xi, borderAttr, charset.bottomLeft); // not needed in layout but placed for closing
    // Actually: closing row has the step close: bottomLeft (step left+up meets step bottom+right), horiz, bottomRight
    // And the last text line is to the LEFT of the step (outside)
    writeChar(closingY, stepRightX, borderAttr, charset.bottomLeft);
    writeHoriz(closingY, stepRightX + 1, xl - 1 - stepRightX - 1, borderAttr, charset.horizontal);
    writeChar(closingY, xl - 1, borderAttr, charset.bottomRight);

    // Last text line on closing row (right-aligned, to left of step)
    var lastLine = lines[CH - 1];
    var paddedLast = rightAlign(lastLine, CW);
    for (var ci2 = 0; ci2 < CW; ci2++) {
      writeCharFgOnly(closingY, xi + 1 + ci2, cutoutFg, paddedLast[ci2] || ' ');
    }
  }
};

// --- Text alignment helpers ---

/**
 * Right-align a string to exactly `width` chars (pad left with spaces).
 * Used when text is flush against the right step border.
 */
function rightAlign(str, width) {
  str = str || '';
  if (str.length >= width) return str.slice(0, width);
  return Array(width - str.length + 1).join(' ') + str;
}

/**
 * Left-align a string to exactly `width` chars (pad right with spaces).
 */
function leftAlign(str, width) {
  str = str || '';
  if (str.length >= width) return str.slice(0, width);
  return str + Array(width - str.length + 1).join(' ');
}
