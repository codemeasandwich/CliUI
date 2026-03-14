'use strict';

/**
 * test/border-intersection.test.js
 *
 * Tests for the canonical mixed-stroke intersection resolver.
 * Verifies that all important Unicode box-drawing glyph mappings are correct
 * for light, heavy, mixed-weight corners, tees, crosses, and stubs.
 */

var test   = require('node:test');
var assert = require('node:assert');

var ix = require('../lib/border/intersection');
var NONE  = ix.NONE;
var LIGHT = ix.LIGHT;
var HEAVY = ix.HEAVY;

test('lib/border/intersection.js — mixed-stroke resolver', async function (t) {

  // ── Straight lines ─────────────────────────────────────────────────────

  await t.test('light horizontal: ─', function () {
    assert.strictEqual(ix.resolve(NONE, NONE, LIGHT, LIGHT), '\u2500');
  });

  await t.test('heavy horizontal: ━', function () {
    assert.strictEqual(ix.resolve(NONE, NONE, HEAVY, HEAVY), '\u2501');
  });

  await t.test('light vertical: │', function () {
    assert.strictEqual(ix.resolve(LIGHT, LIGHT, NONE, NONE), '\u2502');
  });

  await t.test('heavy vertical: ┃', function () {
    assert.strictEqual(ix.resolve(HEAVY, HEAVY, NONE, NONE), '\u2503');
  });

  await t.test('mixed vertical ╽: light up, heavy down', function () {
    assert.strictEqual(ix.resolve(LIGHT, HEAVY, NONE, NONE), '\u257D');
  });

  await t.test('mixed vertical ╿: heavy up, light down', function () {
    assert.strictEqual(ix.resolve(HEAVY, LIGHT, NONE, NONE), '\u257F');
  });

  // ── All-light corners ──────────────────────────────────────────────────

  await t.test('light corner ┌: down+right', function () {
    assert.strictEqual(ix.resolve(NONE, LIGHT, NONE, LIGHT), '\u250C');
  });

  await t.test('light corner ┐: down+left', function () {
    assert.strictEqual(ix.resolve(NONE, LIGHT, LIGHT, NONE), '\u2510');
  });

  await t.test('light corner └: up+right', function () {
    assert.strictEqual(ix.resolve(LIGHT, NONE, NONE, LIGHT), '\u2514');
  });

  await t.test('light corner ┘: up+left', function () {
    assert.strictEqual(ix.resolve(LIGHT, NONE, LIGHT, NONE), '\u2518');
  });

  // ── All-heavy corners ──────────────────────────────────────────────────

  await t.test('heavy corner ┏: down+right heavy', function () {
    assert.strictEqual(ix.resolve(NONE, HEAVY, NONE, HEAVY), '\u250F');
  });

  await t.test('heavy corner ┓: down+left heavy', function () {
    assert.strictEqual(ix.resolve(NONE, HEAVY, HEAVY, NONE), '\u2513');
  });

  await t.test('heavy corner ┗: up+right heavy', function () {
    assert.strictEqual(ix.resolve(HEAVY, NONE, NONE, HEAVY), '\u2517');
  });

  await t.test('heavy corner ┛: up+left heavy', function () {
    assert.strictEqual(ix.resolve(HEAVY, NONE, HEAVY, NONE), '\u251B');
  });

  // ── Mixed-weight corners ───────────────────────────────────────────────

  await t.test('mixed corner ┍: down-light, right-heavy', function () {
    assert.strictEqual(ix.resolve(NONE, LIGHT, NONE, HEAVY), '\u250D');
  });

  await t.test('mixed corner ┕: up-light, right-heavy', function () {
    assert.strictEqual(ix.resolve(LIGHT, NONE, NONE, HEAVY), '\u2515');
  });

  await t.test('mixed corner ┙: up-light, left-heavy', function () {
    assert.strictEqual(ix.resolve(LIGHT, NONE, HEAVY, NONE), '\u2519');
  });

  await t.test('mixed corner ┑: down-light, left-heavy', function () {
    assert.strictEqual(ix.resolve(NONE, LIGHT, HEAVY, NONE), '\u2511');
  });

  // ── All-light tees ─────────────────────────────────────────────────────

  await t.test('light tee ├: vert-light, right-light', function () {
    assert.strictEqual(ix.resolve(LIGHT, LIGHT, NONE, LIGHT), '\u251C');
  });

  await t.test('light tee ┤: vert-light, left-light', function () {
    assert.strictEqual(ix.resolve(LIGHT, LIGHT, LIGHT, NONE), '\u2524');
  });

  await t.test('light tee ┬: horiz-light, down-light', function () {
    assert.strictEqual(ix.resolve(NONE, LIGHT, LIGHT, LIGHT), '\u252C');
  });

  await t.test('light tee ┴: horiz-light, up-light', function () {
    assert.strictEqual(ix.resolve(LIGHT, NONE, LIGHT, LIGHT), '\u2534');
  });

  // ── All-heavy tees ─────────────────────────────────────────────────────

  await t.test('heavy tee ┣: vert-heavy, right-heavy', function () {
    assert.strictEqual(ix.resolve(HEAVY, HEAVY, NONE, HEAVY), '\u2523');
  });

  await t.test('heavy tee ┫: vert-heavy, left-heavy', function () {
    assert.strictEqual(ix.resolve(HEAVY, HEAVY, HEAVY, NONE), '\u252B');
  });

  await t.test('heavy tee ┳: horiz-heavy, down-heavy', function () {
    assert.strictEqual(ix.resolve(NONE, HEAVY, HEAVY, HEAVY), '\u2533');
  });

  await t.test('heavy tee ┻: horiz-heavy, up-heavy', function () {
    assert.strictEqual(ix.resolve(HEAVY, NONE, HEAVY, HEAVY), '\u253B');
  });

  // ── Mixed tees (critical for cutout body rendering) ────────────────────

  await t.test('mixed tee ┷: horiz-heavy, up-light (scrollbar junction)', function () {
    assert.strictEqual(ix.resolve(LIGHT, NONE, HEAVY, HEAVY), '\u2537');
  });

  await t.test('mixed tee ┯: horiz-heavy, down-light (top scrollbar junction)', function () {
    assert.strictEqual(ix.resolve(NONE, LIGHT, HEAVY, HEAVY), '\u252F');
  });

  await t.test('mixed tee ┹: left-light, right-heavy, up-heavy', function () {
    assert.strictEqual(ix.resolve(HEAVY, NONE, LIGHT, HEAVY), '\u2539');
  });

  await t.test('mixed tee ┺: left-heavy, right-light, up-heavy', function () {
    assert.strictEqual(ix.resolve(HEAVY, NONE, HEAVY, LIGHT), '\u253A');
  });

  await t.test('mixed tee ┪: up-light, down-heavy, left-heavy', function () {
    assert.strictEqual(ix.resolve(LIGHT, HEAVY, HEAVY, NONE), '\u252A');
  });

  await t.test('mixed tee ┩: up-heavy, down-light, left-heavy', function () {
    assert.strictEqual(ix.resolve(HEAVY, LIGHT, HEAVY, NONE), '\u2529');
  });

  await t.test('mixed tee ┡: up-heavy, down-light, right-heavy', function () {
    assert.strictEqual(ix.resolve(HEAVY, LIGHT, NONE, HEAVY), '\u2521');
  });

  await t.test('mixed tee ┢: up-light, down-heavy, right-heavy', function () {
    assert.strictEqual(ix.resolve(LIGHT, HEAVY, NONE, HEAVY), '\u2522');
  });

  await t.test('mixed tee ┠: vert-heavy, right-light', function () {
    assert.strictEqual(ix.resolve(HEAVY, HEAVY, NONE, LIGHT), '\u2520');
  });

  await t.test('mixed tee ┨: vert-heavy, left-light', function () {
    assert.strictEqual(ix.resolve(HEAVY, HEAVY, LIGHT, NONE), '\u2528');
  });

  await t.test('mixed tee ┱: left-light, right-heavy, down-heavy', function () {
    assert.strictEqual(ix.resolve(NONE, HEAVY, LIGHT, HEAVY), '\u2531');
  });

  await t.test('mixed tee ┲: left-heavy, right-light, down-heavy', function () {
    assert.strictEqual(ix.resolve(NONE, HEAVY, HEAVY, LIGHT), '\u2532');
  });

  // ── Crosses ────────────────────────────────────────────────────────────

  await t.test('light cross ┼', function () {
    assert.strictEqual(ix.resolve(LIGHT, LIGHT, LIGHT, LIGHT), '\u253C');
  });

  await t.test('heavy cross ╋', function () {
    assert.strictEqual(ix.resolve(HEAVY, HEAVY, HEAVY, HEAVY), '\u254B');
  });

  await t.test('mixed cross ╂: vert-heavy, horiz-light', function () {
    assert.strictEqual(ix.resolve(HEAVY, HEAVY, LIGHT, LIGHT), '\u2542');
  });

  await t.test('mixed cross ┿: vert-light, horiz-heavy', function () {
    assert.strictEqual(ix.resolve(LIGHT, LIGHT, HEAVY, HEAVY), '\u253F');
  });

  // ── Single-direction stubs ──────────────────────────────────────────────

  await t.test('stub ╵: light up only', function () {
    assert.strictEqual(ix.resolve(LIGHT, NONE, NONE, NONE), '\u2575');
  });

  await t.test('stub ╹: heavy up only', function () {
    assert.strictEqual(ix.resolve(HEAVY, NONE, NONE, NONE), '\u2579');
  });

  await t.test('stub ╻: heavy down only', function () {
    assert.strictEqual(ix.resolve(NONE, HEAVY, NONE, NONE), '\u257B');
  });

  // ── No connections returns null ────────────────────────────────────────

  await t.test('no connections returns null', function () {
    assert.strictEqual(ix.resolve(NONE, NONE, NONE, NONE), null);
  });

  // ── Rounded corners ────────────────────────────────────────────────────

  await t.test('resolveRounded ╭: down+right, rounded=true', function () {
    assert.strictEqual(ix.resolveRounded(NONE, LIGHT, NONE, LIGHT, true), '\u256D');
  });

  await t.test('resolveRounded ╮: down+left, rounded=true', function () {
    assert.strictEqual(ix.resolveRounded(NONE, LIGHT, LIGHT, NONE, true), '\u256E');
  });

  await t.test('resolveRounded ╰: up+right, rounded=true', function () {
    assert.strictEqual(ix.resolveRounded(LIGHT, NONE, NONE, LIGHT, true), '\u2570');
  });

  await t.test('resolveRounded ╯: up+left, rounded=true', function () {
    assert.strictEqual(ix.resolveRounded(LIGHT, NONE, LIGHT, NONE, true), '\u256F');
  });

  await t.test('resolveRounded falls back to square corner when rounded=false', function () {
    assert.strictEqual(ix.resolveRounded(NONE, LIGHT, NONE, LIGHT, false), '\u250C');
  });

  await t.test('resolveRounded ignores rounded for heavy corners', function () {
    // Heavy corners have no rounded variant — should return the heavy corner
    assert.strictEqual(ix.resolveRounded(NONE, HEAVY, NONE, HEAVY, true), '\u250F');
  });

  // ── Map completeness ──────────────────────────────────────────────────

  await t.test('glyph map has at least 70 entries', function () {
    var count = Object.keys(ix._GLYPH_MAP).length;
    assert.ok(count >= 70, 'should have >= 70 entries, got ' + count);
  });

  await t.test('rounded map has exactly 4 entries', function () {
    assert.strictEqual(Object.keys(ix._ROUNDED_MAP).length, 4);
  });
});
