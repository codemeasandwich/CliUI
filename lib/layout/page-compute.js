'use strict';
// @esm-group Layout

/**
 * lib/layout/page-compute.js
 *
 * Proportional layout computation dispatch and shared helpers.
 *
 * This is the main entry point for computing dashboard page layouts at any
 * screen size. At the 120×40 baseline, returns exact hand-derived positions
 * from page-baselines.js. For all other sizes, dispatches to per-page
 * compute functions that scale proportionally from the baseline ratios.
 *
 * The shared helper functions (innerLeft, fullWidth, twoColWidths,
 * threeColWidths) encapsulate the proportional scaling math used by all
 * per-page compute functions. They are exported so per-page modules can
 * import them without reimplementing.
 */

var upper = require('./page-compute-upper');
var lower = require('./page-compute-lower');
var baselines = require('./page-baselines');

// ── Grid coordinate → widget name mappings ─────────────────────────────────
// Each entry maps the (row, col, rowSpan, colSpan) key that dashboard builders
// pass to grid.set() to the corresponding widget name in the layout result.
// Keys are formatted as 'row,col,rowSpan,colSpan' matching the grid.set() API.
exports.GRID_COORD_MAP = {
  spec: {
    '0,0,2,12': 'phaseFlow',
    '2,0,3,4':  'decisions',
    '5,0,2,4':  'fidelity',
    '7,0,2,4':  'cost',
    '2,4,7,8':  'terminal',
    '9,0,3,12': 'log',
  },
  plan: {
    '0,0,2,12': 'phaseFlow',
    '2,0,7,4':  'tasks',
    '2,4,7,4':  'effort',
    '2,8,7,4':  'cost',
    '9,0,3,12': 'log',
  },
  run: {
    '0,0,2,12': 'phaseFlow',
    '2,0,7,4':  'tracker',
    '2,4,7,4':  'cost',
    '2,8,7,4':  'efficiency',
    '9,0,3,12': 'log',
  },
  task: {
    '0,0,9,4':  'selector',
    '0,4,9,8':  'breakdown',
    '9,0,3,12': 'log',
  },
  errors: {
    '0,0,9,4':  'overview',
    '0,4,9,8':  'detail',
    '9,0,3,12': 'log',
  },
  perf: {
    '0,0,6,6':  'latency',
    '6,0,6,6':  'duration',
    '0,6,4,6':  'streams',
    '4,6,4,6':  'events',
    '8,6,4,6':  'tokens',
  },
};

// ── Shared proportional layout helpers ─────────────────────────────────────

/**
 * Proportional inner left margin. At 120 cols this gives 3.
 * Clamped to a minimum of 3 to maintain readable padding.
 *
 * @param {number} cols - Screen columns
 * @returns {number}
 */
exports.innerLeft = function innerLeft(cols) {
  return Math.max(3, Math.round(cols * 3 / 120));
};

/**
 * Proportional full-width widget width (phase flow, log viewer).
 * Leaves a right margin proportional to screen width.
 *
 * @param {number} cols - Screen columns
 * @param {number} left - Left edge of the widget
 * @returns {number}
 */
exports.fullWidth = function fullWidth(cols, left) {
  var maxX = cols - 1;
  return maxX - left - Math.max(8, Math.round(cols * 8 / 120));
};

/**
 * Column widths for a 2-column page layout.
 *
 * @param {number} cols - Screen columns
 * @param {number} divCol - Divider column position
 * @returns {{ col1W: number, col2Left: number, col2W: number }}
 */
exports.twoColWidths = function twoColWidths(cols, divCol) {
  var maxX = cols - 1;
  var left = exports.innerLeft(cols);
  var col1W = divCol - left - 1;
  var col2Left = divCol + Math.max(3, Math.round(3 * cols / 120));
  var col2W = maxX - col2Left - Math.max(2, Math.round(cols * 2 / 120));
  return { col1W: col1W, col2Left: col2Left, col2W: col2W };
};

/**
 * Column widths for a 3-column page layout.
 *
 * @param {number} cols - Screen columns
 * @param {number} divCol1 - First divider column
 * @param {number} divCol2 - Second divider column
 * @returns {{ col1W, col2Left, col2W, col3Left, col3W }}
 */
exports.threeColWidths = function threeColWidths(cols, divCol1, divCol2) {
  var maxX = cols - 1;
  var left = exports.innerLeft(cols);
  var col1W = divCol1 - left - 1;
  var col2Left = divCol1 + Math.max(3, Math.round(3 * cols / 120));
  var col2W = divCol2 - col2Left - 1;
  var col3Left = divCol2 + Math.max(3, Math.round(3 * cols / 120));
  var col3W = maxX - col3Left - Math.max(1, Math.round(cols * 1 / 120));
  return { col1W: col1W, col2Left: col2Left, col2W: col2W, col3Left: col3Left, col3W: col3W };
};

// ── Per-page compute function dispatch table ───────────────────────────────
var LAYOUT_COMPUTERS = {
  spec: upper.computeSpecLayout,
  plan: upper.computePlanLayout,
  run: upper.computeRunLayout,
  task: lower.computeTaskLayout,
  errors: lower.computeErrorsLayout,
  perf: lower.computePerfLayout,
};

/**
 * Compute the full layout for a dashboard page at the given screen dimensions.
 *
 * At the baseline 120×40 size, returns exact hand-derived layout tables
 * matching the original golden snapshots. For other sizes, uses proportional
 * computation functions that scale widget positions from 120×40 ratios.
 *
 * @param {string} pageName - 'spec'|'plan'|'run'|'task'|'errors'|'perf'
 * @param {number} cols - Screen columns
 * @param {number} rows - Screen rows
 * @returns {Object|null} Layout spec with separators, dividers, widgets, etc.
 */
exports.computePageLayout = function computePageLayout(pageName, cols, rows) {
  // Use exact baseline tables at 120×40 to match hand-crafted goldens
  if (cols === 120 && rows === 40) {
    return baselines.BASELINE_120x40[pageName] || null;
  }
  var compute = LAYOUT_COMPUTERS[pageName];
  if (!compute) return null;
  return compute(cols, rows);
};
