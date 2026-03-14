var galactica = require('../../');
var screen = galactica.screen();

// Create a text-bar widget with color-tagged fill/empty characters
var textBar = galactica.textBar({
  label: 'Text Bar',
  top: 0,
  left: 0,
  width: 40,
  height: 3,
  border: { type: 'line', fg: 'cyan' },
  tags: true,
  style: {
    bar: { fillFg: 'green', emptyFg: 'gray' }
  }
});

screen.append(textBar);

// Set bar data — label on the left, fill ratio, value on the right
textBar.setData({ label: 'CacheC', percent: 0.14, value: '1.4K' });

// Exercise getOptionsPrototype for coverage
textBar.getOptionsPrototype();

screen.key(['escape', 'q', 'C-c'], function () {
  process.exit(0);
});

screen.render();
