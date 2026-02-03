'use strict';

/**
 * Blessed module mock for headless testing.
 * Intercepts blessed.screen() to inject mock TTY I/O streams.
 * Based on patterns from lib/server-utils.js.
 */

var blessed = require('../../lib/blessed');

/**
 * Mock output buffer that captures terminal output.
 * Mirrors OutputBuffer from lib/server-utils.js.
 */
function TestOutputBuffer (options) {
  options = options || {};
  this.isTTY = true;
  this.columns = options.cols || 120;
  this.rows = options.rows || 40;
  this.output = [];

  this.write = function (s) {
    s = s.replace('\x1b8', '');
    this.output.push(s);
  };

  this.on = function () {};

  this.getOutput = function () {
    return this.output.join('');
  };

  this.clear = function () {
    this.output = [];
  };
}

/**
 * Mock input buffer for stdin.
 * Mirrors InputBuffer from lib/server-utils.js.
 */
function TestInputBuffer () {
  this.isTTY = true;
  this.isRaw = true;

  this.emit = function () {};
  this.setRawMode = function () {};
  this.resume = function () {};
  this.pause = function () {};
  this.on = function () {};
}

/**
 * Creates a mock blessed screen with captured I/O.
 */
function createMockScreen (options) {
  options = options || {};

  var output = new TestOutputBuffer({
    cols: options.cols || 120,
    rows: options.rows || 40
  });
  var input = new TestInputBuffer();

  var program = blessed.program({
    output: output,
    input: input
  });

  var screen = blessed.screen({
    program: program,
    smartCSR: true,
    warnings: false
  });

  screen._testOutput = output;
  screen._testInput = input;
  screen._renderCount = 0;

  var originalRender = screen.render.bind(screen);
  screen.render = function () {
    screen._renderCount++;
    try {
      return originalRender();
    } catch (e) {
      // Ignore render errors in test environment
    }
  };

  return screen;
}

var mockScreen = null;
var originalScreen = null;
var originalExit = null;

/**
 * Install the blessed mock.
 * Intercepts blessed.screen() to return mock screen.
 */
function install (options) {
  mockScreen = createMockScreen(options);

  originalScreen = blessed.screen;
  blessed.screen = function () {
    return mockScreen;
  };

  originalExit = process.exit;
  process.exit = function () {};

  return mockScreen;
}

/**
 * Uninstall the blessed mock and restore originals.
 */
function uninstall () {
  if (originalScreen) {
    blessed.screen = originalScreen;
    originalScreen = null;
  }

  if (originalExit) {
    process.exit = originalExit;
    originalExit = null;
  }

  if (mockScreen) {
    try {
      mockScreen.destroy();
    } catch (e) {
      // Ignore cleanup errors
    }
    mockScreen = null;
  }
}

/**
 * Get the current mock screen.
 */
function getMockScreen () {
  return mockScreen;
}

/**
 * Clear the require cache for example modules.
 * Required for re-running examples in isolation.
 */
function clearExampleCache (examplesDir) {
  Object.keys(require.cache)
    .filter(function (key) {
      return key.includes('/examples/');
    })
    .forEach(function (key) {
      delete require.cache[key];
    });
}

module.exports = {
  install: install,
  uninstall: uninstall,
  getMockScreen: getMockScreen,
  clearExampleCache: clearExampleCache,
  TestOutputBuffer: TestOutputBuffer,
  TestInputBuffer: TestInputBuffer
};
