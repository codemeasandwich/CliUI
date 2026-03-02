'use strict';
// @esm-group Utils

/**
 * lib/utils/slot-layout.js
 *
 * Fixed-width slot layout utilities for terminal dashboard widgets.
 *
 * Dashboard chrome paints separator characters (║, │, ─) at fixed screen
 * columns AFTER widgets render. If widget text is not padded to exact slot
 * widths, separators overwrite mid-word characters (e.g. SCAN → SC║N).
 * These utilities ensure widget content fills its allocated slot exactly,
 * so chrome separators land on single-space boundaries between slots.
 *
 * Five primitives are exported:
 *   fitToWidth    — pad/truncate a string to an exact terminal cell width
 *   joinFields    — join [value, width] pairs with a separator character
 *   scaleWidths   — proportionally scale baseline widths to a new total
 *   renderSlotRow — render items into fixed-width slots via a formatter callback
 *   buildFieldRow — high-level row builder with proportional or fixed-absorb widths
 *
 * All width calculations use the display-width utility (charWidth, displayWidth)
 * for correct handling of CJK double-wide characters, combining marks, and emoji.
 * An ASCII fast-path skips the codepoint loop for the common case of Latin-only
 * dashboard text.
 *
 * Blessed tags ({color-fg}...{/color-fg}) are treated as zero-width: they are
 * stripped before measuring visible width and preserved in the output during
 * truncation, so blessed renders colors/styles correctly even on padded or
 * truncated strings.
 */

var dw = require('./display-width');

// Regex to match blessed tag sequences like {green-fg}, {/green-fg}, {bold}, {/bold}.
// These are zero-width in terminal output — stripped for measurement, preserved in output.
var TAG_RE = /\{[^}]*\}/g;

// ASCII printable range (space through tilde). When visible content is all ASCII,
// .length gives the correct terminal cell count without the codepoint loop overhead.
var ASCII_RE = /^[\x20-\x7E]*$/;

/**
 * Pad or truncate a string to an exact terminal display width.
 *
 * Handles blessed tags ({color-fg}...{/color-fg}) as zero-width by stripping
 * them before measuring, then walking the original string character-by-character
 * to truncate at the visible-width boundary while preserving tags in the output.
 *
 * Uses displayWidth for correct CJK/emoji/combining-character measurement.
 * Falls back to .length for pure-ASCII strings as an optimization (the common
 * case for dashboard field values like "S:56 O:7", phase names like "SCAN").
 *
 * @param {string} str   - Input string (may contain blessed tags)
 * @param {number} width - Target display width in terminal cells
 * @returns {string} String whose visible width is exactly `width` cells
 */
exports.fitToWidth = function fitToWidth(str, width) {
  // Step 1: Strip blessed tags to isolate visible content for measurement.
  // Tags like {green-fg} occupy zero terminal cells — only the text between
  // tags contributes to display width.
  var visible = str.replace(TAG_RE, '');

  // Step 2: Measure the visible width. Use .length for pure ASCII (no codepoint
  // loop needed), fall back to displayWidth for strings with non-ASCII characters
  // (CJK, emoji, combining marks) where .length !== terminal cell count.
  var isAscii = ASCII_RE.test(visible);
  var visLen = isAscii ? visible.length : dw.displayWidth(visible);

  // Step 3a: Pad — visible content is narrower than the target width.
  // Append spaces to fill the remaining cells.
  if (visLen < width) {
    return str + ' '.repeat(width - visLen);
  }

  // Step 3b: Exact fit — no padding or truncation needed.
  if (visLen === width) return str;

  // Step 3c: Truncate — visible content exceeds the target width.
  // Walk the original string preserving blessed tags (zero-width) and counting
  // visible characters until we reach the target width. Tags encountered during
  // the walk are copied to the result without advancing the visible-width counter,
  // so blessed renders colors/styles correctly on the truncated string.
  var count = 0;
  var i = 0;
  var result = '';
  while (i < str.length && count < width) {
    // Check for blessed tag opener — copy the entire tag without counting it
    if (str[i] === '{') {
      var end = str.indexOf('}', i);
      if (end !== -1) {
        result += str.slice(i, end + 1);
        i = end + 1;
        continue;
      }
    }

    // For non-tag characters, determine terminal cell width via charWidth.
    // ASCII characters are always 1 cell; CJK/emoji may be 2; combining marks 0.
    var cp = str.codePointAt(i);
    var cw = isAscii ? 1 : dw.charWidth(cp);

    // If a double-wide character would overshoot the target width, stop before it
    if (count + cw > width) break;

    result += str[i];
    count += cw;

    // Skip the low surrogate of a surrogate pair (code points above U+FFFF
    // are encoded as two UTF-16 code units in JavaScript strings)
    if (cp > 0xFFFF) i++;
    i++;
  }

  // If truncation stopped one cell short (double-wide char at boundary),
  // pad with a single space so the result is exactly `width` cells wide.
  if (count < width) result += ' '.repeat(width - count);
  return result;
};

/**
 * Join [value, slotWidth] pairs with a separator character, padding each
 * value to its exact slot width using fitToWidth.
 *
 * Produces a string where separator characters land at precisely defined
 * column positions — matching the .template layout contracts that chrome
 * enforces via static character fixups.
 *
 * @param {Array<[string, number]>} fields - Array of [value, slotWidth] pairs.
 *   Each value is padded/truncated to its slotWidth before joining.
 * @param {string} [separator='\u2502'] - Separator character between fields.
 *   Defaults to │ (light vertical) matching tab-bar/status-bar template contracts.
 *   Phase-flow widgets pass ' ' (space) since chrome overwrites with ║.
 * @returns {string} Content string with separators at exact column positions
 */
exports.joinFields = function joinFields(fields, separator) {
  if (!fields || !fields.length) return '';
  var sep = separator != null ? separator : '\u2502';
  return fields.map(function (pair) {
    return exports.fitToWidth(pair[0], pair[1]);
  }).join(sep);
};

/**
 * Proportionally scale baseline field widths to fit a new total slot space.
 *
 * Each field (except the last) is scaled via Math.round, preserving its
 * proportion of the baseline total. The last field absorbs rounding error
 * so the returned array always sums to exactly newSlotSpace.
 *
 * Used by tab-bar to adapt baseline 120x40 slot widths to other screen sizes.
 * The proportional approach ensures field widths stay visually balanced across
 * terminal sizes without hand-deriving widths for every resolution.
 *
 * @param {number[]} baseWidths   - Baseline field widths (e.g. at 120x40)
 * @param {number}   newSlotSpace - Target total slot space at the current size
 * @returns {number[]} Scaled widths summing to exactly newSlotSpace
 */
exports.scaleWidths = function scaleWidths(baseWidths, newSlotSpace) {
  var baseTotal = 0;
  for (var i = 0; i < baseWidths.length; i++) baseTotal += baseWidths[i];

  // If the totals match, return the baseline unchanged (common at 120x40)
  if (baseTotal === newSlotSpace) return baseWidths;

  var scaled = [];
  var used = 0;
  // Scale each field except the last proportionally with Math.round
  for (var j = 0; j < baseWidths.length - 1; j++) {
    var w = Math.round(baseWidths[j] / baseTotal * newSlotSpace);
    scaled.push(w);
    used += w;
  }
  // Last field absorbs the rounding remainder so the sum is exact
  scaled.push(newSlotSpace - used);
  return scaled;
};

/**
 * Render items into fixed-width slots, joined by a separator character.
 *
 * Each item is formatted via a caller-supplied callback, then padded to its
 * assigned slot width using fitToWidth. The result is a single string where
 * separator characters land at exactly the column positions defined by the
 * cumulative slot widths — matching the chrome's static fixup positions.
 *
 * This is the generalized form of phase-flow.mjs's renderFixedSlotRow:
 * instead of hardcoding Gantt/legacy phase formatters, the caller passes
 * a formatter function that receives (item, slotWidth, index) and returns
 * the formatted string for that slot.
 *
 * @param {Array}         items      - Data items to render (e.g. phase objects)
 * @param {Array<number>} slotWidths - Per-slot display widths from computed layout.
 *   Items beyond the slotWidths array fall back to 12 columns.
 * @param {Function}      formatter  - (item, slotWidth, index) => string.
 *   Called for each item to produce the raw label before padding.
 * @param {string}        [separator=' '] - Join character between padded slots.
 *   Defaults to ' ' (space) — chrome overwrites these with ║ at fixup positions.
 * @returns {string} Rendered row with items at fixed column positions
 */
exports.renderSlotRow = function renderSlotRow(items, slotWidths, formatter, separator) {
  if (!items || !items.length) return '';
  var sep = separator != null ? separator : ' ';
  var segments = [];
  for (var i = 0; i < items.length; i++) {
    // Use the defined slot width for this index, or 12 as fallback for any
    // item that extends past the slotWidths array (e.g. extended phase lists)
    var w = i < slotWidths.length ? slotWidths[i] : 12;
    var label = formatter(items[i], w, i);
    segments.push(exports.fitToWidth(label, w));
  }
  return segments.join(sep);
};

/**
 * Build a row of fixed-width fields joined by a separator character.
 *
 * Encapsulates the boilerplate shared by status-bar and tab-bar widgets:
 *   1. Deduct separator space from contentWidth
 *   2. Compute final field widths (proportional or fixed-absorb)
 *   3. Pad each field to its width and join with the separator
 *
 * Two width strategies:
 *
 *   Proportional (default): Baseline widths from each field pair are scaled
 *   via scaleWidths() to fill contentWidth minus separator space. Used by
 *   tab-bar where field proportions must adapt to varying terminal sizes.
 *
 *   Fixed + absorb (opts.fixedWidths = true): Field widths are used as-is
 *   for all fields except the last, which absorbs any remaining space. Used
 *   by status-bar where most fields are fixed-width and only the keyboard
 *   legend flexes. The last field's declared width is ignored.
 *
 * @param {Array<[string, number]>} fields - [content, baselineWidth] pairs.
 *   Content is the display string; baselineWidth is the target slot width
 *   (proportional) or exact width (fixed). In fixed mode the last field's
 *   baselineWidth is replaced with the remaining space.
 * @param {number} contentWidth - Total available width for fields + separators.
 *   Typically screen.cols - 2 (status bar) or inner.width (tab bar).
 * @param {Object} [opts] - Options
 * @param {string} [opts.separator='\u2502'] - Join character between fields.
 *   Defaults to │ (light vertical box-drawing character).
 * @param {boolean} [opts.fixedWidths=false] - When true, use declared widths
 *   as-is and make the last field absorb remaining space.
 * @returns {string} Content string of exactly contentWidth display cells
 */
exports.buildFieldRow = function buildFieldRow(fields, contentWidth, opts) {
  if (!fields || !fields.length) return '';

  var separator = (opts && opts.separator != null) ? opts.separator : '\u2502';
  var fixedWidths = opts && opts.fixedWidths;

  // Deduct separator space: N fields need (N-1) separator characters,
  // each consuming 1 terminal cell. Remaining space is for field content.
  var numSeps = fields.length - 1;
  var slotSpace = contentWidth - numSeps;

  var finalPairs;
  if (fixedWidths) {
    // Fixed + absorb: use declared widths for all fields except the last.
    // The last field gets whatever space remains after summing the others.
    // This is the status-bar pattern where the keyboard legend absorbs slack.
    var usedWidth = 0;
    finalPairs = [];
    for (var i = 0; i < fields.length - 1; i++) {
      finalPairs.push([fields[i][0], fields[i][1]]);
      usedWidth += fields[i][1];
    }
    // Last field absorbs remainder — ensures total width is exact
    finalPairs.push([fields[fields.length - 1][0], slotSpace - usedWidth]);
  } else {
    // Proportional: extract baseline widths, scale to slotSpace, pair with
    // content strings. This is the tab-bar pattern where field proportions
    // adapt to different terminal widths via scaleWidths().
    var baseWidths = [];
    for (var j = 0; j < fields.length; j++) baseWidths.push(fields[j][1]);
    var scaled = exports.scaleWidths(baseWidths, slotSpace);
    finalPairs = [];
    for (var k = 0; k < fields.length; k++) {
      finalPairs.push([fields[k][0], scaled[k]]);
    }
  }

  // Delegate to joinFields for per-field padding + joining.
  return exports.joinFields(finalPairs, separator);
};
