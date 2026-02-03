'use strict';

/**
 * Generate a sparkline string from an array of numbers.
 * Uses Unicode block characters to represent values.
 *
 * @param {number[]} numbers - Array of numbers to visualize
 * @param {Object} [options] - Optional min/max bounds
 * @param {number} [options.min] - Minimum value (defaults to array min)
 * @param {number} [options.max] - Maximum value (defaults to array max)
 * @returns {string} Sparkline string using Unicode block characters
 */
function sparkline(numbers, options) {
  if (!numbers || numbers.length === 0) {
    return '';
  }

  options = options || {};

  var min = typeof options.min === 'number' ? options.min : Math.min.apply(null, numbers);
  var max = typeof options.max === 'number' ? options.max : Math.max.apply(null, numbers);

  var ticks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  var range = max - min;

  return numbers.map(function(n) {
    if (range === 0) {
      return ticks[0];
    }
    var index = Math.round(((n - min) / range) * (ticks.length - 1));
    return ticks[Math.max(0, Math.min(ticks.length - 1, index))];
  }).join('');
}

module.exports = sparkline;
