var galactica = require('../')
  , screen = galactica.screen()
    
var pic = galactica.picture(
   { file: './media/flower.png'
   , cols: 95
   , onReady: ready})
function ready() { screen.render() }

screen.append(pic)

