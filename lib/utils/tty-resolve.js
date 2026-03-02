'use strict';

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

module.exports = {
  resolveTTYOutput: resolveTTYOutput,
  resolveTTYInput: resolveTTYInput
};
