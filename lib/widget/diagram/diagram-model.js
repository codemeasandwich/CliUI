'use strict';
// @esm-group Widgets

/**
 * lib/widget/diagram/diagram-model.js - barrel / re-export.
 *
 * Loads all model sub-modules (which patch DiagramModel.prototype)
 * then re-exports the public API unchanged.
 */

var constants = require('./model-constants');
var entities  = require('./model-entities');
var core      = require('./model-core');

/* Side-effect imports: each patches DiagramModel.prototype. */
require('./model-queries');
require('./model-box-mutations');
require('./model-label-reposition');
require('./model-reanchor');
require('./model-port-mutations');
require('./model-conn-mutations');
require('./model-serialization');

module.exports = {
  SIDE:             constants.SIDE,
  BOX_STATE:        constants.BOX_STATE,
  LABEL_TYPE:       constants.LABEL_TYPE,
  DiagramModel:     core.DiagramModel,
  createPort:       entities.createPort,
  createBox:        entities.createBox,
  createConnector:  entities.createConnector,
  createLabel:      entities.createLabel
};