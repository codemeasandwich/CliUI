/**
 * apprentice/pty-runner.js
 *
 * Purpose: PTY-Backed script execution environment.
 * Responsibilities: Spawns scripts inside a real pseudoterminal so TUI programs
 *   produce genuine ANSI output (colors, cursor moves, box drawing).
 * Major sections:
 *   - PTY backend selection: script-pty (pure JS) → node-pty (native) → unavailable.
 *   - isPtyAvailable / runScriptPty: Public API consumed by runner.js.
 * Important invariants:
 *   - Preference order: pure-JS script runner first (no native deps), node-pty second.
 *   - stderr must be redirected and captured separately since PTY merges stdout/stderr.
 */

const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const CONFIG = require("./config");

// ─── Backend 1: Pure-JS script-based PTY (preferred) ───────────

const {
    isScriptCommandAvailable,
    runScriptViaPty,
} = require("./script-pty-runner");

// ─── Backend 2: Native node-pty addon (fallback) ────────────────

/**
 * Purpose: Attempt to load the node-pty native addon.
 * Inputs: None
 * Outputs: {object|null} the node-pty module object or null if unavailable.
 * Side effects: First call requires access to native modules; logs a warning
 *   if compilation or loading fails.
 * Failure behavior: Catches require errors and returns null.
 * Important assumptions: Called once and cached at module load time.
 */
function loadNodePty() {
    try {
        return require("node-pty");
    } catch (err) {
        console.warn(
            `[pty-runner] node-pty unavailable: ${err.message}. ` +
            `Will use script-based PTY or basic runner fallback.`
        );
        return null;
    }
}

// Cache the import result so we only warn once per process.
const pty = loadNodePty();

// ─── Backend Selection ──────────────────────────────────────────

// Determine which PTY backend to use at startup and log the choice
// so the developer knows which path is active.
const useScriptPty = isScriptCommandAvailable();
const useNodePty = !useScriptPty && pty !== null;

if (useScriptPty) {
    console.log("[pty-runner] Using pure-JS PTY backend (script command)");
} else if (useNodePty) {
    console.log("[pty-runner] Using native node-pty backend");
} else {
    console.warn(
        "[pty-runner] No PTY backend available. " +
        "TUI programs will not render correctly in fallback mode."
    );
}

/**
 * Purpose: Determine whether any PTY runner backend is available.
 * Inputs: None
 * Outputs: {boolean} true if either script-pty or node-pty is usable.
 * Side effects: None
 * Failure behavior: None
 * Important assumptions: Both backends were probed at module load time.
 */
function isPtyAvailable() {
    return useScriptPty || useNodePty;
}

// ─── node-pty helpers (only used when useNodePty === true) ──────

/**
 * Purpose: Generate a unique temporary file path for stderr capture.
 * Inputs: None
 * Outputs: {string} absolute path to a unique temp file
 * Side effects: Uses crypto to generate random bytes.
 * Failure behavior: Propagates crypto errors if system entropy is exhausted.
 * Important assumptions: The OS temp directory is writable.
 */
function stderrTempPath() {
    const id = crypto.randomBytes(4).toString("hex");
    return path.join(os.tmpdir(), `apprentice-stderr-${id}.txt`);
}

/**
 * Purpose: Build the PTY environment object by merging process env
 *   with terminal overrides.
 * Inputs: None
 * Outputs: {object} key-value environment map for the PTY child process
 * Side effects: None
 * Failure behavior: None
 * Important assumptions: Overrides enforce deterministic locale and terminal type.
 */
function buildPtyEnv() {
    return {
        ...process.env,
        ...CONFIG.terminal.env,
    };
}

/**
 * Purpose: Run a script inside a PTY using node-pty (native backend).
 * Inputs:
 *   - scriptPath: {string} absolute path to the .js executable file
 *   - timeoutMs: {number} max wall-clock execution milliseconds
 * Outputs: {Promise<{stdout, stderr, rawAnsi, exitCode, timedOut, durationMs}>}
 * Side effects: Spawns a shell via native addon, writes stderr to temp file.
 * Failure behavior: Resolves with exitCode 1 and stderr message on spawn failure.
 * Important assumptions: Relies on `node-pty` being successfully loaded.
 */
function runNodePty(scriptPath, timeoutMs) {
    return new Promise((resolve) => {
        const stderrFile = stderrTempPath();
        let rawAnsi = "";
        let timedOut = false;
        let settled = false;
        const startTime = Date.now();

        // Build the shell command that runs the script and redirects
        // stderr to a temp file. Paths are single-quoted with internal
        // quotes escaped to prevent shell injection.
        const safeScript = scriptPath.replace(/'/g, "'\\''");
        const safeSterr = stderrFile.replace(/'/g, "'\\''");
        const shellCmd =
            `${CONFIG.runCommand} run '${safeScript}' 2>'${safeSterr}'`;

        // Spawn inside a PTY with controlled dimensions and env.
        const shell = process.env.SHELL || "/bin/sh";
        let ptyProcess;
        try {
            ptyProcess = pty.spawn(shell, ["-c", shellCmd], {
                name: "xterm-256color",
                cols: CONFIG.terminal.cols,
                rows: CONFIG.terminal.rows,
                cwd: CONFIG.repoRoot,
                env: buildPtyEnv(),
            });
        } catch (spawnErr) {
            console.error(
                `[pty-runner] node-pty spawn failed: ${spawnErr.message}. ` +
                `The script will not execute via native PTY.`
            );
            resolve({
                stdout: "",
                stderr: `PTY spawn error: ${spawnErr.message}`,
                rawAnsi: "",
                exitCode: 1,
                timedOut: false,
                durationMs: Date.now() - startTime,
            });
            return;
        }

        // Accumulate all PTY output data — the merged terminal stream.
        ptyProcess.onData((data) => {
            rawAnsi += data;
        });

        // Wall-clock timeout guard.
        const timer = setTimeout(() => {
            if (!settled) {
                timedOut = true;
                ptyProcess.kill();
            }
        }, timeoutMs);

        // Resolve when the PTY process exits.
        ptyProcess.onExit(({ exitCode }) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);

            const durationMs = Date.now() - startTime;

            // Read stderr from the temp file.
            let stderr = "";
            try {
                stderr = fs.readFileSync(stderrFile, "utf-8");
            } catch (_readErr) {
                // No stderr file — not an error.
            }

            // Clean up the temp file (best effort).
            try {
                fs.unlinkSync(stderrFile);
            } catch (_unlinkErr) {
                // Temp directory cleanup is best-effort.
            }

            resolve({
                stdout: rawAnsi,
                stderr,
                rawAnsi,
                exitCode: exitCode ?? 1,
                timedOut,
                durationMs,
            });
        });
    });
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Purpose: Run a script inside a real PTY using the best available backend.
 * Inputs:
 *   - scriptPath: {string} absolute path to the .js file
 *   - timeoutMs: {number} max wall-clock execution milliseconds
 * Outputs: {Promise<{stdout, stderr, rawAnsi, exitCode, timedOut, durationMs}>}
 * Side effects: Spawns child processes.
 * Failure behavior: Falls through backends; resolves with error result if all fail.
 * Important assumptions: At least one backend was detected as available
 *   (caller checked isPtyAvailable() before calling).
 */
function runScriptPty(scriptPath, timeoutMs) {
    // Prefer the pure-JS script-based PTY (no native deps).
    if (useScriptPty) {
        return runScriptViaPty(scriptPath, timeoutMs);
    }
    // Fall back to the native node-pty addon.
    if (useNodePty) {
        return runNodePty(scriptPath, timeoutMs);
    }
    // Should not reach here — caller checks isPtyAvailable() first.
    return Promise.resolve({
        stdout: "",
        stderr: "No PTY backend available.",
        rawAnsi: "",
        exitCode: 1,
        timedOut: false,
        durationMs: 0,
    });
}

module.exports = { isPtyAvailable, runScriptPty };
