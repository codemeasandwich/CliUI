'use strict';

/**
 * lib/widget/diagram/model-reanchor.js
 *
 * Dynamic port re-anchoring — picks the box side facing the
 * connected box, centres the port on that edge, and spreads
 * apart ports that face opposite directions on the same side.
 */

var SIDE         = require('./model-constants').SIDE;
var DiagramModel = require('./model-core').DiagramModel;

/** Destination-port side → arrowhead direction pointing INTO the box. */
var SIDE_TO_ARROW = {};
SIDE_TO_ARROW[SIDE.TOP]    = 'down';
SIDE_TO_ARROW[SIDE.BOTTOM] = 'up';
SIDE_TO_ARROW[SIDE.LEFT]   = 'right';
SIDE_TO_ARROW[SIDE.RIGHT]  = 'left';

/** Interior length of a box side (excludes the two corner cells). */
function interiorLen(box, side) {
  return (side === SIDE.TOP || side === SIDE.BOTTOM)
    ? box.width  - 2
    : box.height - 2;
}

/** Centre offset along a side's interior. */
function centreOffset(box, side) {
  return Math.max(0, Math.floor((interiorLen(box, side) - 1) / 2));
}

/**
 * Re-anchor ports on connectors touching `boxId` (or all connectors)
 * so each port exits from the side facing the connected box, centred.
 *
 * After choosing sides, a second pass detects ports that share a
 * (box, side) but have opposite flow directions (one outgoing, one
 * incoming).  Those ports are spread apart so the connectors don't
 * overlap; same-direction ports may share the same offset.
 *
 * @param {number} [boxId] - Limit to connectors touching this box.
 */
DiagramModel.prototype.reanchorPorts = function reanchorPorts(boxId) {
  var self = this;
  var conns;
  if (boxId != null) {
    conns = [];
    var box = self.boxes.get(boxId);
    if (!box) return;
    for (var pi = 0; pi < box.ports.length; pi++) {
      var port = box.ports[pi];
      for (var ci = 0; ci < port.connectorIds.length; ci++) {
        var c = self.connectors.get(port.connectorIds[ci]);
        if (c) conns.push(c);
      }
    }
  } else {
    conns = Array.from(self.connectors.values());
  }

  /* De-duplicate. */
  var seen = {};
  var unique = [];
  for (var i = 0; i < conns.length; i++) {
    if (!seen[conns[i].id]) { seen[conns[i].id] = true; unique.push(conns[i]); }
  }

  /* ── Pass 1: pick optimal side + centre offset ─────────────── */
  /* Also record each port's role so Pass 2 can detect conflicts. */
  /* portRole[portId] = 'out' | 'in'                              */
  var portRole = {};

  for (var ui = 0; ui < unique.length; ui++) {
    var conn = unique[ui];
    var srcPort = self.ports.get(conn.sourcePortId);
    var dstPort = self.ports.get(conn.destPortId);
    if (!srcPort || !dstPort) continue;

    var srcBox = self.boxes.get(srcPort.boxId);
    var dstBox = self.boxes.get(dstPort.boxId);
    if (!srcBox || !dstBox) continue;

    var vx = (dstBox.x + dstBox.width / 2) - (srcBox.x + srcBox.width / 2);
    var vy = (dstBox.y + dstBox.height / 2) - (srcBox.y + srcBox.height / 2);

    var srcSide, dstSide;
    if (Math.abs(vx) >= Math.abs(vy)) {
      srcSide = vx >= 0 ? SIDE.RIGHT : SIDE.LEFT;
      dstSide = vx >= 0 ? SIDE.LEFT  : SIDE.RIGHT;
    } else {
      srcSide = vy >= 0 ? SIDE.BOTTOM : SIDE.TOP;
      dstSide = vy >= 0 ? SIDE.TOP    : SIDE.BOTTOM;
    }

    srcPort.side   = srcSide;
    srcPort.offset = centreOffset(srcBox, srcSide);
    dstPort.side   = dstSide;
    dstPort.offset = centreOffset(dstBox, dstSide);

    portRole[srcPort.id] = 'out';
    portRole[dstPort.id] = 'in';

    if (conn.arrowDir) {
      conn.arrowDir = SIDE_TO_ARROW[dstSide] || conn.arrowDir;
    }
  }

  /* ── Pass 2: spread opposite-direction ports on same side ──── */
  /* Group touched ports by (boxId, side). */
  var groups = {};
  for (var ui2 = 0; ui2 < unique.length; ui2++) {
    var cn = unique[ui2];
    var pIds = [cn.sourcePortId, cn.destPortId];
    for (var k = 0; k < pIds.length; k++) {
      var p = self.ports.get(pIds[k]);
      if (!p) continue;
      var key = p.boxId + ':' + p.side;
      if (!groups[key]) groups[key] = [];
      /* Avoid adding the same port twice. */
      var already = false;
      for (var g = 0; g < groups[key].length; g++) {
        if (groups[key][g].id === p.id) { already = true; break; }
      }
      if (!already) groups[key].push(p);
    }
  }

  for (var gk in groups) {
    var list = groups[gk];
    if (list.length < 2) continue;

    var hasOut = false, hasIn = false;
    for (var li = 0; li < list.length; li++) {
      if (portRole[list[li].id] === 'out') hasOut = true;
      else hasIn = true;
    }
    /* Same direction → all can share the centre offset (no change). */
    if (!hasOut || !hasIn) continue;

    /* Mixed directions — spread evenly across the interior.
     * Sort: outgoing ports first, then incoming.                  */
    list.sort(function (a, b) {
      var ra = portRole[a.id] === 'out' ? 0 : 1;
      var rb = portRole[b.id] === 'out' ? 0 : 1;
      return ra - rb;
    });

    var bx = self.boxes.get(list[0].boxId);
    if (!bx) continue;
    var len = interiorLen(bx, list[0].side);
    if (len < 2) continue;  /* too small to spread */

    /* Distribute N ports evenly in [0 .. len-1]. */
    var n = list.length;
    for (var si = 0; si < n; si++) {
      list[si].offset = (n === 1)
        ? Math.floor((len - 1) / 2)
        : Math.round(si * (len - 1) / (n - 1));
    }
  }
};
