'use strict';

/**
 * test/sequence-animation.test.js
 *
 * Integration tests for the sequence diagram message animation overlay.
 * Exercises buildMessageCells and overlayMessageAnimations through
 * the public render pipeline, verifying dot placement, snake patterns,
 * stream multi-markers, and self-message loop animation.
 */

const test   = require('node:test');
const assert = require('node:assert');

const { buildSequenceFromData, layout, render, buildMessageCells }
  = require('../lib/widget/sequence');
const { CHARSETS }              = require('../lib/border/charsets');

// ────────────────────────────────────────────────────────────────────
// § Helpers
// ────────────────────────────────────────────────────────────────────

/** Build, layout, and render with a given frame number. */
function renderAtFrame(data, frame) {
  var model = buildSequenceFromData(data);
  layout(model);
  return render(model, { frame: frame });
}

function twoParticipantData(animate) {
  return {
    participants: [{ id: 'A', label: 'Alpha' }, { id: 'B', label: 'Beta' }],
    messages: [{ from: 'A', to: 'B', label: 'msg', animate: animate }]
  };
}

// ────────────────────────────────────────────────────────────────────
// § buildMessageCells — geometry
// ────────────────────────────────────────────────────────────────────

test('buildMessageCells returns horizontal path for normal message', function () {
  var model = buildSequenceFromData(twoParticipantData('animated'));
  layout(model);
  var msg = model.events[0];
  var fromP = model.getParticipant('A');
  var toP = model.getParticipant('B');
  var cells = buildMessageCells(msg, fromP, toP);

  assert.ok(cells.length > 0, 'should produce cells');
  /* All cells on the same Y row (msg.y + 1). */
  var arrowY = msg.y + 1;
  for (var i = 0; i < cells.length; i++) {
    assert.strictEqual(cells[i].y, arrowY, 'all cells should be on arrow row');
  }
});

test('buildMessageCells returns loop path for self-message', function () {
  var data = {
    participants: [{ id: 'A', label: 'A' }],
    messages: [{ from: 'A', to: 'A', label: 'self', animate: 'animated' }]
  };
  var model = buildSequenceFromData(data);
  layout(model);
  var msg = model.events[0];
  var fromP = model.getParticipant('A');
  var cells = buildMessageCells(msg, fromP, fromP);

  assert.ok(cells.length > 0, 'should produce cells for self-message');
  /* Self-message spans 3 rows: y+1, y+2, y+3. */
  var rows = new Set(cells.map(function (c) { return c.y; }));
  assert.ok(rows.has(msg.y + 1), 'should include row y+1');
  assert.ok(rows.has(msg.y + 2), 'should include row y+2');
  assert.ok(rows.has(msg.y + 3), 'should include row y+3');
});

// ────────────────────────────────────────────────────────────────────
// § overlayMessageAnimations — animated style
// ────────────────────────────────────────────────────────────────────

test('animated style places dot at frame 0', function () {
  var text = renderAtFrame(twoParticipantData('animated'), 0);
  var dot = CHARSETS.currentWork.dot;
  assert.ok(text.includes(dot), 'should contain dot marker at frame 0');
});

test('animated style dot moves between frames', function () {
  var text0 = renderAtFrame(twoParticipantData('animated'), 0);
  var text1 = renderAtFrame(twoParticipantData('animated'), 1);
  assert.notStrictEqual(text0, text1,
    'frame 0 and frame 1 should differ as dot moves');
});

// ────────────────────────────────────────────────────────────────────
// § overlayMessageAnimations — snake style
// ────────────────────────────────────────────────────────────────────

test('snake style overlays snake pattern characters', function () {
  var SNAKE_PATTERN = require('../lib/widget/diagram').SNAKE_PATTERN;
  var text = renderAtFrame(twoParticipantData('snake'), 0);
  var hasSnake = SNAKE_PATTERN.some(function (ch) {
    return text.includes(ch);
  });
  assert.ok(hasSnake, 'should contain at least one snake pattern character');
});

// ────────────────────────────────────────────────────────────────────
// § overlayMessageAnimations — stream style
// ────────────────────────────────────────────────────────────────────

test('stream style places multiple dot markers', function () {
  var text = renderAtFrame(twoParticipantData('stream'), 0);
  var dot = CHARSETS.currentWork.dot;
  var count = (text.match(new RegExp(dot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  assert.ok(count >= 2, 'stream should place multiple dots (got ' + count + ')');
});

test('stream with density places more markers at higher density', function () {
  var lowData = {
    participants: [{ id: 'A', label: 'Alpha' }, { id: 'B', label: 'Beta' }],
    messages: [{ from: 'A', to: 'B', label: 'msg', animate: 'stream', density: 0.2 }]
  };
  var highData = {
    participants: [{ id: 'A', label: 'Alpha' }, { id: 'B', label: 'Beta' }],
    messages: [{ from: 'A', to: 'B', label: 'msg', animate: 'stream', density: 0.8 }]
  };
  var dot = CHARSETS.currentWork.dot;
  var dotRe = new RegExp(dot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  var lowText  = renderAtFrame(lowData, 0);
  var highText = renderAtFrame(highData, 0);
  var lowCount  = (lowText.match(dotRe) || []).length;
  var highCount = (highText.match(dotRe) || []).length;
  assert.ok(highCount > lowCount,
    'density 0.8 should produce more markers (' + highCount + ') than 0.2 (' + lowCount + ')');
});

// ────────────────────────────────────────────────────────────────────
// § overlayMessageAnimations — dashed style
// ────────────────────────────────────────────────────────────────────

test('dashed style produces different output between even and odd frames', function () {
  var text0 = renderAtFrame(twoParticipantData('dashed'), 0);
  var text1 = renderAtFrame(twoParticipantData('dashed'), 1);
  assert.notStrictEqual(text0, text1,
    'dashed blink should differ between even and odd frames');
});

// ────────────────────────────────────────────────────────────────────
// § overlayMessageAnimations — spinner style
// ────────────────────────────────────────────────────────────────────

test('spinner style places braille spinner at arrow midpoint', function () {
  var SPINNER_FRAMES = require('../lib/widget/diagram').SPINNER_FRAMES;
  var text = renderAtFrame(twoParticipantData('spinner'), 0);
  var hasSpinner = SPINNER_FRAMES.some(function (ch) {
    return text.includes(ch);
  });
  assert.ok(hasSpinner, 'should contain a braille spinner character');
});

test('spinner character changes between frames', function () {
  var text0 = renderAtFrame(twoParticipantData('spinner'), 0);
  var text1 = renderAtFrame(twoParticipantData('spinner'), 1);
  assert.notStrictEqual(text0, text1,
    'spinner should change between frame 0 and frame 1');
});

// ────────────────────────────────────────────────────────────────────
// § No animation when animate is null
// ────────────────────────────────────────────────────────────────────

test('no overlay when message has no animate property', function () {
  var data = {
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [{ from: 'A', to: 'B', label: 'plain' }]
  };
  var text0 = renderAtFrame(data, 0);
  var text1 = renderAtFrame(data, 1);
  assert.strictEqual(text0, text1,
    'render should be identical across frames when no animation');
});

test('unknown animate value falls through default switch without error', function () {
  /* Exercises the default: break; branch in overlayMessageAnimations. */
  var text = renderAtFrame({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [{ from: 'A', to: 'B', label: 'unk', animate: 'unknownStyle' }]
  }, 0);
  assert.ok(text.includes('unk'), 'should render label despite unknown animate style');
});
