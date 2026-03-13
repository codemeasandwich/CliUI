/**
 * apprentice/pty-runner.js — PTY-Backed Script Execution
 *
 * Spawns scripts inside a real pseudoterminal so TUI programs
 * produce genuine ANSI output (colors, cursor moves, box drawing).
 * Uses node-pty for the PTY allocation and provides the same
 * result shape as the basic child_process runner, plus a rawAnsi
 * field containing the full terminal byte stream.
 *
 * Stderr separation: PTY merges stdout and stderr into one stream.
 * We redirect stderr to a temp file via a wrapper shell command,
 * then read it back after the process exits.
 *
 * @module apprentice/pty-runner
 */

const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const CONFIG = require("./config");

/**
 * Attempt to load node-pty. Returns null if the native addon
 * is unavailable (e.g. missing build tools, unsupported platform).
 * The caller uses this to decide whether to fall back to spawn.
 *
 * @returns {object|null} the node-pty module or null
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
 * Whether the PTY runner is available on this system.
 * Exported so the runner module can check before calling.
 *
 * @returns {boolean} true if node-pty loaded successfully
 */
function isPtyAvailable() {
    return pty !== null;
}

/**
 * Generate a unique temporary file path for stderr capture.
 * Uses the OS temp directory + a random suffix to avoid collisions.
 *
 * @returns {string} absolute path to a unique temp file
 */
function stderrTempPath() {
    const id = crypto.randomBytes(4).toString("hex");
    return path.join(os.tmpdir(), `apprentice-stderr-${id}.txt`);
}

/**
 * Build the PTY environment object by merging the current process
 * environment with the configured terminal environment overrides.
 * These overrides enforce deterministic locale and terminal type
 * so the TUI output is consistent across machines.
 *
 * @returns {object} key-value environment for the PTY child
 */
function buildPtyEnv() {
    return {
        ...process.env,
        ...CONFIG.terminal.env,
    };
}

/**
 * Run a script inside a real pseudoterminal and capture the output.
 *
 * Spawns a shell wrapper that redirects stderr to a temp file while
 * the main output flows through the PTY. The wrapper command:
 *   bun run <script> 2>/path/to/stderr.txt
 *
 * All PTY data (stdout with ANSI sequences) is accumulated into
 * rawAnsi. After the process exits, stderr is read from the temp
 * file and cleaned up.
 *
 * @param {string} scriptPath — absolute path to the .js file
 * @param {number} timeoutMs  — max wall-clock milliseconds
 * @returns {Promise<{stdout: string, stderr: string, rawAnsi: string,
 *   exitCode: number, timedOut: boolean, durationMs: number}>}
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
