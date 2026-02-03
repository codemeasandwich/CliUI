var blessed = require('../../lib/blessed')
  , contrib = require('../../')
  , screen = blessed.screen()
  , markdown = contrib.markdown({markdown: '# Hello \n Cli UI renders markdown using `marked-terminal` '
                                , style: { firstHeading: 'chalk.green.italic' }})

screen.append(markdown)

screen.render()
