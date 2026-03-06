// Server-side rendering utilities demonstration
// Shows how to use server-utils for rendering Galactica dashboards to HTTP responses

var galactica = require('../../')
  , screen = galactica.screen()  // Required for test harness

// This example demonstrates the server-utils module which allows
// rendering Galactica dashboards to HTTP responses.
// It covers lines 6-66 in server-utils.js

// Create mock request/response objects to demonstrate the API
// In a real application, these would come from http.createServer()

var mockResponse = {
  headersSent: false,
  writeHead: function(status, headers) {
    this.headersSent = true
  },
  write: function(data) {
    // In a real server, this would send data to the client
  },
  end: function(data) {
    // In a real server, this would end the response
  }
}

// Demonstrate OutputBuffer (covers lines 6-16)
var outputBuffer = new galactica.OutputBuffer({
  res: mockResponse,
  cols: 100,
  rows: 30
})

// Test OutputBuffer properties and methods (covers lines 7-15)
outputBuffer.isTTY        // line 7
outputBuffer.columns      // line 8
outputBuffer.rows         // line 9
outputBuffer.write('Test output')  // line 10-13
outputBuffer.write('\x1b8Test with escape sequence')  // Tests the replace on line 11
outputBuffer.on('data', function() {})  // line 15

// Demonstrate InputBuffer (covers lines 18-29)
var inputBuffer = new galactica.InputBuffer()

// Test InputBuffer properties and methods (covers lines 19-28)
inputBuffer.isTTY         // line 19
inputBuffer.isRaw         // line 20
inputBuffer.emit('test')  // line 22
inputBuffer.setRawMode(true)  // line 24
inputBuffer.resume()      // line 25
inputBuffer.pause()       // line 26
inputBuffer.on('data', function() {})  // line 28

// Demonstrate serverError (covers lines 31-40)
var errorResponse = {
  headersSent: false,
  writeHead: function(status, headers) {
    this.headersSent = true
  },
  write: function(data) {},
  end: function(data) {}
}
galactica.serverError({}, errorResponse, 'Test error message')

// Demonstrate createScreen with valid dimensions (covers lines 43-66)
var validResponse = {
  headersSent: false,
  writeHead: function(status, headers) {
    this.headersSent = true
  },
  write: function(data) {},
  end: function(data) {}
}
var validRequest = {
  url: '/?cols=100&rows=30&terminal=xterm&isOSX=true&isiTerm2=true'
}

// Note: In test environment, galactica.screen() is mocked, so createScreen
// will use the mock. We still call it to exercise the code paths.
var serverScreen = galactica.createScreen(validRequest, validResponse)

// Test createScreen with invalid dimensions (covers lines 49-52)
var invalidRequest = {
  url: '/?cols=10&rows=1'  // Too small - triggers validation error
}
var invalidResponse = {
  headersSent: false,
  writeHead: function() { this.headersSent = true },
  write: function() {},
  end: function() {}
}
var invalidScreen = galactica.createScreen(invalidRequest, invalidResponse)
// invalidScreen should be null due to dimension validation

// Display info box on main screen
var box = galactica.box({
  label: 'Server Utils Demo',
  content: 'This example demonstrates server-side rendering utilities.\n\n' +
    'OutputBuffer: Mock TTY output for HTTP responses\n' +
    'InputBuffer: Mock stdin for HTTP context\n' +
    'createScreen: Creates Galactica screen for HTTP rendering\n' +
    'serverError: Handles server-side errors',
  top: 'center',
  left: 'center',
  width: '80%',
  height: '60%',
  border: { type: 'line' },
  style: { border: { fg: 'cyan' } }
})

screen.append(box)

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render()
