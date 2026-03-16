'use strict';

/**
 * test/cutout-body.test.js
 *
 * Golden-output tests for the cutout-aware body compositor.
 *
 * Tests cover:
 *   1. Intersection resolver (via border-intersection.test.js — separate file)
 *   2. Scrollbar glyph computation for various scroll states
 *   3. Viewport geometry: row-local content widths
 *   4. Body compositor: virtual line building
 *   5. Golden-output: Example A exact row match
 *   6. Golden-output: Example B exact row match
 *   7. Golden-output: Fully-top scroll state
 *   8. Golden-output: Fully-bottom scroll state
 *   9. Ellipsis placement: only when clipping
 *   10. Single-cell adjacency: ┃│ text ┏ — no inserted space
 *   11. Scrollbar glyph set compliance
 *   12. Inner-box closure into bottom cutout transitions
 *   13. Outer/inner border survival through intersections
 */

var test   = require('node:test');
var assert = require('node:assert');

var scrollbar = require('../lib/border/scrollbar');
var viewportGeometry = require('../lib/border/viewport-geometry');
var compositor = require('../lib/border/body-compositor');
var intersection = require('../lib/border/intersection');
var renderCutoutBody = require('../lib/border/render-cutout-body');

// ── Helper: create a mock screen.lines buffer ────────────────────────────
function makeScreen(cols, rows) {
  var lines = [];
  for (var y = 0; y < rows; y++) {
    var row = [];
    for (var x = 0; x < cols; x++) {
      row.push([0, ' ']);
    }
    row.dirty = false;
    lines.push(row);
  }
  return { lines: lines, rows: rows, cols: cols };
}

// ── Helper: extract a row slice as a plain string ────────────────────────
function rowStr(screen, y, fromX, toX) {
  var s = '';
  for (var x = fromX; x <= toX; x++) {
    if (screen.lines[y] && screen.lines[y][x]) {
      s += screen.lines[y][x][1];
    } else {
      s += '?';
    }
  }
  return s;
}

// ── Helper: extract full grid row as string ──────────────────────────────
function gridRow(grid, r) {
  return grid[r].join('');
}

// ═══════════════════════════════════════════════════════════════════════════
// Scrollbar Tests
// ═══════════════════════════════════════════════════════════════════════════

test('scrollbar — contractual glyph computation', async function (t) {

  await t.test('scrollbar glyphs use the contractual set', function () {
    assert.strictEqual(scrollbar.UP_ARROW, '\u25B4');   // ▴
    assert.strictEqual(scrollbar.DOWN_ARROW, '\u25BE');  // ▾
    assert.strictEqual(scrollbar.THUMB, '\u257D');       // ╽
    assert.strictEqual(scrollbar.TRACK_NEAR, '\u250A');  // ┊
    assert.strictEqual(scrollbar.TRACK_FAR, '\u2506');   // ┆
  });

  await t.test('scrollbar height=1 returns thumb only', function () {
    var sb = scrollbar.computeScrollbar(1, 10, 0);
    assert.strictEqual(sb.length, 1);
    assert.strictEqual(sb[0], scrollbar.THUMB);
  });

  await t.test('scrollbar height=2 returns arrows only', function () {
    var sb = scrollbar.computeScrollbar(2, 10, 0);
    assert.strictEqual(sb.length, 2);
    assert.strictEqual(sb[0], scrollbar.UP_ARROW);
    assert.strictEqual(sb[1], scrollbar.DOWN_ARROW);
  });

  await t.test('scrollbar fully-top: thumb at top of track', function () {
    var sb = scrollbar.computeScrollbar(10, 20, 0);
    assert.strictEqual(sb[0], scrollbar.UP_ARROW);
    assert.strictEqual(sb[1], scrollbar.THUMB);  // thumb at track row 0
    assert.strictEqual(sb[2], scrollbar.TRACK_NEAR); // adjacent to thumb
    assert.strictEqual(sb[sb.length - 1], scrollbar.DOWN_ARROW);
  });

  await t.test('scrollbar fully-bottom: thumb at bottom of track', function () {
    var totalLines = 20;
    var viewportH = 10;
    var maxScroll = totalLines - viewportH; // 10
    var sb = scrollbar.computeScrollbar(viewportH, totalLines, maxScroll);
    assert.strictEqual(sb[0], scrollbar.UP_ARROW);
    assert.strictEqual(sb[sb.length - 2], scrollbar.THUMB); // thumb at last track row
    assert.strictEqual(sb[sb.length - 1], scrollbar.DOWN_ARROW);
  });

  await t.test('scrollbar track uses ┊ near thumb and ┆ far from thumb', function () {
    // Large enough to see both track types
    var sb = scrollbar.computeScrollbar(12, 100, 0);
    // sb[0] = ▴, sb[1] = ╽ (thumb at top), sb[2] = ┊, sb[3+] = ┆, sb[11] = ▾
    assert.strictEqual(sb[0], scrollbar.UP_ARROW);
    assert.strictEqual(sb[1], scrollbar.THUMB);
    assert.strictEqual(sb[2], scrollbar.TRACK_NEAR);
    // At least one far track glyph should exist
    var hasFar = false;
    for (var i = 3; i < sb.length - 1; i++) {
      if (sb[i] === scrollbar.TRACK_FAR) hasFar = true;
    }
    assert.ok(hasFar, 'should have at least one ┆ far-track glyph');
    assert.strictEqual(sb[sb.length - 1], scrollbar.DOWN_ARROW);
  });

  await t.test('scrollbar all content fits: thumb at position 0', function () {
    var sb = scrollbar.computeScrollbar(10, 5, 0);
    // Content shorter than viewport — thumb at top
    assert.strictEqual(sb[1], scrollbar.THUMB);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Viewport Geometry Tests
// ═══════════════════════════════════════════════════════════════════════════

test('viewport-geometry — row-local content widths', async function (t) {

  await t.test('basic viewport without scrollbar', function () {
    var vp = viewportGeometry.computeViewport({
      xi: 0, xl: 40, yi: 0, yl: 12, hasScrollbar: false
    });
    assert.strictEqual(vp.bodyTop, 1);
    assert.strictEqual(vp.bodyBottom, 10);
    assert.strictEqual(vp.bodyHeight, 10);
    assert.strictEqual(vp.defaultContentLeft, 1);
    assert.strictEqual(vp.defaultContentRight, 38); // xl-1 - 1 = 38
    assert.strictEqual(vp.scrollbarCol, -1);
  });

  await t.test('viewport with scrollbar reduces content width', function () {
    var vp = viewportGeometry.computeViewport({
      xi: 0, xl: 40, yi: 0, yl: 12, hasScrollbar: true
    });
    // scrollbarCol = outerRight - 1 = 39 - 1 = 38
    assert.strictEqual(vp.scrollbarCol, 38);
    // contentRight = scrollbarCol - 1 = 37
    assert.strictEqual(vp.defaultContentRight, 37);
    assert.strictEqual(vp.defaultContentWidth, 37); // 37 - 1 + 1 = 37
  });

  await t.test('viewport with bottom cutout sets transition row', function () {
    var vp = viewportGeometry.computeViewport({
      xi: 0, xl: 40, yi: 0, yl: 12, hasScrollbar: true,
      bottomCutout: { width: 6, height: 2 }
    });
    // bottomTransitionRow = bodyBottom = 10
    assert.strictEqual(vp.bottomTransitionRow, 10);
    // bottomStepCol = xi + CW + 1 = 0 + 6 + 1 = 7
    assert.strictEqual(vp.bottomStepCol, 7);
  });

  await t.test('getRowBounds narrows width at step column', function () {
    var vp = viewportGeometry.computeViewport({
      xi: 0, xl: 40, yi: 0, yl: 12, hasScrollbar: true
    });
    // Normal row: full width
    var normal = viewportGeometry.getRowBounds(vp, 5);
    assert.strictEqual(normal.left, 1);
    assert.strictEqual(normal.right, 37);
    // With step column cutting in at col 7
    var narrowed = viewportGeometry.getRowBounds(vp, 10, 7);
    assert.strictEqual(narrowed.right, 6); // stepCol - 1
    assert.strictEqual(narrowed.width, 6); // 6 - 1 + 1 = 6
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Body Compositor Tests
// ═══════════════════════════════════════════════════════════════════════════

test('body-compositor — virtual lines and composition', async function (t) {

  await t.test('buildVirtualLines creates correct structure for single message', function () {
    var vLines = compositor.buildVirtualLines(
      [{ role: 'USER', text: 'completed!' }],
      30
    );
    // Should have: box-top + 1 content line + box-bottom = 3
    assert.strictEqual(vLines.length, 3);
    assert.strictEqual(vLines[0].type, 'box-top');
    assert.strictEqual(vLines[0].rounded, true);
    assert.strictEqual(vLines[1].type, 'box-content');
    assert.strictEqual(vLines[1].text, 'completed!');
    assert.strictEqual(vLines[2].type, 'box-bottom');
  });

  await t.test('buildVirtualLines creates structure for multi-line multi-message', function () {
    var vLines = compositor.buildVirtualLines([
      { role: 'USER', text: 'completed!' },
      { role: 'AI', text: 'I will start\nby reading' }
    ], 30);
    // Msg 1: top + 1 content + bottom = 3
    // Msg 2: top + 2 content + bottom = 4
    // Total = 7
    assert.strictEqual(vLines.length, 7);
    assert.strictEqual(vLines[0].type, 'box-top');
    assert.strictEqual(vLines[3].type, 'box-top');
    assert.strictEqual(vLines[4].type, 'box-content');
    assert.strictEqual(vLines[4].text, 'I will start');
    assert.strictEqual(vLines[5].type, 'box-content');
    assert.strictEqual(vLines[5].text, 'by reading');
  });

  await t.test('compose produces grid with outer frame borders', function () {
    var vLines = compositor.buildVirtualLines(
      [{ role: 'USER', text: 'hi' }],
      20
    );
    var grid = compositor.compose({
      bodyTop: 2, bodyHeight: 5,
      contentLeft: 1, contentRight: 18,
      scrollbarCol: -1,
      outerLeft: 0, outerRight: 19,
      virtualLines: vLines,
      scrollOffset: 0,
      scrollbarGlyphs: []
    });
    // Left border should be ┃ (heavy vertical)
    assert.strictEqual(grid[0][0], '\u2503');
    // Right border should be ┃
    assert.strictEqual(grid[0][19], '\u2503');
  });

  await t.test('compose renders rounded inner box borders', function () {
    var vLines = compositor.buildVirtualLines(
      [{ role: 'USER', text: 'hi' }],
      20
    );
    var grid = compositor.compose({
      bodyTop: 2, bodyHeight: 5,
      contentLeft: 1, contentRight: 18,
      scrollbarCol: -1,
      outerLeft: 0, outerRight: 19,
      virtualLines: vLines,
      scrollOffset: 0,
      scrollbarGlyphs: []
    });
    // First virtual line is box-top: should have ╭ at contentLeft
    assert.strictEqual(grid[0][1], '\u256D', 'box top starts with ╭');
    // Content line should have │
    assert.strictEqual(grid[1][1], '\u2502', 'content line has │ border');
    // Bottom should have ╰
    assert.strictEqual(grid[2][1], '\u2570', 'box bottom starts with ╰');
  });

  await t.test('compose renders scrollbar glyphs in dedicated column', function () {
    var sbGlyphs = scrollbar.computeScrollbar(5, 20, 0);
    var vLines = compositor.buildVirtualLines(
      [{ role: 'USER', text: 'hi' }],
      15
    );
    var grid = compositor.compose({
      bodyTop: 2, bodyHeight: 5,
      contentLeft: 1, contentRight: 16,
      scrollbarCol: 18,
      outerLeft: 0, outerRight: 19,
      virtualLines: vLines,
      scrollOffset: 0,
      scrollbarGlyphs: sbGlyphs
    });
    // Scrollbar at col 18 (local col 18)
    assert.strictEqual(grid[0][18], scrollbar.UP_ARROW, 'scrollbar row 0 = ▴');
    assert.strictEqual(grid[4][18], scrollbar.DOWN_ARROW, 'scrollbar last row = ▾');
  });

  await t.test('ellipsis appears only when text is clipped', function () {
    // Short text that fits — no ellipsis
    var vLines = compositor.buildVirtualLines(
      [{ role: 'USER', text: 'hi' }],
      20
    );
    var grid = compositor.compose({
      bodyTop: 2, bodyHeight: 5,
      contentLeft: 1, contentRight: 18,
      scrollbarCol: -1,
      outerLeft: 0, outerRight: 19,
      virtualLines: vLines,
      scrollOffset: 0,
      scrollbarGlyphs: []
    });
    // Content row should NOT have ellipsis
    var row = gridRow(grid, 1);
    assert.ok(row.indexOf('\u2026') === -1, 'no ellipsis when text fits');
  });

  await t.test('ellipsis appears when text exceeds available width', function () {
    // Very long text in a narrow box
    var longText = 'This is a very long text that should definitely be clipped with ellipsis';
    var vLines = compositor.buildVirtualLines(
      [{ role: 'USER', text: longText }],
      15 // narrow width
    );
    var grid = compositor.compose({
      bodyTop: 2, bodyHeight: 5,
      contentLeft: 1, contentRight: 14,
      scrollbarCol: -1,
      outerLeft: 0, outerRight: 15,
      virtualLines: vLines,
      scrollOffset: 0,
      scrollbarGlyphs: []
    });
    // Content row should have ellipsis
    var row = gridRow(grid, 1);
    assert.ok(row.indexOf('\u2026') !== -1, 'ellipsis should appear when text is clipped');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Golden-Output Tests — Exact Row-for-Row Assertions
// ═══════════════════════════════════════════════════════════════════════════

test('golden-output — Example A and B exact rendering', async function (t) {

  // ── Test fixture setup ─────────────────────────────────────────────────
  // Both examples use a rendering area with:
  //   - Outer heavy frame (┃ ━ ┏ ┛)
  //   - Inner rounded/light message boxes (╭ ─ │ ╰)
  //   - Right-side scrollbar (▴ ╽ ┊ ┆ ▾)
  //   - Bottom cutout with footer text
  //   - Clipped text with ellipsis (…)

  // The fixture messages (derived from the examples):
  var messages = [
    { role: 'USER', text: 'completed!' },
    { role: 'AI', text: 'I\'ll start by reading the\nassigned task document and\nunderstanding the current\nstate of the project.' }
  ];

  // Common geometry (derived from the examples):
  // The example shows a 24-column wide rendering area (from ┃ to ┃)
  // with the bottom-right cutout for footer text
  //
  // Example A shows scroll position where first message is fully visible
  // Example B shows scroll position where content is scrolled down

  await t.test('renderCutoutBody produces a grid', function () {
    var screen = makeScreen(40, 15);
    var result = renderCutoutBody(screen, {
      xi: 0, xl: 24, yi: 1, yl: 12,
      messages: messages,
      scrollOffset: 0,
      scrollbar: true,
      bottomCutout: { width: 6, height: 2 }
    });
    assert.ok(result, 'should return result metadata');
    assert.ok(result.grid, 'should have grid');
    assert.ok(result.grid.length > 0, 'grid should have rows');
  });

  await t.test('outer heavy borders: left ┃ on every body row', function () {
    var screen = makeScreen(40, 15);
    var result = renderCutoutBody(screen, {
      xi: 0, xl: 24, yi: 1, yl: 12,
      messages: messages,
      scrollOffset: 0,
      scrollbar: true
    });
    for (var r = 0; r < result.grid.length; r++) {
      assert.strictEqual(result.grid[r][0], '\u2503',
        'row ' + r + ' left border should be ┃');
    }
  });

  await t.test('outer heavy borders: right ┃ on every body row (without bottom cutout)', function () {
    var screen = makeScreen(40, 15);
    var result = renderCutoutBody(screen, {
      xi: 0, xl: 24, yi: 1, yl: 12,
      messages: messages,
      scrollOffset: 0,
      scrollbar: true
    });
    var lastCol = result.grid[0].length - 1;
    for (var r = 0; r < result.grid.length; r++) {
      assert.strictEqual(result.grid[r][lastCol], '\u2503',
        'row ' + r + ' right border should be ┃');
    }
  });

  await t.test('scrollbar glyphs are from the contractual set', function () {
    var screen = makeScreen(40, 15);
    var result = renderCutoutBody(screen, {
      xi: 0, xl: 24, yi: 1, yl: 12,
      messages: messages,
      scrollOffset: 0,
      scrollbar: true
    });
    var validGlyphs = [
      scrollbar.UP_ARROW,
      scrollbar.DOWN_ARROW,
      scrollbar.THUMB,
      scrollbar.TRACK_NEAR,
      scrollbar.TRACK_FAR
    ];
    var sbCol = result.viewport.scrollbarCol - result.viewport.outerLeft;
    for (var r = 0; r < result.grid.length; r++) {
      var glyph = result.grid[r][sbCol];
      assert.ok(validGlyphs.indexOf(glyph) !== -1,
        'row ' + r + ' scrollbar glyph "' + glyph + '" should be from contractual set');
    }
  });

  await t.test('inner box top uses ╭', function () {
    var screen = makeScreen(40, 15);
    var result = renderCutoutBody(screen, {
      xi: 0, xl: 24, yi: 1, yl: 12,
      messages: messages,
      scrollOffset: 0,
      scrollbar: true
    });
    // First virtual line rendered at row 0 should have ╭ at contentLeft
    var contentLeft = result.viewport.defaultContentLeft - result.viewport.outerLeft;
    assert.strictEqual(result.grid[0][contentLeft], '\u256D', 'first inner box top = ╭');
  });

  await t.test('inner box bottom uses ╰', function () {
    var screen = makeScreen(40, 15);
    var result = renderCutoutBody(screen, {
      xi: 0, xl: 24, yi: 1, yl: 12,
      messages: [{ role: 'USER', text: 'hi' }],
      scrollOffset: 0,
      scrollbar: true
    });
    // 3 virtual lines: box-top, content, box-bottom
    // Row 2 of grid should have ╰
    var contentLeft = result.viewport.defaultContentLeft - result.viewport.outerLeft;
    assert.strictEqual(result.grid[2][contentLeft], '\u2570', 'inner box bottom = ╰');
  });

  await t.test('inner box content uses │ borders', function () {
    var screen = makeScreen(40, 15);
    var result = renderCutoutBody(screen, {
      xi: 0, xl: 24, yi: 1, yl: 12,
      messages: [{ role: 'USER', text: 'hi' }],
      scrollOffset: 0,
      scrollbar: true
    });
    var contentLeft = result.viewport.defaultContentLeft - result.viewport.outerLeft;
    assert.strictEqual(result.grid[1][contentLeft], '\u2502', 'content row left = │');
  });

  await t.test('single-cell adjacency: ┃ immediately adjacent to │ (no spacer)', function () {
    var screen = makeScreen(40, 15);
    var result = renderCutoutBody(screen, {
      xi: 0, xl: 24, yi: 1, yl: 12,
      messages: [{ role: 'USER', text: 'hi' }],
      scrollOffset: 0,
      scrollbar: true
    });
    // Row 1: outer ┃ at col 0, inner │ at col 1 — MUST be adjacent
    assert.strictEqual(result.grid[1][0], '\u2503', 'outer left ┃');
    assert.strictEqual(result.grid[1][1], '\u2502', 'inner left │');
    // These are columns 0 and 1 — directly adjacent, no space between
  });

  await t.test('bottom cutout transition: ┏ at step column', function () {
    var screen = makeScreen(40, 15);
    var result = renderCutoutBody(screen, {
      xi: 0, xl: 24, yi: 1, yl: 12,
      messages: messages,
      scrollOffset: 0,
      scrollbar: true,
      bottomCutout: { width: 6, height: 2 }
    });
    // Bottom transition row = bodyBottom - bodyTop = last grid row
    var lastRow = result.grid.length - 1;
    // Step col = xi + CW + 1 = 0 + 6 + 1 = 7
    assert.strictEqual(result.grid[lastRow][7], '\u250F', 'step corner ┏ at col 7');
  });

  await t.test('bottom cutout transition: ┛ at outer right', function () {
    var screen = makeScreen(40, 15);
    var result = renderCutoutBody(screen, {
      xi: 0, xl: 24, yi: 1, yl: 12,
      messages: messages,
      scrollOffset: 0,
      scrollbar: true,
      bottomCutout: { width: 6, height: 2 }
    });
    var lastRow = result.grid.length - 1;
    var lastCol = result.grid[lastRow].length - 1;
    assert.strictEqual(result.grid[lastRow][lastCol], '\u251B', 'outer right ┛ on transition row');
  });

  await t.test('bottom cutout transition: ┷ at scrollbar junction', function () {
    var screen = makeScreen(40, 15);
    var result = renderCutoutBody(screen, {
      xi: 0, xl: 24, yi: 1, yl: 12,
      messages: messages,
      scrollOffset: 0,
      scrollbar: true,
      bottomCutout: { width: 6, height: 2 }
    });
    var lastRow = result.grid.length - 1;
    var sbCol = result.viewport.scrollbarCol - result.viewport.outerLeft;
    assert.strictEqual(result.grid[lastRow][sbCol], '\u2537',
      'scrollbar junction ┷ on transition row');
  });

  await t.test('bottom cutout transition: ━ heavy horizontal fill', function () {
    var screen = makeScreen(40, 15);
    var result = renderCutoutBody(screen, {
      xi: 0, xl: 24, yi: 1, yl: 12,
      messages: messages,
      scrollOffset: 0,
      scrollbar: true,
      bottomCutout: { width: 6, height: 2 }
    });
    var lastRow = result.grid.length - 1;
    // Between step col (7) and scrollbar col, should be ━
    var sbCol = result.viewport.scrollbarCol - result.viewport.outerLeft;
    for (var c = 8; c < sbCol; c++) {
      assert.strictEqual(result.grid[lastRow][c], '\u2501',
        'col ' + c + ' on transition row should be ━');
    }
  });

  await t.test('mixed junctions resolve intentionally, not by overwrite', function () {
    // The ┷ at the scrollbar junction is a mixed-stroke glyph:
    // up=light (from scrollbar track), left=heavy (from step border), right=heavy (from step border)
    // This must be resolved by the intersection module, not by paint order
    var glyph = intersection.resolve(
      intersection.LIGHT, intersection.NONE,
      intersection.HEAVY, intersection.HEAVY
    );
    assert.strictEqual(glyph, '\u2537', 'intersection resolver produces ┷ for mixed junction');
  });

  await t.test('inner light borders do not destroy outer heavy frame', function () {
    var screen = makeScreen(40, 15);
    var result = renderCutoutBody(screen, {
      xi: 0, xl: 24, yi: 1, yl: 12,
      messages: [{ role: 'USER', text: 'hi' }],
      scrollOffset: 0,
      scrollbar: true
    });
    // Outer frame at column 0 must remain ┃ even when inner box │ is at column 1
    for (var r = 0; r < result.grid.length; r++) {
      assert.strictEqual(result.grid[r][0], '\u2503',
        'row ' + r + ': outer frame ┃ must survive at col 0');
    }
  });

  await t.test('outer heavy frame does not erase inner box structure', function () {
    var screen = makeScreen(40, 15);
    var result = renderCutoutBody(screen, {
      xi: 0, xl: 24, yi: 1, yl: 12,
      messages: [{ role: 'USER', text: 'hi' }],
      scrollOffset: 0,
      scrollbar: true
    });
    var contentLeft = result.viewport.defaultContentLeft - result.viewport.outerLeft;
    // Inner box top ╭ at content column should exist
    assert.strictEqual(result.grid[0][contentLeft], '\u256D', 'inner ╭ survives');
    // Inner box content │ should exist
    assert.strictEqual(result.grid[1][contentLeft], '\u2502', 'inner │ survives');
    // Inner box bottom ╰ should exist
    assert.strictEqual(result.grid[2][contentLeft], '\u2570', 'inner ╰ survives');
  });

  await t.test('content width accounts for borders, scrollbar, and cutout', function () {
    var screen = makeScreen(40, 15);
    var result = renderCutoutBody(screen, {
      xi: 0, xl: 24, yi: 1, yl: 12,
      messages: messages,
      scrollOffset: 0,
      scrollbar: true,
      bottomCutout: { width: 6, height: 2 }
    });
    // Content width = defaultContentRight - defaultContentLeft + 1
    // outerRight = 23, scrollbarCol = 22, contentRight = 21
    // contentLeft = 1 → width = 21
    assert.strictEqual(result.viewport.defaultContentWidth, 21,
      'content width accounts for border + scrollbar');
    assert.strictEqual(result.viewport.scrollbarCol, 22,
      'scrollbar at correct column');
  });

  await t.test('renderCutoutBody writes to screen.lines', function () {
    var screen = makeScreen(40, 15);
    renderCutoutBody(screen, {
      xi: 0, xl: 24, yi: 1, yl: 12,
      messages: [{ role: 'USER', text: 'hi' }],
      scrollOffset: 0,
      scrollbar: true
    });
    // Check that screen.lines was modified
    assert.strictEqual(screen.lines[2][0][1], '\u2503', 'screen.lines has outer ┃');
    // Check inner box content
    assert.strictEqual(screen.lines[2][1][1], '\u256D', 'screen.lines has inner ╭');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Full Composition Golden Tests — Exact Grid Verification
// ═══════════════════════════════════════════════════════════════════════════

test('golden-output — full grid composition exactness', async function (t) {

  await t.test('compose output has correct dimensions', function () {
    var vLines = compositor.buildVirtualLines([
      { role: 'USER', text: 'completed!' },
      { role: 'AI', text: 'Reading\nthe task' }
    ], 20);
    var sbGlyphs = scrollbar.computeScrollbar(8, vLines.length, 0);
    var grid = compositor.compose({
      bodyTop: 2, bodyHeight: 8,
      contentLeft: 1, contentRight: 18,
      scrollbarCol: 20,
      outerLeft: 0, outerRight: 21,
      virtualLines: vLines,
      scrollOffset: 0,
      scrollbarGlyphs: sbGlyphs
    });
    assert.strictEqual(grid.length, 8, 'grid height = bodyHeight');
    assert.strictEqual(grid[0].length, 22, 'grid width = outerRight - outerLeft + 1');
  });

  await t.test('scrollbar column is never overwritten by text', function () {
    var longMsg = 'A'.repeat(50); // Definitely wider than available space
    var vLines = compositor.buildVirtualLines([
      { role: 'USER', text: longMsg }
    ], 20);
    var sbGlyphs = scrollbar.computeScrollbar(5, vLines.length, 0);
    var grid = compositor.compose({
      bodyTop: 2, bodyHeight: 5,
      contentLeft: 1, contentRight: 18,
      scrollbarCol: 20,
      outerLeft: 0, outerRight: 21,
      virtualLines: vLines,
      scrollOffset: 0,
      scrollbarGlyphs: sbGlyphs
    });
    var validGlyphs = [
      scrollbar.UP_ARROW, scrollbar.DOWN_ARROW,
      scrollbar.THUMB, scrollbar.TRACK_NEAR, scrollbar.TRACK_FAR
    ];
    for (var r = 0; r < grid.length; r++) {
      assert.ok(validGlyphs.indexOf(grid[r][20]) !== -1,
        'row ' + r + ': scrollbar col must not be overwritten by text');
    }
  });

  await t.test('ELLIPSIS constant is the Unicode ellipsis character', function () {
    assert.strictEqual(compositor.ELLIPSIS, '\u2026', 'ELLIPSIS = …');
  });

  await t.test('bottom step ┏ + ━ fill is exact', function () {
    var vLines = compositor.buildVirtualLines([
      { role: 'USER', text: 'text' }
    ], 20);
    var sbGlyphs = scrollbar.computeScrollbar(8, vLines.length, 0);
    var grid = compositor.compose({
      bodyTop: 2, bodyHeight: 8,
      contentLeft: 1, contentRight: 18,
      scrollbarCol: 20,
      outerLeft: 0, outerRight: 21,
      virtualLines: vLines,
      scrollOffset: 0,
      scrollbarGlyphs: sbGlyphs,
      bottomStepCol: 7,
      bottomStepRow: 9 // bodyTop + bodyHeight - 1 = 2 + 8 - 1 = 9
    });
    var lastRow = grid.length - 1;
    // ┏ at local col 7
    assert.strictEqual(grid[lastRow][7], '\u250F', '┏ at step col');
    // ━ fill from col 8 to scrollbar-1
    for (var c = 8; c < 20; c++) {
      assert.strictEqual(grid[lastRow][c], '\u2501', 'col ' + c + ' = ━');
    }
    // ┷ at scrollbar col 20
    assert.strictEqual(grid[lastRow][20], '\u2537', '┷ at scrollbar junction');
    // ┛ at outer right col 21
    assert.strictEqual(grid[lastRow][21], '\u251B', '┛ at outer right');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Four-State Golden Tests — Exact Row-for-Row Grid Verification
// ═══════════════════════════════════════════════════════════════════════════

test('golden-output — four scroll states exact row match', async function (t) {

  // ── Shared fixture: 4 messages producing 17 virtual lines ─────────────
  // Msg 1 (USER):  3 vLines (box-top + 1 content + box-bottom)
  // Msg 2 (AI):    7 vLines (box-top + 5 content + box-bottom)
  // Msg 3 (USER):  4 vLines (box-top + 2 content + box-bottom)
  // Msg 4 (AI):    3 vLines (box-top + 1 content + box-bottom)
  var goldenMessages = [
    { role: 'USER', text: 'completed!' },
    { role: 'AI', text: 'I\'ll start by reading the\nassigned task document and\nunderstanding the current\nstate of the project.\nstarting from the test entry' },
    { role: 'USER', text: 'also run the full e2e\nsuite before closing it' },
    { role: 'AI', text: 'until the coverage meets the threshold' }
  ];

  // ── Cutout geometry for Example A and B ─────────────────────────────────
  // xi=0, xl=33 → gridWidth=33, outerLeft=0, outerRight=32
  // yi=1, yl=11 → bodyTop=1 (with topCutout), bodyBottom=9, bodyHeight=9
  // topCutout width=12 → topStepCol=13, top transition at bodyTop
  // bottomCutout width=7 → bottomStepCol=8, bottom transition at bodyBottom
  // scrollbarCol=31, contentLeft=1, contentRight=30, contentWidth=30
  var cutoutViewport = viewportGeometry.computeViewport({
    xi: 0, xl: 33, yi: 1, yl: 11, hasScrollbar: true,
    topCutout: { width: 12, height: 2 },
    bottomCutout: { width: 7, height: 2 }
  });

  // ── No-cutout geometry for fully-top and fully-bottom ───────────────────
  // Same box dimensions but no cutouts → bodyTop=2, bodyHeight=8
  var plainViewport = viewportGeometry.computeViewport({
    xi: 0, xl: 33, yi: 1, yl: 11, hasScrollbar: true
  });

  // ── Helper: compose a grid with a given viewport and scroll offset ──────
  function composeGrid(vp, scrollOffset, hasBtmCutout) {
    var vLines = compositor.buildVirtualLines(goldenMessages, vp.defaultContentWidth);
    // Scrollbar height: full body height minus 1 for bottom cutout transition
    var sbH = hasBtmCutout ? (vp.bodyHeight - 1) : vp.bodyHeight;
    var sb = scrollbar.computeScrollbar(sbH, vLines.length, scrollOffset);
    return compositor.compose({
      bodyTop: vp.bodyTop, bodyHeight: vp.bodyHeight,
      contentLeft: vp.defaultContentLeft, contentRight: vp.defaultContentRight,
      scrollbarCol: vp.scrollbarCol,
      outerLeft: vp.outerLeft, outerRight: vp.outerRight,
      virtualLines: vLines, scrollOffset: scrollOffset, scrollbarGlyphs: sb,
      bottomStepCol: vp.bottomStepCol, bottomStepRow: vp.bottomTransitionRow,
      topStepCol: vp.topStepCol, topStepRow: vp.topTransitionRow
    });
  }

  // ── Example A: scrollOffset=0, with top+bottom cutouts ─────────────────
  // Body rows 0-8: top transition (USER box hidden), content, bottom transition
  await t.test('Example A — scrollOffset=0, row-for-row exact match', function () {
    var grid = composeGrid(cutoutViewport, 0, true);
    var expected = [
      // Row 0: top transition — USER box-top completely hidden by step
      // ┏ at col 0, ┯ at col 1 (inner border junction from │ below),
      // ━ fill to col 12, ┛ step closure at col 13, spaces, ▴ scrollbar, ┃ outer right
      '\u250F\u252F\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u251B                 \u25B4\u2503',
      // Row 1: ┃│ completed! │ (USER content, 14-wide box)
      '\u2503\u2502 completed! \u2502                \u257D\u2503',
      // Row 2: ┃╰────────────╯ (USER box-bottom)
      '\u2503\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F                \u250A\u2503',
      // Row 3: ┃╭─ AI ───────────────────────╮ (AI box-top, 30-wide)
      '\u2503\u256D\u2500 AI \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E\u2506\u2503',
      // Row 4: ┃│ I'll start by reading the  │
      '\u2503\u2502 I\'ll start by reading the  \u2502\u2506\u2503',
      // Row 5: ┃│ assigned task document and │
      '\u2503\u2502 assigned task document and \u2502\u2506\u2503',
      // Row 6: ┃│ understanding the current  │
      '\u2503\u2502 understanding the current  \u2502\u2506\u2503',
      // Row 7: ┃│ state of the project.      │▾
      '\u2503\u2502 state of the project.      \u2502\u25BE\u2503',
      // Row 8: bottom transition — ┃│ sta… ┏━━━━━━━━━━━━━━━━━━━━━━┷┛
      '\u2503\u2502 sta\u2026 \u250F\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2537\u251B'
    ];
    assert.strictEqual(grid.length, expected.length,
      'grid height = ' + expected.length);
    for (var r = 0; r < expected.length; r++) {
      assert.strictEqual(gridRow(grid, r), expected[r],
        'Example A row ' + r + ' exact match');
    }
  });

  // ── Example B: scrollOffset=7, with top+bottom cutouts ─────────────────
  // Content scrolled: AI text left-clipped at top, msg4 clipped at bottom
  await t.test('Example B — scrollOffset=7, row-for-row exact match', function () {
    var grid = composeGrid(cutoutViewport, 7, true);
    var expected = [
      // Row 0: top transition — "state of the project." left-clipped
      // Left-clipped: textOffset=12 → "…project." visible after step closure
      '\u250F\u252F\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u251B \u2026project.      \u2502\u25B4\u2503',
      // Row 1: ┃│ starting from the test ent…│ (right-clipped with ellipsis)
      '\u2503\u2502 starting from the test ent\u2026\u2502\u2506\u2503',
      // Row 2: ┃╰────────────────────────────╯ (AI box-bottom)
      '\u2503\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F\u2506\u2503',
      // Row 3: ┃╭─ USER ──────────────────╮    (msg3 USER box, 27-wide)
      '\u2503\u256D\u2500 USER \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E   \u2506\u2503',
      // Row 4: ┃│ also run the full e2e   │
      '\u2503\u2502 also run the full e2e   \u2502   \u250A\u2503',
      // Row 5: ┃│ suite before closing it │
      '\u2503\u2502 suite before closing it \u2502   \u257D\u2503',
      // Row 6: ┃╰─────────────────────────╯
      '\u2503\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F   \u250A\u2503',
      // Row 7: ┃╭─ AI ───────────────────────╮▾ (msg4 AI box-top)
      '\u2503\u256D\u2500 AI \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E\u25BE\u2503',
      // Row 8: bottom transition — ┃│ unt… ┏━━━━━━━━━━━━━━━━━━━━━━┷┛
      '\u2503\u2502 unt\u2026 \u250F\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2537\u251B'
    ];
    assert.strictEqual(grid.length, expected.length,
      'grid height = ' + expected.length);
    for (var r = 0; r < expected.length; r++) {
      assert.strictEqual(gridRow(grid, r), expected[r],
        'Example B row ' + r + ' exact match');
    }
  });

  // ── Fully-top: scrollOffset=0, no cutouts ──────────────────────────────
  // Standard body without cutout transitions — clean viewport
  await t.test('Fully-top — scrollOffset=0, no cutouts, row-for-row', function () {
    var grid = composeGrid(plainViewport, 0, false);
    var expected = [
      // Row 0: ┃╭─ USER ─────╮                ▴┃
      '\u2503\u256D\u2500 USER \u2500\u2500\u2500\u2500\u2500\u256E                \u25B4\u2503',
      // Row 1: ┃│ completed! │                ╽┃
      '\u2503\u2502 completed! \u2502                \u257D\u2503',
      // Row 2: ┃╰────────────╯                ┊┃
      '\u2503\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F                \u250A\u2503',
      // Row 3: ┃╭─ AI ───────────────────────╮┆┃
      '\u2503\u256D\u2500 AI \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E\u2506\u2503',
      // Row 4: ┃│ I'll start by reading the  │┆┃
      '\u2503\u2502 I\'ll start by reading the  \u2502\u2506\u2503',
      // Row 5: ┃│ assigned task document and │┆┃
      '\u2503\u2502 assigned task document and \u2502\u2506\u2503',
      // Row 6: ┃│ understanding the current  │┆┃
      '\u2503\u2502 understanding the current  \u2502\u2506\u2503',
      // Row 7: ┃│ state of the project.      │▾┃
      '\u2503\u2502 state of the project.      \u2502\u25BE\u2503'
    ];
    assert.strictEqual(grid.length, expected.length,
      'grid height = ' + expected.length);
    for (var r = 0; r < expected.length; r++) {
      assert.strictEqual(gridRow(grid, r), expected[r],
        'Fully-top row ' + r + ' exact match');
    }
  });

  // ── Fully-bottom: scrollOffset=maxScroll, no cutouts ───────────────────
  // Scrolled to the end of content
  await t.test('Fully-bottom — scrollOffset=maxScroll, no cutouts, row-for-row', function () {
    var vLines = compositor.buildVirtualLines(goldenMessages, plainViewport.defaultContentWidth);
    var maxScroll = Math.max(0, vLines.length - plainViewport.bodyHeight);
    var grid = composeGrid(plainViewport, maxScroll, false);
    var expected = [
      // Row 0: ┃╰────────────────────────────╯▴┃ (AI box-bottom from msg2)
      '\u2503\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F\u25B4\u2503',
      // Row 1: ┃╭─ USER ──────────────────╮   ┆┃ (msg3 box-top)
      '\u2503\u256D\u2500 USER \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E   \u2506\u2503',
      // Row 2: ┃│ also run the full e2e   │   ┆┃
      '\u2503\u2502 also run the full e2e   \u2502   \u2506\u2503',
      // Row 3: ┃│ suite before closing it │   ┆┃
      '\u2503\u2502 suite before closing it \u2502   \u2506\u2503',
      // Row 4: ┃╰─────────────────────────╯   ┆┃ (msg3 box-bottom)
      '\u2503\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F   \u2506\u2503',
      // Row 5: ┃╭─ AI ───────────────────────╮┊┃ (msg4 box-top)
      '\u2503\u256D\u2500 AI \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E\u250A\u2503',
      // Row 6: ┃│ until the coverage meets t…│╽┃ (right-clipped)
      '\u2503\u2502 until the coverage meets t\u2026\u2502\u257D\u2503',
      // Row 7: ┃╰────────────────────────────╯▾┃ (msg4 box-bottom)
      '\u2503\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F\u25BE\u2503'
    ];
    assert.strictEqual(grid.length, expected.length,
      'grid height = ' + expected.length);
    for (var r = 0; r < expected.length; r++) {
      assert.strictEqual(gridRow(grid, r), expected[r],
        'Fully-bottom row ' + r + ' exact match');
    }
  });

  // ── Mandatory explicit assertions ──────────────────────────────────────

  await t.test('single-cell adjacency: ┃│ sta… ┏ — no inserted space (Example A)', function () {
    // On the bottom transition row, outer ┃ at col 0 is immediately adjacent
    // to inner │ at col 1, with no spacer character between them
    var grid = composeGrid(cutoutViewport, 0, true);
    assert.strictEqual(grid[8][0], '\u2503', 'outer ┃ at col 0');
    assert.strictEqual(grid[8][1], '\u2502', 'inner │ at col 1');
    // Content continues immediately: space at col 2, then text
    assert.strictEqual(grid[8][2], ' ', 'space after │');
    assert.strictEqual(grid[8][3], 's', 'text starts at col 3');
  });

  await t.test('single-cell adjacency: ┃│ unt… ┏ — no inserted space (Example B)', function () {
    // Same adjacency contract at scrollOffset=7 (Example B)
    // Outer ┃ at col 0 immediately adjacent to inner │ at col 1
    var grid = composeGrid(cutoutViewport, 7, true);
    assert.strictEqual(grid[8][0], '\u2503', 'outer ┃ at col 0');
    assert.strictEqual(grid[8][1], '\u2502', 'inner │ at col 1');
    // Content: space at col 2, "unt" text at cols 3-5, ellipsis at col 6
    assert.strictEqual(grid[8][2], ' ', 'space after │');
    assert.strictEqual(grid[8][3], 'u', 'text "u" at col 3');
    assert.strictEqual(grid[8][4], 'n', 'text "n" at col 4');
    assert.strictEqual(grid[8][5], 't', 'text "t" at col 5');
    assert.strictEqual(grid[8][6], '\u2026', 'ellipsis … at col 6');
    // Step corner ┏ immediately after the box content area
    assert.strictEqual(grid[8][8], '\u250F', 'step ┏ at col 8');
  });

  await t.test('ellipsis appears only when clipping actually occurred', function () {
    // Fully-top state: no text is clipped on the visible rows
    var grid = composeGrid(plainViewport, 0, false);
    for (var r = 0; r < grid.length; r++) {
      var row = gridRow(grid, r);
      assert.strictEqual(row.indexOf('\u2026'), -1,
        'row ' + r + ': no ellipsis when text fits without clipping');
    }
    // With cutout: bottom transition row HAS ellipsis (text is clipped)
    var gridC = composeGrid(cutoutViewport, 0, true);
    var btmRow = gridRow(gridC, 8);
    assert.ok(btmRow.indexOf('\u2026') !== -1,
      'bottom transition row has ellipsis when content is right-clipped');
  });

  await t.test('mixed junctions resolved by intersection module', function () {
    // ┷ on bottom transition: up=light (from scrollbar track above),
    // left=heavy (from step ━), right=heavy (from step ━)
    var resolved = intersection.resolve(
      intersection.LIGHT, intersection.NONE,
      intersection.HEAVY, intersection.HEAVY
    );
    assert.strictEqual(resolved, '\u2537', '┷ resolved by intersection module');

    // ┯ on top transition: down=light (from inner box │ below),
    // left=heavy (from step ━), right=heavy (from step ━)
    var resolvedTop = intersection.resolve(
      intersection.NONE, intersection.LIGHT,
      intersection.HEAVY, intersection.HEAVY
    );
    assert.strictEqual(resolvedTop, '\u252F', '┯ resolved by intersection module');

    // Verify these glyphs appear in the actual grid
    var grid = composeGrid(cutoutViewport, 0, true);
    assert.strictEqual(grid[8][31], '\u2537', '┷ at scrollbar junction on bottom transition');
    assert.strictEqual(grid[0][1], '\u252F', '┯ at inner border junction on top transition');
  });

  await t.test('inner thin borders survive alongside outer heavy frame', function () {
    var grid = composeGrid(cutoutViewport, 0, true);
    // Outer ┃ at col 0 on every non-transition body row
    for (var r = 1; r < 8; r++) {
      assert.strictEqual(grid[r][0], '\u2503', 'row ' + r + ': outer ┃ at col 0');
    }
    // Inner │ at col 1 on content rows (rows 1, 4-7)
    assert.strictEqual(grid[1][1], '\u2502', 'row 1: inner │ at col 1');
    assert.strictEqual(grid[4][1], '\u2502', 'row 4: inner │ at col 1');
    // Inner ╭ at col 1 on box-top rows (row 3)
    assert.strictEqual(grid[3][1], '\u256D', 'row 3: inner ╭ at col 1');
    // Inner ╰ at col 1 on box-bottom rows (row 2)
    assert.strictEqual(grid[2][1], '\u2570', 'row 2: inner ╰ at col 1');
  });

  await t.test('content width accounts for borders + scrollbar + cutout', function () {
    // Verify viewport dimensions are consistent
    assert.strictEqual(cutoutViewport.defaultContentWidth, 30,
      'content width = 30 (outerRight=32, scrollbar=31, contentRight=30, contentLeft=1)');
    assert.strictEqual(cutoutViewport.scrollbarCol, 31,
      'scrollbar at col 31');
    assert.strictEqual(cutoutViewport.bottomStepCol, 8,
      'bottom step at col 8 (xi=0 + cutoutWidth=7 + 1)');
    assert.strictEqual(cutoutViewport.topStepCol, 13,
      'top step at col 13 (xi=0 + cutoutWidth=12 + 1)');
  });
});
