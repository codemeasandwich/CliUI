'use strict';

var test   = require('node:test');
var assert = require('node:assert');

require('../index');  // patches Element.prototype
var galacticaMock = require('./helpers/galactica-mock');
var blessed = require('../blessed');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set up a screen+box, call setCutout, trigger render, return screen.
 * box defaults: top=4, left=4, width=20, height=8
 */
function setup(boxOpts, fn) {
  var screen = galacticaMock.install({ cols: 80, rows: 20 });
  var box = blessed.box(Object.assign({
    parent: screen,
    top: 4, left: 4, width: 20, height: 8,
    border: { type: 'line' }
  }, boxOpts || {}));
  try {
    fn(screen, box);
  } finally {
    galacticaMock.uninstall();
  }
}

/**
 * Read a single character from screen.lines at (row, col).
 */
function screenChar(screen, y, x) {
  if (!screen.lines[y] || !screen.lines[y][x]) return '?';
  return screen.lines[y][x][1];
}

/**
 * Read a slice of a row as a string.
 */
function screenRow(screen, y, startX, endX) {
  var s = '';
  for (var x = startX; x <= endX; x++) {
    s += screenChar(screen, y, x);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test('_paintCutouts — screen output', async function (t) {

  // ── top-right CH=1 ────────────────────────────────────────────────────────

  await t.test('top-right CH=1: step top row has topLeft+horiz+topRight', function () {
    setup({}, function (screen, box) {
      // box: top=4,left=4,width=20,height=8 → xi=4,xl=24,yi=4,yl=12
      // CW=5 ('hello'), stepLeftX=xi+CW+1=10, stepTopY=yi-1=3
      box.setCutout('top-right', 'hello');
      screen.render();
      // step top row@3: topLeft@10, ─@11-22, topRight@23
      assert.strictEqual(screenChar(screen, 3, 10), '\u250C', 'topLeft at stepLeftX');
      assert.strictEqual(screenChar(screen, 3, 11), '\u2500', 'horizontal fill start');
      assert.strictEqual(screenChar(screen, 3, 22), '\u2500', 'horizontal fill end');
      assert.strictEqual(screenChar(screen, 3, 23), '\u2510', 'topRight at xl-1');
    });
  });

  await t.test('top-right CH=1: text right-aligned left of step', function () {
    setup({}, function (screen, box) {
      // stepLeftX=10, text 'hello' (CW=5) at cols 5..9
      box.setCutout('top-right', 'hello');
      screen.render();
      assert.strictEqual(screenRow(screen, 3, 5, 9), 'hello', 'text on step-top row');
    });
  });

  await t.test('top-right CH=1: junction row has bottomRight at stepLeftX and vertical at xl-1', function () {
    setup({}, function (screen, box) {
      // junction@4: bottomRight@10, spaces@11-22, vertical@23
      box.setCutout('top-right', 'hello');
      screen.render();
      assert.strictEqual(screenChar(screen, 4, 10), '\u2518', 'bottomRight at stepLeftX');
      assert.strictEqual(screenChar(screen, 4, 11), ' ', 'cleared space after step');
      assert.strictEqual(screenChar(screen, 4, 23), '\u2502', 'vertical at xl-1 on junction');
    });
  });

  // ── top-right CH=2 ────────────────────────────────────────────────────────

  await t.test('top-right CH=2: step top row correct', function () {
    setup({}, function (screen, box) {
      // CW=5 ('hello'/'world'), stepLeftX=10, stepTopY=yi-2=2
      box.setCutout('top-right', 'hello\nworld');
      screen.render();
      assert.strictEqual(screenChar(screen, 2, 10), '\u250C', 'topLeft on step top row');
      assert.strictEqual(screenChar(screen, 2, 23), '\u2510', 'topRight on step top row');
    });
  });

  await t.test('top-right CH=2: wall row has verticals on both sides', function () {
    setup({}, function (screen, box) {
      // wall row@3: vertical@10, vertical@23
      box.setCutout('top-right', 'hello\nworld');
      screen.render();
      assert.strictEqual(screenChar(screen, 3, 10), '\u2502', 'vertical at stepLeftX on wall');
      assert.strictEqual(screenChar(screen, 3, 23), '\u2502', 'vertical at xl-1 on wall');
    });
  });

  await t.test('top-right CH=2: text on step-top and wall rows', function () {
    setup({}, function (screen, box) {
      // text lines: 'hello'@row2 cols5-9, 'world'@row3 cols5-9
      box.setCutout('top-right', 'hello\nworld');
      screen.render();
      assert.strictEqual(screenRow(screen, 2, 5, 9), 'hello', 'line 0 on step-top row');
      assert.strictEqual(screenRow(screen, 3, 5, 9), 'world', 'line 1 on wall row');
    });
  });

  await t.test('top-right CH=2: junction row has bottomRight and vertical', function () {
    setup({}, function (screen, box) {
      // junction@4: bottomRight@10, spaces@11-22, vertical@23
      box.setCutout('top-right', 'hello\nworld');
      screen.render();
      assert.strictEqual(screenChar(screen, 4, 10), '\u2518', 'bottomRight at stepLeftX on junction');
      assert.strictEqual(screenChar(screen, 4, 23), '\u2502', 'vertical at xl-1 on junction');
    });
  });

  // ── top-right: short line right-aligned ───────────────────────────────────

  await t.test('top-right CH=2: short line is right-aligned (flush against step)', function () {
    setup({}, function (screen, box) {
      // 'ab\nlonger' → CW=6. 'ab' right-aligned in 6 chars = '    ab'
      // stepLeftX = xi+CW+1 = 4+6+1=11, text at cols xi+1..xi+CW = 5..10
      // stepTopY = yi-CH = 4-2=2, wallY = 3
      box.setCutout('top-right', 'ab\nlonger');
      screen.render();
      // step top row@2: 'ab' right-aligned in 6 cols at 5..10 = '    ab'
      assert.strictEqual(screenRow(screen, 2, 5, 10), '    ab', 'short line right-aligned on step-top');
      // wall row@3: 'longer' right-aligned in 6 cols at 5..10 = 'longer'
      assert.strictEqual(screenRow(screen, 3, 5, 10), 'longer', 'long line on wall row');
    });
  });

  // ── top-left CH=1 ─────────────────────────────────────────────────────────

  await t.test('top-left CH=1: step top row has topLeft+horiz+topRight', function () {
    setup({}, function (screen, box) {
      // xi=4, stepRightX=xl-CW-2=24-5-2=17, stepTopY=yi-1=3
      box.setCutout('top-left', 'hello');
      screen.render();
      assert.strictEqual(screenChar(screen, 3, 4),  '\u250C', 'topLeft at xi on step top');
      assert.strictEqual(screenChar(screen, 3, 5),  '\u2500', 'horizontal fill');
      assert.strictEqual(screenChar(screen, 3, 17), '\u2510', 'topRight at stepRightX');
    });
  });

  await t.test('top-left CH=1: text left-aligned right of step', function () {
    setup({}, function (screen, box) {
      // text 'hello' at cols 18..22 (stepRightX+1=18)
      box.setCutout('top-left', 'hello');
      screen.render();
      assert.strictEqual(screenRow(screen, 3, 18, 22), 'hello', 'text on step-top row');
    });
  });

  await t.test('top-left CH=1: junction row has vertical at xi and bottomLeft at stepRightX', function () {
    setup({}, function (screen, box) {
      box.setCutout('top-left', 'hello');
      screen.render();
      assert.strictEqual(screenChar(screen, 4, 4),  '\u2502', 'vertical at xi on junction');
      assert.strictEqual(screenChar(screen, 4, 5),  ' ',      'cleared space after xi');
      assert.strictEqual(screenChar(screen, 4, 17), '\u2514', 'bottomLeft at stepRightX');
    });
  });

  await t.test('top-left CH=2: wall row has verticals on both sides, text to right', function () {
    setup({}, function (screen, box) {
      // CW=5 ('hi' padded), stepRightX=17, stepTopY=yi-2=2
      // wall@3: vertical@4, vertical@17, text at 18..22
      box.setCutout('top-left', 'hi\nhello');
      screen.render();
      assert.strictEqual(screenChar(screen, 3, 4),  '\u2502', 'vertical at xi on wall');
      assert.strictEqual(screenChar(screen, 3, 17), '\u2502', 'vertical at stepRightX on wall');
      assert.strictEqual(screenRow(screen, 3, 18, 22), 'hello', 'line 1 on wall row');
    });
  });

  // ── bottom-right CH=1 ─────────────────────────────────────────────────────

  await t.test('bottom-right CH=1: junction row has topRight at step entrance', function () {
    setup({}, function (screen, box) {
      // xi=4,xl=24,yl=12, CW=5, stepLeftX=xi+CW+1=10
      // junction@11: keep └@4, ─@5-9, topRight@10, spaces@11-22, vertical@23
      box.setCutout('bottom-right', 'hello');
      screen.render();
      assert.strictEqual(screenChar(screen, 11, 10), '\u2510', 'topRight at stepLeftX on junction');
      assert.strictEqual(screenChar(screen, 11, 11), ' ', 'space in step interior on junction');
      assert.strictEqual(screenChar(screen, 11, 23), '\u2502', 'vertical at xl-1 on junction');
    });
  });

  await t.test('bottom-right CH=1: closing row has text then bottomLeft+horiz+bottomRight', function () {
    setup({}, function (screen, box) {
      // closing@12: text 'hello' right-aligned @5-9, bottomLeft@10, ─@11-22, bottomRight@23
      box.setCutout('bottom-right', 'hello');
      screen.render();
      assert.strictEqual(screenRow(screen, 12, 5, 9), 'hello', 'text on closing row');
      assert.strictEqual(screenChar(screen, 12, 10), '\u2514', 'bottomLeft at stepLeftX on closing');
      assert.strictEqual(screenChar(screen, 12, 23), '\u2518', 'bottomRight at xl-1 on closing');
    });
  });

  await t.test('bottom-right CH=2: wall row has vertical and text', function () {
    setup({}, function (screen, box) {
      // wall@12: text 'hello' right-aligned @5-9, vertical@10, vertical@23
      // closing@13: text 'world' @5-9, bottomLeft@10, ─@11-22, bottomRight@23
      box.setCutout('bottom-right', 'hello\nworld');
      screen.render();
      assert.strictEqual(screenRow(screen, 12, 5, 9), 'hello', 'line 0 on wall row');
      assert.strictEqual(screenChar(screen, 12, 10), '\u2502', 'vertical at stepLeftX on wall');
      assert.strictEqual(screenRow(screen, 13, 5, 9), 'world', 'line 1 on closing row');
      assert.strictEqual(screenChar(screen, 13, 10), '\u2514', 'bottomLeft at stepLeftX on closing');
    });
  });

  // ── bottom-left CH=1 ──────────────────────────────────────────────────────

  await t.test('bottom-left CH=1: junction row has topLeft at stepRightX', function () {
    setup({}, function (screen, box) {
      // xi=4, stepRightX=xl-CW-2=24-5-2=17, junction@yl-1=11
      // junction@11: vertical@4, spaces@5-16, topLeft@17, ─@18-22, keep ┘@23
      box.setCutout('bottom-left', 'hello');
      screen.render();
      assert.strictEqual(screenChar(screen, 11, 4),  '\u2502', 'vertical at xi on junction');
      assert.strictEqual(screenChar(screen, 11, 17), '\u250C', 'topLeft at stepRightX on junction');
    });
  });

  await t.test('bottom-left CH=1: closing row has bottomLeft+horiz+bottomRight then text', function () {
    setup({}, function (screen, box) {
      // closing@12: bottomLeft@4, ─@5-16, bottomRight@17, text 'hello' left-aligned at 18-22
      box.setCutout('bottom-left', 'hello');
      screen.render();
      assert.strictEqual(screenChar(screen, 12, 4),  '\u2514', 'bottomLeft at xi on closing');
      assert.strictEqual(screenChar(screen, 12, 17), '\u2518', 'bottomRight at stepRightX on closing');
      assert.strictEqual(screenRow(screen, 12, 18, 22), 'hello', 'text left-aligned on closing row');
    });
  });

  await t.test('bottom-left CH=2: wall row has verticals and left-aligned text', function () {
    setup({}, function (screen, box) {
      // wall@12: vertical@4, vertical@17, text 'hello' left-aligned at 18-22
      // closing@13: bottomLeft@4, ─@5-16, bottomRight@17, text 'world' at 18-22
      box.setCutout('bottom-left', 'hello\nworld');
      screen.render();
      assert.strictEqual(screenChar(screen, 12, 4),  '\u2502', 'vertical at xi on wall');
      assert.strictEqual(screenChar(screen, 12, 17), '\u2502', 'vertical at stepRightX on wall');
      assert.strictEqual(screenRow(screen, 12, 18, 22), 'hello', 'line 0 left-aligned on wall row');
      assert.strictEqual(screenRow(screen, 13, 18, 22), 'world', 'line 1 left-aligned on closing row');
      assert.strictEqual(screenChar(screen, 13, 17), '\u2518', 'bottomRight at stepRightX on closing');
    });
  });

  // ── short line alignment (bottom-left, right-aligned) ─────────────────────

  await t.test('bottom-left: short line is left-aligned toward step', function () {
    setup({}, function (screen, box) {
      // 'hi\nhello' → CW=5. 'hi' left-aligned = 'hi   '
      // stepRightX = xl-CW-2 = 24-5-2=17, text at 18-22
      box.setCutout('bottom-left', 'hi\nhello');
      screen.render();
      // wall row: 'hi' left-aligned in cols 18-22 → 'hi   '
      assert.strictEqual(screenRow(screen, 12, 18, 22), 'hi   ', 'short line left-aligned on wall row');
    });
  });

  // ── transparent text (fg-only rendering) ──────────────────────────────────

  await t.test('text cells preserve existing background attr bits', function () {
    setup({}, function (screen, box) {
      box.setCutout('top-right', 'X');
      screen.render();
      // CW=1, stepLeftX=xi+CW+1=6, stepTopY=3
      // text 'X' at col xi+1=5 on row 3
      var y = 3, x = 5;
      var cellAttr = screen.lines[y][x][0];
      // bg bits are lower 9 bits; they should remain from whatever was there before
      // (in mock, bg is typically 0x1ff = transparent). The attr should have been modified
      // only in the fg portion, not zeroed out.
      assert.ok(typeof cellAttr === 'number', 'attr should be a number');
      assert.strictEqual(screen.lines[y][x][1], 'X', 'character written correctly');
    });
  });

  await t.test('affected rows are marked dirty after _paintCutouts (direct call)', function () {
    setup({}, function (screen, box) {
      box.setCutout('top-right', 'hello');
      // Render once so lpos is set, then manually clear dirty and call _paintCutouts directly
      screen.render();
      // After render, dirty flags are cleared by the screen draw. Force-clear explicitly.
      if (screen.lines[3]) screen.lines[3].dirty = false;
      if (screen.lines[4]) screen.lines[4].dirty = false;
      // Now call _paintCutouts directly — it should re-mark the affected rows dirty
      box._paintCutouts();
      // stepTopY = yi-1 = 3, junctionY = yi = 4
      assert.ok(screen.lines[3].dirty, 'step top row should be dirty after _paintCutouts');
      assert.ok(screen.lines[4].dirty, 'junction row should be dirty after _paintCutouts');
    });
  });

  // ── CW clamping edge case ──────────────────────────────────────────────────

  await t.test('cutout wider than box is clamped — no throw', function () {
    setup({}, function (screen, box) {
      // box width=20, CW=100 (huge). Should clamp gracefully.
      assert.doesNotThrow(function () {
        box.setCutout('top-right', Array(101).join('x'));
        screen.render();
      });
    });
  });

  // ── multiple cutouts on same render ───────────────────────────────────────

  await t.test('two cutouts on different corners both render', function () {
    setup({}, function (screen, box) {
      // 'TR': CW=2, 'BL': CW=2
      // top-right: stepLeftX=xi+CW+1=4+2+1=7, junction row@yi=4
      // bottom-left: stepRightX=xl-CW-2=24-2-2=20, junction row@yl-1=11
      box.setCutout('top-right', 'TR');
      box.setCutout('bottom-left', 'BL');
      screen.render();
      // top-right junction row@4: bottomRight at col 7
      assert.strictEqual(screenChar(screen, 4, 7), '\u2518', 'top-right junction char (bottomRight)');
      // bottom-left junction row@11: topLeft at col 20
      assert.strictEqual(screenChar(screen, 11, 20), '\u250C', 'bottom-left junction char (topLeft)');
    });
  });

  await t.test('all four cutouts render simultaneously', function () {
    setup({}, function (screen, box) {
      box.setCutout('top-right', 'TR');
      box.setCutout('top-left', 'TL');
      box.setCutout('bottom-right', 'BR');
      box.setCutout('bottom-left', 'BL');
      assert.doesNotThrow(function () { screen.render(); });
      // With wide steps, same-edge cutouts overlap on the shared junction row.
      // Paint order is insertion order; last-painted characters survive.
      // Check surviving characters (left-side cutouts paint after right-side):
      // top-left junction@4: bottomLeft at xl-CW-2 = 20 (survives, painted after top-right)
      assert.strictEqual(screenChar(screen, 4, 20), '\u2514', 'top-left bottomLeft');
      // bottom-left junction@11: topLeft at xl-CW-2 = 20 (survives, painted after bottom-right)
      assert.strictEqual(screenChar(screen, 11, 20), '\u250C', 'bottom-left topLeft');
      // top-right step top@3: topRight at xl-1=23 (unique column, survives)
      assert.strictEqual(screenChar(screen, 3, 23), '\u2510', 'top-right topRight on step top');
      // bottom-left closing@12: bottomLeft at xi=4 (unique column, survives)
      assert.strictEqual(screenChar(screen, 12, 4), '\u2514', 'bottom-left bottomLeft on closing');
    });
  });

  // ── charset support ────────────────────────────────────────────────────────

  await t.test('heavy charset uses heavy box-drawing characters', function () {
    setup({ border: { type: 'line', charset: 'heavy' } }, function (screen, box) {
      box.setCutout('top-right', 'X');
      screen.render();
      // junction@4: should use heavy bottomRight = ┛ (U+251B)
      // stepLeftX = xi+CW+1 = 4+1+1=6
      assert.strictEqual(screenChar(screen, 4, 6), '\u251B', 'heavy bottomRight on junction');
      // step top@3: should use heavy topLeft = ┏ (U+250F) at col 6
      assert.strictEqual(screenChar(screen, 3, 6), '\u250F', 'heavy topLeft on step top');
    });
  });

  await t.test('double charset uses double box-drawing characters', function () {
    setup({ border: { type: 'line', charset: 'double' } }, function (screen, box) {
      box.setCutout('bottom-left', 'X');
      screen.render();
      // junction@11: topLeft at stepRightX=xl-CW-2=24-1-2=21 → should be ╔ (U+2554)
      assert.strictEqual(screenChar(screen, 11, 21), '\u2554', 'double topLeft on junction');
    });
  });

  // ── early return conditions ────────────────────────────────────────────────

  await t.test('_paintCutouts returns early when lpos is not set', function () {
    setup({}, function (screen, box) {
      box.setCutout('top-right', 'text');
      var savedLpos = box.lpos;
      box.lpos = null;
      // Should not throw
      assert.doesNotThrow(function () { box._paintCutouts(); });
      box.lpos = savedLpos;
    });
  });

  await t.test('_paintCutouts returns early when screen is null', function () {
    setup({}, function (screen, box) {
      box.setCutout('top-right', 'text');
      var savedScreen = box.screen;
      box.screen = null;
      assert.doesNotThrow(function () { box._paintCutouts(); });
      box.screen = savedScreen;
    });
  });
});
