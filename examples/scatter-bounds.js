// Scatter plot with explicit axis bounds
// Demonstrates minX, maxX, minY, maxY options for fixed axis ranges

var blessed = require('blessed')
  , contrib = require('../')
  , screen = blessed.screen()

// Create scatter plot with explicit bounds
// This covers lines 88-89, 107-108, 128-129, 150-151 in scatter.js
var scatter = contrib.scatter({
  label: 'Scatter Plot - Fixed Axis Bounds',
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
  // Explicit axis bounds - data will be plotted within these ranges
  minX: 0,      // Covers line 88-89
  maxX: 100,    // Covers line 107-108
  minY: 0,      // Covers line 128-129
  maxY: 1000    // Covers line 150-151
})

// Data points are small but axis shows full range
var data = [
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

screen.append(scatter)
scatter.setData(data)

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render()
