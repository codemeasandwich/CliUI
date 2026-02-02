var blessed = require('../')
  , screen;

screen = blessed.screen({
  dump: __dirname + '/logs/textarea.log',
  fullUnicode: true,
  warnings: true
});

var instructions = blessed.box({
  parent: screen,
  top: 0,
  left: 0,
  width: '100%',
  height: 3,
  content: ' Press i/enter to start input | Arrow keys to move | Home/End | Delete/Backspace | Escape to exit input | q to quit',
  style: {
    fg: 'white',
    bg: 'gray'
  }
});

var box = blessed.textarea({
  parent: screen,
  label: ' Textarea (cursor navigation test) ',
  style: {
    bg: 'blue',
    border: {
      fg: 'white'
    }
  },
  border: 'line',
  height: 'half',
  width: 'half',
  top: 'center',
  left: 'center',
  keys: true,
  vi: true,
  tags: true,
  hint: 'Type something here...'
});

// Pre-populate with some text for testing navigation
box.setValue('Line 1: Hello World!\nLine 2: Arrow keys navigate.\nLine 3: Home/End move to line edges.\nLine 4: Delete removes forward.\nLine 5: Backspace removes backward.');

screen.render();

screen.key('q', function() {
  screen.destroy();
});

box.focus();
