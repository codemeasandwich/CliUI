'use strict';
// @esm-group Layout

/**
 * lib/layout/page-baselines.js
 *
 * Hand-derived 120×40 baseline layout positions for all 6 dashboard pages.
 *
 * These are the exact widget positions that match the hand-crafted golden
 * snapshot files at 120×40. Used when cols===120 && rows===40 to avoid
 * proportional rounding differences. The proportional compute functions
 * (in page-compute-upper.js / page-compute-lower.js) were developed for
 * 245×75 and 121×33 and produce slightly different positions at 120×40
 * due to rounding.
 *
 * Each page entry includes:
 *   - separators, dividers, widgets — layout specification
 *   - staticPipes — per-cell character fixup positions from page-pipes-*.js
 *   - phaseFlow — slot widths for phase flow ║ alignment (optional)
 *   - statusRow — row index for the status bar (run + perf pages)
 */

var pipesUpper = require('./page-pipes-upper');
var pipesLower = require('./page-pipes-lower');

exports.BASELINE_120x40 = {
  spec: {
    page: 'spec',
    separators: [
      { y: 9, cols: [37], dir: 'down' },
      { y: 30, cols: [37], dir: 'up' },
    ],
    dividers: [
      { col: 37, fromY: 9, toY: 30 },
    ],
    widgets: {
      phaseFlow: { top: 5, left: 3, width: 108, height: 3, titleY: 4, titleX: 3 },
      decisions: { top: 11, left: 3, width: 34, height: 4, titleY: 10, titleX: 3 },
      fidelity: { top: 17, left: 3, width: 34, height: 6, titleY: 16, titleX: 3 },
      cost: { top: 25, left: 3, width: 34, height: 4, titleY: 24, titleX: 3 },
      terminal: { top: 11, left: 40, width: 78, height: 18, titleY: 10, titleX: 40 },
      log: { top: 32, left: 3, width: 108, height: 6, titleY: 31, titleX: 3 },
    },
    phaseFlow: { barSlots: [12, 15, 18, 12, 12, 14] },
    staticPipes: pipesUpper.spec,
  },
  plan: {
    page: 'plan',
    separators: [
      { y: 9, cols: [37, 72], dir: 'down' },
      { y: 23, cols: [37, 72], dir: 'up' },
    ],
    dividers: [
      { col: 37, fromY: 9, toY: 23 },
      { col: 72, fromY: 9, toY: 23 },
    ],
    widgets: {
      phaseFlow: { top: 5, left: 3, width: 108, height: 3, titleY: 4, titleX: 3 },
      tasks: { top: 11, left: 3, width: 34, height: 12, titleY: 10, titleX: 3 },
      effort: { top: 11, left: 40, width: 32, height: 12, titleY: 10, titleX: 40 },
      cost: { top: 11, left: 75, width: 44, height: 12, titleY: 10, titleX: 75 },
      log: { top: 25, left: 3, width: 108, height: 7, titleY: 24, titleX: 3 },
    },
    phaseFlow: { barSlots: [11, 11, 17, 18, 14, 15] },
    staticPipes: pipesUpper.plan,
  },
  run: {
    page: 'run',
    separators: [
      { y: 9, cols: [37, 72], dir: 'down' },
      { y: 21, cols: [37, 72], dir: 'up' },
      { y: 36, cols: [], dir: 'heavy' },
    ],
    dividers: [
      { col: 37, fromY: 9, toY: 21 },
      { col: 72, fromY: 9, toY: 21 },
    ],
    statusRow: 37,
    widgets: {
      phaseFlow: { top: 4, left: 3, width: 108, height: 5, titleY: 3, titleX: 3 },
      tracker: { top: 11, left: 3, width: 34, height: 9, titleY: 10, titleX: 3 },
      cost: { top: 11, left: 40, width: 32, height: 9, titleY: 10, titleX: 40 },
      efficiency: { top: 11, left: 75, width: 44, height: 9, titleY: 10, titleX: 75 },
      log: { top: 23, left: 3, width: 108, height: 12, titleY: 22, titleX: 3 },
    },
    phaseFlow: {
      barSlots: [ [7, 19, 3, 4, 30, 17], [7, 19, 3, 3, 31, 17] ],
      taskLine: { nameWidth: 34, timeCol: 75 },
    },
    staticPipes: pipesUpper.run,
  },
  task: {
    page: 'task',
    separators: [
      { y: 23, cols: [], dir: 'heavy' },
    ],
    dividers: [
      { col: 39, fromY: 3, toY: 23 },
    ],
    widgets: {
      selector: { top: 5, left: 3, width: 36, height: 16, titleY: 4, titleX: 3 },
      breakdown: { top: 5, left: 42, width: 75, height: 18, titleY: 4, titleX: 42 },
      log: { top: 25, left: 3, width: 108, height: 6, titleY: 24, titleX: 3 },
    },
    staticPipes: pipesLower.task,
  },
  errors: {
    page: 'errors',
    separators: [],
    dividers: [
      { col: 39, fromY: 3, toY: 28 },
    ],
    widgets: {
      overview: { top: 5, left: 3, width: 36, height: 23, titleY: 4, titleX: 3 },
      detail: { top: 5, left: 42, width: 75, height: 23, titleY: 4, titleX: 42 },
      log: { top: 29, left: 3, width: 108, height: 8, titleY: 28, titleX: 3 },
    },
    staticPipes: pipesLower.errors,
  },
  perf: {
    page: 'perf',
    separators: [
      { y: 32, cols: [], dir: 'heavy' },
    ],
    dividers: [
      { col: 41, fromY: 3, toY: 32 },
    ],
    statusRow: 33,
    widgets: {
      latency: { top: 5, left: 3, width: 38, height: 17, titleY: 4, titleX: 3 },
      duration: { top: 24, left: 3, width: 38, height: 8, titleY: 23, titleX: 3 },
      streams: { top: 5, left: 44, width: 71, height: 9, titleY: 4, titleX: 44 },
      events: { top: 16, left: 44, width: 71, height: 8, titleY: 15, titleX: 44 },
      tokens: { top: 26, left: 44, width: 71, height: 6, titleY: 25, titleX: 44 },
    },
    staticPipes: pipesLower.perf,
  },
};
