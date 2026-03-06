'use strict';

/**
 * lib/widget/diagram/model-serialization.js
 *
 * clone / toJSON / fromJSON patched onto DiagramModel.
 */

var DiagramModel = require('./model-core').DiagramModel;

/**
 * Deep-clone the model.
 * @returns {DiagramModel}
 */
DiagramModel.prototype.clone = function clone() {
  var copy = new DiagramModel(this.width, this.height);
  copy._nextId = this._nextId;

  for (var boxEntry of this.boxes) {
    var box = boxEntry[1];
    var b = Object.assign({}, box, {
      ports: box.ports.map(function (p) {
        return Object.assign({}, p, { connectorIds: p.connectorIds.slice() });
      })
    });
    copy.boxes.set(b.id, b);
    for (var i = 0; i < b.ports.length; i++) {
      copy.ports.set(b.ports[i].id, b.ports[i]);
    }
  }

  for (var connEntry of this.connectors) {
    var conn = connEntry[1];
    copy.connectors.set(conn.id, Object.assign({}, conn, {
      segments: conn.segments.map(function (s) { return Object.assign({}, s); }),
      endpointLabels: conn.endpointLabels.map(function (l) { return Object.assign({}, l); })
    }));
  }

  for (var labEntry of this.labels) {
    copy.labels.set(labEntry[0], Object.assign({}, labEntry[1]));
  }

  copy.opaqueBlocks = this.opaqueBlocks.map(function (b) { return Object.assign({}, b); });
  return copy;
};

/**
 * Serialize to a JSON-safe plain object.
 * @returns {Object}
 */
DiagramModel.prototype.toJSON = function toJSON() {
  return {
    width:        this.width,
    height:       this.height,
    boxes:        Array.from(this.boxes.values()),
    connectors:   Array.from(this.connectors.values()),
    labels:       Array.from(this.labels.values()),
    opaqueBlocks: this.opaqueBlocks
  };
};

/**
 * Restore a model from a toJSON() object.
 * @param {Object} json
 * @returns {DiagramModel}
 */
DiagramModel.fromJSON = function fromJSON(json) {
  var m = new DiagramModel(json.width, json.height);
  var maxId = 0;

  var boxes = json.boxes || [];
  for (var bi = 0; bi < boxes.length; bi++) {
    var b = boxes[bi];
    var box = Object.assign({}, b, {
      ports: (b.ports || []).map(function (p) {
        var port = Object.assign({}, p, { connectorIds: (p.connectorIds || []).slice() });
        m.ports.set(port.id, port);
        if (port.id > maxId) maxId = port.id;
        return port;
      })
    });
    m.boxes.set(box.id, box);
    if (box.id > maxId) maxId = box.id;
  }

  var conns = json.connectors || [];
  for (var ci = 0; ci < conns.length; ci++) {
    var c = conns[ci];
    m.connectors.set(c.id, Object.assign({}, c, {
      segments: (c.segments || []).map(function (s) { return Object.assign({}, s); }),
      endpointLabels: (c.endpointLabels || []).map(function (l) { return Object.assign({}, l); })
    }));
    if (c.id > maxId) maxId = c.id;
  }

  var labels = json.labels || [];
  for (var li = 0; li < labels.length; li++) {
    m.labels.set(labels[li].id, Object.assign({}, labels[li]));
    if (labels[li].id > maxId) maxId = labels[li].id;
  }

  m.opaqueBlocks = (json.opaqueBlocks || []).slice();
  m._nextId = maxId + 1;
  return m;
};
