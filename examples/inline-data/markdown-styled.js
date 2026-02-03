// Markdown with custom chalk styles (inline-data version)
// Demonstrates markdownStyle with inline markdown content

var blessed = require('../../lib/blessed')
  , contrib = require('../../')
  , screen = blessed.screen()

// Create markdown with custom styles and inline content
var markdown = contrib.markdown({
  label: 'Markdown - Styled (Inline)',
  left: 0,
  top: 0,
  width: '100%',
  height: '100%',
  border: { type: 'line' },
  style: { border: { fg: 'cyan' } },
  // Custom styles
  markdownStyle: {
    heading: 'chalk.blue.bold',
    strong: 'chalk.red',
    em: 'chalk.yellow'
  },
  // Inline markdown
  markdown: `# Quick Start

**Install** the package:

\`\`\`
npm install blessed-contrib
\`\`\`

*Happy coding!*
`
})

screen.append(markdown)

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render()
