'use strict';

var test   = require('node:test');
var assert = require('node:assert');

var geometry = require('../lib/border/geometry');

// Convenience: step parameters for a hypothetical element
// box: xi=4, xl=54, yi=4, yl=14  (left=4, width=50, top=4, height=10)
var XI = 4, XL = 54, YI = 4, YL = 14;
var CHARSET = {
  topLeft:     '┌',
  topRight:    '┐',
  bottomLeft:  '└',
  bottomRight: '┘',
  horizontal:  '─',
  vertical:    '│'
};

// ---------------------------------------------------------------------------

test('lib/border/geometry.js — step geometry helpers', async function (t) {

  // ── stepGeometry ──────────────────────────────────────────────────────────

  await t.test('stepGeometry exports as function', function () {
    assert.strictEqual(typeof geometry.stepGeometry, 'function');
  });

  await t.test('stepGeometry top-right: correct absolute positions', function () {
    // CH=2, CW=5 → stepLeftCol = xi+CW+1 = 4+5+1 = 10, stepRightCol = xl-1 = 53
    var g = geometry.stepGeometry('top-right', XI, XL, YI, YL, 2, 5);
    assert.strictEqual(g.junctionRow,  YI,       'junctionRow = yi');
    assert.strictEqual(g.stepLeftCol,  10,       'stepLeftCol = xi+CW+1');
    assert.strictEqual(g.stepRightCol, 53,       'stepRightCol = xl-1');
    assert.strictEqual(g.textColBase,  XI + 1,   'textColBase = xi+1 (right-align)');
  });

  await t.test('stepGeometry top-left: correct absolute positions', function () {
    // CH=2, CW=5 → stepRightCol = xl-CW-2 = 54-5-2 = 47
    var g = geometry.stepGeometry('top-left', XI, XL, YI, YL, 2, 5);
    assert.strictEqual(g.junctionRow,  YI,       'junctionRow = yi');
    assert.strictEqual(g.stepLeftCol,  XI,       'stepLeftCol = xi');
    assert.strictEqual(g.stepRightCol, 47,       'stepRightCol = xl-CW-2');
    assert.strictEqual(g.textColBase,  48,       'textColBase = xl-CW-1 (left-align)');
  });

  await t.test('stepGeometry bottom-right: correct absolute positions', function () {
    // CH=2, CW=5 → junctionRow = yl-1 = 13, stepLeftCol = xi+CW+1 = 10, stepRightCol = xl-1 = 53
    var g = geometry.stepGeometry('bottom-right', XI, XL, YI, YL, 2, 5);
    assert.strictEqual(g.junctionRow,  YL - 1,   'junctionRow = yl-1');
    assert.strictEqual(g.stepLeftCol,  10,        'stepLeftCol = xi+CW+1');
    assert.strictEqual(g.stepRightCol, 53,        'stepRightCol = xl-1');
    assert.strictEqual(g.textColBase,  XI + 1,    'textColBase = xi+1');
  });

  await t.test('stepGeometry bottom-left: correct absolute positions', function () {
    // CH=2, CW=5 → junctionRow = yl-1 = 13, stepRightCol = xl-CW-2 = 47
    var g = geometry.stepGeometry('bottom-left', XI, XL, YI, YL, 2, 5);
    assert.strictEqual(g.junctionRow,  YL - 1,   'junctionRow = yl-1');
    assert.strictEqual(g.stepLeftCol,  XI,        'stepLeftCol = xi');
    assert.strictEqual(g.stepRightCol, 47,        'stepRightCol = xl-CW-2');
    assert.strictEqual(g.textColBase,  48,        'textColBase = xl-CW-1');
  });

  await t.test('stepGeometry returns null for unknown position', function () {
    var g = geometry.stepGeometry('center', XI, XL, YI, YL, 2, 5);
    assert.strictEqual(g, null);
  });

  await t.test('stepGeometry CH=1 top-right: junctionRow at yi', function () {
    // CH=1 edge case: no wall rows, junction+closing collapse
    var g = geometry.stepGeometry('top-right', XI, XL, YI, YL, 1, 8);
    assert.strictEqual(g.junctionRow, YI, 'junction is still at yi');
    assert.strictEqual(g.stepLeftCol, XI + 8 + 1, 'stepLeftCol = xi+CW+1');
  });

  await t.test('stepGeometry CH=1 bottom-left: junctionRow at yl-1', function () {
    var g = geometry.stepGeometry('bottom-left', XI, XL, YI, YL, 1, 8);
    assert.strictEqual(g.junctionRow, YL - 1, 'junction is still at yl-1');
  });

  await t.test('stepGeometry CW=0: stepLeftCol still computable', function () {
    var g = geometry.stepGeometry('top-right', XI, XL, YI, YL, 1, 0);
    assert.strictEqual(g.stepLeftCol, XI + 0 + 1);
    assert.strictEqual(g.stepRightCol, XL - 1);
  });

  // ── stepJunctionChars ─────────────────────────────────────────────────────

  await t.test('stepJunctionChars exports as function', function () {
    assert.strictEqual(typeof geometry.stepJunctionChars, 'function');
  });

  await t.test('stepJunctionChars top-right: bottomRight at left, null at right', function () {
    var jc = geometry.stepJunctionChars('top-right', CHARSET);
    assert.strictEqual(jc.leftChar,  CHARSET.bottomRight, 'leftChar = bottomRight');
    assert.strictEqual(jc.rightChar, null,                'rightChar = null (topRight unchanged)');
  });

  await t.test('stepJunctionChars top-left: null at left, bottomLeft at right', function () {
    var jc = geometry.stepJunctionChars('top-left', CHARSET);
    assert.strictEqual(jc.leftChar,  null,               'leftChar = null (topLeft unchanged)');
    assert.strictEqual(jc.rightChar, CHARSET.bottomLeft, 'rightChar = bottomLeft');
  });

  await t.test('stepJunctionChars bottom-right: topRight at left, null at right', function () {
    var jc = geometry.stepJunctionChars('bottom-right', CHARSET);
    assert.strictEqual(jc.leftChar,  CHARSET.topRight, 'leftChar = topRight');
    assert.strictEqual(jc.rightChar, null,             'rightChar = null (bottomRight unchanged)');
  });

  await t.test('stepJunctionChars bottom-left: null at left, topLeft at right', function () {
    var jc = geometry.stepJunctionChars('bottom-left', CHARSET);
    assert.strictEqual(jc.leftChar,  null,            'leftChar = null (bottomLeft unchanged)');
    assert.strictEqual(jc.rightChar, CHARSET.topLeft, 'rightChar = topLeft');
  });

  await t.test('stepJunctionChars unknown position: both null', function () {
    var jc = geometry.stepJunctionChars('center', CHARSET);
    assert.strictEqual(jc.leftChar,  null);
    assert.strictEqual(jc.rightChar, null);
  });

  // ── textAlignment ─────────────────────────────────────────────────────────

  await t.test('textAlignment exports as function', function () {
    assert.strictEqual(typeof geometry.textAlignment, 'function');
  });

  await t.test('textAlignment top-right is right', function () {
    assert.strictEqual(geometry.textAlignment('top-right'), 'right');
  });

  await t.test('textAlignment bottom-right is right', function () {
    assert.strictEqual(geometry.textAlignment('bottom-right'), 'right');
  });

  await t.test('textAlignment top-left is left', function () {
    assert.strictEqual(geometry.textAlignment('top-left'), 'left');
  });

  await t.test('textAlignment bottom-left is left', function () {
    assert.strictEqual(geometry.textAlignment('bottom-left'), 'left');
  });

  // ── rightAlign ────────────────────────────────────────────────────────────

  await t.test('rightAlign pads short string with leading spaces', function () {
    assert.strictEqual(geometry.rightAlign('hi', 5), '   hi');
  });

  await t.test('rightAlign exact length: no change', function () {
    assert.strictEqual(geometry.rightAlign('hello', 5), 'hello');
  });

  await t.test('rightAlign truncates string longer than width', function () {
    assert.strictEqual(geometry.rightAlign('toolong', 4), 'tool');
  });

  await t.test('rightAlign empty string: all spaces', function () {
    assert.strictEqual(geometry.rightAlign('', 3), '   ');
  });

  await t.test('rightAlign null/undefined: treated as empty', function () {
    assert.strictEqual(geometry.rightAlign(null, 3), '   ');
    assert.strictEqual(geometry.rightAlign(undefined, 3), '   ');
  });

  await t.test('rightAlign width=0: returns empty string', function () {
    assert.strictEqual(geometry.rightAlign('hello', 0), '');
  });

  // ── leftAlign ─────────────────────────────────────────────────────────────

  await t.test('leftAlign pads short string with trailing spaces', function () {
    assert.strictEqual(geometry.leftAlign('hi', 5), 'hi   ');
  });

  await t.test('leftAlign exact length: no change', function () {
    assert.strictEqual(geometry.leftAlign('hello', 5), 'hello');
  });

  await t.test('leftAlign truncates string longer than width', function () {
    assert.strictEqual(geometry.leftAlign('toolong', 4), 'tool');
  });

  await t.test('leftAlign empty string: all spaces', function () {
    assert.strictEqual(geometry.leftAlign('', 3), '   ');
  });

  await t.test('leftAlign null/undefined: treated as empty', function () {
    assert.strictEqual(geometry.leftAlign(null, 3), '   ');
    assert.strictEqual(geometry.leftAlign(undefined, 3), '   ');
  });

  await t.test('leftAlign width=0: returns empty string', function () {
    assert.strictEqual(geometry.leftAlign('hello', 0), '');
  });

  // ── alignText ─────────────────────────────────────────────────────────────

  await t.test('alignText exports as function', function () {
    assert.strictEqual(typeof geometry.alignText, 'function');
  });

  await t.test('alignText right: delegates to rightAlign', function () {
    assert.strictEqual(geometry.alignText('hi', 5, 'right'), '   hi');
  });

  await t.test('alignText left: delegates to leftAlign', function () {
    assert.strictEqual(geometry.alignText('hi', 5, 'left'), 'hi   ');
  });

  // ── CH=1 edge case documentation ─────────────────────────────────────────

  await t.test('CH=1: stepGeometry produces valid geometry (no wall rows)', function () {
    // CH=1 means zero wall rows — junction and closing collapse into one visual unit.
    // The step has no walls: the junction row (box edge) contains the step, and
    // the text sits on a single row adjacent to the border with no surrounding walls.
    var positions = ['top-right', 'top-left', 'bottom-right', 'bottom-left'];
    positions.forEach(function (pos) {
      var g = geometry.stepGeometry(pos, XI, XL, YI, YL, 1, 5);
      assert.ok(g !== null, 'stepGeometry returns geometry for CH=1, pos=' + pos);
      // Junction row is always the box edge (yi for top, yl-1 for bottom)
      var expectedJunction = pos.indexOf('top') === 0 ? YI : YL - 1;
      assert.strictEqual(g.junctionRow, expectedJunction,
        'junctionRow correct for CH=1, pos=' + pos);
      // Step columns are well-defined regardless of CH
      assert.ok(g.stepLeftCol  < g.stepRightCol, 'stepLeftCol < stepRightCol for pos=' + pos);
    });
  });

  // ── Symmetry checks ───────────────────────────────────────────────────────

  await t.test('top corners share the same junctionRow (yi)', function () {
    var tr = geometry.stepGeometry('top-right', XI, XL, YI, YL, 2, 5);
    var tl = geometry.stepGeometry('top-left',  XI, XL, YI, YL, 2, 5);
    assert.strictEqual(tr.junctionRow, YI);
    assert.strictEqual(tl.junctionRow, YI);
  });

  await t.test('bottom corners share the same junctionRow (yl-1)', function () {
    var br = geometry.stepGeometry('bottom-right', XI, XL, YI, YL, 2, 5);
    var bl = geometry.stepGeometry('bottom-left',  XI, XL, YI, YL, 2, 5);
    assert.strictEqual(br.junctionRow, YL - 1);
    assert.strictEqual(bl.junctionRow, YL - 1);
  });

  await t.test('right corners share stepRightCol (xl-1)', function () {
    var tr = geometry.stepGeometry('top-right',    XI, XL, YI, YL, 2, 5);
    var br = geometry.stepGeometry('bottom-right', XI, XL, YI, YL, 2, 5);
    assert.strictEqual(tr.stepRightCol, XL - 1);
    assert.strictEqual(br.stepRightCol, XL - 1);
  });

  await t.test('left corners share stepLeftCol (xi)', function () {
    var tl = geometry.stepGeometry('top-left',    XI, XL, YI, YL, 2, 5);
    var bl = geometry.stepGeometry('bottom-left', XI, XL, YI, YL, 2, 5);
    assert.strictEqual(tl.stepLeftCol, XI);
    assert.strictEqual(bl.stepLeftCol, XI);
  });

  await t.test('stepWidth = stepRightCol - stepLeftCol - 1 = elemWidth-CW-3 for right corners', function () {
    var CW = 7;
    var elemWidth = XL - XI;  // 50
    var tr = geometry.stepGeometry('top-right', XI, XL, YI, YL, 2, CW);
    var stepWidth = tr.stepRightCol - tr.stepLeftCol - 1;  // interior cols between walls
    assert.strictEqual(stepWidth, elemWidth - CW - 3, 'interior step width should equal elemWidth-CW-3');
  });

  await t.test('stepWidth = stepRightCol - stepLeftCol - 1 = elemWidth-CW-3 for left corners', function () {
    var CW = 7;
    var elemWidth = XL - XI;  // 50
    var tl = geometry.stepGeometry('top-left', XI, XL, YI, YL, 2, CW);
    var stepWidth = tl.stepRightCol - tl.stepLeftCol - 1;
    assert.strictEqual(stepWidth, elemWidth - CW - 3, 'interior step width should equal elemWidth-CW-3');
  });
});
