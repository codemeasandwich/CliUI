'use strict';

var test = require('node:test');
var assert = require('node:assert');
var path = require('node:path');
var fs = require('node:fs');

var galacticaMock = require('./helpers/galactica-mock');
var TimerController = require('./helpers/timer-control');

var examplesDir = path.join(__dirname, '..', 'examples');

function discoverExamples () {
  var examples = [];

  /* Helper modules (e.g. diagram-drag-debug.js) export a function
     and are not standalone examples — skip them. */
  var helperPattern = /-debug\.js$/;

  /* Recursively scan all subdirectories of the examples folder.
     Each subfolder (charts/, diagrams/, etc.) contains categorised
     example scripts.  The display name preserves the relative path
     so test output shows which category each example belongs to. */
  fs.readdirSync(examplesDir, { withFileTypes: true }).forEach(function (entry) {
    if (!entry.isDirectory()) return;

    var subDir = path.join(examplesDir, entry.name);
    fs.readdirSync(subDir).forEach(function (file) {
      if (file.endsWith('.js') && !helperPattern.test(file)) {
        examples.push({
          name: entry.name + '/' + file.replace('.js', ''),
          path: path.join(subDir, file)
        });
      }
    });
  });

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
      mockScreen = galacticaMock.install({ cols: 120, rows: 40 });

      // Change to examples dir for tests that use relative paths (e.g., picture.js)
      process.chdir(examplesDir);

      try {
        require(example.path);

        await new Promise(function (resolve) {
          setTimeout(resolve, 250);
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
      galacticaMock.uninstall();
      galacticaMock.clearExampleCache();
      process.chdir(originalCwd);

      if (exampleError) {
        throw new Error('Example "' + example.name + '" threw: ' + exampleError.message);
      }

      assert.ok(mockScreen._renderCount > 0,
        'Example "' + example.name + '" should call screen.render()');
    });
  }
});
