'use strict';

/**
 * lib/border/bottom-transition.js
 *
 * Renders the bottom cutout transition row in the body compositor grid.
 *
 * The transition row is the last body row where the cutout step border
 * begins. Content continues on the LEFT side (narrowed), and the step
 * border structure occupies the RIGHT side:
 *
 *   ┃│ sta… ┏━━━━━━━━━━━━━━━━━━━━━┷━┛
 *            ^stepCol              ^sb ^outerRight
 *
 * Key rendering responsibilities:
 *   - ┏ heavy corner at stepCol (heavy down + heavy right)
 *   - ━ heavy horizontal fill from stepCol+1 to outerRight-1
 *   - ┷ mixed junction at the scrollbar column (up-light, horiz-heavy)
 *   - ┷ mixed junction at any inner border columns crossing the step ━
 *   - ┛ heavy corner at outerRight (up-heavy + left-heavy)
 */

var intersection = require('./intersection');
var NONE = intersection.NONE;
var LIGHT = intersection.LIGHT;
var HEAVY = intersection.HEAVY;

/**
 * Render the bottom cutout transition row into the grid.
 *
 * Draws the step border structure on the right side of the transition row,
 * resolving mixed-stroke junctions where the scrollbar and inner box
 * borders cross the heavy horizontal ━ line.
 *
 * @param {Array} grid - 2D character grid [row][col]
 * @param {number} gridWidth - Total grid width (outerRight - outerLeft + 1)
 * @param {number} bodyTop - Absolute screen row of the first body row
 * @param {number} bodyHeight - Number of body rows in the grid
 * @param {number} bottomStepCol - Absolute column where ┏ step corner goes
 * @param {number} bottomStepRow - Absolute screen row of the transition
 * @param {number} scrollbarCol - Absolute column of the scrollbar (-1 if none)
 * @param {number} outerLeft - Absolute column of the outer left border
 * @param {object} [innerBorderCols] - Map of inner border column positions per row
 *   { left: { screenRow: localCol }, right: { screenRow: localCol } }
 */
function renderBottomTransition(grid, gridWidth, bodyTop, bodyHeight,
  bottomStepCol, bottomStepRow, scrollbarCol, outerLeft, innerBorderCols) {
  // Skip if no bottom transition is configured
  if (bottomStepCol <= 0 || bottomStepRow < bodyTop) return;
  var transRow = bottomStepRow - bodyTop;
  if (transRow < 0 || transRow >= bodyHeight) return;

  var stepLocalCol = bottomStepCol - outerLeft;

  // ┏ heavy step corner — marks where the cutout step border begins
  if (stepLocalCol >= 0 && stepLocalCol < gridWidth) {
    grid[transRow][stepLocalCol] = '\u250F'; // ┏
  }

  // ━ heavy horizontal fill from step+1 to the column before outer right
  // This fills the entire step border region, then junctions are overlaid
  var fillEnd = gridWidth - 1; // stop before outer right border
  for (var fc = stepLocalCol + 1; fc < fillEnd; fc++) {
    if (fc >= 0 && fc < gridWidth) grid[transRow][fc] = '\u2501'; // ━
  }

  // ┛ at outer right border — replaces the normal ┃ with the heavy corner
  grid[transRow][gridWidth - 1] = '\u251B'; // ┛

  // ┷ mixed junction at scrollbar column — where the scrollbar track (light up)
  // meets the step border (heavy horizontal left and right)
  if (scrollbarCol >= 0) {
    var sbCol = scrollbarCol - outerLeft;
    if (sbCol > stepLocalCol && sbCol < gridWidth - 1) {
      grid[transRow][sbCol] = intersection.resolve(LIGHT, NONE, HEAVY, HEAVY) || '\u2537';
    }
  }

  // NOTE: Inner border junctions (┷) are NOT resolved on the bottom step ━
  // region. The step border cleanly terminates inner boxes — only the
  // scrollbar junction (above) gets ┷. Inner border junctions are resolved
  // on the outer bottom border row, which is outside this compositor.
}

/**
 * Resolve ┷/┯ junctions where inner box borders cross a heavy horizontal line.
 *
 * Only considers borders from the row immediately adjacent to the transition
 * (row above for bottom transitions, row below for top transitions).
 * For each inner border column that falls within the step ━ region, replace
 * the ━ with a mixed-stroke junction glyph using the intersection resolver.
 *
 * @param {Array} grid - 2D character grid
 * @param {number} transRow - Grid row index of the transition
 * @param {number} stepStartCol - Local col where the step ━ region begins (inclusive)
 * @param {number} stepEndCol - Local col where the step ━ region ends (exclusive)
 * @param {object} innerBorderCols - { left: {row:col}, right: {row:col} }
 * @param {number} upWeight - Stroke weight for the up direction (LIGHT or NONE)
 * @param {number} downWeight - Stroke weight for the down direction (LIGHT or NONE)
 * @param {number} adjacentRow - The grid row adjacent to the transition to check
 */
function resolveInnerBorderJunctions(grid, transRow, stepStartCol, stepEndCol,
  innerBorderCols, upWeight, downWeight, adjacentRow) {
  // Check both left and right inner border columns from the adjacent row only
  var sides = ['left', 'right'];
  for (var si = 0; si < sides.length; si++) {
    var sideMap = innerBorderCols[sides[si]];
    if (!sideMap) continue;
    // Only check the adjacent row for border columns that cross the step
    var localCol = sideMap[adjacentRow];
    if (localCol != null && localCol > stepStartCol && localCol < stepEndCol) {
      var glyph = intersection.resolve(upWeight, downWeight, HEAVY, HEAVY);
      if (glyph) grid[transRow][localCol] = glyph;
    }
  }
}

exports.renderBottomTransition = renderBottomTransition;
exports.resolveInnerBorderJunctions = resolveInnerBorderJunctions;
