'use strict';
// @esm-group Border

/**
 * lib/border/charsets.js
 *
 * Canonical border character-set definitions for CliUI widgets.
 *
 * Each charset is a plain object whose keys name the structural positions
 * of a rectangular border (topLeft, topRight, bottomLeft, bottomRight,
 * horizontal, vertical).  Additional charsets extend this base vocabulary
 * with diagram-specific symbols such as dashed segments, connector gates,
 * animated dot markers, junction/tee characters, and arrowheads.
 *
 * The `resolveCharset` helper converts a user-supplied border option into
 * the concrete character object used by renderers.
 *
 * Why every symbol is listed explicitly:
 *   The spec (issue #3 §6) declares that the chosen characters are
 *   *contractual* — they must never be silently substituted.  Centralising
 *   them here prevents hard-coded magic characters from scattering across
 *   rendering code and makes regression audits trivial.
 */

/** @type {Record<string, Record<string, string>>} */
const CHARSETS = {

  /* ── Standard single-line box-drawing set ──────────────────────────
   * Used as the default border for ordinary boxes (spec §6.1).
   */
  light: {
    topLeft:     '\u250C', // ┌
    topRight:    '\u2510', // ┐
    bottomLeft:  '\u2514', // └
    bottomRight: '\u2518', // ┘
    horizontal:  '\u2500', // ─
    vertical:    '\u2502'  // │
  },

  /* ── Heavy (thick) box-drawing set ─────────────────────────────── */
  heavy: {
    topLeft:     '\u250F', // ┏
    topRight:    '\u2513', // ┓
    bottomLeft:  '\u2517', // ┗
    bottomRight: '\u251B', // ┛
    horizontal:  '\u2501', // ━
    vertical:    '\u2503'  // ┃
  },

  /* ── Double-line box-drawing set ───────────────────────────────── */
  double: {
    topLeft:     '\u2554', // ╔
    topRight:    '\u2557', // ╗
    bottomLeft:  '\u255A', // ╚
    bottomRight: '\u255D', // ╝
    horizontal:  '\u2550', // ═
    vertical:    '\u2551'  // ║
  },

  /* ── Rounded-corner box-drawing set ────────────────────────────── */
  rounded: {
    topLeft:     '\u256D', // ╭
    topRight:    '\u256E', // ╮
    bottomLeft:  '\u2570', // ╰
    bottomRight: '\u256F', // ╯
    horizontal:  '\u2500', // ─
    vertical:    '\u2502'  // │
  },

  /* ── Current-work dashed / rounded border family (spec §6.4) ─────
   *
   * Used exclusively for boxes or regions in "current work" state.
   * Combines rounded corners with dashed horizontal/vertical segments
   * and supports two special overlay symbols:
   *
   *   gate (╢) — marks a connector attachment point on the border
   *              (spec §6.4.1).  Only appears where a connector actually
   *              attaches; reverts to the dashed segment when detached.
   *
   *   dot  (●) — animated marker that travels clockwise along the
   *              perimeter path.  Exactly two dots are present at any
   *              time (spec §7.7 / §19.6.1).  The dot is a view-layer
   *              overlay and does not alter the underlying model.
   */
  currentWork: {
    topLeft:     '\u256D', // ╭  — rounded top-left corner
    topRight:    '\u256E', // ╮  — rounded top-right corner
    bottomLeft:  '\u2570', // ╰  — rounded bottom-left corner
    bottomRight: '\u256F', // ╯  — rounded bottom-right corner
    horizontal:  '\u254D', // ╍  — dashed horizontal segment
    vertical:    '\u2507', // ┇  — dashed vertical segment
    gate:        '\u255F', // ╟  — connector attachment gate (vertical borders)
    gateH:       '\u2567', // ╧  — connector attachment gate (horizontal borders)
    dot:         '\u25CF'  // ●  — animated perimeter dot
  },

  /* ── Connector / junction / arrowhead symbol inventory (spec §6.2–6.3)
   *
   * These are not "borders" in the traditional sense but are collected
   * here so that every diagram-canonical character lives in one registry.
   * The router and renderer reference these by key rather than embedding
   * raw code-points, which makes auditing and future expansion safe.
   *
   * Junction characters join connector segments at merge/split points.
   * Arrowheads terminate directed connectors and indicate flow direction.
   */
  connector: {
    horizontal:    '\u2500', // ─  — horizontal connector segment
    vertical:      '\u2502', // │  — vertical connector segment
    topLeft:       '\u256D', // ╭  — connector bend: going down-then-right
    topRight:      '\u256E', // ╮  — connector bend: going down-then-left
    bottomLeft:    '\u2570', // ╰  — connector bend: going up-then-right
    bottomRight:   '\u256F', // ╯  — connector bend: going up-then-left
    teeRight:      '\u251C', // ├  — tee: vertical trunk, branch right
    teeLeft:       '\u2524', // ┤  — tee: vertical trunk, branch left
    teeDown:       '\u252C', // ┬  — tee: horizontal trunk, branch down
    teeUp:         '\u2534', // ┴  — tee: horizontal trunk, branch up
    cross:         '\u23DC', // ⏜  — arc-over crossing (horizontal hops vertical)
    crossResume:   '\u2577', // ╷  — vertical resume stub below arc crossing
    arrowRight:    '\u25B6', // ▶  — rightward arrowhead
    arrowLeft:     '\u25C0', // ◀  — leftward arrowhead
    arrowDown:     '\u25BC', // ▼  — downward arrowhead (wide)
    arrowDownNarrow: '\u2193', // ↓ — downward arrowhead (narrow)
    arrowUp:       '\u25B2'  // ▲  — upward arrowhead
  }
};

/**
 * Look up the set of border characters for a given `border` option object.
 *
 * Accepts:
 *   - `undefined` / `null`         → defaults to `CHARSETS.light`
 *   - `{ charset: 'heavy' }`       → named lookup from CHARSETS
 *   - `{ charset: { ... } }`       → pass-through custom object
 *   - `{ charset: 'currentWork' }` → diagram current-work border
 *   - `{ charset: 'connector' }`   → diagram connector symbols
 *
 * @param {{ charset?: string | Record<string, string> }} border
 * @returns {Record<string, string>} Resolved character set
 */
function resolveCharset(border) {
  const cs = border && border.charset;
  if (!cs || cs === 'light') return CHARSETS.light;
  if (typeof cs === 'string') return CHARSETS[cs] || CHARSETS.light;
  if (typeof cs === 'object') return cs;
  return CHARSETS.light;
}

exports.CHARSETS = CHARSETS;
exports.resolveCharset = resolveCharset;
