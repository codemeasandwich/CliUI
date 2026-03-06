// Carousel without rotation - stops at first/last page
// This example demonstrates the carousel widget with rotate:false
// When reaching boundaries, it stays at the current page instead of wrapping

var galactica = require('../../')
  , screen = galactica.screen()

function page1(screen) {
  var box = galactica.box({
    content: 'Page 1 (First)\n\nUse arrow keys to navigate.\nWith rotate:false, pressing left here does nothing.',
    top: 'center',
    left: 'center',
    width: '50%',
    height: '50%',
    border: { type: 'line' },
    style: { border: { fg: 'green' } }
  })
  screen.append(box)
}

function page2(screen) {
  var box = galactica.box({
    content: 'Page 2 (Middle)\n\nYou can navigate left or right from here.',
    top: 'center',
    left: 'center',
    width: '50%',
    height: '50%',
    border: { type: 'line' },
    style: { border: { fg: 'yellow' } }
  })
  screen.append(box)
}

function page3(screen) {
  var box = galactica.box({
    content: 'Page 3 (Last)\n\nWith rotate:false, pressing right here does nothing.',
    top: 'center',
    left: 'center',
    width: '50%',
    height: '50%',
    border: { type: 'line' },
    style: { border: { fg: 'red' } }
  })
  screen.append(box)
}

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

// Create carousel with rotate:false - stops at boundaries
var carousel = new galactica.carousel(
  [page1, page2, page3],
  { screen: screen
  , controlKeys: true
  , rotate: false  // Key option: don't wrap around at boundaries
  }
)
carousel.start()

// Test boundary behavior to cover lines 21-22 and 33-35 in carousel.js
// Try to go before first page (should stay at page 1)
carousel.prev()  // At page 0, with rotate:false, stays at 0 (covers lines 33-35)

// Navigate to last page
carousel.end()   // Go to page 3

// Try to go past last page (should stay at page 3)
carousel.next()  // At last page, with rotate:false, stays there (covers lines 21-22)

// Return to first page for display
carousel.home()

screen.render()
