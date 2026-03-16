'use strict';

/**
 * lib/border/box-renderers.js
 *
 * Render helper functions for individual inner-box line types.
 *
 * These functions write characters into a single row of the grid buffer.
 * Extracted from body-compositor.js to keep each file under 200 NCLOC.
 *
 * Each renderer handles one line type of a rounded-corner inner message box:
 *   - box-top:     ╭─ ROLE ─────╮
 *   - box-content: │ text       │  (with optional ellipsis clipping)
 *   - box-bottom:  ╰────────────╯
 *
 * Left-clipped variants handle the top transition row where the step border
 * hides the left portion of the box. These show the visible right portion
 * with a leading ellipsis (…) to indicate content loss from the left.
 */

// ── Ellipsis character — semantic, only when clipping occurs ─────────────
var ELLIPSIS = '\u2026'; // …

/**
 * Render a box top border line: ╭─ ROLE ─────╮
 *
 * When the box is wider than availWidth (viewport-clipped from right),
 * the right corner ╮ is suppressed — only visible content renders.
 *
 * @param {Array} row - Grid row array to write into
 * @param {number} startCol - First available column (local to grid)
 * @param {number} availWidth - Available width for content
 * @param {object} vLine - Virtual line descriptor with boxWidth, roleLabel
 */
function renderBoxTop(row, startCol, availWidth, vLine) {
  var boxWidth = Math.min(vLine.boxWidth, availWidth);
  if (boxWidth <= 0) return;

  // ╭ at start — rounded top-left corner
  row[startCol] = '\u256D'; // ╭
  var roleLabel = vLine.roleLabel || '';
  var col = startCol + 1;
  // Write each character of the role label (e.g. "─ USER ")
  for (var ri = 0; ri < roleLabel.length && (col - startCol) < boxWidth - 1; ri++) {
    row[col] = roleLabel[ri];
    col++;
  }
  // Fill remaining interior with ─ horizontal line
  var endCol = startCol + boxWidth - 1;
  while (col < endCol && col < startCol + availWidth) {
    row[col] = '\u2500'; // ─
    col++;
  }
  // ╮ at end — only if the original box fits within available width
  if (vLine.boxWidth <= availWidth) {
    row[endCol] = '\u256E'; // ╮
  }
}

/**
 * Render a box content line: │ text │
 *
 * Clips from the right when text exceeds interior width, using ellipsis (…).
 * Suppresses right │ border when the original box is wider than availWidth.
 *
 * @param {Array} row - Grid row array to write into
 * @param {number} startCol - First available column (local to grid)
 * @param {number} availWidth - Available width for content
 * @param {object} vLine - Virtual line descriptor with boxWidth, text
 */
function renderBoxContent(row, startCol, availWidth, vLine) {
  var boxWidth = Math.min(vLine.boxWidth, availWidth);
  if (boxWidth <= 0) return;

  var text = vLine.text || '';
  var interior = boxWidth - 2;

  // │ at start — left border of content box
  row[startCol] = '\u2502'; // │

  if (interior >= 1) {
    // Leading space padding before text content
    row[startCol + 1] = ' ';
    var contentStart = startCol + 2;
    var contentWidth = interior - 1;

    // Check if text needs clipping — text longer than available columns
    var clipped = text.length > contentWidth;
    var displayText = clipped ? text.substring(0, contentWidth - 1) : text;

    // Write each character of the display text
    for (var ti = 0; ti < displayText.length; ti++) {
      if (contentStart + ti < startCol + boxWidth - 1) {
        row[contentStart + ti] = displayText[ti];
      }
    }

    // Add ellipsis (…) after clipped text — semantic content loss indicator
    if (clipped && contentStart + displayText.length < startCol + boxWidth - 1) {
      row[contentStart + displayText.length] = ELLIPSIS;
    }
  }

  // │ at end — only if the original box fits within available width
  if (vLine.boxWidth <= availWidth) {
    var endCol = startCol + boxWidth - 1;
    row[endCol] = '\u2502'; // │
  }
}

/**
 * Render a box bottom border line: ╰──────────╯
 *
 * Suppresses right ╯ corner when the original box is wider than availWidth.
 */
function renderBoxBottom(row, startCol, availWidth, vLine) {
  var boxWidth = Math.min(vLine.boxWidth, availWidth);
  if (boxWidth <= 0) return;

  // ╰ at start — rounded bottom-left corner
  row[startCol] = '\u2570'; // ╰
  var endCol = startCol + boxWidth - 1;
  for (var fc = startCol + 1; fc < endCol && fc < startCol + availWidth; fc++) {
    row[fc] = '\u2500'; // ─
  }
  // ╯ at end — only if the original box fits within available width
  if (vLine.boxWidth <= availWidth) {
    row[endCol] = '\u256F'; // ╯
  }
}

/**
 * Render a box content line left-clipped for the top transition row.
 *
 * The step border hides the left portion of the box. This function renders
 * only the visible right portion, starting with ellipsis (…) if any text
 * was clipped from the left.
 *
 * @param {Array} row - Grid row array to write into
 * @param {number} origStart - Original content start column (where │ would be)
 * @param {number} visibleStart - First visible column after the step closure
 * @param {number} availWidth - Available width from visibleStart to content right
 * @param {object} vLine - Virtual line descriptor with boxWidth, text
 */
function renderBoxContentLeftClipped(row, origStart, visibleStart, availWidth, vLine) {
  if (availWidth <= 0) return;
  var boxEnd = origStart + vLine.boxWidth - 1;
  // If the entire box ends before the visible region, nothing to render
  if (boxEnd < visibleStart) return;
  var text = vLine.text || '';

  // Calculate the full padded content that would render normally:
  // │ + space + text + (padding to interior) + │
  // The left │ and padding space are at origStart and origStart+1
  var interior = vLine.boxWidth - 2;
  var contentStart = origStart + 2; // past │ and space padding
  var contentWidth = interior - 1;  // interior minus leading space

  // How many characters of the padded content are hidden by the step
  var hiddenCols = visibleStart - origStart;

  // Determine if the right │ border is visible (within the visible region)
  var visibleEnd = visibleStart + availWidth - 1;
  var rightBorderVisible = boxEnd >= visibleStart && boxEnd <= visibleEnd;

  // Determine what part of the text is visible
  var textOffset = visibleStart - contentStart; // chars of text hidden
  if (textOffset < 0) textOffset = 0;

  var visibleText = '';
  var wasLeftClipped = false;
  if (textOffset > 0 && textOffset < text.length) {
    // Some text was clipped from the left
    visibleText = text.substring(textOffset);
    wasLeftClipped = true;
  } else if (textOffset <= 0) {
    // All text is visible (step only hid the │ and/or padding)
    visibleText = text;
    wasLeftClipped = hiddenCols > 0;
  }
  // If textOffset >= text.length, all text is hidden

  // Write: … then visible text then optional right │
  var col = visibleStart;
  if (wasLeftClipped && visibleText.length > 0) {
    row[col] = ELLIPSIS;
    col++;
    // Write remaining visible text after ellipsis
    var spaceForText = rightBorderVisible ? (boxEnd - col) : (visibleEnd - col + 1);
    for (var i = 1; i < visibleText.length && (col - visibleStart) < availWidth - (rightBorderVisible ? 1 : 0); i++) {
      row[col] = visibleText[i];
      col++;
    }
  } else if (visibleText.length > 0) {
    // No left clipping needed — just render the visible portion
    for (var j = 0; j < visibleText.length && (col - visibleStart) < availWidth - (rightBorderVisible ? 1 : 0); j++) {
      row[col] = visibleText[j];
      col++;
    }
  }

  // Right │ border at original box end position
  if (rightBorderVisible) {
    row[boxEnd] = '\u2502'; // │
  }
}

/**
 * Render a box top border left-clipped for the top transition row.
 * The left ╭ is hidden; shows ─ fill and right ╮ in the visible portion.
 */
function renderBoxTopLeftClipped(row, origStart, visibleStart, availWidth, vLine) {
  if (availWidth <= 0) return;
  var boxEnd = origStart + vLine.boxWidth - 1;
  // If the entire box ends before the visible region, nothing to render
  if (boxEnd < visibleStart) return;
  var visibleEnd = visibleStart + availWidth - 1;
  // Right corner is visible only if it falls within the visible region
  // (both after visibleStart and before visibleEnd)
  var rightCornerVisible = boxEnd >= visibleStart && boxEnd <= visibleEnd;

  // Fill visible portion with ─ horizontal line, capped at box end
  var fillEnd = rightCornerVisible ? boxEnd : Math.min(boxEnd + 1, visibleEnd + 1);
  for (var c = visibleStart; c < fillEnd; c++) {
    row[c] = '\u2500'; // ─
  }
  // ╮ right corner at original box end
  if (rightCornerVisible) {
    row[boxEnd] = '\u256E'; // ╮
  }
}

/**
 * Render a box bottom border left-clipped for the top transition row.
 * The left ╰ is hidden; shows ─ fill and right ╯ in the visible portion.
 */
function renderBoxBottomLeftClipped(row, origStart, visibleStart, availWidth, vLine) {
  if (availWidth <= 0) return;
  var boxEnd = origStart + vLine.boxWidth - 1;
  // If the entire box ends before the visible region, nothing to render
  if (boxEnd < visibleStart) return;
  var visibleEnd = visibleStart + availWidth - 1;
  // Right corner is visible only if it falls within the visible region
  var rightCornerVisible = boxEnd >= visibleStart && boxEnd <= visibleEnd;

  // Fill visible portion with ─ horizontal line, capped at box end
  var fillEnd = rightCornerVisible ? boxEnd : Math.min(boxEnd + 1, visibleEnd + 1);
  for (var c = visibleStart; c < fillEnd; c++) {
    row[c] = '\u2500'; // ─
  }
  // ╯ right corner at original box end
  if (rightCornerVisible) {
    row[boxEnd] = '\u256F'; // ╯
  }
}

// ── Exports ──────────────────────────────────────────────────────────────

exports.ELLIPSIS = ELLIPSIS;
exports.renderBoxTop = renderBoxTop;
exports.renderBoxContent = renderBoxContent;
exports.renderBoxBottom = renderBoxBottom;
exports.renderBoxContentLeftClipped = renderBoxContentLeftClipped;
exports.renderBoxTopLeftClipped = renderBoxTopLeftClipped;
exports.renderBoxBottomLeftClipped = renderBoxBottomLeftClipped;
