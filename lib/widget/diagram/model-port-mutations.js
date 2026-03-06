'use strict';

/**
 * lib/widget/diagram/model-port-mutations.js
 *
 * Port CRUD patched onto DiagramModel.prototype.
 */

var DiagramModel = require('./model-core').DiagramModel;
var createPort   = require('./model-entities').createPort;

/**
 * Add a port to a box.
 *
 * @param {number} boxId  @param {string} side  @param {number} offset
 * @returns {Port|null}
 */
DiagramModel.prototype.addPort = function addPort(boxId, side, offset) {
  var box = this.boxes.get(boxId);
  if (!box) return null;
  var port = createPort(this._allocId(), boxId, side, offset);
  this.ports.set(port.id, port);
  box.ports.push(port);
  return port;
};

/**
 * Find an existing port on a given box/side/offset, or create one.
 *
 * @param {number} boxId  @param {string} side  @param {number} offset
 * @returns {Port|null}
 */
DiagramModel.prototype.findOrCreatePort = function findOrCreatePort(boxId, side, offset) {
  var box = this.boxes.get(boxId);
  if (!box) return null;

  for (var i = 0; i < box.ports.length; i++) {
    if (box.ports[i].side === side && box.ports[i].offset === offset) {
      return box.ports[i];
    }
  }

  return this.addPort(boxId, side, offset);
};

/**
 * Remove a port and detach all its connectors.
 *
 * @param {number} portId
 * @returns {boolean}
 */
DiagramModel.prototype.removePort = function removePort(portId) {
  var port = this.ports.get(portId);
  if (!port) return false;

  var cids = port.connectorIds.slice();
  for (var i = 0; i < cids.length; i++) {
    this.removeConnector(cids[i]);
  }

  var box = this.boxes.get(port.boxId);
  if (box) {
    var idx = box.ports.indexOf(port);
    if (idx !== -1) box.ports.splice(idx, 1);
  }

  this.ports.delete(portId);
  return true;
};
