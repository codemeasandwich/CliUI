'use strict';

/**
 * lib/widget/diagram/model-box-mutations.js
 *
 * Box CRUD + state mutations patched onto DiagramModel.prototype.
 */

var DiagramModel = require('./model-core').DiagramModel;
var createBox    = require('./model-entities').createBox;
var SIDE         = require('./model-constants').SIDE;

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
  var box = createBox(this._allocId(), x, y, width, height, text, o.checked, o.currentWork);
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
 * Move all labels anchored to ports on a given box.
 *
 * Called during drag so that decision labels (e.g. "Y", "N") travel
 * with the box they annotate rather than staying behind.
 *
 * @param {number} boxId  @param {number} dx  @param {number} dy
 */
DiagramModel.prototype.moveLabelsForBox = function moveLabelsForBox(boxId, dx, dy) {
  var box = this.boxes.get(boxId);
  if (!box) return;

  /* Collect all port IDs belonging to this box. */
  var portIds = new Set();
  for (var i = 0; i < box.ports.length; i++) {
    portIds.add(box.ports[i].id);
  }
  if (portIds.size === 0) return;

  /* Shift every label whose anchorId references one of those ports. */
  this.labels.forEach(function (label) {
    if (label.anchorId != null && portIds.has(label.anchorId)) {
      label.x += dx;
      label.y += dy;
    }
  });
};

/**
 * Reposition labels anchored to ports on (or connected to) a given box.
 *
 * After reanchorPorts() changes port sides/offsets, this method
 * computes each anchored label's absolute position so it stays
 * adjacent to its port's exit cell, on the outward side.
 *
 * @param {number} boxId
 */
DiagramModel.prototype.repositionLabelsForBox = function repositionLabelsForBox(boxId) {
  var self = this;
  var box = self.boxes.get(boxId);
  if (!box) return;

  /* Collect all port IDs affected by this box's connectors. */
  var affectedPortIds = new Set();
  for (var i = 0; i < box.ports.length; i++) {
    var port = box.ports[i];
    affectedPortIds.add(port.id);
    for (var j = 0; j < port.connectorIds.length; j++) {
      var conn = self.connectors.get(port.connectorIds[j]);
      if (conn) {
        affectedPortIds.add(conn.sourcePortId);
        affectedPortIds.add(conn.destPortId);
      }
    }
  }

  /* Collect affected connector IDs. */
  var affectedConnIds = new Set();
  for (var ai = 0; ai < box.ports.length; ai++) {
    var aport = box.ports[ai];
    for (var aj = 0; aj < aport.connectorIds.length; aj++) {
      affectedConnIds.add(aport.connectorIds[aj]);
    }
  }

  /* ── Connector-anchored labels ─────────────────────────────── */
  /* Group labels by connector so multiple labels on the same line
     can be laid out sequentially rather than overlapping. */
  var connLabels = {};   /* connId → [label, …] sorted by id */
  self.labels.forEach(function (label) {
    if (label.anchorId == null) return;
    if (!self.connectors.has(label.anchorId)) return;
    if (!affectedConnIds.has(label.anchorId)) return;
    var cid = label.anchorId;
    if (!connLabels[cid]) connLabels[cid] = [];
    connLabels[cid].push(label);
  });

  for (var cid in connLabels) {
    var conn = self.connectors.get(Number(cid));
    if (!conn || conn.segments.length === 0) continue;

    /* Find the longest segment. */
    var bestSeg = conn.segments[0];
    var bestLen = 0;
    for (var si = 0; si < conn.segments.length; si++) {
      var seg = conn.segments[si];
      var slen = Math.abs(seg.x2 - seg.x1) + Math.abs(seg.y2 - seg.y1);
      if (slen > bestLen) { bestLen = slen; bestSeg = seg; }
    }

    var isHorizontal = (bestSeg.y1 === bestSeg.y2);
    var labels = connLabels[cid];
    labels.sort(function (a, b) { return a.id - b.id; });

    /* Total text run length (all labels + 1-char gap between). */
    var totalLen = 0;
    for (var li = 0; li < labels.length; li++) {
      totalLen += labels[li].text.length;
    }
    totalLen += labels.length - 1; /* gaps */

    if (isHorizontal) {
      /* Horizontal segment → labels sit 1 row above, centred. */
      var mx = Math.round((bestSeg.x1 + bestSeg.x2) / 2);
      var startX = mx - Math.floor(totalLen / 2);
      for (var hi = 0; hi < labels.length; hi++) {
        labels[hi].x = startX;
        labels[hi].y = bestSeg.y1 - 1;
        startX += labels[hi].text.length + 1;
      }
    } else {
      /* Vertical segment → labels sit 1 col to the right, stacked. */
      var my = Math.round((bestSeg.y1 + bestSeg.y2) / 2);
      var startY = my - Math.floor(labels.length / 2);
      for (var vi = 0; vi < labels.length; vi++) {
        labels[vi].x = bestSeg.x1 + 1;
        labels[vi].y = startY + vi;
      }
    }
  }

  /* ── Port-anchored labels ──────────────────────────────────── */
  self.labels.forEach(function (label) {
    if (label.anchorId == null) return;
    if (!affectedPortIds.has(label.anchorId)) return;

    var p = self.ports.get(label.anchorId);
    if (!p) return;

    var pos = self.getPortPosition(label.anchorId);
    if (!pos) return;

    /* Exit cell: one step outward from the port on the box border. */
    var ex = pos.x, ey = pos.y;
    switch (p.side) {
      case SIDE.TOP:    ey -= 1; break;
      case SIDE.BOTTOM: ey += 1; break;
      case SIDE.LEFT:   ex -= 1; break;
      case SIDE.RIGHT:  ex += 1; break;
    }

    /*
     * Place label *perpendicular* to the connector direction so the
     * line leaving the exit cell doesn't cover it.
     *
     *   TOP / BOTTOM exits (vertical line):
     *     label sits to the right of the exit cell, same row.
     *   LEFT / RIGHT exits (horizontal line):
     *     label sits above the exit cell, centred horizontally.
     */
    var halfLen = Math.floor(label.text.length / 2);
    switch (p.side) {
      case SIDE.TOP:
      case SIDE.BOTTOM:
        /* Vertical connector — place label to the right. */
        label.x = ex + 1;
        label.y = ey;
        break;
      case SIDE.LEFT:
      case SIDE.RIGHT:
        /* Horizontal connector — place label above. */
        label.x = ex - halfLen;
        label.y = ey - 1;
        break;
    }
  });
};

/** Update box text. @param {number} boxId @param {string} text */
DiagramModel.prototype.setBoxText = function setBoxText(boxId, text) {
  var box = this.boxes.get(boxId);
  if (!box) return null;
  box.text = text;
  return box;
};
