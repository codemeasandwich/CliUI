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
 */

// ── Ellipsis character — semantic, only when clipping occurs ─────────────
var ELLIPSIS = '\u2026'; // …

/**
 * Render a box top border line: ╭─ ROLE ─────╮
 *
 * Writes the rounded top-left corner, the role label decorated with
 * horizontal lines, and the rounded top-right corner into the grid row.
 * If the box doesn't fit within the available width, it clips without
 * adding ellipsis (borders don't get ellipsis, only content does).
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
  // ─ ROLE ───── — role label followed by horizontal fill
  var roleLabel = vLine.roleLabel || '';
  var fillStart = startCol + 1;
  var col = fillStart;
  // Write each character of the role label (e.g. "─ USER ")
  for (var ri = 0; ri < roleLabel.length && (col - startCol) < boxWidth - 1; ri++) {
    row[col] = roleLabel[ri];
    col++;
  }
  // Fill remaining interior with ─ horizontal line up to the closing corner
  var endCol = startCol + boxWidth - 1;
  while (col < endCol && col < startCol + availWidth) {
    row[col] = '\u2500'; // ─
    col++;
  }
  // ╮ at end — rounded top-right corner (only if it fits)
  if (endCol < startCol + availWidth) {
    row[endCol] = '\u256E'; // ╮
  } else if (endCol === startCol + availWidth - 1) {
    // Box exactly fills the space — still use the corner
    row[endCol] = '\u256E'; // ╮
  }
}

/**
 * Render a box content line: │ text │
 *
 * Writes the left │ border, a space of padding, the text content,
 * and the right │ border. When text exceeds the available interior
 * width, it clips and replaces the last visible character with
 * the semantic ellipsis (…).
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
  var interior = boxWidth - 2; // space between │ borders

  // │ at start — left border of content box
  row[startCol] = '\u2502'; // │

  // Content: 1-char padding on left, then text, then trailing space
  var textStart = startCol + 1;
  var textArea = interior;

  if (textArea >= 1) {
    // Leading space padding before text content
    row[textStart] = ' ';
    var contentStart = textStart + 1;
    var contentWidth = textArea - 1; // subtract 1 for leading space

    // Check if text needs clipping — text longer than available columns
    var clipped = text.length > contentWidth;
    var displayText = clipped ? text.substring(0, contentWidth - 1) : text;

    // Write each character of the display text
    for (var ti = 0; ti < displayText.length; ti++) {
      if (contentStart + ti < startCol + boxWidth - 1) {
        row[contentStart + ti] = displayText[ti];
      }
    }

    // Add ellipsis (…) after clipped text — semantic indicator of content loss
    if (clipped && contentStart + displayText.length < startCol + boxWidth - 1) {
      row[contentStart + displayText.length] = ELLIPSIS;
    }
  }

  // │ at end — right border of content box (if box fits fully)
  var endCol = startCol + boxWidth - 1;
  if (endCol < startCol + availWidth) {
    row[endCol] = '\u2502'; // │
  }
}

/**
 * Render a box bottom border line: ╰──────────╯
 *
 * Writes the rounded bottom-left corner, horizontal fill,
 * and the rounded bottom-right corner into the grid row.
 *
 * @param {Array} row - Grid row array to write into
 * @param {number} startCol - First available column (local to grid)
 * @param {number} availWidth - Available width for content
 * @param {object} vLine - Virtual line descriptor with boxWidth
 */
function renderBoxBottom(row, startCol, availWidth, vLine) {
  var boxWidth = Math.min(vLine.boxWidth, availWidth);
  if (boxWidth <= 0) return;

  // ╰ at start — rounded bottom-left corner
  row[startCol] = '\u2570'; // ╰
  // ─ fill — horizontal line across the interior
  var endCol = startCol + boxWidth - 1;
  for (var fc = startCol + 1; fc < endCol && fc < startCol + availWidth; fc++) {
    row[fc] = '\u2500'; // ─
  }
  // ╯ at end — rounded bottom-right corner (if it fits)
  if (endCol < startCol + availWidth) {
    row[endCol] = '\u256F'; // ╯
  } else if (endCol === startCol + availWidth - 1) {
    row[endCol] = '\u256F'; // ╯
  }
}

// ── Exports ──────────────────────────────────────────────────────────────

exports.ELLIPSIS = ELLIPSIS;
exports.renderBoxTop = renderBoxTop;
exports.renderBoxContent = renderBoxContent;
exports.renderBoxBottom = renderBoxBottom;
