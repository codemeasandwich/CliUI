'use strict';

/**
 * lib/widget/diagram/data-builder-decision.js
 *
 * Converts a decision diagram descriptor into a DiagramModel.
 * Decision diagrams are flowcharts with decision nodes (rendered with
 * bracket text [question?]), edge labels (yes/no/error), and back-edges.
 *
 * Public API:
 *   buildDecisionFromData(data, defaultBorder)
 *
 * Descriptor format:
 *   {
 *     nodes: [{ id, text, kind?, borderStyle?, status? }],
 *     connections: [{ from, to, label?, backEdge?, style?, speed? }]
 *   }
 *
 * Node kinds:
 *   - 'process'  (default) — standard box
 *   - 'decision' — bracket text [question?], dashed border
 *   - 'terminal' — rounded border
 *   - 'state'    — standard box
 */

var DiagramModel     = require('./model-core').DiagramModel;
var BORDER_STYLES    = require('../../border/charsets').BORDER_STYLES;
var modelConst       = require('./model-constants');
var SIDE             = modelConst.SIDE;
var NODE_KIND        = modelConst.NODE_KIND;
var sideToArrowDir   = modelConst.sideToArrowDir;
var BorderStyleError = require('./diagram-errors').BorderStyleError;
var ConnectionError  = require('./diagram-errors').ConnectionError;

/**
 * Determine port side for a decision node outgoing connection.
 *
 * Decision nodes route outgoing edges to different sides based on
 * the edge label to create the characteristic branching layout:
 *   - back-edge            → LEFT (routes backward)
 *   - 'no' / 'error'      → BOTTOM (branches down)
 *   - primary / unlabeled  → RIGHT (continues forward)
 *
 * @param {Object} conn - Connection descriptor.
 * @returns {string} SIDE value for the source port.
 */
function decisionPortSide(conn) {
  if (conn.backEdge) return SIDE.LEFT;
  var label = (conn.label || '').toLowerCase();
  if (label === 'no' || label === 'error') return SIDE.BOTTOM;
  return SIDE.RIGHT;
}

/**
 * Build a DiagramModel from a decision diagram descriptor.
 *
 * @param {Object} data
 * @param {Array}  data.nodes - Node descriptors.
 * @param {string} data.nodes[].id
 * @param {string} [data.nodes[].text]
 * @param {string} [data.nodes[].kind] - 'process'|'decision'|'terminal'|'state'
 * @param {string} [data.nodes[].borderStyle]
 * @param {string} [data.nodes[].status]
 * @param {Array}  [data.connections] - Edge descriptors.
 * @param {string} data.connections[].from
 * @param {string} data.connections[].to
 * @param {string} [data.connections[].label]
 * @param {boolean} [data.connections[].backEdge]
 * @param {string} [data.connections[].style]
 * @param {number} [data.connections[].speed]
 * @param {string} [defaultBorder] - Default border style.
 * @returns {{ model: DiagramModel, idMap: Map, reverseMap: Map }}
 */
function buildDecisionFromData(data, defaultBorder) {
  if (defaultBorder && BORDER_STYLES.indexOf(defaultBorder) === -1) {
    throw new BorderStyleError(defaultBorder);
  }

  var model = new DiagramModel();
  var idMap = new Map();
  var reverseMap = new Map();

  var nodes = data.nodes || [];
  var connections = data.connections || [];

  /* ── Phase 1: Create boxes ──────────────────────────────────── */
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    if (!n.id) throw new ConnectionError('Node at index ' + i + ' missing id.');
    if (idMap.has(n.id)) throw new ConnectionError('Duplicate node id: ' + n.id);

    var kind = n.kind || NODE_KIND.PROCESS;
    var text = n.text || n.id;

    /* Decision nodes get bracket-wrapped text. */
    if (kind === NODE_KIND.DECISION && text.charAt(0) !== '[') {
      text = '[' + text + ']';
    }

    var lines = text.split('\n');
    var maxLine = 0;
    for (var li = 0; li < lines.length; li++) {
      if (lines[li].length > maxLine) maxLine = lines[li].length;
    }
    var w = Math.max(maxLine + 4, 10);
    var h = Math.max(lines.length + 2, 3);

    /* Select border style based on node kind. */
    var borderStyle = n.borderStyle || null;
    if (!borderStyle) {
      if (kind === NODE_KIND.DECISION)      borderStyle = 'dashed';
      else if (kind === NODE_KIND.TERMINAL) borderStyle = 'rounded';
      else                                  borderStyle = defaultBorder || null;
    }

    var box = model.addBox(0, 0, w, h, text, {
      borderStyle: borderStyle,
      status: n.status || null,
      kind: kind
    });

    idMap.set(n.id, box.id);
    reverseMap.set(box.id, n.id);
  }

  /* ── Phase 2: Create connections ────────────────────────────── */
  var portOffsets = new Map();

  for (var ci = 0; ci < connections.length; ci++) {
    var c = connections[ci];
    if (!c.from || !idMap.has(c.from)) {
      throw new ConnectionError('Connection ' + ci + ' references unknown node: ' + c.from);
    }
    if (!c.to || !idMap.has(c.to)) {
      throw new ConnectionError('Connection ' + ci + ' references unknown node: ' + c.to);
    }

    var srcBoxId = idMap.get(c.from);
    var dstBoxId = idMap.get(c.to);

    /* Determine port sides: decision nodes use smart side selection;
     * all others default to right-exit, left-entry. */
    var srcBox = model.getBox(srcBoxId);
    var srcSide = (srcBox && srcBox.kind === NODE_KIND.DECISION)
      ? decisionPortSide(c)
      : (c.backEdge ? SIDE.LEFT : SIDE.RIGHT);
    var dstSide = c.backEdge ? SIDE.RIGHT : SIDE.LEFT;

    var srcKey = srcBoxId + ':' + srcSide;
    var dstKey = dstBoxId + ':' + dstSide;
    var srcOff = portOffsets.get(srcKey) || 0;
    var dstOff = portOffsets.get(dstKey) || 0;
    portOffsets.set(srcKey, srcOff + 1);
    portOffsets.set(dstKey, dstOff + 1);

    /* model.addPort and model.addConnector always return valid objects
     * when called with IDs that exist in the model.  The source/dest
     * node IDs are validated above via idMap.has(), so null-checks
     * are unnecessary here — removed per dead-code rule. */
    var srcPort = model.addPort(srcBoxId, srcSide, srcOff);
    var dstPort = model.addPort(dstBoxId, dstSide, dstOff);

    var arrowDir = sideToArrowDir(dstSide);
    var conn = model.addConnector(srcPort.id, dstPort.id, arrowDir);

    if (c.label)         conn.lineLabel = c.label;
    if (c.backEdge)      conn.backEdge  = true;
    if (c.style)         conn.style     = c.style;
    if (c.speed != null) conn.speed     = c.speed;
  }

  return { model: model, idMap: idMap, reverseMap: reverseMap };
}

module.exports = { buildDecisionFromData: buildDecisionFromData };
