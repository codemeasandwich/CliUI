'use strict';

/**
 * lib/border/intersection.js
 *
 * Canonical mixed-stroke intersection resolver for Unicode box-drawing characters.
 *
 * Maps 4-directional stroke intent (up/down/left/right, each: none/light/heavy)
 * to the correct Unicode box-drawing glyph from the U+2500–U+257F range.
 *
 * Why this exists:
 *   When a heavy outer frame (┃ ━ ┏ ┛) meets light inner box borders (│ ─ ╭ ╯),
 *   the intersection cell must use a mixed-stroke junction glyph (e.g. ┷ ┯ ┡ ┩).
 *   Without a canonical resolver, renderers fall back to last-write-wins or
 *   generic tees, producing visually broken joins that violate the exact glyph
 *   contract required by cutout-aware body rendering.
 *
 * Stroke weights:
 *   0 = none (no connection in this direction)
 *   1 = light (thin line: ─ │)
 *   2 = heavy (thick line: ━ ┃)
 *
 * The resolver key is a 4-digit string "UDLR" encoding up/down/left/right weights.
 * Example: "2102" means heavy-up, light-down, none-left, heavy-right → ┡
 *
 * Rounded corners are handled separately — they only apply when all connections
 * are light and the caller explicitly requests rounding via resolveRounded().
 */

// ── Stroke weight constants ─────────────────────────────────────────────
/** No connection in this direction */
var NONE  = 0;
/** Light (thin) stroke weight */
var LIGHT = 1;
/** Heavy (thick) stroke weight */
var HEAVY = 2;

/**
 * Build a 4-digit lookup key from directional stroke weights.
 * Order: up, down, left, right.
 *
 * @param {number} up    - 0=none, 1=light, 2=heavy
 * @param {number} down  - 0=none, 1=light, 2=heavy
 * @param {number} left  - 0=none, 1=light, 2=heavy
 * @param {number} right - 0=none, 1=light, 2=heavy
 * @returns {string} 4-char key like "1102"
 */
function key(up, down, left, right) {
  return '' + up + down + left + right;
}

/**
 * Master glyph lookup table — maps every valid combination of directional
 * stroke weights to its Unicode box-drawing character.
 *
 * Coverage: horizontals, verticals, corners, tees, crosses for light, heavy,
 * and all mixed-weight combinations. ~80 entries covering the full U+2500–U+257F
 * box-drawing block relevant to border intersection rendering.
 *
 * Organized by structural category for maintainability and audit clarity.
 */
var GLYPH_MAP = {};

// ── Straight lines (2 connections, opposite directions) ──────────────────

// Horizontal lines: left+right only
GLYPH_MAP[key(0,0,1,1)] = '\u2500'; // ─  light horizontal
GLYPH_MAP[key(0,0,2,2)] = '\u2501'; // ━  heavy horizontal
GLYPH_MAP[key(0,0,1,2)] = '\u257C'; // ╼  light left, heavy right
GLYPH_MAP[key(0,0,2,1)] = '\u257E'; // ╾  heavy left, light right

// Vertical lines: up+down only
GLYPH_MAP[key(1,1,0,0)] = '\u2502'; // │  light vertical
GLYPH_MAP[key(2,2,0,0)] = '\u2503'; // ┃  heavy vertical
GLYPH_MAP[key(1,2,0,0)] = '\u257D'; // ╽  light up, heavy down
GLYPH_MAP[key(2,1,0,0)] = '\u257F'; // ╿  heavy up, light down

// ── Corners (2 connections, adjacent directions) ─────────────────────────

// All-light corners
GLYPH_MAP[key(0,1,0,1)] = '\u250C'; // ┌  down+right light
GLYPH_MAP[key(0,1,1,0)] = '\u2510'; // ┐  down+left light
GLYPH_MAP[key(1,0,0,1)] = '\u2514'; // └  up+right light
GLYPH_MAP[key(1,0,1,0)] = '\u2518'; // ┘  up+left light

// All-heavy corners
GLYPH_MAP[key(0,2,0,2)] = '\u250F'; // ┏  down+right heavy
GLYPH_MAP[key(0,2,2,0)] = '\u2513'; // ┓  down+left heavy
GLYPH_MAP[key(2,0,0,2)] = '\u2517'; // ┗  up+right heavy
GLYPH_MAP[key(2,0,2,0)] = '\u251B'; // ┛  up+left heavy

// Mixed-weight corners: down+right
GLYPH_MAP[key(0,1,0,2)] = '\u250D'; // ┍  down-light, right-heavy
GLYPH_MAP[key(0,2,0,1)] = '\u250E'; // ┎  down-heavy, right-light
// Mixed-weight corners: down+left
GLYPH_MAP[key(0,1,2,0)] = '\u2511'; // ┑  down-light, left-heavy
GLYPH_MAP[key(0,2,1,0)] = '\u2512'; // ┒  down-heavy, left-light
// Mixed-weight corners: up+right
GLYPH_MAP[key(1,0,0,2)] = '\u2515'; // ┕  up-light, right-heavy
GLYPH_MAP[key(2,0,0,1)] = '\u2516'; // ┖  up-heavy, right-light
// Mixed-weight corners: up+left
GLYPH_MAP[key(1,0,2,0)] = '\u2519'; // ┙  up-light, left-heavy
GLYPH_MAP[key(2,0,1,0)] = '\u251A'; // ┚  up-heavy, left-light

// ── Tees (3 connections) ─────────────────────────────────────────────────

// Light tees (all-light)
GLYPH_MAP[key(1,1,0,1)] = '\u251C'; // ├  vertical-light, branch-right-light
GLYPH_MAP[key(1,1,1,0)] = '\u2524'; // ┤  vertical-light, branch-left-light
GLYPH_MAP[key(0,1,1,1)] = '\u252C'; // ┬  horizontal-light, branch-down-light
GLYPH_MAP[key(1,0,1,1)] = '\u2534'; // ┴  horizontal-light, branch-up-light

// Heavy tees (all-heavy)
GLYPH_MAP[key(2,2,0,2)] = '\u2523'; // ┣  vertical-heavy, branch-right-heavy
GLYPH_MAP[key(2,2,2,0)] = '\u252B'; // ┫  vertical-heavy, branch-left-heavy
GLYPH_MAP[key(0,2,2,2)] = '\u2533'; // ┳  horizontal-heavy, branch-down-heavy
GLYPH_MAP[key(2,0,2,2)] = '\u253B'; // ┻  horizontal-heavy, branch-up-heavy

// Mixed tees — vertical trunk light, branch-right variations
GLYPH_MAP[key(1,1,0,2)] = '\u251D'; // ┝  vert-light, right-heavy
GLYPH_MAP[key(2,1,0,1)] = '\u251E'; // ┞  up-heavy, down-light, right-light
GLYPH_MAP[key(1,2,0,1)] = '\u251F'; // ┟  up-light, down-heavy, right-light
GLYPH_MAP[key(2,2,0,1)] = '\u2520'; // ┠  vert-heavy, right-light
GLYPH_MAP[key(2,1,0,2)] = '\u2521'; // ┡  up-heavy, down-light, right-heavy
GLYPH_MAP[key(1,2,0,2)] = '\u2522'; // ┢  up-light, down-heavy, right-heavy

// Mixed tees — vertical trunk light, branch-left variations
GLYPH_MAP[key(1,1,2,0)] = '\u2525'; // ┥  vert-light, left-heavy
GLYPH_MAP[key(2,1,1,0)] = '\u2526'; // ┦  up-heavy, down-light, left-light
GLYPH_MAP[key(1,2,1,0)] = '\u2527'; // ┧  up-light, down-heavy, left-light
GLYPH_MAP[key(2,2,1,0)] = '\u2528'; // ┨  vert-heavy, left-light
GLYPH_MAP[key(2,1,2,0)] = '\u2529'; // ┩  up-heavy, down-light, left-heavy
GLYPH_MAP[key(1,2,2,0)] = '\u252A'; // ┪  up-light, down-heavy, left-heavy

// Mixed tees — horizontal trunk, branch-down variations
GLYPH_MAP[key(0,1,1,2)] = '\u252D'; // ┭  left-light, right-heavy, down-light
GLYPH_MAP[key(0,1,2,1)] = '\u252E'; // ┮  left-heavy, right-light, down-light
GLYPH_MAP[key(0,1,2,2)] = '\u252F'; // ┯  horiz-heavy, down-light
GLYPH_MAP[key(0,2,1,1)] = '\u2530'; // ┰  horiz-light, down-heavy
GLYPH_MAP[key(0,2,1,2)] = '\u2531'; // ┱  left-light, right-heavy, down-heavy
GLYPH_MAP[key(0,2,2,1)] = '\u2532'; // ┲  left-heavy, right-light, down-heavy

// Mixed tees — horizontal trunk, branch-up variations
GLYPH_MAP[key(1,0,1,2)] = '\u2535'; // ┵  left-light, right-heavy, up-light
GLYPH_MAP[key(1,0,2,1)] = '\u2536'; // ┶  left-heavy, right-light, up-light
GLYPH_MAP[key(1,0,2,2)] = '\u2537'; // ┷  horiz-heavy, up-light
GLYPH_MAP[key(2,0,1,1)] = '\u2538'; // ┸  horiz-light, up-heavy
GLYPH_MAP[key(2,0,1,2)] = '\u2539'; // ┹  left-light, right-heavy, up-heavy
GLYPH_MAP[key(2,0,2,1)] = '\u253A'; // ┺  left-heavy, right-light, up-heavy

// ── Crosses (4 connections) ──────────────────────────────────────────────

// All-light cross
GLYPH_MAP[key(1,1,1,1)] = '\u253C'; // ┼

// All-heavy cross
GLYPH_MAP[key(2,2,2,2)] = '\u254B'; // ╋

// Mixed crosses — selected important ones
GLYPH_MAP[key(1,1,1,2)] = '\u253D'; // ┽  vert-light, left-light, right-heavy
GLYPH_MAP[key(1,1,2,1)] = '\u253E'; // ┾  vert-light, left-heavy, right-light
GLYPH_MAP[key(1,1,2,2)] = '\u253F'; // ┿  vert-light, horiz-heavy
GLYPH_MAP[key(2,1,1,1)] = '\u2540'; // ╀  up-heavy, down-light, horiz-light
GLYPH_MAP[key(1,2,1,1)] = '\u2541'; // ╁  up-light, down-heavy, horiz-light
GLYPH_MAP[key(2,2,1,1)] = '\u2542'; // ╂  vert-heavy, horiz-light
GLYPH_MAP[key(2,1,1,2)] = '\u2543'; // ╃  up-heavy, down-light, left-light, right-heavy
GLYPH_MAP[key(2,1,2,1)] = '\u2544'; // ╄  up-heavy, down-light, left-heavy, right-light
GLYPH_MAP[key(1,2,1,2)] = '\u2545'; // ╅  up-light, down-heavy, left-light, right-heavy
GLYPH_MAP[key(1,2,2,1)] = '\u2546'; // ╆  up-light, down-heavy, left-heavy, right-light
GLYPH_MAP[key(2,1,2,2)] = '\u2547'; // ╇  up-heavy, down-light, horiz-heavy
GLYPH_MAP[key(1,2,2,2)] = '\u2548'; // ╈  up-light, down-heavy, horiz-heavy
GLYPH_MAP[key(2,2,1,2)] = '\u2549'; // ╉  vert-heavy, left-light, right-heavy
GLYPH_MAP[key(2,2,2,1)] = '\u254A'; // ╊  vert-heavy, left-heavy, right-light

// ── Single-direction stubs (1 connection) ────────────────────────────────

GLYPH_MAP[key(1,0,0,0)] = '\u2575'; // ╵  light up only
GLYPH_MAP[key(0,1,0,0)] = '\u2577'; // ╷  light down only
GLYPH_MAP[key(0,0,1,0)] = '\u2574'; // ╴  light left only
GLYPH_MAP[key(0,0,0,1)] = '\u2576'; // ╶  light right only
GLYPH_MAP[key(2,0,0,0)] = '\u2579'; // ╹  heavy up only
GLYPH_MAP[key(0,2,0,0)] = '\u257B'; // ╻  heavy down only
GLYPH_MAP[key(0,0,2,0)] = '\u2578'; // ╸  heavy left only
GLYPH_MAP[key(0,0,0,2)] = '\u257A'; // ╺  heavy right only

// ── Rounded corners ─────────────────────────────────────────────────────
// These are stored separately because they override light corners when
// the caller explicitly requests rounding.

var ROUNDED_MAP = {
  '0101': '\u256D', // ╭  down+right rounded
  '0110': '\u256E', // ╮  down+left rounded
  '1001': '\u2570', // ╰  up+right rounded
  '1010': '\u256F', // ╯  up+left rounded
};

/**
 * Resolve directional stroke weights to the correct Unicode box-drawing glyph.
 *
 * Looks up the glyph in the master table using the 4-directional weight key.
 * Returns null if no matching glyph exists (e.g. invalid combination or no
 * connections at all).
 *
 * @param {number} up    - 0=none, 1=light, 2=heavy
 * @param {number} down  - 0=none, 1=light, 2=heavy
 * @param {number} left  - 0=none, 1=light, 2=heavy
 * @param {number} right - 0=none, 1=light, 2=heavy
 * @returns {string|null} Unicode box-drawing character, or null if unmapped
 */
function resolve(up, down, left, right) {
  var k = key(up, down, left, right);
  return GLYPH_MAP[k] || null;
}

/**
 * Resolve with rounded-corner preference.
 *
 * If the key matches a rounded corner entry and rounded is requested,
 * returns the rounded glyph. Otherwise falls back to the standard resolver.
 * Rounded corners only exist for all-light 2-connection corners.
 *
 * @param {number} up    - 0=none, 1=light, 2=heavy
 * @param {number} down  - 0=none, 1=light, 2=heavy
 * @param {number} left  - 0=none, 1=light, 2=heavy
 * @param {number} right - 0=none, 1=light, 2=heavy
 * @param {boolean} rounded - true to prefer rounded corner glyphs
 * @returns {string|null} Unicode box-drawing character, or null if unmapped
 */
function resolveRounded(up, down, left, right, rounded) {
  var k = key(up, down, left, right);
  if (rounded && ROUNDED_MAP[k]) {
    return ROUNDED_MAP[k];
  }
  return GLYPH_MAP[k] || null;
}

// ── Exports ──────────────────────────────────────────────────────────────

exports.NONE  = NONE;
exports.LIGHT = LIGHT;
exports.HEAVY = HEAVY;
exports.resolve = resolve;
exports.resolveRounded = resolveRounded;
exports.key = key;
// Expose maps for testing/verification only
exports._GLYPH_MAP = GLYPH_MAP;
exports._ROUNDED_MAP = ROUNDED_MAP;
