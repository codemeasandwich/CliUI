'use strict';

/**
 * lib/widget/diagram/model-box-mutations.js
 *
 * Box CRUD + state mutations patched onto DiagramModel.prototype.
 */

var DiagramModel    = require('./model-core').DiagramModel;
var createBox       = require('./model-entities').createBox;
var BORDER_STYLES   = require('../../border/charsets').BORDER_STYLES;
var BorderStyleError = require('./diagram-errors').BorderStyleError;

/**
 * Add a new box to the model.
 *
 * @param {number}  x       @param {number}  y
 * @param {number}  width   @param {number}  height
 * @param {string}  [text]  @param {Object}  [opts]
 * @returns {DiagramBox}
 */
DiagramModel.prototype.addBox = function addBox(x, y, width, height, text, opts) {
  var o = opts || {};

  /* Validate borderStyle against the canonical style list if provided. */
  if (o.borderStyle && BORDER_STYLES.indexOf(o.borderStyle) === -1) {
    throw new BorderStyleError(o.borderStyle);
  }

  var box = createBox(
    this._allocId(), x, y, width, height, text,
    o.checked, o.currentWork, o.borderStyle, o.status
  );

  /* Apply optional semantic properties not covered by createBox args. */
  if (o.kind)    box.kind    = o.kind;
  if (o.groupId) box.groupId = o.groupId;

  this.boxes.set(box.id, box);
  return box;
};

/**
 * Remove a box and cascade-delete ports, connectors, and labels.
 *
 * @param {number} boxId
 * @returns {boolean}
 */
DiagramModel.prototype.removeBox = function removeBox(boxId) {
  var box = this.boxes.get(boxId);
  if (!box) return false;

  var connectorIdsToRemove = new Set();
  for (var i = 0; i < box.ports.length; i++) {
    var port = box.ports[i];
    for (var j = 0; j < port.connectorIds.length; j++) {
      connectorIdsToRemove.add(port.connectorIds[j]);
    }
  }

  var self = this;
  connectorIdsToRemove.forEach(function (cid) { self.removeConnector(cid); });

  for (var k = 0; k < box.ports.length; k++) {
    this.ports.delete(box.ports[k].id);
  }

  for (var entry of this.labels) {
    var lid = entry[0], label = entry[1];
    if (label.anchorId != null && !this.ports.has(label.anchorId) && !this.connectors.has(label.anchorId)) {
      this.labels.delete(lid);
    }
  }

  this.boxes.delete(boxId);
  return true;
};

/**
 * Move a box by (dx, dy) in grid coordinates.
 *
 * @param {number} boxId  @param {number} dx  @param {number} dy
 * @returns {DiagramBox|null}
 */
DiagramModel.prototype.moveBox = function moveBox(boxId, dx, dy) {
  var box = this.boxes.get(boxId);
  if (!box) return null;
  box.x += dx;
  box.y += dy;
  return box;
};

/**
 * Resize a box.
 *
 * @param {number} boxId  @param {number} width  @param {number} height
 * @returns {DiagramBox|null}
 */
DiagramModel.prototype.resizeBox = function resizeBox(boxId, width, height) {
  var box = this.boxes.get(boxId);
  if (!box) return null;
  box.width = width;
  box.height = height;
  return box;
};

/** Toggle checked state. @param {number} boxId @returns {boolean|null} */
DiagramModel.prototype.toggleChecked = function toggleChecked(boxId) {
  var box = this.boxes.get(boxId);
  if (!box) return null;
  box.checked = !box.checked;
  return box.checked;
};

/** Set current-work flag. @param {number} boxId @param {boolean} flag */
DiagramModel.prototype.setCurrentWork = function setCurrentWork(boxId, flag) {
  var box = this.boxes.get(boxId);
  if (!box) return null;
  box.currentWork = !!flag;
  return box;
};

/**
 * Set the border style for a box.
 * Validates against BORDER_STYLES; throws BorderStyleError on invalid name.
 *
 * @param {number} boxId
 * @param {string|null} style - Named charset or null to reset to default.
 * @returns {import('./model-entities').DiagramBox|null}
 */
DiagramModel.prototype.setBorderStyle = function setBorderStyle(boxId, style) {
  var box = this.boxes.get(boxId);
  if (!box) return null;
  if (style && BORDER_STYLES.indexOf(style) === -1) {
    throw new BorderStyleError(style);
  }
  box.borderStyle = style || null;
  return box;
};

/**
 * Set the status indicator for a box (controls border colour overlay).
 *
 * @param {number} boxId
 * @param {string|null} status - STATUS enum value or null to clear.
 * @returns {import('./model-entities').DiagramBox|null}
 */
DiagramModel.prototype.setStatus = function setStatus(boxId, status) {
  var box = this.boxes.get(boxId);
  if (!box) return null;
  box.status = status || null;
  return box;
};

/** Update box text. @param {number} boxId @param {string} text */
DiagramModel.prototype.setBoxText = function setBoxText(boxId, text) {
  var box = this.boxes.get(boxId);
  if (!box) return null;
  box.text = text;
  return box;
};
