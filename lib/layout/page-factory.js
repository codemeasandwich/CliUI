'use strict';

/**
 * Carousel page factory — produces page functions that handle the re-append
 * lifecycle required by the carousel's destructive move() method.
 *
 * The carousel's move() calls detachAll() on every screen child, recursively
 * removing the entire widget tree bottom-up. Persistent elements (chrome
 * border, status bar, tab bar) must be manually re-appended after each
 * transition. This factory encapsulates that boilerplate so each page
 * function follows the same lifecycle:
 *
 *   1. Re-append chrome (detached by carousel.move())
 *   2. Set page context on chrome, tab bar, and status bar
 *   3. Create fresh grid and build widgets via the builder
 *   4. Register widgets with the state router
 *   5. Track active widget map for Tab focus cycling
 *   6. Re-append status bar (detached by carousel.move())
 *   7. Call onPageReady callback for state hydration
 *
 * Error fallback: if the builder throws, a red error box is displayed
 * and the status bar is still re-appended so diagnostic info is visible.
 */

var blessed = require('../blessed');

/**
 * Create an array of carousel-compatible page functions from builder functions.
 *
 * @param {Object} deps - Persistent dashboard objects that survive page transitions
 * @param {Object} deps.chrome - Chrome border frame. Must have .element and .setPage(name).
 * @param {Object} deps.statusBar - Status bar widget. Must have .element and .setPage(name).
 * @param {Object} deps.tabBar - Tab bar widget. Must have .setPage(name).
 * @param {Object} deps.router - State router. Must have .setWidgets(map).
 * @param {string[]} deps.pageNames - Ordered page name strings, one per builder.
 * @param {Function} deps.createGrid - Grid factory: (parentElement, pageName) => grid.
 * @param {Function[]} deps.builders - Page widget builders, each: (grid) => widgetMap.
 *   Builders should be pre-bound with their options (dispatch, store, etc).
 * @param {Function} [deps.onPageReady] - Called after widgets are built and registered.
 *   Receives (widgets) — use this for state hydration (e.g. pushFullState).
 *
 * @returns {{
 *   pages: Function[],
 *   getActiveWidgets: Function,
 *   advanceFocus: Function,
 *   resetFocus: Function
 * }}
 */
function createPageFactory(deps) {
  var chrome = deps.chrome;
  var statusBar = deps.statusBar;
  var tabBar = deps.tabBar;
  var router = deps.router;
  var createGrid = deps.createGrid;
  var builders = deps.builders;
  var pageNames = deps.pageNames;
  var onPageReady = deps.onPageReady;

  // Mutable state: tracks the current page's widget map and focus index.
  // Updated on every page transition by the page function below.
  // Read externally via getActiveWidgets() and advanceFocus().
  var activeWidgets = null;
  var focusIndex = 0;

  // Build one page function per builder. Each function is called by the
  // carousel with the screen as the sole argument: page(screen).
  var pages = builders.map(function (buildFn, pageIdx) {
    var pageName = pageNames[pageIdx];

    return function page(scr) {
      try {
        // Re-append chrome — carousel.move() detaches all screen children
        // (and their descendants). Without this the chrome border and all
        // grid widgets are invisible on every page after the first.
        scr.append(chrome.element);

        // Set page name on chrome (controls section separators/dividers),
        // tab bar (controls header field format), and status bar (show/hide + row)
        chrome.setPage(pageName);
        tabBar.setPage(pageName);
        statusBar.setPage(pageName);

        // Create grid with absolute positioning for this page's layout
        var grid = createGrid(chrome.element, pageName);
        var widgets = buildFn(grid);

        // Register the new widget map with the state router so subsequent
        // state changes are dispatched to these widgets
        router.setWidgets(widgets);

        // Track active widgets for Tab focus cycling (read via getActiveWidgets)
        activeWidgets = widgets;
        focusIndex = 0;

        // Re-append status bar — carousel.move() detached all children.
        // Must come after grid/widget creation so status bar renders on top.
        scr.append(statusBar.element);

        // Notify caller that widgets are ready for hydration. Without this
        // callback, widgets on pages navigated to after startup would show
        // empty/stale content until the next state change event.
        if (onPageReady) onPageReady(widgets);
      } catch (err) {
        // Page build failed — show a red error box so the user sees what
        // went wrong instead of a blank screen. Also re-append status bar
        // for diagnostic info (elapsed time, cost, etc).
        process.stderr.write('[Dashboard] Page function error: ' + err.stack + '\n');
        try {
          var errBox = blessed.box({
            content: 'Page render error: ' + err.message,
            top: 'center', left: 'center',
            width: '80%', height: 5,
            border: { type: 'line' },
            style: { border: { fg: 'red' }, fg: 'white' },
          });
          scr.append(errBox);
          scr.append(statusBar.element);
        } catch (e) {
          // If even the error box fails, nothing more we can do — the stderr
          // write above is the only diagnostic available.
        }
      }
    };
  });

  return {
    /** The carousel-compatible page function array. */
    pages: pages,

    /**
     * Get the active widget map from the most recent page transition.
     * Returns null before the first page is rendered.
     * Used by the Tab key handler to enumerate focusable widgets.
     *
     * @returns {Object|null} Widget map { name: { widget, selector } }
     */
    getActiveWidgets: function () {
      return activeWidgets;
    },

    /**
     * Advance the focus index within a set of focusable widgets and return
     * the new index. Wraps around to 0 when reaching the end.
     *
     * @param {number} focusableCount - Number of focusable widgets on current page
     * @returns {number} The new focus index (0-based)
     */
    advanceFocus: function (focusableCount) {
      if (focusableCount === 0) return 0;
      focusIndex = (focusIndex + 1) % focusableCount;
      return focusIndex;
    },

    /**
     * Reset the focus index to 0. Called internally on page transitions,
     * exposed for external reset if needed (e.g. programmatic page changes).
     */
    resetFocus: function () {
      focusIndex = 0;
    },
  };
}

module.exports = createPageFactory;
