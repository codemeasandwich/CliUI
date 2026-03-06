'use strict';

/**
 * lib/widget/diagram/data-builder-cycle.js
 *
 * Converts a cycle diagram descriptor (groups + states + transitions)
 * into a DiagramModel.  Cycle diagrams represent cyclical state flows
 * where states are grouped in horizontal lanes and back-edges wrap
 * around from the end of a lane back to its beginning.
 *
 * Public API:
 *   buildCycleFromData(data)
 *
 * The descriptor format:
 *   {
 *     groups:      [{ id, label, states: [stateId, ...] }],
 *     states:      [{ id, text, borderStyle?, status? }],
 *     transitions: [{ from, to, label?, backEdge?, style?, speed? }]
 *   }
 */

var DiagramModel     = require('./model-core').DiagramModel;
var BORDER_STYLES    = require('../../border/charsets').BORDER_STYLES;
var modelConst       = require('./model-constants');
var SIDE             = modelConst.SIDE;
var NODE_KIND        = modelConst.NODE_KIND;
var sideToArrowDir   = modelConst.sideToArrowDir;
var BorderStyleError = require('./diagram-errors').BorderStyleError;
var ConnectionError  = require('./diagram-errors').ConnectionError;

/* ── Layout constants ──────────────────────────────────────────── */

/** Horizontal gap between states inside a group. */
var INNER_GAP_X = 4;

/** Vertical gap between group rows. */
var GROUP_GAP_Y = 3;

/** Padding inside group container for states. */
var GROUP_PADDING = 2;

/**
 * Build a DiagramModel from a cycle diagram descriptor.
 *
 * @param {Object}  data
 * @param {Array}   data.groups      - Group descriptors.
 * @param {string}  data.groups[].id    - Unique group ID.
 * @param {string}  data.groups[].label - Group header text.
 * @param {Array}   data.groups[].states - Ordered state IDs within.
 * @param {Array}   data.states      - State node descriptors.
 * @param {string}  data.states[].id    - Unique state ID.
 * @param {string}  [data.states[].text] - Display text (defaults to id).
 * @param {string}  [data.states[].borderStyle]
 * @param {string}  [data.states[].status]
 * @param {Array}   [data.transitions] - Connections between states.
 * @param {string}  data.transitions[].from
 * @param {string}  data.transitions[].to
 * @param {string}  [data.transitions[].label]
 * @param {boolean} [data.transitions[].backEdge]
 * @param {string}  [data.transitions[].style]
 * @param {number}  [data.transitions[].speed]
 * @param {string}  [defaultBorder] - Default border style for states.
 * @returns {{ model: DiagramModel, idMap: Map, reverseMap: Map, groupMap: Map }}
 */
function buildCycleFromData(data, defaultBorder) {
  if (defaultBorder && BORDER_STYLES.indexOf(defaultBorder) === -1) {
    throw new BorderStyleError(defaultBorder);
  }

  var model = new DiagramModel();
  var idMap = new Map();
  var reverseMap = new Map();
  var groupMap = new Map();

  var states = data.states || [];
  var groups = data.groups || [];
  var transitions = data.transitions || [];

  /* ── Phase 1: Create state boxes ────────────────────────────── */
  for (var i = 0; i < states.length; i++) {
    var s = states[i];
    if (!s.id) throw new ConnectionError('State at index ' + i + ' missing id.');
    if (idMap.has(s.id)) throw new ConnectionError('Duplicate state id: ' + s.id);

    var text = s.text || s.id;
    var lines = text.split('\n');
    var maxLine = 0;
    for (var li = 0; li < lines.length; li++) {
      if (lines[li].length > maxLine) maxLine = lines[li].length;
    }
    var w = Math.max(maxLine + 4, 10);
    var h = Math.max(lines.length + 2, 3);

    var box = model.addBox(0, 0, w, h, text, {
      borderStyle: s.borderStyle || defaultBorder || null,
      status: s.status || null,
      kind: NODE_KIND.STATE
    });

    idMap.set(s.id, box.id);
    reverseMap.set(box.id, s.id);
  }

  /* ── Phase 2: Create group containers and position states ──── */
  var groupY = 1;

  for (var gi = 0; gi < groups.length; gi++) {
    var g = groups[gi];
    if (!g.id) throw new ConnectionError('Group at index ' + gi + ' missing id.');
    if (groupMap.has(g.id)) throw new ConnectionError('Duplicate group id: ' + g.id);

    /* Collect member state boxes. */
    var memberIds = g.states || [];
    var members = [];
    for (var mi = 0; mi < memberIds.length; mi++) {
      var stateBoxId = idMap.get(memberIds[mi]);
      if (stateBoxId == null) {
        throw new ConnectionError('Group "' + g.id + '" references unknown state: ' + memberIds[mi]);
      }
      members.push(model.getBox(stateBoxId));
    }

    /* Position states left-to-right inside the group. */
    var innerX = GROUP_PADDING + 1;
    var maxStateH = 3;
    for (var si = 0; si < members.length; si++) {
      members[si].x = innerX;
      members[si].y = groupY + GROUP_PADDING + 1;
      innerX += members[si].width + INNER_GAP_X;
      if (members[si].height > maxStateH) maxStateH = members[si].height;
    }

    /* Create group container box. */
    var groupW = innerX - INNER_GAP_X + GROUP_PADDING + 1;
    var groupH = maxStateH + (GROUP_PADDING * 2) + 2;
    var groupBox = model.addBox(1, groupY, groupW, groupH, g.label || g.id, {
      borderStyle: 'double',
      kind: NODE_KIND.PROCESS
    });

    /* Mark member states as belonging to this group. */
    for (var mk = 0; mk < members.length; mk++) {
      members[mk].groupId = groupBox.id;
    }

    groupMap.set(g.id, groupBox.id);
    groupY += groupH + GROUP_GAP_Y;
  }

  /* Fit model bounds. */
  model.width = Math.max(model.width, 80);
  model.height = Math.max(model.height, groupY + 2);

  /* ── Phase 3: Create transitions ────────────────────────────── */
  var portOffsets = new Map();

  for (var ti = 0; ti < transitions.length; ti++) {
    var t = transitions[ti];
    if (!t.from || !idMap.has(t.from)) {
      throw new ConnectionError('Transition ' + ti + ' references unknown state: ' + t.from);
    }
    if (!t.to || !idMap.has(t.to)) {
      throw new ConnectionError('Transition ' + ti + ' references unknown state: ' + t.to);
    }

    var srcBoxId = idMap.get(t.from);
    var dstBoxId = idMap.get(t.to);

    /* Back-edges: source exits left, destination enters right.
     * Normal edges: source exits right, destination enters left. */
    var srcSide = t.backEdge ? SIDE.LEFT : SIDE.RIGHT;
    var dstSide = t.backEdge ? SIDE.RIGHT : SIDE.LEFT;

    var srcKey = srcBoxId + ':' + srcSide;
    var dstKey = dstBoxId + ':' + dstSide;
    var srcOff = portOffsets.get(srcKey) || 0;
    var dstOff = portOffsets.get(dstKey) || 0;
    portOffsets.set(srcKey, srcOff + 1);
    portOffsets.set(dstKey, dstOff + 1);

    /* model.addPort and model.addConnector always return valid objects
     * when called with IDs that exist in the model.  The source/dest
     * state IDs are validated above via idMap.has(), so null-checks
     * are unnecessary here — removed per dead-code rule. */
    var srcPort = model.addPort(srcBoxId, srcSide, srcOff);
    var dstPort = model.addPort(dstBoxId, dstSide, dstOff);

    var arrowDir = sideToArrowDir(dstSide);
    var conn = model.addConnector(srcPort.id, dstPort.id, arrowDir);

    if (t.label)         conn.lineLabel = t.label;
    if (t.backEdge)      conn.backEdge  = true;
    if (t.style)         conn.style     = t.style;
    if (t.speed != null) conn.speed     = t.speed;
  }

  /* skipLayout: true tells _applyBuilderResult to skip the auto-layout
   * engine.  Cycle diagrams position states manually inside group
   * containers (Phase 2 above); running Kahn's topological sort would
   * rearrange boxes into independent layers and destroy the group
   * containment layout. */
  return {
    model: model, idMap: idMap, reverseMap: reverseMap,
    groupMap: groupMap, skipLayout: true
  };
}

module.exports = { buildCycleFromData: buildCycleFromData };
