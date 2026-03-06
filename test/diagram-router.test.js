'use strict';

/**
 * test/diagram-router.test.js
 *
 * Unit tests for the A* orthogonal router.
 *
 * Tests cover:
 *   • A* pathfinding between two points on an empty grid
 *   • Path-to-segments conversion
 *   • Obstacle avoidance (box in the way)
 *   • routeAll on a model with connectors
 *   • MinHeap correctness
 */

const test   = require('node:test');
const assert = require('node:assert');

const {
  astarFind,
  pathToSegments,
  routeAll,
  simpleLPath,
  isCollinear,
  MinHeap
} = require('../lib/widget/diagram/diagram-router');
const { OccupancyGrid, CELL_TYPE }    = require('../lib/widget/diagram/occupancy-grid');
const { DiagramModel, SIDE }
  = require('../lib/widget/diagram/diagram-model');

// ────────────────────────────────────────────────────────────────────
// § MinHeap tests
// ────────────────────────────────────────────────────────────────────

test('MinHeap — basic ordering', function () {
  const heap = new MinHeap();
  heap.push({ f: 5 });
  heap.push({ f: 1 });
  heap.push({ f: 3 });

  assert.strictEqual(heap.pop().f, 1);
  assert.strictEqual(heap.pop().f, 3);
  assert.strictEqual(heap.pop().f, 5);
  assert.strictEqual(heap.size, 0);
});

test('MinHeap — empty pop returns undefined', function () {
  const heap = new MinHeap();
  assert.strictEqual(heap.pop(), undefined);
});

// ────────────────────────────────────────────────────────────────────
// § A* tests
// ────────────────────────────────────────────────────────────────────

test('astarFind — straight path on empty grid', function () {
  const grid = new OccupancyGrid(20, 5);
  const path = astarFind(0, 2, 10, 2, grid);

  assert.ok(path, 'should find a path');
  assert.strictEqual(path[0].x, 0);
  assert.strictEqual(path[0].y, 2);
  assert.strictEqual(path[path.length - 1].x, 10);
  assert.strictEqual(path[path.length - 1].y, 2);
});

test('astarFind — avoids obstacle', function () {
  const grid = new OccupancyGrid(20, 10);

  /* Place a wall across row 4 from columns 3-7. */
  for (let x = 3; x <= 7; x++) {
    grid.set(x, 4, CELL_TYPE.BORDER, -1);
  }

  const path = astarFind(5, 2, 5, 7, grid);

  assert.ok(path, 'should find a path around the wall');

  /* Verify path doesn't pass through the wall. */
  for (const cell of path) {
    if (cell.y === 4 && cell.x >= 3 && cell.x <= 7) {
      assert.fail('path should not pass through the wall');
    }
  }
});

test('astarFind — returns null when no path exists', function () {
  const grid = new OccupancyGrid(10, 10);

  /* Completely surround destination (5,5) with walls. */
  for (let x = 4; x <= 6; x++) {
    grid.set(x, 4, CELL_TYPE.BORDER, -1);
    grid.set(x, 6, CELL_TYPE.BORDER, -1);
  }
  grid.set(4, 5, CELL_TYPE.BORDER, -1);
  grid.set(6, 5, CELL_TYPE.BORDER, -1);

  const path = astarFind(0, 0, 5, 5, grid);
  assert.strictEqual(path, null, 'should return null when no path exists');
});

// ────────────────────────────────────────────────────────────────────
// § pathToSegments
// ────────────────────────────────────────────────────────────────────

test('pathToSegments — straight line', function () {
  const path = [
    { x: 0, y: 2 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
    { x: 3, y: 2 }
  ];
  const segs = pathToSegments(path);
  assert.strictEqual(segs.length, 1);
  assert.deepStrictEqual(segs[0], { x1: 0, y1: 2, x2: 3, y2: 2 });
});

test('pathToSegments — L-shaped path', function () {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
    { x: 2, y: 2 }
  ];
  const segs = pathToSegments(path);
  assert.strictEqual(segs.length, 2, 'should produce 2 segments for L-shape');
  assert.deepStrictEqual(segs[0], { x1: 0, y1: 0, x2: 2, y2: 0 });
  assert.deepStrictEqual(segs[1], { x1: 2, y1: 0, x2: 2, y2: 2 });
});

// ────────────────────────────────────────────────────────────────────
// § simpleLPath
// ────────────────────────────────────────────────────────────────────

test('simpleLPath — basic', function () {
  const path = simpleLPath({ x: 0, y: 0 }, { x: 3, y: 2 });
  assert.ok(path.length > 0);
  assert.strictEqual(path[path.length - 1].x, 3);
  assert.strictEqual(path[path.length - 1].y, 2);
});

// ────────────────────────────────────────────────────────────────────
// § isCollinear
// ────────────────────────────────────────────────────────────────────

test('isCollinear — same row', function () {
  assert.ok(isCollinear({ x: 0, y: 1 }, { x: 5, y: 1 }, { x: 10, y: 1 }));
});

test('isCollinear — different rows and cols', function () {
  assert.ok(!isCollinear({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }));
});

// ────────────────────────────────────────────────────────────────────
// § routeAll
// ────────────────────────────────────────────────────────────────────

test('routeAll — routes connector in a two-box model', function () {
  const m = new DiagramModel(40, 10);
  const a = m.addBox(0, 0, 8, 3, 'A');
  const b = m.addBox(20, 0, 8, 3, 'B');

  const pA = m.addPort(a.id, SIDE.RIGHT, 1);
  const pB = m.addPort(b.id, SIDE.LEFT, 1);
  m.addConnector(pA.id, pB.id);

  const grid = routeAll(m);
  assert.ok(grid, 'should return an occupancy grid');

  const conn = Array.from(m.connectors.values())[0];
  assert.ok(conn.segments.length > 0, 'connector should have routed segments');
});
