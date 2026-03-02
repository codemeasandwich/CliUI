'use strict';
// @esm-group Layout

/**
 * lib/layout/page-pipes-upper.js
 *
 * Static character fixup positions for the spec, plan, and run dashboard pages.
 *
 * Each entry defines positions where the chrome render hook must paint specific
 * characters AFTER all widgets render. These overwrite whatever blessed left in
 * the screen buffer to enforce the template's static-character contract.
 *
 * Three categories of fixups:
 *   1. Gap pipes — │ between adjacent widget boxes where nothing renders
 *   2. Title-row pipes — │ separators between widget titles above ┌──┐ borders
 *   3. Widget-internal pipes — │ field separators inside content areas
 *
 * Entry format:
 *   cols     — array of individual column positions to paint
 *   fromCol  — start of dense column range (inclusive), used with toCol
 *   toCol    — end of dense column range (inclusive), used with fromCol
 *   char     — character to paint (defaults to │ if omitted)
 *   y        — single row position
 *   fromY    — start row of range (inclusive)
 *   toY      — end row of range (inclusive)
 *
 * All positions are absolute (120×40 baseline). For non-baseline sizes the
 * chrome render hook uses the computed layout spec which does not include
 * static pipes (they are only for the hand-derived 120×40 golden snapshots).
 */

// ── Spec page static pipes ──────────────────────────────────────────────────
exports.spec = [
  // Phase flow ║ segment separators (row 6)
  { cols: [16, 32, 51, 64, 77, 92], y: 6, char: '\u2551' },
  // Phase flow right edge (inside phaseFlow box content, right of segments)
  { cols: [3, 105], y: 6 },
  // Decisions content + gap + terminal right edge (rows 12-13)
  { cols: [3, 35, 36, 39, 117], fromY: 12, toY: 13 },
  // Terminal dialog top border ╔═══╗ (row 13)
  { cols: [42], y: 13, char: '\u2554' },
  { fromCol: 43, toCol: 104, y: 13, char: '\u2550' },
  { cols: [105], y: 13, char: '\u2557' },
  // Terminal dialog left ║ (rows 14-22, col 43)
  { cols: [43], fromY: 14, toY: 22, char: '\u2551' },
  // Terminal dialog right ║ (varies per row due to different dialog widths)
  { cols: [104], y: 14, char: '\u2551' },
  { cols: [106], y: 15, char: '\u2551' },
  { cols: [105], y: 16, char: '\u2551' },
  { cols: [106], y: 17, char: '\u2551' },
  { cols: [105], fromY: 18, toY: 19, char: '\u2551' },
  { cols: [104], fromY: 20, toY: 21, char: '\u2551' },
  { cols: [106], y: 22, char: '\u2551' },
  // Terminal dialog bottom border ╚═══╝ (row 23)
  { cols: [43], y: 23, char: '\u255A' },
  { fromCol: 44, toCol: 105, y: 23, char: '\u2550' },
  { cols: [106], y: 23, char: '\u255D' },
  // Terminal left border + right edge (rows 14-17: fidelity/cost gap rows)
  { cols: [40, 117], fromY: 14, toY: 17 },
  // Fidelity/cost left border + right border + terminal borders (rows 18-21)
  { cols: [3, 36, 40, 117], fromY: 18, toY: 21 },
  // Terminal left + right edges (rows 22-25: cost box area)
  { cols: [40, 117], fromY: 22, toY: 25 },
  // Cost box content + gap + terminal right edge (row 26)
  { cols: [3, 17, 35, 36, 39, 117], y: 26 },
  // Cost box bottom + terminal right (row 27)
  { cols: [3, 36, 40, 117], y: 27 },
  // Log viewer right edge (rows 33-36)
  { cols: [3, 108], fromY: 33, toY: 36 },
];

// ── Plan page static pipes ──────────────────────────────────────────────────
exports.plan = [
  // Phase flow ║ segment separators (row 6)
  { cols: [15, 27, 45, 64, 79, 95], y: 6, char: '\u2551' },
  // Phase flow right edge
  { cols: [3, 106], y: 6 },
  // Tasks + effort donut + cost borders (row 12: donut first row, cost │)
  { cols: [3, 36, 40, 71, 75, 89, 118], y: 12 },
  // Task item ─── connectors between name and size slots (rows 12-19)
  { cols: [19, 20], fromY: 12, toY: 19, char: '\u2500' },
  // Effort donut ╭────╮ top arc (row 12)
  { cols: [48], y: 12, char: '\u256D' },
  { fromCol: 49, toCol: 52, y: 12, char: '\u2500' },
  { cols: [53], y: 12, char: '\u256E' },
  // Donut chart rows with varying internal │ positions
  { cols: [3, 36, 40, 70, 71, 74, 118], y: 13 },
  // Effort donut ╭──╯ label ╰──╮ (row 13)
  { cols: [45], y: 13, char: '\u256D' },
  { cols: [46, 47], y: 13, char: '\u2500' },
  { cols: [48], y: 13, char: '\u256F' },
  { cols: [53], y: 13, char: '\u2570' },
  { cols: [54, 55], y: 13, char: '\u2500' },
  { cols: [56], y: 13, char: '\u256E' },
  { cols: [3, 36, 40, 45, 56, 70, 71, 74, 118], y: 14 },
  { cols: [3, 36, 40, 70, 71, 74, 118], y: 15 },
  // Effort donut ╭─╯──────────╰─╮ wide arc (row 15)
  { cols: [43], y: 15, char: '\u256D' },
  { cols: [44], y: 15, char: '\u2500' },
  { cols: [45], y: 15, char: '\u256F' },
  { fromCol: 46, toCol: 55, y: 15, char: '\u2500' },
  { cols: [56], y: 15, char: '\u2570' },
  { cols: [57], y: 15, char: '\u2500' },
  { cols: [58], y: 15, char: '\u256E' },
  { cols: [3, 36, 40, 43, 58, 70, 71, 74, 118], y: 16 },
  { cols: [3, 36, 40, 70, 71, 74, 118], y: 17 },
  // Effort donut ╰─╮──────────╭─╯ wide arc (row 17)
  { cols: [43], y: 17, char: '\u2570' },
  { cols: [44], y: 17, char: '\u2500' },
  { cols: [45], y: 17, char: '\u256E' },
  { fromCol: 46, toCol: 55, y: 17, char: '\u2500' },
  { cols: [56], y: 17, char: '\u256D' },
  { cols: [57], y: 17, char: '\u2500' },
  { cols: [58], y: 17, char: '\u256F' },
  // Donut chart row with shifted positions (row 18)
  { cols: [3, 36, 40, 45, 57, 71, 75, 118], y: 18 },
  { cols: [3, 36, 40, 70, 71, 74, 118], y: 19 },
  // Effort donut ╰──╮ label ╭──╯ (row 19)
  { cols: [45], y: 19, char: '\u2570' },
  { cols: [46, 47], y: 19, char: '\u2500' },
  { cols: [48], y: 19, char: '\u256E' },
  { cols: [53], y: 19, char: '\u256D' },
  { cols: [54, 55], y: 19, char: '\u2500' },
  { cols: [56], y: 19, char: '\u256F' },
  { cols: [3, 36, 40, 48, 70, 71, 74, 118], y: 20 },
  { cols: [3, 36, 40, 70, 71, 74, 118], y: 21 },
  // Effort donut ╰────╯ bottom arc (row 21)
  { cols: [48], y: 21, char: '\u2570' },
  { fromCol: 49, toCol: 52, y: 21, char: '\u2500' },
  { cols: [53], y: 21, char: '\u256F' },
  // Log viewer right edge (rows 26-30: varying widths per logRow)
  { cols: [3, 108], y: 26 },
  { cols: [3, 109], fromY: 27, toY: 29 },
  { cols: [3, 110], y: 30 },
];

// ── Run page static pipes ───────────────────────────────────────────────────
exports.run = [
  // Phase flow ║ segment separators (row 5: gantt bar row 1)
  { cols: [11, 31, 35, 40, 71, 89], y: 5, char: '\u2551' },
  // Phase flow ║ segment separators (row 6: gantt bar row 2, val=3 not 4)
  { cols: [11, 31, 35, 39, 71, 89], y: 6, char: '\u2551' },
  // Phase flow right edge (rows 5-6: gantt bar rows)
  { cols: [3, 108], fromY: 5, toY: 6 },
  // Phase flow task label ─── connectors (row 7: between taskLabel and taskTotal)
  { fromCol: 38, toCol: 78, y: 7, char: '\u2500' },
  { fromCol: 91, toCol: 107, y: 7, char: '\u2500' },
  // Phase flow right edge (row 7: task label row, different width)
  { cols: [3, 109], y: 7 },
  // Title row separators (shifted 1 col left from divider positions)
  { cols: [36, 71], y: 10 },
  // Widget content row 12 (with cost.calls│cost.duration separator at 52)
  { cols: [3, 35, 36, 39, 52, 69, 70, 73, 118], y: 12 },
  // Widget content rows 13-15 (no cost.calls separator)
  { cols: [3, 35, 36, 39, 69, 70, 73, 118], fromY: 13, toY: 15 },
  // Widget content rows 16-18 (different cost slot widths: 28 not 29)
  { cols: [3, 35, 36, 39, 68, 69, 118], fromY: 16, toY: 18 },
  // Post-bottom-border row (between cost bottom and efficiency bottom)
  { cols: [71], y: 20 },
  // Log viewer right edge (rows 24-33: varying widths per logRow)
  { cols: [3, 108], y: 24 },
  { cols: [3, 109], y: 25 },
  { cols: [3, 107], y: 26 },
  { cols: [3, 108], fromY: 27, toY: 33 },
];
