'use strict';
// @esm-group Layout

/**
 * lib/layout/page-compute-upper.js
 *
 * Proportional layout computation for the spec, plan, and run dashboard pages.
 *
 * Each function computes exact widget positions for any screen size by scaling
 * from the 120×40 baseline proportions. Returns a layout spec consumed by
 * chrome.setLayout / chrome.setPage: separators, dividers, widgets, and
 * optionally statusRow.
 *
 * Helper functions (innerLeft, fullWidth, twoColWidths, threeColWidths) are
 * imported from page-compute.js to avoid reimplementation.
 */

var helpers = require('./page-compute');

/**
 * Compute the spec page layout.
 * 2-column: phase flow top, decisions/fidelity/cost left, terminal right, log bottom.
 *
 * @param {number} cols - Screen columns
 * @param {number} rows - Screen rows
 * @returns {Object} Layout specification
 */
exports.computeSpecLayout = function computeSpecLayout(cols, rows) {
  var maxX = cols - 1;
  var maxY = rows - 1;
  var contentTop = 3;
  var contentBot = maxY - 2;
  var contentH = contentBot - contentTop + 1;

  // Proportional section heights (from 120×40 baseline)
  var phaseH = Math.max(7, Math.round(contentH * 0.20));
  var logH = Math.max(7, Math.round(contentH * 0.20));
  var middleH = contentH - phaseH - logH;

  var sepDown = contentTop + phaseH;
  var sepUp = sepDown + middleH + 1;
  var divCol = Math.round(cols * 37 / 120);

  var left = helpers.innerLeft(cols);
  var leftW = divCol - left - 1;
  var rightInnerLeft = divCol + Math.max(3, Math.round(3 * cols / 120));
  var rightW = maxX - rightInnerLeft - Math.max(1, Math.round(cols * 2 / 120));

  // Phase timeline widget
  var phaseTitleY = contentTop + 1;
  var phaseTop = phaseTitleY + 2;
  var phaseBoxH = Math.max(3, Math.min(5, phaseH - 4));
  var phaseW = helpers.fullWidth(cols, left);

  // Middle section widgets
  var midStart = sepDown + 1;
  var midEnd = sepUp - 1;
  var midH = midEnd - midStart + 1;

  // Left widgets — proportional allocation from 120×40 ratios
  var decRatio = 4, fidRatio = 6, costRatio = 4;
  var totalRatio = decRatio + fidRatio + costRatio;
  var availForBoxes = Math.max(9, midH - 3 - 2);
  var rawDecH = Math.max(3, Math.round(availForBoxes * decRatio / totalRatio));
  var rawFidH = Math.max(3, Math.round(availForBoxes * fidRatio / totalRatio));
  var rawCostH = Math.max(3, availForBoxes - rawDecH - rawFidH);
  var hasGaps = midH >= rawDecH + rawFidH + rawCostH + 3 + 2;
  var gap = hasGaps ? 1 : 0;

  var leftTitleY = midStart;
  var decTop = midStart + 1;
  var decH = rawDecH;
  var fidTitleY = decTop + decH + gap;
  var fidTop = fidTitleY + 1;
  var fidH = rawFidH;
  var costTitleY = fidTop + fidH + gap;
  var costTop = costTitleY + 1;
  var costH = Math.min(rawCostH, midEnd - costTop + 1);

  // Right widget (Interactive Terminal) — spans full middle height
  var termTop = decTop;
  var termH = midEnd - termTop + 1;

  // Log section
  var logTitleY = sepUp + 1;
  var logTop = logTitleY + 1;
  var logBoxH = Math.max(4, contentBot - logTop + 1);

  return {
    page: 'spec',
    separators: [
      { y: sepDown, cols: [divCol], dir: 'down' },
      { y: sepUp, cols: [divCol], dir: 'up' },
    ],
    dividers: [
      { col: divCol, fromY: sepDown, toY: sepUp },
    ],
    widgets: {
      phaseFlow: { titleY: phaseTitleY, titleX: left, top: phaseTop, left: left, width: phaseW, height: phaseBoxH },
      decisions: { titleY: leftTitleY, titleX: left, top: decTop, left: left, width: leftW, height: decH },
      fidelity: { titleY: fidTitleY, titleX: left, top: fidTop, left: left, width: leftW, height: fidH },
      cost: { titleY: costTitleY, titleX: left, top: costTop, left: left, width: leftW, height: costH },
      terminal: { titleY: leftTitleY, titleX: rightInnerLeft, top: termTop, left: rightInnerLeft, width: rightW, height: termH },
      log: { titleY: logTitleY, titleX: left, top: logTop, left: left, width: phaseW, height: logBoxH },
    },
  };
};

/**
 * Compute the plan page layout.
 * 3-column: phase flow top, tasks/effort/cost middle, log bottom.
 *
 * @param {number} cols - Screen columns
 * @param {number} rows - Screen rows
 * @returns {Object} Layout specification
 */
exports.computePlanLayout = function computePlanLayout(cols, rows) {
  var maxY = rows - 1;
  var contentTop = 3;
  var contentBot = maxY - 2;
  var contentH = contentBot - contentTop + 1;

  var phaseH = Math.max(7, Math.round(contentH * 0.20));
  var logH = Math.max(7, Math.round(contentH * 0.22));
  var middleH = contentH - phaseH - logH;

  var sepDown = contentTop + phaseH;
  var sepUp = sepDown + middleH + 1;
  var divCol1 = Math.round(cols * 37 / 120);
  var divCol2 = Math.round(cols * 72 / 120);

  var left = helpers.innerLeft(cols);
  var phaseW = helpers.fullWidth(cols, left);
  var widths = helpers.threeColWidths(cols, divCol1, divCol2);

  var phaseTitleY = contentTop + 1;
  var phaseTop = phaseTitleY + 2;
  var phaseBoxH = Math.max(3, Math.min(5, phaseH - 4));

  var midStart = sepDown + 1;
  var midEnd = sepUp - 1;
  var titleY = midStart;
  var widgetTop = midStart + 1;
  var widgetH = midEnd - widgetTop + 1;

  var logTitleY = sepUp + 1;
  var logTop = logTitleY + 1;
  var logBoxH = Math.max(4, contentBot - logTop + 1);

  return {
    page: 'plan',
    separators: [
      { y: sepDown, cols: [divCol1, divCol2], dir: 'down' },
      { y: sepUp, cols: [divCol1, divCol2], dir: 'up' },
    ],
    dividers: [
      { col: divCol1, fromY: sepDown, toY: sepUp },
      { col: divCol2, fromY: sepDown, toY: sepUp },
    ],
    widgets: {
      phaseFlow: { titleY: phaseTitleY, titleX: left, top: phaseTop, left: left, width: phaseW, height: phaseBoxH },
      tasks: { titleY: titleY, titleX: left, top: widgetTop, left: left, width: widths.col1W, height: widgetH },
      effort: { titleY: titleY, titleX: widths.col2Left, top: widgetTop, left: widths.col2Left, width: widths.col2W, height: widgetH },
      cost: { titleY: titleY, titleX: widths.col3Left, top: widgetTop, left: widths.col3Left, width: widths.col3W, height: widgetH },
      log: { titleY: logTitleY, titleX: left, top: logTop, left: left, width: phaseW, height: logBoxH },
    },
  };
};

/**
 * Compute the run page layout.
 * 3-column: phase flow (taller), tracker/cost/efficiency, log, status bar.
 *
 * @param {number} cols - Screen columns
 * @param {number} rows - Screen rows
 * @returns {Object} Layout specification
 */
exports.computeRunLayout = function computeRunLayout(cols, rows) {
  var maxY = rows - 1;
  var contentTop = 3;
  var contentBot = maxY - 2;
  var contentH = contentBot - contentTop + 1;

  var phaseH = Math.max(7, Math.round(contentH * 0.17));
  var statusH = 2;
  var logH = Math.max(8, Math.round(contentH * 0.42));
  var middleH = contentH - phaseH - logH - statusH;

  var sepDown = contentTop + phaseH;
  var sepUp = sepDown + middleH + 1;
  var heavySep = contentBot - statusH + 1;
  var divCol1 = Math.round(cols * 37 / 120);
  var divCol2 = Math.round(cols * 72 / 120);

  var left = helpers.innerLeft(cols);
  var phaseW = helpers.fullWidth(cols, left);
  var widths = helpers.threeColWidths(cols, divCol1, divCol2);

  var phaseTitleY = contentTop;
  var phaseTop = contentTop + 1;
  var phaseBoxH = Math.max(5, phaseH - 2);

  var midStart = sepDown + 1;
  var titleY = midStart;
  var widgetTop = midStart + 1;
  var widgetH = sepUp - 1 - widgetTop + 1;

  var logTitleY = sepUp + 1;
  var logTop = logTitleY + 1;
  var logBoxH = Math.max(4, heavySep - 1 - logTop + 1);
  var statusRow = heavySep + 1;

  return {
    page: 'run',
    separators: [
      { y: sepDown, cols: [divCol1, divCol2], dir: 'down' },
      { y: sepUp, cols: [divCol1, divCol2], dir: 'up' },
      { y: heavySep, cols: [], dir: 'heavy' },
    ],
    dividers: [
      { col: divCol1, fromY: sepDown, toY: sepUp },
      { col: divCol2, fromY: sepDown, toY: sepUp },
    ],
    statusRow: statusRow,
    widgets: {
      phaseFlow: { titleY: phaseTitleY, titleX: left, top: phaseTop, left: left, width: phaseW, height: phaseBoxH },
      tracker: { titleY: titleY, titleX: left, top: widgetTop, left: left, width: widths.col1W, height: widgetH },
      cost: { titleY: titleY, titleX: widths.col2Left, top: widgetTop, left: widths.col2Left, width: widths.col2W, height: widgetH },
      efficiency: { titleY: titleY, titleX: widths.col3Left, top: widgetTop, left: widths.col3Left, width: widths.col3W, height: widgetH },
      log: { titleY: logTitleY, titleX: left, top: logTop, left: left, width: phaseW, height: logBoxH },
    },
  };
};
