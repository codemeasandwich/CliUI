// Log widget with manual scroll control
// Demonstrates scrollTo method for programmatic scroll positioning

var galactica = require('../')
  , screen = galactica.screen()

// Create log with larger buffer
var log = galactica.log({
  fg: 'green',
  selectedFg: 'green',
  label: 'Log - Scroll Control',
  left: 0,
  top: 0,
  width: '100%',
  height: '100%',
  border: { type: 'line' },
  style: { border: { fg: 'cyan' } },
  bufferLength: 50  // Allow more lines
})

screen.append(log)

// Add many log entries
for (var i = 1; i <= 30; i++) {
  log.log('Log entry #' + i + ' - ' + new Date().toISOString())
}

// Scroll to a specific position (not at end) to cover lines 31-32
// The scrollTo method is called when scrollOnInput is false or when
// we want to programmatically control scroll position
log.scrollTo(10)  // Scroll to line 10 (covers lines 31-32 when not at end)

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render()
