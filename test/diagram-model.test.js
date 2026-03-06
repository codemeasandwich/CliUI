'use strict';

/**
 * test/diagram-model.test.js
 *
 * Unit tests for the DiagramModel — the pure-data backbone of the
 * Diegetic diagram editor.
 *
 * Tests cover:
 *   • Entity creation (box, port, connector, label)
 *   • Mutation API (move, resize, toggle, current-work)
 *   • Query API (getBox, getPort, getPortPosition, getConnectorsForBox)
 *   • Serialization round-trip (toJSON / fromJSON)
 *   • Clone independence
 */

const test   = require('node:test');
const assert = require('node:assert');

const {
  DiagramModel,
  SIDE,
  BOX_STATE,
  LABEL_TYPE
} = require('../lib/widget/diagram/diagram-model');

// ────────────────────────────────────────────────────────────────────
// § Helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Create a minimal model with two boxes and a connector between them.
 *
 * @returns {DiagramModel}
 */
function twoBoxModel() {
  const m = new DiagramModel(60, 20);

  const boxA = m.addBox(0, 0, 10, 3, 'A');
  const boxB = m.addBox(20, 0, 10, 3, 'B');

  const pA = m.addPort(boxA.id, SIDE.RIGHT, 1);
  const pB = m.addPort(boxB.id, SIDE.LEFT, 1);

  m.addConnector(pA.id, pB.id);

  return m;
}

// ────────────────────────────────────────────────────────────────────
// § Tests
// ────────────────────────────────────────────────────────────────────

test('DiagramModel — create boxes', function () {
  const m = new DiagramModel(80, 24);
  const box = m.addBox(1, 2, 12, 5, 'Hello');

  assert.ok(box.id > 0, 'box should have a positive ID');
  assert.strictEqual(box.text, 'Hello');
  assert.strictEqual(m.boxes.size, 1);
});

test('DiagramModel — move and resize box', function () {
  const m = new DiagramModel(80, 24);
  const box = m.addBox(0, 0, 10, 3, 'X');

  m.moveBox(box.id, 5, 7);
  assert.strictEqual(m.getBox(box.id).x, 5);
  assert.strictEqual(m.getBox(box.id).y, 7);

  m.resizeBox(box.id, 20, 6);
  assert.strictEqual(m.getBox(box.id).width, 20);
  assert.strictEqual(m.getBox(box.id).height, 6);
});

test('DiagramModel — toggle checked', function () {
  const m = new DiagramModel(40, 10);
  const box = m.addBox(0, 0, 10, 3, 'Task');

  assert.strictEqual(box.checked, false);
  m.toggleChecked(box.id);
  assert.strictEqual(m.getBox(box.id).checked, true);
  m.toggleChecked(box.id);
  assert.strictEqual(m.getBox(box.id).checked, false);
});

test('DiagramModel — current-work state', function () {
  const m = new DiagramModel(40, 10);
  const box = m.addBox(0, 0, 10, 3, 'Build');

  m.setCurrentWork(box.id, true);
  assert.strictEqual(m.getBox(box.id).currentWork, true);

  m.setCurrentWork(box.id, false);
  assert.strictEqual(m.getBox(box.id).currentWork, false);
});

test('DiagramModel — ports and position', function () {
  const m = new DiagramModel(40, 10);
  const box = m.addBox(2, 3, 10, 5, 'Box');
  const port = m.addPort(box.id, SIDE.RIGHT, 2);

  const pos = m.getPortPosition(port.id);
  assert.ok(pos, 'port position should not be null');

  /* Right side: x = box.x + box.width - 1, y = box.y + 1 + offset */
  assert.strictEqual(pos.x, 2 + 10 - 1);
  assert.strictEqual(pos.y, 3 + 1 + 2);
});

test('DiagramModel — connector and getConnectorsForBox', function () {
  const m = twoBoxModel();

  const connectors = m.getConnectorsForBox(Array.from(m.boxes.keys())[0]);
  assert.strictEqual(connectors.length, 1, 'box A should have 1 connector');
});

test('DiagramModel — remove connector', function () {
  const m = twoBoxModel();
  const connId = Array.from(m.connectors.keys())[0];

  m.removeConnector(connId);
  assert.strictEqual(m.connectors.size, 0);
});

test('DiagramModel — remove box cascades', function () {
  const m = twoBoxModel();
  const boxAId = Array.from(m.boxes.keys())[0];

  m.removeBox(boxAId);
  assert.strictEqual(m.boxes.size, 1);
  /* Ports and connectors referencing box A should be gone. */
  assert.strictEqual(m.connectors.size, 0);
});

test('DiagramModel — serialization round-trip', function () {
  const m = twoBoxModel();
  const json = m.toJSON();
  const m2 = DiagramModel.fromJSON(json);

  assert.strictEqual(m2.boxes.size, m.boxes.size);
  assert.strictEqual(m2.connectors.size, m.connectors.size);
  assert.strictEqual(m2.ports.size, m.ports.size);
  assert.strictEqual(m2.width, m.width);
  assert.strictEqual(m2.height, m.height);
});

test('DiagramModel — clone independence', function () {
  const m = twoBoxModel();
  const clone = m.clone();

  /* Mutate the clone. */
  const boxId = Array.from(clone.boxes.keys())[0];
  clone.moveBox(boxId, 99, 99);

  /* Original should be unaffected. */
  const origBox = m.getBox(Array.from(m.boxes.keys())[0]);
  assert.notStrictEqual(origBox.x, 99);
});

test('DiagramModel — labels', function () {
  const m = new DiagramModel(40, 10);
  const label = m.addLabel(LABEL_TYPE.STANDALONE, 'test label', 5, 3);

  assert.ok(label.id > 0);
  assert.strictEqual(m.labels.size, 1);
});

test('DiagramModel — findOrCreatePort reuses existing', function () {
  const m = new DiagramModel(40, 10);
  const box = m.addBox(0, 0, 10, 3, 'X');
  const p1 = m.findOrCreatePort(box.id, SIDE.TOP, 3);
  const p2 = m.findOrCreatePort(box.id, SIDE.TOP, 3);

  assert.strictEqual(p1.id, p2.id, 'should return same port for same position');
  assert.strictEqual(m.ports.size, 1);
});
