var galactica = require('../../')
  , screen = galactica.screen()
  , colors = require('../../lib/colors')
  , markdown = galactica.markdown()

screen.append(markdown)
markdown.setOptions({ firstHeading: colors.red.italic })
markdown.setMarkdown('# Hello \n This is **markdown** printed in the `terminal` 11')
screen.render()