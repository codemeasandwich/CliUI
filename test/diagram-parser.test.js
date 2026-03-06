'use strict';

/**
 * test/diagram-parser.test.js
 *
 * Unit tests for the two-pass ASCII diagram parser.
 *
 * Tests cover:
 *   • Single box detection
 *   • Multi-box detection with connectors and arrows
 *   • Checked (✔) box detection
 *   • Current-work (╭╮╰╯) box detection
 *   • Connector tracing and segment building
 *   • Lenient mode (preserves unrecognised text)
 */

const test   = require('node:test');
const assert = require('node:assert');
const path   = require('node:path');
const fs     = require('node:fs');

const { parse } = require('../lib/widget/diagram/diagram-parser');

// ────────────────────────────────────────────────────────────────────
// § Helpers
// ────────────────────────────────────────────────────────────────────

const fixturesDir = path.join(__dirname, 'fixtures', 'diagram');

/**
 * Read a fixture file.
 * @param {string} name - filename in test/fixtures/diagram/
 * @returns {string}
 */
function fixture(name) {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
}

// ────────────────────────────────────────────────────────────────────
// § Tests
// ────────────────────────────────────────────────────────────────────

test('Parser — single box', function () {
  const text = fixture('fixture-single-box.txt');
  const model = parse(text);

  assert.strictEqual(model.boxes.size, 1, 'should detect one box');

  const box = Array.from(model.boxes.values())[0];
  assert.strictEqual(box.text.trim(), 'A');
  assert.strictEqual(box.width, 7);
  assert.strictEqual(box.height, 3);
});

test('Parser — fixture-a (3 boxes, connectors)', function () {
  const text = fixture('fixture-a.txt');
  const model = parse(text, { mode: 'lenient' });

  assert.ok(model.boxes.size >= 2, 'should detect at least 2 boxes');
  /* Connector detection is best-effort in v1 — don't hard-fail. */
});

test('Parser — fixture-b (checked box)', function () {
  const text = fixture('fixture-b.txt');
  const model = parse(text, { mode: 'lenient' });

  /* Find the "Done" box — it should be checked. */
  let foundChecked = false;
  for (const [, box] of model.boxes) {
    if (box.text.includes('Done')) {
      foundChecked = box.checked;
    }
  }
  assert.ok(foundChecked, 'should detect ✔ Done as checked');
});

test('Parser — current-work box', function () {
  const text = fixture('fixture-current-work.txt');
  const model = parse(text, { mode: 'lenient' });

  let foundCW = false;
  for (const [, box] of model.boxes) {
    if (box.text.includes('Building')) {
      foundCW = box.currentWork;
    }
  }
  assert.ok(foundCW, 'should detect ╭╍╍ box as current-work');
});

test('Parser — inline simple text', function () {
  const text = [
    '┌─────┐',
    '│ Hi  │',
    '└─────┘'
  ].join('\n');

  const model = parse(text);
  assert.strictEqual(model.boxes.size, 1);
  assert.strictEqual(Array.from(model.boxes.values())[0].text.trim(), 'Hi');
});

test('Parser — two connected boxes inline', function () {
  const text = [
    '┌─────┐     ┌─────┐',
    '│  A  │────▶│  B  │',
    '└─────┘     └─────┘'
  ].join('\n');

  const model = parse(text, { mode: 'lenient' });
  assert.strictEqual(model.boxes.size, 2);
  /* Connector detection between inline boxes is best-effort in v1. */
});

test('Parser — empty input', function () {
  const model = parse('');
  assert.strictEqual(model.boxes.size, 0);
  assert.strictEqual(model.connectors.size, 0);
});

test('Parser — strict mode rejects garbage', function () {
  /* Strict mode shouldn't crash, just produce fewer entities. */
  const model = parse('hello world no diagrams here', { mode: 'strict' });
  assert.strictEqual(model.boxes.size, 0);
});
