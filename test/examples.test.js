'use strict';

var test = require('node:test');
var assert = require('node:assert');
var path = require('node:path');
var fs = require('node:fs');

var blessedMock = require('./helpers/blessed-mock');
var TimerController = require('./helpers/timer-control');

var examplesDir = path.join(__dirname, '..', 'examples');
var inlineDataDir = path.join(examplesDir, 'inline-data');

function discoverExamples () {
  var examples = [];

  fs.readdirSync(examplesDir).forEach(function (file) {
    if (file.endsWith('.js')) {
      examples.push({
        name: file.replace('.js', ''),
        path: path.join(examplesDir, file)
      });
    }
  });

  if (fs.existsSync(inlineDataDir)) {
    fs.readdirSync(inlineDataDir).forEach(function (file) {
      if (file.endsWith('.js')) {
        examples.push({
          name: 'inline-data/' + file.replace('.js', ''),
          path: path.join(inlineDataDir, file)
        });
      }
    });
  }

  return examples;
}

var examples = discoverExamples();

test('Examples test suite', async function (t) {
  var originalCwd = process.cwd();

  for (var example of examples) {
    await t.test('Example: ' + example.name, async function () {
      var timerController = new TimerController();
      var mockScreen;
      var exampleError = null;

      timerController.install();
      mockScreen = blessedMock.install({ cols: 120, rows: 40 });

      // Change to examples dir for tests that use relative paths (e.g., picture.js)
      process.chdir(examplesDir);

      try {
        require(example.path);

        await new Promise(function (resolve) {
          setTimeout(resolve, 50);
        });

        if (timerController.intervals.length > 0) {
          await new Promise(function (resolve) {
            setTimeout(resolve, 100);
          });
        }
      } catch (err) {
        exampleError = err;
      }

      timerController.cleanup();
      timerController.restore();
      blessedMock.uninstall();
      blessedMock.clearExampleCache();
      process.chdir(originalCwd);

      if (exampleError) {
        throw new Error('Example "' + example.name + '" threw: ' + exampleError.message);
      }

      assert.ok(mockScreen._renderCount > 0,
        'Example "' + example.name + '" should call screen.render()');
    });
  }
});
