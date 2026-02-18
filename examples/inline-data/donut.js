var galactica = require('../../index')
  , screen = galactica.screen()
  , donut = galactica.donut(
       {
        data: [ { color: 'red', percent: '50', label: 'a'}
              , { color: 'blue', percent: '20', label: 'b'}
              , { color: 'yellow', percent: '80', label: 'c'}
              ]
       })

screen.append(donut)

screen.render()