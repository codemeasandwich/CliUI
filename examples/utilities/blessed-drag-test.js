'use strict';

/**
 * examples/utilities/blessed-drag-test.js
 *
 * Minimal blessed-only drag test — no diagram widget involved.
 * Tests whether blessed's built-in `draggable: true` works in
 * the current terminal environment.
 *
 * Three coloured boxes can be dragged around the screen.
 * A log panel on the right shows every mouse event received.
 *
 * NOTE — Windows QuickEdit Mode
 *   If running in cmd.exe or PowerShell on classic conhost:
 *     Right-click title bar → Properties → un-check "QuickEdit Mode"
 *   QuickEdit intercepts mouse events for text selection before
 *   they reach the application.  Windows Terminal and VS Code's
 *   integrated terminal do NOT have this problem.
 *
 * Run:
 *   node examples/utilities/blessed-drag-test.js
 *
 * Controls:
 *   mouse drag  ... move a box
 *   q / Escape  ... quit
 */

var blessed = require('../../blessed');

var screen = blessed.screen({
  smartCSR: true,
  title: 'Blessed Drag Test'
});

/* ── Log panel ──────────────────────────────────────────────────── */

var log = blessed.log({
  parent: screen,
  label: ' Mouse Log ',
  top: 0,
  right: 0,
  width: '40%',
  height: '100%-1',
  tags: true,
  border: { type: 'line' },
  style: { border: { fg: 'magenta' }, fg: 'white', bg: 'black' },
  scrollable: true,
  scrollbar: { ch: ' ', inverse: true },
  mouse: true,
  keys: true
});

function ts() {
  return new Date().toISOString().slice(11, 23);
}

/* ── Status bar ─────────────────────────────────────────────────── */

var statusBar = blessed.box({
  parent: screen,
  bottom: 0,
  left: 0,
  width: '100%',
  height: 1,
  tags: true,
  content: ' {bold}drag{/bold} boxes | {bold}q{/bold}: quit',
  style: { fg: 'white', bg: 'blue' }
});

/* ── Three draggable boxes ──────────────────────────────────────── */

var colors = ['red', 'green', 'yellow'];
var labels = ['Box A', 'Box B', 'Box C'];
var boxes = [];

for (var i = 0; i < 3; i++) {
  var box = blessed.box({
    parent: screen,
    top: 2 + i * 5,
    left: 2 + i * 8,
    width: 14,
    height: 5,
    draggable: true,            // <── blessed built-in drag
    content: labels[i],
    align: 'center',
    valign: 'middle',
    border: { type: 'line' },
    style: {
      fg: 'white',
      bg: colors[i],
      border: { fg: 'white' },
      hover: { bg: 'blue' }
    },
    shadow: true
  });

  boxes.push(box);

  // Log drag events per box
  (function (name, b) {
    b.on('mousedown', function (mouse) {
      log.log('{' + colors[boxes.indexOf(b)] + '-fg}' + ts() +
              ' mousedown ' + name + '{/} (' + mouse.x + ',' + mouse.y + ')');
    });
    b.on('mouseup', function (mouse) {
      log.log('{' + colors[boxes.indexOf(b)] + '-fg}' + ts() +
              ' mouseup   ' + name + '{/} (' + mouse.x + ',' + mouse.y + ')');
    });
    b.on('mousemove', function (mouse) {
      // Only log every few moves to avoid flooding
      if (!b._moveCount) b._moveCount = 0;
      b._moveCount++;
      if (b._moveCount % 3 === 0) {
        log.log(ts() + ' mousemove ' + name +
                ' pos=(' + b.rleft + ',' + b.rtop + ')');
      }
    });
    b.on('click', function (mouse) {
      log.log('{bold}' + ts() + ' CLICK ' + name + '{/bold} (' + mouse.x + ',' + mouse.y + ')');
    });
  })(labels[i], box);
}

/* ── Screen-level mouse logging ─────────────────────────────────── */

screen.on('mouse', function (mouse) {
  if (mouse.action === 'mousedown') {
    log.log('{white-fg}' + ts() + ' screen:mousedown{/} btn=' +
            mouse.button + ' (' + mouse.x + ',' + mouse.y + ')');
  }
  if (mouse.action === 'mouseup') {
    log.log('{white-fg}' + ts() + ' screen:mouseup{/} btn=' +
            mouse.button + ' (' + mouse.x + ',' + mouse.y + ')');
  }
});

/* ── Diagnostic info ────────────────────────────────────────────── */

var prog = screen.program;
log.log(ts() + ' platform: ' + process.platform);
log.log(ts() + ' terminal: ' + prog._terminal);
log.log(ts() + ' mouseEnabled: ' + !!prog.mouseEnabled);
log.log(ts() + ' _currentMouse: ' + JSON.stringify(prog._currentMouse || null));
log.log(ts() + ' clickable: ' + (screen.clickable ? screen.clickable.length : 0));
log.log(ts() + ' TERM=' + (process.env.TERM || '(unset)'));
log.log(ts() + ' TERM_PROGRAM=' + (process.env.TERM_PROGRAM || '(unset)'));
log.log(ts() + ' WT_SESSION=' + (process.env.WT_SESSION ? 'yes' : 'no'));

if (process.platform === 'win32' && !process.env.WT_SESSION && process.env.TERM_PROGRAM !== 'vscode') {
  log.log('{red-fg}' + ts() + ' WARNING: Classic conhost detected.{/}');
  log.log('{red-fg}  Disable QuickEdit Mode in console properties!{/}');
}

process.nextTick(function () {
  log.log(ts() + ' [nextTick] clickable: ' +
          (screen.clickable ? screen.clickable.length : 0));
  log.log(ts() + ' [nextTick] mouseEnabled: ' + !!prog.mouseEnabled);
  screen.render();
});

/* ── Keys ───────────────────────────────────────────────────────── */

screen.key(['q', 'escape'], function () {
  return process.exit(0);
});

/* ── Render ─────────────────────────────────────────────────────── */

screen.render();
