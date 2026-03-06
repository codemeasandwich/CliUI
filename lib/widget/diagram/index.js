'use strict';
// @esm-group Widgets

/**
 * lib/widget/diagram/index.js
 *
 * Barrel export for the Diegetic diagram editor module.
 *
 * Re-exports the widget constructor, model class, parser, renderer,
 * and other public utilities so consumers can import from a single
 * path:
 *
 *   const { Diagram, DiagramModel, parse, render } = require('./diagram');
 */

const Diagram       = require('./diagram-widget');
const { DiagramModel, SIDE, BOX_STATE, LABEL_TYPE,
        createBox, createPort, createConnector, createLabel }
                    = require('./diagram-model');
const { parse }     = require('./diagram-parser');
const { render }    = require('./diagram-renderer');
const { routeAll, rerouteAffected }
                    = require('./diagram-router');
const { layout, distributePorts }
                    = require('./diagram-layout');
const { hitTest, hitTestRegion, hitTestNearest, HIT_KIND }
                    = require('./diagram-hit-test');
const { Frame, diff, diffRegion, dirtyRect }
                    = require('./diagram-diff');
const { OccupancyGrid, CELL_TYPE }
                    = require('./occupancy-grid');
const { BorderStyleError, ConnectionError }
                    = require('./diagram-errors');
const { BORDER_STYLES }
                    = require('../../border/charsets');
const { CONN_STYLE, STATUS }
                    = require('./model-constants');
const { buildModelFromData }
                    = require('./data-builder');

module.exports = {
  /* Widget constructor (primary export). */
  Diagram,

  /* Model. */
  DiagramModel,
  SIDE,
  BOX_STATE,
  LABEL_TYPE,
  createBox,
  createPort,
  createConnector,
  createLabel,

  /* Parser & renderer. */
  parse,
  render,

  /* Routing. */
  routeAll,
  rerouteAffected,

  /* Layout. */
  layout,
  distributePorts,

  /* Hit-testing. */
  hitTest,
  hitTestRegion,
  hitTestNearest,
  HIT_KIND,

  /* Diff. */
  Frame,
  diff,
  diffRegion,
  dirtyRect,

  /* Grid. */
  OccupancyGrid,
  CELL_TYPE,

  /* Errors. */
  BorderStyleError,
  ConnectionError,

  /* Enums & constants. */
  BORDER_STYLES,
  CONN_STYLE,
  STATUS,

  /* Structured data builder. */
  buildModelFromData
};
