'use strict';

/**
 * lib/widget/diagram/render-labels.js
 *
 * Renders labels, inline endpoint labels, line labels, and opaque blocks.
 */

var SIDE      = require('./diagram-model').SIDE;
var CELL_TYPE = require('./occupancy-grid').CELL_TYPE;

/**
 * Render labels into the character buffer.
 *
 * Each character is placed only if the target cell is currently empty
 * in the occupancy grid, preventing labels from corrupting structural
 * elements (spec §6.6 collision avoidance).
 *
 * @param {import('./diagram-model').DiagramModel} model
 * @param {import('./render-buffer').CharBuffer}    buf
 * @param {import('./occupancy-grid').OccupancyGrid} grid
 */
function renderLabels(model, buf, grid) {
  model.labels.forEach(function (label) {
    for (var i = 0; i < label.text.length; i++) {
      var lx = label.x + i;
      var ly = label.y;
      if (grid.isEmpty(lx, ly)) {
        buf.put(lx, ly, label.text[i]);
        grid.set(lx, ly, CELL_TYPE.LABEL, label.id, label.text[i]);
      }
    }
  });

  /*
   * Also render inline endpoint labels and line labels from connectors.
   * These are stored on the connector rather than as standalone labels.
   */
  model.connectors.forEach(function (conn) {
    /* Line label: placed at the midpoint of the longest segment. */
    if (conn.lineLabel && conn.segments.length > 0) {
      var midSeg = findLongestSegment(conn.segments);
      if (midSeg) {
        var midX = Math.floor((midSeg.x1 + midSeg.x2) / 2);
        var midY = Math.floor((midSeg.y1 + midSeg.y2) / 2);
        var isHoriz = midSeg.y1 === midSeg.y2;
        var lx = isHoriz ? midX - Math.floor(conn.lineLabel.length / 2) : midX + 1;
        var ly = isHoriz ? midY + 1 : midY;
        for (var i = 0; i < conn.lineLabel.length; i++) {
          if (grid.isEmpty(lx + i, ly)) {
            buf.put(lx + i, ly, conn.lineLabel[i]);
            grid.set(lx + i, ly, CELL_TYPE.LABEL, conn.id, conn.lineLabel[i]);
          }
        }
      }
    }

    /* Endpoint labels near branch exits. */
    for (var ei = 0; ei < conn.endpointLabels.length; ei++) {
      var epl = conn.endpointLabels[ei];
      var portId = epl.end === 'source' ? conn.sourcePortId : conn.destPortId;
      var port = model.getPort(portId);
      if (!port) continue;
      var pos = model.getPortPosition(portId);
      if (!pos) continue;

      var elx = pos.x;
      var ely = pos.y;
      switch (port.side) {
        case SIDE.TOP:    ely -= 1; elx -= Math.floor(epl.text.length / 2); break;
        case SIDE.BOTTOM: ely += 1; elx -= Math.floor(epl.text.length / 2); break;
        case SIDE.LEFT:   elx -= epl.text.length - 1; break;
        case SIDE.RIGHT:  elx += 1; break;
      }

      for (var j = 0; j < epl.text.length; j++) {
        if (grid.isEmpty(elx + j, ely)) {
          buf.put(elx + j, ely, epl.text[j]);
          grid.set(elx + j, ely, CELL_TYPE.LABEL, conn.id, epl.text[j]);
        }
      }
    }
  });
}

/**
 * Find the longest segment in a connector's path.
 *
 * Used to place line labels at a readable midpoint.
 *
 * @param {import('./diagram-model').Segment[]} segments
 * @returns {import('./diagram-model').Segment|null}
 */
function findLongestSegment(segments) {
  var best = null;
  var bestLen = -1;
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    var len = Math.abs(seg.x2 - seg.x1) + Math.abs(seg.y2 - seg.y1);
    if (len > bestLen) {
      bestLen = len;
      best = seg;
    }
  }
  return best;
}

/**
 * Render opaque text blocks from lenient parsing.
 *
 * These blocks are preserved verbatim so write-back does not destroy
 * unrecognised content.
 *
 * @param {Array<{x: number, y: number, text: string}>} blocks
 * @param {import('./render-buffer').CharBuffer} buf
 */
function renderOpaqueBlocks(blocks, buf) {
  for (var bi = 0; bi < blocks.length; bi++) {
    var block = blocks[bi];
    for (var i = 0; i < block.text.length; i++) {
      buf.put(block.x + i, block.y, block.text[i]);
    }
  }
}

module.exports = {
  renderLabels:       renderLabels,
  findLongestSegment: findLongestSegment,
  renderOpaqueBlocks: renderOpaqueBlocks
};
