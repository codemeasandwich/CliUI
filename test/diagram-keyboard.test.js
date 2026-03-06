'use strict';

/**
 * test/diagram-keyboard.test.js
 *
 * Integration tests for keyboard navigation.
 * Tests focus cycling, action emission, directional navigation,
 * and focus-pulse lifecycle through the public Diagram widget API.
 *
 * All tests drive through the public interface: setData() to populate
 * the model, blessed key events to trigger navigation, and emitted
 * events (focus:box, action) to observe outcomes.
 */

var test   = require('node:test');
var assert = require('node:assert');

var galacticaMock = require('./helpers/galactica-mock');
var galactica     = require('../index');

// ────────────────────────────────────────────────────────────────────
// § Test helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Create a Diagram widget attached to a mock screen, populated with
 * structured data. Returns { screen, diagram, cleanup }.
 *
 * @param {Object} data - Structured data for setData({ nodes, connections }).
 * @returns {{ screen: Object, diagram: Object, cleanup: Function }}
 */
function createDiagram(data) {
  var screen = galacticaMock.install({ cols: 120, rows: 40 });

  var diagram = galactica.diagram({
    parent: screen,
    top: 0,
    left: 0,
    width: 80,
    height: 20,
    interactive: true,
    focusable: true,
    animate: false
  });

  /*
   * _deferredInit is normally triggered by process.nextTick after
   * attach. Force it synchronously so key handlers are bound
   * before the test body runs.
   */
  diagram._deferredInit({
    focusable: true,
    interactive: true,
    animate: false
  });

  if (data) {
    diagram.setData(data);
  }

  return {
    screen: screen,
    diagram: diagram,
    cleanup: function () {
      /* Stop any timers before cleanup to prevent leaks. */
      if (diagram._focusPulseTimer) {
        clearInterval(diagram._focusPulseTimer);
        diagram._focusPulseTimer = null;
      }
      galacticaMock.uninstall();
    }
  };
}

/**
 * Collect emitted events from a diagram widget.
 *
 * @param {Object} diagram - Diagram widget.
 * @param {string} eventName - Event to capture.
 * @returns {Array} Array that grows as events fire; each entry is the payload.
 */
function collectEvents(diagram, eventName) {
  var events = [];
  diagram.on(eventName, function (payload) {
    events.push(payload);
  });
  return events;
}

/** Three-node linear topology: A → B → C. */
var threeNodeData = {
  nodes: [
    { id: 'a', text: 'A' },
    { id: 'b', text: 'B' },
    { id: 'c', text: 'C' }
  ],
  connections: [
    { from: 'a', to: 'b', arrow: true },
    { from: 'b', to: 'c', arrow: true }
  ]
};

/** Single isolated node. */
var singleNodeData = {
  nodes: [{ id: 'solo', text: 'Solo' }],
  connections: []
};

// ────────────────────────────────────────────────────────────────────
// § Focus cycling via Tab
// ────────────────────────────────────────────────────────────────────

test('Tab key cycles focus forward through boxes', function () {
  var env = createDiagram(threeNodeData);
  try {
    var focusEvents = collectEvents(env.diagram, 'focus:box');

    /* Tab three times to cycle through A, B, C. */
    env.diagram.emit('key tab');
    env.diagram.emit('key tab');
    env.diagram.emit('key tab');

    assert.strictEqual(focusEvents.length, 3, 'should emit 3 focus:box events');

    /* Each event should have a different nodeId. */
    var nodeIds = focusEvents.map(function (e) { return e.nodeId; });
    assert.strictEqual(nodeIds[0], 'a');
    assert.strictEqual(nodeIds[1], 'b');
    assert.strictEqual(nodeIds[2], 'c');

    /* Fourth Tab wraps to first box. */
    env.diagram.emit('key tab');
    assert.strictEqual(focusEvents[3].nodeId, 'a');
  } finally {
    env.cleanup();
  }
});

test('Shift-Tab cycles focus backward', function () {
  var env = createDiagram(threeNodeData);
  try {
    var focusEvents = collectEvents(env.diagram, 'focus:box');

    /* Shift-Tab from no focus should focus last box (C). */
    env.diagram.emit('key S-tab');
    assert.strictEqual(focusEvents.length, 1);
    assert.strictEqual(focusEvents[0].nodeId, 'c');

    /* Another Shift-Tab should go to B. */
    env.diagram.emit('key S-tab');
    assert.strictEqual(focusEvents[1].nodeId, 'b');
  } finally {
    env.cleanup();
  }
});

test('Tab with no model is a no-op', function () {
  var env = createDiagram(null);
  try {
    var focusEvents = collectEvents(env.diagram, 'focus:box');

    env.diagram.emit('key tab');
    assert.strictEqual(focusEvents.length, 0, 'no focus:box event emitted');
  } finally {
    env.cleanup();
  }
});

test('Tab with single box re-focuses the same box', function () {
  var env = createDiagram(singleNodeData);
  try {
    var focusEvents = collectEvents(env.diagram, 'focus:box');

    env.diagram.emit('key tab');
    env.diagram.emit('key tab');

    assert.strictEqual(focusEvents.length, 2);
    assert.strictEqual(focusEvents[0].nodeId, 'solo');
    assert.strictEqual(focusEvents[1].nodeId, 'solo');
  } finally {
    env.cleanup();
  }
});

// ────────────────────────────────────────────────────────────────────
// § Action emission via Enter
// ────────────────────────────────────────────────────────────────────

test('Enter emits action event with boxId and nodeId', function () {
  var env = createDiagram(threeNodeData);
  try {
    var actionEvents = collectEvents(env.diagram, 'action');

    /* Focus first box, then press Enter. */
    env.diagram.emit('key tab');
    env.diagram.emit('key enter');

    assert.strictEqual(actionEvents.length, 1);
    assert.strictEqual(actionEvents[0].nodeId, 'a');
    assert.strictEqual(typeof actionEvents[0].boxId, 'number');
  } finally {
    env.cleanup();
  }
});

test('Enter without focus is a no-op', function () {
  var env = createDiagram(threeNodeData);
  try {
    var actionEvents = collectEvents(env.diagram, 'action');

    env.diagram.emit('key enter');
    assert.strictEqual(actionEvents.length, 0);
  } finally {
    env.cleanup();
  }
});

// ────────────────────────────────────────────────────────────────────
// § Directional focus movement via arrow keys
// ────────────────────────────────────────────────────────────────────

test('Arrow keys move focus to connected box in direction', function () {
  var env = createDiagram(threeNodeData);
  try {
    var focusEvents = collectEvents(env.diagram, 'focus:box');

    /* Focus box A first. */
    env.diagram.emit('key tab');
    assert.strictEqual(focusEvents[0].nodeId, 'a');

    /* Arrow right from A should move to B (connected). */
    env.diagram.emit('key right');
    var lastEvent = focusEvents[focusEvents.length - 1];
    assert.strictEqual(lastEvent.nodeId, 'b', 'right arrow should move to B');
  } finally {
    env.cleanup();
  }
});

test('Arrow key is a no-op when no connection in that direction', function () {
  var env = createDiagram(singleNodeData);
  try {
    var focusEvents = collectEvents(env.diagram, 'focus:box');

    /* Focus the only box. */
    env.diagram.emit('key tab');
    assert.strictEqual(focusEvents.length, 1);
    var focusedBoxId = focusEvents[0].boxId;

    /* Arrow right — no connections, so focus should not change. */
    env.diagram.emit('key right');

    /* focusedBoxId should still be the same (no new focus:box event
     * OR same boxId in the last event). */
    assert.strictEqual(env.diagram._focusedBoxId, focusedBoxId,
      'focus should not change');
  } finally {
    env.cleanup();
  }
});

// ────────────────────────────────────────────────────────────────────
// § Focus pulse timer lifecycle
// ────────────────────────────────────────────────────────────────────

test('Focus pulse timer is created on focus and cleared on stop', function () {
  var env = createDiagram(threeNodeData);
  try {
    /* Before any Tab, no pulse timer should be running. */
    assert.strictEqual(env.diagram._focusPulseTimer, null);

    /* Tab to focus a box — pulse timer should start. */
    env.diagram.emit('key tab');
    assert.ok(env.diagram._focusPulseTimer != null,
      'pulse timer should be set after Tab');

    /* Explicitly stop the pulse — timer should be cleared. */
    env.diagram._stopFocusPulse();
    assert.strictEqual(env.diagram._focusPulseTimer, null,
      'pulse timer should be cleared');
    assert.strictEqual(env.diagram._focusPulseFrame, 0,
      'pulse frame should be reset');
  } finally {
    env.cleanup();
  }
});

test('Focus pulse timer is idempotent — second Tab does not create duplicate', function () {
  var env = createDiagram(threeNodeData);
  try {
    env.diagram.emit('key tab');
    var firstTimer = env.diagram._focusPulseTimer;
    assert.ok(firstTimer != null);

    /* Second Tab changes focus but reuses existing timer. */
    env.diagram.emit('key tab');

    /* The timer reference should be the same (idempotent start). */
    assert.strictEqual(env.diagram._focusPulseTimer, firstTimer,
      'should not create a second timer');
  } finally {
    env.cleanup();
  }
});
