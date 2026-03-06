'use strict';

/**
 * lib/widget/diagram/model-entities.js
 *
 * Factory functions for the four diagram entity types.
 * Each returns a plain JSON-serialisable object (no prototype overhead).
 */

// ── Port ─────────────────────────────────────────────────────────

/**
 * @typedef {Object} Port
 * @property {number}   id           - Unique port ID.
 * @property {number}   boxId        - Owning box ID.
 * @property {string}   side         - SIDE value.
 * @property {number}   offset       - 0-based interior offset.
 * @property {number[]} connectorIds - Attached connector IDs.
 */

/** @returns {Port} */
function createPort(id, boxId, side, offset) {
  return { id: id, boxId: boxId, side: side, offset: offset, connectorIds: [] };
}

// ── DiagramBox ───────────────────────────────────────────────────

/**
 * @typedef {Object} DiagramBox
 * @property {number}  id          - Unique box ID.
 * @property {number}  x           - Left column (0-based grid).
 * @property {number}  y           - Top row (0-based grid).
 * @property {number}  width       - Total columns including borders.
 * @property {number}  height      - Total rows including borders.
 * @property {string}  text        - Raw content text.
 * @property {boolean}     checked     - ✔ marker shown.
 * @property {boolean}     currentWork - Dashed animated border.
 * @property {string|null} borderStyle - Named charset (e.g. 'heavy', 'double') or null for default.
 * @property {string|null} status      - STATUS enum value for colour overlay, or null.
 * @property {Port[]}      ports       - Connection points on edges.
 */

/** @returns {DiagramBox} */
function createBox(id, x, y, width, height, text, checked, currentWork, borderStyle, status) {
  return {
    id: id, x: x, y: y,
    width: width, height: height,
    text: text || '', checked: !!checked, currentWork: !!currentWork,
    borderStyle: borderStyle || null,
    status: status || null,
    ports: []
  };
}

// ── DiagramConnector ─────────────────────────────────────────────

/**
 * @typedef {Object} Segment
 * @property {number} x1  @property {number} y1
 * @property {number} x2  @property {number} y2
 */

/**
 * @typedef {Object} DiagramConnector
 * @property {number}       id             - Unique connector ID.
 * @property {number}       sourcePortId   - Departure port.
 * @property {number}       destPortId     - Arrival port.
 * @property {Segment[]}    segments       - Routed path segments.
 * @property {string|null}  arrowDir       - Target-entry arrow direction or null.
 * @property {string|null}  sourceArrowDir - Source-exit arrow direction or null.
 *   Added only when the connector has multiple segments separated by
 *   bends, so the source arrow lives on its own leg and does not
 *   visually compete with the target arrow.
 * @property {string|null}  lineLabel      - Text on a segment.
 * @property {Object[]}     endpointLabels - Labels near branch exits.
 * @property {string|null}  style          - CONN_STYLE enum for animation.
 * @property {string|null}  marker         - Custom marker character.
 * @property {string|null}  head           - Custom arrowhead character.
 * @property {number|null}  speed          - Animation tick interval in ms.
 * @property {number|null}  weight         - Line weight / thickness hint.
 * @property {boolean}      bidirectional  - Arrows at both ends.
 */

/** @returns {DiagramConnector} */
function createConnector(id, sourcePortId, destPortId, arrowDir) {
  return {
    id: id, sourcePortId: sourcePortId, destPortId: destPortId,
    segments: [], arrowDir: arrowDir || null, sourceArrowDir: null,
    lineLabel: null, endpointLabels: [],
    style: null, marker: null, head: null,
    speed: null, weight: null, bidirectional: false
  };
}

// ── DiagramLabel ─────────────────────────────────────────────────

/**
 * @typedef {Object} DiagramLabel
 * @property {number}      id       - Unique label ID.
 * @property {string}      type     - LABEL_TYPE value.
 * @property {string}      text     - Display text.
 * @property {number}      x        - Column.
 * @property {number}      y        - Row.
 * @property {number|null} anchorId - Related connector or port.
 */

/** @returns {DiagramLabel} */
function createLabel(id, type, text, x, y, anchorId) {
  return {
    id: id, type: type, text: text, x: x, y: y,
    anchorId: anchorId != null ? anchorId : null
  };
}

// ── Exports ──────────────────────────────────────────────────────

module.exports = {
  createPort:      createPort,
  createBox:       createBox,
  createConnector: createConnector,
  createLabel:     createLabel
};
