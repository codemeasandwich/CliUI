'use strict';

/**
 * lib/widget/diagram/model-core.js
 *
 * DiagramModel class definition — constructor, ID generator,
 * and simple getters.  Mutation methods are patched onto the
 * prototype by sibling modules (model-box-mutations, etc.).
 */

/**
 * Top-level container for all diagram entities.
 *
 * Stores boxes, ports, connectors, and labels in Maps keyed by
 * auto-incremented IDs.  Provides a mutation API that maintains
 * referential integrity.
 *
 * @class DiagramModel
 */
class DiagramModel {

  /** @param {number} [width=80]  @param {number} [height=24] */
  constructor(width, height) {
    /** Canvas width (character cells). @type {number} */
    this.width = width || 80;

    /** Canvas height (character cells). @type {number} */
    this.height = height || 24;

    /** All boxes, keyed by box ID. @type {Map<number, DiagramBox>} */
    this.boxes = new Map();

    /** All ports, keyed by port ID. @type {Map<number, Port>} */
    this.ports = new Map();

    /** All connectors, keyed by ID. @type {Map<number, DiagramConnector>} */
    this.connectors = new Map();

    /** All labels, keyed by ID. @type {Map<number, DiagramLabel>} */
    this.labels = new Map();

    /** @private */
    this._nextId = 1;

    /**
     * Opaque text blocks preserved from lenient parsing.
     * @type {Array<{x: number, y: number, text: string}>}
     */
    this.opaqueBlocks = [];
  }

  // ── ID generation ────────────────────────────────────────────

  /** @returns {number} A fresh unique ID. @private */
  _allocId() { return this._nextId++; }

  // ── Simple getters ───────────────────────────────────────────

  /** @param {number} id  @returns {DiagramBox|undefined} */
  getBox(id) { return this.boxes.get(id); }

  /** @param {number} id  @returns {Port|undefined} */
  getPort(id) { return this.ports.get(id); }

  /** @param {number} id  @returns {DiagramConnector|undefined} */
  getConnector(id) { return this.connectors.get(id); }

  /** @param {number} id  @returns {DiagramLabel|undefined} */
  getLabel(id) { return this.labels.get(id); }
}

module.exports = { DiagramModel: DiagramModel };
