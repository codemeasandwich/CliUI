var blessed = require('blessed')
, contrib = require('../index')
, screen = blessed.screen()
, line = contrib.line(
   { width: 80
   , height: 30
   , left: 15
   , top: 12
   , xPadding: 5
   , yPadding: 20  // Custom bottom padding (default is 11)
   , label: 'Line Chart with Custom yPadding'
   , numYLabels: 5
   })

, data = [ { title: 'us-east',
             x: ['t1', 't2', 't3', 't4', 't5'],
             y: [5, 1, 7, 5, 3],
             style: {
              line: 'red'
             }
           }
        ]


screen.append(line) //must append before setting data
line.setData(data)

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render()
