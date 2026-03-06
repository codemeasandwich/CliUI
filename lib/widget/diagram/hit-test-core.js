'use strict';
// @esm-group Widgets

/**
 * lib/widget/diagram/hit-test-core.js
 *
 * Core hit-test logic: HIT_KIND constants, the main hitTest() point
 * query, and internal helpers (findPortAt, findGatePortAt).
 */

var CELL_TYPE = require('./occupancy-grid').CELL_TYPE;

// ────────────────────────────────────────────────────────────────────
// § Hit result kind constants
// ────────────────────────────────────────────────────────────────────

/**
 * Readable constants for hit result kinds.
 *
 * @readonly
 * @enum {string}
 */
var HIT_KIND = Object.freeze({
  /** Click landed inside a box's text area. */
  BOX_INTERIOR: 'box-interior',
  /** Click landed on a box's border line. */
  BOX_BORDER:   'box-border',
  /** Click landed on a gate character (╢). */
  GATE:         'gate',
  /** Click landed on a port marker on a box border. */
  PORT:         'port',
  /** Click landed on a connector segment. */
  CONNECTOR:    'connector',
  /** Click landed on a junction where connectors cross. */
  JUNCTION:     'junction',
  /** Click landed on an arrowhead character. */
  ARROW:        'arrow',
  /** Click landed on a text label. */
  LABEL:        'label',
  /** Click landed on empty space. */
  EMPTY:        'empty'
});

// ────────────────────────────────────────────────────────────────────
// § Internal helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Find a port at the given screen position belonging to a specific box.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} boxId - Owner box ID.
 * @param {import('./diagram-model').DiagramModel} model
 * @returns {{ id: number, isGate: boolean }|null}
 * @private
 */
function findPortAt(x, y, boxId, model) {
  for (var entry of model.ports) {
    var port = entry[1];
    if (port.boxId !== boxId) continue;

    var pos = model.getPortPosition(port.id);
    if (!pos) continue;
    if (pos.x === x && pos.y === y) {
      return { id: port.id, isGate: !!port.isGate };
    }
  }
  return null;
}

/**
 * Find the port ID of a gate at the given position.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} boxId - Owner box ID.
 * @param {import('./diagram-model').DiagramModel} model
 * @returns {number|null}
 * @private
 */
function findGatePortAt(x, y, boxId, model) {
  var port = findPortAt(x, y, boxId, model);
  return port ? port.id : null;
}

// ────────────────────────────────────────────────────────────────────
// § Hit-test function
// ────────────────────────────────────────────────────────────────────

/**
 * Perform a hit-test at the given diagram-space coordinates.
 *
 * @param {number} x - Column in diagram space (0-based).
 * @param {number} y - Row in diagram space (0-based).
 * @param {import('./occupancy-grid').OccupancyGrid} grid
 * @param {import('./diagram-model').DiagramModel} model
 * @returns {HitResult}
 */
function hitTest(x, y, grid, model) {
  var cell = grid.query(x, y);

  /* Out-of-bounds or empty cell. */
  if (!cell || cell.type === CELL_TYPE.EMPTY) {
    return { kind: HIT_KIND.EMPTY, id: null, portId: null, x: x, y: y };
  }

  switch (cell.type) {
    case CELL_TYPE.BORDER: {
      var portHit = findPortAt(x, y, cell.ownerId, model);
      if (portHit) {
        if (portHit.isGate) {
          return { kind: HIT_KIND.GATE, id: cell.ownerId, portId: portHit.id, x: x, y: y };
        }
        return { kind: HIT_KIND.PORT, id: cell.ownerId, portId: portHit.id, x: x, y: y };
      }
      return { kind: HIT_KIND.BOX_BORDER, id: cell.ownerId, portId: null, x: x, y: y };
    }

    case CELL_TYPE.CONTENT:
      return { kind: HIT_KIND.BOX_INTERIOR, id: cell.ownerId, portId: null, x: x, y: y };

    case CELL_TYPE.CONNECTOR:
      return { kind: HIT_KIND.CONNECTOR, id: cell.ownerId, portId: null, x: x, y: y };

    case CELL_TYPE.JUNCTION:
      return { kind: HIT_KIND.JUNCTION, id: cell.ownerId, portId: null, x: x, y: y };

    case CELL_TYPE.ARROW:
      return { kind: HIT_KIND.ARROW, id: cell.ownerId, portId: null, x: x, y: y };

    case CELL_TYPE.GATE:
      return { kind: HIT_KIND.GATE, id: cell.ownerId, portId: findGatePortAt(x, y, cell.ownerId, model), x: x, y: y };

    case CELL_TYPE.PORT: {
      var pHit = findPortAt(x, y, cell.ownerId, model);
      return { kind: HIT_KIND.PORT, id: cell.ownerId, portId: pHit ? pHit.id : null, x: x, y: y };
    }

    case CELL_TYPE.LABEL:
      return { kind: HIT_KIND.LABEL, id: cell.ownerId, portId: null, x: x, y: y };

    default:
      return { kind: HIT_KIND.EMPTY, id: null, portId: null, x: x, y: y };
  }
}

// ────────────────────────────────────────────────────────────────────
// § HitResult type definition (for JSDoc)
// ────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} HitResult
 * @property {string}      kind   - One of HIT_KIND values.
 * @property {number|null} id     - Entity ID (box, connector, or label).
 * @property {number|null} portId - Port ID when the hit is a gate/port.
 * @property {number}      x      - Queried x coordinate.
 * @property {number}      y      - Queried y coordinate.
 */

// ────────────────────────────────────────────────────────────────────
// § Exports
// ────────────────────────────────────────────────────────────────────

module.exports = {
  hitTest:        hitTest,
  findPortAt:     findPortAt,
  findGatePortAt: findGatePortAt,
  HIT_KIND:       HIT_KIND
};
