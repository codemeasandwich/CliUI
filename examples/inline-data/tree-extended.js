// Tree with pre-extended nodes (inline-data version)
// Demonstrates extended nodes with data passed inline

var galactica = require('../../index')
  , screen = galactica.screen()

var tree = galactica.tree({
  fg: 'green',
  label: 'File Explorer - Extended (Inline)',
  left: 0,
  top: 0,
  width: '100%',
  height: '100%',
  border: { type: 'line' },
  style: { border: { fg: 'cyan' } },
  template: {
    lines: true,
    extend: ' [+]',
    retract: ' [-]'
  },
  // Inline data
  data: {
    name: 'root',
    extended: true,
    children: {
      docs: {
        name: 'docs',
        extended: true,
        children: {
          'api.md': { name: 'api.md' },
          'guide.md': { name: 'guide.md' }
        }
      },
      tests: {
        name: 'tests',
        extended: true,
        children: {
          'unit.test.js': { name: 'unit.test.js' }
        }
      }
    }
  }
})

screen.append(tree)
tree.focus()

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render()
