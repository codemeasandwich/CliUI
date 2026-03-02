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
 *   1. Re-append persistent elements (chrome, status bar, tab bar)
 *   2. Set page context on chrome, tab bar, and status bar
 *   3. Create fresh grid and build widgets via the builder
 *   4. Register widgets with the state router
 *   5. Track active widget map for Tab focus cycling
 *   6. Call onPageReady callback for state hydration
 *
 * Re-appending persistent elements BEFORE calling setPage() is critical:
 * statusBar.setPage() calls el.show()/el.hide() which must operate on an
 * attached element to render correctly once screen.render() fires.
 *
 * Error fallback: if the builder throws, a red error box is displayed
 * and persistent elements are defensively re-appended for diagnostics.
 */

var blessed = require('../blessed');

/**
 * Create an array of carousel-compatible page functions from builder functions.
 *
 * @param {Object} deps - Persistent dashboard objects that survive page transitions
 * @param {Object} deps.chrome - Chrome border frame. Must have .element and .setPage(name).
 * @param {Object} deps.statusBar - Status bar widget. Must have .element and .setPage(name).
 * @param {Object} deps.tabBar - Tab bar widget. Must have .element and .setPage(name).
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
        // Re-append all persistent elements — carousel.move() calls detachAll()
        // which recursively removes every screen child. Chrome, status bar, and
        // tab bar must all be re-attached before any other work.
        scr.append(chrome.element);
        scr.append(statusBar.element);
        if (tabBar.element) scr.append(tabBar.element);

        // Set page context AFTER re-appending so show()/hide() and position
        // changes in setPage() operate on attached elements. statusBar.setPage()
        // calls el.show()/el.hide() which must target an element already in the
        // screen's children array to render correctly on the next screen.render().
        chrome.setPage(pageName);
        tabBar.setPage(pageName);
        statusBar.setPage(pageName);

        // Create grid with absolute positioning for this page's layout.
        // Grid and its widgets become children of chrome.element (not screen),
        // so they render within chrome's bounds without affecting screen z-order.
        var grid = createGrid(chrome.element, pageName);
        var widgets = buildFn(grid);

        // Register the new widget map with the state router so subsequent
        // state changes are dispatched to these widgets
        router.setWidgets(widgets);

        // Track active widgets for Tab focus cycling (read via getActiveWidgets)
        activeWidgets = widgets;
        focusIndex = 0;

        // Notify caller that widgets are ready for hydration. Without this
        // callback, widgets on pages navigated to after startup would show
        // empty/stale content until the next state change event.
        if (onPageReady) onPageReady(widgets);
      } catch (err) {
        // Page build failed — show a red error box so the user sees what
        // went wrong instead of a blank screen. Defensively re-append all
        // persistent elements since the try block may have failed before
        // reaching those appends. Blessed's append() is idempotent when the
        // element is already a child (it moves to end of children array).
        process.stderr.write('[Dashboard] Page function error: ' + err.stack + '\n');
        try {
          scr.append(chrome.element);
          scr.append(statusBar.element);
          if (tabBar.element) scr.append(tabBar.element);
          var errBox = blessed.box({
            content: 'Page render error: ' + err.message,
            top: 'center', left: 'center',
            width: '80%', height: 5,
            border: { type: 'line' },
            style: { border: { fg: 'red' }, fg: 'white' },
          });
          scr.append(errBox);
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
