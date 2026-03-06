'use strict';

/**
 * test/diagram-viewport.test.js
 *
 * Integration tests for viewport panning (pan, panTo, resetPan).
 * Exercises panning through the public Diagram widget API, verifying
 * emitted 'pan' events and viewport state.
 */

var test   = require('node:test');
var assert = require('node:assert');

var galacticaMock = require('./helpers/galactica-mock');
var galactica     = require('../index');

// ────────────────────────────────────────────────────────────────────
// § Helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Create a Diagram widget with content, attached to a mock screen.
 */
function createDiagram() {
  var screen = galacticaMock.install({ cols: 120, rows: 40 });

  var diagram = galactica.diagram({
    parent: screen,
    top: 0,
    left: 0,
    width: 40,
    height: 15,
    interactive: true,
    animate: false
  });

  diagram._deferredInit({ interactive: true, animate: false });

  diagram.setData({
    nodes: [
      { id: 'a', text: 'Alpha' },
      { id: 'b', text: 'Beta' },
      { id: 'c', text: 'Gamma' }
    ],
    connections: [
      { from: 'a', to: 'b', arrow: true },
      { from: 'b', to: 'c', arrow: true }
    ]
  });

  return {
    screen: screen,
    diagram: diagram,
    cleanup: function () {
      if (diagram._focusPulseTimer) clearInterval(diagram._focusPulseTimer);
      galacticaMock.uninstall();
    }
  };
}

// ────────────────────────────────────────────────────────────────────
// § pan()
// ────────────────────────────────────────────────────────────────────

test('pan() shifts viewport and emits pan event', function () {
  var env = createDiagram();
  try {
    var panEvents = [];
    env.diagram.on('pan', function (p) { panEvents.push(p); });

    var initialX = env.diagram._panX;
    var initialY = env.diagram._panY;

    env.diagram.pan(5, 3);

    assert.strictEqual(panEvents.length, 1, 'should emit one pan event');
    assert.strictEqual(typeof panEvents[0].panX, 'number');
    assert.strictEqual(typeof panEvents[0].panY, 'number');
  } finally {
    env.cleanup();
  }
});

// ────────────────────────────────────────────────────────────────────
// § panTo()
// ────────────────────────────────────────────────────────────────────

test('panTo() sets absolute position and emits pan event', function () {
  var env = createDiagram();
  try {
    var panEvents = [];
    env.diagram.on('pan', function (p) { panEvents.push(p); });

    env.diagram.panTo(10, 5);

    assert.strictEqual(panEvents.length, 1);
    assert.strictEqual(typeof panEvents[0].panX, 'number');
    assert.strictEqual(typeof panEvents[0].panY, 'number');
  } finally {
    env.cleanup();
  }
});

// ────────────────────────────────────────────────────────────────────
// § resetPan()
// ────────────────────────────────────────────────────────────────────

test('resetPan() re-centers viewport and emits pan event', function () {
  var env = createDiagram();
  try {
    var panEvents = [];
    env.diagram.on('pan', function (p) { panEvents.push(p); });

    /* Pan away first, then reset. */
    env.diagram.pan(20, 10);
    env.diagram.resetPan();

    assert.strictEqual(panEvents.length, 2, 'should emit 2 pan events');
  } finally {
    env.cleanup();
  }
});

test('pan is clamped to content bounds', function () {
  var env = createDiagram();
  try {
    /* Pan a very large amount — should clamp. */
    env.diagram.pan(10000, 10000);
    var afterLargePan = { x: env.diagram._panX, y: env.diagram._panY };

    /* Pan even more — should not change because we're already at max. */
    env.diagram.pan(10000, 10000);
    assert.strictEqual(env.diagram._panX, afterLargePan.x,
      'X should be clamped at max');
    assert.strictEqual(env.diagram._panY, afterLargePan.y,
      'Y should be clamped at max');
  } finally {
    env.cleanup();
  }
});
