'use strict';

/**
 * lib/widget/diagram/model-label-reposition.js
 *
 * Label repositioning methods patched onto DiagramModel.prototype.
 *
 * Extracted from model-box-mutations.js to keep each module within
 * the 200 NCLOC limit. These methods reposition labels that are
 * anchored to ports or connectors when box positions change (drag,
 * layout, reanchor).
 *
 * Domain context:
 *   Labels in diagrams can be anchored to ports (e.g. "Y"/"N" on
 *   decision branches) or connectors (e.g. flow descriptions).
 *   When a box moves or ports reanchor, these labels must track
 *   their anchor's new position to stay visually adjacent.
 */

var DiagramModel = require('./model-core').DiagramModel;
var SIDE         = require('./model-constants').SIDE;

// ────────────────────────────────────────────────────────────────────
// § Move labels with box (drag)
// ────────────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────────────
// § Reposition labels after reanchor
// ────────────────────────────────────────────────────────────────────

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
