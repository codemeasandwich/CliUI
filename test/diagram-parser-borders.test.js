'use strict';

/**
 * test/diagram-parser-borders.test.js
 *
 * Integration tests for parser border style detection.
 * Verifies the parser detects heavy, double, dashed, rounded, and
 * currentWork border styles from their corner and line characters.
 */

const test   = require('node:test');
const assert = require('node:assert');

const { parse }        = require('../lib/widget/diagram/diagram-parser');
const { CHARSETS }     = require('../lib/border/charsets');
const { CORNER_TO_STYLE } = require('../lib/widget/diagram/parser-chars');

// ────────────────────────────────────────────────────────────────────
// § CORNER_TO_STYLE map
// ────────────────────────────────────────────────────────────────────

test('CORNER_TO_STYLE maps all four corner families', function () {
  assert.strictEqual(CORNER_TO_STYLE.get('┌'), 'light');
  assert.strictEqual(CORNER_TO_STYLE.get('╭'), 'rounded');
  assert.strictEqual(CORNER_TO_STYLE.get('┏'), 'heavy');
  assert.strictEqual(CORNER_TO_STYLE.get('╔'), 'double');
});

// ────────────────────────────────────────────────────────────────────
// § Light box (default)
// ────────────────────────────────────────────────────────────────────

test('parser detects light box with no borderStyle', function () {
  const text = [
    '┌────────┐',
    '│ light  │',
    '└────────┘'
  ].join('\n');

  const model = parse(text, { mode: 'lenient' });
  const box = model.boxes.values().next().value;
  assert.strictEqual(box.borderStyle, null);
  assert.strictEqual(box.currentWork, false);
});

// ────────────────────────────────────────────────────────────────────
// § Heavy box
// ────────────────────────────────────────────────────────────────────

test('parser detects heavy border style', function () {
  const text = [
    '┏━━━━━━━━┓',
    '┃ heavy  ┃',
    '┗━━━━━━━━┛'
  ].join('\n');

  const model = parse(text, { mode: 'lenient' });
  const box = model.boxes.values().next().value;
  assert.strictEqual(box.borderStyle, 'heavy');
  assert.strictEqual(box.currentWork, false);
});

// ────────────────────────────────────────────────────────────────────
// § Double box
// ────────────────────────────────────────────────────────────────────

test('parser detects double border style', function () {
  const text = [
    '╔════════╗',
    '║ double ║',
    '╚════════╝'
  ].join('\n');

  const model = parse(text, { mode: 'lenient' });
  const box = model.boxes.values().next().value;
  assert.strictEqual(box.borderStyle, 'double');
  assert.strictEqual(box.currentWork, false);
});

// ────────────────────────────────────────────────────────────────────
// § Rounded box
// ────────────────────────────────────────────────────────────────────

test('parser detects rounded border style', function () {
  const text = [
    '╭────────╮',
    '│rounded │',
    '╰────────╯'
  ].join('\n');

  const model = parse(text, { mode: 'lenient' });
  const box = model.boxes.values().next().value;
  assert.strictEqual(box.borderStyle, 'rounded');
  assert.strictEqual(box.currentWork, false);
});

// ────────────────────────────────────────────────────────────────────
// § Dashed box (light corners + dashed horizontal)
// ────────────────────────────────────────────────────────────────────

test('parser detects dashed border style', function () {
  const text = [
    '┌╌╌╌╌╌╌╌╌┐',
    '│ dashed │',
    '└╌╌╌╌╌╌╌╌┘'
  ].join('\n');

  const model = parse(text, { mode: 'lenient' });
  const box = model.boxes.values().next().value;
  assert.strictEqual(box.borderStyle, 'dashed');
});

// ────────────────────────────────────────────────────────────────────
// § DashedHeavy box (heavy corners + heavy-dashed horizontal)
// ────────────────────────────────────────────────────────────────────

test('parser detects dashedHeavy border style', function () {
  const text = [
    '┏╍╍╍╍╍╍╍╍┓',
    '┃ dshHvy ┃',
    '┗╍╍╍╍╍╍╍╍┛'
  ].join('\n');

  const model = parse(text, { mode: 'lenient' });
  const box = model.boxes.values().next().value;
  assert.strictEqual(box.borderStyle, 'dashedHeavy');
});

// ────────────────────────────────────────────────────────────────────
// § CurrentWork box
// ────────────────────────────────────────────────────────────────────

test('parser detects currentWork from rounded corners + dashed horizontal', function () {
  const text = [
    '╭╍╍╍╍╍╍╍╍╮',
    '┇  work  ┇',
    '╰╍╍╍╍╍╍╍╍╯'
  ].join('\n');

  const model = parse(text, { mode: 'lenient' });
  const box = model.boxes.values().next().value;
  assert.strictEqual(box.currentWork, true);
  /* currentWork boxes don't set a borderStyle — they use the currentWork charset. */
  assert.strictEqual(box.borderStyle, null);
});
