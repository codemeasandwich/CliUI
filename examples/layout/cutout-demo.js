'use strict';

var blessed = require('../../');

var screen = blessed.screen({ smartCSR: true });

var box = blessed.box({
  parent: screen,
  top: 4,
  left: 4,
  width: 50,
  height: 10,
  border: { type: 'line', charset: 'heavy' },
  style: {
    border: { fg: 'cyan' }
  },
  content: 'Hello from inside the box!\nThis is a demo of border cutouts.'
});

box.setCutout('top-right', 'cutout here');
box.setCutout('bottom-left', 'cutout here\nmore text');

screen.render();

var inner = box.getCutoutInner('bottom-left');
if (inner != null) {
  blessed.box({
    parent: screen,
    top: inner.top,
    left: inner.left,
    width: inner.width,
    height: inner.height,
    content: 'status: OK',
    style: { transparent: true, fg: 'green' }
  });
}

screen.key(['q', 'C-c'], function() {
  process.exit(0);
});

screen.render();
