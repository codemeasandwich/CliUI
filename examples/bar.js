var blessed = require('blessed')
  , contrib = require('../')
  , screen = blessed.screen()
  , bar = contrib.bar(
       { label: 'Server Utilization (%)'
       , barWidth: 4
       , barSpacing: 6
       , xOffset: 0
       , maxHeight: 9
       , height: "40%"})

screen.append(bar)

// Include a very small value (1) to trigger strokeStyle 'normal' branch (lines 64-65)
bar.setData(
       { titles: ['bar1', 'bar2', 'bar3']
       , data: [5, 10, 1]})

screen.render()