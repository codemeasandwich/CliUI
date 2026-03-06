'use strict';

/**
 * test/diagram-cycle.test.js
 *
 * Integration tests for the cycle diagram builder.
 * Exercises buildCycleFromData through the public diagram API,
 * verifying group containers, state positioning, and back-edge routing.
 */

const test   = require('node:test');
const assert = require('node:assert');

const { buildCycleFromData, buildModelFromData, render, layout, routeAll, ConnectionError }
  = require('../lib/widget/diagram');
var galacticaMock = require('./helpers/galactica-mock');
var galactica     = require('../index');

// ────────────────────────────────────────────────────────────────────
// § Helpers
// ────────────────────────────────────────────────────────────────────

function basicCycleData() {
  return {
    states: [
      { id: 'mounting', text: 'MOUNTING' },
      { id: 'recvProps', text: 'RECV\nPROPS' },
      { id: 'recvState', text: 'RECV\nSTATE' }
    ],
    groups: [
      { id: 'lifecycle', label: 'MOUNTED', states: ['mounting', 'recvProps', 'recvState'] }
    ],
    transitions: [
      { from: 'mounting', to: 'recvProps' },
      { from: 'recvProps', to: 'recvState' },
      { from: 'recvState', to: 'mounting', backEdge: true }
    ]
  };
}

// ────────────────────────────────────────────────────────────────────
// § buildCycleFromData
// ────────────────────────────────────────────────────────────────────

test('buildCycleFromData creates model with state boxes', function () {
  const result = buildCycleFromData(basicCycleData());
  assert.ok(result.model, 'should return a model');
  assert.strictEqual(result.idMap.size, 3, 'should have 3 state ID mappings');

  /* Verify each state has a box. */
  for (const [strId, boxId] of result.idMap) {
    const box = result.model.getBox(boxId);
    assert.ok(box, 'box should exist for state ' + strId);
    assert.strictEqual(box.kind, 'state', 'box kind should be state');
  }
});

test('buildCycleFromData creates group container box', function () {
  const result = buildCycleFromData(basicCycleData());
  assert.ok(result.groupMap.has('lifecycle'), 'groupMap should contain lifecycle');
  const groupBoxId = result.groupMap.get('lifecycle');
  const groupBox = result.model.getBox(groupBoxId);
  assert.ok(groupBox, 'group container box should exist');
  assert.ok(groupBox.width > 0, 'group should have positive width');
});

test('buildCycleFromData positions states within group', function () {
  const result = buildCycleFromData(basicCycleData());
  const groupBoxId = result.groupMap.get('lifecycle');
  const groupBox = result.model.getBox(groupBoxId);

  /* Each state should be positioned inside the group bounds. */
  for (const [, boxId] of result.idMap) {
    const box = result.model.getBox(boxId);
    assert.ok(box.x >= groupBox.x, 'state X should be >= group X');
    assert.ok(box.y >= groupBox.y, 'state Y should be >= group Y');
  }
});

test('buildCycleFromData marks back-edge connectors', function () {
  const result = buildCycleFromData(basicCycleData());
  let backEdgeCount = 0;
  result.model.connectors.forEach(function (conn) {
    if (conn.backEdge) backEdgeCount++;
  });
  assert.strictEqual(backEdgeCount, 1, 'should have 1 back-edge connector');
});

test('buildCycleFromData creates forward connectors', function () {
  const result = buildCycleFromData(basicCycleData());
  assert.strictEqual(result.model.connectors.size, 3, 'should have 3 total connectors');
});

test('cycle model can be laid out and rendered', function () {
  const result = buildCycleFromData(basicCycleData());
  layout(result.model);
  routeAll(result.model);
  const text = render(result.model);
  assert.ok(text.length > 0, 'render output should not be empty');
  assert.ok(text.includes('MOUNTING'), 'render should include MOUNTING text');
});

test('buildCycleFromData throws on missing state id', function () {
  assert.throws(function () {
    buildCycleFromData({
      states: [{ text: 'no-id' }],
      groups: [],
      transitions: []
    });
  }, ConnectionError);
});

test('buildCycleFromData throws on unknown state in group', function () {
  assert.throws(function () {
    buildCycleFromData({
      states: [{ id: 'a', text: 'A' }],
      groups: [{ id: 'g', label: 'G', states: ['a', 'unknown'] }],
      transitions: []
    });
  }, ConnectionError);
});

test('buildCycleFromData throws on duplicate state id', function () {
  assert.throws(function () {
    buildCycleFromData({
      states: [{ id: 'a' }, { id: 'a' }],
      groups: [],
      transitions: []
    });
  }, ConnectionError);
});

test('buildCycleFromData throws on invalid defaultBorder', function () {
  assert.throws(function () {
    buildCycleFromData(basicCycleData(), 'bogus');
  }, /Unknown border style/);
});

test('buildCycleFromData throws on unknown transition from state', function () {
  assert.throws(function () {
    buildCycleFromData({
      states: [{ id: 'a', text: 'A' }],
      groups: [],
      transitions: [{ from: 'missing', to: 'a' }]
    });
  }, ConnectionError);
});

test('buildCycleFromData throws on unknown transition to state', function () {
  assert.throws(function () {
    buildCycleFromData({
      states: [{ id: 'a', text: 'A' }],
      groups: [],
      transitions: [{ from: 'a', to: 'missing' }]
    });
  }, ConnectionError);
});

test('buildCycleFromData supports transition labels', function () {
  const data = basicCycleData();
  data.transitions[0].label = 'next';
  const result = buildCycleFromData(data);
  let found = false;
  result.model.connectors.forEach(function (conn) {
    if (conn.lineLabel === 'next') found = true;
  });
  assert.ok(found, 'should have a connector with label "next"');
});

test('buildCycleFromData supports multiple groups', function () {
  const data = {
    states: [
      { id: 's1', text: 'S1' }, { id: 's2', text: 'S2' },
      { id: 's3', text: 'S3' }, { id: 's4', text: 'S4' }
    ],
    groups: [
      { id: 'g1', label: 'Group 1', states: ['s1', 's2'] },
      { id: 'g2', label: 'Group 2', states: ['s3', 's4'] }
    ],
    transitions: [{ from: 's1', to: 's2' }, { from: 's3', to: 's4' }]
  };
  const result = buildCycleFromData(data);
  assert.strictEqual(result.groupMap.size, 2, 'should have 2 groups');
  assert.ok(result.groupMap.has('g1'), 'groupMap should contain g1');
  assert.ok(result.groupMap.has('g2'), 'groupMap should contain g2');
});

test('buildCycleFromData supports back-edge with label', function () {
  const data = basicCycleData();
  data.transitions[2].label = 'reset';
  const result = buildCycleFromData(data);
  let found = false;
  result.model.connectors.forEach(function (conn) {
    if (conn.backEdge && conn.lineLabel === 'reset') found = true;
  });
  assert.ok(found, 'back-edge should carry the label');
});

test('buildCycleFromData handles empty transitions array', function () {
  const result = buildCycleFromData({
    states: [{ id: 'a', text: 'A' }], groups: [], transitions: []
  });
  assert.strictEqual(result.model.connectors.size, 0, 'should have 0 connectors');
  assert.strictEqual(result.idMap.size, 1, 'should have 1 state');
});

test('buildCycleFromData throws on duplicate group id', function () {
  assert.throws(function () {
    buildCycleFromData({
      states: [{ id: 's1', text: 'S1' }, { id: 's2', text: 'S2' }],
      groups: [
        { id: 'g', label: 'G1', states: ['s1'] },
        { id: 'g', label: 'G2', states: ['s2'] }
      ],
      transitions: []
    });
  }, ConnectionError);
});

test('buildCycleFromData handles group with empty states array', function () {
  const result = buildCycleFromData({
    states: [{ id: 'a', text: 'A' }],
    groups: [{ id: 'empty', label: 'Empty', states: [] }],
    transitions: []
  });
  /* Group container should exist even with no member states. */
  assert.ok(result.groupMap.has('empty'), 'groupMap should contain empty group');
  const groupBox = result.model.getBox(result.groupMap.get('empty'));
  assert.ok(groupBox.width > 0, 'group should have positive width');
});

test('buildCycleFromData handles multiline state text dimensions', function () {
  const result = buildCycleFromData({
    states: [{ id: 'multi', text: 'Line1\nLine2\nLine3' }],
    groups: [],
    transitions: []
  });
  const box = result.model.getBox(result.idMap.get('multi'));
  /* 3 lines + 2 border rows = 5 minimum height. */
  assert.ok(box.height >= 5, 'box should have height for 3 text lines + borders');
});

test('buildCycleFromData throws on missing group id', function () {
  assert.throws(function () {
    buildCycleFromData({
      states: [],
      groups: [{ label: 'NoId', states: [] }],
      transitions: []
    });
  }, ConnectionError);
});

// ────────────────────────────────────────────────────────────────────
// § Diagram widget setData routing for cycle type
// ────────────────────────────────────────────────────────────────────

test('diagram.setData routes type:cycle through buildCycleFromData', function () {
  var screen = galacticaMock.install({ cols: 120, rows: 40 });
  var diagram = galactica.diagram({
    parent: screen,
    top: 0, left: 0, width: 80, height: 20,
    interactive: false, focusable: false, animate: false
  });
  diagram._deferredInit({ interactive: false, focusable: false, animate: false });

  diagram.setData({
    type: 'cycle',
    states: [
      { id: 'a', text: 'Alpha' },
      { id: 'b', text: 'Beta' }
    ],
    groups: [{ id: 'g1', label: 'Group', states: ['a', 'b'] }],
    transitions: [{ from: 'a', to: 'b' }]
  });

  assert.ok(diagram._model, 'model should be populated after setData cycle');
  assert.ok(diagram._model.boxes.size >= 3,
    'should have at least 3 boxes (2 states + 1 group)');
  galacticaMock.uninstall();
});

test('cycle setData preserves state positions inside group bounds', function () {
  /* Regression: _applyBuilderResult used to call layout() which
   * ran Kahn's topological sort and repositioned all boxes, ripping
   * states out of their group containers. With skipLayout the manual
   * positioning from buildCycleFromData must survive intact. */
  var result = buildCycleFromData(basicCycleData());
  var groupBoxId = result.groupMap.get('lifecycle');
  var groupBox = result.model.getBox(groupBoxId);

  /* Verify every state box is within the group container bounds. */
  for (var [strId, boxId] of result.idMap) {
    var box = result.model.getBox(boxId);
    assert.ok(box.x >= groupBox.x,
      'state ' + strId + ' x (' + box.x + ') should be >= group x (' + groupBox.x + ')');
    assert.ok(box.y >= groupBox.y,
      'state ' + strId + ' y (' + box.y + ') should be >= group y (' + groupBox.y + ')');
    assert.ok(box.x + box.width <= groupBox.x + groupBox.width,
      'state ' + strId + ' right edge should be within group');
    assert.ok(box.y + box.height <= groupBox.y + groupBox.height,
      'state ' + strId + ' bottom edge should be within group');
  }
});

test('cycle setData via widget preserves group containment', function () {
  var screen = galacticaMock.install({ cols: 120, rows: 40 });
  var diagram = galactica.diagram({
    parent: screen,
    top: 0, left: 0, width: 80, height: 20,
    interactive: false, focusable: false, animate: false
  });
  diagram._deferredInit({ interactive: false, focusable: false, animate: false });

  diagram.setData({
    type: 'cycle',
    states: [
      { id: 'a', text: 'Alpha' },
      { id: 'b', text: 'Beta' }
    ],
    groups: [{ id: 'g1', label: 'Group', states: ['a', 'b'] }],
    transitions: [{ from: 'a', to: 'b' }]
  });

  /* After setData (which calls _applyBuilderResult), states must
   * still be inside the group container — layout must not have
   * overwritten the cycle builder's manual positioning. */
  var groupBox = null;
  var stateBoxes = [];
  diagram._model.boxes.forEach(function (box) {
    if (box.kind === 'process') groupBox = box;
    else stateBoxes.push(box);
  });
  assert.ok(groupBox, 'group container should exist');
  for (var i = 0; i < stateBoxes.length; i++) {
    var sb = stateBoxes[i];
    assert.ok(sb.x >= groupBox.x && sb.y >= groupBox.y,
      'state should be inside group after widget setData');
  }
  galacticaMock.uninstall();
});

// ────────────────────────────────────────────────────────────────────
// § Layout cycle breaker
// ────────────────────────────────────────────────────────────────────

test('layout handles true cycles without backEdge flag via cycle breaker', function () {
  /* Build a circular graph A→B→C→A where none of the edges are
   * marked as backEdge. The layout engine's cycle breaker must
   * force-assign one node to break the cycle so all boxes get
   * laid out without infinite loops. */
  var result = buildModelFromData({
    nodes: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
      { id: 'c', text: 'C' }
    ],
    connections: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'a' }
    ]
  });
  /* Layout should not throw or hang despite the cycle. */
  layout(result.model);
  routeAll(result.model);
  var text = render(result.model);
  assert.ok(text.includes('A'), 'should render A');
  assert.ok(text.includes('B'), 'should render B');
  assert.ok(text.includes('C'), 'should render C');
});

test('buildCycleFromData supports transition style and speed', function () {
  var data = basicCycleData();
  data.transitions[0].style = 'animated';
  data.transitions[0].speed = 200;
  var result = buildCycleFromData(data);
  var foundStyle = false;
  result.model.connectors.forEach(function (conn) {
    if (conn.style === 'animated' && conn.speed === 200) foundStyle = true;
  });
  assert.ok(foundStyle, 'connector should carry style and speed');
});

test('buildCycleFromData applies defaultBorder to state boxes', function () {
  var result = buildCycleFromData(basicCycleData(), 'heavy');
  for (var [, boxId] of result.idMap) {
    var box = result.model.getBox(boxId);
    assert.strictEqual(box.borderStyle, 'heavy',
      'state box should use defaultBorder when no override');
  }
});

test('buildCycleFromData state borderStyle overrides defaultBorder', function () {
  var data = {
    states: [{ id: 'a', text: 'A', borderStyle: 'double' }],
    groups: [],
    transitions: []
  };
  var result = buildCycleFromData(data, 'heavy');
  var box = result.model.getBox(result.idMap.get('a'));
  assert.strictEqual(box.borderStyle, 'double',
    'explicit borderStyle should override default');
});

test('buildCycleFromData supports state status', function () {
  var data = {
    states: [{ id: 'a', text: 'A', status: 'error' }],
    groups: [],
    transitions: []
  };
  var result = buildCycleFromData(data);
  var box = result.model.getBox(result.idMap.get('a'));
  assert.strictEqual(box.status, 'error', 'state should carry status');
});

// ────────────────────────────────────────────────────────────────────
// § Branch coverage — optional transition properties
// ────────────────────────────────────────────────────────────────────

test('buildCycleFromData passes all optional transition properties', function () {
  /* Exercises every if(t.property) branch in data-builder-cycle.js. */
  var data = {
    states: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
    groups: [],
    transitions: [{
      from: 'a', to: 'b',
      label: 'go',
      style: 'animated',
      speed: 100,
      backEdge: true
    }]
  };
  var result = buildCycleFromData(data);
  var conn = result.model.connectors.values().next().value;
  assert.strictEqual(conn.lineLabel, 'go', 'label should be set');
  assert.strictEqual(conn.style, 'animated', 'style should be set');
  assert.strictEqual(conn.speed, 100, 'speed should be set');
  assert.strictEqual(conn.backEdge, true, 'backEdge should be true');
});

test('buildCycleFromData with no optional transition properties leaves defaults', function () {
  var data = {
    states: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
    groups: [],
    transitions: [{ from: 'a', to: 'b' }]
  };
  var result = buildCycleFromData(data);
  var conn = result.model.connectors.values().next().value;
  assert.strictEqual(conn.lineLabel, null, 'label should be null');
  assert.strictEqual(conn.backEdge, false, 'backEdge should be false');
});

test('buildCycleFromData with speed=0 passes through', function () {
  var data = {
    states: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
    groups: [],
    transitions: [{ from: 'a', to: 'b', speed: 0 }]
  };
  var result = buildCycleFromData(data);
  var conn = result.model.connectors.values().next().value;
  assert.strictEqual(conn.speed, 0, 'speed 0 should be preserved');
});

test('buildCycleFromData state text defaults to id', function () {
  /* Exercises s.text || s.id fallback. */
  var data = {
    states: [{ id: 'myState' }],
    groups: [],
    transitions: []
  };
  var result = buildCycleFromData(data);
  var box = result.model.getBox(result.idMap.get('myState'));
  assert.strictEqual(box.text, 'myState', 'text should default to id');
});
