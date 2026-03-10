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

const Diagram = require('./diagram-widget');
const { DiagramModel, SIDE, BOX_STATE, LABEL_TYPE,
  createBox, createPort, createConnector, createLabel }
  = require('./diagram-model');
const { parse } = require('./diagram-parser');
const { render } = require('./diagram-renderer');
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
const { CONN_STYLE, STATUS, NODE_KIND }
  = require('./model-constants');
const { buildModelFromData }
  = require('./data-builder');
const { buildCycleFromData }
  = require('./data-builder-cycle');
const { buildDecisionFromData }
  = require('./data-builder-decision');
const { buildMermaidFromData }
  = require('./data-builder-mermaid');
const { renderMermaid }
  = require('./diagram-mermaid-renderer');
const { overlayConnAnimations, segmentsToCells, SPINNER_FRAMES, SNAKE_PATTERN }
  = require('./render-conn-overlay');
const { CharBuffer }
  = require('./render-buffer');

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

  /* Mermaid parser & renderer. */
  buildMermaidFromData,
  renderMermaid,

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

  /* Enums & constants (continued). */
  NODE_KIND,

  /* Structured data builders. */
  buildModelFromData,
  buildCycleFromData,
  buildDecisionFromData,

  /* Animation / render utilities. */
  overlayConnAnimations,
  segmentsToCells,
  SPINNER_FRAMES,
  SNAKE_PATTERN,
  CharBuffer
};
