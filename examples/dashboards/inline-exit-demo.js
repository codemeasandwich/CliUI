/**
 * Inline exit mode demo.
 *
 * Demonstrates exitMode: 'inline' — a screen option that writes the last
 * painted frame into the main terminal buffer on exit so the dashboard stays
 * visible after the app terminates and the shell prompt appears below it.
 *
 * Run:  node examples/dashboards/inline-exit-demo.js
 * Quit: press q, Escape, or Ctrl-C
 *
 * After quitting, the dashboard snapshot should remain visible in your
 * terminal scrollback with the prompt immediately below it.
 */

var galactica = require('../../')

// Create screen with inline exit mode.
// The app runs in the alternate buffer as usual during its lifetime. On exit,
// the final frame is captured and printed into the main buffer.
var screen = galactica.screen({ exitMode: 'inline' })

var grid = new galactica.grid({ rows: 12, cols: 12, screen: screen })

// -- Widgets ---------------------------------------------------------------

var line = grid.set(0, 0, 6, 6, galactica.line, {
  label: 'Throughput (req/s)',
  showLegend: true,
  style: { line: 'yellow', text: 'green', baseline: 'black' },
  xLabelPadding: 3,
  xPadding: 5
})

var bar = grid.set(6, 0, 6, 6, galactica.bar, {
  label: 'Server Load (%)',
  barWidth: 6,
  barSpacing: 6,
  xOffset: 2,
  maxHeight: 9
})

var gauge = grid.set(0, 6, 4, 6, galactica.gauge, {
  label: 'Memory Usage',
  percent: 42
})

var log = grid.set(4, 6, 8, 6, galactica.log, {
  fg: 'green',
  selectedFg: 'green',
  label: 'Event Log'
})

// -- Dummy data ------------------------------------------------------------

var servers = ['web-1', 'web-2', 'api-1', 'api-2', 'db-1']
var throughput = {
  title: 'cluster',
  style: { line: 'cyan' },
  x: ['0s', '5s', '10s', '15s', '20s', '25s', '30s', '35s', '40s', '45s'],
  y: [12, 18, 14, 22, 19, 25, 30, 28, 32, 27]
}

function refreshData () {
  // Line chart — shift window and add a new point.
  throughput.y.shift()
  throughput.y.push(Math.max(5, throughput.y[throughput.y.length - 1] + Math.round(Math.random() * 10) - 5))
  line.setData([throughput])

  // Bar chart — random load per server.
  var loads = servers.map(function () { return Math.round(Math.random() * 80 + 10) })
  bar.setData({ titles: servers, data: loads })

  // Gauge — slowly oscillate.
  var pct = 40 + Math.round(Math.sin(Date.now() / 3000) * 20)
  gauge.setPercent(Math.max(0, Math.min(100, pct)))

  // Log — random event.
  var events = [
    'request handled in 12ms',
    'cache miss — key: session_abc',
    'health check OK',
    'connection pool: 8/50 active',
    'deployment v2.4.1 rolling out'
  ]
  log.log('{bold}' + new Date().toLocaleTimeString() + '{/bold} ' + events[Math.floor(Math.random() * events.length)])

  screen.render()
}

// Initial render + periodic updates.
refreshData()
var timer = setInterval(refreshData, 1000)

// -- Quit ------------------------------------------------------------------

screen.key(['escape', 'q', 'C-c'], function () {
  clearInterval(timer)
  return process.exit(0)
})

screen.on('resize', function () {
  line.emit('attach')
  bar.emit('attach')
  gauge.emit('attach')
  log.emit('attach')
})
