'use strict';

/**
 * Dashboard carousel — wraps galactica's Carousel + createPageFactory into
 * a single factory that centralises persistent widget lifecycle, keyboard
 * navigation, and page transition logic.
 *
 * The galactica carousel's move() method calls detachAll() on every screen
 * child, recursively removing the entire widget tree. The page-factory
 * handles re-appending chrome, status bar, and tab bar, plus building
 * fresh grid widgets for each page. This module layers on top to provide:
 *
 *   - navigateTo(pageName) — programmatic page transition with dispatch
 *   - installKeyBindings()  — F1-F6 and 1-2-3 keyboard shortcuts
 *   - getActiveWidgets()    — current page's widget map for Tab cycling
 *   - advanceFocus()        — round-robin focus index for Tab key
 *   - pageIndex             — name-to-index lookup map
 *
 * Consumers (e.g. main.mjs) create the carousel once, install key bindings,
 * and wire store-driven transitions via navigateTo(). All page lifecycle
 * boilerplate lives here and in the page-factory — not in the consumer.
 */

var Carousel = require('./carousel');
var createPageFactory = require('./page-factory');

/**
 * Create a dashboard carousel that manages page transitions with persistent
 * widget re-append guarantees.
 *
 * @param {Object} deps - Dashboard objects and configuration
 * @param {Object} deps.screen - Galactica screen instance
 * @param {Object} deps.chrome - Chrome border frame (persistent across transitions)
 * @param {Object} deps.statusBar - Status bar widget (persistent across transitions)
 * @param {Object} deps.tabBar - Tab bar widget (persistent across transitions)
 * @param {Object} deps.router - State router for dispatching state changes to widgets
 * @param {string[]} deps.pageNames - Ordered page name strings, one per builder
 * @param {Function} deps.createGrid - Grid factory: (parentElement, pageName) => grid
 * @param {Function[]} deps.builders - Page widget builders, each: (grid) => widgetMap
 * @param {Function} [deps.onPageReady] - Called after each page build for state hydration
 * @param {Function} [deps.dispatch] - Store dispatch for PAGE_MANUAL_NAV events.
 *   When provided, navigateTo() dispatches PAGE_MANUAL_NAV so store subscribers
 *   can distinguish keyboard-initiated transitions from programmatic ones.
 *
 * @returns {{
 *   navigateTo: Function,
 *   installKeyBindings: Function,
 *   start: Function,
 *   move: Function,
 *   getActiveWidgets: Function,
 *   advanceFocus: Function,
 *   currPage: number,
 *   pageNames: string[],
 *   pageIndex: Object
 * }}
 */
function createDashboardCarousel(deps) {
  var screen = deps.screen;
  var pageNames = deps.pageNames;
  var dispatch = deps.dispatch;

  // Build page name → index lookup for navigateTo() and external consumers.
  // e.g. { spec: 0, plan: 1, run: 2, task: 3, errors: 4, perf: 5 }
  var pageIndex = {};
  pageNames.forEach(function (name, i) { pageIndex[name] = i; });

  // Create page functions via galactica's page-factory.
  // The factory handles the full re-append lifecycle: chrome, status bar,
  // tab bar, grid/widget creation, router registration, and onPageReady.
  var factory = createPageFactory({
    chrome: deps.chrome,
    statusBar: deps.statusBar,
    tabBar: deps.tabBar,
    router: deps.router,
    pageNames: pageNames,
    createGrid: deps.createGrid,
    builders: deps.builders,
    onPageReady: deps.onPageReady,
  });

  // Create the underlying galactica carousel with the page functions.
  // interval: 0 disables auto-switching (TARS controls all transitions).
  // controlKeys: false disables built-in arrow key navigation (TARS uses
  // F1-F6 and 1-2-3 instead).
  var carousel = new Carousel(factory.pages, {
    screen: screen,
    interval: 0,
    controlKeys: false,
  });

  /**
   * Navigate to a page by name. Optionally dispatches PAGE_MANUAL_NAV to the
   * store so subscribers can distinguish keyboard-initiated transitions from
   * programmatic ones (e.g. RUN_START auto-switching to the run page).
   *
   * No-op if the page name is unknown or the carousel is already on that page.
   *
   * @param {string} pageName - Target page name (must be in pageNames array)
   * @param {Object} [opts] - Options
   * @param {boolean} [opts.silent=false] - If true, skip dispatching PAGE_MANUAL_NAV
   */
  function navigateTo(pageName, opts) {
    var idx = pageIndex[pageName];
    if (idx === undefined) return;

    // Dispatch PAGE_MANUAL_NAV so the store subscriber in main.mjs knows
    // this transition was user-initiated and skips its own carousel.move()
    var silent = opts && opts.silent;
    if (!silent && dispatch) {
      dispatch({ type: 'PAGE_MANUAL_NAV', content: { ui: { page: pageName } } });
    }

    if (idx !== carousel.currPage) {
      carousel.currPage = idx;
      carousel.move();
    }
  }

  /**
   * Install F1-F6 and 1-2-3 keyboard bindings for page navigation.
   * F1-F6 navigate to the corresponding page index (F1 → spec, F6 → perf).
   * 1-2-3 are quick aliases for F1-F3 (spec, plan, run).
   *
   * Separated from construction so the consumer controls when bindings
   * activate (e.g. after store and event system are initialised).
   */
  function installKeyBindings() {
    // F1-F6: navigate by function key index
    screen.key(['f1', 'f2', 'f3', 'f4', 'f5', 'f6'], function (ch, key) {
      var idx = parseInt(key.name.slice(1), 10) - 1;
      var name = pageNames[idx];
      if (name) navigateTo(name);
    });

    // 1-2-3: aliases for F1-F3 (spec, plan, run). Extra screen.render()
    // for immediate visual feedback — F-keys rely on carousel.move()'s
    // built-in render, but number keys feel snappier with an explicit call.
    screen.key(['1', '2', '3'], function (ch) {
      var idx = parseInt(ch, 10) - 1;
      var name = pageNames[idx];
      if (name) {
        navigateTo(name);
        screen.render();
      }
    });
  }

  // Public API — the carousel controller returned to consumers.
  // Keeps the galactica carousel's internal state accessible via getters
  // while providing a higher-level interface for page transitions.
  return {
    /** Navigate to a named page (with optional PAGE_MANUAL_NAV dispatch). */
    navigateTo: navigateTo,

    /** Install F1-F6 and 1-2-3 keyboard navigation on the screen. */
    installKeyBindings: installKeyBindings,

    /** Start the carousel — renders the initial page. */
    start: function () { carousel.start(); },

    /** Trigger a page rebuild at the current page index. */
    move: function () { carousel.move(); },

    /** Get the active widget map from the current page (for Tab cycling). */
    getActiveWidgets: factory.getActiveWidgets,

    /** Advance focus index for Tab key round-robin (returns new index). */
    advanceFocus: factory.advanceFocus,

    /** Ordered page name strings (read-only reference). */
    pageNames: pageNames,

    /** Page name → index lookup (e.g. { spec: 0, plan: 1, ... }). */
    pageIndex: pageIndex,

    /**
     * Current page index. Read/write — setting this does NOT trigger a
     * transition; call move() afterwards for that. Used by store subscribers
     * that need to set the index and move in separate steps.
     */
    get currPage() { return carousel.currPage; },
    set currPage(idx) { carousel.currPage = idx; },
  };
}

module.exports = createDashboardCarousel;
