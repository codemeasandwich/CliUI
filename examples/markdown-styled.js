// Markdown with custom chalk styles
// Demonstrates markdownStyle option with string-based chalk color definitions

var galactica = require('../')
  , screen = galactica.screen()

// Create markdown widget with custom chalk styles
// This covers lines 44-52 (evalStyles function) in markdown.js
var markdown = galactica.markdown({
  label: 'Markdown - Custom Styles',
  left: 0,
  top: 0,
  width: '100%',
  height: '100%',
  border: { type: 'line' },
  style: { border: { fg: 'cyan' } },
  // Custom markdown styles using chalk color strings
  // These strings will be parsed by evalStyles() to chalk functions
  markdownStyle: {
    heading: 'chalk.yellow.bold',
    strong: 'chalk.red.bold',
    em: 'chalk.green.italic',
    codespan: 'chalk.cyan',
    code: 'chalk.gray',
    blockquote: 'chalk.magenta',
    listitem: 'chalk.white'
  },
  // Markdown content demonstrating various styles
  markdown: `# Welcome to CliUI

This is a **dashboard library** for building *terminal UIs*.

## Features

- Line charts
- Bar charts
- Scatter plots
- Tables and trees

> Note: All widgets support Galactica styling

Here is some \`inline code\` example.

\`\`\`
// Code block example
var widget = galactica.line({ ... });
\`\`\`
`
})

screen.append(markdown)

// Call getOptionsPrototype() for coverage (lines 56-59)
markdown.getOptionsPrototype()

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render()
