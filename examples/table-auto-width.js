// Table with automatic column width calculation
// Demonstrates auto-calculated widths, focus styling, and long content handling

var blessed = require('../lib/blessed')
  , contrib = require('../')
  , screen = blessed.screen()

// Create table WITHOUT columnWidth option to trigger auto-calculation
// This covers lines 112-125 in table.js
var table = contrib.table({
  keys: true,
  fg: 'white',
  selectedFg: 'white',
  selectedBg: 'blue',
  interactive: true,
  label: 'Table - Auto Column Width',
  left: 0,
  top: 0,
  width: '100%',
  height: '100%',
  border: { type: 'line', fg: 'cyan' },
  columnSpacing: 3
  // Note: NO columnWidth option - widths will be auto-calculated
})

// Data with varying content lengths including very long content
// Long content tests negative spaceLength handling (lines 166-167)
var data = {
  headers: ['ID', 'Name', 'Description', 'Status'],
  data: [
    ['1', 'Alice', 'Short description', 'Active'],
    ['2', 'Bob', 'A somewhat longer description that might exceed column width', 'Inactive'],
    ['3', 'Charlie', 'Medium length text here', 'Pending'],
    ['4', 'Diana', 'ThisIsAVeryLongWordWithNoSpacesThatMightCauseOverflow', 'Active'],
    ['5', 'Eve', 'Normal text', 'Active'],
    ['12345', 'A very long name that extends beyond normal', 'Desc', 'Status']
  ]
}

screen.append(table)
table.setData(data)

// Call getOptionsPrototype() for coverage (lines 185-198)
table.getOptionsPrototype()

// Focus the table
table.focus()

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render()
