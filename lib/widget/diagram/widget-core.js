'use strict';

/**
 * lib/widget/diagram/widget-core.js
 *
 * Diagram widget constructor and prototype chain setup.
 * Other widget-*.js files patch Diagram.prototype with methods.
 */

var blessed = require('../../blessed');
var Node    = blessed.Node;
var Box     = blessed.Box;

// ────────────────────────────────────────────────────────────────────
// § Constants
// ────────────────────────────────────────────────────────────────────

/** Animation interval in milliseconds (~4 fps for current-work dots). */
var ANIMATION_INTERVAL_MS = 250;

/** Double-click detection window in milliseconds. */
var DOUBLE_CLICK_MS = 400;

// ────────────────────────────────────────────────────────────────────
// § Constructor
// ────────────────────────────────────────────────────────────────────

/**
 * Diagram widget constructor.
 *
 * Follows the CliUI prototypal pattern: factory guard → options merge
 * → Box.call → attach handler.
 *
 * @param {Object} options - Blessed Box options plus diagram extras.
 * @param {string}  [options.source]      - Initial ASCII diagram text.
 * @param {boolean} [options.interactive] - Enable mouse (default true).
 * @param {boolean} [options.animate]     - Enable animation (default true).
 * @param {Object}  [options.data]        - Alternative data input.
 * @constructor
 */
function Diagram(options) {
  var self = this;

  /* Factory guard — allow `Diagram(opts)` without `new`. */
  if (!(this instanceof Node)) {
    return new Diagram(options);
  }

  options = options || {};
  options.mouse = options.mouse !== false;

  /*
   * Blessed's Element constructor only calls `screen._listenMouse()`
   * when `options.clickable` is true.  Setting it here ensures mouse
   * escape sequences are active before any deferred logic.
   */
  if (options.mouse) {
    options.clickable = true;
  }

  this.options = options;

  /* Blessed Box initialisation. */
  Box.call(this, options);

  // ── Internal state ──────────────────────────────────────────────

  /** @type {DiagramModel|null} The live diagram model. */
  this._model = null;

  /** @type {OccupancyGrid|null} Current occupancy grid. */
  this._grid = null;

  /** @type {Frame|null} Previous rendered frame (for diffing). */
  this._prevFrame = null;

  /** @type {number} Animation frame counter. */
  this._animFrame = 0;

  /** @type {ReturnType<typeof setInterval>|null} Animation timer. */
  this._animTimer = null;

  /** @type {boolean} Whether animation is enabled. */
  this._animateEnabled = options.animate !== false;

  /**
   * Active connector-travel animation state.
   * Set when a ● dot is travelling along a connector between two boxes
   * during a current-work transition. Null when no travel is active.
   *
   * @type {{ cells: Array<{x:number, y:number}>, cellIdx: number,
   *          timer: ReturnType<typeof setInterval>|null,
   *          onComplete: Function|null } | null}
   */
  this._travelState = null;

  /** @type {boolean} Whether interactive mode is enabled. */
  this._interactive = options.interactive !== false;

  // ── Drag state ──────────────────────────────────────────────────

  /** @type {number|null} Box ID being dragged. */
  this._dragBoxId = null;

  /** @type {{ x: number, y: number }|null} Last drag position. */
  this._dragLast = null;

  // ── Pan state ──────────────────────────────────────────────────

  /** @type {number} Viewport X offset in model coordinates. */
  this._panX = 0;

  /** @type {number} Viewport Y offset in model coordinates. */
  this._panY = 0;

  /** @type {boolean} True during a background pan-drag operation. */
  this._isPanning = false;

  /** @type {{ x: number, y: number }|null} Last screen-local mouse position during pan. */
  this._panLast = null;

  // ── Double-click detection ─────────────────────────────────────

  /** @type {number} Timestamp of last click. */
  this._lastClickTime = 0;

  /** @type {number|null} Entity ID of last click. */
  this._lastClickId = null;

  // ── Attach handler ─────────────────────────────────────────────
  /*
   * Deferred via nextTick:  blessed's `insert()` fires 'attach'
   * before propagating attachment state to child nodes.  Deferring
   * lets blessed finish its append cycle first.
   */
  this.on('attach', function onAttach() {
    process.nextTick(function deferredAttach() {
      self._deferredInit(options);
    });
  });

  /*
   * If already attached (parent set during construction), the
   * listener above will never fire — trigger manually.
   */
  if (!this.detached) {
    process.nextTick(function deferredInitFallback() {
      self._deferredInit(options);
    });
  }

  /* Clean up animation timers on detach. */
  this.on('detach', function onDetach() {
    self._stopAnimation();
    self._stopTravelAnimation();
  });

  /* Re-render on resize. */
  this.on('resize', function onResize() {
    if (self._model) {
      self._fullRender();
    }
  });
}

// ────────────────────────────────────────────────────────────────────
// § Prototype setup
// ────────────────────────────────────────────────────────────────────

Diagram.prototype = Object.create(Box.prototype);

/** Widget type identifier (used by blessed introspection). */
Diagram.prototype.type = 'diagram';

// ────────────────────────────────────────────────────────────────────
// § Exports
// ────────────────────────────────────────────────────────────────────

module.exports = {
  Diagram: Diagram,
  ANIMATION_INTERVAL_MS: ANIMATION_INTERVAL_MS,
  DOUBLE_CLICK_MS: DOUBLE_CLICK_MS
};
