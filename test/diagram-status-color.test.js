'use strict';

/**
 * test/diagram-status-color.test.js
 *
 * Integration tests for status-colored borders.
 * Verifies the applyStatusStyle function and STATUS_FG mapping
 * through the public render-box exports.
 */

const test   = require('node:test');
const assert = require('node:assert');

const { applyStatusStyle, STATUS_FG }
  = require('../lib/widget/diagram/render-box');
const { DiagramModel }
  = require('../lib/widget/diagram/diagram-model');

// ────────────────────────────────────────────────────────────────────
// § STATUS_FG mapping
// ────────────────────────────────────────────────────────────────────

test('STATUS_FG maps status names to colour codes', function () {
  assert.strictEqual(STATUS_FG.success, 2, 'success → green');
  assert.strictEqual(STATUS_FG.error, 1, 'error → red');
  assert.strictEqual(STATUS_FG.pending, 3, 'pending → yellow');
});

/**
 * Extract the foreground colour code from a blessed attribute word.
 *
 * Blessed encodes cell attributes as a 32-bit integer. Bits 9-17
 * contain the foreground colour index (0-511). This helper isolates
 * those bits for assertion.
 *
 * @param {number} attr - Blessed cell attribute word.
 * @returns {number} Foreground colour code (0-511).
 */
function extractFg(attr) {
  return (attr >> 9) & 0x1ff;
}

// ────────────────────────────────────────────────────────────────────
// § applyStatusStyle
// ────────────────────────────────────────────────────────────────────

/**
 * Create a mock screen.lines array for testing.
 * Each cell is [attr, char] where attr starts at 0.
 */
function mockScreenLines(rows, cols) {
  const lines = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push([0, ' ']);
    }
    row.dirty = false;
    lines.push(row);
  }
  return lines;
}

test('applyStatusStyle sets fg colour on border cells for success', function () {
  const m = new DiagramModel(20, 5);
  const box = m.addBox(0, 0, 6, 3, 'OK', { status: 'success' });

  const lines = mockScreenLines(5, 20);
  applyStatusStyle(box, lines, 0, 0, 0, 0);

  /* Check top-left corner cell has green fg (2). */
  const attr = lines[0][0][0];
  const fg = extractFg(attr);
  assert.strictEqual(fg, 2, 'top-left should have green fg');

  /* Check dirty flag. */
  assert.strictEqual(lines[0].dirty, true, 'row should be marked dirty');
});

test('applyStatusStyle sets fg colour for error status', function () {
  const m = new DiagramModel(20, 5);
  const box = m.addBox(0, 0, 6, 3, 'ERR', { status: 'error' });

  const lines = mockScreenLines(5, 20);
  applyStatusStyle(box, lines, 0, 0, 0, 0);

  const attr = lines[0][0][0];
  const fg = extractFg(attr);
  assert.strictEqual(fg, 1, 'should have red fg');
});

test('applyStatusStyle sets fg colour for pending status', function () {
  const m = new DiagramModel(20, 5);
  const box = m.addBox(0, 0, 6, 3, 'PEND', { status: 'pending' });

  const lines = mockScreenLines(5, 20);
  applyStatusStyle(box, lines, 0, 0, 0, 0);

  const attr = lines[0][0][0];
  const fg = extractFg(attr);
  assert.strictEqual(fg, 3, 'should have yellow fg');
});

test('applyStatusStyle applies to all border cells', function () {
  const m = new DiagramModel(20, 5);
  const box = m.addBox(0, 0, 6, 3, 'OK', { status: 'success' });

  const lines = mockScreenLines(5, 20);
  applyStatusStyle(box, lines, 0, 0, 0, 0);

  /* Check bottom-right corner. */
  const attr = lines[2][5][0];
  const fg = extractFg(attr);
  assert.strictEqual(fg, 2, 'bottom-right should have green fg');

  /* Check left vertical border. */
  const leftAttr = lines[1][0][0];
  const leftFg = extractFg(leftAttr);
  assert.strictEqual(leftFg, 2, 'left border should have green fg');
});

test('applyStatusStyle handles pan offset', function () {
  const m = new DiagramModel(30, 10);
  const box = m.addBox(5, 2, 6, 3, 'OK', { status: 'error' });

  const lines = mockScreenLines(10, 30);
  /* panX=3, panY=1 → box appears at screen (5-3, 2-1) = (2, 1) */
  applyStatusStyle(box, lines, 0, 0, 3, 1);

  const attr = lines[1][2][0];
  const fg = extractFg(attr);
  assert.strictEqual(fg, 1, 'should have red fg at panned position');
});

test('applyStatusStyle is no-op for null status', function () {
  const m = new DiagramModel(20, 5);
  const box = m.addBox(0, 0, 6, 3, 'OK');

  const lines = mockScreenLines(5, 20);
  applyStatusStyle(box, lines, 0, 0, 0, 0);

  const attr = lines[0][0][0];
  assert.strictEqual(attr, 0, 'attr should be unchanged');
});

test('applyStatusStyle handles out-of-bounds gracefully', function () {
  const m = new DiagramModel(20, 5);
  const box = m.addBox(0, 0, 6, 3, 'OK', { status: 'success' });

  /* Screen smaller than the box position. */
  const lines = mockScreenLines(1, 2);
  /* Should not throw. */
  applyStatusStyle(box, lines, 0, 0, 0, 0);
});

// ────────────────────────────────────────────────────────────────────
// § Entity properties
// ────────────────────────────────────────────────────────────────────

test('createBox includes borderStyle and status in entity', function () {
  const m = new DiagramModel(20, 5);
  const box = m.addBox(0, 0, 10, 3, 'X', {
    borderStyle: 'heavy',
    status: 'error'
  });

  assert.strictEqual(box.borderStyle, 'heavy');
  assert.strictEqual(box.status, 'error');
});

test('createConnector includes animation properties', function () {
  const m = new DiagramModel(30, 5);
  const boxA = m.addBox(0, 0, 8, 3, 'A');
  const boxB = m.addBox(15, 0, 8, 3, 'B');
  const pA = m.addPort(boxA.id, 'right', 0);
  const pB = m.addPort(boxB.id, 'left', 0);
  const conn = m.addConnector(pA.id, pB.id, 'right');

  assert.strictEqual(conn.style, null);
  assert.strictEqual(conn.marker, null);
  assert.strictEqual(conn.head, null);
  assert.strictEqual(conn.speed, null);
  assert.strictEqual(conn.weight, null);
  assert.strictEqual(conn.bidirectional, false);
});
