var galactica = require('../../index')
  , screen = galactica.screen()
  , bar = galactica.bar(
       { label: 'Server Utilization (%)'
       , barWidth: 4
       , barSpacing: 6
       , xOffset: 0
       , maxHeight: 9
       , height: "40%"
       , data: { titles: ['bar1', 'bar2']
               , data: [5, 10]}
               })

screen.append(bar)

screen.render()