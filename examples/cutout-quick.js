'use strict';

var blessed = require('../');

var screen = blessed.screen({ smartCSR: true });

var box = blessed.box({
  parent: screen,
  top: 'center',
  left: 'center',
  width: 60,
  height: 14,
  border: { type: 'line', charset: 'rounded' },
  style: {
    border: { fg: 'magenta' }
  },
  content: 'Press q to quit.'
});

box.setCutout('top-right', ' Status \n  OK   ');
box.setCutout('bottom-left', ' v1.0.0 ');

screen.key(['q', 'C-c'], function() {
  process.exit(0);
});

screen.render();
