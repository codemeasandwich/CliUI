'use strict';

/**
 * examples/diagrams/diagram-drag.js
 *
 * Click-and-drag demo for the Diegetic diagram editor.
 *
 * Demonstrates:
 *   - Drag any box with the mouse — connectors automatically repath
 *     around obstacles in real time using the A* occupancy-grid router.
 *   - Debug overlay panels show every step's state so problems are
 *     visible immediately (debug log + state panel).
 *   - Press 'l' to snap everything back to auto-layout.
 *   - Press 'r' to reroute connectors without moving boxes.
 *   - Press 'd' to dump full internal state to the debug log.
 *   - Double-click a box to toggle its ✔ checked state.
 *
 * Run:
 *   node examples/diagrams/diagram-drag.js
 *
 * Controls:
 *   mouse drag .... move a box (arrows repath live)
 *   double-click .. toggle ✔ on a box
 *   l ............. auto-layout all boxes
 *   r ............. reroute connectors in place
 *   d ............. dump full state to debug log
 *   q / Escape .... quit
 */

var galactica = require('../../');

/* ── [1] Screen ─────────────────────────────────────────────────── */

var screen = galactica.screen();
screen.title = 'Diagram Drag — Debug Overlay';

/* ── [2] Build model: A ──▶ B ──▶ C ────────────────────────────── */

var DiagramModel = galactica.DiagramModel;
var model = new DiagramModel(60, 16);

var boxA = model.addBox(1, 1, 9, 3, 'A');
var boxB = model.addBox(16, 1, 9, 3, 'B');
var boxC = model.addBox(31, 1, 9, 3, 'C');

// Wire A → B
var portAOut = model.addPort(boxA.id, 'right', 0);
var portBIn  = model.addPort(boxB.id, 'left',  0);
model.addConnector(portAOut.id, portBIn.id, 'right');

// Wire B → C
var portBOut = model.addPort(boxB.id, 'right', 0);
var portCIn  = model.addPort(boxC.id, 'left',  0);
model.addConnector(portBOut.id, portCIn.id, 'right');

/* ── [3] Diagram widget (left 65%) ──────────────────────────────── */

var diag = galactica.diagram({
  parent: screen,
  label: ' Drag Demo — move any box ',
  top: 0,
  left: 0,
  width: '65%',
  height: '100%-1',
  border: { type: 'line' },
  style: { border: { fg: 'cyan' } },
  mouse: true,
  interactive: true,
  animate: false
});

/* ── [4] Inject model, layout, route ────────────────────────────── */

diag.setModel(model);
diag.layout({ gapX: 6, gapY: 2 });
diag.route();

/* ── [5] Status bar ─────────────────────────────────────────────── */

var statusBar = galactica.box({
  parent: screen,
  bottom: 0,
  left: 0,
  width: '100%',
  height: 1,
  tags: true,
  content: ' {bold}drag box{/bold}: move | {bold}drag empty{/bold}: pan | {bold}dblclick{/bold}: ✔ | {bold}l{/bold}: layout | {bold}r{/bold}: reroute | {bold}p{/bold}: center view | {bold}q{/bold}: quit',
  style: { fg: 'white', bg: 'blue' }
});

/* ── [6] Debug overlay (panels + event listeners) ───────────────── */

var debug = require('./diagram-drag-debug')(screen, diag, statusBar);

/* ── [7] Key bindings ───────────────────────────────────────────── */

screen.key(['q', 'escape'], function () {
  return process.exit(0);
});

screen.key(['l'], function () {
  diag.layout();
  debug.log('{green-fg}layout(){/green-fg} applied');
  statusBar.setContent(' {green-fg}Auto-layout applied{/green-fg}');
  debug.refreshState();
  screen.render();
});

screen.key(['r'], function () {
  diag.route();
  debug.log('{green-fg}route(){/green-fg} applied');
  statusBar.setContent(' {green-fg}Rerouted{/green-fg}');
  debug.refreshState();
  screen.render();
});

screen.key(['p'], function () {
  diag.resetPan();
  debug.log('{green-fg}resetPan(){/green-fg} — re-centered');
  statusBar.setContent(' {green-fg}View re-centered{/green-fg}');
  debug.refreshState();
  screen.render();
});

screen.key(['d'], function () {
  debug.log('─── Full State Dump ───');
  var m = diag.getModel();
  if (m) {
    m.boxes.forEach(function (b) {
      debug.log('  box#' + b.id + ' "' + b.text.trim() + '" (' + b.x + ',' + b.y + ' ' + b.w + 'x' + b.h + ')');
    });
    m.ports.forEach(function (p) {
      debug.log('  port#' + p.id + ' box=' + p.boxId + ' side=' + p.side + ' off=' + p.offset);
    });
    m.connectors.forEach(function (c) {
      debug.log('  conn#' + c.id + ' from=' + c.fromPortId + ' to=' + c.toPortId +
          ' pts=' + (c.path ? c.path.length : 0));
    });
  }
  debug.log('  _grid: ' + (diag._grid ? 'exists' : 'null'));
  debug.log('  _dragBoxId: ' + diag._dragBoxId);
  debug.log('  screen._clickable length: ' + (screen.clickable ? screen.clickable.length : 'n/a'));
  debug.log('─── End Dump ───');
  debug.refreshState();
  screen.render();
});

/* ── [8] Initial render ─────────────────────────────────────────── */

debug.refreshState();
screen.render();
