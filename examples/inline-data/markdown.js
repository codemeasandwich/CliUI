var galactica = require('../../index')
  , screen = galactica.screen()
  , markdown = galactica.markdown({markdown: '# Hello \n Cli UI renders markdown using `marked-terminal` '
                                , style: { firstHeading: 'chalk.green.italic' }})

screen.append(markdown)

screen.render()
