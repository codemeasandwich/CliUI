'use strict';

/**
 * test/sequence-widget.test.js
 *
 * Integration tests for the Sequence diagram widget.
 * Exercises the public API surface: constructor, setData, getData,
 * addParticipant, addMessage, and the buildSequenceFromData builder.
 */

const test   = require('node:test');
const assert = require('node:assert');

const { SequenceModel, buildSequenceFromData, layout, render }
  = require('../lib/widget/sequence');
var galacticaMock  = require('./helpers/galactica-mock');
var TimerController = require('./helpers/timer-control');
var galactica      = require('../index');

// ────────────────────────────────────────────────────────────────────
// § Helpers
// ────────────────────────────────────────────────────────────────────

function basicSeqData() {
  return {
    participants: [
      { id: 'A', label: 'Browser' },
      { id: 'B', label: 'Server' }
    ],
    messages: [
      { from: 'A', to: 'B', label: 'request' },
      { from: 'B', to: 'A', label: 'response' }
    ]
  };
}

// ────────────────────────────────────────────────────────────────────
// § SequenceModel
// ────────────────────────────────────────────────────────────────────

test('SequenceModel can add participants', function () {
  var model = new SequenceModel();
  model.addParticipant('A', 'Browser');
  model.addParticipant('B', 'Server');
  assert.strictEqual(model.participants.length, 2, 'should have 2 participants');
});

test('SequenceModel can find participant by id', function () {
  var model = new SequenceModel();
  model.addParticipant('A', 'Browser');
  var found = model.getParticipant('A');
  assert.ok(found, 'should find participant');
  assert.strictEqual(found.label, 'Browser', 'label should match');
});

test('SequenceModel getParticipant returns null for unknown id', function () {
  var model = new SequenceModel();
  assert.strictEqual(model.getParticipant('Z'), null, 'should return null');
});

test('SequenceModel can add messages', function () {
  var model = new SequenceModel();
  model.addParticipant('A', 'A');
  model.addParticipant('B', 'B');
  model.addMessage('A', 'B', 'hello');
  assert.strictEqual(model.events.length, 1, 'should have 1 event');
  assert.strictEqual(model.events[0].type, 'message', 'should be message type');
});

test('SequenceModel can add sections', function () {
  var model = new SequenceModel();
  model.addSection('Error Flow');
  assert.strictEqual(model.events.length, 1, 'should have 1 event');
  assert.strictEqual(model.events[0].type, 'section', 'should be section type');
  assert.strictEqual(model.events[0].label, 'Error Flow', 'label should match');
});

test('SequenceModel can add notes', function () {
  var model = new SequenceModel();
  model.addParticipant('A', 'A');
  model.addNote('important', 'over', 'A');
  assert.strictEqual(model.events.length, 1, 'should have 1 event');
  assert.strictEqual(model.events[0].type, 'note', 'should be note type');
  assert.strictEqual(model.events[0].text, 'important', 'text should match');
});

// ────────────────────────────────────────────────────────────────────
// § buildSequenceFromData
// ────────────────────────────────────────────────────────────────────

test('buildSequenceFromData creates model with participants', function () {
  var model = buildSequenceFromData(basicSeqData());
  assert.strictEqual(model.participants.length, 2, 'should have 2 participants');
  assert.strictEqual(model.participants[0].id, 'A');
  assert.strictEqual(model.participants[1].id, 'B');
});

test('buildSequenceFromData creates messages in events', function () {
  var model = buildSequenceFromData(basicSeqData());
  var messages = model.events.filter(function (e) { return e.type === 'message'; });
  assert.strictEqual(messages.length, 2, 'should have 2 messages');
  assert.strictEqual(messages[0].label, 'request');
  assert.strictEqual(messages[1].label, 'response');
});

test('buildSequenceFromData creates sections after specified message', function () {
  var data = basicSeqData();
  data.sections = [{ after: 0, label: 'Error handling' }];
  var model = buildSequenceFromData(data);

  /* Events should be: message(request), section(Error handling), message(response). */
  assert.strictEqual(model.events.length, 3, 'should have 3 events');
  assert.strictEqual(model.events[0].type, 'message');
  assert.strictEqual(model.events[1].type, 'section');
  assert.strictEqual(model.events[1].label, 'Error handling');
  assert.strictEqual(model.events[2].type, 'message');
});

test('buildSequenceFromData creates notes', function () {
  var data = basicSeqData();
  data.notes = [{ over: 'A', text: 'User clicks' }];
  var model = buildSequenceFromData(data);
  var notes = model.events.filter(function (e) { return e.type === 'note'; });
  assert.strictEqual(notes.length, 1, 'should have 1 note');
  assert.strictEqual(notes[0].text, 'User clicks');
});

test('buildSequenceFromData creates between notes', function () {
  var data = basicSeqData();
  data.notes = [{ between: ['A', 'B'], text: 'Shared state' }];
  var model = buildSequenceFromData(data);
  var notes = model.events.filter(function (e) { return e.type === 'note'; });
  assert.strictEqual(notes[0].position, 'between', 'should be between position');
  assert.strictEqual(notes[0].participantId, 'A', 'first anchor should be A');
  assert.strictEqual(notes[0].participantId2, 'B', 'second anchor should be B');
});

test('buildSequenceFromData passes message style and arrow', function () {
  var data = {
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [{ from: 'A', to: 'B', label: 'x', style: 'dashed', arrow: 'open' }]
  };
  var model = buildSequenceFromData(data);
  assert.strictEqual(model.events[0].style, 'dashed', 'should carry style');
  assert.strictEqual(model.events[0].arrow, 'open', 'should carry arrow type');
});

test('buildSequenceFromData supports showBottomBoxes', function () {
  var data = basicSeqData();
  data.showBottomBoxes = true;
  var model = buildSequenceFromData(data);
  assert.strictEqual(model.showBottomBoxes, true, 'model should have showBottomBoxes true');
});

test('buildSequenceFromData handles self-messages', function () {
  var data = {
    participants: [{ id: 'A', label: 'A' }],
    messages: [{ from: 'A', to: 'A', label: 'self-loop' }]
  };
  var model = buildSequenceFromData(data);
  var msg = model.events[0];
  assert.strictEqual(msg.from, 'A');
  assert.strictEqual(msg.to, 'A');
  assert.strictEqual(msg.label, 'self-loop');
});

test('buildSequenceFromData handles empty data gracefully', function () {
  var model = buildSequenceFromData({ participants: [] });
  assert.strictEqual(model.participants.length, 0, 'should have 0 participants');
  assert.strictEqual(model.events.length, 0, 'should have 0 events');
});

test('buildSequenceFromData passes participant borderStyle', function () {
  var data = {
    participants: [{ id: 'A', label: 'A', borderStyle: 'double' }],
    messages: []
  };
  var model = buildSequenceFromData(data);
  assert.strictEqual(model.participants[0].borderStyle, 'double');
});

// ────────────────────────────────────────────────────────────────────
// § Layout
// ────────────────────────────────────────────────────────────────────

test('layout assigns participant positions', function () {
  var model = buildSequenceFromData(basicSeqData());
  layout(model);
  assert.ok(model.participants[0].x > 0, 'first participant should have x > 0');
  assert.ok(model.participants[1].x > model.participants[0].x,
    'second participant should be to the right of first');
});

test('layout assigns event Y positions', function () {
  var model = buildSequenceFromData(basicSeqData());
  layout(model);
  var messages = model.events.filter(function (e) { return e.type === 'message'; });
  assert.ok(messages[0].y > 0, 'first message should have y > 0');
  assert.ok(messages[1].y > messages[0].y, 'second message should be below first');
});

test('layout computes model bounds', function () {
  var model = buildSequenceFromData(basicSeqData());
  layout(model);
  assert.ok(model.width >= 40, 'model width should be at least 40');
  assert.ok(model.height >= 10, 'model height should be at least 10');
});

test('layout computes lifeline center from participant width', function () {
  var model = buildSequenceFromData(basicSeqData());
  layout(model);
  var p = model.participants[0];
  assert.strictEqual(p.lifelineX, p.x + Math.floor(p.width / 2),
    'lifelineX should be centered on participant box');
});

test('layout allocates more rows for self-messages than normal messages', function () {
  var data = {
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [
      { from: 'A', to: 'B', label: 'normal' },
      { from: 'A', to: 'A', label: 'self' },
      { from: 'A', to: 'B', label: 'after' }
    ]
  };
  var model = buildSequenceFromData(data);
  layout(model);
  var msgs = model.events.filter(function (e) { return e.type === 'message'; });
  /* Normal message consumes 2 rows; self-message consumes 4 rows. */
  var normalGap = msgs[1].y - msgs[0].y;
  var selfGap   = msgs[2].y - msgs[1].y;
  assert.strictEqual(normalGap, 2, 'normal message should consume 2 rows');
  assert.strictEqual(selfGap, 4, 'self-message should consume 4 rows');
});

test('buildSequenceFromData defaults section after to last message index', function () {
  var data = {
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [
      { from: 'A', to: 'B', label: 'first' },
      { from: 'B', to: 'A', label: 'second' }
    ],
    sections: [{ label: 'EndSection' }]
  };
  var model = buildSequenceFromData(data);
  /* Without explicit after, section should appear after last message. */
  assert.strictEqual(model.events.length, 3, 'should have 3 events');
  assert.strictEqual(model.events[2].type, 'section', 'last event should be section');
  assert.strictEqual(model.events[2].label, 'EndSection');
});

test('layout computes note dimensions from text', function () {
  var data = {
    participants: [{ id: 'A', label: 'A' }],
    messages: [],
    notes: [{ over: 'A', text: 'Short\nLonger line here' }]
  };
  var model = buildSequenceFromData(data);
  layout(model);
  var note = model.events.filter(function (e) { return e.type === 'note'; })[0];
  /* 2 lines of text + 2 border rows = 4 height. */
  assert.strictEqual(note.height, 4, 'note height should be text lines + 2');
  /* Longest line is 'Longer line here' (16 chars) + 4 padding = 20 width. */
  assert.strictEqual(note.width, 20, 'note width should be max line length + 4');
});

// ────────────────────────────────────────────────────────────────────
// § Full build → layout → render round-trip
// ────────────────────────────────────────────────────────────────────

test('build + layout + render produces text output', function () {
  var model = buildSequenceFromData(basicSeqData());
  layout(model);
  var text = render(model);
  assert.ok(text.length > 0, 'render output should not be empty');
  assert.ok(text.includes('Browser'), 'should include participant label');
  assert.ok(text.includes('Server'), 'should include participant label');
});

// ────────────────────────────────────────────────────────────────────
// § Animation integration
// ────────────────────────────────────────────────────────────────────

test('render with frame=0 and animated message produces dot marker', function () {
  var model = buildSequenceFromData({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [{ from: 'A', to: 'B', label: 'go', animate: 'animated' }]
  });
  layout(model);
  var CHARSETS = require('../lib/border/charsets').CHARSETS;
  var dot = CHARSETS.currentWork.dot;
  var text0 = render(model, { frame: 0 });
  assert.ok(text0.includes(dot),
    'animated message should produce a dot marker at frame 0');
});

test('animated message dot moves between frames', function () {
  var model = buildSequenceFromData({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [{ from: 'A', to: 'B', label: 'go', animate: 'animated' }]
  });
  layout(model);
  var text0 = render(model, { frame: 0 });
  var text1 = render(model, { frame: 1 });
  assert.notStrictEqual(text0, text1,
    'render output should differ between frame 0 and frame 1');
});

// ────────────────────────────────────────────────────────────────────
// § Sequence widget lifecycle (through public widget API)
// ────────────────────────────────────────────────────────────────────

/**
 * Create a Sequence widget on a mock screen.
 * Returns { screen, seq, cleanup }.
 */
function createSequenceWidget(data) {
  var tc = new TimerController();
  tc.install();
  var screen = galacticaMock.install({ cols: 120, rows: 40 });

  var seq = galactica.sequence({
    parent: screen,
    top: 0,
    left: 0,
    width: 80,
    height: 20,
    animate: false
  });

  /* Force deferred init synchronously. */
  seq._deferredInit({ animate: false });

  if (data) {
    seq.setData(data);
  }

  return {
    screen: screen,
    seq: seq,
    cleanup: function () {
      seq._stopAnimation();
      tc.cleanup();
      tc.restore();
      galacticaMock.uninstall();
    }
  };
}

test('Sequence widget can be constructed', function () {
  var ctx = createSequenceWidget();
  assert.ok(ctx.seq, 'widget should exist');
  assert.strictEqual(ctx.seq.type, 'sequence', 'type should be sequence');
  ctx.cleanup();
});

test('Sequence widget setData populates model and renders', function () {
  var ctx = createSequenceWidget(basicSeqData());
  assert.ok(ctx.seq._model, 'model should be set after setData');
  assert.strictEqual(ctx.seq._model.participants.length, 2,
    'model should have 2 participants');
  var content = ctx.seq.getContent();
  assert.ok(content.length > 0, 'widget should have rendered content');
  ctx.cleanup();
});

test('Sequence widget getData returns descriptor', function () {
  var ctx = createSequenceWidget(basicSeqData());
  var data = ctx.seq.getData();
  assert.ok(data, 'getData should return an object');
  assert.strictEqual(data.participants.length, 2, 'should have 2 participants');
  assert.strictEqual(data.messages.length, 2, 'should have 2 messages');
  assert.strictEqual(data.messages[0].label, 'request');
  ctx.cleanup();
});

test('Sequence widget getData preserves sections on round-trip', function () {
  var data = basicSeqData();
  data.sections = [{ after: 0, label: 'Error flow' }];
  var ctx = createSequenceWidget(data);
  var out = ctx.seq.getData();
  assert.ok(out.sections, 'getData should include sections');
  assert.strictEqual(out.sections.length, 1, 'should have 1 section');
  assert.strictEqual(out.sections[0].label, 'Error flow');
  assert.strictEqual(out.sections[0].after, 0, 'section after index should be 0');
  ctx.cleanup();
});

test('Sequence widget getData preserves notes on round-trip', function () {
  var data = basicSeqData();
  data.notes = [{ over: 'A', text: 'User clicks' }];
  var ctx = createSequenceWidget(data);
  var out = ctx.seq.getData();
  assert.ok(out.notes, 'getData should include notes');
  assert.strictEqual(out.notes.length, 1, 'should have 1 note');
  assert.strictEqual(out.notes[0].text, 'User clicks');
  assert.strictEqual(out.notes[0].over, 'A');
  ctx.cleanup();
});

test('Sequence widget getData preserves between notes on round-trip', function () {
  var data = basicSeqData();
  data.notes = [{ between: ['A', 'B'], text: 'Shared' }];
  var ctx = createSequenceWidget(data);
  var out = ctx.seq.getData();
  assert.ok(out.notes, 'getData should include notes');
  assert.deepStrictEqual(out.notes[0].between, ['A', 'B']);
  assert.strictEqual(out.notes[0].text, 'Shared');
  ctx.cleanup();
});

test('Sequence widget getData includes animate property', function () {
  var ctx = createSequenceWidget({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [{ from: 'A', to: 'B', label: 'go', animate: 'animated' }]
  });
  var out = ctx.seq.getData();
  assert.strictEqual(out.messages[0].animate, 'animated',
    'should preserve animate property');
  ctx.cleanup();
});

test('Sequence widget addParticipant adds to model', function () {
  var ctx = createSequenceWidget(basicSeqData());
  ctx.seq.addParticipant('C', 'Database');
  assert.strictEqual(ctx.seq._model.participants.length, 3,
    'should have 3 participants after addParticipant');
  ctx.cleanup();
});

test('Sequence widget addMessage adds to model', function () {
  var ctx = createSequenceWidget(basicSeqData());
  ctx.seq.addMessage('A', 'B', 'ping');
  var messages = ctx.seq._model.events.filter(function (e) {
    return e.type === 'message';
  });
  assert.strictEqual(messages.length, 3, 'should have 3 messages after addMessage');
  ctx.cleanup();
});

test('Sequence widget getData returns null without setData', function () {
  var ctx = createSequenceWidget();
  assert.strictEqual(ctx.seq.getData(), null, 'getData before setData should be null');
  ctx.cleanup();
});

test('Sequence widget addParticipant is no-op without model', function () {
  var ctx = createSequenceWidget();
  /* Should not throw. */
  ctx.seq.addParticipant('X', 'Extra');
  assert.strictEqual(ctx.seq._model, null, 'model should remain null');
  ctx.cleanup();
});

test('Sequence widget addMessage is no-op without model', function () {
  var ctx = createSequenceWidget();
  ctx.seq.addMessage('X', 'Y', 'msg');
  assert.strictEqual(ctx.seq._model, null, 'model should remain null');
  ctx.cleanup();
});

test('Sequence widget render returns coordinates', function () {
  var ctx = createSequenceWidget(basicSeqData());
  var coords = ctx.seq.render();
  assert.ok(coords, 'render should return coordinates');
  ctx.cleanup();
});

test('Sequence widget _fullRender is no-op without model', function () {
  var ctx = createSequenceWidget();
  /* Should not throw when model is null. */
  ctx.seq._fullRender();
  ctx.cleanup();
});

test('Sequence widget setData with showBottomBoxes', function () {
  var data = basicSeqData();
  data.showBottomBoxes = true;
  var ctx = createSequenceWidget(data);
  assert.strictEqual(ctx.seq._model.showBottomBoxes, true,
    'showBottomBoxes should be set on model');
  ctx.cleanup();
});

test('Sequence widget deferred init with data', function () {
  var tc = new TimerController();
  tc.install();
  var screen = galacticaMock.install({ cols: 120, rows: 40 });

  var seq = galactica.sequence({
    parent: screen,
    top: 0,
    left: 0,
    width: 80,
    height: 20,
    animate: false,
    data: basicSeqData()
  });

  /* Force deferred init which should process options.data. */
  seq._deferredInit({ data: basicSeqData(), animate: false });
  assert.ok(seq._model, 'model should be set via deferred init data');
  assert.strictEqual(seq._model.participants.length, 2);

  seq._stopAnimation();
  tc.cleanup();
  tc.restore();
  galacticaMock.uninstall();
});

test('Sequence widget _hasAnimatedMessages returns false for no messages', function () {
  var ctx = createSequenceWidget(basicSeqData());
  /* basicSeqData has no animate property on messages. */
  assert.strictEqual(ctx.seq._hasAnimatedMessages(), false,
    'should return false when no animated messages');
  ctx.cleanup();
});

test('Sequence widget _startAnimation is no-op when no animated messages', function () {
  var ctx = createSequenceWidget(basicSeqData());
  ctx.seq._startAnimation();
  assert.strictEqual(ctx.seq._animTimer, null,
    'timer should not start without animated messages');
  ctx.cleanup();
});

test('Sequence widget render override initialises content if empty', function () {
  var ctx = createSequenceWidget(basicSeqData());
  /* Clear content and verify render repopulates it. */
  ctx.seq.setContent('');
  ctx.seq.render();
  var content = ctx.seq.getContent();
  assert.ok(content.length > 0, 'render should repopulate content from model');
  ctx.cleanup();
});

test('Sequence widget _stopAnimation clears active timer', function () {
  var ctx = createSequenceWidget();
  /* Manually set a timer to simulate active animation. */
  ctx.seq._animTimer = setInterval(function () {}, 10000);
  assert.ok(ctx.seq._animTimer, 'timer should be set');
  ctx.seq._stopAnimation();
  assert.strictEqual(ctx.seq._animTimer, null, 'timer should be cleared');
  ctx.cleanup();
});

test('Sequence widget _startAnimation starts timer with animated messages', function () {
  var ctx = createSequenceWidget({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [{ from: 'A', to: 'B', label: 'go', animate: 'animated' }]
  });
  /* _animateEnabled defaults to true (animate option not set to false
   * in this specific widget, but createSequenceWidget sets animate:false).
   * Manually enable it for this test. */
  ctx.seq._animateEnabled = true;
  ctx.seq._animTimer = null;
  ctx.seq._startAnimation();
  assert.ok(ctx.seq._animTimer, 'timer should be started');
  ctx.seq._stopAnimation();
  ctx.cleanup();
});

test('Sequence widget _hasAnimatedMessages returns true with animated messages', function () {
  var ctx = createSequenceWidget({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [{ from: 'A', to: 'B', label: 'go', animate: 'animated' }]
  });
  assert.strictEqual(ctx.seq._hasAnimatedMessages(), true,
    'should return true when animated messages exist');
  ctx.cleanup();
});

test('Sequence widget _startAnimation does not double-start', function () {
  var ctx = createSequenceWidget({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [{ from: 'A', to: 'B', label: 'go', animate: 'animated' }]
  });
  ctx.seq._animateEnabled = true;
  ctx.seq._animTimer = null;
  ctx.seq._startAnimation();
  var firstTimer = ctx.seq._animTimer;
  ctx.seq._startAnimation();
  assert.strictEqual(ctx.seq._animTimer, firstTimer,
    'second start should not create a new timer');
  ctx.seq._stopAnimation();
  ctx.cleanup();
});

// ────────────────────────────────────────────────────────────────────
// § addSection / addNote
// ────────────────────────────────────────────────────────────────────

test('Sequence widget addSection adds section to model', function () {
  var ctx = createSequenceWidget(basicSeqData());
  ctx.seq.addSection('Error flow');
  var sections = ctx.seq._model.events.filter(function (e) {
    return e.type === 'section';
  });
  assert.strictEqual(sections.length, 1, 'should have 1 section');
  assert.strictEqual(sections[0].label, 'Error flow');
  ctx.cleanup();
});

test('Sequence widget addSection is no-op without model', function () {
  var ctx = createSequenceWidget();
  ctx.seq.addSection('Nope');
  assert.strictEqual(ctx.seq._model, null, 'model should remain null');
  ctx.cleanup();
});

test('Sequence widget addNote adds note to model', function () {
  var ctx = createSequenceWidget(basicSeqData());
  ctx.seq.addNote('Important', 'over', 'A');
  var notes = ctx.seq._model.events.filter(function (e) {
    return e.type === 'note';
  });
  assert.strictEqual(notes.length, 1, 'should have 1 note');
  assert.strictEqual(notes[0].text, 'Important');
  ctx.cleanup();
});

test('Sequence widget addNote with between position', function () {
  var ctx = createSequenceWidget(basicSeqData());
  ctx.seq.addNote('Shared state', 'between', 'A', 'B');
  var notes = ctx.seq._model.events.filter(function (e) {
    return e.type === 'note';
  });
  assert.strictEqual(notes[0].position, 'between');
  assert.strictEqual(notes[0].participantId, 'A');
  assert.strictEqual(notes[0].participantId2, 'B');
  ctx.cleanup();
});

test('Sequence widget addNote is no-op without model', function () {
  var ctx = createSequenceWidget();
  ctx.seq.addNote('Nope', 'over', 'A');
  assert.strictEqual(ctx.seq._model, null, 'model should remain null');
  ctx.cleanup();
});

// ────────────────────────────────────────────────────────────────────
// § showBottomBoxes constructor option
// ────────────────────────────────────────────────────────────────────

test('Sequence widget getData round-trips note with non-over position', function () {
  var data = basicSeqData();
  data.notes = [{ over: 'A', text: 'RightSide', position: 'right' }];
  var ctx = createSequenceWidget(data);
  var out = ctx.seq.getData();
  assert.strictEqual(out.notes[0].position, 'right',
    'getData should preserve non-over note position');
  ctx.cleanup();
});

test('Sequence widget setData without showBottomBoxes uses constructor option', function () {
  /* Exercises the else-if branch in setData where data.showBottomBoxes is null
   * but this._showBottomBoxes is true from the constructor. */
  var tc = new TimerController();
  tc.install();
  var screen = galacticaMock.install({ cols: 120, rows: 40 });

  var seq = galactica.sequence({
    parent: screen,
    top: 0, left: 0, width: 80, height: 20,
    animate: false,
    showBottomBoxes: true
  });

  seq._deferredInit({ animate: false, showBottomBoxes: true });
  /* setData without showBottomBoxes — constructor option should apply. */
  seq.setData(basicSeqData());
  assert.strictEqual(seq._model.showBottomBoxes, true,
    'constructor showBottomBoxes should apply when data omits it');

  seq._stopAnimation();
  tc.cleanup();
  tc.restore();
  galacticaMock.uninstall();
});

test('Sequence widget addMessage with animate triggers animation timer', function () {
  var ctx = createSequenceWidget(basicSeqData());
  ctx.seq._animateEnabled = true;
  ctx.seq.addMessage('A', 'B', 'anim', { animate: 'animated' });
  assert.ok(ctx.seq._animTimer, 'timer should start after adding animated message');
  ctx.cleanup();
});

test('Sequence widget respects showBottomBoxes constructor option', function () {
  var tc = new TimerController();
  tc.install();
  var screen = galacticaMock.install({ cols: 120, rows: 40 });

  var seq = galactica.sequence({
    parent: screen,
    top: 0, left: 0, width: 80, height: 20,
    animate: false,
    showBottomBoxes: true,
    data: basicSeqData()
  });

  seq._deferredInit({
    data: basicSeqData(), animate: false, showBottomBoxes: true
  });

  assert.strictEqual(seq._model.showBottomBoxes, true,
    'showBottomBoxes from constructor should be applied to model');

  seq._stopAnimation();
  tc.cleanup();
  tc.restore();
  galacticaMock.uninstall();
});

// ────────────────────────────────────────────────────────────────────
// § Branch coverage — entity defaults, layout edge cases, widget-core
// ────────────────────────────────────────────────────────────────────

test('SequenceModel addParticipant with null label defaults to id', function () {
  /* Exercises createParticipant label || id fallback. */
  var model = new SequenceModel();
  model.addParticipant('X', null);
  assert.strictEqual(model.participants[0].label, 'X',
    'label should default to id when null');
});

test('SequenceModel addMessage with null label defaults to empty string', function () {
  /* Exercises createMessage label || '' fallback. */
  var model = new SequenceModel();
  model.addParticipant('A', 'A');
  model.addMessage('A', 'A', null);
  assert.strictEqual(model.events[0].label, '',
    'message label should default to empty string');
});

test('SequenceModel addMessage without opts uses defaults', function () {
  /* Exercises createMessage opts fallbacks: style||solid, arrow||filled. */
  var model = new SequenceModel();
  model.addParticipant('A', 'A');
  model.addMessage('A', 'A', 'test');
  var msg = model.events[0];
  assert.strictEqual(msg.style, 'solid', 'style should default to solid');
  assert.strictEqual(msg.arrow, 'filled', 'arrow should default to filled');
  assert.strictEqual(msg.animate, null, 'animate should default to null');
  assert.strictEqual(msg.density, null, 'density should default to null');
});

test('SequenceModel addSection with null label defaults to empty string', function () {
  /* Exercises createSection label || '' fallback. */
  var model = new SequenceModel();
  model.addSection(null);
  assert.strictEqual(model.events[0].label, '',
    'section label should default to empty string');
});

test('SequenceModel addNote with null text defaults to empty string', function () {
  /* Exercises createNote text || '' and position || 'over' fallbacks. */
  var model = new SequenceModel();
  model.addNote(null, null, null);
  assert.strictEqual(model.events[0].text, '',
    'note text should default to empty string');
  assert.strictEqual(model.events[0].position, 'over',
    'note position should default to over');
});

test('SequenceModel addParticipant with explicit borderStyle', function () {
  /* Exercises createParticipant borderStyle || null when truthy. */
  var model = new SequenceModel();
  model.addParticipant('A', 'A', { charset: 'heavy' });
  assert.deepStrictEqual(model.participants[0].borderStyle, { charset: 'heavy' },
    'borderStyle should be stored as-is');
});

test('layout handles unknown event type in events list', function () {
  /* Exercises the default: y += 1 branch in layout. */
  var model = new SequenceModel();
  model.addParticipant('A', 'A');
  /* Inject a custom event type. */
  model.events.push({ type: 'custom', y: 0 });
  model.events.push({ type: 'message', from: 'A', to: 'A', label: 'x', y: 0 });
  layout(model);
  /* The custom event should consume 1 row, message after consumes 4 (self). */
  assert.ok(model.events[1].y > model.events[0].y,
    'message y should be greater than custom event y');
});

test('layout handles message referencing unknown participant gracefully', function () {
  /* Exercises participantIndex returning -1 in gap calculation. */
  var model = new SequenceModel();
  model.addParticipant('A', 'A');
  model.addParticipant('B', 'B');
  /* Inject a message with a from participant that doesn't exist. */
  model.events.push({
    type: 'message', from: 'GHOST', to: 'A', label: 'phantom', y: 0
  });
  /* Should not throw — gap calculation skips unknown participants. */
  layout(model);
  assert.ok(model.width > 0, 'layout should complete without error');
});

test('buildSequenceFromData with section missing after field', function () {
  /* Exercises sections[si].after != null ternary — null branch. */
  var data = {
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [
      { from: 'A', to: 'B', label: 'first' },
      { from: 'B', to: 'A', label: 'second' }
    ],
    sections: [{ label: 'End' }]
  };
  var model = buildSequenceFromData(data);
  /* Section should appear after last message. */
  assert.strictEqual(model.events[model.events.length - 1].type, 'section');
});

test('buildSequenceFromData with note that has explicit position', function () {
  /* Exercises n.position || (n.between ? ...) where position is truthy. */
  var data = {
    participants: [{ id: 'A', label: 'A' }],
    messages: [],
    notes: [{ over: 'A', text: 'Noted', position: 'left' }]
  };
  var model = buildSequenceFromData(data);
  assert.strictEqual(model.events[0].position, 'left',
    'explicit note position should be preserved');
});

test('Sequence widget render with child element missing _clines', function () {
  /* Exercises the _clines guard in seq-widget-render.js L50-62.
   * Use a real blessed Box child, null out _clines, and stub
   * parseContent to NOT set _clines — so the fallback code runs. */
  var blessed = require('../blessed');
  var ctx = createSequenceWidget(basicSeqData());
  var child = blessed.box({ parent: ctx.seq, width: 5, height: 1 });
  /* Null _clines and make parseContent a no-op so the guard creates
   * the placeholder array structure at L54-61. */
  child._clines = null;
  child.parseContent = function () { /* no-op: simulates failed parse */ };
  ctx.seq.render();
  assert.ok(child._clines != null, '_clines should be initialised after render');
  assert.strictEqual(child._clines.width, 0, '_clines.width should be 0');
  assert.strictEqual(child._clines.content, '', '_clines.content should be empty');
  ctx.cleanup();
});

test('SequenceModel addMessage with density passes through', function () {
  /* Exercises createMessage density != null branch. */
  var model = new SequenceModel();
  model.addParticipant('A', 'A');
  model.addMessage('A', 'A', 'x', { density: 0.5 });
  assert.strictEqual(model.events[0].density, 0.5, 'density should be preserved');
});

test('Sequence widget detach event stops animation', function () {
  /* Exercises the detach event handler at seq-widget-core.js L64. */
  var ctx = createSequenceWidget({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [{ from: 'A', to: 'B', label: 'go', animate: 'animated' }]
  });
  ctx.seq._animateEnabled = true;
  ctx.seq._startAnimation();
  assert.ok(ctx.seq._animTimer, 'timer should be running');

  /* Emit detach to trigger _stopAnimation. */
  ctx.seq.emit('detach');
  assert.strictEqual(ctx.seq._animTimer, null,
    'timer should be cleared after detach');
  ctx.cleanup();
});

test('Sequence widget animation timer fires and increments frame', function (t, done) {
  /* Exercises the setInterval callback body at seq-widget-core.js L112-118.
   * We start a real timer and wait for it to fire once. */
  var tc = new TimerController();
  tc.install();
  var screen = galacticaMock.install({ cols: 120, rows: 40 });

  var seq = galactica.sequence({
    parent: screen,
    top: 0, left: 0, width: 80, height: 20,
    animate: true
  });
  seq._deferredInit({ animate: true });
  seq.setData({
    participants: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    messages: [{ from: 'A', to: 'B', label: 'go', animate: 'animated' }]
  });

  assert.ok(seq._animTimer, 'animation timer should be started');

  /* Wait 200ms for the 150ms interval to fire at least once. */
  setTimeout(function () {
    assert.ok(seq._animFrame >= 1,
      'frame should have incremented (got ' + seq._animFrame + ')');
    seq._stopAnimation();
    tc.cleanup();
    tc.restore();
    galacticaMock.uninstall();
    done();
  }, 200);
});

test('Sequence widget attach event runs deferred init via nextTick', function (t, done) {
  /* Exercises the process.nextTick callback at seq-widget-core.js L57-59. */
  var tc = new TimerController();
  tc.install();
  var screen = galacticaMock.install({ cols: 120, rows: 40 });

  var seq = galactica.sequence({
    parent: screen,
    top: 0, left: 0, width: 80, height: 20,
    animate: false,
    data: basicSeqData()
  });

  /* Reset deferred init flag so the attach handler's nextTick
   * callback will execute _deferredInit with the constructor options. */
  seq._deferredInitDone = false;
  seq._model = null;

  /* Emit attach — this queues a process.nextTick. */
  seq.emit('attach');

  /* Wait for the nextTick callback to fire. */
  process.nextTick(function () {
    assert.ok(seq._model, 'model should be set after attach + nextTick');
    seq._stopAnimation();
    tc.cleanup();
    tc.restore();
    galacticaMock.uninstall();
    done();
  });
});
