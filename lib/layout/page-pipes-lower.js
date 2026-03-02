'use strict';
// @esm-group Layout

/**
 * lib/layout/page-pipes-lower.js
 *
 * Static character fixup positions for the task, errors, and perf dashboard pages.
 *
 * Companion to page-pipes-upper.js — see that file for format documentation.
 * Positions are absolute (120×40 baseline) and painted by the chrome render
 * hook after all widgets render to enforce the template's static-character
 * contract.
 */

// ── Task page static pipes ──────────────────────────────────────────────────
exports.task = [
  // Selector content + gap + breakdown borders (rows 6-8)
  { cols: [3, 37, 38, 41, 116], fromY: 6, toY: 8 },
  // Row 9 adds breakdown phase │ at col 88
  { cols: [3, 37, 38, 41, 88, 116], y: 9 },
  // Row 10 (back to base set)
  { cols: [3, 37, 38, 41, 116], y: 10 },
  // Task selector tree ├ branch characters (rows 10-15)
  { cols: [7], fromY: 10, toY: 15, char: '\u251C' },
  // Task selector tree └ final branch (row 16)
  { cols: [7], y: 16, char: '\u2514' },
  // Breakdown sub-tree └ connectors (execute sub at row 10, commit sub at 17)
  { cols: [53], y: 10, char: '\u2514' },
  // Rows 11-13: selector bottom + breakdown content (different cols)
  { cols: [3, 38, 42, 116], fromY: 11, toY: 13 },
  // Rows 14-16: breakdown phase separators at varying positions
  { cols: [3, 38, 42, 65, 116], y: 14 },
  { cols: [3, 38, 42, 70, 83, 116], y: 15 },
  { cols: [3, 38, 42, 86, 116], y: 16 },
  // Rows 17-18: selector post-bottom + breakdown content
  { cols: [3, 37, 38, 41, 116], fromY: 17, toY: 18 },
  // Breakdown sub-tree └ connector (commit sub at row 17)
  { cols: [53], y: 17, char: '\u2514' },
  // Row 19: adds breakdown sub-phase │ at col 73
  { cols: [3, 37, 38, 41, 73, 116], y: 19 },
  // Row 20: breakdown bottom area
  { cols: [42, 80, 116], y: 20 },
  // Row 21: breakdown final row
  { cols: [42, 116], y: 21 },
  // Breakdown sub-tree └ connector (rerun sub at row 21)
  { cols: [54], y: 21, char: '\u2514' },
  // Log viewer right edge (rows 26-29)
  { cols: [3, 108], fromY: 26, toY: 29 },
];

// ── Errors page static pipes ────────────────────────────────────────────────
exports.errors = [
  // Rows 6-7: overview + detail borders
  { cols: [3, 38, 42, 116], fromY: 6, toY: 7 },
  // Failures sub-box top border ┌──┐ (row 7)
  { cols: [6], y: 7, char: '\u250C' },
  { fromCol: 7, toCol: 32, y: 7, char: '\u2500' },
  { cols: [33], y: 7, char: '\u2510' },
  // Rows 8-13: overview sub-box borders (│ at cols 6 and 32)
  { cols: [3, 6, 32, 37, 38, 41, 116], fromY: 8, toY: 13 },
  // Row 14: adds detail rerun separator at col 60
  { cols: [3, 6, 32, 37, 38, 41, 60, 116], y: 14 },
  // Failures sub-box bottom border └──┘ (row 15)
  { cols: [6], y: 15, char: '\u2514' },
  { fromCol: 7, toCol: 32, y: 15, char: '\u2500' },
  { cols: [33], y: 15, char: '\u2518' },
  // Rows 15-18: overview content (sub-box ended)
  { cols: [3, 38, 42, 116], fromY: 15, toY: 18 },
  // Escalations sub-box top border ┌──┐ (row 18)
  { cols: [6], y: 18, char: '\u250C' },
  { fromCol: 7, toCol: 32, y: 18, char: '\u2500' },
  { cols: [33], y: 18, char: '\u2510' },
  // Rows 19-21: overview escalation sub-box (│ at cols 6 and 33)
  { cols: [3, 6, 33, 38, 42, 116], fromY: 19, toY: 21 },
  // Escalations sub-box bottom └──┘ + detail logs sub-box top ┌──┐ (row 22)
  { cols: [3, 38, 42, 116], y: 22 },
  { cols: [6], y: 22, char: '\u2514' },
  { fromCol: 7, toCol: 32, y: 22, char: '\u2500' },
  { cols: [33], y: 22, char: '\u2518' },
  { cols: [45], y: 22, char: '\u250C' },
  { fromCol: 46, toCol: 47, y: 22, char: '\u2500' },
  { fromCol: 69, toCol: 110, y: 22, char: '\u2500' },
  { cols: [111], y: 22, char: '\u2510' },
  // Rows 23-25: detail logs sub-box at cols 45, 104
  { cols: [3, 38, 42, 45, 104, 116], fromY: 23, toY: 25 },
  // Detail logs sub-box bottom └──┘ (row 26)
  { cols: [3, 38, 42, 116], y: 26 },
  { cols: [45], y: 26, char: '\u2514' },
  { fromCol: 46, toCol: 110, y: 26, char: '\u2500' },
  { cols: [111], y: 26, char: '\u2518' },
];

// ── Perf page static pipes ──────────────────────────────────────────────────
exports.perf = [
  // Title row separator (no phase flow on perf page)
  { cols: [40], y: 4 },
  // Latency + stream borders (rows 6-10)
  { cols: [3, 40, 44, 114], fromY: 6, toY: 10 },
  // Sonnet latency histogram axis ──┼────┼───┼───┼───p95── (row 11)
  { cols: [3, 39, 40, 43, 114], y: 11 },
  { fromCol: 5, toCol: 6, y: 11, char: '\u2500' },
  { cols: [7], y: 11, char: '\u253C' },
  { fromCol: 8, toCol: 11, y: 11, char: '\u2500' },
  { cols: [12], y: 11, char: '\u253C' },
  { fromCol: 13, toCol: 15, y: 11, char: '\u2500' },
  { cols: [16], y: 11, char: '\u253C' },
  { fromCol: 17, toCol: 19, y: 11, char: '\u2500' },
  { cols: [20], y: 11, char: '\u253C' },
  { fromCol: 21, toCol: 23, y: 11, char: '\u2500' },
  { fromCol: 27, toCol: 28, y: 11, char: '\u2500' },
  // Latency + stream content (row 12)
  { cols: [3, 40, 44, 114], y: 12 },
  // Latency-only rows (stream box ended at row 13)
  { cols: [3, 40], fromY: 13, toY: 16 },
  // Latency + stream event borders (row 17)
  { cols: [3, 40, 44, 114], y: 17 },
  // Opus latency histogram axis ──┼────┼───┼───────────────┼──p95 (row 18)
  { cols: [3, 39, 40, 43, 114], y: 18 },
  { fromCol: 6, toCol: 7, y: 18, char: '\u2500' },
  { cols: [8], y: 18, char: '\u253C' },
  { fromCol: 9, toCol: 12, y: 18, char: '\u2500' },
  { cols: [13], y: 18, char: '\u253C' },
  { fromCol: 14, toCol: 16, y: 18, char: '\u2500' },
  { cols: [17], y: 18, char: '\u253C' },
  { fromCol: 18, toCol: 32, y: 18, char: '\u2500' },
  { cols: [33], y: 18, char: '\u253C' },
  { fromCol: 34, toCol: 35, y: 18, char: '\u2500' },
  // Latency + stream event content (rows 19-20)
  { cols: [3, 40, 44, 114], fromY: 19, toY: 20 },
  // Stream event only (latency box ended at row 21)
  { cols: [44, 114], fromY: 21, toY: 22 },
  // Duration box only (rows 25-26: no right-side box)
  { cols: [3, 40], fromY: 25, toY: 26 },
  // Duration + tokens borders (rows 27-30)
  { cols: [3, 40, 44, 114], fromY: 27, toY: 30 },
  // Duration histogram axis ──┼────┼───┼────────────┼──p95── (row 28)
  { fromCol: 6, toCol: 7, y: 28, char: '\u2500' },
  { cols: [8], y: 28, char: '\u253C' },
  { fromCol: 9, toCol: 12, y: 28, char: '\u2500' },
  { cols: [13], y: 28, char: '\u253C' },
  { fromCol: 14, toCol: 16, y: 28, char: '\u2500' },
  { cols: [17], y: 28, char: '\u253C' },
  { fromCol: 18, toCol: 29, y: 28, char: '\u2500' },
  { cols: [30], y: 28, char: '\u253C' },
  { fromCol: 31, toCol: 32, y: 28, char: '\u2500' },
  { fromCol: 36, toCol: 37, y: 28, char: '\u2500' },
];
