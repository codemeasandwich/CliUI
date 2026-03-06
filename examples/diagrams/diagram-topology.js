'use strict';

/**
 * examples/diagrams/diagram-topology.js
 *
 * Infrastructure Topology — headless parse/render, grid layout, and
 * advanced event handling demo.
 *
 * This example showcases two complementary workflows:
 *
 *   1. **Headless parse/render** — `parseDiagram()` and
 *      `renderDiagram()` are used as standalone functions (no blessed
 *      screen required) to parse an ASCII diagram, mutate the model
 *      in-memory (rename boxes, resize), and produce a new canonical
 *      ASCII string.
 *
 *   2. **Interactive split view** — a `galactica.grid` places two
 *      diagram widgets side-by-side.  The left panel shows the
 *      *original* topology, the right panel shows the *mutated*
 *      version.  Both are fully interactive.
 *
 * Features demonstrated:
 *   • `galactica.parseDiagram()` — headless ASCII → model parse
 *   • `galactica.renderDiagram()` — headless model → ASCII render
 *   • Model mutation: `setBoxText()`, `resizeBox()`
 *   • `layout({ gapX, gapY })` — custom layout spacing
 *   • `route()` — A* connector routing
 *   • `connector:click` and `gate:click` events
 *   • Grid layout with two diagram widgets (split view)
 *
 * Run:
 *   node examples/diagrams/diagram-topology.js
 *
 * Controls:
 *   - Click a connector to see its ID in the status bar.
 *   - Click a gate (╢) to see the port details.
 *   - Press 'l' to re-layout both panels.
 *   - Press 'q' or Escape to quit.
 */

const galactica = require('../../');

const screen = galactica.screen();

screen.title = 'Diegetic — Infrastructure Topology (Headless + Grid)';

// ── ASCII source: multi-tier deployment topology ───────────────────
//
// A load-balancer fans out to two application servers which converge
// on a shared database and a cache tier.  This tree-like shape
// exercises the layout engine's multi-layer, multi-branch handling.

const topoSource = [
  '┌────────────────┐',
  '│ Load Balancer  │',
  '└────────────────┘',
  '        │',
  '   ┌────┴─────┐',
  '   │          │',
  '   ▼          ▼',
  '┌──────┐  ┌──────┐',
  '│ App1 │  │ App2 │',
  '└──────┘  └──────┘',
  '   │          │',
  '   └────┬─────┘',
  '        │',
  '   ┌────┴─────┐',
  '   │          │',
  '   ▼          ▼',
  '┌──────┐  ┌──────┐',
  '│  DB  │  │Cache │',
  '└──────┘  └──────┘'
].join('\n');

// ── Step 1: Headless parse ─────────────────────────────────────────
//
// parseDiagram() converts raw ASCII text into a DiagramModel without
// touching blessed or the terminal.  This is ideal for server-side
// processing, CI validation, or scripted diagram transformations.

const originalModel = galactica.parseDiagram(topoSource);

// ── Step 2: Clone & mutate ─────────────────────────────────────────
//
// We clone the model so the original stays unmodified (for display in
// the left panel).  Then we rename two boxes and resize them to fit
// the new longer text.  This demonstrates in-memory model surgery.

const mutatedModel = originalModel.clone();

// Find boxes by scanning for matching text.
// In a real application you would track IDs, but this demonstrates
// the query API.
mutatedModel.boxes.forEach(function (box) {
  if (box.text.trim() === 'App1') {
    mutatedModel.setBoxText(box.id, 'Web Tier');
    mutatedModel.resizeBox(box.id, 12, 3);
  }
  if (box.text.trim() === 'App2') {
    mutatedModel.setBoxText(box.id, 'API Tier');
    mutatedModel.resizeBox(box.id, 12, 3);
  }
  if (box.text.trim() === 'Cache') {
    mutatedModel.setBoxText(box.id, 'Redis');
  }
});

// ── Step 3: Headless render ────────────────────────────────────────
//
// renderDiagram() converts a DiagramModel back to canonical ASCII.
// This text could be written to a file, committed to version control,
// embedded in documentation, or diff'd against a previous version.

const mutatedAscii = galactica.renderDiagram(mutatedModel);

// (The rendered text is used below as the `source` for the right
// panel widget.)

// ── Grid layout ────────────────────────────────────────────────────
//
// A 1×2 grid splits the screen horizontally into two diagram widgets.
// The left panel shows the original topology; the right panel shows
// the mutated version with renamed/resized boxes.

const grid = new galactica.grid({
  rows: 12,
  cols: 12,
  screen: screen
});

// Left panel — original topology.
const diagOriginal = grid.set(0, 0, 11, 6, galactica.diagram, {
  label: ' Original Topology ',
  border: { type: 'line' },
  style: { border: { fg: 'cyan' } },
  mouse: true,
  interactive: true,
  animate: false,
  source: topoSource
});

// Right panel — mutated topology.
// We feed the headless-rendered ASCII so the widget parses it fresh,
// demonstrating the full parse→mutate→render→parse round-trip.
const diagMutated = grid.set(0, 6, 11, 6, galactica.diagram, {
  label: ' Mutated Topology ',
  border: { type: 'line' },
  style: { border: { fg: 'magenta' } },
  mouse: true,
  interactive: true,
  animate: false,
  source: mutatedAscii
});

// ── Status bar ─────────────────────────────────────────────────────

const statusBar = grid.set(11, 0, 1, 12, galactica.box, {
  content: ' q: quit | l: layout | click connector/gate for details',
  style: { fg: 'white', bg: 'blue' },
  tags: true
});

// ── Apply layout + routing to both panels ──────────────────────────
//
// Custom spacing (gapX: 8) gives the multi-tier topology some room
// to breathe so the A* router can lay clean orthogonal paths.

[diagOriginal, diagMutated].forEach(function (d) {
  d.layout({ gapX: 8, gapY: 3 });
  d.route();
});

// ── Event listeners ────────────────────────────────────────────────
//
// connector:click and gate:click are the two events not demonstrated
// in the other examples.  They fire when the user clicks on a
// connector segment / arrowhead or a gate (╢) / port position.

function attachEvents(d, panelName) {
  d.on('connector:click', function (ev) {
    statusBar.setContent(
      ' {yellow-fg}[' + panelName + ']{/yellow-fg} connector:click — connector #' +
      ev.connectorId
    );
    screen.render();
  });

  d.on('gate:click', function (ev) {
    statusBar.setContent(
      ' {cyan-fg}[' + panelName + ']{/cyan-fg} gate:click — box #' +
      ev.boxId + ', port #' + ev.portId
    );
    screen.render();
  });

  d.on('box:click', function (ev) {
    const m = d.getModel();
    const box = m ? m.getBox(ev.boxId) : null;
    const name = box ? box.text.trim() : '#' + ev.boxId;
    statusBar.setContent(
      ' {green-fg}[' + panelName + ']{/green-fg} box:click — ' + name
    );
    screen.render();
  });
}

attachEvents(diagOriginal, 'Original');
attachEvents(diagMutated,  'Mutated');

// ── Key bindings ───────────────────────────────────────────────────

screen.key(['q', 'escape'], function () {
  return process.exit(0);
});

screen.key(['l'], function () {
  [diagOriginal, diagMutated].forEach(function (d) {
    d.layout({ gapX: 8, gapY: 3 });
    d.route();
  });
  statusBar.setContent(' Auto-layout applied to both panels');
  screen.render();
});

// ── Initial render ─────────────────────────────────────────────────

screen.render();
