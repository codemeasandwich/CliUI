'use strict';

/**
 * lib/widget/diagram/parser-labels.js
 *
 * Pass 3 — Label detection and the top-level `parse` orchestrator.
 */

var DiagramModel = require('./diagram-model').DiagramModel;
var LABEL_TYPE   = require('./diagram-model').LABEL_TYPE;

var chars               = require('./parser-chars');
var textToGrid          = chars.textToGrid;
var VERTICAL_CHARS      = chars.VERTICAL_CHARS;
var HORIZONTAL_CHARS    = chars.HORIZONTAL_CHARS;
var ARROW_CHARS         = chars.ARROW_CHARS;
var JUNCTION_CHARS      = chars.JUNCTION_CHARS;
var CONNECTOR_PATH_CHARS = chars.CONNECTOR_PATH_CHARS;

var detectBoxes     = require('./parser-boxes').detectBoxes;
var traceConnectors = require('./parser-connectors').traceConnectors;

var SIDE = require('./diagram-model').SIDE;

// ────────────────────────────────────────────────────────────────────
// § Pass 3 — Label detection
// ────────────────────────────────────────────────────────────────────

/**
 * Detect labels from remaining unvisited text runs.
 *
 * After boxes and connectors are claimed, any contiguous horizontal
 * run of non-space characters that hasn't been visited is likely a
 * label.  Its type is determined by proximity to connectors and ports.
 *
 * @param {string[][]} grid
 * @param {number}     width
 * @param {number}     height
 * @param {Set<string>} visited
 * @param {import('./diagram-model').DiagramModel} model
 */
function detectLabels(grid, width, height, visited, model) {
  for (var y = 0; y < height; y++) {
    var x = 0;
    while (x < width) {
      /* Skip visited or empty cells. */
      if (visited.has(x + ',' + y) || grid[y][x] === ' ') {
        x++;
        continue;
      }

      /* Start of a text run.
       * Collect the full span including internal spaces so that
       * multi-word labels like "Label Here." stay as one entity.
       * We include a space only if a non-space unvisited char
       * follows on the same row (i.e. the space is *internal*). */
      var runStart = x;
      var text = '';
      while (x < width) {
        if (visited.has(x + ',' + y)) break;
        if (grid[y][x] === ' ') {
          /* Look ahead for more unvisited non-space text. */
          var peek = x + 1;
          while (peek < width && grid[y][peek] === ' ' && !visited.has(peek + ',' + y)) peek++;
          if (peek >= width || visited.has(peek + ',' + y) || grid[y][peek] === ' ') break;
          /* Include the gap — mark space cells visited too. */
          while (x < peek) {
            text += ' ';
            visited.add(x + ',' + y);
            x++;
          }
        } else {
          text += grid[y][x];
          visited.add(x + ',' + y);
          x++;
        }
      }

      /* Trim trailing whitespace that crept in. */
      text = text.replace(/\s+$/, '');
      if (text.length === 0) continue;

      /*
       * Skip runs that look like stray connector artifacts (single
       * junction/arrow chars that weren't caught by pass 2).
       */
      if (text.length === 1 && CONNECTOR_PATH_CHARS.has(text)) continue;

      /*
       * Classify the label based on adjacency.
       */
      var labelType = LABEL_TYPE.ENTRY; // default
      var anchorId = null;

      /* Check below: is there a connector or arrowhead? */
      if (y + 1 < height) {
        for (var lx = runStart; lx < runStart + text.length; lx++) {
          var below = grid[y + 1][lx];
          if (VERTICAL_CHARS.has(below) || ARROW_CHARS.has(below) || JUNCTION_CHARS.has(below)) {
            labelType = LABEL_TYPE.ENTRY;
            break;
          }
        }
      }

      /* Check for adjacent connector to classify as line label. */
      var leftCh  = runStart > 0 ? grid[y][runStart - 1] : ' ';
      var rightCh = runStart + text.length < width ? grid[y][runStart + text.length] : ' ';
      if (HORIZONTAL_CHARS.has(leftCh) || HORIZONTAL_CHARS.has(rightCh)) {
        labelType = LABEL_TYPE.LINE;
      }

      /*
       * Check if label text matches common endpoint patterns
       * (single-letter labels like Y, N near branch points).
       */
      if (text.length <= 2 && /^[A-Z]$/i.test(text.trim())) {
        labelType = LABEL_TYPE.ENDPOINT;
      }

      model.addLabel(labelType, text, runStart, y, anchorId);
    }
  }
}

// ────────────────────────────────────────────────────────────────────
// § Post-pass — Anchor labels to nearby ports
// ────────────────────────────────────────────────────────────────────

/**
 * Resolve `anchorId` for labels positioned near a port's exit cell.
 *
 * After boxes, connectors, and labels are all detected, this pass
 * links each unclaimed label to the nearest port exit cell within
 * Manhattan distance ≤ 2.  The exit cell is the grid cell one step
 * outward from the port's position on the box border.
 *
 * This anchors decision labels like "Y" and "N" to the specific
 * port they annotate, enabling them to move with the box during drag.
 *
 * @param {import('./diagram-model').DiagramModel} model
 */
function anchorLabelsToNearbyPorts(model) {
  /* Pre-compute exit cells for all ports. */
  var exitCells = [];
  model.ports.forEach(function (port) {
    var pos = model.getPortPosition(port.id);
    if (!pos) return;

    var ex = pos.x, ey = pos.y;
    switch (port.side) {
      case SIDE.TOP:    ey = pos.y - 1; break;
      case SIDE.BOTTOM: ey = pos.y + 1; break;
      case SIDE.LEFT:   ex = pos.x - 1; break;
      case SIDE.RIGHT:  ex = pos.x + 1; break;
    }
    exitCells.push({ portId: port.id, ex: ex, ey: ey });
  });

  if (exitCells.length === 0) return;

  model.labels.forEach(function (label) {
    if (label.anchorId != null) return; /* already anchored */

    var bestDist = Infinity;
    var bestPort = null;

    for (var ei = 0; ei < exitCells.length; ei++) {
      var ec = exitCells[ei];
      for (var ci = 0; ci < label.text.length; ci++) {
        var lx = label.x + ci;
        var dist = Math.abs(lx - ec.ex) + Math.abs(label.y - ec.ey);
        if (dist <= 2 && dist < bestDist) {
          bestDist = dist;
          bestPort = ec.portId;
        }
      }
    }

    if (bestPort !== null) {
      label.anchorId = bestPort;
    }
  });
}

// ────────────────────────────────────────────────────────────────────
// § Post-pass — Anchor labels to nearby connector segments
// ────────────────────────────────────────────────────────────────────

/**
 * Resolve `anchorId` for labels positioned 1 cell away from a
 * connector's routed path segments.
 *
 * After `anchorLabelsToNearbyPorts` has claimed the endpoint labels
 * (e.g. "Y", "N"), this pass checks every remaining unanchored label
 * against all connector segment cells.  A label is anchored when any
 * of its character cells lies exactly 1 row/column away from a
 * segment cell.
 *
 * @param {import('./diagram-model').DiagramModel} model
 */
function anchorLabelsToNearbyConnectors(model) {
  /* Build a lookup { 'x,y' → connectorId } for all segment cells. */
  var cellToConn = {};
  model.connectors.forEach(function (conn) {
    for (var si = 0; si < conn.segments.length; si++) {
      var s = conn.segments[si];
      /* Walk every cell of the segment (horizontal or vertical). */
      var dx = s.x2 > s.x1 ? 1 : s.x2 < s.x1 ? -1 : 0;
      var dy = s.y2 > s.y1 ? 1 : s.y2 < s.y1 ? -1 : 0;
      var cx = s.x1, cy = s.y1;
      while (true) {
        cellToConn[cx + ',' + cy] = conn.id;
        if (cx === s.x2 && cy === s.y2) break;
        cx += dx;
        cy += dy;
      }
    }
  });

  model.labels.forEach(function (label) {
    if (label.anchorId != null) return; /* already anchored */

    /* Check every character cell against the 4 cardinal neighbours. */
    for (var ci = 0; ci < label.text.length; ci++) {
      var lx = label.x + ci;
      var ly = label.y;
      var neighbours = [
        (lx - 1) + ',' + ly,
        (lx + 1) + ',' + ly,
        lx + ',' + (ly - 1),
        lx + ',' + (ly + 1)
      ];
      for (var ni = 0; ni < neighbours.length; ni++) {
        if (cellToConn[neighbours[ni]] != null) {
          label.anchorId = cellToConn[neighbours[ni]];
          return; /* done with this label */
        }
      }
    }
  });

  /* Centre each connector-anchored label on its connector's
     longest segment so it sits at the visual midpoint.  Labels on
     a horizontal segment are placed 1 row above, centred;
     labels on a vertical segment are placed 1 col to the right. */
  model.labels.forEach(function (label) {
    if (label.anchorId == null) return;
    var conn = model.connectors.get(label.anchorId);
    if (!conn || conn.segments.length === 0) return;

    /* Find the longest segment. */
    var bestSeg = conn.segments[0];
    var bestLen = 0;
    for (var si = 0; si < conn.segments.length; si++) {
      var seg = conn.segments[si];
      var slen = Math.abs(seg.x2 - seg.x1) + Math.abs(seg.y2 - seg.y1);
      if (slen > bestLen) { bestLen = slen; bestSeg = seg; }
    }

    var isHorizontal = (bestSeg.y1 === bestSeg.y2);
    var halfLen = Math.floor(label.text.length / 2);

    if (isHorizontal) {
      var mx = Math.round((bestSeg.x1 + bestSeg.x2) / 2);
      label.x = mx - halfLen;
      label.y = bestSeg.y1 - 1;
    } else {
      var my = Math.round((bestSeg.y1 + bestSeg.y2) / 2);
      label.x = bestSeg.x1 + 1;
      label.y = my;
    }
  });
}

// ────────────────────────────────────────────────────────────────────
// § Main parse function
// ────────────────────────────────────────────────────────────────────

/**
 * Parse a canonical ASCII chart into a DiagramModel.
 *
 * This is the primary entry point for the parser module.  It runs
 * three passes over the input text:
 *
 *   1. Box detection
 *   2. Connector tracing
 *   3. Label detection
 *
 * @param {string} text - The raw ASCII chart text.
 * @param {Object}  [options]
 * @param {string}  [options.mode='lenient'] - 'strict' or 'lenient'.
 * @returns {import('./diagram-model').DiagramModel}
 */
function parse(text, options) {
  var opts = options || {};
  var mode = opts.mode || 'lenient';

  var g = textToGrid(text);
  var grid = g.grid, width = g.width, height = g.height;
  var model = new DiagramModel(width, height);
  var visited = new Set();

  /* Pass 1: detect boxes. */
  detectBoxes(grid, width, height, visited, model);

  /* Pass 2: trace connectors. */
  traceConnectors(grid, width, height, visited, model);

  /* Pass 3: detect labels. */
  detectLabels(grid, width, height, visited, model);

  /* Post-pass: anchor labels to nearby ports, then to nearby lines. */
  anchorLabelsToNearbyPorts(model);
  anchorLabelsToNearbyConnectors(model);

  /*
   * In lenient mode, collect any remaining unvisited non-space regions
   * as opaque text blocks (spec §7.11.5).
   */
  if (mode === 'lenient') {
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        if (!visited.has(x + ',' + y) && grid[y][x] !== ' ') {
          var t = '';
          var startX = x;
          while (x < width && !visited.has(x + ',' + y) && grid[y][x] !== ' ') {
            t += grid[y][x];
            visited.add(x + ',' + y);
            x++;
          }
          if (t.length > 0) {
            model.opaqueBlocks.push({ x: startX, y: y, text: t });
          }
        }
      }
    }
  }

  return model;
}

// ────────────────────────────────────────────────────────────────────
// § Exports
// ────────────────────────────────────────────────────────────────────

module.exports = {
  detectLabels: detectLabels,
  parse:        parse
};
