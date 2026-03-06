'use strict';

/**
 * test/diagram-renderer.test.js
 *
 * Unit tests for the canonical ASCII renderer.
 *
 * Tests cover:
 *   • Single box rendering
 *   • Box with checked mark
 *   • Current-work box (dashed border)
 *   • Render output dimensions
 */

const test   = require('node:test');
const assert = require('node:assert');

const {
  DiagramModel,
  SIDE
} = require('../lib/widget/diagram/diagram-model');
const { render } = require('../lib/widget/diagram/diagram-renderer');

// ────────────────────────────────────────────────────────────────────
// § Tests
// ────────────────────────────────────────────────────────────────────

test('Renderer — single box', function () {
  const m = new DiagramModel(20, 5);
  m.addBox(0, 0, 7, 3, ' A ');

  const out = render(m);
  assert.ok(out.includes('┌'), 'should contain top-left corner');
  assert.ok(out.includes('┘'), 'should contain bottom-right corner');
  assert.ok(out.includes('A'), 'should contain box text');
});

test('Renderer — checked box shows ✔', function () {
  const m = new DiagramModel(20, 5);
  const box = m.addBox(0, 0, 10, 3, 'Done');
  m.toggleChecked(box.id);

  const out = render(m);
  assert.ok(out.includes('✔'), 'should show ✔ in checked box');
});

test('Renderer — current-work box uses dashed border', function () {
  const m = new DiagramModel(20, 5);
  const box = m.addBox(0, 0, 12, 3, 'Building');
  m.setCurrentWork(box.id, true);

  const out = render(m);
  assert.ok(out.includes('╭'), 'should use ╭ for current-work top-left');
  assert.ok(out.includes('╍'), 'should use ╍ for current-work horizontal');
});

test('Renderer — output has expected height', function () {
  const m = new DiagramModel(30, 8);
  m.addBox(0, 0, 7, 3, 'X');

  const out = render(m, { height: 8 });
  const lines = out.split('\n');
  assert.strictEqual(lines.length, 8, 'output should have height lines');
});

test('Renderer — two boxes with connector', function () {
  const m = new DiagramModel(40, 5);
  const a = m.addBox(0, 0, 7, 3, 'A');
  const b = m.addBox(15, 0, 7, 3, 'B');

  const pA = m.addPort(a.id, SIDE.RIGHT, 1);
  const pB = m.addPort(b.id, SIDE.LEFT, 1);
  const conn = m.addConnector(pA.id, pB.id, 'right');
  m.setConnectorSegments(conn.id, [
    { x1: 6, y1: 1, x2: 15, y2: 1 }
  ]);

  const out = render(m);

  /* The connector line should contain ─ or ── characters. */
  assert.ok(out.includes('─'), 'should contain horizontal connector');
  assert.ok(out.includes('A'), 'should contain box A text');
  assert.ok(out.includes('B'), 'should contain box B text');
});
