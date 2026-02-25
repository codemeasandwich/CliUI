'use strict';

var blessed = require('../');

var screen = blessed.screen({ smartCSR: true });

var box = blessed.box({
  parent: screen,
  top: 4,
  left: 2,
  width: '100%-4',
  height: '100%-6',
  border: { type: 'line' },
  style: { border: { fg: 'cyan' } },
  content: 'Welcome! Press F1\u2013F4 to switch views.\n\nPress q to quit.'
});

// 2-line ASCII art cutout (CH=2 → 1 usable inner tab row)
box.setCutout('top-right', '\u2591\u2580\u2588\u2580\u2592\u2584\u2580\u2584\u2592\u2588\u2580\u2584\u2591\u2584\u2580\u2580\n\u2591\u2592\u2588\u2592\u2591\u2588\u2580\u2588\u2591\u2588\u2580\u2584\u2592\u2584\u2588\u2588');

screen.render();

// Place a tab bar in the inner notch
var inner = box.getCutoutInner('top-right');
var tabBar;

if (inner) {
  tabBar = blessed.box({
    parent: screen,
    top: inner.top,
    left: inner.left,
    width: inner.width,
    height: inner.height,
    content: ' F1 Spec  F2 Plan  F3 Run\u25CF  F4 Task',
    style: { transparent: true, fg: 'white' }
  });
}

// Tab content
var tabs = {
  f1: 'Feature Specification\n\n'
    + 'Corner cutouts let any corner of a bordered box\n'
    + 'have a block of text that sits outside the border,\n'
    + 'with the border stepping around it.',
  f2: 'Implementation Plan\n\n'
    + 'Step 1: setCutout() stores lines + dimensions\n'
    + 'Step 2: render hook calls _paintCutouts()\n'
    + 'Step 3: getCutoutInner() returns tab space bounds',
  f3: 'Run Output\n\n'
    + '> node test/border-cutout.test.js\n'
    + '  \u2714 setCutout stores data correctly\n'
    + '  \u2714 clearCutout removes cutout\n'
    + '  \u2714 getCutoutInner returns bounds\n'
    + '  \u2714 _paintCutouts writes to screen.lines\n'
    + '\n  4/4 tests passed',
  f4: 'Task List\n\n'
    + '[x] Implement setCutout / clearCutout\n'
    + '[x] Implement _paintCutouts for all 4 corners\n'
    + '[x] Implement getCutoutInner\n'
    + '[x] Write unit tests\n'
    + '[ ] Create interactive demo'
};

screen.key(['f1', 'f2', 'f3', 'f4'], function(ch, key) {
  box.setContent(tabs[key.name] || '');
  screen.render();
});

// Reposition tab bar on resize
screen.on('resize', function() {
  screen.render();
  var newInner = box.getCutoutInner('top-right');
  if (newInner && tabBar) {
    tabBar.top = newInner.top;
    tabBar.left = newInner.left;
    tabBar.width = newInner.width;
  }
  screen.render();
});

screen.key(['q', 'C-c'], function() {
  process.exit(0);
});

screen.render();
