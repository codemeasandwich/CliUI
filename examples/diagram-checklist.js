'use strict';

/**
 * examples/diagram-checklist.js
 *
 * Sprint Checklist — checked states, toggle, and serialization demo.
 *
 * This example renders a simple four-stage sprint board as an ASCII
 * diagram and demonstrates the checked (✔) workflow.  Boxes start in
 * various states and the user can cycle through them toggling the ✔
 * marker via keyboard or double-click.
 *
 * A side-panel rolling log shows two forms of serialization in real
 * time:
 *   1. **ASCII round-trip** — `serialize()` → `load()` produces
 *      canonical diagram text (the same text the parser would emit).
 *   2. **JSON round-trip** — `model.toJSON()` → `DiagramModel.fromJSON()`
 *      enables save/restore to a file or database.
 *
 * Features demonstrated:
 *   • `source` option with pre-checked (✔) box
 *   • `toggleChecked()` — flip ✔ state on any box
 *   • `serialize()` / `load()` — ASCII round-trip
 *   • `model.toJSON()` / `DiagramModel.fromJSON()` — JSON persistence
 *   • `box:dblclick` event (default toggles ✔)
 *   • `model:change` event to keep the log panel in sync
 *
 * Run:
 *   node examples/diagram-checklist.js
 *
 * Controls:
 *   - Double-click a box to toggle its ✔ checked state.
 *   - Press '1'–'4' to toggle ✔ on the corresponding stage.
 *   - Press 'a' to dump the ASCII serialization to the log.
 *   - Press 'j' to dump the JSON serialization to the log.
 *   - Press 'r' to restore the model from the last JSON snapshot.
 *   - Press 'q' or Escape to quit.
 */

const galactica = require('../');

const screen = galactica.screen();

screen.title = 'Diegetic — Sprint Checklist (Checked States & Serialization)';

// ── ASCII source ───────────────────────────────────────────────────
//
// Four sprint stages in a left-to-right flow.
// "Design" starts pre-checked (✔) to show that the parser recognises
// the ✔ prefix and sets `box.checked = true` automatically.

const sprintSource = [
  '┌──────────┐       ┌──────────┐       ┌──────────┐       ┌──────────┐',
  '│ ✔ Design │──────▶│Implement │──────▶│  Review  │──────▶│   Ship   │',
  '└──────────┘       └──────────┘       └──────────┘       └──────────┘'
].join('\n');

// ── Create the diagram widget ──────────────────────────────────────

const diag = galactica.diagram({
  parent: screen,
  label: ' Sprint Board ',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%-8',
  border: { type: 'line' },
  style: { border: { fg: 'yellow' } },
  mouse: true,
  interactive: true,
  animate: false,   // no current-work animation in this demo
  source: sprintSource
});

// ── Log panel ──────────────────────────────────────────────────────
//
// Shows serialization output and event messages.  Positioned at the
// bottom of the screen so it does not overlap the diagram.

const log = galactica.log({
  parent: screen,
  label: ' Serialization Log ',
  bottom: 0,
  left: 0,
  width: '100%',
  height: 8,
  border: { type: 'line' },
  style: { border: { fg: 'grey' } },
  tags: true,
  bufferLength: 50
});

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Collect box IDs in insertion order so we can map keyboard numbers
 * (1-4) to specific boxes.  The model's `boxes` Map preserves
 * insertion order (parser creates boxes left-to-right), so
 * `Array.from(boxes.keys())` gives us [Design, Implement, Review, Ship].
 */
function getBoxIds() {
  const m = diag.getModel();
  return m ? Array.from(m.boxes.keys()) : [];
}

/** Last JSON snapshot — used by the 'r' key to restore state. */
let lastJsonSnapshot = null;

// ── Event listeners ────────────────────────────────────────────────

diag.on('box:dblclick', function (ev) {
  const m = diag.getModel();
  if (!m) return;
  const box = m.getBox(ev.boxId);
  const name = box ? box.text.replace('✔ ', '') : '?';
  const state = box && box.checked ? '✔' : '☐';
  log.log('{cyan-fg}dblclick{/cyan-fg} ' + name + ' → ' + state);
  screen.render();
});

diag.on('model:change', function () {
  log.log('{grey-fg}model:change{/grey-fg}');
  screen.render();
});

// ── Key bindings ───────────────────────────────────────────────────

screen.key(['q', 'escape'], function () {
  return process.exit(0);
});

// Toggle ✔ on individual stages by number key.
['1', '2', '3', '4'].forEach(function (key, index) {
  screen.key([key], function () {
    const ids = getBoxIds();
    if (index < ids.length) {
      diag.toggleChecked(ids[index]);

      const m = diag.getModel();
      const box = m ? m.getBox(ids[index]) : null;
      const name = box ? box.text.replace('✔ ', '') : '?';
      const state = box && box.checked ? '✔' : '☐';
      log.log('{yellow-fg}toggle ' + key + '{/yellow-fg} ' + name + ' → ' + state);
      screen.render();
    }
  });
});

// 'a' — ASCII serialization: serialize() returns the canonical ASCII
// text that the renderer produces from the current model state.
screen.key(['a'], function () {
  const ascii = diag.serialize();
  log.log('{green-fg}--- ASCII serialize ---{/green-fg}');
  ascii.split('\n').forEach(function (line) {
    log.log(line);
  });
  screen.render();
});

// 'j' — JSON serialization: model.toJSON() produces a plain object
// suitable for JSON.stringify().  We store the snapshot so the user
// can restore it later with 'r'.
screen.key(['j'], function () {
  const m = diag.getModel();
  if (!m) return;

  lastJsonSnapshot = JSON.stringify(m.toJSON());
  log.log('{blue-fg}--- JSON serialize ---{/blue-fg} (' + lastJsonSnapshot.length + ' bytes)');
  log.log(lastJsonSnapshot.substring(0, 120) + '…');
  screen.render();
});

// 'r' — Restore from last JSON snapshot.  This demonstrates the full
// save/restore round-trip: JSON.parse → DiagramModel.fromJSON → setModel.
screen.key(['r'], function () {
  if (!lastJsonSnapshot) {
    log.log('{red-fg}No snapshot — press j first{/red-fg}');
    screen.render();
    return;
  }

  const restored = galactica.DiagramModel.fromJSON(JSON.parse(lastJsonSnapshot));
  diag.setModel(restored);
  diag.route();

  log.log('{magenta-fg}--- Restored from JSON snapshot ---{/magenta-fg}');
  screen.render();
});

// ── Initial log message ────────────────────────────────────────────

log.log('Keys: 1-4 toggle ✔ | a: ASCII dump | j: JSON dump | r: restore | dblclick: toggle');

// ── Initial render ─────────────────────────────────────────────────

screen.render();
