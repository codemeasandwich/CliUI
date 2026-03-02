'use strict';

/**
 * Render crash guard for blessed/galactica Screen instances.
 *
 * Blessed's Screen.prototype.render iterates all child elements, calling
 * each element's render() method, then draws terminal escape sequences.
 * If any widget throws during a render cycle (Canvas with undefined context,
 * terminal resize race condition, unexpected blessed internals), the
 * unhandled exception kills the entire Node process.
 *
 * This module provides wrapScreenRender() which monkey-patches screen.render
 * to catch those errors and forward them to an optional callback, allowing
 * the dashboard to survive a single bad frame and render the next frame
 * normally.
 */

/**
 * Wrap a blessed Screen's render() method in a try-catch crash guard.
 *
 * Call once after screen creation to protect ALL downstream render() call
 * sites — throttled renders, keyboard handlers, timer ticks, widget updates.
 *
 * @param {Object} screen - Blessed Screen instance (must have .render method)
 * @param {Object} [opts] - Options
 * @param {Function} [opts.onError] - Callback invoked with (err) on render
 *   failure. If omitted, errors are silently swallowed (a dropped frame in
 *   a terminal UI is harmless; crashing is not).
 * @returns {Function} unwrap - Restores the original screen.render method.
 *   Useful for tests or teardown.
 * @throws {TypeError} If screen is not an object or screen.render is not
 *   a function.
 */
function wrapScreenRender(screen, opts) {
  // Validate that screen is a real object with a render method.
  // Catches misuse early (e.g. passing null, or a non-screen object).
  if (!screen || typeof screen.render !== 'function') {
    throw new TypeError('wrapScreenRender: screen must have a .render() method');
  }

  // Guard against double-wrapping. If wrapScreenRender is called twice on
  // the same screen (e.g. during hot-reload or a programming error), the
  // second call would wrap the already-wrapped render, creating nested
  // try-catch layers and making unwrap() restore the wrapper instead of
  // the original. The sentinel property stores the original render so we
  // can detect this case and return the existing unwrap function.
  if (screen._safeRenderOriginal) {
    return screen._safeRenderUnwrap;
  }

  var onError = (opts && typeof opts.onError === 'function') ? opts.onError : null;
  var originalRender = screen.render;

  // Replace screen.render with a guarded version.
  // Uses .call(screen) to preserve `this` context — Screen.prototype.render
  // references `this` extensively (this.destroyed, this.children, this._ci,
  // this.draw(), etc.).
  screen.render = function safeRender() {
    try {
      return originalRender.call(screen);
    } catch (err) {
      // Forward the error to the caller-supplied handler (e.g. an event
      // emitter). If no handler was provided, silently swallow — a single
      // dropped frame is harmless in a terminal UI.
      if (onError) {
        onError(err);
      }
    }
  };

  // Sentinel: marks this screen as already wrapped and stores the original
  // render for unwrap(). Not enumerable so it doesn't pollute screen's
  // public-facing property list.
  screen._safeRenderOriginal = originalRender;

  // Unwrap function: restores the original render method and cleans up
  // sentinel properties. Safe to call multiple times (second call is no-op).
  function unwrap() {
    if (screen._safeRenderOriginal) {
      screen.render = screen._safeRenderOriginal;
      delete screen._safeRenderOriginal;
      delete screen._safeRenderUnwrap;
    }
  }

  screen._safeRenderUnwrap = unwrap;

  return unwrap;
}

module.exports = wrapScreenRender;
