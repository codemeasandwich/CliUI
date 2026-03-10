'use strict';

/**
 * test/diagram-mermaid.test.js
 *
 * E2E integration tests for Mermaid Flowchart and StateDiagram
 * parsing and two-way rendering within the Diagram widget.
 *
 * All tests drive through the public widget API (setSource, getSource,
 * getModel) — no internal module imports. Uses galacticaMock to avoid
 * capturing real stdin (which would hang the test runner).
 */

var test = require('node:test');
var assert = require('node:assert');
var galacticaMock = require('./helpers/galactica-mock');
var galactica = require('../index');

/**
 * Create a Diagram widget attached to a mock screen.
 * Returns { screen, diagram, cleanup }.
 */
function createDiagram() {
    var screen = galacticaMock.install({ cols: 120, rows: 40 });
    var diagram = galactica.diagram({
        parent: screen,
        top: 0,
        left: 0,
        width: 100,
        height: 50,
        interactive: false,
        focusable: false,
        animate: false
    });

    /* Force deferred init synchronously so setSource works immediately */
    diagram._deferredInit({
        focusable: false,
        interactive: false,
        animate: false
    });

    return {
        screen: screen,
        diagram: diagram,
        cleanup: function () { galacticaMock.uninstall(); }
    };
}

/* ── Scenario 1: Basic Directed Graph Extraction ─────────────── */
test('Mermaid: basic directed graph produces correct model', function () {
    var env = createDiagram();
    try {
        env.diagram.setSource("graph TD\n  A[Start] --> B[End]");

        var m = env.diagram.getModel();
        var boxesArr = Array.from(m.boxes.values());
        assert.strictEqual(boxesArr.length, 2, 'should produce 2 boxes');
        assert.strictEqual(m.connectors.size, 1, 'should produce 1 connector');

        /* Verify box labels resolved correctly */
        var labels = boxesArr.map(function (b) { return b.text; }).sort();
        assert.deepStrictEqual(labels, ['End', 'Start']);
    } finally {
        env.cleanup();
    }
});

/* ── Scenario 2: Bidirectional and Styled Edges ──────────────── */
test('Mermaid: styled edges parsed correctly', function () {
    var env = createDiagram();
    try {
        env.diagram.setSource("flowchart LR\n A --- B\n C -.- D\n E <--> F");

        var m = env.diagram.getModel();
        assert.strictEqual(m.connectors.size, 3, 'should produce 3 connectors');
    } finally {
        env.cleanup();
    }
});

/* ── Scenario 3: Connection Labels & Two-Way Binding ─────────── */
test('Mermaid: labels survive parse-render round-trip', function () {
    var env = createDiagram();
    try {
        env.diagram.setSource("flowchart LR\n  A -->|Yes| B\n  A -- No --> C");

        var m = env.diagram.getModel();
        assert.strictEqual(m.connectors.size, 2, 'should produce 2 connectors');

        /* Verify getSource() produces Mermaid text containing the labels */
        var output = env.diagram.getSource();
        assert.ok(
            output.indexOf('|Yes|') !== -1,
            'getSource should contain |Yes| label, got: ' + output
        );
        assert.ok(
            output.indexOf('|No|') !== -1,
            'getSource should contain |No| label, got: ' + output
        );

        /* Two-way binding: mutate a label in the model, verify getSource updates */
        var conns = Array.from(m.connectors.values());
        conns[0].lineLabel = 'Maybe';

        var newOutput = env.diagram.getSource();
        assert.ok(
            newOutput.indexOf('Maybe') !== -1,
            'Label mutation should be reflected in getSource'
        );
    } finally {
        env.cleanup();
    }
});

/* ── Scenario 4: State Diagram Parsing & Round-Trip ──────────── */
test('Mermaid: stateDiagram-v2 parses and round-trips', function () {
    var env = createDiagram();
    try {
        env.diagram.setSource("stateDiagram-v2\n  [*] --> First\n  First --> [*]");

        var m = env.diagram.getModel();
        var boxesArr = Array.from(m.boxes.values());
        assert.ok(boxesArr.length >= 2, 'should have at least 2 boxes ([*] and First)');

        var output = env.diagram.getSource();
        assert.ok(
            output.indexOf('stateDiagram-v2') !== -1,
            'getSource should start with stateDiagram-v2, got: ' + output
        );

        /* Verify the original Mermaid IDs are preserved, not numeric */
        assert.ok(
            output.indexOf('[*]') !== -1,
            'getSource should contain [*] pseudo-node, got: ' + output
        );
        assert.ok(
            output.indexOf('First') !== -1,
            'getSource should contain First state, got: ' + output
        );
    } finally {
        env.cleanup();
    }
});

/* ── Scenario 5: Graceful Error Handling ─────────────────────── */
test('Mermaid: malformed input does not crash', function () {
    var env = createDiagram();
    try {
        assert.doesNotThrow(function () {
            env.diagram.setSource("flowchart TD\n BAD LINE SYNTAX");
        }, 'malformed Mermaid should not throw');
    } finally {
        env.cleanup();
    }
});

/* ── Scenario 6: Original IDs preserved in getSource ─────────── */
test('Mermaid: getSource preserves original node IDs, not numeric', function () {
    var env = createDiagram();
    try {
        env.diagram.setSource("flowchart TD\n  Login[Login Page] --> Dashboard[Dashboard]");

        var output = env.diagram.getSource();

        /* The output must use the original IDs "Login" and "Dashboard",
         * not numeric IDs like "1" and "2" */
        assert.ok(
            output.indexOf('Login') !== -1,
            'getSource should preserve original id "Login", got: ' + output
        );
        assert.ok(
            output.indexOf('Dashboard') !== -1,
            'getSource should preserve original id "Dashboard", got: ' + output
        );
    } finally {
        env.cleanup();
    }
});
