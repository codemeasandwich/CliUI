'use strict';
var blessed = require('../blessed')
  , Node = blessed.Node
  , Box = blessed.Box
  , stripAnsi = require('strip-ansi');

function Table(options) {

  var self = this;

  if (!(this instanceof Node)) {
    return new Table(options);
  }

  if (Array.isArray(options.columnSpacing)) {
    throw 'Error: columnSpacing cannot be an array.\r\n' +
           'Note: From release 2.0.0 use property columnWidth instead of columnSpacing.\r\n' +
           'Please refere to the README or to https://github.com/codemeasandwich/CliUI/issues/39';
  }

  options = options || {};
  options.columnSpacing = options.columnSpacing==null? 10 : options.columnSpacing;
  options.bold = true;
  options.selectedFg = options.selectedFg || 'white';
  options.selectedBg = options.selectedBg || 'blue';
  options.fg = options.fg || 'green';
  options.bg = options.bg || '';
  options.interactive = (typeof options.interactive === 'undefined') ? true : options.interactive;
  this.options = options;
  Box.call(this, options);

  // Merge user-provided style with defaults
  var listStyle = {
    selected: {
      fg: options.selectedFg,
      bg: options.selectedBg
    },
    item: {
      fg: options.fg,
      bg: options.bg
    }
  };
  // Pass through focus style if provided
  if (options.style && options.style.focus) {
    listStyle.focus = options.style.focus;
  }

  this.rows = blessed.list({
    //height: 0,
    top: 2,
    width: 0,
    left: 1,
    style: listStyle,
    keys: options.keys,
    vi: options.vi,
    mouse: options.mouse,
    tags: true,
    interactive: options.interactive,
    screen: this.screen
  });

  this.append(this.rows);

  // Forward focus/blur events from rows to table (#126)
  this.rows.on('focus', function() {
    self.emit('focus');
  });
  this.rows.on('blur', function() {
    self.emit('blur');
  });

  // Home/End keys for jumping to first/last row (#234)
  this.rows.key(['home'], function() {
    self.rows.select(0);
    self.screen.render();
  });
  this.rows.key(['end'], function() {
    self.rows.select(self.rows.items.length - 1);
    self.screen.render();
  });

  this.on('attach', function() {
    if (self.options.data) {
      self.setData(self.options.data);
    }
  });

}

Table.prototype = Object.create(Box.prototype);

Table.prototype.focus = function(){
  this.rows.focus();
};

Table.prototype.render = function() {
  if(this.screen.focused == this.rows)
    this.rows.focus();

  this.rows.width = this.width-3;
  this.rows.height = this.height-4;
  Box.prototype.render.call(this);
};


Table.prototype.setData = function(table) {
  var self = this;

  // Calculate column widths from data if not explicitly provided
  var calculatedColumnWidths = [];
  if (!self.options.columnWidth) {
    var numCols = table.headers ? table.headers.length : 0;
    for (var i = 0; i < numCols; i++) {
      var maxWidth = stripAnsi(table.headers[i].toString()).length;
      if (table.data) {
        table.data.forEach(function(row) {
          if (row[i]) {
            var cellWidth = stripAnsi(row[i].toString()).length;
            if (cellWidth > maxWidth) maxWidth = cellWidth;
          }
        });
      }
      calculatedColumnWidths[i] = maxWidth;
    }
  }

  // Resolve percentage-based column widths to pixel values
  var resolvedColumnWidths = [];
  if (self.options.columnWidth) {
    var numCols = self.options.columnWidth.length;
    var availableWidth = self.width - 3 - (self.options.columnSpacing * (numCols - 1));
    var fixedWidth = 0;
    var percentageTotal = 0;
    var percentageIndices = [];

    // First pass: identify fixed vs percentage widths
    self.options.columnWidth.forEach(function(w, i) {
      if (typeof w === 'string' && w.endsWith('%')) {
        var pct = parseFloat(w) / 100;
        percentageIndices.push({ index: i, percent: pct });
        percentageTotal += pct;
      } else {
        resolvedColumnWidths[i] = w;
        fixedWidth += w;
      }
    });

    // Second pass: calculate percentage widths from remaining space
    var remainingWidth = availableWidth - fixedWidth;
    percentageIndices.forEach(function(item) {
      // Normalize percentages if they exceed 100%
      var normalizedPct = percentageTotal > 1 ? item.percent / percentageTotal : item.percent;
      resolvedColumnWidths[item.index] = Math.floor(remainingWidth * normalizedPct);
    });
  }

  var dataToString = function(d) {
    var str = '';
    d.forEach(function(r, i) {
      var colsize = resolvedColumnWidths[i] || (self.options.columnWidth && self.options.columnWidth[i]) || calculatedColumnWidths[i] || 10
        , strip = stripAnsi(r.toString())
        , ansiLen = r.toString().length - strip.length
        , spaceLength = colsize - strip.length + self.options.columnSpacing;
      r = r.toString().substring(0, colsize + ansiLen); //compensate for ansi len
      if (spaceLength < 0) {
        spaceLength = 0;
      }
      var spaces = new Array(spaceLength).join(' ');
      str += r + spaces;
    });
    return str;
  };

  var formatted = [];

  table.data.forEach(function(d) {
    var str = dataToString(d);
    formatted.push(str);
  });
  this.setContent(dataToString(table.headers));
  this.rows.setItems(formatted);
};

Table.prototype.getOptionsPrototype = function() {
  return  { keys: true
    , fg: 'white'
    , interactive: false
    , label: 'Active Processes'
    , width: '30%'
    , height: '30%'
    , border: {type: 'line', fg: 'cyan'}
    , columnSpacing: 10
    , columnWidth: [16, 12]
    , data: { headers: ['col1', 'col2']
      , data: [ ['a', 'b']
        , ['5', 'u']
        , ['x', '16.1'] ]}
  };
};

Table.prototype.type = 'table';

module.exports = Table;
