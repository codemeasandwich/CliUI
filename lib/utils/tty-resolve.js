'use strict';
// @esm-group Server_Utils

/**
 * @module utils/tty-resolve
 * @fileoverview Platform TTY resolution for forked Node.js processes.
 *
 * In forked processes (e.g. a launcher forking a dashboard), libuv's
 * uv_guess_handle() misidentifies inherited TTY file descriptors as
 * UV_NAMED_PIPE on macOS. This causes process.stdout.isTTY and
 * process.stdin.isTTY to be false even when fd 0/1 are real TTYs.
 * Without these workarounds, terminal rendering produces blank output
 * and keyboard input stays in cooked mode (line-buffered, no raw keys).
 *
 * Both functions return the resolved stream or null when no TTY is
 * available (headless, CI, Docker, piped stdio, etc.).
 */

var tty = require('tty');
var fs = require('fs');

// ⚠️  DO NOT REMOVE — This is NOT dead code.
// In forked processes (e.g. launcher forks the dashboard), process.stdout.isTTY
// is false even when fd 1 is a real TTY. Without this fallback the dashboard
// renders a blank screen. See TARS commit 6218b94 for original fix.
//
// How it works:
//   1. Fast path — if process.stdout already reports isTTY, use it directly.
//   2. Fallback — create a fresh tty.WriteStream on fd 1. libuv re-probes the
//      fd via uv_tty_init and correctly identifies it as a TTY, so the new
//      stream's isTTY flag is true. If the probe fails (fd 1 isn't a real TTY),
//      the stream is destroyed immediately to avoid resource leaks.
//   3. Null — fd 1 is genuinely not a TTY (piped, redirected, headless).
/**
 * Resolve a TTY-capable output stream for the current process.
 *
 * @returns {tty.WriteStream|null} A writable TTY stream, or null if fd 1
 *   is not a TTY (piped output, CI, Docker, etc.).
 */
function resolveTTYOutput() {
  // Fast path: process.stdout is already a TTY (normal terminal execution)
  if (process.stdout.isTTY) return process.stdout;

  // Forked-process fallback: create a fresh WriteStream on fd 1.
  // libuv's uv_tty_init re-probes the fd and correctly identifies it as a TTY
  // even though uv_guess_handle returned UV_NAMED_PIPE for process.stdout.
  try {
    var stream = new tty.WriteStream(1);
    if (stream.isTTY) return stream;
    // fd 1 exists but isn't a TTY — clean up the stream to avoid leaks
    stream.destroy();
  } catch (e) {
    // EINVAL — fd 1 isn't a TTY at all (piped, redirected, headless)
  }

  return null;
}

// ⚠️  DO NOT REMOVE — same forked-process issue as resolveTTYOutput above.
// Returns a TTY-capable input stream, or null if no TTY input is available.
// The stream MUST support setRawMode() so blessed can switch the terminal
// from cooked mode (echoes chars, line-buffered) to raw mode (individual
// keypresses delivered immediately). Without raw mode, keyboard shortcuts
// like 'q' to quit never reach blessed — the character is echoed by the
// terminal and buffered until Enter, so the key handler never fires.
//
// Why /dev/tty instead of new tty.ReadStream(0):
//   libuv's uv_tty_init for readable fds calls dup2(newfd, origfd), which
//   replaces fd 0's file description and corrupts process.stdin's already-
//   initialized pipe handle. Two UV handles on the same fd is undefined
//   behavior: terminal input gets dispatched to the pipe handler (no keypress
//   conversion), setRawMode fails to take effect, and the terminal stays in
//   cooked mode.
//
//   Opening /dev/tty on a FRESH fd avoids the fd contention entirely.
//   /dev/tty always refers to the controlling terminal of the process.
/**
 * Resolve a TTY-capable input stream for the current process.
 *
 * @returns {tty.ReadStream|null} A readable TTY stream that supports
 *   setRawMode(), or null if no TTY input is available.
 */
function resolveTTYInput() {
  // Fast path: process.stdin is already a TTY (normal terminal execution)
  if (process.stdin.isTTY) return process.stdin;

  // Forked-process fallback: process.stdin.isTTY is false due to a macOS
  // Node.js quirk where uv_guess_handle(0) returns UV_NAMED_PIPE for
  // inherited TTY fds in forked children with IPC. process.stdin is created
  // as a net.Socket (pipe handle on fd 0) instead of tty.ReadStream.
  //
  // We CANNOT use `new tty.ReadStream(0)` here — libuv's uv_tty_init for
  // readable fds calls dup2(newfd, origfd), which replaces fd 0's file
  // description and corrupts process.stdin's already-initialized pipe
  // handle. Two UV handles on the same fd is undefined behavior: terminal
  // input gets dispatched to the pipe handler (no keypress conversion),
  // setRawMode fails to take effect, and the terminal stays in cooked mode.
  //
  // Instead, open /dev/tty explicitly on a FRESH fd. This gives us a clean
  // TTY handle with no fd contention. /dev/tty always refers to the
  // controlling terminal of the process.
  try {
    var ttyFd = fs.openSync('/dev/tty', fs.constants.O_RDONLY | fs.constants.O_NOCTTY);
    var stream = new tty.ReadStream(ttyFd);
    if (stream.isTTY) return stream;
    // fd is open but not a TTY — clean up to avoid resource leaks
    stream.destroy();
  } catch (e) {
    // /dev/tty not available — headless environment, CI, Docker, etc.
  }

  // Last resort: process.stdin might still support setRawMode even if
  // isTTY is false (happens on certain Node.js versions with inherited stdio).
  // Check for the method directly rather than trusting the isTTY flag.
  if (typeof process.stdin.setRawMode === 'function') {
    return process.stdin;
  }

  return null;
}

// ── Raw mode verification and recovery ──────────────────────────────────
//
// Blessed (galactica's underlying terminal engine) is supposed to enable raw
// mode on the input stream during screen initialization. Its activation path
// is indirect: screen.key() → _listenKeys() → program.on('keypress') →
// program newListener handler → setRawMode(true). If that chain doesn't
// fire (blessed internals changed, forked-process timing, race condition),
// the terminal stays in cooked mode: characters are echoed, individual
// keypresses are line-buffered, and keyboard shortcuts never reach the app.
//
// ensureRawMode provides a two-phase safety net:
//   Phase 1 (synchronous): Immediately check and force raw mode if needed.
//   Phase 2 (deferred):    Re-check after the current tick via setImmediate.
//     Blessed's initialization uses async event chains (newListener events)
//     that can reset raw mode after the synchronous setup completes. The
//     deferred check catches any post-init raw mode regression.
//
// The optional onRecovery callback lets callers react to deferred recovery
// (e.g. emit a telemetry event) without coupling this library to any
// specific event system.

/**
 * Ensure raw mode is active on a TTY input stream.
 *
 * Performs an immediate synchronous check and a deferred (setImmediate)
 * re-check. If raw mode is not active during either phase and the stream
 * supports setRawMode(), it is forcibly enabled and the stream is resumed.
 *
 * @param {tty.ReadStream} input - TTY input stream (must have setRawMode
 *   method if it is a real TTY). If input is null/undefined or lacks
 *   setRawMode, both phases are silently skipped.
 * @param {Object} [opts] - Options
 * @param {Function} [opts.onRecovery] - Callback invoked with a reason
 *   string when the deferred check had to re-enable raw mode. Not called
 *   for the synchronous phase (which fires before any async work and is
 *   expected to be needed in forked-process scenarios). Only called when
 *   the deferred check detects regression — this indicates blessed's
 *   async initialization chain reset raw mode after the synchronous fix.
 * @returns {void}
 */
function ensureRawMode(input, opts) {
  // Guard: input may be null (headless, CI, Docker) or a mock stream
  // without setRawMode (e.g. TestInputBuffer in test harness).
  if (!input || typeof input.setRawMode !== 'function') return;

  var onRecovery = (opts && typeof opts.onRecovery === 'function')
    ? opts.onRecovery
    : null;

  // Phase 1 — Synchronous check: force raw mode immediately if blessed's
  // lazy initialization chain didn't enable it. This is the common case
  // in forked processes where the event chain timing differs from a
  // directly-launched terminal.
  if (!input.isRaw) {
    input.setRawMode(true);
    input.resume();
  }

  // Phase 2 — Deferred check: verify raw mode survived the current tick.
  // Blessed's initialization involves async event registration (keypress
  // handler via newListener events) that could reset raw mode after the
  // synchronous setup above. setImmediate fires after the current tick's
  // I/O callbacks, catching any post-init regression.
  setImmediate(function ensureRawModeDeferred() {
    if (!input.isRaw && typeof input.setRawMode === 'function') {
      input.setRawMode(true);
      input.resume();
      // Notify the caller that deferred recovery was needed. This is a
      // diagnostic signal — synchronous phase is expected in some
      // environments, but deferred recovery indicates the blessed
      // initialization chain actively reverted raw mode.
      if (onRecovery) {
        onRecovery('Raw mode was not active after initialization tick');
      }
    }
  });
}

// ── High-level terminal IO resolution ────────────────────────────────
//
// Combines the three lower-level utilities above into a single call that
// resolves both TTY streams and applies the raw mode safety net. This is
// the typical bootstrap sequence for any galactica-based terminal UI:
//   1. Resolve a writable TTY output stream (handles macOS forked-process quirk)
//   2. Resolve a readable TTY input stream (handles /dev/tty fallback)
//   3. Ensure raw mode is active on the input stream (blessed safety net)
//
// Returns { input, output } when both streams are available, or null when
// the process has no TTY (headless, CI, Docker, piped stdio). The null
// return lets callers bail early with a single check instead of two.

/**
 * Resolve both TTY streams and apply the raw mode safety net.
 *
 * Orchestrates the full platform-workaround sequence that every galactica
 * terminal UI needs at startup: output resolution, input resolution, and
 * raw mode enforcement. Returns the resolved streams or null if either
 * is unavailable.
 *
 * @param {Object} [opts] - Options forwarded to ensureRawMode
 * @param {Function} [opts.onRecovery] - Callback invoked when the deferred
 *   raw mode check had to re-enable raw mode (see ensureRawMode docs).
 * @returns {{ input: tty.ReadStream, output: tty.WriteStream }|null}
 *   Both TTY streams, or null if the process has no TTY.
 */
function resolveTerminalIO(opts) {
  var output = resolveTTYOutput();
  if (!output) return null;

  var input = resolveTTYInput();
  if (!input) return null;

  // Apply the two-phase raw mode safety net (synchronous + deferred check).
  // The opts.onRecovery callback, if provided, fires only when the deferred
  // phase detects that blessed's async initialization reverted raw mode.
  ensureRawMode(input, opts);

  return { input: input, output: output };
}

module.exports = {
  resolveTTYOutput: resolveTTYOutput,
  resolveTTYInput: resolveTTYInput,
  ensureRawMode: ensureRawMode,
  resolveTerminalIO: resolveTerminalIO
};
