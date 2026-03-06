'use strict';

/**
 * lib/widget/diagram/model-conn-mutations.js
 *
 * Connector, endpoint-label, and standalone-label mutations
 * patched onto DiagramModel.prototype.
 */

var DiagramModel    = require('./model-core').DiagramModel;
var createConnector = require('./model-entities').createConnector;
var createLabel     = require('./model-entities').createLabel;

/**
 * Add a connector between two existing ports.
 *
 * @param {number}      sourcePortId  @param {number}      destPortId
 * @param {string|null} [arrowDir]
 * @returns {DiagramConnector|null}
 */
DiagramModel.prototype.addConnector = function addConnector(sourcePortId, destPortId, arrowDir) {
  var src = this.ports.get(sourcePortId);
  var dst = this.ports.get(destPortId);
  if (!src || !dst) return null;

  var conn = createConnector(this._allocId(), sourcePortId, destPortId, arrowDir);
  this.connectors.set(conn.id, conn);
  src.connectorIds.push(conn.id);
  dst.connectorIds.push(conn.id);
  return conn;
};

/**
 * Remove a connector and clean up port references and labels.
 *
 * @param {number} connectorId
 * @returns {boolean}
 */
DiagramModel.prototype.removeConnector = function removeConnector(connectorId) {
  var conn = this.connectors.get(connectorId);
  if (!conn) return false;

  var src = this.ports.get(conn.sourcePortId);
  if (src) {
    var i = src.connectorIds.indexOf(connectorId);
    if (i !== -1) src.connectorIds.splice(i, 1);
  }

  var dst = this.ports.get(conn.destPortId);
  if (dst) {
    var j = dst.connectorIds.indexOf(connectorId);
    if (j !== -1) dst.connectorIds.splice(j, 1);
  }

  for (var entry of this.labels) {
    if (entry[1].anchorId === connectorId) this.labels.delete(entry[0]);
  }

  this.connectors.delete(connectorId);
  return true;
};

/**
 * Set the routed path segments of a connector.
 *
 * @param {number}    connectorId  @param {Segment[]} segments
 * @returns {DiagramConnector|null}
 */
DiagramModel.prototype.setConnectorSegments = function setConnectorSegments(connectorId, segments) {
  var conn = this.connectors.get(connectorId);
  if (!conn) return null;
  conn.segments = segments;
  return conn;
};

/**
 * Set or clear a line label on a connector.
 *
 * @param {number} connectorId  @param {string|null} text
 * @returns {DiagramConnector|null}
 */
DiagramModel.prototype.setLineLabel = function setLineLabel(connectorId, text) {
  var conn = this.connectors.get(connectorId);
  if (!conn) return null;
  conn.lineLabel = text || null;
  return conn;
};

/**
 * Add an endpoint label to a connector.
 *
 * @param {number} connectorId  @param {string} text
 * @param {string} [end='dest']
 * @returns {DiagramConnector|null}
 */
DiagramModel.prototype.addEndpointLabel = function addEndpointLabel(connectorId, text, end) {
  var conn = this.connectors.get(connectorId);
  if (!conn) return null;
  conn.endpointLabels.push({ text: text, end: end || 'dest' });
  return conn;
};

/**
 * Add a standalone label to the diagram.
 *
 * @param {string} type  @param {string} text
 * @param {number} x     @param {number} y
 * @param {number|null} [anchorId]
 * @returns {DiagramLabel}
 */
DiagramModel.prototype.addLabel = function addLabel(type, text, x, y, anchorId) {
  var label = createLabel(this._allocId(), type, text, x, y, anchorId);
  this.labels.set(label.id, label);
  return label;
};

/** Remove a label by ID. @param {number} labelId @returns {boolean} */
DiagramModel.prototype.removeLabel = function removeLabel(labelId) {
  return this.labels.delete(labelId);
};
