'use strict';

/**
 * lib/widget/diagram/render-connector.js
 *
 * Renders connectors (segments, corners, junctions, arrowheads).
 */

var CHARSETS      = require('../../border/charsets').CHARSETS;
var CELL_TYPE     = require('./occupancy-grid').CELL_TYPE;
var resolveArrow  = require('./render-port-tees').resolveArrow;

/**
 * Render a single connector into the character buffer.
 *
 * Walks each segment and writes the appropriate line characters,
 * corner characters at bends between consecutive segments, and an
 * arrowhead at the terminal cell.
 *
 * When a new connector segment crosses an existing connector at a
 * perpendicular intersection, the renderer writes a junction cross
 * character (┼) instead of overwriting.
 *
 * @param {import('./diagram-model').DiagramConnector} connector
 * @param {import('./render-buffer').CharBuffer}       buf
 * @param {import('./occupancy-grid').OccupancyGrid}   grid
 */
function renderConnector(connector, buf, grid) {
  var cs  = CHARSETS.connector;
  var cid = connector.id;
  var segments = connector.segments;
  var arrowDir = connector.arrowDir;

  if (!segments || segments.length === 0) return;

  for (var si = 0; si < segments.length; si++) {
    var seg = segments[si];
    var isHoriz = seg.y1 === seg.y2;
    var isVert  = seg.x1 === seg.x2;

    if (isHoriz) {
      var minX = Math.min(seg.x1, seg.x2);
      var maxX = Math.max(seg.x1, seg.x2);
      for (var cx = minX; cx <= maxX; cx++) {
        var existing = grid.query(cx, seg.y1);
        if (existing.type === CELL_TYPE.CONNECTOR && existing.char === cs.vertical) {
          /* Horizontal hops over vertical — arc replaces the vertical cell. */
          buf.put(cx, seg.y1, cs.cross);
          grid.set(cx, seg.y1, CELL_TYPE.JUNCTION, cid, cs.cross);
          /* Place ╷ below the arc so the vertical line visually resumes. */
          var belowY = seg.y1 + 1;
          var below = grid.query(cx, belowY);
          if (below.type === CELL_TYPE.CONNECTOR && below.char === cs.vertical) {
            buf.put(cx, belowY, cs.crossResume);
            grid.set(cx, belowY, CELL_TYPE.CONNECTOR, cid, cs.crossResume);
          }
        } else if (existing.type === CELL_TYPE.EMPTY ||
                   existing.type === CELL_TYPE.LABEL) {
          buf.put(cx, seg.y1, cs.horizontal);
          grid.set(cx, seg.y1, CELL_TYPE.CONNECTOR, cid, cs.horizontal);
        }
      }
    } else if (isVert) {
      var minY = Math.min(seg.y1, seg.y2);
      var maxY = Math.max(seg.y1, seg.y2);
      for (var cy = minY; cy <= maxY; cy++) {
        var existing2 = grid.query(seg.x1, cy);
        if (existing2.type === CELL_TYPE.CONNECTOR && existing2.char === cs.horizontal) {
          /* Horizontal already present — arc over; vertical resumes below. */
          buf.put(seg.x1, cy, cs.cross);
          grid.set(seg.x1, cy, CELL_TYPE.JUNCTION, cid, cs.cross);
          /* Place ╷ on the next vertical cell below. */
          if (cy + 1 <= maxY) {
            buf.put(seg.x1, cy + 1, cs.crossResume);
            grid.set(seg.x1, cy + 1, CELL_TYPE.CONNECTOR, cid, cs.crossResume);
          }
        } else if (existing2.type === CELL_TYPE.JUNCTION && existing2.char === cs.cross) {
          /* Already an arc crossing — leave it. */
        } else if (existing2.type === CELL_TYPE.CONNECTOR && existing2.char === cs.crossResume) {
          /* Already a resume stub — leave it. */
        } else if (existing2.type === CELL_TYPE.EMPTY ||
                   existing2.type === CELL_TYPE.LABEL) {
          buf.put(seg.x1, cy, cs.vertical);
          grid.set(seg.x1, cy, CELL_TYPE.CONNECTOR, cid, cs.vertical);
        }
      }
    }

    /* Corner character at bend between consecutive segments. */
    if (si < segments.length - 1) {
      var next = segments[si + 1];
      var jx = seg.x2;
      var jy = seg.y2;
      var cornerChar = resolveCorner(seg, next, cs);
      if (cornerChar) {
        buf.put(jx, jy, cornerChar);
        grid.set(jx, jy, CELL_TYPE.JUNCTION, cid, cornerChar);
      }
    }
  }

  /*
   * Arrowhead at the terminal cell (target-entry arrow).
   *
   * For routed connectors whose last segment ends on a box border
   * cell (PORT/BORDER/GATE), the arrow is shifted one cell backward
   * along the segment to the entry cell.  This keeps the arrow at
   * the cell just before the border so a tee character can occupy
   * the border position itself.
   */
  if (arrowDir && segments.length > 0) {
    var lastSeg = segments[segments.length - 1];
    var ax = lastSeg.x2;
    var ay = lastSeg.y2;
    var destCell = grid.query(ax, ay);
    if (destCell.type === CELL_TYPE.PORT || destCell.type === CELL_TYPE.BORDER ||
        destCell.type === CELL_TYPE.GATE) {
      var shifted = arrowEntryCell(lastSeg);
      if (shifted) { ax = shifted.x; ay = shifted.y; }
    }
    var arrowChar = resolveArrow(arrowDir, cs);
    if (arrowChar) {
      buf.put(ax, ay, arrowChar);
      grid.set(ax, ay, CELL_TYPE.ARROW, cid, arrowChar);
    }
  }

  /*
   * Source-exit arrow on the first leg of the connector.
   *
   * Only rendered when sourceArrowDir is set, meaning the connector
   * has multiple segments (bends) so the source arrow lives on its
   * own leg and does not visually compete with the target arrow.
   *
   * The arrow is placed at the exit cell — one cell outward from the
   * source port position (the first cell after the box border tee).
   */
  var sourceArrowDir = connector.sourceArrowDir;
  if (sourceArrowDir && segments.length > 0) {
    var firstSeg = segments[0];
    var srcArrow = sourceArrowCell(firstSeg);
    var srcArrowChar = resolveArrow(sourceArrowDir, cs);
    if (srcArrowChar && srcArrow) {
      buf.put(srcArrow.x, srcArrow.y, srcArrowChar);
      grid.set(srcArrow.x, srcArrow.y, CELL_TYPE.ARROW, cid, srcArrowChar);
    }
  }
}

/**
 * Determine the corner character at a bend between two segments.
 *
 * @param {import('./diagram-model').Segment} seg  - Current segment.
 * @param {import('./diagram-model').Segment} next - Next segment.
 * @param {Object} cs - Connector charset.
 * @returns {string|null}
 */
function resolveCorner(seg, next, cs) {
  var fromDir = segDirection(seg);
  var toDir   = segDirection(next);

  if (fromDir === 'right' && toDir === 'down')  return cs.topRight;
  if (fromDir === 'right' && toDir === 'up')    return cs.bottomRight;
  if (fromDir === 'left'  && toDir === 'down')  return cs.topLeft;
  if (fromDir === 'left'  && toDir === 'up')    return cs.bottomLeft;
  if (fromDir === 'down'  && toDir === 'right') return cs.bottomLeft;
  if (fromDir === 'down'  && toDir === 'left')  return cs.bottomRight;
  if (fromDir === 'up'    && toDir === 'right') return cs.topLeft;
  if (fromDir === 'up'    && toDir === 'left')  return cs.topRight;
  return null;
}

/**
 * Get the cardinal direction of a segment.
 *
 * @param {import('./diagram-model').Segment} seg
 * @returns {'right'|'left'|'down'|'up'}
 */
function segDirection(seg) {
  if (seg.y1 === seg.y2) return seg.x2 >= seg.x1 ? 'right' : 'left';
  return seg.y2 >= seg.y1 ? 'down' : 'up';
}

/**
 * Compute the cell position for a source-exit arrow.
 *
 * The arrow goes at the exit cell — one cell outward from the start
 * of the first segment (which is the source port on the box border).
 *
 * @param {import('./diagram-model').Segment} firstSeg - First segment.
 * @returns {{ x: number, y: number }|null}
 */
function sourceArrowCell(firstSeg) {
  var dir = segDirection(firstSeg);
  switch (dir) {
    case 'right': return { x: firstSeg.x1 + 1, y: firstSeg.y1 };
    case 'left':  return { x: firstSeg.x1 - 1, y: firstSeg.y1 };
    case 'down':  return { x: firstSeg.x1,     y: firstSeg.y1 + 1 };
    case 'up':    return { x: firstSeg.x1,     y: firstSeg.y1 - 1 };
    default:      return null;
  }
}

/**
 * Compute the entry cell — one cell backward from a segment's endpoint.
 *
 * Used to shift the target arrow off a box border cell so the tee
 * character can occupy the border position.
 *
 * @param {import('./diagram-model').Segment} seg - The last segment.
 * @returns {{ x: number, y: number }|null}
 */
function arrowEntryCell(seg) {
  var dir = segDirection(seg);
  switch (dir) {
    case 'right': return { x: seg.x2 - 1, y: seg.y2 };
    case 'left':  return { x: seg.x2 + 1, y: seg.y2 };
    case 'down':  return { x: seg.x2,     y: seg.y2 - 1 };
    case 'up':    return { x: seg.x2,     y: seg.y2 + 1 };
    default:      return null;
  }
}

module.exports = {
  renderConnector:  renderConnector,
  resolveCorner:    resolveCorner,
  segDirection:     segDirection,
  sourceArrowCell:  sourceArrowCell,
  arrowEntryCell:   arrowEntryCell
};
