// Table with automatic column width calculation (inline-data version)
// Demonstrates auto-calculated widths with data passed inline

var blessed = require('../../lib/blessed')
  , contrib = require('../../')
  , screen = blessed.screen()

// Create table with inline data
var table = contrib.table({
  keys: true,
  fg: 'white',
  selectedFg: 'white',
  selectedBg: 'blue',
  interactive: true,
  label: 'Table - Auto Width (Inline)',
  left: 0,
  top: 0,
  width: '100%',
  height: '100%',
  border: { type: 'line', fg: 'cyan' },
  columnSpacing: 3,
  // Note: NO columnWidth option - widths will be auto-calculated
  // Inline data
  data: {
    headers: ['ID', 'Name', 'Description', 'Status'],
    data: [
      ['1', 'Alice', 'Short description', 'Active'],
      ['2', 'Bob', 'A somewhat longer description', 'Inactive'],
      ['3', 'Charlie', 'Medium length text here', 'Pending']
    ]
  }
})

screen.append(table)
table.focus()

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render()
