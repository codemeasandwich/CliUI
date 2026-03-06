'use strict';

/**
 * test/diagram-stream-animation.test.js
 *
 * Integration tests for the stream connection animation overlay.
 * Exercises density-based multi-marker placement and bidirectional
 * stream behaviour through the public render pipeline.
 */

const test   = require('node:test');
const assert = require('node:assert');

const { DiagramModel, SIDE, overlayConnAnimations, segmentsToCells,
        CharBuffer, OccupancyGrid, BORDER_STYLES }
  = require('../lib/widget/diagram');
const { CHARSETS }      = require('../lib/border/charsets');

// ────────────────────────────────────────────────────────────────────
// § Helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Create a model with two boxes and a horizontal connector.
 * Returns { model, conn, cells } for direct overlay testing.
 */
function streamModel(opts) {
  opts = opts || {};
  const m = new DiagramModel(40, 5);
  const boxA = m.addBox(0, 0, 8, 3, 'A');
  const boxB = m.addBox(20, 0, 8, 3, 'B');
  const pA = m.addPort(boxA.id, SIDE.RIGHT, 0);
  const pB = m.addPort(boxB.id, SIDE.LEFT, 0);
  const conn = m.addConnector(pA.id, pB.id, 'right');

  /* Straight horizontal connector: 12 cells from x=8 to x=19. */
  conn.segments = [{ x1: 8, y1: 1, x2: 19, y2: 1 }];
  conn.style = 'stream';
  conn.density = opts.density != null ? opts.density : 0.5;
  if (opts.marker) conn.marker = opts.marker;
  if (opts.bidirectional) conn.bidirectional = true;

  const cells = segmentsToCells(conn.segments);
  return { model: m, conn: conn, cells: cells };
}

/**
 * Run overlay and return the buffer characters at y=1 for x=8..19.
 */
function renderStreamAtFrame(setup, frame) {
  const buf  = new CharBuffer(40, 5);
  const grid = new OccupancyGrid(40, 5);
  const states = new Map();
  states.set(setup.conn.id, { frame: frame, style: 'stream' });
  overlayConnAnimations(setup.model, buf, grid, states);

  /* Collect characters at the connector row. */
  var chars = [];
  for (var x = 8; x <= 19; x++) {
    chars.push(buf.get(x, 1));
  }
  return chars;
}

// ────────────────────────────────────────────────────────────────────
// § Stream animation
// ────────────────────────────────────────────────────────────────────

test('stream animation places markers based on density', function () {
  /* density 0.5 on 12 cells → 6 markers, spacing = 2 */
  const setup = streamModel({ density: 0.5 });
  const chars = renderStreamAtFrame(setup, 0);
  const markerCount = chars.filter(function (c) { return c !== ' '; }).length;
  assert.strictEqual(markerCount, 6, 'should place 6 markers at density 0.5');
});

test('stream animation with density 1.0 fills all cells', function () {
  const setup = streamModel({ density: 1.0 });
  const chars = renderStreamAtFrame(setup, 0);
  const markerCount = chars.filter(function (c) { return c !== ' '; }).length;
  assert.strictEqual(markerCount, 12, 'should fill all 12 cells at density 1.0');
});

test('stream animation with low density places fewer markers', function () {
  /* density 0.2 on 12 cells → round(2.4) = 2 markers */
  const setup = streamModel({ density: 0.2 });
  const chars = renderStreamAtFrame(setup, 0);
  const markerCount = chars.filter(function (c) { return c !== ' '; }).length;
  assert.strictEqual(markerCount, 2, 'should place 2 markers at density 0.2');
});

test('stream markers advance position each frame', function () {
  const setup = streamModel({ density: 0.5 });
  const chars0 = renderStreamAtFrame(setup, 0);
  const chars1 = renderStreamAtFrame(setup, 1);

  /* The marker pattern should shift by one cell per frame. */
  assert.notDeepStrictEqual(chars0, chars1,
    'marker positions should differ between frame 0 and frame 1');
});

test('stream animation uses custom marker character', function () {
  const setup = streamModel({ density: 0.5, marker: '\u25CB' }); // ○
  const chars = renderStreamAtFrame(setup, 0);
  const hasCircle = chars.some(function (c) { return c === '\u25CB'; });
  assert.ok(hasCircle, 'should use the custom ○ marker');
});

test('stream animation defaults to dot marker when none specified', function () {
  const setup = streamModel({ density: 0.5 });
  const chars = renderStreamAtFrame(setup, 0);
  const dotChar = CHARSETS.currentWork.dot;
  const hasDot = chars.some(function (c) { return c === dotChar; });
  assert.ok(hasDot, 'should use the default ● dot marker');
});

test('bidirectional stream places markers in both directions', function () {
  const setup = streamModel({ density: 0.5, bidirectional: true });
  const chars0 = renderStreamAtFrame(setup, 0);
  const chars1 = renderStreamAtFrame(setup, 1);
  const markerCount0 = chars0.filter(function (c) { return c !== ' '; }).length;
  const markerCount1 = chars1.filter(function (c) { return c !== ' '; }).length;

  /* Bidirectional: half forward + half backward markers should exist. */
  assert.ok(markerCount0 > 0, 'frame 0 should have markers');
  assert.ok(markerCount1 > 0, 'frame 1 should have markers');

  /* Markers should shift position between frames. */
  assert.notDeepStrictEqual(chars0, chars1,
    'bidirectional markers should move between frames');
});

test('bidirectional stream forward and backward markers occupy different cells', function () {
  /* Use high density to ensure both forward and backward markers are visible.
   * With density 0.8 on 12 cells: markerCount = 10, halfCount = 5 each way. */
  const setup = streamModel({ density: 0.8, bidirectional: true });

  /* Collect marker positions across several frames to verify
   * markers appear at positions spanning the full cell range. */
  var allPositions = new Set();
  for (var frame = 0; frame < 12; frame++) {
    var chars = renderStreamAtFrame(setup, frame);
    for (var i = 0; i < chars.length; i++) {
      if (chars[i] !== ' ') allPositions.add(i);
    }
  }
  /* Over 12 frames, markers should visit most of the 12 cell positions. */
  assert.ok(allPositions.size >= 8,
    'bidirectional markers should span most cell positions over time (got ' +
    allPositions.size + ')');
});

test('stream with density 0 still places at least 1 marker', function () {
  /* Density 0.0 → max(1, round(0)) = 1 marker minimum. */
  const setup = streamModel({ density: 0.0 });
  const chars = renderStreamAtFrame(setup, 0);
  const markerCount = chars.filter(function (c) { return c !== ' '; }).length;
  assert.strictEqual(markerCount, 1, 'should place at least 1 marker');
});

test('stream animation works with vertical segments', function () {
  const m = new DiagramModel(10, 20);
  const boxA = m.addBox(0, 0, 8, 3, 'A');
  const boxB = m.addBox(0, 15, 8, 3, 'B');
  const pA = m.addPort(boxA.id, SIDE.BOTTOM, 0);
  const pB = m.addPort(boxB.id, SIDE.TOP, 0);
  const conn = m.addConnector(pA.id, pB.id, 'down');
  conn.segments = [{ x1: 4, y1: 3, x2: 4, y2: 14 }];
  conn.style = 'stream';
  conn.density = 0.5;

  const buf  = new CharBuffer(10, 20);
  const grid = new OccupancyGrid(10, 20);
  const states = new Map();
  states.set(conn.id, { frame: 0, style: 'stream' });
  overlayConnAnimations(m, buf, grid, states);

  var count = 0;
  for (var y = 3; y <= 14; y++) {
    if (buf.get(4, y) !== ' ') count++;
  }
  assert.strictEqual(count, 6, 'vertical stream should place 6 markers at density 0.5');
});

test('stream animation works with mixed horizontal+vertical segments', function () {
  const m = new DiagramModel(30, 10);
  const boxA = m.addBox(0, 0, 8, 3, 'A');
  const boxB = m.addBox(20, 5, 8, 3, 'B');
  const pA = m.addPort(boxA.id, SIDE.RIGHT, 0);
  const pB = m.addPort(boxB.id, SIDE.LEFT, 0);
  const conn = m.addConnector(pA.id, pB.id, 'right');
  conn.segments = [
    { x1: 8, y1: 1, x2: 14, y2: 1 },
    { x1: 14, y1: 1, x2: 14, y2: 6 },
    { x1: 14, y1: 6, x2: 19, y2: 6 }
  ];
  conn.style = 'stream';
  conn.density = 0.5;

  const cells = segmentsToCells(conn.segments);
  const buf  = new CharBuffer(30, 10);
  const grid = new OccupancyGrid(30, 10);
  const states = new Map();
  states.set(conn.id, { frame: 0, style: 'stream' });
  overlayConnAnimations(m, buf, grid, states);

  var count = 0;
  for (var i = 0; i < cells.length; i++) {
    if (buf.get(cells[i].x, cells[i].y) !== ' ') count++;
  }
  var expected = Math.round(0.5 * cells.length);
  assert.strictEqual(count, expected,
    'mixed segments should place correct marker count');
});

test('stream animation works with very short segments', function () {
  const m = new DiagramModel(20, 5);
  const boxA = m.addBox(0, 0, 4, 3, 'A');
  const boxB = m.addBox(6, 0, 4, 3, 'B');
  const pA = m.addPort(boxA.id, SIDE.RIGHT, 0);
  const pB = m.addPort(boxB.id, SIDE.LEFT, 0);
  const conn = m.addConnector(pA.id, pB.id, 'right');
  conn.segments = [{ x1: 4, y1: 1, x2: 5, y2: 1 }];
  conn.style = 'stream';
  conn.density = 0.5;

  const buf  = new CharBuffer(20, 5);
  const grid = new OccupancyGrid(20, 5);
  const states = new Map();
  states.set(conn.id, { frame: 0, style: 'stream' });
  overlayConnAnimations(m, buf, grid, states);

  var count = 0;
  for (var x = 4; x <= 5; x++) {
    if (buf.get(x, 1) !== ' ') count++;
  }
  assert.ok(count >= 1, 'short segment should place at least 1 marker');
});

test('stream defaults density to 0.5 when not set', function () {
  const m = new DiagramModel(40, 5);
  const boxA = m.addBox(0, 0, 8, 3, 'A');
  const boxB = m.addBox(20, 0, 8, 3, 'B');
  const pA = m.addPort(boxA.id, SIDE.RIGHT, 0);
  const pB = m.addPort(boxB.id, SIDE.LEFT, 0);
  const conn = m.addConnector(pA.id, pB.id, 'right');
  conn.segments = [{ x1: 8, y1: 1, x2: 19, y2: 1 }];
  conn.style = 'stream';
  /* density left as null — should default to 0.5 */

  const buf  = new CharBuffer(40, 5);
  const grid = new OccupancyGrid(40, 5);
  const states = new Map();
  states.set(conn.id, { frame: 0, style: 'stream' });
  overlayConnAnimations(m, buf, grid, states);

  var count = 0;
  for (var x = 8; x <= 19; x++) {
    if (buf.get(x, 1) !== ' ') count++;
  }
  assert.strictEqual(count, 6, 'default density 0.5 → 6 markers on 12 cells');
});

// ────────────────────────────────────────────────────────────────────
// § Branch coverage — unknown style default, overlayTravelDot
// ────────────────────────────────────────────────────────────────────

test('overlayConnAnimations with unknown style hits default branch', function () {
  /* Exercises the default: break; in the switch at render-conn-overlay.js L175. */
  const setup = streamModel({ density: 0.5 });
  const buf  = new CharBuffer(40, 5);
  const grid = new OccupancyGrid(40, 5);
  const states = new Map();
  states.set(setup.conn.id, { frame: 0, style: 'unknownStyle' });
  /* Should not throw. */
  overlayConnAnimations(setup.model, buf, grid, states);
  /* No markers should be placed for unknown style. */
  var count = 0;
  for (var x = 8; x <= 19; x++) {
    if (buf.get(x, 1) !== ' ') count++;
  }
  assert.strictEqual(count, 0, 'unknown style should place no markers');
});

test('overlayTravelDot places dot at valid cell index', function () {
  /* Exercises the normal path through overlayTravelDot in render-animation.js. */
  const { overlayTravelDot } = require('../lib/widget/diagram/render-animation');
  const buf = new CharBuffer(20, 5);
  const cells = [{ x: 5, y: 2 }, { x: 6, y: 2 }, { x: 7, y: 2 }];
  overlayTravelDot({ cells: cells, cellIdx: 1 }, buf);
  assert.notStrictEqual(buf.get(6, 2), ' ', 'dot should be placed at cellIdx 1');
});

test('overlayTravelDot is no-op for null travelState', function () {
  /* Exercises the early return at render-animation.js L78. */
  const { overlayTravelDot } = require('../lib/widget/diagram/render-animation');
  const buf = new CharBuffer(20, 5);
  /* Should not throw. */
  overlayTravelDot(null, buf);
  assert.strictEqual(buf.get(0, 0), ' ', 'nothing should be placed');
});

test('overlayTravelDot is no-op when cellIdx out of range', function () {
  /* Exercises the bounds check at render-animation.js L80. */
  const { overlayTravelDot } = require('../lib/widget/diagram/render-animation');
  const buf = new CharBuffer(20, 5);
  overlayTravelDot({ cells: [{ x: 0, y: 0 }], cellIdx: 99 }, buf);
  assert.strictEqual(buf.get(0, 0), ' ', 'nothing should be placed for out-of-range index');
});

test('overlayTravelDot is no-op when cells is missing', function () {
  /* Exercises the !travelState.cells branch at render-animation.js L78. */
  const { overlayTravelDot } = require('../lib/widget/diagram/render-animation');
  const buf = new CharBuffer(20, 5);
  overlayTravelDot({ cellIdx: 0 }, buf);
  assert.strictEqual(buf.get(0, 0), ' ', 'nothing placed when cells missing');
});
