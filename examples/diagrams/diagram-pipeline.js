'use strict';

/**
 * examples/diagrams/diagram-pipeline.js
 *
 * CI/CD Pipeline — programmatic model building demo.
 *
 * This example demonstrates how to construct a diagram entirely through
 * the DiagramModel API rather than parsing ASCII text.  Five pipeline
 * stages (Commit → Build → Test → Stage → Deploy) are created with
 * `model.addBox()`, wired together with `model.addPort()` /
 * `model.addConnector()`, and then auto-arranged by the Sugiyama-style
 * layout engine.
 *
 * Features demonstrated:
 *   • Programmatic model building (no ASCII source string)
 *   • `layout()` — auto-arrange boxes left-to-right
 *   • `route()`  — A* orthogonal connector routing
 *   • `startCurrentWork()` / `stopCurrentWork()` — dashed-border
 *     animation on the "Build" stage
 *   • `model:change` event listener
 *   • `serialize()` for ASCII round-trip output
 *
 * Run:
 *   node examples/diagrams/diagram-pipeline.js
 *
 * Controls:
 *   - Click a box to select it.
 *   - Double-click to toggle ✔ checked state.
 *   - Drag boxes to rearrange them.
 *   - Press 'l' to re-run auto-layout.
 *   - Press 'w' to toggle current-work on the Build stage.
 *   - Press 's' to print serialized ASCII to the log panel.
 *   - Press 'q' or Escape to quit.
 */

const galactica = require('../../');

const screen = galactica.screen();

screen.title = 'Diegetic — CI/CD Pipeline (Programmatic Model)';

// ── Build the model programmatically ───────────────────────────────
//
// Instead of providing an ASCII `source` string we construct every
// entity through the DiagramModel API.  This is useful when the
// diagram data comes from an external system (JSON config, database,
// REST endpoint) rather than a hand-drawn text file.

const DiagramModel = galactica.DiagramModel;
const model = new DiagramModel(100, 24);

/** Pipeline stage names in execution order. */
const stages = ['Commit', 'Build', 'Test', 'Stage', 'Deploy'];

/** Map of stage name → box reference (used when wiring connectors). */
const boxByName = {};

// Create one box per stage.
// Each box is 12 chars wide × 3 rows tall — enough for a single-line
// label plus a border on each side.
stages.forEach(function (name, i) {
  const box = model.addBox(1 + i * 18, 1, 12, 3, name);
  boxByName[name] = box;
});

// Wire each consecutive pair with a connector.
// Ports sit on the RIGHT side of the source box and the LEFT side of
// the destination box, both at offset 0 (vertically centred for a
// 3-row box since inner height = 1).
for (let i = 0; i < stages.length - 1; i++) {
  const src = boxByName[stages[i]];
  const dst = boxByName[stages[i + 1]];

  const portOut = model.addPort(src.id, 'right', 0);
  const portIn  = model.addPort(dst.id, 'left',  0);

  // Arrow points rightward — the natural flow direction.
  model.addConnector(portOut.id, portIn.id, 'right');
}

// ── Create the diagram widget ──────────────────────────────────────
//
// Because we already have a DiagramModel we pass no `source` option.
// After construction we call `setModel()` to inject the model, then
// `layout()` + `route()` to position and wire everything.

const diag = galactica.diagram({
  parent: screen,
  label: ' CI/CD Pipeline ',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%-4',
  border: { type: 'line' },
  style: { border: { fg: 'green' } },
  mouse: true,
  interactive: true,
  animate: true
});

diag.setModel(model);

// Auto-layout places boxes left-to-right in topological order.
diag.layout({ gapX: 6, gapY: 2 });

// Route all connectors through the A* pathfinder.
diag.route();

// Mark "Build" as the currently-active stage — this switches its
// border to the dashed/rounded charset (╭╍╍╯) and starts the ● dot
// animation that travels clockwise around the box perimeter.
diag.startCurrentWork(boxByName['Build'].id);

// ── Log panel ──────────────────────────────────────────────────────
//
// A small rolling-log widget at the bottom of the screen shows event
// messages and serialized output when the user presses 's'.

const log = galactica.log({
  parent: screen,
  label: ' Event Log ',
  bottom: 0,
  left: 0,
  width: '100%',
  height: 4,
  border: { type: 'line' },
  style: { border: { fg: 'grey' } },
  tags: true,
  bufferLength: 30
});

// ── Event listeners ────────────────────────────────────────────────

diag.on('box:click', function (ev) {
  log.log('{yellow-fg}box:click{/yellow-fg} box #' + ev.boxId);
  screen.render();
});

diag.on('box:dblclick', function (ev) {
  log.log('{cyan-fg}box:dblclick{/cyan-fg} toggled ✔ on box #' + ev.boxId);
  screen.render();
});

diag.on('model:change', function () {
  // model:change fires after every mutation — useful for persistence
  // hooks, undo stacks, or live-sync to a server.
  log.log('{grey-fg}model:change{/grey-fg} — model mutated');
  screen.render();
});

diag.on('drag:end', function (ev) {
  log.log('{magenta-fg}drag:end{/magenta-fg} box #' + ev.boxId + ' repositioned');
  screen.render();
});

// ── Key bindings ───────────────────────────────────────────────────

screen.key(['q', 'escape'], function () {
  return process.exit(0);
});

screen.key(['l'], function () {
  diag.layout({ gapX: 6, gapY: 2 });
  diag.route();
  log.log('{green-fg}layout{/green-fg} auto-layout applied');
  screen.render();
});

/** Track whether Build is currently marked as current-work. */
let buildIsWorking = true;

screen.key(['w'], function () {
  const buildId = boxByName['Build'].id;

  if (buildIsWorking) {
    diag.stopCurrentWork(buildId);
    log.log('{blue-fg}stopCurrentWork{/blue-fg} Build animation stopped');
  } else {
    diag.startCurrentWork(buildId);
    log.log('{blue-fg}startCurrentWork{/blue-fg} Build animation started');
  }

  buildIsWorking = !buildIsWorking;
  screen.render();
});

screen.key(['s'], function () {
  // serialize() renders the live model back to canonical ASCII text.
  // This demonstrates the parse→mutate→serialize round-trip.
  const ascii = diag.serialize();
  log.log('{white-fg}serialize(){/white-fg} ' + ascii.length + ' chars');
  screen.render();
});

// ── Initial render ─────────────────────────────────────────────────

screen.render();
