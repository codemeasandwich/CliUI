'use strict';

/**
 * lib/border/scrollbar.js
 *
 * Scrollbar glyph computation for cutout-aware body rendering.
 *
 * Uses a contractual glyph set — these specific characters are required
 * by the visual contract and must not be substituted:
 *
 *   ▴  (U+25B4) — up arrow at row 0
 *   ▾  (U+25BE) — down arrow at last row
 *   ╽  (U+257D) — thumb / scroll handle (light up, heavy down)
 *   ┊  (U+250A) — track segment near the thumb
 *   ┆  (U+2506) — track segment far from the thumb
 *
 * The scrollbar occupies a single column inside the outer right border.
 * Given the total content height, viewport height, and scroll offset,
 * it computes which glyph to show at each row.
 */

// ── Contractual glyph constants ──────────────────────────────────────────
/** Up arrow at the top of the scrollbar */
var UP_ARROW   = '\u25B4'; // ▴
/** Down arrow at the bottom of the scrollbar */
var DOWN_ARROW = '\u25BE'; // ▾
/** Thumb/handle showing current scroll position */
var THUMB      = '\u257D'; // ╽
/** Track segment near the thumb (adjacent) */
var TRACK_NEAR = '\u250A'; // ┊
/** Track segment far from the thumb */
var TRACK_FAR  = '\u2506'; // ┆

/**
 * Compute scrollbar glyphs for each row of the viewport.
 *
 * The scrollbar has this structure:
 *   Row 0:         ▴ (up arrow)
 *   Rows 1..n-2:   Track + thumb
 *   Row n-1:       ▾ (down arrow)
 *
 * The thumb position is proportional to scrollOffset / totalContentHeight.
 * Track segments adjacent to the thumb use ┊, others use ┆.
 *
 * @param {number} viewportHeight - Number of rows in the scrollable body area
 * @param {number} totalLines     - Total number of content lines (may exceed viewport)
 * @param {number} scrollOffset   - Number of lines scrolled off the top (0 = fully top)
 * @returns {string[]} Array of glyphs, one per viewport row
 */
function computeScrollbar(viewportHeight, totalLines, scrollOffset) {
  // Edge case: viewport too small for arrows + track
  if (viewportHeight <= 0) return [];
  if (viewportHeight === 1) return [THUMB];
  if (viewportHeight === 2) return [UP_ARROW, DOWN_ARROW];

  var result = new Array(viewportHeight);

  // First and last rows are always arrows
  result[0] = UP_ARROW;
  result[viewportHeight - 1] = DOWN_ARROW;

  // Track area: rows 1 to viewportHeight-2
  var trackHeight = viewportHeight - 2;

  if (trackHeight <= 0) return result;

  // Compute thumb position in the track area
  // scrollOffset=0 → thumb at top of track
  // scrollOffset=maxScroll → thumb at bottom of track
  var maxScroll = Math.max(0, totalLines - viewportHeight);
  var thumbPos;
  if (maxScroll <= 0) {
    // All content fits — thumb fills the top
    thumbPos = 0;
  } else {
    // Proportional position in the track
    thumbPos = Math.round((scrollOffset / maxScroll) * (trackHeight - 1));
  }
  // Clamp thumb position to valid track range
  thumbPos = Math.max(0, Math.min(trackHeight - 1, thumbPos));

  // Fill track: ┊ near thumb, ┆ far from thumb, ╽ at thumb
  for (var i = 0; i < trackHeight; i++) {
    var distance = Math.abs(i - thumbPos);
    if (distance === 0) {
      result[i + 1] = THUMB;
    } else if (distance === 1) {
      result[i + 1] = TRACK_NEAR;
    } else {
      result[i + 1] = TRACK_FAR;
    }
  }

  return result;
}

// ── Exports ──────────────────────────────────────────────────────────────

exports.UP_ARROW   = UP_ARROW;
exports.DOWN_ARROW = DOWN_ARROW;
exports.THUMB      = THUMB;
exports.TRACK_NEAR = TRACK_NEAR;
exports.TRACK_FAR  = TRACK_FAR;
exports.computeScrollbar = computeScrollbar;
