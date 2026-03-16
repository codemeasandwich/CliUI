'use strict';

/**
 * lib/border/top-transition.js
 *
 * Renders the top cutout transition row in the body compositor grid.
 *
 * The transition row is the first body row where the cutout step border
 * closes. The step border occupies the LEFT side, and content continues
 * on the RIGHT side (potentially left-clipped):
 *
 *   ┏┯━━━━━━━━━━━┛ … the current. │▴┃
 *   ^              ^stepCol+1        ^sb^outerRight
 *
 * Key rendering responsibilities:
 *   - ┏ heavy corner at col 0 (replaces outer left ┃)
 *   - ━ heavy horizontal fill from col 1 to topStepCol-1
 *   - ┛ step closure at topStepCol (up-heavy + left-heavy)
 *   - ┯ mixed junction at any inner border columns crossing the step ━
 *     (down-light from inner box │ below, horiz-heavy from step ━)
 */

var intersection = require('./intersection');
var bottomTransition = require('./bottom-transition');
var NONE = intersection.NONE;
var LIGHT = intersection.LIGHT;
var HEAVY = intersection.HEAVY;

/**
 * Render the top cutout transition row into the grid.
 *
 * Draws the step border structure on the left side of the first body row,
 * resolving mixed-stroke junctions where inner box borders from the row
 * below cross the heavy horizontal ━ line.
 *
 * @param {Array} grid - 2D character grid [row][col]
 * @param {number} gridWidth - Total grid width
 * @param {number} bodyTop - Absolute screen row of the first body row
 * @param {number} bodyHeight - Number of body rows in the grid
 * @param {number} topStepCol - Absolute column where the step closure ┛ goes
 * @param {number} topStepRow - Absolute screen row of the transition
 * @param {number} scrollbarCol - Absolute column of the scrollbar (-1 if none)
 * @param {number} outerLeft - Absolute column of the outer left border
 * @param {object} [innerBorderCols] - Map of inner border column positions per row
 */
function renderTopTransition(grid, gridWidth, bodyTop, bodyHeight,
  topStepCol, topStepRow, scrollbarCol, outerLeft, innerBorderCols) {
  // Skip if no top transition is configured
  if (topStepCol <= 0 || topStepRow < bodyTop) return;
  var transRow = topStepRow - bodyTop;
  if (transRow < 0 || transRow >= bodyHeight) return;

  var stepLocalCol = topStepCol - outerLeft;

  // ┏ at outer left border — replaces the normal ┃ with heavy down+right corner
  // This marks the start of the step border running rightward
  grid[transRow][0] = '\u250F'; // ┏

  // ━ heavy horizontal fill from col 1 to just before the step closure
  for (var fc = 1; fc < stepLocalCol && fc < gridWidth; fc++) {
    grid[transRow][fc] = '\u2501'; // ━
  }

  // ┛ step closure — marks where the step border ends (up-heavy + left-heavy)
  if (stepLocalCol >= 0 && stepLocalCol < gridWidth) {
    grid[transRow][stepLocalCol] = '\u251B'; // ┛
  }

  // ┯ mixed junction at inner border columns — where inner box │ borders
  // from the row below cross the step ━ line (down-light, horiz-heavy).
  // Only check the adjacent row below the transition.
  if (innerBorderCols && transRow + 1 < grid.length) {
    bottomTransition.resolveInnerBorderJunctions(grid, transRow, 0, stepLocalCol,
      innerBorderCols, NONE, LIGHT, transRow + 1);
  }
}

exports.renderTopTransition = renderTopTransition;
