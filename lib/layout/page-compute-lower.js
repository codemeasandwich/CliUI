'use strict';
// @esm-group Layout

/**
 * lib/layout/page-compute-lower.js
 *
 * Proportional layout computation for the task, errors, and perf dashboard pages.
 *
 * Companion to page-compute-upper.js — each function computes exact widget
 * positions for any screen size by scaling from the 120×40 baseline proportions.
 *
 * Helper functions are imported from page-compute.js.
 */

var helpers = require('./page-compute');

/**
 * Compute the task page layout.
 * 2-column: task selector + phase breakdown + log.
 *
 * @param {number} cols - Screen columns
 * @param {number} rows - Screen rows
 * @returns {Object} Layout specification
 */
exports.computeTaskLayout = function computeTaskLayout(cols, rows) {
  var maxY = rows - 1;
  var contentTop = 3;
  var contentBot = maxY - 2;
  var contentH = contentBot - contentTop + 1;

  var heavySep = contentTop + Math.round(contentH * 0.62);
  var divCol = Math.round(cols * 39 / 120);

  var left = helpers.innerLeft(cols);
  var logW = helpers.fullWidth(cols, left);
  var widths = helpers.twoColWidths(cols, divCol);

  var titleY = contentTop + 1;
  var widgetTop = titleY + 1;
  var widgetH = heavySep - 1 - widgetTop + 1;
  // Breakdown is taller than selector — extends 2 rows past the selector bottom
  var breakdownH = widgetH + 2;

  var logTitleY = heavySep + 1;
  var logTop = logTitleY + 1;
  var logBoxH = Math.max(4, contentBot - logTop + 1);

  return {
    page: 'task',
    separators: [
      { y: heavySep, cols: [], dir: 'heavy' },
    ],
    dividers: [
      { col: divCol, fromY: contentTop, toY: heavySep },
    ],
    widgets: {
      selector: { titleY: titleY, titleX: left, top: widgetTop, left: left, width: widths.col1W, height: widgetH },
      breakdown: { titleY: titleY, titleX: widths.col2Left, top: widgetTop, left: widths.col2Left, width: widths.col2W, height: breakdownH },
      log: { titleY: logTitleY, titleX: left, top: logTop, left: left, width: logW, height: logBoxH },
    },
  };
};

/**
 * Compute the errors page layout.
 * 2-column: failure overview + detail + log.
 *
 * @param {number} cols - Screen columns
 * @param {number} rows - Screen rows
 * @returns {Object} Layout specification
 */
exports.computeErrorsLayout = function computeErrorsLayout(cols, rows) {
  var maxY = rows - 1;
  var contentTop = 3;
  var contentBot = maxY - 2;
  var contentH = contentBot - contentTop + 1;

  var divCol = Math.round(cols * 39 / 120);
  var left = helpers.innerLeft(cols);
  var logW = helpers.fullWidth(cols, left);
  var widths = helpers.twoColWidths(cols, divCol);

  // Overview/detail spans ~66% of content height
  var overviewH = Math.round(contentH * 23 / 35);

  var titleY = contentTop + 1;
  var widgetTop = titleY + 1;
  var widgetH = overviewH;

  var logTitleY = widgetTop + widgetH;
  var logTop = logTitleY + 1;
  var logBoxH = Math.max(4, contentBot - logTop + 1);

  return {
    page: 'errors',
    separators: [],
    dividers: [
      { col: divCol, fromY: contentTop, toY: logTitleY },
    ],
    widgets: {
      overview: { titleY: titleY, titleX: left, top: widgetTop, left: left, width: widths.col1W, height: widgetH },
      detail: { titleY: titleY, titleX: widths.col2Left, top: widgetTop, left: widths.col2Left, width: widths.col2W, height: widgetH },
      log: { titleY: logTitleY, titleX: left, top: logTop, left: left, width: logW, height: logBoxH },
    },
  };
};

/**
 * Compute the perf page layout.
 * 2-column: latency/duration left, streams/events/tokens right, status bar.
 *
 * @param {number} cols - Screen columns
 * @param {number} rows - Screen rows
 * @returns {Object} Layout specification
 */
exports.computePerfLayout = function computePerfLayout(cols, rows) {
  var maxX = cols - 1;
  var maxY = rows - 1;
  var contentTop = 3;
  var contentBot = maxY - 2;

  // Perf has status bar + heavy separator
  var statusH = 2;
  var heavySep = contentBot - statusH + 1;
  var usableH = heavySep - contentTop;

  var divCol = Math.round(cols * 41 / 120);
  var left = helpers.innerLeft(cols);

  var col1W = divCol - left - 1;
  var col2Left = divCol + Math.max(3, Math.round(3 * cols / 120));
  var col2W = maxX - col2Left - Math.max(4, Math.round(cols * 4 / 120));

  // Left column: latency (top 55%) + duration (bottom)
  var titleY = contentTop + 1;
  var latencyTop = titleY + 1;
  var latencyH = Math.round(usableH * 0.55);
  var durationTitleY = latencyTop + latencyH;
  var durationTop = durationTitleY + 1;
  var durationH = heavySep - durationTop;

  // Right column: streams (top 33%) + events (mid 30%) + tokens (bottom)
  var streamsTop = latencyTop;
  var rightH = heavySep - streamsTop;
  var streamsH = Math.round(rightH * 0.33);
  var eventsTitleY = streamsTop + streamsH;
  var eventsTop = eventsTitleY + 1;
  var eventsH = Math.round(rightH * 0.30);
  var tokensTitleY = eventsTop + eventsH;
  var tokensTop = tokensTitleY + 1;
  var tokensH = heavySep - tokensTop;

  var statusRow = heavySep + 1;

  return {
    page: 'perf',
    separators: [
      { y: heavySep, cols: [], dir: 'heavy' },
    ],
    dividers: [
      { col: divCol, fromY: contentTop, toY: heavySep },
    ],
    statusRow: statusRow,
    widgets: {
      latency: { titleY: titleY, titleX: left, top: latencyTop, left: left, width: col1W, height: latencyH },
      duration: { titleY: durationTitleY, titleX: left, top: durationTop, left: left, width: col1W, height: durationH },
      streams: { titleY: titleY, titleX: col2Left, top: streamsTop, left: col2Left, width: col2W, height: streamsH },
      events: { titleY: eventsTitleY, titleX: col2Left, top: eventsTop, left: col2Left, width: col2W, height: eventsH },
      tokens: { titleY: tokensTitleY, titleX: col2Left, top: tokensTop, left: col2Left, width: col2W, height: tokensH },
    },
  };
};
