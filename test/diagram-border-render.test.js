'use strict';

/**
 * test/diagram-border-render.test.js
 *
 * Integration tests for per-box border style rendering.
 * Verifies each border style renders the correct characters in output.
 */

const test   = require('node:test');
const assert = require('node:assert');

const { DiagramModel } = require('../lib/widget/diagram/diagram-model');
const { render } = require('../lib/widget/diagram/diagram-renderer');
const { CHARSETS } = require('../lib/border/charsets');

// ────────────────────────────────────────────────────────────────────
// § Helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Create a model with a single box using the specified border style.
 */
function singleBoxModel(borderStyle) {
  const m = new DiagramModel(20, 5);
  m.addBox(0, 0, 10, 3, 'test', { borderStyle: borderStyle });
  return m;
}

// ────────────────────────────────────────────────────────────────────
// § Per-style rendering
// ────────────────────────────────────────────────────────────────────

test('light border renders ┌┐└┘─│', function () {
  const out = render(singleBoxModel(null));
  assert.ok(out.includes('┌'), 'should include ┌');
  assert.ok(out.includes('┘'), 'should include ┘');
  assert.ok(out.includes('─'), 'should include ─');
  assert.ok(out.includes('│'), 'should include │');
});

test('heavy border renders ┏┓┗┛━┃', function () {
  const out = render(singleBoxModel('heavy'));
  assert.ok(out.includes('┏'), 'should include ┏');
  assert.ok(out.includes('┛'), 'should include ┛');
  assert.ok(out.includes('━'), 'should include ━');
  assert.ok(out.includes('┃'), 'should include ┃');
});

test('double border renders ╔╗╚╝═║', function () {
  const out = render(singleBoxModel('double'));
  assert.ok(out.includes('╔'), 'should include ╔');
  assert.ok(out.includes('╝'), 'should include ╝');
  assert.ok(out.includes('═'), 'should include ═');
  assert.ok(out.includes('║'), 'should include ║');
});

test('rounded border renders ╭╮╰╯─│', function () {
  const out = render(singleBoxModel('rounded'));
  assert.ok(out.includes('╭'), 'should include ╭');
  assert.ok(out.includes('╯'), 'should include ╯');
});

test('dashed border renders ┌┐└┘╌╎', function () {
  const out = render(singleBoxModel('dashed'));
  assert.ok(out.includes('┌'), 'should include ┌');
  assert.ok(out.includes('╌'), 'should include ╌');
  assert.ok(out.includes('╎'), 'should include ╎');
});

test('dashedHeavy border renders ┏┓┗┛╍╏', function () {
  const out = render(singleBoxModel('dashedHeavy'));
  assert.ok(out.includes('┏'), 'should include ┏');
  assert.ok(out.includes('╍'), 'should include ╍');
  assert.ok(out.includes('╏'), 'should include ╏');
});

test('ascii border renders +-|', function () {
  const out = render(singleBoxModel('ascii'));
  assert.ok(out.includes('+'), 'should include +');
  assert.ok(out.includes('-'), 'should include -');
  assert.ok(out.includes('|'), 'should include |');
});

// ────────────────────────────────────────────────────────────────────
// § Mixed border styles in a single diagram
// ────────────────────────────────────────────────────────────────────

test('diagram with mixed border styles renders each correctly', function () {
  const m = new DiagramModel(60, 10);
  m.addBox(0, 0, 10, 3, 'heavy', { borderStyle: 'heavy' });
  m.addBox(15, 0, 10, 3, 'rounded', { borderStyle: 'rounded' });
  m.addBox(30, 0, 10, 3, 'double', { borderStyle: 'double' });

  const out = render(m);

  /* Each box should use its own charset. */
  assert.ok(out.includes('┏'), 'heavy topLeft ┏');
  assert.ok(out.includes('╭'), 'rounded topLeft ╭');
  assert.ok(out.includes('╔'), 'double topLeft ╔');
});

// ────────────────────────────────────────────────────────────────────
// § CurrentWork overrides borderStyle
// ────────────────────────────────────────────────────────────────────

test('currentWork box uses currentWork charset regardless of borderStyle', function () {
  const m = new DiagramModel(20, 5);
  m.addBox(0, 0, 10, 3, 'cw', { currentWork: true, borderStyle: 'heavy' });
  const out = render(m);

  /* Should use currentWork dashed chars, not heavy. */
  assert.ok(out.includes(CHARSETS.currentWork.topLeft), 'should use currentWork topLeft');
  assert.ok(out.includes(CHARSETS.currentWork.horizontal), 'should use currentWork horizontal');
});

// ────────────────────────────────────────────────────────────────────
// § Port tees match box border style
// ────────────────────────────────────────────────────────────────────

test('heavy box gets heavy tee characters at ports', function () {
  const m = new DiagramModel(40, 5);
  const boxA = m.addBox(0, 0, 10, 3, 'A', { borderStyle: 'heavy' });
  const boxB = m.addBox(15, 0, 10, 3, 'B');

  const pA = m.addPort(boxA.id, 'right', 0);
  const pB = m.addPort(boxB.id, 'left', 0);
  m.addConnector(pA.id, pB.id, 'right');

  const out = render(m);
  /* Heavy tee for right-side port: ┣ */
  assert.ok(out.includes('┣'), 'should include heavy tee ┣');
});
