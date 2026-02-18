var galactica = require('../../index')
  , screen = galactica.screen()
  , grid = new galactica.grid({rows: 12, cols: 12, screen: screen})
  , map = grid.set(0, 0, 4, 4, galactica.map, {label: 'World Map'})
  , lcd = grid.set(4,4,4,4, galactica.lcd,
    {
      label: "LCD Test",
      segmentWidth: 0.06,
      segmentInterval: 0.11,
      strokeWidth: 0.1,
      elements: 5,
      display: 3210,
      elementSpacing: 4,
      elementPadding: 2
    })


screen.render()
  
