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
 * Message boxes are rendered as rounded-corner bordered regions:
 *   ╭─ ROLE ──────╮
 *   │ text line 1  │
 *   │ text line 2  │
 *   ╰──────────────╯
 *
 * The ELLIPSIS character (…) appears only when text is clipped by the viewport.
 */

var intersection = require('./intersection');
var boxRenderers = require('./box-renderers');
var NONE = intersection.NONE;
var LIGHT = intersection.LIGHT;
var HEAVY = intersection.HEAVY;

// ── Import render helpers and constants from box-renderers ───────────────
var ELLIPSIS = boxRenderers.ELLIPSIS;
var renderBoxTop = boxRenderers.renderBoxTop;
var renderBoxContent = boxRenderers.renderBoxContent;
var renderBoxBottom = boxRenderers.renderBoxBottom;

/**
 * Build the virtual content lines for a message list.
 *
 * Each message becomes a rounded-corner box:
 *   ╭─ ROLE ──────╮
 *   │ text content │
 *   ╰──────────────╯
 *
 * Returns an array of "virtual lines" — each is an object describing what
 * should appear at each column. Virtual lines are measured in content coordinates
 * (not screen coordinates) — the compositor maps them to screen rows later.
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
 * scroll state, and scrollbar glyphs; produces a grid of resolved characters.
 *
 * @param {object} opts - See @param list in implementation_plan.md
 * @returns {Array} 2D array [row][col] of resolved character strings
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

  // Build empty grid (each cell = space character)
  var gridWidth = outerRight - outerLeft + 1;
  var grid = [];
  for (var r = 0; r < bodyHeight; r++) {
    var row = new Array(gridWidth);
    for (var c = 0; c < gridWidth; c++) row[c] = ' ';
    grid.push(row);
  }

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
    var absRow = bodyTop + screenRow;
    // Narrow content on bottom transition row
    if (bottomStepCol > 0 && absRow === bottomStepRow) {
      var stepLocal = bottomStepCol - outerLeft;
      if (stepLocal - 1 < rowContentRight) rowContentRight = stepLocal - 1;
    }
    var availWidth = rowContentRight - localContentLeft + 1;

    if (vLine.type === 'box-top') {
      renderBoxTop(grid[screenRow], localContentLeft, availWidth, vLine);
    } else if (vLine.type === 'box-content') {
      renderBoxContent(grid[screenRow], localContentLeft, availWidth, vLine);
    } else if (vLine.type === 'box-bottom') {
      renderBoxBottom(grid[screenRow], localContentLeft, availWidth, vLine);
    }
  }

  // Phase 4: Bottom cutout transition — ┏ ━ ┷ ━ ┛
  renderBottomTransition(grid, gridWidth, bodyTop, bodyHeight,
    bottomStepCol, bottomStepRow, scrollbarCol, outerLeft);

  return grid;
}

/**
 * Render bottom cutout transition row: ┏━━━━┷━┛
 * Resolves the junction where inner content meets the step border.
 */
function renderBottomTransition(grid, gridWidth, bodyTop, bodyHeight,
  bottomStepCol, bottomStepRow, scrollbarCol, outerLeft) {
  if (bottomStepCol <= 0 || bottomStepRow < bodyTop) return;
  var transRow = bottomStepRow - bodyTop;
  if (transRow < 0 || transRow >= bodyHeight) return;

  var stepLocalCol = bottomStepCol - outerLeft;
  // ┏ heavy step corner
  if (stepLocalCol >= 0 && stepLocalCol < gridWidth) {
    grid[transRow][stepLocalCol] = '\u250F';
  }
  // ━ fill from step+1 to scrollbar/right border
  var fillEnd = scrollbarCol >= 0 ? (scrollbarCol - outerLeft) : (gridWidth - 2);
  for (var fc = stepLocalCol + 1; fc < fillEnd; fc++) {
    if (fc >= 0 && fc < gridWidth) grid[transRow][fc] = '\u2501';
  }
  // ┷ mixed junction at scrollbar column (up-light, horiz-heavy)
  if (scrollbarCol >= 0) {
    var sbCol = scrollbarCol - outerLeft;
    if (sbCol >= 0 && sbCol < gridWidth) {
      grid[transRow][sbCol] = intersection.resolve(LIGHT, NONE, HEAVY, HEAVY) || '\u2537';
    }
  }
  // ━ fill after scrollbar to right border
  if (scrollbarCol >= 0) {
    var afterSb = scrollbarCol - outerLeft + 1;
    for (var fc2 = afterSb; fc2 < gridWidth - 1; fc2++) {
      grid[transRow][fc2] = '\u2501';
    }
  }
  // ┛ at outer right border (replaces ┃)
  grid[transRow][gridWidth - 1] = '\u251B';
}

// ── Exports ──────────────────────────────────────────────────────────────
exports.ELLIPSIS = ELLIPSIS;
exports.buildVirtualLines = buildVirtualLines;
exports.compose = compose;
