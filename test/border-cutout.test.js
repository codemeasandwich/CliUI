'use strict';

var test = require('node:test');
var assert = require('node:assert');

// Load galactica (patches Element.prototype on import)
var galactica = require('../index');
var galacticaMock = require('./helpers/galactica-mock');
var blessed = require('../blessed');

// ---------------------------------------------------------------------------
// Helper: create a fresh screen + box for each sub-test
// ---------------------------------------------------------------------------
function withScreen(options, fn) {
  var screen = galacticaMock.install({ cols: 120, rows: 40 });
  var box = blessed.box(Object.assign({
    parent: screen,
    top: 4, left: 4, width: 50, height: 10,
    border: { type: 'line' },
    content: 'Content'
  }, options.box || {}));
  try {
    fn(screen, box);
  } finally {
    galacticaMock.uninstall();
  }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test('border/cutout.js — setCutout / clearCutout / getCutoutInner', async function (t) {

  // ── 1. Prototype patching ────────────────────────────────────────────────

  await t.test('Element.prototype has setCutout', function () {
    assert.strictEqual(typeof galactica.Element.prototype.setCutout, 'function');
  });

  await t.test('Element.prototype has clearCutout', function () {
    assert.strictEqual(typeof galactica.Element.prototype.clearCutout, 'function');
  });

  await t.test('Element.prototype has getCutoutInner', function () {
    assert.strictEqual(typeof galactica.Element.prototype.getCutoutInner, 'function');
  });

  await t.test('Element.prototype has _paintCutouts', function () {
    assert.strictEqual(typeof galactica.Element.prototype._paintCutouts, 'function');
  });

  // ── 2. setCutout — internal data shape ──────────────────────────────────

  await t.test('setCutout stores correct shape for single-line content', function () {
    withScreen({}, function (screen, box) {
      box.setCutout('top-right', 'cutout here');
      var c = box._cutouts['top-right'];
      assert.ok(c, '_cutouts["top-right"] should exist');
      assert.deepStrictEqual(c.lines, ['cutout here']);
      assert.strictEqual(c.width, 11);
      assert.strictEqual(c.height, 1);
      assert.strictEqual(c.style, null);
    });
  });

  await t.test('setCutout stores correct shape for multi-line content', function () {
    withScreen({}, function (screen, box) {
      box.setCutout('bottom-left', 'cutout here\nmore text');
      var c = box._cutouts['bottom-left'];
      assert.ok(c, '_cutouts["bottom-left"] should exist');
      assert.deepStrictEqual(c.lines, ['cutout here', 'more text']);
      assert.strictEqual(c.width, 11);   // max('cutout here', 'more text') = 11
      assert.strictEqual(c.height, 2);
    });
  });

  await t.test('setCutout CW = max line length', function () {
    withScreen({}, function (screen, box) {
      box.setCutout('top-left', 'short\nlonger text here');
      var c = box._cutouts['top-left'];
      assert.strictEqual(c.width, 16);   // 'longer text here'.length = 16
      assert.strictEqual(c.height, 2);
    });
  });

  await t.test('setCutout stores style when provided', function () {
    withScreen({}, function (screen, box) {
      box.setCutout('top-right', 'label', { fg: 'cyan' });
      assert.deepStrictEqual(box._cutouts['top-right'].style, { fg: 'cyan' });
    });
  });

  await t.test('setCutout stores null style when not provided', function () {
    withScreen({}, function (screen, box) {
      box.setCutout('top-right', 'label');
      assert.strictEqual(box._cutouts['top-right'].style, null);
    });
  });

  // ── 3. setCutout — position validation ──────────────────────────────────

  await t.test('setCutout accepts all four valid positions', function () {
    withScreen({}, function (screen, box) {
      ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach(function (pos) {
        box.setCutout(pos, 'text');
        assert.ok(box._cutouts[pos], 'should store cutout for ' + pos);
      });
    });
  });

  await t.test('setCutout ignores invalid position (no-op)', function () {
    withScreen({}, function (screen, box) {
      box.setCutout('invalid', 'text');
      assert.ok(!box._cutouts || !box._cutouts['invalid'],
        'invalid position should not be stored');
    });
  });

  await t.test('setCutout ignores middle as invalid position', function () {
    withScreen({}, function (screen, box) {
      box.setCutout('top-middle', 'text');
      assert.ok(!box._cutouts || !box._cutouts['top-middle']);
    });
  });

  // ── 4. setCutout — border guard ──────────────────────────────────────────

  await t.test('setCutout is no-op when element has no border', function () {
    withScreen({ box: { border: undefined } }, function (screen, box) {
      box.setCutout('top-right', 'text');
      assert.ok(!box._cutouts || !box._cutouts['top-right'],
        'should be no-op without border');
    });
  });

  await t.test('setCutout is no-op when border.type is not "line"', function () {
    withScreen({ box: { border: { type: 'bg' } } }, function (screen, box) {
      box.setCutout('top-right', 'text');
      assert.ok(!box._cutouts || !box._cutouts['top-right'],
        'should be no-op for bg border type');
    });
  });

  // ── 5. setCutout — replace (override) ────────────────────────────────────

  await t.test('setCutout on same position replaces existing cutout', function () {
    withScreen({}, function (screen, box) {
      box.setCutout('top-right', 'original text');
      box.setCutout('top-right', 'new');
      var c = box._cutouts['top-right'];
      assert.deepStrictEqual(c.lines, ['new']);
      assert.strictEqual(c.width, 3);
      assert.strictEqual(c.height, 1);
    });
  });

  // ── 6. render hook installation ──────────────────────────────────────────

  await t.test('first setCutout wraps render via _origRender', function () {
    withScreen({}, function (screen, box) {
      assert.ok(!box._origRender, '_origRender should not exist before setCutout');
      box.setCutout('top-right', 'text');
      assert.ok(typeof box._origRender === 'function',
        '_origRender should be set after first setCutout');
      // The render function should be a wrapper now
      assert.notStrictEqual(box.render, box._origRender,
        'box.render should be the wrapper, not the original');
    });
  });

  await t.test('second setCutout does not double-wrap render', function () {
    withScreen({}, function (screen, box) {
      box.setCutout('top-right', 'text');
      var origRenderAfterFirst = box._origRender;
      box.setCutout('bottom-left', 'text2');
      assert.strictEqual(box._origRender, origRenderAfterFirst,
        '_origRender should not change on second setCutout');
    });
  });

  // ── 7. clearCutout ────────────────────────────────────────────────────────

  await t.test('clearCutout removes a stored cutout', function () {
    withScreen({}, function (screen, box) {
      box.setCutout('top-right', 'text');
      assert.ok(box._cutouts['top-right'], 'cutout should exist');
      box.clearCutout('top-right');
      assert.ok(!box._cutouts['top-right'], 'cutout should be removed');
    });
  });

  await t.test('clearCutout on non-existent position is safe (no-op)', function () {
    withScreen({}, function (screen, box) {
      assert.doesNotThrow(function () {
        box.clearCutout('top-right');
      });
    });
  });

  await t.test('clearCutout leaves other cutouts intact', function () {
    withScreen({}, function (screen, box) {
      box.setCutout('top-right', 'a');
      box.setCutout('bottom-left', 'b');
      box.clearCutout('top-right');
      assert.ok(!box._cutouts['top-right'], 'top-right should be cleared');
      assert.ok(box._cutouts['bottom-left'], 'bottom-left should remain');
    });
  });

  // ── 8. Multiple cutouts ───────────────────────────────────────────────────

  await t.test('multiple cutouts on different corners coexist', function () {
    withScreen({}, function (screen, box) {
      box.setCutout('top-left', 'TL');
      box.setCutout('top-right', 'TR');
      box.setCutout('bottom-left', 'BL');
      box.setCutout('bottom-right', 'BR');
      assert.strictEqual(Object.keys(box._cutouts).length, 4);
    });
  });

  // ── 9. getCutoutInner ─────────────────────────────────────────────────────

  await t.test('getCutoutInner returns null when no cutout set', function () {
    withScreen({}, function (screen, box) {
      assert.strictEqual(box.getCutoutInner('top-right'), null);
    });
  });

  await t.test('getCutoutInner returns null for CH=1', function () {
    withScreen({}, function (screen, box) {
      box.setCutout('top-right', 'single line');
      assert.strictEqual(box.getCutoutInner('top-right'), null);
    });
  });

  await t.test('getCutoutInner returns null for cleared cutout', function () {
    withScreen({}, function (screen, box) {
      box.setCutout('top-right', 'line1\nline2');
      box.clearCutout('top-right');
      assert.strictEqual(box.getCutoutInner('top-right'), null);
    });
  });

  await t.test('getCutoutInner returns correct bounds for CH=2 (top-right)', function () {
    withScreen({}, function (screen, box) {
      // box: top=4, left=4, width=50, height=10
      // content: 'line1\nline2' → CW=5, CH=2
      box.setCutout('top-right', 'line1\nline2');
      screen.render();
      var inner = box.getCutoutInner('top-right');
      assert.ok(inner !== null, 'should return bounds for CH=2');
      assert.strictEqual(inner.height, 1, 'height should be CH-1 = 1');
      // top = atop - CH + 1 = 4 - 2 + 1 = 3
      assert.strictEqual(inner.top, 3);
      // left = aleft + CW + 2 = 4 + 5 + 2 = 11
      assert.strictEqual(inner.left, 11);
      // width = box.width - CW - 3 = 50 - 5 - 3 = 42
      assert.strictEqual(inner.width, 42);
    });
  });

  await t.test('getCutoutInner returns correct bounds for CH=3 (bottom-left)', function () {
    withScreen({}, function (screen, box) {
      // box: top=4, left=4, width=50, height=10
      // 3 lines: CW = max('a','bb','ccc') = 3, CH=3
      box.setCutout('bottom-left', 'a\nbb\nccc');
      screen.render();
      var inner = box.getCutoutInner('bottom-left');
      assert.ok(inner !== null);
      assert.strictEqual(inner.height, 2, 'height should be CH-1 = 2');
      // top = atop + height = 4 + 10 = 14
      assert.strictEqual(inner.top, 14);
      // left = aleft + 1 = 4 + 1 = 5
      assert.strictEqual(inner.left, 5);
      // width = box.width - CW - 3 = 50 - 3 - 3 = 44
      assert.strictEqual(inner.width, 44);
    });
  });

  await t.test('getCutoutInner returns correct bounds for bottom-right CH=2', function () {
    withScreen({}, function (screen, box) {
      // CW = 5 ('hello'), CH=2
      box.setCutout('bottom-right', 'hello\nworld');
      screen.render();
      var inner = box.getCutoutInner('bottom-right');
      assert.ok(inner !== null);
      assert.strictEqual(inner.height, 1);
      // top = atop + height = 4 + 10 = 14
      assert.strictEqual(inner.top, 14);
      // left = aleft + CW + 2 = 4 + 5 + 2 = 11
      assert.strictEqual(inner.left, 11);
      // width = 50 - 5 - 3 = 42
      assert.strictEqual(inner.width, 42);
    });
  });

  await t.test('getCutoutInner returns correct bounds for top-left CH=2', function () {
    withScreen({}, function (screen, box) {
      // CW = 4 ('text'), CH=2
      box.setCutout('top-left', 'text\nmore');
      screen.render();
      var inner = box.getCutoutInner('top-left');
      assert.ok(inner !== null);
      assert.strictEqual(inner.height, 1);
      // top = atop - CH + 1 = 4 - 2 + 1 = 3
      assert.strictEqual(inner.top, 3);
      // left = aleft + 1 = 4 + 1 = 5
      assert.strictEqual(inner.left, 5);
      // width = 50 - 4 - 3 = 43
      assert.strictEqual(inner.width, 43);
    });
  });

  await t.test('getCutoutInner returns null for invalid/missing position', function () {
    withScreen({}, function (screen, box) {
      assert.strictEqual(box.getCutoutInner('not-a-position'), null);
    });
  });

  // ── 10. _paintCutouts — does not throw ───────────────────────────────────

  await t.test('_paintCutouts does not throw with no screen', function () {
    withScreen({}, function (screen, box) {
      box.setCutout('top-right', 'text');
      var savedScreen = box.screen;
      // Temporarily detach screen reference
      box.screen = null;
      assert.doesNotThrow(function () {
        box._paintCutouts();
      });
      box.screen = savedScreen;
    });
  });

  await t.test('screen.render() works after setCutout', function () {
    withScreen({}, function (screen, box) {
      box.setCutout('top-right', 'hello');
      assert.doesNotThrow(function () {
        screen.render();
      });
    });
  });

  await t.test('screen.render() works with multiple cutouts', function () {
    withScreen({}, function (screen, box) {
      box.setCutout('top-right', 'TR text');
      box.setCutout('bottom-left', 'BL\ntext');
      assert.doesNotThrow(function () {
        screen.render();
      });
    });
  });

  await t.test('screen.render() works after clearCutout', function () {
    withScreen({}, function (screen, box) {
      box.setCutout('top-right', 'text');
      box.clearCutout('top-right');
      assert.doesNotThrow(function () {
        screen.render();
      });
    });
  });

  // ── 11. Index exports ─────────────────────────────────────────────────────

  await t.test('index.js exports charsets', function () {
    assert.ok(galactica.charsets, 'charsets should be exported');
    assert.ok(galactica.charsets.CHARSETS, 'charsets.CHARSETS should exist');
    assert.ok(galactica.charsets.resolveCharset, 'charsets.resolveCharset should exist');
  });
});
