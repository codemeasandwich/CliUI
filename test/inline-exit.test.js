'use strict';

var test = require('node:test');
var assert = require('node:assert');

var galacticaMock = require('./helpers/galactica-mock');
var blessed = require('../blessed');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a mock screen with inline exit mode and an optional box widget.
 * Calls fn(screen, output) inside a try/finally that guarantees cleanup.
 * The output object is the TestOutputBuffer so tests can inspect raw writes.
 */
function withInlineScreen(options, fn) {
  var screenOpts = Object.assign({ exitMode: 'inline' }, options.screenOptions || {});
  var screen = galacticaMock.install({
    cols: options.cols || 40,
    rows: options.rows || 10,
    screenOptions: screenOpts
  });
  var box = null;
  if (options.box !== false) {
    box = blessed.box(Object.assign({
      parent: screen,
      top: 0, left: 0,
      width: '100%', height: '100%',
      content: options.content || 'Hello World'
    }, options.box || {}));
  }
  try {
    fn(screen, screen._testOutput, box);
  } finally {
    galacticaMock.uninstall();
  }
}

/**
 * Create a mock screen with default (restore) exit mode.
 */
function withRestoreScreen(options, fn) {
  var screen = galacticaMock.install({
    cols: options.cols || 40,
    rows: options.rows || 10
  });
  var box = null;
  if (options.box !== false) {
    box = blessed.box(Object.assign({
      parent: screen,
      top: 0, left: 0,
      width: '100%', height: '100%',
      content: options.content || 'Hello World'
    }, options.box || {}));
  }
  try {
    fn(screen, screen._testOutput, box);
  } finally {
    galacticaMock.uninstall();
  }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test('screen exitMode — inline exit mode feature', async function (t) {

  // ── 1. Option storage ───────────────────────────────────────────────────

  await t.test('default exitMode is restore', function () {
    withRestoreScreen({}, function (screen) {
      assert.strictEqual(screen.exitMode, 'restore');
    });
  });

  await t.test('exitMode: inline is stored on the screen instance', function () {
    withInlineScreen({}, function (screen) {
      assert.strictEqual(screen.exitMode, 'inline');
    });
  });

  await t.test('preserveOnExit: true maps to inline exitMode', function () {
    var screen = galacticaMock.install({
      cols: 40, rows: 10,
      screenOptions: { preserveOnExit: true }
    });
    try {
      assert.strictEqual(screen.exitMode, 'inline');
    } finally {
      galacticaMock.uninstall();
    }
  });

  await t.test('explicit exitMode takes precedence over preserveOnExit', function () {
    var screen = galacticaMock.install({
      cols: 40, rows: 10,
      screenOptions: { exitMode: 'restore', preserveOnExit: true }
    });
    try {
      assert.strictEqual(screen.exitMode, 'restore');
    } finally {
      galacticaMock.uninstall();
    }
  });

  // ── 2. Normal destroy does not write snapshot ───────────────────────────

  await t.test('restore mode destroy does not write widget content to output', function () {
    withRestoreScreen({ content: 'SECRET_TEXT' }, function (screen, output) {
      screen.render();
      // Flush any buffered draw() output so it does not leak into the
      // post-clear capture window when destroy() triggers a final flush.
      screen.program.flush();
      // Clear the output buffer so we only see what destroy writes.
      output.clear();
      screen.destroy();
      var finalOutput = output.getOutput();
      assert.strictEqual(
        finalOutput.indexOf('SECRET_TEXT'), -1,
        'restore mode should not write rendered content to the main buffer'
      );
    });
  });

  // ── 3. Inline destroy writes snapshot ───────────────────────────────────

  await t.test('inline mode destroy writes rendered content to output', function () {
    withInlineScreen({ content: 'VISIBLE_DASHBOARD' }, function (screen, output) {
      screen.render();
      // Clear so we isolate the teardown output.
      output.clear();
      screen.destroy();
      var finalOutput = output.getOutput();
      assert.ok(
        finalOutput.indexOf('VISIBLE_DASHBOARD') !== -1,
        'inline mode should write the last frame content into the main buffer'
      );
    });
  });

  // ── 4. SGR codes for styled content ─────────────────────────────────────

  await t.test('inline snapshot contains SGR for bold content', function () {
    withInlineScreen({
      box: {
        top: 0, left: 0, width: '100%', height: '100%',
        content: '{bold}BOLD_TEXT{/bold}',
        tags: true
      }
    }, function (screen, output) {
      screen.render();
      output.clear();
      screen.destroy();
      var finalOutput = output.getOutput();
      // Bold SGR is \x1b[1m (possibly with other attributes)
      assert.ok(
        finalOutput.indexOf('BOLD_TEXT') !== -1,
        'bold text should appear in snapshot'
      );
      // The output should contain an SGR sequence with code 1 (bold)
      assert.ok(
        /\x1b\[[0-9;]*1[;m]/.test(finalOutput),
        'snapshot should contain bold SGR escape sequence'
      );
    });
  });

  // ── 5. Trailing default spaces trimmed ──────────────────────────────────

  await t.test('inline snapshot trims trailing default spaces', function () {
    withInlineScreen({
      cols: 40, rows: 5,
      // Use a narrow box that does not fill the screen, so trailing cells
      // beyond the box content are default-attribute spaces that should be
      // trimmed by the serializer.
      box: {
        top: 0, left: 0, width: 10, height: 3,
        content: 'Hi'
      }
    }, function (screen, output) {
      screen.render();
      screen.program.flush();
      output.clear();
      screen.destroy();
      var finalOutput = output.getOutput();
      // Split into lines and check that no line reaches full terminal width
      // (meaning trailing default spaces were trimmed).
      var lines = finalOutput.split('\n');
      var hasFullWidthLine = lines.some(function (line) {
        // Strip escape sequences to measure visible content length.
        var visible = line.replace(/\x1b\[[0-9;]*m/g, '');
        return visible.length >= 40;
      });
      assert.ok(
        !hasFullWidthLine,
        'serialized lines should not be padded to full terminal width'
      );
    });
  });

  // ── 6. SGR reset at end of styled rows ──────────────────────────────────

  await t.test('SGR resets are emitted after styled runs', function () {
    withInlineScreen({
      box: {
        top: 0, left: 0, width: 20, height: 3,
        content: '{bold}Styled{/bold}',
        tags: true,
        border: { type: 'line' }
      }
    }, function (screen, output) {
      screen.render();
      // Flush buffered draw output before clearing so only inline snapshot
      // content is captured.
      screen.program.flush();
      output.clear();
      screen.destroy();
      var finalOutput = output.getOutput();
      // The serializer emits \x1b[m when transitioning away from a styled
      // run. Because the bold text is followed by default-attr border/space
      // cells, the reset appears mid-row (not necessarily before \n). Verify
      // that SGR resets appear in the inline snapshot output.
      assert.ok(
        finalOutput.indexOf('\x1b[m') !== -1,
        'inline snapshot should contain SGR resets after styled content'
      );
      // Also verify the bold text itself made it through.
      assert.ok(
        finalOutput.indexOf('Styled') !== -1,
        'styled content text should appear in snapshot'
      );
    });
  });

  // ── 7. Double-commit guard ──────────────────────────────────────────────

  await t.test('commitLastFrameInline is a no-op on second call', function () {
    withInlineScreen({ content: 'ONCE' }, function (screen, output) {
      screen.render();
      output.clear();

      // First commit writes the snapshot.
      screen.commitLastFrameInline();
      var afterFirst = output.getOutput();

      // Clear and call again — guard should prevent a second write.
      output.clear();
      screen.commitLastFrameInline();
      var afterSecond = output.getOutput();

      assert.ok(
        afterFirst.indexOf('ONCE') !== -1,
        'first commit should write the snapshot'
      );
      assert.strictEqual(
        afterSecond, '',
        'second commit should be a no-op (guard flag set)'
      );
    });
  });

  // ── 8. Fallback on serializer failure ───────────────────────────────────

  await t.test('destroy falls back to leave() if serializer throws', function () {
    withInlineScreen({ content: 'FALLBACK' }, function (screen, output) {
      screen.render();

      // Sabotage the serializer so it throws.
      screen._serializeFrameForInlineExit = function () {
        throw new Error('intentional test failure');
      };

      // destroy() should not throw — it should fall back to normal leave().
      assert.doesNotThrow(function () {
        screen.destroy();
      }, 'destroy with failing serializer should not throw');
    });
  });

  // ── 9. olines used over lines ───────────────────────────────────────────

  await t.test('snapshot uses olines (rendered) not lines (pending)', function () {
    withInlineScreen({ content: 'RENDERED' }, function (screen, output) {
      screen.render();

      // After render, olines has 'RENDERED'. Now modify lines directly
      // without calling render — simulating a pending change.
      var row = screen.lines[0];
      if (row && row.length >= 7) {
        row[0] = [screen.dattr, 'P'];
        row[1] = [screen.dattr, 'E'];
        row[2] = [screen.dattr, 'N'];
        row[3] = [screen.dattr, 'D'];
        row[4] = [screen.dattr, 'I'];
        row[5] = [screen.dattr, 'N'];
        row[6] = [screen.dattr, 'G'];
      }

      output.clear();
      screen.destroy();
      var finalOutput = output.getOutput();

      assert.ok(
        finalOutput.indexOf('RENDERED') !== -1,
        'snapshot should contain the rendered (olines) content'
      );
      assert.strictEqual(
        finalOutput.indexOf('PENDING'), -1,
        'snapshot should NOT contain the pending (lines) content'
      );
    });
  });

  // ── 10. No-render screen does not crash ─────────────────────────────────

  await t.test('inline exit with no prior render does not crash', function () {
    var screen = galacticaMock.install({
      cols: 20, rows: 5,
      screenOptions: { exitMode: 'inline' }
    });
    try {
      // Do NOT call screen.render() — test that destroy handles an un-rendered
      // screen gracefully.
      assert.doesNotThrow(function () {
        screen.destroy();
      }, 'destroy without prior render should not throw');
    } finally {
      // uninstall may fail since we already destroyed; that is fine.
      try { galacticaMock.uninstall(); } catch (e) { /* already cleaned up */ }
    }
  });

  // ── 11. _inlineCommitted flag is set after commit ───────────────────────

  await t.test('_inlineCommitted flag is set after commitLastFrameInline', function () {
    withInlineScreen({ content: 'FLAG' }, function (screen) {
      assert.strictEqual(screen._inlineCommitted, false, 'starts false');
      screen.render();
      screen.commitLastFrameInline();
      assert.strictEqual(screen._inlineCommitted, true, 'set after commit');
    });
  });

  // ── 12. Viewport clear and cursor home emitted before snapshot ──────────

  await t.test('inline teardown emits cursor-home and erase-display before snapshot', function () {
    withInlineScreen({ content: 'VIEWPORT' }, function (screen, output) {
      screen.render();
      screen.program.flush();
      output.clear();
      screen.destroy();
      var finalOutput = output.getOutput();
      // After leaving alt buffer, the implementation should emit:
      //   \x1b[H  (cursor home)
      //   \x1b[2J (erase display)
      // before the snapshot content.
      var homeIdx = finalOutput.indexOf('\x1b[H');
      var eraseIdx = finalOutput.indexOf('\x1b[2J');
      var contentIdx = finalOutput.indexOf('VIEWPORT');
      assert.ok(homeIdx !== -1, 'cursor-home escape should be present');
      assert.ok(eraseIdx !== -1, 'erase-display escape should be present');
      assert.ok(contentIdx !== -1, 'snapshot content should be present');
      assert.ok(homeIdx < contentIdx, 'cursor-home should precede snapshot content');
      assert.ok(eraseIdx < contentIdx, 'erase-display should precede snapshot content');
    });
  });

  // ── 13. Unicode box-drawing preserved in snapshot ───────────────────────

  await t.test('box-drawing characters survive serialization', function () {
    withInlineScreen({
      box: {
        top: 0, left: 0, width: 10, height: 3,
        border: { type: 'line' },
        content: 'X'
      }
    }, function (screen, output) {
      screen.render();
      output.clear();
      screen.destroy();
      var finalOutput = output.getOutput();
      // Line-border boxes use Unicode box-drawing glyphs like ┌ ─ ┐ │ └ ┘
      // At minimum the top-left corner should be present.
      assert.ok(
        finalOutput.indexOf('┌') !== -1 || finalOutput.indexOf('┐') !== -1
        || finalOutput.indexOf('─') !== -1 || finalOutput.indexOf('│') !== -1,
        'box-drawing glyphs should be preserved in the inline snapshot'
      );
    });
  });
});
