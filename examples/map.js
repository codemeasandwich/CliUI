var blessed = require('blessed')
  , contrib = require('../')
  , screen = blessed.screen()
  , map = contrib.map({label: 'World Map'})

screen.append(map)

map.addMarker({"lon" : "-79.0000", "lat" : "37.5000", color: "red", char: "X" })
map.addMarker({"lon" : "-122.4194", "lat" : "37.7749", color: "blue", char: "O" })

// Clear and re-add markers to cover clearMarkers() (line 83)
map.clearMarkers()
map.addMarker({"lon" : "-79.0000", "lat" : "37.5000", color: "red", char: "X" })

screen.render()