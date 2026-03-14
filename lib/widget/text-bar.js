'use strict';
// @esm-group Widgets

/**
 * lib/widget/text-bar.js
 *
 * Text-based horizontal bar widget for terminal dashboards.
 *
 * Renders a single-line display with three regions:
 *   [left label]  [████░░░░░░]  [right value]
 *
 * Unlike the canvas-based gauge widget (which uses drawille pixel rendering),
 * this widget operates at the character-cell level using Unicode block
 * characters. It extends blessed.Box and renders via setContent(), following
 * the same pattern as the Sparkline widget.
 *
 * The bar portion uses configurable fill/empty characters (default: █/░)
 * and supports blessed color tags for styling. Label widths can be fixed
 * or auto-measured from the data.
 *
 * Uses fitToWidth from slot-layout for label padding/truncation with
 * correct CJK/emoji/blessed-tag handling, and displayWidth from
 * display-width for auto-measuring label cell widths.
 */

var blessed = require('../blessed');
var Node = blessed.Node;
var Box = blessed.Box;
var slotLayout = require('../utils/slot-layout');
var dw = require('../utils/display-width');

/**
 * Construct a TextBar widget.
 *
 * Options (beyond standard blessed.Box options):
 *   barFillChar  {string}  Character for filled portion (default: '█' U+2588)
 *   barEmptyChar {string}  Character for empty portion (default: '░' U+2591)
 *   spacing      {number}  Spaces between label↔bar and bar↔value (default: 2)
 *   labelWidth   {number}  Fixed left-label cell width (null = auto from data)
 *   valueWidth   {number}  Fixed right-value cell width (null = auto from data)
 *   style.bar.fillFg  {string}  Blessed color name for filled chars
 *   style.bar.emptyFg {string}  Blessed color name for empty chars
 *
 * @param {Object} options - Widget configuration
 */
function TextBar(options) {
  // Factory guard — allow construction without `new` keyword
  if (!(this instanceof Node)) {
    return new TextBar(options);
  }

  var self = this;

  options = options || {};
  options.style = options.style || {};
  options.style.bar = options.style.bar || {};
  this.options = options;

  // Bar rendering characters — configurable for different visual styles
  this._barFillChar = options.barFillChar || '\u2588';
  this._barEmptyChar = options.barEmptyChar || '\u2591';

  // Spacing between label↔bar and bar↔value regions
  this._spacing = typeof options.spacing === 'number' ? options.spacing : 2;

  // Fixed label/value widths — null means auto-measure from data
  this._labelWidth = options.labelWidth || null;
  this._valueWidth = options.valueWidth || null;

  Box.call(this, options);

  // Render initial data on attach (widget needs screen dimensions)
  this.on('attach', function () {
    if (self.options.data) {
      self.setData(self.options.data);
    }
  });
}

TextBar.prototype = Object.create(Box.prototype);

TextBar.prototype.type = 'text-bar';

/**
 * Set the bar data and re-render the widget content.
 *
 * @param {Object} data - Bar data
 * @param {string} data.label   - Left label text (e.g. 'CacheC')
 * @param {number} data.percent - Fill ratio, 0.0 to 1.0 (values outside
 *   this range are clamped to prevent rendering artifacts)
 * @param {string} data.value   - Right value text (e.g. '1.4K')
 */
TextBar.prototype.setData = function (data) {
  // Store data for potential re-render on resize
  this._data = data;

  var label = data.label || '';
  var value = data.value || '';

  // Clamp percent to [0, 1] — prevents negative fill or overflow
  var percent = Math.max(0, Math.min(1, data.percent || 0));

  // Inner width accounts for left/right border cells (1 cell each)
  var innerWidth = this.width - 2;

  // Determine left-label and right-value cell widths.
  // Fixed widths (from options) override auto-measurement from data.
  var leftW = this._labelWidth || dw.displayWidth(label);
  var rightW = this._valueWidth || dw.displayWidth(value);

  // Bar width is the remaining space after labels and spacing.
  // Each side has `spacing` cells of padding between label↔bar and bar↔value.
  var barWidth = innerWidth - leftW - rightW - (this._spacing * 2);

  // If the widget is too narrow to show even 1 bar character,
  // progressively shrink labels to make room
  if (barWidth < 1) {
    barWidth = 1;
    // Recalculate label widths from the remaining space
    var available = innerWidth - 1 - (this._spacing * 2);
    if (available < 0) available = 0;
    // Split remaining space between label and value
    leftW = Math.floor(available / 2);
    rightW = available - leftW;
  }

  // Compute filled and empty character counts from the percent ratio
  var filledCount = Math.round(percent * barWidth);
  var emptyCount = barWidth - filledCount;

  // Build the bar string from fill/empty characters
  var filledStr = this._barFillChar.repeat(filledCount);
  var emptyStr = this._barEmptyChar.repeat(emptyCount);

  // Wrap bar characters in blessed color tags when tags are enabled.
  // Tag wrapping follows the Sparkline pattern: {color-fg}text{/color-fg}
  var useTags = this.options.tags !== false;
  var barStyle = this.options.style.bar;

  if (useTags && barStyle.fillFg && filledStr) {
    filledStr = '{' + barStyle.fillFg + '-fg}' + filledStr + '{/' + barStyle.fillFg + '-fg}';
  }
  if (useTags && barStyle.emptyFg && emptyStr) {
    emptyStr = '{' + barStyle.emptyFg + '-fg}' + emptyStr + '{/' + barStyle.emptyFg + '-fg}';
  }

  // Assemble the full line: padded label + spacing + bar + spacing + padded value.
  // fitToWidth handles truncation of long labels and padding of short ones,
  // with correct CJK/emoji/blessed-tag measurement.
  var spacer = ' '.repeat(this._spacing);
  var line = slotLayout.fitToWidth(label, leftW) + spacer
    + filledStr + emptyStr + spacer
    + slotLayout.fitToWidth(value, rightW);

  this.setContent(line);
};

/**
 * Return a prototype options object for example/demo generation.
 * Follows the convention used by gauge, sparkline, and other widgets.
 *
 * @returns {Object} Example options with sensible defaults
 */
TextBar.prototype.getOptionsPrototype = function () {
  return {
    label: 'Text Bar',
    tags: true,
    border: { type: 'line', fg: 'cyan' },
    width: 40,
    height: 3,
    style: { bar: { fillFg: 'green', emptyFg: 'gray' } },
    data: { label: 'Cache', percent: 0.40, value: '1.4K' }
  };
};

module.exports = TextBar;
