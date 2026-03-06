'use strict';
// @esm-group Widgets

/**
 * lib/widget/diagram/diagram-widget.js
 *
 * Barrel file — requires all widget sub-modules (which patch
 * Diagram.prototype as a side-effect) and re-exports Diagram.
 *
 * ───────────────────────────────────────────────────────────────────
 * Public API
 * ───────────────────────────────────────────────────────────────────
 *
 *   setSource(text)     — Parse ASCII text, rebuild model + render.
 *   getSource()         — Render current model back to canonical text.
 *   setModel(model)     — Replace the model directly.
 *   getModel()          — Return the live model.
 *   parse(text)         — Parse text without applying (returns model).
 *   load(text)          — Alias for setSource.
 *   serialize()         — Alias for getSource.
 *   setData(obj)        — Standard CliUI data setter.
 *   toggleChecked(id)   — Toggle checked on a box.
 *   startCurrentWork(id)— Mark a box as current-work.
 *   stopCurrentWork(id) — Remove current-work state.
 *   layout()            — Auto-arrange boxes.
 *   route()             — Recompute all connector paths.
 *
 * ───────────────────────────────────────────────────────────────────
 * Events emitted
 * ───────────────────────────────────────────────────────────────────
 *
 *   'box:click'        { boxId, hit }
 *   'box:dblclick'     { boxId, hit }
 *   'connector:click'  { connectorId, hit }
 *   'connector:edit'   { connectorId, text }
 *   'label:click'      { labelId, hit }
 *   'label:dblclick'   { labelId, hit }
 *   'label:edit'       { labelId, text }
 *   'gate:click'       { boxId, portId, hit }
 *   'drag:start'       { boxId, x, y }
 *   'drag:move'        { boxId, dx, dy }
 *   'drag:end'         { boxId }
 *   'focus:box'        { boxId, nodeId }
 *   'action'           { boxId, nodeId }
 *   'model:change'     (no payload — model has been mutated)
 */

var Diagram = require('./widget-core').Diagram;

/* Side-effect imports — each patches Diagram.prototype. */
require('./widget-api');
require('./widget-api-transition');
require('./widget-render');
require('./widget-render-viewport');
require('./widget-render-travel');
require('./widget-render-conn-anim');
require('./widget-mouse');
require('./widget-drag');
require('./widget-edit');
require('./widget-keyboard');

module.exports = Diagram;
