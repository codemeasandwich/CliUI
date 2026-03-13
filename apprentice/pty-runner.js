/**
 * apprentice/pty-runner.js
 *
 * Purpose: PTY-Backed script execution environment.
 * Responsibilities: Spawns scripts inside a real pseudoterminal so TUI programs produce genuine ANSI output (colors, cursor moves, box drawing).
 * Major sections:
 *   - loadNodePty / isPtyAvailable: Environment capability detection.
 *   - runScriptPty: Core function to spawn PTY and capture raw ANSI stream.
 * Important invariants: Stderr must be redirected and captured separately since PTY inherently merges stdout and stderr.
 */

const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const CONFIG = require("./config");

/**
 * Purpose: Attempt to load the node-pty native addon.
 * Inputs: None
 * Outputs: {object|null} the node-pty module object or null if unavailable.
 * Side effects: First call requires access to native modules; logs a warning if compilation or loading fails.
 * Failure behavior: Catches require errors gracefully and returns null, preventing fatal crashes on unsupported systems.
 * Important assumptions: Called once and cached at module load time.
 */
function loadNodePty() {
    try {
        return require("node-pty");
    } catch (err) {
        console.warn(
            `[pty-runner] node-pty unavailable: ${err.message}. ` +
            `Falling back to basic runner. Install node-pty for ` +
            `full PTY support: npm install node-pty`
        );
        return null;
    }
}

// Cache the import result so we only warn once per process.
const pty = loadNodePty();

/**
 * Purpose: Determine whether the PTY runner is available on this system.
 * Inputs: None
 * Outputs: {boolean} true if node-pty loaded successfully.
 * Side effects: None
 * Failure behavior: None
 * Important assumptions: `loadNodePty` has already been called and its result cached in the upper module scope.
 */
function isPtyAvailable() {
    return pty !== null;
}

/**
 * Purpose: Generate a unique temporary file path for stderr capture.
 * Inputs: None
 * Outputs: {string} absolute path to a unique temp file
 * Side effects: Uses crypto to generate random bytes.
 * Failure behavior: Propagates crypto errors if system entropy is exhausted.
 * Important assumptions: The OS temp directory is writable and disk space is available.
 */
function stderrTempPath() {
    const id = crypto.randomBytes(4).toString("hex");
    return path.join(os.tmpdir(), `apprentice-stderr-${id}.txt`);
}

/**
 * Purpose: Build the PTY environment object by merging process env with terminal overrides.
 * Inputs: None
 * Outputs: {object} key-value environment map for the PTY child process
 * Side effects: None
 * Failure behavior: None
 * Important assumptions: Overrides (`CONFIG.terminal.env`) enforce deterministic locale and terminal type so TUI output is consistent across environments.
 */
function buildPtyEnv() {
    return {
        ...process.env,
        ...CONFIG.terminal.env,
    };
}

/**
 * Purpose: Run a script inside a real pseudoterminal and capture the output.
 * Inputs:
 *   - scriptPath: {string} absolute path to the .js executable file
 *   - timeoutMs: {number} max wall-clock execution milliseconds permitted
 * Outputs: {Promise<{stdout: string, stderr: string, rawAnsi: string, exitCode: number, timedOut: boolean, durationMs: number}>} structured execution payload
 * Side effects: Spawns a new shell process via native API, writes stderr to a temporary file, and cleans up the temp file on resolution. Sets asynchronous timeout timers.
 * Failure behavior: Resolves with a fallback error payload containing exitCode 1 and stderr message if PTY spawn fails synchronously. Temp file cleanup errors are ignored best-effort.
 * Important assumptions: Relies on `node-pty` being successfully loaded. Assumes host has `/bin/sh` or `$SHELL` available.
 */
function runScriptPty(scriptPath, timeoutMs) {
    return new Promise((resolve) => {
        const stderrFile = stderrTempPath();
        let rawAnsi = "";
        let timedOut = false;
        let settled = false;
        const startTime = Date.now();

        // Build the shell command that runs the script and redirects
        // stderr to our temp file. The PTY captures everything else.
        // Paths are single-quoted with internal quotes escaped to
        // prevent shell injection and handle spaces in paths.
        const safeScript = scriptPath.replace(/'/g, "'\\''")
        const safeSterr = stderrFile.replace(/'/g, "'\\''")
        const shellCmd =
            `${CONFIG.runCommand} run '${safeScript}' 2>'${safeSterr}'`;

        // Spawn inside a PTY with controlled dimensions and env.
        // The shell: choose the user's shell or /bin/sh as fallback.
        // Wrap in try/catch because node-pty can throw synchronously
        // on spawn failure (e.g. posix_spawnp error under Node.js).
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
            // Synchronous spawn failure — return a failed result that
            // the caller can handle (e.g. fall back to basic runner).
            console.error(
                `[pty-runner] PTY spawn failed: ${spawnErr.message}. ` +
                `The script will not execute via PTY. Check that the ` +
                `shell '${shell}' exists and node-pty is built for ` +
                `this Node/Bun version.`
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

        // Accumulate all PTY output data. This is the merged terminal
        // stream containing ANSI escape sequences, cursor movements,
        // box-drawing characters, colors, etc.
        ptyProcess.onData((data) => {
            rawAnsi += data;
        });

        // Wall-clock timeout guard. Kill runaway PTY processes.
        const timer = setTimeout(() => {
            if (!settled) {
                timedOut = true;
                ptyProcess.kill();
            }
        }, timeoutMs);

        // Resolve when the PTY process exits. Read stderr from the
        // temp file, calculate duration, and clean up.
        ptyProcess.onExit(({ exitCode }) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);

            const durationMs = Date.now() - startTime;

            // Read stderr from the temp file. The file may not exist
            // if the shell command failed before the redirect.
            let stderr = "";
            try {
                stderr = fs.readFileSync(stderrFile, "utf-8");
            } catch (_readErr) {
                // No stderr file — not an error, just means no stderr.
            }

            // Clean up the temp file (best effort, ignore errors).
            try {
                fs.unlinkSync(stderrFile);
            } catch (_unlinkErr) {
                // Temp directory cleanup is best-effort.
            }

            resolve({
                // stdout is the raw ANSI stream for Phase 2. The
                // normalized version is computed by screen-normalize.
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

module.exports = { isPtyAvailable, runScriptPty };
