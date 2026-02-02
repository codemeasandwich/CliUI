
var blessed = require('blessed')
  , contrib = require('../../')
  , screen = blessed.screen()
  , chalk = require('chalk')
  , markdown = contrib.markdown({markdown: '# Hello \n Cli UI renders markdown using `marked-terminal` '
                                , style: { firstHeading: 'chalk.green.italic' }})

screen.append(markdown)

screen.render()
