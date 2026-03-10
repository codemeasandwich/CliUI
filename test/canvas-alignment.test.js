'use strict';

var test = require('node:test');
var assert = require('node:assert');
var galactica = require('../index.js');
var galacticaMock = require('./helpers/galactica-mock');

test('Canvas alignment correctly rounds dimensions without throwing', function (t) {
    // We use odd sizes that would result in dimensions not matching the drawille constraints (width%2==0, height%4==0)
    var mockScreen = galacticaMock.install({ cols: 111, rows: 33 });

    // 1. Instantiating a generic Canvas widget with odd dimensions
    var canvasBox = galactica.canvas({
        parent: mockScreen,
        width: 17,
        height: 13
    });

    // 2. Ensuring donut doesn't crash on attach and resize
    var donut = galactica.donut({
        parent: mockScreen,
        width: 25,
        height: 15,
        data: [{ percent: 0.5, label: 'test', color: 'red' }]
    });

    // 3. Ensuring line chart doesn't crash 
    var lineChart = galactica.line({
        parent: mockScreen,
        width: 33,
        height: 11,
        data: [{ title: 'test', x: ['a', 'b'], y: [1, 2] }]
    });

    var errorThrown = false;
    try {
        mockScreen.render();
    } catch (err) {
        errorThrown = true;
        console.error(err);
    }

    galacticaMock.uninstall();

    assert.strictEqual(errorThrown, false, 'Canvas _initCanvas threw an error at odd dimensions');
    assert.ok(mockScreen._renderCount > 0, 'mockScreen should have rendered');
});
