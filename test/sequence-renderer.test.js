'use strict';

/**
 * test/sequence-renderer.test.js
 *
 * Fixture-based render verification for the sequence diagram renderer.
 * Tests that lifelines, arrows, self-messages, sections, notes, and
 * bottom boxes appear in the rendered ASCII output.
 */

const test   = require('node:test');
const assert = require('node:assert');

const { buildSequenceFromData, layout, render,
        LIFELINE_CHAR, ARROW_RIGHT, ARROW_LEFT, SHAFT, DASH }
  = require('../lib/widget/sequence');

// ────────────────────────────────────────────────────────────────────
// § Helpers
// ────────────────────────────────────────────────────────────────────

/** Build, layout, and render a data descriptor. */
function renderFromData(data) {
  var model = buildSequenceFromData(data);
  layout(model);
  return render(model);
}

// ────────────────────────────────────────────────────────────────────
// § Participant rendering
// ────────────────────────────────────────────────────────────────────

test('render includes participant labels in output', function () {
  var text = renderFromData({
    participants: [
      { id: 'A', label: 'Browser' },
      { id: 'B', label: 'Server' }
    ],
    messages: []
  });
  assert.ok(text.includes('Browser'), 'should render Browser label');
  assert.ok(text.includes('Server'), 'should render Server label');
});

test('render draws participant box borders', function () {
  var text = renderFromData({
    participants: [{ id: 'A', label: 'Test' }],
    messages: []
  });
  /* Light charset top-left corner (┌) should be present. */
  assert.ok(text.includes('\u250C'), 'should have top-left corner');
  /* Light charset bottom-right corner (┘). */
  assert.ok(text.includes('\u2518'), 'should have bottom-right corner');
});

// ────────────────────────────────────────────────────────────────────
// § Lifeline rendering
// ────────────────────────────────────────────────────────────────────

test('render draws lifeline characters below participant boxes', function () {
  var text = renderFromData({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [{ from: 'A', to: 'B', label: 'msg' }]
  });
  assert.ok(text.includes(LIFELINE_CHAR),
    'should contain lifeline character (' + LIFELINE_CHAR + ')');
});

// ────────────────────────────────────────────────────────────────────
// § Message arrow rendering
// ────────────────────────────────────────────────────────────────────

test('render draws left-to-right arrow with label', function () {
  var text = renderFromData({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [{ from: 'A', to: 'B', label: 'navigate()' }]
  });
  assert.ok(text.includes('navigate()'), 'should render message label');
  assert.ok(text.includes(ARROW_RIGHT), 'should have right arrowhead');
});

test('render draws right-to-left arrow', function () {
  var text = renderFromData({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [{ from: 'B', to: 'A', label: 'reply' }]
  });
  assert.ok(text.includes(ARROW_LEFT), 'should have left arrowhead');
});

test('render draws dashed arrow shaft', function () {
  var text = renderFromData({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [{ from: 'A', to: 'B', label: 'resp', style: 'dashed' }]
  });
  assert.ok(text.includes(SHAFT.dashed), 'should contain dashed shaft char');
});

test('render draws dotted arrow shaft', function () {
  var text = renderFromData({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [{ from: 'A', to: 'B', label: 'evt', style: 'dotted' }]
  });
  assert.ok(text.includes(SHAFT.dotted), 'should contain dotted shaft char');
});

test('render draws open arrowhead', function () {
  var text = renderFromData({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [{ from: 'A', to: 'B', label: 'x', arrow: 'open' }]
  });
  assert.ok(text.includes('>'), 'should have open arrowhead >');
});

// ────────────────────────────────────────────────────────────────────
// § Self-message rendering
// ────────────────────────────────────────────────────────────────────

test('render draws self-message loop-back', function () {
  var text = renderFromData({
    participants: [{ id: 'A', label: 'A' }],
    messages: [{ from: 'A', to: 'A', label: 'selfCall' }]
  });
  assert.ok(text.includes('selfCall'), 'should render self-message label');
  /* Self-message uses corner characters: ┐ and ┘ */
  assert.ok(text.includes('\u2510'), 'should have top-right corner (┐)');
  assert.ok(text.includes('\u2518'), 'should have bottom-right corner (┘)');
});

// ────────────────────────────────────────────────────────────────────
// § Section rendering
// ────────────────────────────────────────────────────────────────────

test('render draws section separator with label', function () {
  var text = renderFromData({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [
      { from: 'A', to: 'B', label: 'first' }
    ],
    sections: [{ after: 0, label: 'Phase Two' }]
  });
  assert.ok(text.includes('Phase Two'), 'should render section label');
  assert.ok(text.includes(DASH), 'should contain section dash character');
});

// ────────────────────────────────────────────────────────────────────
// § Note rendering
// ────────────────────────────────────────────────────────────────────

test('render draws note with text content', function () {
  var text = renderFromData({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [{ from: 'A', to: 'B', label: 'msg' }],
    notes: [{ over: 'A', text: 'Annotation' }]
  });
  assert.ok(text.includes('Annotation'), 'should render note text');
});

test('render draws between note', function () {
  var text = renderFromData({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [],
    notes: [{ between: ['A', 'B'], text: 'Shared' }]
  });
  assert.ok(text.includes('Shared'), 'should render between-note text');
});

// ────────────────────────────────────────────────────────────────────
// § Bottom boxes
// ────────────────────────────────────────────────────────────────────

test('render draws bottom participant boxes when showBottomBoxes is true', function () {
  var data = {
    participants: [{ id: 'A', label: 'Alpha' }, { id: 'B', label: 'Beta' }],
    messages: [{ from: 'A', to: 'B', label: 'hello' }],
    showBottomBoxes: true
  };
  var text = renderFromData(data);
  /* Count occurrences of participant labels — should appear twice
   * (once at top, once at bottom). */
  var alphaCount = (text.match(/Alpha/g) || []).length;
  assert.strictEqual(alphaCount, 2, 'Alpha should appear in top and bottom boxes');
});

// ────────────────────────────────────────────────────────────────────
// § Multiple messages ordering
// ────────────────────────────────────────────────────────────────────

test('render stacks multiple messages vertically', function () {
  var text = renderFromData({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [
      { from: 'A', to: 'B', label: 'msg1' },
      { from: 'B', to: 'A', label: 'msg2' },
      { from: 'A', to: 'B', label: 'msg3' }
    ]
  });
  var lines = text.split('\n');

  /* Find the rows containing each label. */
  var row1 = lines.findIndex(function (l) { return l.includes('msg1'); });
  var row2 = lines.findIndex(function (l) { return l.includes('msg2'); });
  var row3 = lines.findIndex(function (l) { return l.includes('msg3'); });

  assert.ok(row1 >= 0, 'msg1 should appear in output');
  assert.ok(row2 > row1, 'msg2 should be below msg1');
  assert.ok(row3 > row2, 'msg3 should be below msg2');
});

// ────────────────────────────────────────────────────────────────────
// § Edge cases
// ────────────────────────────────────────────────────────────────────

test('render handles single participant with no messages', function () {
  var text = renderFromData({
    participants: [{ id: 'A', label: 'Solo' }],
    messages: []
  });
  assert.ok(text.includes('Solo'), 'should render the single participant');
});

test('render handles multiline note text', function () {
  var text = renderFromData({
    participants: [{ id: 'A', label: 'A' }],
    messages: [],
    notes: [{ over: 'A', text: 'Line1\nLine2' }]
  });
  assert.ok(text.includes('Line1'), 'should render first line of note');
  assert.ok(text.includes('Line2'), 'should render second line of note');
});

test('render draws message with arrow=none (no arrowhead)', function () {
  var text = renderFromData({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [{ from: 'A', to: 'B', label: 'fire', arrow: 'none' }]
  });
  assert.ok(text.includes('fire'), 'should render label');
  /* arrow=none means no arrowhead character — shaft char used instead. */
  assert.ok(!text.includes(ARROW_RIGHT), 'should not have filled arrowhead');
});

test('render draws note with right position', function () {
  var text = renderFromData({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [],
    notes: [{ over: 'A', text: 'RightNote', position: 'right' }]
  });
  assert.ok(text.includes('RightNote'), 'should render right-positioned note');
});

test('render draws note with left position', function () {
  /* Use two participants so there is room to the left of B. */
  var text = renderFromData({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'BLabel' }],
    messages: [],
    notes: [{ over: 'B', text: 'LN', position: 'left' }]
  });
  assert.ok(text.includes('LN'), 'should render left-positioned note');
});

test('render draws section separator with empty label', function () {
  var text = renderFromData({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [{ from: 'A', to: 'B', label: 'first' }],
    sections: [{ after: 0, label: '' }]
  });
  /* Dashed line should still render even without label text. */
  assert.ok(text.includes(DASH), 'should contain section dash for empty-label section');
});

test('render handles message with empty label', function () {
  var text = renderFromData({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [{ from: 'A', to: 'B', label: '' }]
  });
  /* Should still render the arrow shaft even with no label text. */
  assert.ok(text.includes(ARROW_RIGHT), 'should have arrowhead despite empty label');
});

test('render handles long participant labels', function () {
  var text = renderFromData({
    participants: [
      { id: 'A', label: 'VeryLongParticipantName' },
      { id: 'B', label: 'AnotherLongName' }
    ],
    messages: [{ from: 'A', to: 'B', label: 'msg' }]
  });
  assert.ok(text.includes('VeryLongParticipantName'), 'should render long label');
  assert.ok(text.includes('AnotherLongName'), 'should render long label');
});

// ────────────────────────────────────────────────────────────────────
// § Branch coverage — participant borderStyle, arrow variants,
//   note without anchor, self-message arrow=open/none
// ────────────────────────────────────────────────────────────────────

test('render participant with explicit borderStyle uses that charset', function () {
  /* resolveCharset expects { charset: 'name' } format.
   * Heavy charset top-left is ┏ (U+250F). */
  var text = renderFromData({
    participants: [{ id: 'A', label: 'Heavy', borderStyle: { charset: 'heavy' } }],
    messages: []
  });
  assert.ok(text.includes('\u250F'), 'should use heavy charset top-left corner');
});

test('render open arrowhead for right-to-left message', function () {
  var text = renderFromData({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [{ from: 'B', to: 'A', label: 'back', arrow: 'open' }]
  });
  assert.ok(text.includes('<'), 'should have open left arrowhead <');
});

test('render self-message with arrow=open uses open left arrowhead', function () {
  var text = renderFromData({
    participants: [{ id: 'A', label: 'A' }],
    messages: [{ from: 'A', to: 'A', label: 'selfOpen', arrow: 'open' }]
  });
  assert.ok(text.includes('<'), 'self-message with open arrow should use <');
});

test('render self-message with arrow=none uses shaft for return', function () {
  var text = renderFromData({
    participants: [{ id: 'A', label: 'A' }],
    messages: [{ from: 'A', to: 'A', label: 'selfNone', arrow: 'none' }]
  });
  assert.ok(!text.includes(ARROW_LEFT), 'self-message arrow=none should not have arrowhead');
});

test('render note without participant anchor defaults position', function () {
  /* Note with no over/between — computeNoteX falls back to x=2. */
  var model = buildSequenceFromData({
    participants: [{ id: 'A', label: 'A' }],
    messages: [],
    notes: [{ text: 'Orphan' }]
  });
  layout(model);
  var text = render(model);
  assert.ok(text.includes('Orphan'), 'orphan note should still render');
});
