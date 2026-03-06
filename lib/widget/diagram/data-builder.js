'use strict';

/**
 * lib/widget/diagram/data-builder.js
 *
 * Converts a structured data object (nodes + connections) into a
 * DiagramModel, using the existing model mutation API.
 *
 * This module bridges the gap between the user-friendly declarative
 * format ({ nodes: [...], connections: [...] }) and the internal
 * model representation.  All entity creation goes through the
 * established model methods (addBox, addPort, addConnector) so the
 * model's referential integrity is maintained automatically.
 */

var DiagramModel     = require('./model-core').DiagramModel;
var BORDER_STYLES    = require('../../border/charsets').BORDER_STYLES;
var modelConst       = require('./model-constants');
var SIDE             = modelConst.SIDE;
var sideToArrowDir   = modelConst.sideToArrowDir;
var BorderStyleError = require('./diagram-errors').BorderStyleError;
var ConnectionError  = require('./diagram-errors').ConnectionError;

/**
 * Build a DiagramModel from a structured data descriptor.
 *
 * @param {Object}   data - Structured descriptor with nodes and connections.
 * @param {Array}    data.nodes - Array of node descriptors.
 * @param {string}   data.nodes[].id     - User-defined string ID.
 * @param {string}   [data.nodes[].text] - Box content text.
 * @param {number}   [data.nodes[].width]  - Override box width.
 * @param {number}   [data.nodes[].height] - Override box height.
 * @param {string}   [data.nodes[].borderStyle] - Named border charset.
 * @param {string}   [data.nodes[].status] - STATUS enum value.
 * @param {boolean}  [data.nodes[].checked] - Checked marker.
 * @param {boolean}  [data.nodes[].currentWork] - Current-work state.
 * @param {Array}    [data.connections] - Array of connection descriptors.
 * @param {string}   data.connections[].from - Source node string ID.
 * @param {string}   data.connections[].to   - Target node string ID.
 * @param {string}   [data.connections[].arrow]   - Arrow direction hint.
 * @param {string}   [data.connections[].label]   - Line label text.
 * @param {string}   [data.connections[].style]   - CONN_STYLE value.
 * @param {string}   [data.connections[].marker]  - Custom marker char.
 * @param {string}   [data.connections[].head]    - Custom arrowhead char.
 * @param {number}   [data.connections[].speed]   - Animation tick ms.
 * @param {number}   [data.connections[].weight]  - Line weight hint.
 * @param {boolean}  [data.connections[].bidirectional] - Arrows at both ends.
 * @param {number}   [data.connections[].density]  - Stream animation fill fraction (0.0-1.0).
 * @param {boolean}  [data.connections[].backEdge] - True if this is a back-edge (excluded from layering).
 * @param {string}   [defaultBorder] - Default border style for all nodes.
 * @returns {{ model: DiagramModel, idMap: Map<string,number>, reverseMap: Map<number,string> }}
 */
function buildModelFromData(data, defaultBorder) {

  /* Validate default border if provided. */
  if (defaultBorder && BORDER_STYLES.indexOf(defaultBorder) === -1) {
    throw new BorderStyleError(defaultBorder);
  }

  var model = new DiagramModel();

  /* Maps between user string IDs and internal numeric box IDs. */
  var idMap = new Map();
  var reverseMap = new Map();

  var nodes = data.nodes || [];

  /* ── Phase 1: Create boxes ─────────────────────────────────────── */
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];

    if (!n.id) {
      throw new ConnectionError('Node at index ' + i + ' is missing an id.');
    }
    if (idMap.has(n.id)) {
      throw new ConnectionError('Duplicate node id: ' + n.id);
    }

    /* Compute box dimensions: use explicit or derive from text. */
    var text = n.text || n.id;
    var lines = text.split('\n');
    var maxLine = 0;
    for (var li = 0; li < lines.length; li++) {
      if (lines[li].length > maxLine) maxLine = lines[li].length;
    }
    var w = n.width  || Math.max(maxLine + 4, 10);
    var h = n.height || Math.max(lines.length + 2, 3);

    /* Resolve border style: node-level overrides default. */
    var borderStyle = n.borderStyle || defaultBorder || null;

    var box = model.addBox(0, 0, w, h, text, {
      checked:     n.checked,
      currentWork: n.currentWork,
      borderStyle: borderStyle,
      status:      n.status,
      kind:        n.kind || null
    });

    idMap.set(n.id, box.id);
    reverseMap.set(box.id, n.id);
  }

  /* ── Phase 2: Create connections ───────────────────────────────── */
  var connections = data.connections || [];
  /* Track port offset per box-side so multiple connections fan out. */
  var portOffsets = new Map();

  for (var ci = 0; ci < connections.length; ci++) {
    var c = connections[ci];

    if (!c.from || !idMap.has(c.from)) {
      throw new ConnectionError(
        'Connection at index ' + ci + ' references unknown source node: ' + c.from
      );
    }
    if (!c.to || !idMap.has(c.to)) {
      throw new ConnectionError(
        'Connection at index ' + ci + ' references unknown target node: ' + c.to
      );
    }

    var srcBoxId = idMap.get(c.from);
    var dstBoxId = idMap.get(c.to);

    /* Determine port sides: source exits right, destination enters left. */
    var srcSide = SIDE.RIGHT;
    var dstSide = SIDE.LEFT;

    /* Allocate incrementing offsets for each box-side pair. */
    var srcKey = srcBoxId + ':' + srcSide;
    var dstKey = dstBoxId + ':' + dstSide;
    var srcOff = portOffsets.get(srcKey) || 0;
    var dstOff = portOffsets.get(dstKey) || 0;
    portOffsets.set(srcKey, srcOff + 1);
    portOffsets.set(dstKey, dstOff + 1);

    /* model.addPort and model.addConnector always return valid objects
     * when called with IDs that exist in the model.  The source/dest box
     * IDs are validated above via idMap.has(), so null-checks are
     * unnecessary here — removed per dead-code rule. */
    var srcPort = model.addPort(srcBoxId, srcSide, srcOff);
    var dstPort = model.addPort(dstBoxId, dstSide, dstOff);

    /* Determine arrow direction from destination side. */
    var arrowDir = c.arrow || sideToArrowDir(dstSide);

    var conn = model.addConnector(srcPort.id, dstPort.id, arrowDir);

    /* Apply optional connection properties. */
    if (c.label)         conn.lineLabel     = c.label;
    if (c.style)         conn.style         = c.style;
    if (c.marker)        conn.marker        = c.marker;
    if (c.head)          conn.head          = c.head;
    if (c.speed != null) conn.speed         = c.speed;
    if (c.weight != null) conn.weight       = c.weight;
    if (c.bidirectional) conn.bidirectional = true;
    if (c.density != null) conn.density    = c.density;
    if (c.backEdge)        conn.backEdge   = true;

    /* For bidirectional connectors, add a source arrow in the exit direction. */
    if (c.bidirectional) {
      conn.sourceArrowDir = sideToArrowDir(srcSide);
    }
  }

  return { model: model, idMap: idMap, reverseMap: reverseMap };
}

module.exports = { buildModelFromData: buildModelFromData };
