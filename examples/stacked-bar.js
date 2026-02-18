var galactica = require('../')
  , screen = galactica.screen()
  // Use inline data in options to trigger attach-time setData (lines 36-37)
  , bar = galactica.stackedBar(
       { label: 'Server Utilization (%)'
       , barWidth: 4
       , barSpacing: 6
       , xOffset: 0
       , height: "40%"
       , width: "50%"
       , barBgColor: [ 'red', 'blue', 'green' ]
       , data: { barCategory: ['Q1', 'Q2', 'Q3', 'Q4']
               , stackedCategory: ['US', 'EU', 'AP']
               , data:
                  [ [ 7, 7, 5]
                  , [8, 2, 0]
                  , [0, 0, 0]
                  , [2, 3, 2] ]
               }
       })

screen.append(bar)

// Also call setData again to exercise both code paths
bar.setData(
       { barCategory: ['Q1', 'Q2', 'Q3', 'Q4']
       , stackedCategory: ['US', 'EU', 'AP']
       , data:
          [ [ 7, 7, 5]
          , [8, 2, 0]
          , [0, 0, 0]
          , [2, 3, 2] ]
       })

screen.render()
