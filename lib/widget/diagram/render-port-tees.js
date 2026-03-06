'use strict';

/**
 * lib/widget/diagram/render-port-tees.js
 *
 * Renders tee characters at box port positions where connectors attach.
 *
 * Extracted from render-connector.js to keep that module under 200 NCLOC.
 * Port tee rendering is a distinct concern from connector segment
 * rendering — it operates on boxes/ports rather than connector geometry.
 */

var CHARSETS   = require('../../border/charsets').CHARSETS;
var CELL_TYPE  = require('./occupancy-grid').CELL_TYPE;

// ────────────────────────────────────────────────────────────────────
// § Port tee rendering
// ────────────────────────────────────────────────────────────────────

/**
 * Render tee characters at box port positions where connectors attach.
 *
 * Normal boxes use ├ ┤ ┬ ┴ at their border cells to indicate
 * connection points.  Current-work boxes already render gate
 * characters (╟ / ╧) via render-box, so they are skipped here.
 *
 * The tee character is determined by which side of the box the port
 * is on:
 *   RIGHT → ├  (vertical border, branch right)
 *   LEFT  → ┤  (vertical border, branch left)
 *   BOTTOM → ┬ (horizontal border, branch down)
 *   TOP   → ┴  (horizontal border, branch up)
 *
 * @param {import('./diagram-model').DiagramModel}     model
 * @param {import('./render-buffer').CharBuffer}       buf
 * @param {import('./occupancy-grid').OccupancyGrid}   grid
 */
function renderPortTees(model, buf, grid) {
  var cs = CHARSETS.connector;

  model.boxes.forEach(function (box) {
    /* Current-work boxes use gate characters, not tees. */
    if (box.currentWork) return;

    /*
     * When a box has an explicit borderStyle, use that charset's tee
     * characters so the tee matches the box border visually (e.g.
     * heavy box gets ┣/┫/┳/┻ instead of the connector's light ├/┤/┬/┴).
     * Falls back to the connector charset for unstyled (light) boxes.
     */
    var boxTeeCs = cs;
    if (box.borderStyle && CHARSETS[box.borderStyle] && CHARSETS[box.borderStyle].tee) {
      boxTeeCs = resolveTeesFromBoxCharset(CHARSETS[box.borderStyle]);
    }

    for (var pi = 0; pi < box.ports.length; pi++) {
      var port = box.ports[pi];
      /* Only render tee when at least one connector is attached. */
      if (port.connectorIds.length === 0) continue;

      var pos = model.getPortPosition(port.id);
      if (!pos) continue;

      /*
       * Only write the tee on cells the box renderer marked as PORT.
       * This guards against out-of-range offsets that land on a
       * BORDER corner cell — overwriting a corner would corrupt
       * the box shape and break the parser round-trip.
       */
      var cellInfo = grid.query(pos.x, pos.y);
      if (cellInfo.type !== CELL_TYPE.PORT) continue;

      var teeChar = resolveTee(port.side, boxTeeCs);
      if (teeChar) {
        buf.put(pos.x, pos.y, teeChar);
        grid.set(pos.x, pos.y, CELL_TYPE.PORT, box.id, teeChar);
      }
    }
  });
}

/**
 * Map a port side to the corresponding tee character.
 *
 * The tee extends the box border with a branch in the connector's
 * exit direction:
 *   RIGHT → ├   LEFT → ┤   BOTTOM → ┬   TOP → ┴
 *
 * @param {string} side - Port side (SIDE constant).
 * @param {Object} cs   - Connector charset.
 * @returns {string|null}
 */
function resolveTee(side, cs) {
  switch (side) {
    case 'right':  return cs.teeRight;
    case 'left':   return cs.teeLeft;
    case 'bottom': return cs.teeDown;
    case 'top':    return cs.teeUp;
    default:       return null;
  }
}

/**
 * Map arrow direction to canonical arrowhead character.
 *
 * @param {string} dir - 'right'|'left'|'down'|'up'.
 * @param {Object} cs  - Connector charset.
 * @returns {string|null}
 */
function resolveArrow(dir, cs) {
  switch (dir) {
    case 'right': return cs.arrowRight;
    case 'left':  return cs.arrowLeft;
    case 'down':  return cs.arrowDown;
    case 'up':    return cs.arrowUp;
    default:      return null;
  }
}

/**
 * Build a tee-compatible charset object from a box charset's `tee` map.
 *
 * Box charsets store tees as `{ l, r, t, b }` while the connector code
 * expects `teeRight`, `teeLeft`, `teeDown`, `teeUp`.  This adapter
 * translates so `resolveTee()` works with either source.
 *
 * @param {Object} boxCs - A box charset with a `.tee` object.
 * @returns {Object} Object compatible with `resolveTee()`.
 */
function resolveTeesFromBoxCharset(boxCs) {
  var t = boxCs.tee;
  return {
    teeRight: t.l,   /* port on right side → ├ equivalent */
    teeLeft:  t.r,   /* port on left side  → ┤ equivalent */
    teeDown:  t.t,   /* port on bottom     → ┬ equivalent */
    teeUp:    t.b    /* port on top        → ┴ equivalent */
  };
}

module.exports = {
  renderPortTees:          renderPortTees,
  resolveTee:              resolveTee,
  resolveArrow:            resolveArrow,
  resolveTeesFromBoxCharset: resolveTeesFromBoxCharset
};
