'use strict';
var blessed = require('../../blessed')
  , Node = blessed.Node
  , Canvas = require('../canvas')
  , utils = require('../../utils.js');

function Scatter(options) {
  if (!(this instanceof Node)) {
    return new Scatter(options);
  }

  options.style = options.style || {};
  options.style.point = options.style.point || 'yellow';
  options.style.text = options.style.text || 'green';
  options.style.baseline = options.style.baseline || 'black';
  options.xLabelPadding = options.xLabelPadding || 5;
  options.xPadding = options.xPadding || 10;
  options.yPadding = options.yPadding || 11;
  options.numYLabels = options.numYLabels || 5;
  options.numXLabels = options.numXLabels || 5;
  options.legend = options.legend || {};
  options.wholeNumbersOnly = options.wholeNumbersOnly || false;
  options.marker = options.marker || 'o';

  Canvas.call(this, options);
}

Scatter.prototype = Object.create(Canvas.prototype);

Scatter.prototype.calcSize = function() {
  this.canvasSize = {width: this.width*2-12, height: this.height*4-8};
};

Scatter.prototype.type = 'scatter';

Scatter.prototype.setData = function(data) {
  this._lastSetData = data;

  if (!this.ctx) {
    throw 'error: canvas context does not exist. setData() for scatter plots must be called after the chart has been added to the screen via screen.append()';
  }

  // Compatibility with older api
  if (!Array.isArray(data)) data = [data];

  var self = this;
  var xLabelPadding = this.options.xLabelPadding;
  var yLabelPadding = 3;
  var xPadding = this.options.xPadding;
  var yPadding = this.options.yPadding;
  var c = this.ctx;

  function addLegend() {
    if (!self.options.showLegend) return;
    if (self.legend) self.remove(self.legend);
    var legendWidth = self.options.legend.width || 15;
    self.legend = blessed.box({
      height: data.length+2,
      top: 1,
      width: legendWidth,
      left: self.width-legendWidth-3,
      content: '',
      fg: 'green',
      tags: true,
      border: {
        type: 'line',
        fg: 'black'
      },
      style: {
        fg: 'blue',
      },
      screen: self.screen
    });

    var legandText = '';
    var maxChars = legendWidth-2;
    for (let i=0; i<data.length; i++) {
      var style = data[i].style || {};
      var color = utils.getColorCode(style.point || self.options.style.point);
      legandText += '{'+color+'-fg}'+ data[i].title.substring(0, maxChars)+'{/'+color+'-fg}\r\n';
    }
    self.legend.setContent(legandText);
    self.append(self.legend);
  }

  function getMinX() {
    if (typeof self.options.minX !== 'undefined') {
      return self.options.minX;
    }

    var min = Infinity;

    for (var i = 0; i < data.length; i++) {
      if (data[i].x.length) {
        var current = Math.min(...data[i].x.map(parseFloat));
        if (current < min) {
          min = current;
        }
      }
    }

    return min;
  }

  function getMaxX() {
    if (typeof self.options.maxX !== 'undefined') {
      return self.options.maxX;
    }

    var max = -Infinity;

    for (var i = 0; i < data.length; i++) {
      if (data[i].x.length) {
        var current = Math.max(...data[i].x.map(parseFloat));
        if (current > max) {
          max = current;
        }
      }
    }

    // Add 10% padding
    var range = max - minX;
    return max + range * 0.1;
  }

  function getMinY() {
    if (typeof self.options.minY !== 'undefined') {
      return self.options.minY;
    }

    var min = Infinity;

    for (var i = 0; i < data.length; i++) {
      if (data[i].y.length) {
        var current = Math.min(...data[i].y.map(parseFloat));
        if (current < min) {
          min = current;
        }
      }
    }

    return min;
  }

  var minX = getMinX();
  var minY = getMinY();

  function getMaxY() {
    if (self.options.maxY) {
      return self.options.maxY;
    }

    var max = -Infinity;

    for(let i = 0; i < data.length; i++) {
      if (data[i].y.length) {
        var current = Math.max(...data[i].y.map(parseFloat));
        if (current > max) {
          max = current;
        }
      }
    }

    return max + (max - minY) * 0.2;
  }

  function formatLabel(value, max, min, numLabels, wholeNumbersOnly, abbreviate) {
    var fixed = (((max - min) / numLabels) < 1 && value!=0 && !wholeNumbersOnly) ? 2 : 0;
    var res = value.toFixed(fixed);
    return abbreviate ? utils.abbreviateNumber(res) : res;
  }

  function getMaxYLabelPadding(numLabels, wholeNumbersOnly, abbreviate, min) {
    var max = getMaxY();
    return formatLabel(max, max, min, numLabels, wholeNumbersOnly, abbreviate).length * 2;
  }

  var maxPadding = getMaxYLabelPadding(this.options.numYLabels, this.options.wholeNumbersOnly, this.options.abbreviate, minY);
  if (xLabelPadding < maxPadding) {
    xLabelPadding = maxPadding;
  }

  if ((xPadding - xLabelPadding) < 0) {
    xPadding = xLabelPadding;
  }

  var maxX = getMaxX();
  var maxY = getMaxY();

  function getXPixel(val) {
    var xRange = maxX - minX;
    if (xRange === 0) xRange = 1; // Prevent division by zero
    return ((self.canvasSize.width - xPadding) / xRange) * (val - minX) + xPadding + 2;
  }

  function getYPixel(val) {
    var yRange = maxY - minY;
    if (yRange === 0) yRange = 1; // Prevent division by zero
    var res = self.canvasSize.height - yPadding - (((self.canvasSize.height - yPadding) / yRange) * (val - minY));
    res -= 2; // Separate color from baseline
    return res;
  }

  // Draw a marker at the specified position
  function drawMarker(x, y, marker) {
    switch (marker) {
    case 'o': // Circle
      c.moveTo(x, y-1); c.lineTo(x, y-1);
      c.moveTo(x-1, y); c.lineTo(x+1, y);
      c.moveTo(x, y+1); c.lineTo(x, y+1);
      break;
    case '+': // Plus
      c.moveTo(x, y-2); c.lineTo(x, y+2);
      c.moveTo(x-2, y); c.lineTo(x+2, y);
      break;
    case 'x': // X
      c.moveTo(x-1, y-1); c.lineTo(x+1, y+1);
      c.moveTo(x+1, y-1); c.lineTo(x-1, y+1);
      break;
    case '*': // Star/asterisk (combination of + and x)
      c.moveTo(x, y-2); c.lineTo(x, y+2);
      c.moveTo(x-2, y); c.lineTo(x+2, y);
      c.moveTo(x-1, y-1); c.lineTo(x+1, y+1);
      c.moveTo(x+1, y-1); c.lineTo(x-1, y+1);
      break;
    case '.': // Dot
    default:
      c.moveTo(x, y); c.lineTo(x, y);
      break;
    }
  }

  // Draw points for a data series
  function drawPoints(series, style) {
    style = style || {};
    var color = self.options.style.point;
    c.strokeStyle = style.point || color;

    c.beginPath();
    for (var k = 0; k < series.x.length; k++) {
      var px = getXPixel(series.x[k]);
      var py = getYPixel(series.y[k]);
      drawMarker(px, py, style.marker || self.options.marker);
    }
    c.stroke();
  }

  addLegend();

  c.fillStyle = this.options.style.text;

  c.clearRect(0, 0, this.canvasSize.width, this.canvasSize.height);

  // Draw Y-axis labels
  var yLabelIncrement = (maxY - minY) / this.options.numYLabels;
  if (this.options.wholeNumbersOnly) yLabelIncrement = Math.floor(yLabelIncrement);
  if (yLabelIncrement == 0) yLabelIncrement = 1;

  for (var i = minY; i <= maxY; i += yLabelIncrement) {
    c.fillText(formatLabel(i, maxY, minY, this.options.numYLabels, this.options.wholeNumbersOnly, this.options.abbreviate), xPadding - xLabelPadding, getYPixel(i));
  }

  // Draw data points
  for (var h = 0; h < data.length; h++) {
    drawPoints(data[h], data[h].style);
  }

  c.strokeStyle = this.options.style.baseline;

  // Draw the axes
  c.beginPath();

  c.lineTo(xPadding, 0);
  c.lineTo(xPadding, this.canvasSize.height - yPadding);
  c.lineTo(this.canvasSize.width, this.canvasSize.height - yPadding);

  c.stroke();

  // Draw X-axis labels
  var xLabelIncrement = (maxX - minX) / this.options.numXLabels;
  if (this.options.wholeNumbersOnly) xLabelIncrement = Math.floor(xLabelIncrement);
  if (xLabelIncrement == 0) xLabelIncrement = 1;

  for (var j = minX; j <= maxX; j += xLabelIncrement) {
    var label = formatLabel(j, maxX, minX, this.options.numXLabels, this.options.wholeNumbersOnly, this.options.abbreviate);
    var labelX = getXPixel(j);
    if ((labelX + (label.length * 2)) <= this.canvasSize.width) {
      c.fillText(label, labelX, this.canvasSize.height - yPadding + yLabelPadding);
    }
  }

};

Scatter.prototype.getOptionsPrototype = function() {
  return { width: 80
    , height: 30
    , left: 15
    , top: 12
    , xPadding: 5
    , label: 'Title'
    , showLegend: true
    , legend: {width: 12}
    , marker: 'o'
    , data: [ { title: 'us-east',
      x: [1, 2, 3, 4, 5],
      y: [5, 1, 7, 5, 2],
      style: {
        point: 'red',
        marker: 'o'
      }
    }
    , { title: 'us-west',
      x: [1.5, 2.5, 3.5, 4.5],
      y: [2, 4, 9, 8],
      style: {point: 'yellow', marker: '+'}
    }]

  };
};

module.exports = Scatter;
