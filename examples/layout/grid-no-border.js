
var galactica = require('../../')
  , screen = galactica.screen()
  , grid = new galactica.grid({rows: 12, cols: 12, hideBorder: true, screen: screen})
  , map = grid.set(0, 0, 4, 4, galactica.map, {})
  , box = grid.set(4, 4, 4, 4, galactica.box, {content: 'My Box'})

screen.render()
