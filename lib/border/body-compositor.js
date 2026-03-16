'use strict';

/**
 * lib/border/body-compositor.js
 *
 * Cell-level intent buffer and composition engine for cutout-aware body rendering.
 *
 * This module is the core of the cutout body renderer. It takes:
 *   - A viewport geometry (from viewport-geometry.js)
 *   - A list of message items (inner bordered boxes with role/text)
 *   - A scroll offset
 *   - Scrollbar glyphs (from scrollbar.js)
 *
 * And produces a 2D grid of fully resolved characters ready to write to
 * screen.lines. Each cell goes through these layers:
 *
 *   Layer 0: Outer heavy frame (┃ ━ ┏ ┛) — set first, always wins at edges
 *   Layer 1: Inner box borders (╭ ─ │ ╰) — merge with outer via intersection resolver
 *   Layer 2: Content text — fills remaining cells, clipped to available width
 *   Layer 3: Ellipsis (…) — replaces last visible text char when clipping occurs
 *   Layer 4: Scrollbar glyphs — dedicated column, never overwritten by text
 *
 * The compositor uses the intersection resolver to handle mixed-stroke
 * junctions where inner light/rounded borders meet the outer heavy frame.
 *
 * The ELLIPSIS character (…) appears only when text is clipped by the viewport.
 */

var boxRenderers = require('./box-renderers');
var bottomTransition = require('./bottom-transition');
var topTransition = require('./top-transition');

// ── Import render helpers and constants from box-renderers ───────────────
var ELLIPSIS = boxRenderers.ELLIPSIS;
var renderBoxTop = boxRenderers.renderBoxTop;
var renderBoxContent = boxRenderers.renderBoxContent;
var renderBoxBottom = boxRenderers.renderBoxBottom;
var renderBoxContentLeftClipped = boxRenderers.renderBoxContentLeftClipped;
var renderBoxTopLeftClipped = boxRenderers.renderBoxTopLeftClipped;
var renderBoxBottomLeftClipped = boxRenderers.renderBoxBottomLeftClipped;

/**
 * Build the virtual content lines for a message list.
 *
 * Each message becomes a rounded-corner box:
 *   ╭─ ROLE ──────╮
 *   │ text content │
 *   ╰──────────────╯
 *
 * @param {Array} messages - Array of { role: string, text: string }
 * @param {number} maxWidth - Maximum inner width available for content
 * @returns {Array} Array of virtual line objects
 */
function buildVirtualLines(messages, maxWidth) {
  var lines = [];

  for (var mi = 0; mi < messages.length; mi++) {
    var msg = messages[mi];
    var role = msg.role || '';
    var text = msg.text || '';
    var textLines = text.split('\n');

    // Role header: ╭─ ROLE ─...─╮ — role text plus decoration
    var roleLabel = '\u2500 ' + role + ' '; // ─ ROLE
    // Find the longest text line for box width calculation
    var maxTextLen = 0;
    for (var li = 0; li < textLines.length; li++) {
      if (textLines[li].length > maxTextLen) maxTextLen = textLines[li].length;
    }
    // Box interior = max(role label length + 1, max text line + 2 padding)
    var interiorWidth = Math.max(roleLabel.length + 1, maxTextLen + 2);
    // Cap at available space minus 2 for the │ borders
    var boxWidth = Math.min(interiorWidth + 2, maxWidth);
    var interior = boxWidth - 2;

    // Top border: ╭─ ROLE ─────╮
    lines.push({
      type: 'box-top', boxWidth: boxWidth, interior: interior,
      roleLabel: roleLabel, rounded: true
    });

    // Content lines: │ text │
    for (var tli = 0; tli < textLines.length; tli++) {
      lines.push({
        type: 'box-content', boxWidth: boxWidth,
        interior: interior, text: textLines[tli]
      });
    }

    // Bottom border: ╰────────────╯
    lines.push({
      type: 'box-bottom', boxWidth: boxWidth,
      interior: interior, rounded: true
    });
  }

  return lines;
}

/**
 * Render the cutout body into a 2D character grid.
 *
 * Main composition function. Takes viewport geometry, virtual content lines,
 * scroll state, and scrollbar glyphs; produces a grid of resolved characters
 * plus inner border tracking metadata for outer border junction resolution.
 *
 * @param {object} opts - Composition options
 * @returns {{ grid: Array, innerBorderCols: object }}
 */
function compose(opts) {
  var bodyTop = opts.bodyTop;
  var bodyHeight = opts.bodyHeight;
  var scrollbarCol = opts.scrollbarCol;
  var outerLeft = opts.outerLeft;
  var outerRight = opts.outerRight;
  var vLines = opts.virtualLines;
  var scrollOffset = opts.scrollOffset;
  var scrollbarGlyphs = opts.scrollbarGlyphs || [];
  var bottomStepCol = opts.bottomStepCol != null ? opts.bottomStepCol : -1;
  var bottomStepRow = opts.bottomStepRow != null ? opts.bottomStepRow : -1;
  var topStepCol = opts.topStepCol != null ? opts.topStepCol : -1;
  var topStepRow = opts.topStepRow != null ? opts.topStepRow : -1;

  // Build empty grid (each cell = space character)
  var gridWidth = outerRight - outerLeft + 1;
  var grid = [];
  for (var r = 0; r < bodyHeight; r++) {
    var row = new Array(gridWidth);
    for (var c = 0; c < gridWidth; c++) row[c] = ' ';
    grid.push(row);
  }

  // Inner border column tracker: records which grid columns received inner
  // box borders, enabling transition renderers to place ┷/┯ junctions
  var innerBorderCols = { left: {}, right: {} };

  // Phase 1: Outer heavy frame — left ┃ and right ┃ on every body row
  for (var fr = 0; fr < bodyHeight; fr++) {
    grid[fr][0] = '\u2503';
    grid[fr][gridWidth - 1] = '\u2503';
  }

  // Phase 2: Scrollbar glyphs in their dedicated column
  if (scrollbarCol >= 0) {
    var sbLocalCol = scrollbarCol - outerLeft;
    for (var sr = 0; sr < bodyHeight && sr < scrollbarGlyphs.length; sr++) {
      grid[sr][sbLocalCol] = scrollbarGlyphs[sr];
    }
  }

  // Phase 3: Content — map virtual lines to visible screen rows
  var localContentLeft = opts.contentLeft - outerLeft;
  var localContentRight = opts.contentRight - outerLeft;

  for (var vr = scrollOffset; vr < scrollOffset + bodyHeight && vr < vLines.length; vr++) {
    var screenRow = vr - scrollOffset;
    var vLine = vLines[vr];
    var rowContentRight = localContentRight;
    var rowContentLeft = localContentLeft;
    var absRow = bodyTop + screenRow;
    var isTopTrans = (topStepCol > 0 && absRow === topStepRow);
    var isBottomTrans = (bottomStepCol > 0 && absRow === bottomStepRow);

    // Narrow content on bottom transition row (step cuts from right)
    if (isBottomTrans) {
      var bStepLocal = bottomStepCol - outerLeft;
      if (bStepLocal - 1 < rowContentRight) rowContentRight = bStepLocal - 1;
    }

    // Narrow content on top transition row (step cuts from left)
    // Content starts after the step closure (┛) + 1 space gap
    var leftClipCols = 0;
    if (isTopTrans) {
      var tStepLocal = topStepCol - outerLeft;
      var visibleStart = tStepLocal + 2; // past ┛ + 1 space
      if (visibleStart > rowContentLeft) {
        leftClipCols = visibleStart - rowContentLeft;
        rowContentLeft = visibleStart;
      }
    }

    var availWidth = rowContentRight - rowContentLeft + 1;

    // Render the virtual line, choosing left-clipped variant for top transition
    renderVLine(grid[screenRow], vLine, rowContentLeft, availWidth,
      isTopTrans && leftClipCols > 0, leftClipCols, localContentLeft);

    // Track inner border columns for junction resolution
    trackInnerBorders(innerBorderCols, screenRow, vLine, rowContentLeft,
      availWidth, isTopTrans && leftClipCols > 0, leftClipCols, localContentLeft);
  }

  // Phase 4: Bottom cutout transition — ┏ ━ ┷ ━ ┛
  bottomTransition.renderBottomTransition(grid, gridWidth, bodyTop, bodyHeight,
    bottomStepCol, bottomStepRow, scrollbarCol, outerLeft, innerBorderCols);

  // Phase 5: Top cutout transition — ┏ ┯ ━ ┛
  topTransition.renderTopTransition(grid, gridWidth, bodyTop, bodyHeight,
    topStepCol, topStepRow, scrollbarCol, outerLeft, innerBorderCols);

  // Attach inner border metadata to the grid for junction post-processing.
  // The grid itself is a 2D array; innerBorderCols rides as a non-enumerable
  // property so existing code that iterates grid rows is unaffected.
  grid.innerBorderCols = innerBorderCols;
  return grid;
}

/**
 * Render a single virtual line into a grid row, choosing the appropriate
 * renderer based on line type and whether left-side clipping is active.
 */
function renderVLine(gridRow, vLine, contentLeft, availWidth,
  isLeftClipped, leftClipCols, origContentLeft) {
  if (availWidth <= 0) return;

  if (isLeftClipped) {
    // Top transition row: content is left-clipped by the step border
    if (vLine.type === 'box-content') {
      renderBoxContentLeftClipped(gridRow, origContentLeft, contentLeft,
        availWidth, vLine);
    } else if (vLine.type === 'box-top') {
      renderBoxTopLeftClipped(gridRow, origContentLeft, contentLeft,
        availWidth, vLine);
    } else if (vLine.type === 'box-bottom') {
      renderBoxBottomLeftClipped(gridRow, origContentLeft, contentLeft,
        availWidth, vLine);
    }
  } else {
    // Normal or bottom-transition row: standard right-clip rendering
    if (vLine.type === 'box-top') {
      renderBoxTop(gridRow, contentLeft, availWidth, vLine);
    } else if (vLine.type === 'box-content') {
      renderBoxContent(gridRow, contentLeft, availWidth, vLine);
    } else if (vLine.type === 'box-bottom') {
      renderBoxBottom(gridRow, contentLeft, availWidth, vLine);
    }
  }
}

/**
 * Track inner border column positions after rendering a virtual line.
 * Records left and right border columns for each screen row so that
 * transition renderers can place ┷/┯ junctions where borders cross ━.
 */
function trackInnerBorders(innerBorderCols, screenRow, vLine, contentLeft,
  availWidth, isLeftClipped, leftClipCols, origContentLeft) {
  if (availWidth <= 0) return;
  var boxWidth = Math.min(vLine.boxWidth, availWidth);

  if (isLeftClipped) {
    // Left-clipped: left border is hidden, right border may be visible
    var rightCol = origContentLeft + vLine.boxWidth - 1;
    // If the entire box ends before the visible region, nothing to track
    if (rightCol < contentLeft) return;
    var visEnd = contentLeft + availWidth;
    if (rightCol < visEnd && vLine.boxWidth <= (rightCol - origContentLeft + 1)) {
      innerBorderCols.right[screenRow] = rightCol;
    }
  } else {
    // Normal: left border at contentLeft, right border at contentLeft + boxWidth - 1
    innerBorderCols.left[screenRow] = contentLeft;
    var endCol = contentLeft + boxWidth - 1;
    // Only track right border if the full box fits (not viewport-clipped)
    if (vLine.boxWidth <= availWidth) {
      innerBorderCols.right[screenRow] = endCol;
    }
  }
}

// ── Exports ──────────────────────────────────────────────────────────────
exports.ELLIPSIS = ELLIPSIS;
exports.buildVirtualLines = buildVirtualLines;
exports.compose = compose;
