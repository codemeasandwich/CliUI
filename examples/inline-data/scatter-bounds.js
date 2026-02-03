// Scatter plot with explicit axis bounds (inline-data version)
// Demonstrates minX, maxX, minY, maxY options with data passed inline

var blessed = require('../../lib/blessed')
  , contrib = require('../../')
  , screen = blessed.screen()

// Data passed inline via options
var scatter = contrib.scatter({
  label: 'Scatter Plot - Fixed Bounds (Inline)',
  left: 0,
  top: 0,
  width: '100%',
  height: '100%',
  border: { type: 'line' },
  style: { border: { fg: 'cyan' } },
  xPadding: 10,
  showLegend: true,
  legend: { width: 15 },
  numYLabels: 5,
  numXLabels: 10,
  // Explicit axis bounds
  minX: 0,
  maxX: 100,
  minY: 0,
  maxY: 1000,
  // Inline data
  data: [
    {
      title: 'Server Load',
      x: [10, 20, 30, 40, 50],
      y: [100, 250, 180, 400, 320],
      style: { point: 'red', marker: 'o' }
    },
    {
      title: 'Memory Usage',
      x: [15, 25, 35, 45, 55],
      y: [200, 450, 380, 600, 520],
      style: { point: 'yellow', marker: '+' }
    }
  ]
})

screen.append(scatter)

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render()
