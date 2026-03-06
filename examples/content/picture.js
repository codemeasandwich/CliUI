var path = require('path')
var galactica = require('../../')
  , screen = galactica.screen()

var pic = galactica.picture(
   { file: path.join(__dirname, '..', 'media', 'flower.png')
   , cols: 95
   , onReady: ready})
function ready() { screen.render() }

screen.append(pic)

