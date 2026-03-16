'use strict';

/**
 * examples/layout/cutout-body-demo.js
 *
 * Demonstrates the cutout-aware body compositor with nested message boxes,
 * scrollbar, ellipsis clipping, and mixed-stroke intersection resolution.
 *
 * Usage:
 *   node examples/layout/cutout-body-demo.js
 *
 * Controls:
 *   ↑/↓  — scroll content up/down
 *   q    — quit
 *
 * This example renders a heavy outer frame with:
 *   - A top-right cutout (title label)
 *   - A bottom-right cutout (footer/status bar)
 *   - Nested inner message boxes (USER and AI roles)
 *   - A right-side scrollbar with contractual glyphs (▴ ╽ ┊ ┆ ▾)
 *   - Mixed-stroke junctions (┷ ┯) where inner light borders meet outer heavy frame
 *   - Semantic ellipsis (…) on clipped text
 */

var blessed = require('../../');
var renderCutoutBody = require('../../lib/border/render-cutout-body');

// ── Create screen ─────────────────────────────────────────────────────────
var screen = blessed.screen({ smartCSR: true });

// ── Create outer heavy frame box ──────────────────────────────────────────
var box = blessed.box({
  parent: screen,
  top: 2,
  left: 4,
  width: 36,
  height: 12,
  border: { type: 'line', charset: 'heavy' },
  style: { border: { fg: 'cyan' } }
});

// ── Messages to render as nested inner boxes ──────────────────────────────
var messages = [
  { role: 'USER', text: 'completed!' },
  { role: 'AI', text: 'I\'ll start by reading the\nassigned task document and\nunderstanding the current\nstate of the project.\nstarting from the test entry' },
  { role: 'USER', text: 'also run the full e2e\nsuite before closing it' },
  { role: 'AI', text: 'until the coverage meets the threshold' }
];

// ── Scroll state ──────────────────────────────────────────────────────────
var scrollOffset = 0;

// ── Render function ───────────────────────────────────────────────────────
function renderBody() {
  screen.render();

  // Render the cutout body into the box's screen region
  renderCutoutBody(screen, {
    xi: box.aleft,
    xl: box.aleft + box.width,
    yi: box.atop,
    yl: box.atop + box.height,
    messages: messages,
    scrollOffset: scrollOffset,
    scrollbar: true,
    bottomCutout: { width: 7, height: 2 },
    topCutout: { width: 12, height: 2 }
  });

  screen.render();
}

// ── Scroll controls ───────────────────────────────────────────────────────
screen.key(['up'], function () {
  if (scrollOffset > 0) {
    scrollOffset--;
    renderBody();
  }
});

screen.key(['down'], function () {
  scrollOffset++;
  renderBody();
});

screen.key(['q', 'C-c'], function () {
  process.exit(0);
});

// ── Initial render ────────────────────────────────────────────────────────
renderBody();
