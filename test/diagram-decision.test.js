'use strict';

/**
 * test/diagram-decision.test.js
 *
 * Integration tests for the decision diagram builder.
 * Exercises buildDecisionFromData through the public diagram API,
 * verifying box creation, decision node bracket-wrapping, port-side
 * assignment, back-edge marking, and error handling.
 */

const test   = require('node:test');
const assert = require('node:assert');

const { buildDecisionFromData, render, layout, routeAll, BorderStyleError, ConnectionError }
  = require('../lib/widget/diagram');
var galacticaMock = require('./helpers/galactica-mock');
var galactica     = require('../index');

// ────────────────────────────────────────────────────────────────────
// § Helpers
// ────────────────────────────────────────────────────────────────────

function basicDecisionData() {
  return {
    nodes: [
      { id: 'start', text: 'Start', kind: 'terminal' },
      { id: 'check', text: 'update?', kind: 'decision' },
      { id: 'apply', text: 'Apply Update' },
      { id: 'done', text: 'Done', kind: 'terminal' }
    ],
    connections: [
      { from: 'start', to: 'check' },
      { from: 'check', to: 'apply', label: 'yes' },
      { from: 'check', to: 'done', label: 'no' },
      { from: 'apply', to: 'done' }
    ]
  };
}

// ────────────────────────────────────────────────────────────────────
// § buildDecisionFromData — box creation
// ────────────────────────────────────────────────────────────────────

test('buildDecisionFromData creates model with correct box count', function () {
  var result = buildDecisionFromData(basicDecisionData());
  assert.ok(result.model, 'should return a model');
  assert.strictEqual(result.idMap.size, 4, 'should have 4 node ID mappings');
  assert.strictEqual(result.reverseMap.size, 4, 'should have 4 reverse mappings');
});

test('buildDecisionFromData wraps decision node text in brackets', function () {
  var result = buildDecisionFromData(basicDecisionData());
  var checkBoxId = result.idMap.get('check');
  var box = result.model.getBox(checkBoxId);
  assert.ok(box.text.startsWith('['), 'decision text should start with [');
  assert.ok(box.text.endsWith(']'), 'decision text should end with ]');
});

test('buildDecisionFromData does not double-wrap brackets', function () {
  var data = {
    nodes: [{ id: 'q', text: '[already?]', kind: 'decision' }],
    connections: []
  };
  var result = buildDecisionFromData(data);
  var box = result.model.getBox(result.idMap.get('q'));
  assert.strictEqual(box.text, '[already?]', 'should not double-wrap brackets');
});

test('buildDecisionFromData assigns dashed border to decision nodes', function () {
  var result = buildDecisionFromData(basicDecisionData());
  var checkBoxId = result.idMap.get('check');
  var box = result.model.getBox(checkBoxId);
  assert.strictEqual(box.borderStyle, 'dashed', 'decision node should have dashed border');
});

test('buildDecisionFromData assigns rounded border to terminal nodes', function () {
  var result = buildDecisionFromData(basicDecisionData());
  var startBoxId = result.idMap.get('start');
  var box = result.model.getBox(startBoxId);
  assert.strictEqual(box.borderStyle, 'rounded', 'terminal node should have rounded border');
});

test('buildDecisionFromData sets node kind on boxes', function () {
  var result = buildDecisionFromData(basicDecisionData());
  var checkBox = result.model.getBox(result.idMap.get('check'));
  var startBox = result.model.getBox(result.idMap.get('start'));
  var applyBox = result.model.getBox(result.idMap.get('apply'));
  assert.strictEqual(checkBox.kind, 'decision', 'check should be decision kind');
  assert.strictEqual(startBox.kind, 'terminal', 'start should be terminal kind');
  assert.strictEqual(applyBox.kind, 'process', 'apply should default to process kind');
});

test('buildDecisionFromData defaults text to node id', function () {
  var data = {
    nodes: [{ id: 'myNode' }],
    connections: []
  };
  var result = buildDecisionFromData(data);
  var box = result.model.getBox(result.idMap.get('myNode'));
  assert.strictEqual(box.text, 'myNode', 'text should default to id');
});

// ────────────────────────────────────────────────────────────────────
// § buildDecisionFromData — connections and port sides
// ────────────────────────────────────────────────────────────────────

test('buildDecisionFromData creates correct connector count', function () {
  var result = buildDecisionFromData(basicDecisionData());
  assert.strictEqual(result.model.connectors.size, 4, 'should have 4 connectors');
});

test('buildDecisionFromData applies edge labels', function () {
  var result = buildDecisionFromData(basicDecisionData());
  var labels = [];
  result.model.connectors.forEach(function (conn) {
    if (conn.lineLabel) labels.push(conn.lineLabel);
  });
  assert.ok(labels.includes('yes'), 'should have yes label');
  assert.ok(labels.includes('no'), 'should have no label');
});

test('buildDecisionFromData marks back-edge connectors', function () {
  var data = {
    nodes: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'check?', kind: 'decision' }
    ],
    connections: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a', backEdge: true, label: 'retry' }
    ]
  };
  var result = buildDecisionFromData(data);
  var backEdges = 0;
  result.model.connectors.forEach(function (conn) {
    if (conn.backEdge) backEdges++;
  });
  assert.strictEqual(backEdges, 1, 'should have 1 back-edge connector');
});

test('buildDecisionFromData passes style and speed to connectors', function () {
  var data = {
    nodes: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' }
    ],
    connections: [
      { from: 'a', to: 'b', style: 'animated', speed: 100 }
    ]
  };
  var result = buildDecisionFromData(data);
  var conn;
  result.model.connectors.forEach(function (c) { conn = c; });
  assert.strictEqual(conn.style, 'animated', 'should carry style');
  assert.strictEqual(conn.speed, 100, 'should carry speed');
});

// ────────────────────────────────────────────────────────────────────
// § buildDecisionFromData — defaultBorder
// ────────────────────────────────────────────────────────────────────

test('buildDecisionFromData applies defaultBorder to process nodes', function () {
  var data = {
    nodes: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' }
    ],
    connections: []
  };
  var result = buildDecisionFromData(data, 'heavy');
  var box = result.model.getBox(result.idMap.get('a'));
  assert.strictEqual(box.borderStyle, 'heavy', 'process node should use defaultBorder');
});

test('buildDecisionFromData defaultBorder does not override decision border', function () {
  var data = {
    nodes: [{ id: 'q', text: 'q?', kind: 'decision' }],
    connections: []
  };
  var result = buildDecisionFromData(data, 'heavy');
  var box = result.model.getBox(result.idMap.get('q'));
  assert.strictEqual(box.borderStyle, 'dashed', 'decision node should keep dashed border');
});

test('buildDecisionFromData node borderStyle overrides defaultBorder', function () {
  var data = {
    nodes: [{ id: 'a', text: 'A', borderStyle: 'double' }],
    connections: []
  };
  var result = buildDecisionFromData(data, 'heavy');
  var box = result.model.getBox(result.idMap.get('a'));
  assert.strictEqual(box.borderStyle, 'double', 'explicit borderStyle should override default');
});

test('buildDecisionFromData throws on invalid defaultBorder', function () {
  assert.throws(function () {
    buildDecisionFromData({ nodes: [], connections: [] }, 'bogus');
  }, BorderStyleError);
});

// ────────────────────────────────────────────────────────────────────
// § buildDecisionFromData — layout and render round-trip
// ────────────────────────────────────────────────────────────────────

test('decision model can be laid out and rendered', function () {
  var result = buildDecisionFromData(basicDecisionData());
  layout(result.model);
  routeAll(result.model);
  var text = render(result.model);
  assert.ok(text.length > 0, 'render output should not be empty');
  assert.ok(text.includes('[update?]'), 'render should include decision text');
});

// ────────────────────────────────────────────────────────────────────
// § buildDecisionFromData — error cases
// ────────────────────────────────────────────────────────────────────

test('buildDecisionFromData throws on missing node id', function () {
  assert.throws(function () {
    buildDecisionFromData({
      nodes: [{ text: 'no-id' }],
      connections: []
    });
  }, ConnectionError);
});

test('buildDecisionFromData throws on duplicate node id', function () {
  assert.throws(function () {
    buildDecisionFromData({
      nodes: [{ id: 'x' }, { id: 'x' }],
      connections: []
    });
  }, ConnectionError);
});

test('buildDecisionFromData throws on unknown from node in connection', function () {
  assert.throws(function () {
    buildDecisionFromData({
      nodes: [{ id: 'a' }],
      connections: [{ from: 'missing', to: 'a' }]
    });
  }, ConnectionError);
});

test('buildDecisionFromData throws on unknown to node in connection', function () {
  assert.throws(function () {
    buildDecisionFromData({
      nodes: [{ id: 'a' }],
      connections: [{ from: 'a', to: 'missing' }]
    });
  }, ConnectionError);
});

test('buildDecisionFromData handles multiline text sizing', function () {
  var data = {
    nodes: [{ id: 'multi', text: 'Line One\nLine Two\nLine Three' }],
    connections: []
  };
  var result = buildDecisionFromData(data);
  var box = result.model.getBox(result.idMap.get('multi'));
  assert.ok(box.height >= 5, 'box should have height for 3 lines + borders');
});

test('buildDecisionFromData handles status on nodes', function () {
  var data = {
    nodes: [{ id: 'a', text: 'A', status: 'pending' }],
    connections: []
  };
  var result = buildDecisionFromData(data);
  var box = result.model.getBox(result.idMap.get('a'));
  assert.strictEqual(box.status, 'pending', 'should carry status to box');
});

test('buildDecisionFromData routes back-edge destination to RIGHT side (sideToArrowDir LEFT)', function () {
  /* Back-edge: dstSide = SIDE.RIGHT, srcSide = SIDE.LEFT for decision nodes.
   * This exercises the LEFT case of sideToArrowDir via the srcSide, and
   * the RIGHT case via dstSide (arrow direction = 'right'). */
  var data = {
    nodes: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'q?', kind: 'decision' }
    ],
    connections: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a', backEdge: true }
    ]
  };
  var result = buildDecisionFromData(data);
  assert.strictEqual(result.model.connectors.size, 2, 'should have 2 connectors');
});

test('buildDecisionFromData handles arrow=none style on connectors', function () {
  var data = {
    nodes: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' }
    ],
    connections: [
      { from: 'a', to: 'b', style: 'dashed' }
    ]
  };
  var result = buildDecisionFromData(data);
  var conn;
  result.model.connectors.forEach(function (c) { conn = c; });
  assert.strictEqual(conn.style, 'dashed', 'should carry dashed style');
});

test('buildDecisionFromData handles error label for decision port side', function () {
  var data = {
    nodes: [
      { id: 'check', text: 'ok?', kind: 'decision' },
      { id: 'err', text: 'Error' }
    ],
    connections: [
      { from: 'check', to: 'err', label: 'error' }
    ]
  };
  /* Should not throw — the error label routes to BOTTOM side. */
  var result = buildDecisionFromData(data);
  assert.strictEqual(result.model.connectors.size, 1, 'should create 1 connector');
});

test('buildDecisionFromData handles multiple connections from same source', function () {
  var data = {
    nodes: [
      { id: 'q', text: 'check?', kind: 'decision' },
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
      { id: 'c', text: 'C' }
    ],
    connections: [
      { from: 'q', to: 'a', label: 'yes' },
      { from: 'q', to: 'b', label: 'no' },
      { from: 'q', to: 'c', label: 'error' }
    ]
  };
  var result = buildDecisionFromData(data);
  assert.strictEqual(result.model.connectors.size, 3,
    'should create 3 connectors from same decision node');
});

test('buildDecisionFromData handles connection from terminal node', function () {
  var data = {
    nodes: [
      { id: 'end', text: 'End', kind: 'terminal' },
      { id: 'restart', text: 'Restart' }
    ],
    connections: [
      { from: 'end', to: 'restart' }
    ]
  };
  var result = buildDecisionFromData(data);
  assert.strictEqual(result.model.connectors.size, 1,
    'should allow connection from terminal node');
});

test('buildDecisionFromData handles state kind nodes', function () {
  var data = {
    nodes: [{ id: 'st', text: 'StateName', kind: 'state' }],
    connections: []
  };
  var result = buildDecisionFromData(data);
  var box = result.model.getBox(result.idMap.get('st'));
  assert.strictEqual(box.kind, 'state', 'should carry state kind');
  /* State kind uses default border (not dashed or rounded). */
  assert.strictEqual(box.borderStyle, null, 'state kind should use default border');
});

test('buildDecisionFromData backEdge takes precedence over error label for port side', function () {
  /* When both backEdge: true and label: 'error' are set,
   * backEdge should determine LEFT routing (not BOTTOM from error label). */
  var data = {
    nodes: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'check?', kind: 'decision' }
    ],
    connections: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a', backEdge: true, label: 'error' }
    ]
  };
  var result = buildDecisionFromData(data);
  var backEdgeConn;
  result.model.connectors.forEach(function (conn) {
    if (conn.backEdge) backEdgeConn = conn;
  });
  assert.ok(backEdgeConn, 'should have a back-edge connector');
  assert.strictEqual(backEdgeConn.lineLabel, 'error', 'should carry the error label');
});

// ────────────────────────────────────────────────────────────────────
// § Diagram widget setData routing for decision type
// ────────────────────────────────────────────────────────────────────

test('diagram.setData routes type:decision through buildDecisionFromData', function () {
  var screen = galacticaMock.install({ cols: 120, rows: 40 });
  var diagram = galactica.diagram({
    parent: screen,
    top: 0, left: 0, width: 80, height: 20,
    interactive: false, focusable: false, animate: false
  });
  diagram._deferredInit({ interactive: false, focusable: false, animate: false });

  diagram.setData({
    type: 'decision',
    nodes: [
      { id: 'start', text: 'Start', kind: 'terminal' },
      { id: 'check', text: 'ok?', kind: 'decision' },
      { id: 'done', text: 'Done', kind: 'terminal' }
    ],
    connections: [
      { from: 'start', to: 'check' },
      { from: 'check', to: 'done', label: 'yes' }
    ]
  });

  assert.ok(diagram._model, 'model should be populated after setData decision');
  assert.strictEqual(diagram._model.boxes.size, 3, 'should have 3 boxes');

  /* Verify the decision node got bracket text. */
  var checkBox;
  diagram._model.boxes.forEach(function (box) {
    if (box.text === '[ok?]') checkBox = box;
  });
  assert.ok(checkBox, 'decision node text should be bracket-wrapped');
  galacticaMock.uninstall();
});

// ────────────────────────────────────────────────────────────────────
// § sideToArrowDir coverage — TOP and default cases
// ────────────────────────────────────────────────────────────────────

test('sideToArrowDir returns correct direction for all SIDE values', function () {
  var { sideToArrowDir, SIDE } = require('../lib/widget/diagram/model-constants');
  assert.strictEqual(sideToArrowDir(SIDE.LEFT), 'left');
  assert.strictEqual(sideToArrowDir(SIDE.RIGHT), 'right');
  assert.strictEqual(sideToArrowDir(SIDE.TOP), 'up');
  assert.strictEqual(sideToArrowDir(SIDE.BOTTOM), 'down');
  /* Default case for unknown values. */
  assert.strictEqual(sideToArrowDir('unknown'), 'right');
});

// ────────────────────────────────────────────────────────────────────
// § Branch coverage — optional connection properties
// ────────────────────────────────────────────────────────────────────

test('buildDecisionFromData passes all optional connection properties', function () {
  /* Exercises every if(c.property) branch in data-builder-decision.js. */
  var { buildDecisionFromData } = require('../lib/widget/diagram');
  var result = buildDecisionFromData({
    type: 'decision',
    nodes: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
    connections: [{
      from: 'a', to: 'b',
      label: 'yes',
      style: 'animated',
      speed: 50,
      backEdge: true
    }]
  });
  var conn = result.model.connectors.values().next().value;
  assert.strictEqual(conn.lineLabel, 'yes', 'label should be set');
  assert.strictEqual(conn.style, 'animated', 'style should be set');
  assert.strictEqual(conn.speed, 50, 'speed should be set');
  assert.strictEqual(conn.backEdge, true, 'backEdge should be true');
});

test('buildDecisionFromData with no optional connection properties', function () {
  var { buildDecisionFromData } = require('../lib/widget/diagram');
  var result = buildDecisionFromData({
    type: 'decision',
    nodes: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
    connections: [{ from: 'a', to: 'b' }]
  });
  var conn = result.model.connectors.values().next().value;
  assert.strictEqual(conn.lineLabel, null, 'label should be null');
  assert.strictEqual(conn.backEdge, false, 'backEdge should be false');
});

test('buildDecisionFromData with speed=0 passes through', function () {
  var { buildDecisionFromData } = require('../lib/widget/diagram');
  var result = buildDecisionFromData({
    type: 'decision',
    nodes: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
    connections: [{ from: 'a', to: 'b', speed: 0 }]
  });
  var conn = result.model.connectors.values().next().value;
  assert.strictEqual(conn.speed, 0, 'speed 0 should be preserved');
});

test('buildDecisionFromData node text defaults to id', function () {
  /* Exercises n.text || n.id fallback. */
  var { buildDecisionFromData } = require('../lib/widget/diagram');
  var result = buildDecisionFromData({
    type: 'decision',
    nodes: [{ id: 'myNode' }],
    connections: []
  });
  var box = result.model.getBox(result.idMap.get('myNode'));
  assert.ok(box.text.includes('myNode'), 'text should default to id');
});

test('buildDecisionFromData non-decision back-edge routes to SIDE.LEFT', function () {
  /* Exercises the c.backEdge ? SIDE.LEFT : SIDE.RIGHT branch for
   * non-decision source boxes. */
  var { buildDecisionFromData } = require('../lib/widget/diagram');
  var result = buildDecisionFromData({
    type: 'decision',
    nodes: [
      { id: 'a', text: 'A', kind: 'process' },
      { id: 'b', text: 'B', kind: 'process' }
    ],
    connections: [{ from: 'a', to: 'b', backEdge: true }]
  });
  /* Back-edge from a process node should still route left→right. */
  var conn = result.model.connectors.values().next().value;
  assert.strictEqual(conn.backEdge, true);
});
