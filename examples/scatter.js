var galactica = require('../')
, screen = galactica.screen()
, scatter = galactica.scatter(
   { width: 80
   , height: 30
   , left: 15
   , top: 12
   , xPadding: 10
   , label: 'Scatter Plot'
   , numYLabels: 5
   , numXLabels: 5
   , marker: 'o'  // Default marker style: 'o', '+', 'x', '*', '.'
   })

, data = [ { title: 'us-east',
             x: [1, 2, 3, 4, 5, 6, 7],
             y: [5, 1, 7, 5, 2, 8, 4],
             style: {
              point: 'red',
              marker: 'o'
             }
           }
        ]


screen.append(scatter) //must append before setting data
scatter.setData(data)

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render()
