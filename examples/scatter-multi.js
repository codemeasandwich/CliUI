var blessed = require('../lib/blessed')
, contrib = require('../index')
, screen = blessed.screen()
, scatter = contrib.scatter(
   { width: 80
   , height: 30
   , left: 15
   , top: 12
   , xPadding: 10
   , label: 'Multi-Series Scatter Plot'
   , showLegend: true
   , legend: {width: 12}
   , numYLabels: 5
   , numXLabels: 5
   })

, data = [
  { title: 'us-east',
    x: [1, 2, 3, 4, 5, 6, 7],
    y: [5, 1, 7, 5, 2, 8, 4],
    style: {
      point: 'red',
      marker: 'o'
    }
  },
  { title: 'us-west',
    x: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5],
    y: [2, 4, 9, 6, 3, 7],
    style: {
      point: 'yellow',
      marker: '+'
    }
  },
  { title: 'eu-north',
    x: [2, 3, 4, 5, 6],
    y: [3, 5, 2, 6, 4],
    style: {
      point: 'blue',
      marker: 'x'
    }
  }
]


screen.append(scatter) //must append before setting data
scatter.setData(data)

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render()
