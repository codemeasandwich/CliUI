var blessed = require('blessed')
, contrib = require('../index')
, screen = blessed.screen()

var table = contrib.table({
  keys: true,
  fg: 'white',
  selectedFg: 'white',
  selectedBg: 'blue',
  interactive: true,
  label: 'Table with Percentage Column Widths',
  width: '80%',
  height: '50%',
  border: {type: 'line', fg: 'cyan'},
  columnSpacing: 3,
  // Column widths as percentages - they share the available space
  columnWidth: ['30%', '40%', '30%']
})

screen.append(table)

table.setData({
  headers: ['Name', 'Description', 'Status'],
  data: [
    ['Item 1', 'This is a longer description text', 'Active'],
    ['Item 2', 'Another description here', 'Pending'],
    ['Item 3', 'Short desc', 'Complete'],
    ['Item 4', 'Medium length description', 'Active']
  ]
})

table.focus()

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render()
