'use strict';

/**
 * test/diagram-charsets.test.js
 *
 * Integration tests for the extended border charsets.
 * Verifies all 7 border styles have the required properties,
 * short-name aliases, cross/tee characters, and resolveCharset lookup.
 */

const test   = require('node:test');
const assert = require('node:assert');

const { CHARSETS, BORDER_STYLES, resolveCharset }
  = require('../lib/border/charsets');

// ────────────────────────────────────────────────────────────────────
// § BORDER_STYLES enumeration
// ────────────────────────────────────────────────────────────────────

test('BORDER_STYLES contains all 7 style names', function () {
  const expected = ['light', 'heavy', 'double', 'rounded', 'dashed', 'dashedHeavy', 'ascii'];
  assert.deepStrictEqual(BORDER_STYLES, expected);
});

// ────────────────────────────────────────────────────────────────────
// § Core properties on every border charset
// ────────────────────────────────────────────────────────────────────

test('every border charset has 11 required properties', function () {
  const required = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight',
                    'horizontal', 'vertical', 'cross', 'tee',
                    'tl', 'tr', 'bl'];

  for (const name of BORDER_STYLES) {
    const cs = CHARSETS[name];
    assert.ok(cs, 'charset ' + name + ' should exist');
    for (const prop of required) {
      assert.ok(cs[prop] != null, name + ' should have ' + prop);
    }
    /* tee should be an object with l, r, t, b. */
    assert.strictEqual(typeof cs.tee.l, 'string', name + '.tee.l');
    assert.strictEqual(typeof cs.tee.r, 'string', name + '.tee.r');
    assert.strictEqual(typeof cs.tee.t, 'string', name + '.tee.t');
    assert.strictEqual(typeof cs.tee.b, 'string', name + '.tee.b');
  }
});

// ────────────────────────────────────────────────────────────────────
// § Short-name aliases
// ────────────────────────────────────────────────────────────────────

test('short-name aliases match long names', function () {
  for (const name of BORDER_STYLES) {
    const cs = CHARSETS[name];
    assert.strictEqual(cs.tl, cs.topLeft, name + ': tl === topLeft');
    assert.strictEqual(cs.tr, cs.topRight, name + ': tr === topRight');
    assert.strictEqual(cs.bl, cs.bottomLeft, name + ': bl === bottomLeft');
    assert.strictEqual(cs.br, cs.bottomRight, name + ': br === bottomRight');
    assert.strictEqual(cs.h, cs.horizontal, name + ': h === horizontal');
    assert.strictEqual(cs.v, cs.vertical, name + ': v === vertical');
  }
});

// ────────────────────────────────────────────────────────────────────
// § Specific charset characters
// ────────────────────────────────────────────────────────────────────

test('light charset uses ┌┐└┘─│', function () {
  const cs = CHARSETS.light;
  assert.strictEqual(cs.topLeft, '┌');
  assert.strictEqual(cs.topRight, '┐');
  assert.strictEqual(cs.bottomLeft, '└');
  assert.strictEqual(cs.bottomRight, '┘');
  assert.strictEqual(cs.horizontal, '─');
  assert.strictEqual(cs.vertical, '│');
  assert.strictEqual(cs.cross, '┼');
});

test('heavy charset uses ┏┓┗┛━┃', function () {
  const cs = CHARSETS.heavy;
  assert.strictEqual(cs.topLeft, '┏');
  assert.strictEqual(cs.horizontal, '━');
});

test('double charset uses ╔╗╚╝═║', function () {
  const cs = CHARSETS.double;
  assert.strictEqual(cs.topLeft, '╔');
  assert.strictEqual(cs.horizontal, '═');
});

test('rounded charset uses ╭╮╰╯─│', function () {
  const cs = CHARSETS.rounded;
  assert.strictEqual(cs.topLeft, '╭');
  assert.strictEqual(cs.horizontal, '─');
});

test('dashed charset uses ┌┐└┘╌╎', function () {
  const cs = CHARSETS.dashed;
  assert.strictEqual(cs.topLeft, '┌');
  assert.strictEqual(cs.horizontal, '╌');
});

test('dashedHeavy charset uses ┏┓┗┛╍╏', function () {
  const cs = CHARSETS.dashedHeavy;
  assert.strictEqual(cs.topLeft, '┏');
  assert.strictEqual(cs.horizontal, '╍');
});

test('ascii charset uses +|-', function () {
  const cs = CHARSETS.ascii;
  assert.strictEqual(cs.topLeft, '+');
  assert.strictEqual(cs.horizontal, '-');
  assert.strictEqual(cs.vertical, '|');
});

// ────────────────────────────────────────────────────────────────────
// § resolveCharset
// ────────────────────────────────────────────────────────────────────

test('resolveCharset defaults to light', function () {
  assert.strictEqual(resolveCharset(null), CHARSETS.light);
  assert.strictEqual(resolveCharset(undefined), CHARSETS.light);
  assert.strictEqual(resolveCharset({}), CHARSETS.light);
});

test('resolveCharset resolves named styles', function () {
  assert.strictEqual(resolveCharset({ charset: 'heavy' }), CHARSETS.heavy);
  assert.strictEqual(resolveCharset({ charset: 'double' }), CHARSETS.double);
  assert.strictEqual(resolveCharset({ charset: 'currentWork' }), CHARSETS.currentWork);
  assert.strictEqual(resolveCharset({ charset: 'connector' }), CHARSETS.connector);
});

test('resolveCharset passes through custom object', function () {
  const custom = { topLeft: 'X', horizontal: '-' };
  assert.strictEqual(resolveCharset({ charset: custom }), custom);
});

test('resolveCharset falls back to light for unknown string', function () {
  assert.strictEqual(resolveCharset({ charset: 'nonexistent' }), CHARSETS.light);
});

// ────────────────────────────────────────────────────────────────────
// § Diagram-specific charsets
// ────────────────────────────────────────────────────────────────────

test('currentWork charset has gate and dot properties', function () {
  const cs = CHARSETS.currentWork;
  assert.ok(cs.gate, 'should have gate');
  assert.ok(cs.gateH, 'should have gateH');
  assert.ok(cs.dot, 'should have dot');
  assert.strictEqual(cs.dot, '●');
});

test('connector charset has arrowheads and junction chars', function () {
  const cs = CHARSETS.connector;
  assert.ok(cs.arrowRight, 'should have arrowRight');
  assert.ok(cs.arrowLeft, 'should have arrowLeft');
  assert.ok(cs.arrowDown, 'should have arrowDown');
  assert.ok(cs.arrowUp, 'should have arrowUp');
  assert.ok(cs.cross, 'should have cross');
  assert.ok(cs.teeRight, 'should have teeRight');
});
