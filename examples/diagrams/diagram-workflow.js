'use strict';

/**
 * examples/diagrams/diagram-workflow.js
 *
 * Workflow planner — checked states, current-work animation, labels, and
 * connector branching demo for the Diegetic diagram editor.
 *
 * This example loads a dense, real-world-style workflow diagram with:
 *   • Standard boxes, ✔ checked boxes, and a ╭╍╍╮ current-work box
 *   • Animated ● dot pair orbiting the current-work border
 *   • ╢ gateway connector attachment
 *   • Y / N decision labels
 *   • Fan-out / fan-in connector routing
 *
 * Run:
 *   node examples/diagrams/diagram-workflow.js
 *
 * Controls:
 *   - Click a box to select it.
 *   - Double-click a box to toggle its ✔ checked state.
 *   - Drag any box — connectors reroute in real time.
 *   - Press 'c' to cycle current-work to the next unchecked box.
 *   - Press 'l' to auto-layout.
 *   - Press 'q' or Escape to quit.
 */

var galactica = require('../../');

var screen = galactica.screen();

screen.title = 'Diegetic — Workflow Planner';

// ── ASCII source ───────────────────────────────────────────────────
//
// Gold fixture B from the specification — a complete workflow with
// checked boxes, a current-work-in-progress box, gateway, labels,
// and multi-level connector fan-out.

var workflowSource = [
  '                                                ┌──────────────┐   ┌──────────────┐   ┌──────────────┐',
  '                                         Y ╭───▶┤ start taking ├──▶┤ text text on ├──▶┤ Now Time to  ├▶─╮',
  '       ┌──────────┐   ┌──────────┐   ╭╍╍╍╍╍╧╍●╮ │ notes with   │   │ some good    │   │ start / coat │  │',
  '       │ ✔ INPUT  ├──▶┤ ✔ Thing  ├──▶╢ do     ┇ │ a pen.       │   │ ideas on wha │   │ On.          │  │',
  '       │ file /   │   │ about    │   ┇ Some   ┇ └──────────────┘   │ to do today! │   └──────────────┘  │',
  '       │ PLAN.txt │   │ what is  │   ● work.. ┇                    └──────────────┘                     │',
  '       └──────────┘   │ for tea. │   ╰╍╍╍╤╍╍╍╍╯                                        ┌──────────────┐ │',
  '                      └──────────┘     N ▼                                         ╭──▶┤ Out the door ├◀╯',
  '                                         │ Label Here.             ┌──────────────┐│   │ with keys    │',
  '                                         ╰──────────────────────┬─▶┤ Will need to ├╯   └───────┬──────┘',
  '                                                                ▼  │ do some      │            ▼',
  '                                                                │  │ shopping.    │  ╭─────────╯',
  '                                                                │  └──────┬───────┘  │',
  '                                                                │         ▼          ▼',
  '                                                                │         │  ┌───────┴────┐ ┌────────────┐',
  '                                                                ╰─────────┴─▶┤ day.       ├▶┤ to my next │',
  '                                                                             │ + weekend  │ │ stop       │',
  '                                                                             └────────────┘ └────────────┘'
].join('\n');

// ── Create the diagram widget ──────────────────────────────────────

var diag = galactica.diagram({
  parent: screen,
  label: ' Workflow Planner ',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%-1',
  border: { type: 'line' },
  style: {
    border: { fg: 'cyan' }
  },
  mouse: true,
  interactive: true,
  animate: true,
  source: workflowSource
});

// ── Status bar ─────────────────────────────────────────────────────

var statusBar = galactica.box({
  parent: screen,
  bottom: 0,
  left: 0,
  width: '100%',
  height: 1,
  content: ' q: quit | l: layout | c: cycle CW | dblclick: toggle ✔ | drag: move box',
  style: {
    fg: 'white',
    bg: 'blue'
  }
});

// ── Helper: cycle current-work to next unchecked box ───────────────

/**
 * Flag to prevent overlapping transitions when 'c' is pressed
 * rapidly while a travel-dot animation is still in flight.
 */
var transitioning = false;

function cycleCurrentWork() {
  /* Guard against overlapping transitions from rapid key presses. */
  if (transitioning) return;

  var model = diag.getModel();
  if (!model) return;
  var boxes = Array.from(model.boxes.values());

  /* Find the current CW box index. */
  var cwIdx = boxes.findIndex(function (b) { return b.currentWork; });
  var fromBox = cwIdx !== -1 ? boxes[cwIdx] : null;

  /* Walk forward from cwIdx+1, wrapping around, looking for unchecked. */
  var toBox = null;
  for (var i = 1; i <= boxes.length; i++) {
    var candidate = boxes[(cwIdx + i) % boxes.length];
    if (!candidate.checked) {
      toBox = candidate;
      break;
    }
  }

  if (!toBox) return;

  /*
   * If there's a current CW box, use the travel-dot transition
   * to animate the ● along the connector to the next box.
   * Otherwise (first activation), just set CW directly.
   */
  if (fromBox) {
    transitioning = true;
    statusBar.setContent(' Transitioning → #' + toBox.id +
      ' (' + toBox.text.split('\n')[0].trim() + ')…');
    screen.render();

    diag.transitionCurrentWork(fromBox.id, toBox.id, function () {
      transitioning = false;
      statusBar.setContent(' Current work → #' + toBox.id +
        ' (' + toBox.text.split('\n')[0].trim() + ')');
      screen.render();
    });
  } else {
    /* No existing CW — instant activation (no travel needed). */
    model.setCurrentWork(toBox.id, true);
    diag._postModelChange();
    diag.emit('model:change');
    statusBar.setContent(' Current work → #' + toBox.id +
      ' (' + toBox.text.split('\n')[0].trim() + ')');
    screen.render();
  }
}

// ── Event listeners ────────────────────────────────────────────────

diag.on('box:click', function (ev) {
  var model = diag.getModel();
  var box = model ? model.getBox(ev.boxId) : null;
  var label = box ? box.text.split('\n')[0].trim() : '?';
  var state = !box ? '' : box.currentWork ? ' ╭╍╍╮ CW' : box.checked ? ' ✔' : '';
  statusBar.setContent(' Clicked #' + ev.boxId + ' (' + label + ')' + state);
  screen.render();
});

diag.on('box:dblclick', function (ev) {
  var model = diag.getModel();
  var box = model ? model.getBox(ev.boxId) : null;
  var label = box ? box.text.split('\n')[0].trim() : '?';
  var checked = box ? box.checked : false;
  statusBar.setContent(' Toggled ' + (checked ? '✔' : '☐') +
    ' on #' + ev.boxId + ' (' + label + ')');
  screen.render();
});

diag.on('drag:start', function (ev) {
  statusBar.setContent(' Dragging box #' + ev.boxId + '…');
  screen.render();
});

diag.on('drag:end', function (ev) {
  statusBar.setContent(' Dropped box #' + ev.boxId);
  screen.render();
});

diag.on('model:change', function () {
  var model = diag.getModel();
  if (!model) return;
  var checked = Array.from(model.boxes.values())
    .filter(function (b) { return b.checked; }).length;
  var total = model.boxes.size;
  var cw = Array.from(model.boxes.values())
    .find(function (b) { return b.currentWork; });
  var cwLabel = cw ? cw.text.split('\n')[0].trim() : 'none';
  statusBar.setContent(
    ' ✔ ' + checked + '/' + total +
    ' | CW: ' + cwLabel +
    ' | q: quit | l: layout | c: cycle CW | dblclick: toggle ✔ | drag: move'
  );
  screen.render();
});

// ── Key bindings ───────────────────────────────────────────────────

screen.key(['q', 'escape'], function () {
  return process.exit(0);
});

screen.key(['l'], function () {
  diag.layout();
  statusBar.setContent(' Auto-layout applied');
  screen.render();
});

screen.key(['c'], function () {
  cycleCurrentWork();
});

// ── Initial render ─────────────────────────────────────────────────

screen.render();