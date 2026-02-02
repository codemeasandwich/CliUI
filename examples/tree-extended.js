// Tree with pre-extended nodes and tree lines
// Demonstrates extended nodes with children showing the tree connector

var blessed = require('blessed')
  , contrib = require('../')
  , screen = blessed.screen()

var tree = contrib.tree({
  fg: 'green',
  label: 'File Explorer - Extended Tree',
  left: 0,
  top: 0,
  width: '100%',
  height: '100%',
  border: { type: 'line' },
  style: { border: { fg: 'cyan' } },
  // Enable tree lines to show visual connectors
  template: {
    lines: true,   // This enables the visual tree connectors
    extend: ' [+]',
    retract: ' [-]'
  }
})

// Tree data with pre-extended nodes
// Extended nodes with children will show the tree connector (covers lines 121-122)
var treeData = {
  name: 'root',
  extended: true,  // Root is extended
  children: {
    src: {
      name: 'src',
      extended: true,  // Pre-extended to show children with tree connector
      children: {
        'index.js': { name: 'index.js' },
        'utils.js': { name: 'utils.js' },
        components: {
          name: 'components',
          extended: true,  // Another extended node with children
          children: {
            'Button.js': { name: 'Button.js' },
            'Input.js': { name: 'Input.js' }
          }
        }
      }
    },
    lib: {
      name: 'lib',
      extended: false,  // Collapsed node
      children: {
        'helper.js': { name: 'helper.js' }
      }
    },
    'package.json': { name: 'package.json' },
    'README.md': { name: 'README.md' }
  }
}

screen.append(tree)
tree.setData(treeData)

// Focus the tree for interaction
tree.focus()

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render()
