'use strict';

/**
 * test/diagram-errors.test.js
 *
 * Integration tests for custom diagram error types.
 * Exercises BorderStyleError and ConnectionError through the public API
 * (model mutations that throw them).
 */

const test   = require('node:test');
const assert = require('node:assert');

const { BorderStyleError, ConnectionError }
  = require('../lib/widget/diagram/diagram-errors');
const { DiagramModel } = require('../lib/widget/diagram/diagram-model');
const { buildModelFromData } = require('../lib/widget/diagram/data-builder');

// ────────────────────────────────────────────────────────────────────
// § BorderStyleError
// ────────────────────────────────────────────────────────────────────

test('BorderStyleError has correct name and message', function () {
  const err = new BorderStyleError('neon');
  assert.strictEqual(err.name, 'BorderStyleError');
  assert.ok(err.message.includes('neon'), 'message should include the value');
  assert.ok(err.message.includes('Expected one of'), 'message should list valid styles');
  assert.ok(err instanceof Error, 'should be an Error instance');
});

test('addBox throws BorderStyleError for invalid borderStyle', function () {
  const m = new DiagramModel(40, 10);
  assert.throws(
    function () { m.addBox(0, 0, 10, 3, 'X', { borderStyle: 'neon' }); },
    function (err) { return err.name === 'BorderStyleError'; }
  );
});

test('setBorderStyle throws BorderStyleError for invalid style', function () {
  const m = new DiagramModel(40, 10);
  const box = m.addBox(0, 0, 10, 3, 'X');
  assert.throws(
    function () { m.setBorderStyle(box.id, 'glowing'); },
    function (err) { return err.name === 'BorderStyleError'; }
  );
});

test('setBorderStyle accepts valid style', function () {
  const m = new DiagramModel(40, 10);
  const box = m.addBox(0, 0, 10, 3, 'X');
  const result = m.setBorderStyle(box.id, 'heavy');
  assert.strictEqual(result.borderStyle, 'heavy');
});

test('setBorderStyle accepts null to clear', function () {
  const m = new DiagramModel(40, 10);
  const box = m.addBox(0, 0, 10, 3, 'X', { borderStyle: 'heavy' });
  const result = m.setBorderStyle(box.id, null);
  assert.strictEqual(result.borderStyle, null);
});

test('setBorderStyle returns null for non-existent box', function () {
  const m = new DiagramModel(40, 10);
  assert.strictEqual(m.setBorderStyle(999, 'heavy'), null);
});

// ────────────────────────────────────────────────────────────────────
// § ConnectionError
// ────────────────────────────────────────────────────────────────────

test('ConnectionError has correct name and message', function () {
  const err = new ConnectionError('bad ref');
  assert.strictEqual(err.name, 'ConnectionError');
  assert.strictEqual(err.message, 'bad ref');
  assert.ok(err instanceof Error, 'should be an Error instance');
});

test('buildModelFromData throws ConnectionError for unknown source node', function () {
  assert.throws(
    function () {
      buildModelFromData({
        nodes: [{ id: 'A' }],
        connections: [{ from: 'X', to: 'A' }]
      });
    },
    function (err) { return err.name === 'ConnectionError' && err.message.includes('X'); }
  );
});

test('buildModelFromData throws ConnectionError for unknown target node', function () {
  assert.throws(
    function () {
      buildModelFromData({
        nodes: [{ id: 'A' }],
        connections: [{ from: 'A', to: 'Z' }]
      });
    },
    function (err) { return err.name === 'ConnectionError' && err.message.includes('Z'); }
  );
});

test('buildModelFromData throws ConnectionError for duplicate node id', function () {
  assert.throws(
    function () {
      buildModelFromData({
        nodes: [{ id: 'A' }, { id: 'A' }]
      });
    },
    function (err) { return err.name === 'ConnectionError' && err.message.includes('Duplicate'); }
  );
});

test('buildModelFromData throws ConnectionError for missing node id', function () {
  assert.throws(
    function () {
      buildModelFromData({
        nodes: [{ text: 'no id' }]
      });
    },
    function (err) { return err.name === 'ConnectionError' && err.message.includes('missing'); }
  );
});

test('buildModelFromData throws BorderStyleError for invalid default border', function () {
  assert.throws(
    function () {
      buildModelFromData({ nodes: [{ id: 'A' }] }, 'neon');
    },
    function (err) { return err.name === 'BorderStyleError'; }
  );
});
