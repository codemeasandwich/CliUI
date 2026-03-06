'use strict';

/**
 * examples/diagram-drag-debug.js
 *
 * Debug overlay setup for the diagram-drag demo.
 *
 * Exports a single setup function that creates the debug-log panel,
 * state panel, all event listeners, and post-init checks.
 */

var galactica = require('../');

/**
 * Attach debug overlay to the given screen/diagram/statusBar.
 *
 * @param {Object}  screen    - blessed screen
 * @param {Object}  diag      - diagram widget instance
 * @param {Object}  statusBar - bottom status bar box
 */
module.exports = function setupDebug(screen, diag, statusBar) {

  /* ── Debug Log panel (right, scrollable) ──────────────────────── */

  var debugLog = galactica.log({
    parent: screen,
    label: ' Debug Log ',
    top: 0,
    right: 0,
    width: '35%',
    height: '70%',
    tags: true,
    border: { type: 'line' },
    style: { border: { fg: 'magenta' }, fg: 'white', bg: 'black' },
    scrollable: true,
    scrollbar: { ch: ' ', inverse: true },
    mouse: true,
    keys: true
  });

  function log(msg) {
    var ts = new Date().toISOString().slice(11, 23);
    debugLog.log('{magenta-fg}' + ts + '{/magenta-fg} ' + msg);
  }

  log('[dbg] Debug panels attached');

  /* ── State panel (bottom-right, live summary) ─────────────────── */

  var statePanel = galactica.box({
    parent: screen,
    label: ' State ',
    bottom: 1,
    right: 0,
    width: '35%',
    height: '30%',
    tags: true,
    border: { type: 'line' },
    style: { border: { fg: 'yellow' }, fg: 'white', bg: 'black' }
  });

  function refreshState() {
    var m = diag.getModel();
    var boxes      = m ? m.boxes.size : 0;
    var connectors = m ? m.connectors.size : 0;
    var ports      = m ? m.ports.size : 0;
    var hasGrid    = !!(diag._grid);
    var dragId     = diag._dragBoxId != null ? String(diag._dragBoxId) : 'none';

    var lines = [
      '{bold}mouse:{/bold}     ' + (diag.options.mouse   ? '{green-fg}ON{/green-fg}' : '{red-fg}OFF{/red-fg}'),
      '{bold}clickable:{/bold} ' + (diag.options.clickable ? '{green-fg}Y{/green-fg}' : '{red-fg}N{/red-fg}'),
      '{bold}interact:{/bold}  ' + (diag.options.interactive ? '{green-fg}Y{/green-fg}' : '{red-fg}N{/red-fg}'),
      '',
      '{bold}boxes:{/bold}      ' + boxes,
      '{bold}connectors:{/bold} ' + connectors,
      '{bold}ports:{/bold}      ' + ports,
      '{bold}grid:{/bold}       ' + (hasGrid ? '{green-fg}YES{/green-fg}' : '{red-fg}NO{/red-fg}'),
      '',
      '{bold}dragId:{/bold}     ' + dragId
    ];
    statePanel.setContent(lines.join('\n'));
  }

  /* ── Element-level debug listeners ────────────────────────────── */

  diag.on('mousedown', function (mouse) {
    var pos = diag._mouseToLocal ? diag._mouseToLocal(mouse) : null;
    var hitResult = null;
    if (pos && diag._grid && diag._model) {
      var ht = require('../lib/widget/diagram/diagram-hit-test');
      hitResult = ht.hitTest(pos.x, pos.y, diag._grid, diag._model);
    }
    log('{yellow-fg}diag:mousedown{/yellow-fg} raw=(' + mouse.x + ',' + mouse.y + ')' +
        ' local=' + (pos ? '(' + pos.x + ',' + pos.y + ')' : 'null') +
        ' hit=' + (hitResult ? hitResult.kind + ' id=' + hitResult.id : 'none'));
  });

  diag.on('click', function (mouse) {
    log('{yellow-fg}diag:click{/yellow-fg} (' + mouse.x + ',' + mouse.y + ')');
  });

  diag.on('mousemove', function (mouse) {
    if (!diag._mmCount) diag._mmCount = 0;
    diag._mmCount++;
    if (diag._mmCount % 5 === 0) {
      log('diag:mousemove #' + diag._mmCount + ' (' + mouse.x + ',' + mouse.y + ')');
    }
  });

  /* ── Drag events ──────────────────────────────────────────────── */

  diag.on('drag:start', function (ev) {
    var box = diag.getModel().getBox(ev.boxId);
    var name = box ? box.text.trim() : '#' + ev.boxId;
    log('{yellow-fg}drag:start{/yellow-fg} ' + name + ' (' + ev.x + ',' + ev.y + ')');
    statusBar.setContent(' {yellow-fg}Dragging{/yellow-fg} ' + name + '  (' + ev.x + ', ' + ev.y + ')');
    refreshState();
    screen.render();
  });

  diag.on('drag:move', function (ev) {
    var box = diag.getModel().getBox(ev.boxId);
    if (!box) return;
    log('drag:move ' + box.text.trim() + ' \u2192 (' + box.x + ',' + box.y + ') \u0394(' + ev.dx + ',' + ev.dy + ')');
    statusBar.setContent(' {yellow-fg}Moving{/yellow-fg} ' + box.text.trim() +
      '  \u2192 (' + box.x + ', ' + box.y + ')  \u0394(' + ev.dx + ', ' + ev.dy + ')');
    refreshState();
    screen.render();
  });

  diag.on('drag:end', function (ev) {
    var box = diag.getModel().getBox(ev.boxId);
    var name = box ? box.text.trim() : '#' + ev.boxId;
    log('{green-fg}drag:end{/green-fg} ' + name);
    statusBar.setContent(' {green-fg}Dropped{/green-fg} ' + name + '  \u2014 connectors rerouted');
    refreshState();
    screen.render();
  });

  /* ── Click events ─────────────────────────────────────────────── */

  diag.on('box:click', function (ev) {
    var box = diag.getModel().getBox(ev.boxId);
    var name = box ? box.text.trim() : '#' + ev.boxId;
    log('{cyan-fg}box:click{/cyan-fg} ' + name + ' at (' + box.x + ',' + box.y + ')');
    statusBar.setContent(' Clicked {bold}' + name + '{/bold}');
    refreshState();
    screen.render();
  });

  diag.on('box:dblclick', function (ev) {
    var box = diag.getModel().getBox(ev.boxId);
    var name = box ? box.text.trim() : '#' + ev.boxId;
    log('{cyan-fg}box:dblclick{/cyan-fg} ' + name);
    statusBar.setContent(' Toggled \u2714 on {bold}' + name + '{/bold}');
    refreshState();
    screen.render();
  });

  diag.on('connector:click', function (ev) {
    log('{cyan-fg}connector:click{/cyan-fg} #' + ev.connectorId);
    statusBar.setContent(' Clicked connector #' + ev.connectorId);
    refreshState();
    screen.render();
  });

  /* ── Raw mouse on screen (for diagnostics) ────────────────────── */

  screen.on('mouse', function (mouse) {
    if (mouse.action === 'mousedown' || mouse.action === 'mouseup') {
      log('{white-fg}screen:' + mouse.action + '{/white-fg} (' + mouse.x + ',' + mouse.y + ') btn=' + mouse.button);
    }
  });

  /* ── Post-init checks ─────────────────────────────────────────── */

  process.nextTick(function () {
    log('{white-fg}[nextTick]{/white-fg} screen.clickable has ' +
        (screen.clickable ? screen.clickable.length : 0) + ' elements');
    log('{white-fg}[nextTick]{/white-fg} screen.program._mouse = ' + !!screen.program._mouse);
    refreshState();
    screen.render();
  });

  setTimeout(function () {
    log('{white-fg}[+100ms]{/white-fg} mouseEnabled=' + !!screen.program.mouseEnabled);
    log('{white-fg}[+100ms]{/white-fg} _grid ' + (diag._grid ? 'OK' : 'MISSING'));
    refreshState();
    screen.render();
  }, 100);

  /* Return refreshState so the main file can call it too. */
  return { log: log, refreshState: refreshState };
};
