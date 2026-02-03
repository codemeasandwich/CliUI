// Scatter plot with all marker types
// Demonstrates the different marker styles available: 'o', '+', 'x', '*', '.'

var blessed = require('../lib/blessed')
  , contrib = require('../')
  , screen = blessed.screen()

var scatter = contrib.scatter({
  label: 'Scatter Plot - All Marker Types',
  left: 0,
  top: 0,
  width: '100%',
  height: '100%',
  border: { type: 'line' },
  style: { border: { fg: 'cyan' } },
  xPadding: 10,
  showLegend: true,
  legend: { width: 20 },
  numYLabels: 5,
  numXLabels: 10
})

// Multiple series with different marker styles
var data = [
  {
    title: 'Circle (o)',
    x: [1, 2, 3, 4, 5],
    y: [2, 4, 3, 5, 4],
    style: { point: 'red', marker: 'o' }
  },
  {
    title: 'Plus (+)',
    x: [1.5, 2.5, 3.5, 4.5, 5.5],
    y: [3, 5, 4, 6, 5],
    style: { point: 'yellow', marker: '+' }
  },
  {
    title: 'Cross (x)',
    x: [2, 3, 4, 5, 6],
    y: [1, 3, 2, 4, 3],
    style: { point: 'green', marker: 'x' }
  },
  {
    title: 'Star (*)',
    x: [2.5, 3.5, 4.5, 5.5, 6.5],
    y: [4, 6, 5, 7, 6],
    style: { point: 'blue', marker: '*' }  // Covers lines 221-225
  },
  {
    title: 'Dot (.)',
    x: [3, 4, 5, 6, 7],
    y: [0.5, 2.5, 1.5, 3.5, 2.5],
    style: { point: 'magenta', marker: '.' }  // Covers lines 228-229
  }
]

screen.append(scatter)
scatter.setData(data)

// Call getOptionsPrototype() for coverage (lines 295-318)
scatter.getOptionsPrototype()

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render()
