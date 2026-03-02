'use strict';
// @esm-group Layout

/**
 * lib/layout/computed-grid.js
 *
 * Dynamic layout engine for dashboard pages using proportional positioning.
 *
 * Creates a grid that positions widgets at exact terminal cell coordinates
 * derived from computePageLayout, rather than using percentage-based
 * positioning. Uses GRID_COORD_MAP to translate (row, col, rowSpan, colSpan)
 * grid coordinates to widget names, then looks up their computed positions
 * in the layout.
 *
 * Label extraction: Widget labels are extracted from opts and rendered as
 * separate text elements above the bordered box, matching the template
 * contract where titles appear on their own row above the box border.
 * The setLabel() method on each widget element is intercepted to redirect
 * label updates to the separate title element (supporting dynamic label
 * updates from widgets like task-tracker).
 *
 * Falls back to the percentage-based Grid when no computed layout exists
 * for the requested page name (should never happen in production).
 */

// Vendored blessed library — provides box() factory for creating title elements
var blessed = require('../blessed');

// Percentage-based grid used as fallback when no computed layout exists
var Grid = require('./grid');

// Proportional layout computation — provides widget positions and grid coord mapping
var pageCompute = require('./page-compute');

/**
 * Create a dynamic layout engine for a specific dashboard page.
 *
 * Computes widget positions from the parent screen's dimensions, scaling
 * proportionally from the 120x40 baseline. The grid coordinate keys
 * (row, col, rowSpan, colSpan) are mapped to widget names via GRID_COORD_MAP,
 * then looked up in the computed layout.
 *
 * Each layout entry specifies:
 *   top/left/width/height — where the bordered box is drawn
 *   titleY/titleX — row/col where the widget title text appears (above the box)
 *
 * Returns an object with the same .set(row, col, rowSpan, colSpan, factory, opts)
 * API as Grid, but positions widgets at computed terminal cell coordinates.
 * Labels are extracted from widget opts and rendered as separate text elements
 * above the bordered box, matching the template contract where titles appear
 * on their own row above the border.
 *
 * @param {Object} parent - Galactica screen or chrome box instance
 * @param {string} [pageName] - Page identifier (default: 'spec')
 * @returns {Object} Layout engine with .set() method
 */
function createComputedGrid(parent, pageName) {
  pageName = pageName || 'spec';

  // Get screen dimensions from parent element's screen reference
  var screen = parent.screen || parent;
  var cols = screen.cols || 120;
  var rows = screen.rows || 40;

  // Compute layout for this page at the current screen dimensions
  var layout = pageCompute.computePageLayout(pageName, cols, rows);
  var coordMap = pageCompute.GRID_COORD_MAP[pageName];

  // Fallback: if no layout exists for this page, use the percentage-based
  // grid as a safe default (should never happen in production)
  if (!layout || !coordMap) {
    return new Grid({ rows: 12, cols: 12, screen: parent });
  }

  return {
    /**
     * Position a widget at computed coordinates from the page layout.
     *
     * The method:
     * 1. Maps the grid coordinate key to a widget name via GRID_COORD_MAP
     * 2. Looks up the widget's computed position in the layout
     * 3. Extracts label from opts so blessed doesn't embed it in the border
     * 4. Ensures all widgets have borders (templates expect box borders)
     * 5. Creates the bordered element at computed coordinates
     * 6. Creates a separate text element for the title above the bordered box
     * 7. Monkey-patches setLabel() to redirect to the title element
     *
     * @param {number} row - Grid row (0-based, from 12x12 grid)
     * @param {number} col - Grid column (0-based)
     * @param {number} rowSpan - Number of grid rows to span
     * @param {number} colSpan - Number of grid columns to span
     * @param {Function} factory - Widget constructor (e.g. blessed.box)
     * @param {Object} [opts] - Options passed to the factory
     * @returns {Object} The created element (bordered box)
     */
    set: function set(row, col, rowSpan, colSpan, factory, opts) {
      opts = opts || {};
      var key = row + ',' + col + ',' + rowSpan + ',' + colSpan;
      var widgetName = coordMap[key];
      var widgetLayout = widgetName ? layout.widgets[widgetName] : null;

      if (!widgetLayout) {
        // Unknown grid coordinate — warn and fall back to percentage positioning.
        // This indicates the layout mapping or compute function needs updating.
        process.stderr.write(
          '[galactica computed-grid] No layout entry for ' + pageName + ':' + key + ' -- using fallback\n'
        );
        var fallback = new Grid({ rows: 12, cols: 12, screen: parent });
        return fallback.set(row, col, rowSpan, colSpan, factory, opts);
      }

      // Extract label from opts — it will be rendered as a separate title element
      // instead of being embedded in the blessed border (┌─ Label ─┐).
      // Templates show titles on their own row above the ┌──┐ border.
      var label = opts.label;
      var restOpts = {};
      var k;
      for (k in opts) {
        if (k !== 'label') restOpts[k] = opts[k];
      }

      // Ensure all widgets have borders — templates expect ┌──┐ for every widget
      if (!restOpts.border) {
        restOpts.border = { type: 'line' };
      }

      // Position the bordered element at computed coordinates
      restOpts.top = widgetLayout.top;
      restOpts.left = widgetLayout.left;
      restOpts.width = widgetLayout.width;
      restOpts.height = widgetLayout.height;
      var el = factory(restOpts);

      // Append bordered element to parent (same as Grid.set internally)
      parent.append(el);

      // Render title as separate text element above the bordered box.
      // This matches the template contract where labels appear on their own row
      // (e.g. "  Phase Timeline" on row 4, ┌──┐ on row 5).
      //
      // Width is set to text length (not inner.width) to prevent trailing
      // spaces from overwriting page divider │ characters at the right edge
      // of the title area. Blessed pads content to fill the box width,
      // so a full-width title element would paint spaces over dividers.
      var titleEl = null;
      if (label && widgetLayout.titleY != null) {
        var titleText = label.trim();
        titleEl = blessed.box({
          parent: parent,
          top: widgetLayout.titleY,
          left: widgetLayout.titleX,
          width: titleText.length,
          height: 1,
          content: titleText,
          tags: true
        });
      }

      // Intercept setLabel() on the widget element to redirect label updates
      // to the separate title element instead of embedding in the blessed border.
      // Widgets like taskTracker call el.setLabel() dynamically to update counts,
      // which would produce ┌─ Task Tracker [3/5] ─┐ in the border row instead
      // of placing the text on the title row above. Also resizes the title element
      // to match the new text length (prevents trailing space overwrites).
      if (titleEl) {
        el.setLabel = function setLabelRedirect(newLabel) {
          var text = (newLabel || '').trim();
          titleEl.width = text.length;
          titleEl.setContent(text);
        };
      }

      return el;
    }
  };
}

module.exports = createComputedGrid;
