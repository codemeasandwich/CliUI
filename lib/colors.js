'use strict';

// ANSI escape codes
var codes = {
  // Modifiers
  bold: [1, 22],
  italic: [3, 23],

  // Colors (foreground)
  black: [30, 39],
  red: [31, 39],
  green: [32, 39],
  yellow: [33, 39],
  blue: [34, 39],
  magenta: [35, 39],
  cyan: [36, 39],
  white: [37, 39],
  gray: [90, 39],
  grey: [90, 39]
};

// Create a chainable color function
function createChainable(stack) {
  stack = stack || [];

  function apply(str) {
    if (stack.length === 0) return str;

    var open = '';
    var close = '';
    for (var i = 0; i < stack.length; i++) {
      open += '\x1b[' + stack[i][0] + 'm';
      close = '\x1b[' + stack[i][1] + 'm' + close;
    }
    return open + str + close;
  }

  // Make the function chainable by adding properties
  Object.keys(codes).forEach(function(name) {
    Object.defineProperty(apply, name, {
      get: function() {
        return createChainable(stack.concat([codes[name]]));
      },
      enumerable: true
    });
  });

  return apply;
}

// Export the root chainable object
module.exports = createChainable([]);
