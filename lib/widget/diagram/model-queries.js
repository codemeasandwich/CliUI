'use strict';

/**
 * lib/widget/diagram/model-queries.js
 *
 * Complex query methods patched onto DiagramModel.prototype.
 */

var SIDE            = require('./model-constants').SIDE;
var DiagramModel    = require('./model-core').DiagramModel;

/**
 * Return all connectors attached to a given box.
 *
 * @param {number} boxId
 * @returns {DiagramConnector[]}
 */
DiagramModel.prototype.getConnectorsForBox = function getConnectorsForBox(boxId) {
  var box = this.boxes.get(boxId);
  if (!box) return [];

  var seen = new Set();
  var result = [];
  for (var i = 0; i < box.ports.length; i++) {
    var port = box.ports[i];
    for (var j = 0; j < port.connectorIds.length; j++) {
      var cid = port.connectorIds[j];
      if (!seen.has(cid)) {
        seen.add(cid);
        var conn = this.connectors.get(cid);
        if (conn) result.push(conn);
      }
    }
  }
  return result;
};

/**
 * Compute the absolute grid coordinate where a port sits.
 *
 * The coordinate is on the **border** of the box, not inside it.
 *
 * @param {number} portId
 * @returns {{ x: number, y: number } | null}
 */
DiagramModel.prototype.getPortPosition = function getPortPosition(portId) {
  var port = this.ports.get(portId);
  if (!port) return null;

  var box = this.boxes.get(port.boxId);
  if (!box) return null;

  /*
   * Port offset is 0-based along the interior of a side.
   *   TOP:    row = box.y,               col = box.x + 1 + offset
   *   BOTTOM: row = box.y + height - 1,  col = box.x + 1 + offset
   *   LEFT:   row = box.y + 1 + offset,  col = box.x
   *   RIGHT:  row = box.y + 1 + offset,  col = box.x + width - 1
   */
  switch (port.side) {
    case SIDE.TOP:
      return { x: box.x + 1 + port.offset, y: box.y };
    case SIDE.BOTTOM:
      return { x: box.x + 1 + port.offset, y: box.y + box.height - 1 };
    case SIDE.LEFT:
      return { x: box.x, y: box.y + 1 + port.offset };
    case SIDE.RIGHT:
      return { x: box.x + box.width - 1, y: box.y + 1 + port.offset };
    default:
      return null;
  }
};
