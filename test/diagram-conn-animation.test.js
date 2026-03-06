'use strict';

/**
 * test/diagram-conn-animation.test.js
 *
 * Integration tests for connection animation overlays.
 * Exercises the overlay functions from render-animation.js with
 * various connector styles (animated, snake, dashed, spinner, bidirectional).
 */

const test   = require('node:test');
const assert = require('node:assert');

const { DiagramModel, SIDE }
  = require('../lib/widget/diagram/diagram-model');
const { render }
  = require('../lib/widget/diagram/diagram-renderer');
const {
  overlayConnAnimations,
  overlayFocusPulse,
  segmentsToCells,
  SPINNER_FRAMES
} = require('../lib/widget/diagram/render-animation');
const { CharBuffer }    = require('../lib/widget/diagram/render-buffer');
const { OccupancyGrid } = require('../lib/widget/diagram/occupancy-grid');

// ────────────────────────────────────────────────────────────────────
// § Helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Create a model with two connected boxes and a routed connector.
 */
function connectedModel(connStyle) {
  const m = new DiagramModel(40, 5);
  const boxA = m.addBox(0, 0, 8, 3, 'A');
  const boxB = m.addBox(15, 0, 8, 3, 'B');
  const pA = m.addPort(boxA.id, SIDE.RIGHT, 0);
  const pB = m.addPort(boxB.id, SIDE.LEFT, 0);
  const conn = m.addConnector(pA.id, pB.id, 'right');

  /* Manually set segments for a straight horizontal connector. */
  conn.segments = [{ x1: 8, y1: 1, x2: 15, y2: 1 }];
  if (connStyle) conn.style = connStyle;

  return { model: m, conn: conn };
}

// ────────────────────────────────────────────────────────────────────
// § overlayConnAnimations
// ────────────────────────────────────────────────────────────────────

test('animated style places marker on path', function () {
  const { model, conn } = connectedModel('animated');
  const buf = new CharBuffer(40, 5, 0, 0);
  const grid = new OccupancyGrid(40, 5);
  const states = new Map([[conn.id, { frame: 0, style: 'animated' }]]);

  overlayConnAnimations(model, buf, grid, states);

  const cells = segmentsToCells(conn.segments);
  const ch = buf.get(cells[0].x, cells[0].y);
  assert.strictEqual(ch, '●', 'frame 0 should place ● at first cell');
});

test('snake style writes pattern along connector', function () {
  const { model, conn } = connectedModel('snake');
  const buf = new CharBuffer(40, 5, 0, 0);
  const grid = new OccupancyGrid(40, 5);
  const states = new Map([[conn.id, { frame: 0, style: 'snake' }]]);

  overlayConnAnimations(model, buf, grid, states);

  const cells = segmentsToCells(conn.segments);
  /* Every cell should have been written to with a snake pattern char. */
  for (let i = 0; i < cells.length; i++) {
    const ch = buf.get(cells[i].x, cells[i].y);
    assert.ok(ch !== ' ', 'cell ' + i + ' should not be empty');
  }
});

test('dashed style blinks cells on even frames', function () {
  const { model, conn } = connectedModel('dashed');
  const buf = new CharBuffer(40, 5, 0, 0);
  const grid = new OccupancyGrid(40, 5);

  /* Fill cells with visible chars first. */
  const cells = segmentsToCells(conn.segments);
  for (let i = 0; i < cells.length; i++) {
    buf.put(cells[i].x, cells[i].y, '─');
  }

  const states = new Map([[conn.id, { frame: 0, style: 'dashed' }]]);
  overlayConnAnimations(model, buf, grid, states);

  /* On frame 0 (even), every other cell should be blank. */
  assert.strictEqual(buf.get(cells[0].x, cells[0].y), ' ');
});

test('spinner style places braille char at midpoint', function () {
  const { model, conn } = connectedModel('spinner');
  const buf = new CharBuffer(40, 5, 0, 0);
  const grid = new OccupancyGrid(40, 5);
  const states = new Map([[conn.id, { frame: 3, style: 'spinner' }]]);

  overlayConnAnimations(model, buf, grid, states);

  const cells = segmentsToCells(conn.segments);
  const mid = Math.floor(cells.length / 2);
  const ch = buf.get(cells[mid].x, cells[mid].y);
  assert.strictEqual(ch, SPINNER_FRAMES[3], 'should use spinner frame 3');
});

test('bidirectional connector bounces marker', function () {
  const { model, conn } = connectedModel('animated');
  conn.bidirectional = true;

  const buf = new CharBuffer(40, 5, 0, 0);
  const grid = new OccupancyGrid(40, 5);
  const states = new Map([[conn.id, { frame: 0, style: 'animated' }]]);

  overlayConnAnimations(model, buf, grid, states);

  /* Should not throw — marker should be placed. */
  const cells = segmentsToCells(conn.segments);
  const ch = buf.get(cells[0].x, cells[0].y);
  assert.ok(ch !== ' ', 'should place a marker');
});

test('dashed style preserves cells on odd frames', function () {
  const { model, conn } = connectedModel('dashed');
  const buf = new CharBuffer(40, 5, 0, 0);
  const grid = new OccupancyGrid(40, 5);

  /* Fill cells with visible chars first. */
  const cells = segmentsToCells(conn.segments);
  for (let i = 0; i < cells.length; i++) {
    buf.put(cells[i].x, cells[i].y, '─');
  }

  /* Frame 1 (odd) — dashed overlay should NOT blank any cells. */
  const states = new Map([[conn.id, { frame: 1, style: 'dashed' }]]);
  overlayConnAnimations(model, buf, grid, states);

  for (let i = 0; i < cells.length; i++) {
    assert.strictEqual(buf.get(cells[i].x, cells[i].y), '─',
      'cell ' + i + ' should be unchanged on odd frame');
  }
});

test('bidirectional animated renders single bounce marker (not two)', function () {
  const { model, conn } = connectedModel('animated');
  conn.bidirectional = true;

  const buf = new CharBuffer(40, 5, 0, 0);
  const grid = new OccupancyGrid(40, 5);

  /* Use frame 0 — bounce logic should place marker at cell 0. */
  const states = new Map([[conn.id, { frame: 0, style: 'animated' }]]);
  overlayConnAnimations(model, buf, grid, states);

  const cells = segmentsToCells(conn.segments);
  /* The bounce marker at frame 0 should be at cell 0. */
  assert.strictEqual(buf.get(cells[0].x, cells[0].y), '●',
    'bounce marker at frame 0');

  /* Cell 1 should NOT have a marker — only one marker for bidirectional. */
  const ch1 = buf.get(cells[1].x, cells[1].y);
  assert.notStrictEqual(ch1, '●',
    'no second linear marker should exist');
});

test('overlayConnAnimations handles null states gracefully', function () {
  const m = new DiagramModel(20, 5);
  const buf = new CharBuffer(20, 5, 0, 0);
  const grid = new OccupancyGrid(20, 5);

  /* Should not throw. */
  overlayConnAnimations(m, buf, grid, null);
});

test('overlayConnAnimations skips connectors with no segments', function () {
  const m = new DiagramModel(20, 5);
  const boxA = m.addBox(0, 0, 8, 3, 'A');
  const boxB = m.addBox(15, 0, 8, 3, 'B');
  const pA = m.addPort(boxA.id, SIDE.RIGHT, 0);
  const pB = m.addPort(boxB.id, SIDE.LEFT, 0);
  const conn = m.addConnector(pA.id, pB.id);
  conn.style = 'animated';
  /* segments is empty by default — should not throw. */

  const buf = new CharBuffer(30, 5, 0, 0);
  const grid = new OccupancyGrid(30, 5);
  const states = new Map([[conn.id, { frame: 0, style: 'animated' }]]);

  overlayConnAnimations(m, buf, grid, states);
});

// ────────────────────────────────────────────────────────────────────
// § overlayFocusPulse
// ────────────────────────────────────────────────────────────────────

test('overlayFocusPulse writes pulse border chars', function () {
  const m = new DiagramModel(20, 5);
  const box = m.addBox(0, 0, 10, 3, 'Focused');

  const buf = new CharBuffer(20, 5, 0, 0);
  const grid = new OccupancyGrid(20, 5);

  /* Frame 0 → light charset. */
  overlayFocusPulse(box.id, 0, m, buf, grid);
  assert.strictEqual(buf.get(0, 0), '┌', 'frame 0 should use light topLeft');

  /* Frame 1 → heavy charset. */
  overlayFocusPulse(box.id, 1, m, buf, grid);
  assert.strictEqual(buf.get(0, 0), '┏', 'frame 1 should use heavy topLeft');

  /* Frame 2 → double charset. */
  overlayFocusPulse(box.id, 2, m, buf, grid);
  assert.strictEqual(buf.get(0, 0), '╔', 'frame 2 should use double topLeft');
});

test('overlayFocusPulse handles non-existent box', function () {
  const m = new DiagramModel(20, 5);
  const buf = new CharBuffer(20, 5, 0, 0);
  const grid = new OccupancyGrid(20, 5);

  /* Should not throw. */
  overlayFocusPulse(999, 0, m, buf, grid);
});

// ────────────────────────────────────────────────────────────────────
// § SPINNER_FRAMES
// ────────────────────────────────────────────────────────────────────

test('SPINNER_FRAMES has 10 braille characters', function () {
  assert.strictEqual(SPINNER_FRAMES.length, 10);
  for (const ch of SPINNER_FRAMES) {
    assert.strictEqual(typeof ch, 'string');
    assert.strictEqual(ch.length, 1);
  }
});

// ────────────────────────────────────────────────────────────────────
// § Render pipeline integration
// ────────────────────────────────────────────────────────────────────

test('render() passes focusPulse and connAnimStates to overlays', function () {
  const m = new DiagramModel(30, 5);
  const box = m.addBox(0, 0, 10, 3, 'Test');

  /* Render with focusedBoxId — should produce output without throwing. */
  const out = render(m, {
    focusedBoxId: box.id,
    focusPulseFrame: 1,
    connAnimStates: null
  });

  assert.ok(out.length > 0, 'should produce output');
  /* Frame 1 → heavy charset pulse. */
  assert.ok(out.includes('┏'), 'should include heavy topLeft from pulse');
});
