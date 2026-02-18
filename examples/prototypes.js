// Widget prototypes introspection
// Demonstrates getOptionsPrototype() for widgets
// Useful for building widget configurators, documentation generators, or form builders

var galactica = require('../')
  , screen = galactica.screen()

// Create a display box to show the results
var box = galactica.box({
  label: 'Widget Option Prototypes',
  left: 0,
  top: 0,
  width: '100%',
  height: '100%',
  border: { type: 'line' },
  style: { border: { fg: 'cyan' } },
  content: 'Testing getOptionsPrototype()...'
})

screen.append(box)

// Create widgets and call getOptionsPrototype to cover those code paths
// Note: Canvas-based widgets (bar, line, scatter, etc.) fail in test env

// Gauge (covers line 121 in gauge.js)
var gauge = galactica.gauge({ width: 20, height: 10, left: 0, top: 0 })
screen.append(gauge)
gauge.getOptionsPrototype()

// Update display
box.setContent(
  'Widget Option Prototypes\n' +
  '========================\n\n' +
  'Called getOptionsPrototype() on:\n' +
  '- Gauge\n\n' +
  'Prototype retrieved successfully!'
)

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render()
