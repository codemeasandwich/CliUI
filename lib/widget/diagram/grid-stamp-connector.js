'use strict';

/**
 * lib/widget/diagram/grid-stamp-connector.js
 *
 * Prototype patches: _stampConnector, _resolveCorner, _segDirection,
 * _resolveArrowChar.
 */

var CELL_TYPE      = require('./grid-constants').CELL_TYPE;
var OccupancyGrid  = require('./grid-core').OccupancyGrid;

/**
 * Stamp a connector's routed segments into the grid.
 *
 * Walks each segment and writes CONNECTOR cells for straight runs,
 * corner characters at bends, and ARROW cells at the terminal.
 *
 * @param {import('./diagram-model').DiagramConnector} connector
 * @param {Object} connCharset - Connector charset from charsets.connector.
 * @private
 */
OccupancyGrid.prototype._stampConnector = function _stampConnector(connector, connCharset) {
  var cid      = connector.id;
  var segments = connector.segments;
  var arrowDir = connector.arrowDir;
  if (!segments || segments.length === 0) return;

  for (var si = 0; si < segments.length; si++) {
    var seg     = segments[si];
    var isHoriz = seg.y1 === seg.y2;
    var isVert  = seg.x1 === seg.x2;

    if (isHoriz) {
      /* Horizontal segment: write ─ along the row. */
      var minX = Math.min(seg.x1, seg.x2);
      var maxX = Math.max(seg.x1, seg.x2);
      for (var cx = minX; cx <= maxX; cx++) {
        if (this.inBounds(cx, seg.y1)) {
          var existing = this.query(cx, seg.y1);
          if (existing.type === CELL_TYPE.CONNECTOR && existing.char === connCharset.vertical) {
            this.set(cx, seg.y1, CELL_TYPE.JUNCTION, cid, connCharset.cross);
          } else if (existing.type === CELL_TYPE.EMPTY || existing.type === CELL_TYPE.LABEL) {
            this.set(cx, seg.y1, CELL_TYPE.CONNECTOR, cid, connCharset.horizontal);
          }
        }
      }
    } else if (isVert) {
      /* Vertical segment: write │ along the column. */
      var minY = Math.min(seg.y1, seg.y2);
      var maxY = Math.max(seg.y1, seg.y2);
      for (var cy = minY; cy <= maxY; cy++) {
        if (this.inBounds(seg.x1, cy)) {
          var existing2 = this.query(seg.x1, cy);
          if (existing2.type === CELL_TYPE.CONNECTOR && existing2.char === connCharset.horizontal) {
            this.set(seg.x1, cy, CELL_TYPE.JUNCTION, cid, connCharset.cross);
          } else if (existing2.type === CELL_TYPE.EMPTY || existing2.type === CELL_TYPE.LABEL) {
            this.set(seg.x1, cy, CELL_TYPE.CONNECTOR, cid, connCharset.vertical);
          }
        }
      }
    }

    /*
     * Write corner characters at the junction between consecutive
     * segments.  The corner type depends on which directions the
     * two segments travel relative to each other.
     */
    if (si < segments.length - 1) {
      var next = segments[si + 1];
      var jx = seg.x2;
      var jy = seg.y2;

      if (this.inBounds(jx, jy)) {
        var cornerChar = this._resolveCorner(seg, next, connCharset);
        if (cornerChar) {
          this.set(jx, jy, CELL_TYPE.JUNCTION, cid, cornerChar);
        }
      }
    }
  }

  /* Stamp the arrowhead at the connector's terminal cell. */
  if (arrowDir && segments.length > 0) {
    var lastSeg = segments[segments.length - 1];
    var ax = lastSeg.x2;
    var ay = lastSeg.y2;
    var arrowChar = this._resolveArrowChar(arrowDir, connCharset);
    if (arrowChar && this.inBounds(ax, ay)) {
      this.set(ax, ay, CELL_TYPE.ARROW, cid, arrowChar);
    }
  }

  /*
   * Stamp source-exit arrow on the first leg.
   * Only present when the connector has multiple segments (bends)
   * so the source arrow lives on a separate leg from the target arrow.
   */
  var sourceArrowDir = connector.sourceArrowDir;
  if (sourceArrowDir && segments.length > 0) {
    var firstSeg = segments[0];
    var srcCell  = this._sourceArrowCell(firstSeg);
    var srcChar  = this._resolveArrowChar(sourceArrowDir, connCharset);
    if (srcChar && srcCell && this.inBounds(srcCell.x, srcCell.y)) {
      this.set(srcCell.x, srcCell.y, CELL_TYPE.ARROW, cid, srcChar);
    }
  }
};

/**
 * Determine the correct corner / tee character at the junction
 * between two consecutive segments.
 *
 *   right then down → ┐    left then down → ┌
 *   right then up   → ┘    left then up   → └
 *   down then right → └    down then left → ┘
 *   up then right   → ┌    up then left   → ┐
 *
 * @param {import('./diagram-model').Segment} seg
 * @param {import('./diagram-model').Segment} next
 * @param {Object} cs - Connector charset.
 * @returns {string|null} Corner character, or null if collinear.
 * @private
 */
OccupancyGrid.prototype._resolveCorner = function _resolveCorner(seg, next, cs) {
  var fromDir = this._segDirection(seg);
  var toDir   = this._segDirection(next);

  if (fromDir === 'right' && toDir === 'down')  return cs.topRight;
  if (fromDir === 'right' && toDir === 'up')    return cs.bottomRight;
  if (fromDir === 'left'  && toDir === 'down')  return cs.topLeft;
  if (fromDir === 'left'  && toDir === 'up')    return cs.bottomLeft;
  if (fromDir === 'down'  && toDir === 'right') return cs.bottomLeft;
  if (fromDir === 'down'  && toDir === 'left')  return cs.bottomRight;
  if (fromDir === 'up'    && toDir === 'right') return cs.topLeft;
  if (fromDir === 'up'    && toDir === 'left')  return cs.topRight;

  return null;
};

/**
 * Determine the cardinal direction of a segment.
 * @param {import('./diagram-model').Segment} seg
 * @returns {'right'|'left'|'down'|'up'}
 * @private
 */
OccupancyGrid.prototype._segDirection = function _segDirection(seg) {
  if (seg.y1 === seg.y2) {
    return seg.x2 >= seg.x1 ? 'right' : 'left';
  }
  return seg.y2 >= seg.y1 ? 'down' : 'up';
};

/**
 * Compute the cell position for a source-exit arrow.
 *
 * The arrow goes at the exit cell — one cell outward from the start
 * of the first segment (which is the source port on the box border).
 *
 * @param {import('./diagram-model').Segment} firstSeg
 * @returns {{ x: number, y: number }|null}
 * @private
 */
OccupancyGrid.prototype._sourceArrowCell = function _sourceArrowCell(firstSeg) {
  var dir = this._segDirection(firstSeg);
  switch (dir) {
    case 'right': return { x: firstSeg.x1 + 1, y: firstSeg.y1 };
    case 'left':  return { x: firstSeg.x1 - 1, y: firstSeg.y1 };
    case 'down':  return { x: firstSeg.x1,     y: firstSeg.y1 + 1 };
    case 'up':    return { x: firstSeg.x1,     y: firstSeg.y1 - 1 };
    default:      return null;
  }
};

/**
 * Map an arrow direction string to the canonical arrowhead character.
 * @param {string} dir - 'right'|'left'|'down'|'up'.
 * @param {Object} cs  - Connector charset.
 * @returns {string|null}
 * @private
 */
OccupancyGrid.prototype._resolveArrowChar = function _resolveArrowChar(dir, cs) {
  switch (dir) {
    case 'right': return cs.arrowRight;
    case 'left':  return cs.arrowLeft;
    case 'down':  return cs.arrowDown;
    case 'up':    return cs.arrowUp;
    default:      return null;
  }
};
