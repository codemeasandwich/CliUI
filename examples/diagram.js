'use strict';

/**
 * examples/diagram.js
 *
 * Interactive ASCII diagram demo for the Diegetic diagram editor.
 *
 * Run:
 *   node examples/diagram.js
 *
 * Controls:
 *   - Click a box to select it (emits `box:click`).
 *   - Double-click a box to toggle its ✔ checked state.
 *   - Drag a box to move it.
 *   - Press 'l' to auto-layout.
 *   - Press 'q' or Escape to quit.
 */

var galactica = require('../');

var screen = galactica.screen();

screen.title = 'Diegetic Diagram — ASCII Diagram Editor';

// ── Create the diagram widget ──────────────────────────────────────

var diag = galactica.diagram({
  parent: screen,
  label: ' Diagram ',
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
  source: [
    '┌──────────┐       ┌──────────┐       ┌──────────┐',
    '│  Auth    │       │  API     │       │  Web     │',
    '│  Service │──────▶│  Gateway │──────▶│  Client  │',
    '└──────────┘       └──────────┘       └──────────┘',
    '                        │',
    '                        │',
    '                        ▼',
    '                   ╭╍╍╍╍╍╍╍╍╍╍╮',
    '                   ┇ Database ┇',
    '                   ╰╍╍╍╍╍╍╍╍╍╍╯'
  ].join('\n')
});

// ── Status bar ─────────────────────────────────────────────────────

var statusBar = galactica.box({
  parent: screen,
  bottom: 0,
  left: 0,
  width: '100%',
  height: 1,
  content: ' q: quit | l: layout | dblclick: toggle ✔ | drag: move box',
  style: {
    fg: 'white',
    bg: 'blue'
  }
});

// ── Event listeners ────────────────────────────────────────────────

diag.on('box:click', function (ev) {
  statusBar.setContent(' Clicked box #' + ev.boxId);
  screen.render();
});

diag.on('box:dblclick', function (ev) {
  statusBar.setContent(' Toggled ✔ on box #' + ev.boxId);
  screen.render();
});

diag.on('drag:start', function (ev) {
  statusBar.setContent(' Dragging box #' + ev.boxId + '...');
  screen.render();
});

diag.on('drag:end', function (ev) {
  statusBar.setContent(' Dropped box #' + ev.boxId);
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

// ── Initial render ─────────────────────────────────────────────────

screen.render();
