var galactica = require('../')
  , screen = galactica.screen()
  , log = galactica.log(
      { fg: "green"
      , label: 'Server Log'
      , height: "20%"
      , tags: true
      , bufferLength: 5  // Small buffer to trigger overflow path
      , border: {type: "line", fg: "cyan"} })

screen.append(log)

// Log immediately to trigger buffer overflow (covers lines 25-28)
for (var i = 0; i < 10; i++) {
  log.log("log line " + i)
}
// Also log with ANSI tags (already supported, just exercising more content)
log.log("new {red-fg}colored{/red-fg} line")

setInterval(function() {log.log("interval line " + i++)}, 500)

screen.render()
