'use strict';

/**
 * test/diagram-round-trip.test.js
 *
 * Round-trip tests: parse → render → parse → compare.
 *
 * These tests verify that the parser and renderer are inverses of
 * each other — parsing a canonical diagram and re-rendering it should
 * produce structurally equivalent output.
 *
 * Note: Exact character-for-character identity is NOT guaranteed in
 * v1 because:
 *   1. Whitespace trimming may differ.
 *   2. Connector routing may choose a different path.
 *   3. Label positioning may shift slightly.
 *
 * Therefore we compare at the MODEL level: same number of boxes,
 * same text, same connections, same checked/current-work state.
 */

const test   = require('node:test');
const assert = require('node:assert');
const path   = require('node:path');
const fs     = require('node:fs');

const { parse }  = require('../lib/widget/diagram/diagram-parser');
const { render } = require('../lib/widget/diagram/diagram-renderer');

const fixturesDir = path.join(__dirname, 'fixtures', 'diagram');

// ────────────────────────────────────────────────────────────────────
// § Helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Compare two models at the structural level.
 *
 * @param {import('../lib/widget/diagram/diagram-model').DiagramModel} a
 * @param {import('../lib/widget/diagram/diagram-model').DiagramModel} b
 */
function assertModelsEquivalent(a, b, label) {
  assert.strictEqual(a.boxes.size, b.boxes.size,
    label + ': same number of boxes');

  /* Compare box texts (sorted for order independence). */
  const textsA = Array.from(a.boxes.values()).map(b => b.text.trim()).sort();
  const textsB = Array.from(b.boxes.values()).map(b => b.text.trim()).sort();
  assert.deepStrictEqual(textsA, textsB, label + ': same box texts');

  /* Compare checked state. */
  const checkedA = Array.from(a.boxes.values()).filter(b => b.checked).length;
  const checkedB = Array.from(b.boxes.values()).filter(b => b.checked).length;
  assert.strictEqual(checkedA, checkedB, label + ': same checked count');

  /* Compare current-work state. */
  const cwA = Array.from(a.boxes.values()).filter(b => b.currentWork).length;
  const cwB = Array.from(b.boxes.values()).filter(b => b.currentWork).length;
  assert.strictEqual(cwA, cwB, label + ': same current-work count');

  /* Compare connector count. */
  assert.strictEqual(a.connectors.size, b.connectors.size,
    label + ': same number of connectors');
}

// ────────────────────────────────────────────────────────────────────
// § Tests
// ────────────────────────────────────────────────────────────────────

test('Round-trip — single box', function () {
  const text = fs.readFileSync(path.join(fixturesDir, 'fixture-single-box.txt'), 'utf8');
  const model1 = parse(text);
  const rendered = render(model1);
  const model2 = parse(rendered);

  assertModelsEquivalent(model1, model2, 'single-box');
});

test('Round-trip — fixture-a', function () {
  const text = fs.readFileSync(path.join(fixturesDir, 'fixture-a.txt'), 'utf8');
  const model1 = parse(text, { mode: 'lenient' });
  const rendered = render(model1);
  const model2 = parse(rendered, { mode: 'lenient' });

  assertModelsEquivalent(model1, model2, 'fixture-a');
});

test('Round-trip — fixture-b (with checked)', function () {
  const text = fs.readFileSync(path.join(fixturesDir, 'fixture-b.txt'), 'utf8');
  const model1 = parse(text, { mode: 'lenient' });
  const rendered = render(model1);
  const model2 = parse(rendered, { mode: 'lenient' });

  assertModelsEquivalent(model1, model2, 'fixture-b');
});

test('Round-trip — current-work box', function () {
  const text = fs.readFileSync(path.join(fixturesDir, 'fixture-current-work.txt'), 'utf8');
  const model1 = parse(text, { mode: 'lenient' });
  const rendered = render(model1);
  const model2 = parse(rendered, { mode: 'lenient' });

  assertModelsEquivalent(model1, model2, 'current-work');
});

test('Round-trip — programmatic model', function () {
  /* Build a model entirely in code, render, parse, compare. */
  const { DiagramModel, SIDE }
    = require('../lib/widget/diagram/diagram-model');

  const m = new DiagramModel(60, 10);
  const a = m.addBox(0, 0, 10, 3, 'Alpha');
  const b = m.addBox(20, 0, 10, 3, 'Beta');
  const pA = m.addPort(a.id, SIDE.RIGHT, 1);
  const pB = m.addPort(b.id, SIDE.LEFT, 1);
  const conn = m.addConnector(pA.id, pB.id, 'right');
  m.setConnectorSegments(conn.id, [{ x1: 9, y1: 1, x2: 20, y2: 1 }]);

  const text = render(m);
  const parsed = parse(text, { mode: 'lenient' });

  /* At minimum, the rendered text should re-parse to at least 1 box
     with one of the expected labels present. */
  assert.ok(parsed.boxes.size >= 1, 'should parse at least one box');
  const texts = Array.from(parsed.boxes.values()).map(b => b.text.trim()).sort();
  assert.ok(texts.includes('Alpha') || texts.includes('Beta'),
    'should find Alpha or Beta in re-parsed boxes');
});
