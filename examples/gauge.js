var blessed = require('blessed')
  , contrib = require('../')
  , screen = blessed.screen()
  , gauge = contrib.gauge({label: 'Progress'})

screen.append(gauge)

// Use setData with array to trigger setStack() code path
gauge.setData([{percent: 0.15, stroke: 'green'}, {percent: 0.10, stroke: 'magenta'}])

// Also test setPercent with fractional value (triggers percent < 1.001 branch)
gauge.setPercent(0.25)

screen.render()