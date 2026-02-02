// Sparkline without blessed tags (inline-data version)
// Demonstrates sparkline with tags:false and inline data

var blessed = require('blessed')
  , contrib = require('../../')
  , screen = blessed.screen()

// Create sparkline with inline data and tags:false
var sparkline = contrib.sparkline({
  label: 'Sparkline - No Tags (Inline)',
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
  tags: false,  // Key option: disable blessed tags
  // Inline data
  data: {
    titles: ['CPU', 'Memory'],
    data: [
      [10, 20, 30, 40, 50, 60, 70, 80, 90],
      [30, 40, 35, 50, 45, 60, 55, 70, 65]
    ]
  }
})

screen.append(sparkline)

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render()
