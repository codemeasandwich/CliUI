'use strict';

/**
 * lib/border/render-cutout-body.js
 *
 * Integration API for cutout-aware body rendering.
 *
 * Composes the viewport geometry, scrollbar, and body compositor to render
 * a complete cutout body layout — nested inner message boxes with scrolling,
 * ellipsis clipping, and mixed-stroke intersections — into screen.lines.
 *
 * This is the public entry point for the new body renderer. It is separate
 * from setCutout() (which handles simple border labels) to preserve backward
 * compatibility.
 *
 * Usage:
 *   var renderCutoutBody = require('./render-cutout-body');
 *   renderCutoutBody(screen, {
 *     xi: 0, xl: 40, yi: 1, yl: 12,
 *     messages: [
 *       { role: 'USER', text: 'completed!' },
 *       { role: 'AI', text: 'I will start by reading...' }
 *     ],
 *     scrollOffset: 0,
 *     scrollbar: true,
 *     bottomCutout: { width: 6, height: 2, lines: [' claude • cli • opus-4-6'] }
 *   });
 */

var viewportGeometry = require('./viewport-geometry');
var scrollbar = require('./scrollbar');
var compositor = require('./body-compositor');
var screenLines = require('./screen-lines');
var writeCell = screenLines.writeCell;

/**
 * Render a cutout-aware body layout into screen.lines.
 *
 * @param {object} screen - Blessed screen instance with screen.lines
 * @param {object} opts
 * @param {number} opts.xi - Outer box left column (inclusive)
 * @param {number} opts.xl - Outer box right column (exclusive)
 * @param {number} opts.yi - Outer box top row
 * @param {number} opts.yl - Outer box bottom row (exclusive)
 * @param {Array}  opts.messages - Array of { role: string, text: string }
 * @param {number} [opts.scrollOffset=0] - Lines scrolled off the top
 * @param {boolean} [opts.scrollbar=true] - Whether to show scrollbar
 * @param {object} [opts.bottomCutout] - Bottom cutout: { width, height, lines }
 * @param {object} [opts.topCutout] - Top cutout info: { width, height }
 * @param {number} [opts.attr] - Cell attribute for border characters
 */
function renderCutoutBody(screen, opts) {
  if (!screen || !screen.lines) return;

  var xi = opts.xi;
  var xl = opts.xl;
  var yi = opts.yi;
  var yl = opts.yl;
  var messages = opts.messages || [];
  var scrollOffset = opts.scrollOffset || 0;
  var hasScrollbar = opts.scrollbar !== false;
  var bottomCutout = opts.bottomCutout || null;
  var topCutout = opts.topCutout || null;
  var attr = opts.attr || 0;

  // ── Step 1: Compute viewport geometry ─────────────────────────────────
  var viewport = viewportGeometry.computeViewport({
    xi: xi, xl: xl, yi: yi, yl: yl,
    hasScrollbar: hasScrollbar,
    topCutout: topCutout,
    bottomCutout: bottomCutout
  });

  // ── Step 2: Build virtual content lines from messages ──────────────────
  var maxContentWidth = viewport.defaultContentWidth;
  var vLines = compositor.buildVirtualLines(messages, maxContentWidth);
  var totalLines = vLines.length;

  // ── Step 3: Compute scrollbar glyphs ──────────────────────────────────
  // The scrollbar height excludes the bottom transition row, which gets ┷
  // instead of a scrollbar glyph. The transition renderer handles that cell.
  var sbHeight = viewport.bodyHeight;
  if (bottomCutout) sbHeight -= 1;
  var sbGlyphs = [];
  if (hasScrollbar) {
    sbGlyphs = scrollbar.computeScrollbar(sbHeight, totalLines, scrollOffset);
  }

  // ── Step 4: Compose the body grid ─────────────────────────────────────
  var grid = compositor.compose({
    bodyTop: viewport.bodyTop,
    bodyHeight: viewport.bodyHeight,
    contentLeft: viewport.defaultContentLeft,
    contentRight: viewport.defaultContentRight,
    scrollbarCol: viewport.scrollbarCol,
    outerLeft: viewport.outerLeft,
    outerRight: viewport.outerRight,
    virtualLines: vLines,
    scrollOffset: scrollOffset,
    scrollbarGlyphs: sbGlyphs,
    bottomStepCol: viewport.bottomStepCol,
    bottomStepRow: viewport.bottomTransitionRow,
    topStepCol: viewport.topStepCol,
    topStepRow: viewport.topTransitionRow
  });

  // ── Step 5: Write grid to screen.lines ────────────────────────────────
  for (var r = 0; r < grid.length; r++) {
    var screenY = viewport.bodyTop + r;
    if (screenY < 0 || screenY >= screen.rows) continue;
    var gridRow = grid[r];
    for (var c = 0; c < gridRow.length; c++) {
      var screenX = viewport.outerLeft + c;
      writeCell(screen.lines, screenY, screenX, attr, gridRow[c]);
    }
  }

  // Return metadata for testing and outer border post-processing
  return {
    viewport: viewport,
    virtualLines: vLines,
    totalLines: totalLines,
    grid: grid,
    innerBorderCols: grid.innerBorderCols
  };
}

module.exports = renderCutoutBody;
