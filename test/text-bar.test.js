'use strict';

/**
 * test/text-bar.test.js
 *
 * Integration tests for the TextBar widget.
 * Exercises every code path through the public API: constructor (with and
 * without `new`), setData with various percent values, tag wrapping,
 * custom characters, fixed/auto label widths, narrow-width truncation,
 * spacing options, getOptionsPrototype, and attach-event data rendering.
 *
 * Uses a single mock screen (blessed screen is a singleton) and creates
 * multiple widget instances on it to cover all branches.
 */

var test = require('node:test');
var assert = require('node:assert');
var galacticaMock = require('./helpers/galactica-mock');
var galactica = require('../index');

test('TextBar widget — full coverage', function () {
  var screen = galacticaMock.install({ cols: 120, rows: 40 });

  // ── Normal render — label, bar, and value are present ──────────────
  var w1 = galactica.textBar({
    width: 40, height: 3,
    border: { type: 'line', fg: 'cyan' },
    tags: true,
    style: { bar: { fillFg: 'green', emptyFg: 'gray' } }
  });
  screen.append(w1);
  w1.setData({ label: 'CacheC', percent: 0.14, value: '1.4K' });

  var c1 = w1.getContent();
  assert.ok(c1.includes('CacheC'), 'normal: left label present');
  assert.ok(c1.includes('1.4K'), 'normal: right value present');
  assert.ok(c1.includes('\u2588'), 'normal: fill char present');
  assert.ok(c1.includes('\u2591'), 'normal: empty char present');

  // ── 0% bar — all empty, no fill ───────────────────────────────────
  var w2 = galactica.textBar({
    width: 30, height: 3,
    border: { type: 'line', fg: 'cyan' },
    tags: false
  });
  screen.append(w2);
  w2.setData({ label: 'Mem', percent: 0.0, value: '0B' });

  var c2 = w2.getContent();
  assert.ok(!c2.includes('\u2588'), '0%: no fill char');
  assert.ok(c2.includes('\u2591'), '0%: empty char present');

  // ── 100% bar — all fill, no empty ─────────────────────────────────
  var w3 = galactica.textBar({
    width: 30, height: 3,
    border: { type: 'line', fg: 'cyan' },
    tags: false
  });
  screen.append(w3);
  w3.setData({ label: 'CPU', percent: 1.0, value: '100%' });

  var c3 = w3.getContent();
  assert.ok(c3.includes('\u2588'), '100%: fill char present');
  assert.ok(!c3.includes('\u2591'), '100%: no empty char');

  // ── Percent > 1.0 clamped to 100% ─────────────────────────────────
  var w4 = galactica.textBar({
    width: 30, height: 3,
    border: { type: 'line', fg: 'cyan' },
    tags: false
  });
  screen.append(w4);
  w4.setData({ label: 'Over', percent: 1.5, value: 'MAX' });

  var c4 = w4.getContent();
  assert.ok(c4.includes('\u2588'), 'clamp high: fill present');
  assert.ok(!c4.includes('\u2591'), 'clamp high: no empty');

  // ── Percent < 0 clamped to 0% ─────────────────────────────────────
  var w5 = galactica.textBar({
    width: 30, height: 3,
    border: { type: 'line', fg: 'cyan' },
    tags: false
  });
  screen.append(w5);
  w5.setData({ label: 'Neg', percent: -0.5, value: '0' });

  var c5 = w5.getContent();
  assert.ok(!c5.includes('\u2588'), 'clamp low: no fill');
  assert.ok(c5.includes('\u2591'), 'clamp low: empty present');

  // ── Tags disabled — no blessed tags in output ──────────────────────
  var w6 = galactica.textBar({
    width: 40, height: 3,
    border: { type: 'line', fg: 'cyan' },
    tags: false,
    style: { bar: { fillFg: 'green', emptyFg: 'gray' } }
  });
  screen.append(w6);
  w6.setData({ label: 'NoTag', percent: 0.5, value: '50%' });

  var c6 = w6.getContent();
  assert.ok(!c6.includes('\x1b['), 'tags off: no ANSI escape codes');

  // ── Tags enabled — blessed converts {color-fg} to ANSI escapes ─────
  // When tags:true, blessed processes {green-fg} → \x1b[32m etc.
  var c1Tags = w1.getContent();
  assert.ok(c1Tags.includes('\x1b['), 'tags: ANSI escape codes present');

  // ── Custom barFillChar and barEmptyChar ─────────────────────────────
  var w7 = galactica.textBar({
    width: 30, height: 3,
    border: { type: 'line', fg: 'cyan' },
    tags: false,
    barFillChar: '#',
    barEmptyChar: '.'
  });
  screen.append(w7);
  w7.setData({ label: 'Cust', percent: 0.5, value: '50' });

  var c7 = w7.getContent();
  assert.ok(c7.includes('#'), 'custom: fill char # present');
  assert.ok(c7.includes('.'), 'custom: empty char . present');
  assert.ok(!c7.includes('\u2588'), 'custom: no default fill');
  assert.ok(!c7.includes('\u2591'), 'custom: no default empty');

  // ── Very narrow width — labels truncated, bar still renders ────────
  var w8 = galactica.textBar({
    width: 8, height: 3,
    border: { type: 'line', fg: 'cyan' },
    tags: false,
    labelWidth: 10,
    valueWidth: 10
  });
  screen.append(w8);
  w8.setData({ label: 'VeryLongLabel', percent: 0.5, value: 'BigValue' });

  var c8 = w8.getContent();
  assert.ok(c8.length > 0, 'narrow: produces content');
  assert.ok(
    c8.includes('\u2588') || c8.includes('\u2591'),
    'narrow: bar chars present'
  );

  // ── Long label truncation via fitToWidth ────────────────────────────
  var w9 = galactica.textBar({
    width: 30, height: 3,
    border: { type: 'line', fg: 'cyan' },
    tags: false,
    labelWidth: 5
  });
  screen.append(w9);
  w9.setData({ label: 'VeryLongLabel', percent: 0.3, value: '30%' });

  var c9 = w9.getContent();
  assert.ok(!c9.includes('VeryLongLabel'), 'truncation: full label absent');
  assert.ok(c9.includes('VeryL'), 'truncation: truncated label present');

  // ── Constructor data via attach event ──────────────────────────────
  var w10 = galactica.textBar({
    width: 40, height: 3,
    border: { type: 'line', fg: 'cyan' },
    tags: false,
    data: { label: 'Init', percent: 0.25, value: '25%' }
  });
  screen.append(w10);

  var c10 = w10.getContent();
  assert.ok(c10.includes('Init'), 'attach data: label rendered');
  assert.ok(c10.includes('25%'), 'attach data: value rendered');

  // ── Constructor without new — instanceof guard ─────────────────────
  // galactica.textBar() already calls without new internally via the
  // factory pattern. Verify type is correct.
  assert.strictEqual(w1.type, 'text-bar', 'type is text-bar');

  // ── Fixed labelWidth and valueWidth options ────────────────────────
  var w11 = galactica.textBar({
    width: 40, height: 3,
    border: { type: 'line', fg: 'cyan' },
    tags: false,
    labelWidth: 8,
    valueWidth: 6
  });
  screen.append(w11);
  w11.setData({ label: 'DB', percent: 0.7, value: '7G' });

  var c11 = w11.getContent();
  assert.ok(c11.includes('DB'), 'fixed widths: label present');
  assert.ok(c11.includes('7G'), 'fixed widths: value present');
  assert.ok(c11.includes('\u2588'), 'fixed widths: fill chars present');

  // ── getOptionsPrototype returns valid options ──────────────────────
  var proto = w1.getOptionsPrototype();
  assert.ok(proto.data, 'prototype: has data');
  assert.strictEqual(typeof proto.data.percent, 'number', 'prototype: percent is number');
  assert.ok(proto.data.label, 'prototype: has label');
  assert.ok(proto.data.value, 'prototype: has value');

  // ── Default options — minimal constructor ──────────────────────────
  var w12 = galactica.textBar({
    width: 30, height: 3,
    border: { type: 'line', fg: 'cyan' }
  });
  screen.append(w12);
  w12.setData({ label: 'A', percent: 0.5, value: 'B' });

  var c12 = w12.getContent();
  assert.ok(c12.includes('\u2588'), 'defaults: fill char');
  assert.ok(c12.includes('\u2591'), 'defaults: empty char');
  assert.ok(c12.includes('A'), 'defaults: label');
  assert.ok(c12.includes('B'), 'defaults: value');

  // ── Tags enabled but no bar colors — no tag wrapping ───────────────
  var w13 = galactica.textBar({
    width: 30, height: 3,
    border: { type: 'line', fg: 'cyan' },
    tags: true
  });
  screen.append(w13);
  w13.setData({ label: 'Plain', percent: 0.4, value: '40%' });

  var c13 = w13.getContent();
  assert.ok(!c13.includes('-fg}'), 'no colors set: no color tags');

  // ── Missing data fields default gracefully ─────────────────────────
  var w14 = galactica.textBar({
    width: 30, height: 3,
    border: { type: 'line', fg: 'cyan' },
    tags: false
  });
  screen.append(w14);
  w14.setData({});

  var c14 = w14.getContent();
  assert.ok(c14.includes('\u2591'), 'empty data: defaults to 0% (empty bar)');

  // ── Custom spacing = 4 ─────────────────────────────────────────────
  var w15 = galactica.textBar({
    width: 40, height: 3,
    border: { type: 'line', fg: 'cyan' },
    tags: false,
    spacing: 4
  });
  screen.append(w15);
  w15.setData({ label: 'Sp', percent: 0.5, value: 'V' });

  var c15 = w15.getContent();
  assert.ok(c15.includes('Sp    '), 'spacing 4: four spaces after label');

  // ── Zero spacing ───────────────────────────────────────────────────
  var w16 = galactica.textBar({
    width: 30, height: 3,
    border: { type: 'line', fg: 'cyan' },
    tags: false,
    spacing: 0
  });
  screen.append(w16);
  w16.setData({ label: 'Z', percent: 0.5, value: 'V' });

  var c16 = w16.getContent();
  assert.ok(c16.startsWith('Z'), 'spacing 0: label starts content');
  // Bar chars should follow directly after label
  var nextChar = c16[1];
  assert.ok(
    nextChar === '\u2588' || nextChar === '\u2591',
    'spacing 0: bar immediately after label'
  );

  // ── Extremely narrow — available < 0 branch ─────────────────────────
  // Width 5 with border → inner=3, default spacing=2 → available = 3-1-4 = -2 < 0
  var w17 = galactica.textBar({
    width: 5, height: 3,
    border: { type: 'line', fg: 'cyan' },
    tags: false,
    labelWidth: 10,
    valueWidth: 10
  });
  screen.append(w17);
  w17.setData({ label: 'X', percent: 0.5, value: 'Y' });

  var c17 = w17.getContent();
  assert.ok(c17.length > 0, 'extreme narrow: still produces content');

  // ── Tags + 0% — filledStr is empty, tag wrapping skipped for fill ──
  var w18 = galactica.textBar({
    width: 30, height: 3,
    border: { type: 'line', fg: 'cyan' },
    tags: true,
    style: { bar: { fillFg: 'green', emptyFg: 'gray' } }
  });
  screen.append(w18);
  w18.setData({ label: 'Z0', percent: 0.0, value: '0' });

  var c18 = w18.getContent();
  assert.ok(c18.length > 0, 'tags+0%: renders');

  // ── Tags + 100% — emptyStr is empty, tag wrapping skipped for empty ─
  var w19 = galactica.textBar({
    width: 30, height: 3,
    border: { type: 'line', fg: 'cyan' },
    tags: true,
    style: { bar: { fillFg: 'green', emptyFg: 'gray' } }
  });
  screen.append(w19);
  w19.setData({ label: 'Z1', percent: 1.0, value: 'F' });

  var c19 = w19.getContent();
  assert.ok(c19.length > 0, 'tags+100%: renders');

  // ── Constructor with no options at all — options || {} fallback ──────
  var TextBar = require('../lib/widget/text-bar');
  var w20 = new TextBar();
  screen.append(w20);
  w20.setData({ label: 'No', percent: 0.3, value: '30' });

  var c20 = w20.getContent();
  assert.ok(c20.length > 0, 'no-args constructor: produces content');

  // ── Cleanup ────────────────────────────────────────────────────────
  galacticaMock.uninstall();
});
