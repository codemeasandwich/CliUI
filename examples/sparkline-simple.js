// Sparkline without blessed tags
// Demonstrates sparkline with tags:false for plain text output

var blessed = require('../lib/blessed')
  , contrib = require('../')
  , screen = blessed.screen()

// Create sparkline with tags:false to cover lines 39-40 in sparkline.js
var sparkline = contrib.sparkline({
  label: 'Sparkline - No Tags',
  left: 0,
  top: 0,
  width: '100%',
  height: '100%',
  border: { type: 'line' },
  style: {
    fg: 'blue',
    titleFg: 'white',
    border: { fg: 'cyan' }
  },
  tags: false  // Key option: disable blessed tags (covers lines 39-40)
})

// Multiple sparkline data series
var titles = ['CPU Usage', 'Memory Usage', 'Network I/O']
var data = [
  [10, 20, 30, 25, 40, 35, 50, 45, 60, 55, 70, 65, 80],
  [30, 25, 35, 40, 30, 45, 50, 55, 45, 60, 55, 70, 75],
  [5, 10, 15, 10, 20, 15, 25, 20, 30, 25, 35, 30, 40]
]

screen.append(sparkline)
sparkline.setData(titles, data)

// Call getOptionsPrototype() for coverage (lines 48-58)
sparkline.getOptionsPrototype()

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render()
