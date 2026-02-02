var blessed = require('blessed')
  , contrib = require('../../')
  , screen = blessed.screen()
  // Use stack option to trigger stack initialization path in attach handler
  , gauge = contrib.gauge({
      label: 'Progress',
      stack: [{percent: 0.15, stroke: 'green'}, {percent: 0.10, stroke: 'magenta'}]
    })

screen.append(gauge)
screen.render()