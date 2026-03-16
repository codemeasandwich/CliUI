/**
 * apprentice/script-pty-runner.js
 *
 * Purpose: Pure-JS PTY execution via the Unix `script` command.
 * Responsibilities: Allocates a real pseudoterminal using `script -q /dev/null`
 *   so TUI programs see `process.stdout.isTTY === true` and render ANSI output.
 *   Uses `stty` to control terminal dimensions. Zero native dependencies.
 * Major sections:
 *   - isScriptCommandAvailable: Detects whether `script` is installed.
 *   - runScriptViaPty: Core function — spawns `script` wrapper and captures output.
 * Important invariants:
 *   - Return shape matches `pty-runner.js` exactly so `runner.js` can swap transparently.
 *   - stderr is redirected to a temp file because the PTY merges stdout/stderr.
 *   - macOS `script` uses `-q /dev/null`; Linux uses `-qc <cmd> /dev/null`.
 */

const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const CONFIG = require("./config");

/**
 * Purpose: Detect whether the Unix `script` command is available on this system.
 * Inputs: None
 * Outputs: {boolean} true if `script` is found in PATH.
 * Side effects: Runs `which script` synchronously at module load time.
 * Failure behavior: Returns false on any error (Windows, missing command, etc.).
 * Important assumptions: The `script` command ships with macOS and virtually all Linux distros.
 */
function isScriptCommandAvailable() {
    try {
        execSync("which script", { stdio: "ignore" });
        return true;
    } catch (_err) {
        return false;
    }
}

// Cache the check result at module load time.
const scriptAvailable = isScriptCommandAvailable();

/**
 * Purpose: Generate a unique temporary file path for stderr capture.
 * Inputs: None
 * Outputs: {string} absolute path to a unique temp file.
 * Side effects: Uses crypto for random bytes.
 * Failure behavior: Propagates crypto errors if system entropy is exhausted.
 * Important assumptions: OS temp directory is writable.
 */
function stderrTempPath() {
    const id = crypto.randomBytes(4).toString("hex");
    return path.join(os.tmpdir(), `apprentice-stderr-${id}.txt`);
}

/**
 * Purpose: Detect the current platform and return the correct `script` invocation.
 * Inputs:
 *   - innerCmd: {string} the shell command to run inside the PTY
 * Outputs: {{ cmd: string, args: string[] }} spawn arguments for child_process.
 * Side effects: None.
 * Failure behavior: None — caller must verify `scriptAvailable` first.
 * Important assumptions:
 *   - macOS `script` syntax: `script -q /dev/null <shell> -c <cmd>`
 *   - Linux `script` syntax: `script -qc <cmd> /dev/null`
 */
function buildScriptCommand(innerCmd) {
    if (process.platform === "darwin") {
        // macOS: script -q /dev/null /bin/zsh -c "<cmd>"
        const shell = process.env.SHELL || "/bin/zsh";
        return {
            cmd: "script",
            args: ["-q", "/dev/null", shell, "-c", innerCmd],
        };
    }
    // Linux: script -qc "<cmd>" /dev/null
    return {
        cmd: "script",
        args: ["-qc", innerCmd, "/dev/null"],
    };
}

/**
 * Purpose: Run a script inside a real PTY using the `script` command.
 * Inputs:
 *   - scriptPath: {string} absolute path to the .js file to execute
 *   - timeoutMs: {number} max wall-clock milliseconds before killing the process
 * Outputs: {Promise<{stdout, stderr, rawAnsi, exitCode, timedOut, durationMs}>}
 * Side effects: Spawns a child process with a real PTY, writes stderr to a temp file.
 * Failure behavior: Resolves (never rejects) with exitCode 1 on spawn errors.
 * Important invariants:
 *   - Uses `stty rows R cols C` inside the shell to set terminal dimensions.
 *   - stderr is redirected to a temp file because the PTY merges all output.
 *   - Return shape is identical to `pty-runner.js`'s `runScriptPty`.
 */
function runScriptViaPty(scriptPath, timeoutMs) {
    return new Promise((resolve) => {
        const stderrFile = stderrTempPath();
        let rawAnsi = "";
        let timedOut = false;
        let settled = false;
        const startTime = Date.now();

        // Shell-safe quoting: wrap paths in single quotes with escaped internal quotes.
        const safeScript = scriptPath.replace(/'/g, "'\\''");
        const safeSterr = stderrFile.replace(/'/g, "'\\''");
        const cols = CONFIG.terminal.cols;
        const rows = CONFIG.terminal.rows;

        // The inner command: set terminal dimensions via stty, then run the script
        // with stderr redirected to a temp file for separate capture.
        const innerCmd =
            `stty rows ${rows} cols ${cols} && ` +
            `${CONFIG.runCommand} run '${safeScript}' 2>'${safeSterr}'`;

        const { cmd, args } = buildScriptCommand(innerCmd);

        // Spawn the `script` wrapper. Its stdout IS the PTY stream —
        // all ANSI escapes, cursor moves, box drawing come through here.
        const child = spawn(cmd, args, {
            cwd: CONFIG.repoRoot,
            env: {
                ...process.env,
                ...CONFIG.terminal.env,
            },
            stdio: ["ignore", "pipe", "pipe"],
        });

        // Accumulate the raw PTY stream from stdout.
        child.stdout.on("data", (chunk) => {
            rawAnsi += chunk.toString();
        });

        // Wall-clock timeout guard. Kill runaway processes.
        const timer = setTimeout(() => {
            if (!settled) {
                timedOut = true;
                child.kill("SIGTERM");
            }
        }, timeoutMs);

        // Resolve when the child exits.
        child.on("close", (code) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);

            const durationMs = Date.now() - startTime;

            // Read stderr from the temp file.
            let stderr = "";
            try {
                stderr = fs.readFileSync(stderrFile, "utf-8");
            } catch (_readErr) {
                // No stderr file — not an error, just means no stderr output.
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
                exitCode: code ?? 1,
                timedOut,
                durationMs,
            });
        });

        // Handle spawn errors (e.g. `script` command not found).
        child.on("error", (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve({
                stdout: "",
                stderr: `Script-PTY spawn error: ${err.message}`,
                rawAnsi: "",
                exitCode: 1,
                timedOut: false,
                durationMs: Date.now() - startTime,
            });
        });
    });
}

module.exports = { isScriptCommandAvailable: () => scriptAvailable, runScriptViaPty };
