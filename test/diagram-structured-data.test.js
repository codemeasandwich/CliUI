'use strict';

/**
 * test/diagram-structured-data.test.js
 *
 * Integration tests for the structured data API (setData with nodes/connections).
 * Exercises buildModelFromData through the public diagram index exports.
 */

const test   = require('node:test');
const assert = require('node:assert');

const { DiagramModel, SIDE, CONN_STYLE, STATUS, buildModelFromData }
  = require('../lib/widget/diagram');

// ────────────────────────────────────────────────────────────────────
// § Basic model construction
// ────────────────────────────────────────────────────────────────────

test('buildModelFromData creates boxes for each node', function () {
  const result = buildModelFromData({
    nodes: [
      { id: 'a', text: 'Alpha' },
      { id: 'b', text: 'Beta' },
      { id: 'c', text: 'Gamma' }
    ]
  });

  assert.strictEqual(result.model.boxes.size, 3);
  assert.ok(result.idMap.has('a'));
  assert.ok(result.idMap.has('b'));
  assert.ok(result.idMap.has('c'));
  assert.ok(result.reverseMap.has(result.idMap.get('a')));
});

test('buildModelFromData creates connectors', function () {
  const result = buildModelFromData({
    nodes: [{ id: 'a' }, { id: 'b' }],
    connections: [{ from: 'a', to: 'b' }]
  });

  assert.strictEqual(result.model.connectors.size, 1);
  const conn = result.model.connectors.values().next().value;
  assert.ok(conn.arrowDir, 'connector should have an arrow direction');
});

test('buildModelFromData applies node options', function () {
  const result = buildModelFromData({
    nodes: [
      { id: 'x', text: 'X', borderStyle: 'heavy', status: 'success', checked: true, currentWork: true }
    ]
  });

  const boxId = result.idMap.get('x');
  const box = result.model.getBox(boxId);
  assert.strictEqual(box.borderStyle, 'heavy');
  assert.strictEqual(box.status, 'success');
  assert.strictEqual(box.checked, true);
  assert.strictEqual(box.currentWork, true);
});

test('buildModelFromData applies defaultBorder', function () {
  const result = buildModelFromData({
    nodes: [{ id: 'a' }, { id: 'b' }]
  }, 'double');

  result.model.boxes.forEach(function (box) {
    assert.strictEqual(box.borderStyle, 'double');
  });
});

test('buildModelFromData node borderStyle overrides default', function () {
  const result = buildModelFromData({
    nodes: [{ id: 'a', borderStyle: 'heavy' }]
  }, 'double');

  const box = result.model.getBox(result.idMap.get('a'));
  assert.strictEqual(box.borderStyle, 'heavy');
});

// ────────────────────────────────────────────────────────────────────
// § Connection properties
// ────────────────────────────────────────────────────────────────────

test('buildModelFromData applies connection properties', function () {
  const result = buildModelFromData({
    nodes: [{ id: 'a' }, { id: 'b' }],
    connections: [{
      from: 'a', to: 'b',
      label: 'flow',
      style: 'animated',
      marker: '◆',
      head: '►',
      speed: 200,
      weight: 2,
      bidirectional: true
    }]
  });

  const conn = result.model.connectors.values().next().value;
  assert.strictEqual(conn.lineLabel, 'flow');
  assert.strictEqual(conn.style, 'animated');
  assert.strictEqual(conn.marker, '◆');
  assert.strictEqual(conn.head, '►');
  assert.strictEqual(conn.speed, 200);
  assert.strictEqual(conn.weight, 2);
  assert.strictEqual(conn.bidirectional, true);
  assert.ok(conn.sourceArrowDir, 'bidirectional should set sourceArrowDir');
});

// ────────────────────────────────────────────────────────────────────
// § Box dimensions
// ────────────────────────────────────────────────────────────────────

test('buildModelFromData derives box dimensions from text', function () {
  const result = buildModelFromData({
    nodes: [{ id: 'a', text: 'Hello World' }]
  });

  const box = result.model.getBox(result.idMap.get('a'));
  /* Width = max(textLen + 4, 10) = max(15, 10) = 15 */
  assert.strictEqual(box.width, 15);
  assert.strictEqual(box.height, 3);
});

test('buildModelFromData uses explicit dimensions', function () {
  const result = buildModelFromData({
    nodes: [{ id: 'a', width: 20, height: 5 }]
  });

  const box = result.model.getBox(result.idMap.get('a'));
  assert.strictEqual(box.width, 20);
  assert.strictEqual(box.height, 5);
});

test('buildModelFromData uses id as text when text not provided', function () {
  const result = buildModelFromData({
    nodes: [{ id: 'myNode' }]
  });

  const box = result.model.getBox(result.idMap.get('myNode'));
  assert.strictEqual(box.text, 'myNode');
});

// ────────────────────────────────────────────────────────────────────
// § Multiple connections per node
// ────────────────────────────────────────────────────────────────────

test('multiple connections create separate ports with incrementing offsets', function () {
  const result = buildModelFromData({
    nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    connections: [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c' }
    ]
  });

  const boxA = result.model.getBox(result.idMap.get('a'));
  /* Box A should have 2 ports on its right side. */
  assert.strictEqual(boxA.ports.length, 2);
  assert.strictEqual(boxA.ports[0].side, SIDE.RIGHT);
  assert.strictEqual(boxA.ports[1].side, SIDE.RIGHT);
  assert.strictEqual(boxA.ports[0].offset, 0);
  assert.strictEqual(boxA.ports[1].offset, 1);
});

// ────────────────────────────────────────────────────────────────────
// § Empty/missing collections
// ────────────────────────────────────────────────────────────────────

test('buildModelFromData handles no connections', function () {
  const result = buildModelFromData({
    nodes: [{ id: 'a' }]
  });

  assert.strictEqual(result.model.connectors.size, 0);
});

test('buildModelFromData handles empty nodes array', function () {
  const result = buildModelFromData({ nodes: [] });
  assert.strictEqual(result.model.boxes.size, 0);
});

// ────────────────────────────────────────────────────────────────────
// § Status mutations
// ────────────────────────────────────────────────────────────────────

test('setStatus sets and clears box status', function () {
  const m = new DiagramModel(40, 10);
  const box = m.addBox(0, 0, 10, 3, 'X');

  m.setStatus(box.id, 'error');
  assert.strictEqual(box.status, 'error');

  m.setStatus(box.id, null);
  assert.strictEqual(box.status, null);
});

test('setStatus returns null for non-existent box', function () {
  const m = new DiagramModel(40, 10);
  assert.strictEqual(m.setStatus(999, 'success'), null);
});

// ────────────────────────────────────────────────────────────────────
// § Connection animation setup via setData
// ────────────────────────────────────────────────────────────────────

test('setData with animated connectors populates _connAnimStates', function () {
  var galacticaMock = require('./helpers/galactica-mock');
  var galactica = require('../index');

  var screen = galacticaMock.install({ cols: 120, rows: 40 });
  var diagram = galactica.diagram({
    parent: screen,
    top: 0, left: 0, width: 80, height: 20,
    interactive: true, focusable: true, animate: false
  });

  diagram._deferredInit({ focusable: true, interactive: true, animate: false });

  diagram.setData({
    nodes: [{ id: 'a' }, { id: 'b' }],
    connections: [{ from: 'a', to: 'b', style: 'animated', speed: 100 }]
  });

  /* _connAnimStates should be populated with one entry. */
  assert.ok(diagram._connAnimStates != null, '_connAnimStates should exist');
  assert.strictEqual(diagram._connAnimStates.size, 1, 'should have 1 animated connector');

  var state = diagram._connAnimStates.values().next().value;
  assert.strictEqual(state.style, 'animated');

  /* Cleanup timers. */
  diagram._clearConnAnimations();
  if (diagram._focusPulseTimer) clearInterval(diagram._focusPulseTimer);
  galacticaMock.uninstall();
});

// ────────────────────────────────────────────────────────────────────
// § Constants exported
// ────────────────────────────────────────────────────────────────────

test('CONN_STYLE enum has expected values', function () {
  assert.strictEqual(CONN_STYLE.STATIC, 'static');
  assert.strictEqual(CONN_STYLE.ANIMATED, 'animated');
  assert.strictEqual(CONN_STYLE.DASHED, 'dashed');
  assert.strictEqual(CONN_STYLE.SNAKE, 'snake');
  assert.strictEqual(CONN_STYLE.SPINNER, 'spinner');
});

test('STATUS enum has expected values', function () {
  assert.strictEqual(STATUS.SUCCESS, 'success');
  assert.strictEqual(STATUS.ERROR, 'error');
  assert.strictEqual(STATUS.PENDING, 'pending');
});

// ────────────────────────────────────────────────────────────────────
// § Branch coverage — optional connection properties
// ────────────────────────────────────────────────────────────────────

test('buildModelFromData passes all optional connection properties', function () {
  /* Exercises every if(c.property) branch in data-builder.js L159-172. */
  const result = buildModelFromData({
    nodes: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
    connections: [{
      from: 'a', to: 'b',
      label: 'test-label',
      style: 'animated',
      marker: '\u25CB',
      head: '>',
      speed: 200,
      weight: 2,
      bidirectional: true,
      density: 0.7,
      backEdge: true
    }]
  });
  const conn = result.model.connectors.values().next().value;
  assert.strictEqual(conn.lineLabel, 'test-label', 'label should be set');
  assert.strictEqual(conn.style, 'animated', 'style should be set');
  assert.strictEqual(conn.marker, '\u25CB', 'marker should be set');
  assert.strictEqual(conn.head, '>', 'head should be set');
  assert.strictEqual(conn.speed, 200, 'speed should be set');
  assert.strictEqual(conn.weight, 2, 'weight should be set');
  assert.strictEqual(conn.bidirectional, true, 'bidirectional should be true');
  assert.strictEqual(conn.density, 0.7, 'density should be set');
  assert.strictEqual(conn.backEdge, true, 'backEdge should be true');
});

test('buildModelFromData with no optional properties leaves defaults', function () {
  /* Exercises the falsy branches for all optional properties. */
  const result = buildModelFromData({
    nodes: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
    connections: [{ from: 'a', to: 'b' }]
  });
  const conn = result.model.connectors.values().next().value;
  assert.strictEqual(conn.lineLabel, null, 'label should remain null');
  assert.strictEqual(conn.bidirectional, false, 'bidirectional should remain false');
  assert.strictEqual(conn.backEdge, false, 'backEdge should remain false');
});

test('buildModelFromData with speed=0 passes through', function () {
  /* Exercises the c.speed != null branch when speed is 0. */
  const result = buildModelFromData({
    nodes: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
    connections: [{ from: 'a', to: 'b', speed: 0, weight: 0 }]
  });
  const conn = result.model.connectors.values().next().value;
  assert.strictEqual(conn.speed, 0, 'speed 0 should be preserved');
  assert.strictEqual(conn.weight, 0, 'weight 0 should be preserved');
});

test('buildModelFromData with explicit arrow direction', function () {
  /* Exercises c.arrow truthy branch. */
  const result = buildModelFromData({
    nodes: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
    connections: [{ from: 'a', to: 'b', arrow: 'down' }]
  });
  const conn = result.model.connectors.values().next().value;
  assert.strictEqual(conn.arrowDir, 'down', 'arrow direction should be overridden');
});
