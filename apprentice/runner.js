/**
 * apprentice/runner.js — Script Extraction & Execution Dispatcher
 *
 * Extracts runnable JavaScript from the Apprentice response (stripping
 * markdown fences if present) and executes scripts. Prefers PTY-backed
 * execution (via pty-runner) for terminal-accurate ANSI capture; falls
 * back to basic child_process.spawn when node-pty is unavailable.
 *
 * Both execution paths return the same result shape so callers do not
 * need to know which path was used.
 *
 * @module apprentice/runner
 */

const { spawn } = require("child_process");
const CONFIG = require("./config");
const { isPtyAvailable, runScriptPty } = require("./pty-runner");

/**
 * Extract a clean JavaScript program from the Apprentice response.
 *
 * If the response contains markdown code fences, the content inside
 * the outermost fence block is extracted. Otherwise the full response
 * is returned as-is (the model followed the "no fences" instruction).
 *
 * @param {string} response — raw text from the Apprentice
 * @returns {string} clean JavaScript source code
 */
function extractScript(response) {
    // Match the first fenced code block. The language tag (js, javascript,
    // or empty) is optional and ignored.
    const fencePattern = /```(?:javascript|js)?\s*\n([\s\S]*?)```/;
    const match = response.match(fencePattern);
    if (match) {
        return match[1].trim();
    }
    // No fences detected — return the full response trimmed.
    return response.trim();
}

/**
 * Run a JavaScript file locally and capture its output.
 *
 * Tries the PTY runner first (node-pty) for terminal-accurate capture.
 * If PTY is unavailable or the PTY spawn fails (e.g. under a Node.js
 * test runner), falls back to basic child_process.spawn which captures
 * piped stdout/stderr but misses ANSI cursor/layout behavior.
 *
 * Both paths return: { stdout, stderr, rawAnsi, exitCode, timedOut, durationMs }
 *
 * @param {string} scriptPath — absolute path to the .js file
 * @param {number} timeoutMs  — max wall-clock milliseconds
 * @returns {Promise<{stdout: string, stderr: string, rawAnsi: string,
 *   exitCode: number, timedOut: boolean, durationMs: number}>}
 */
async function runScript(scriptPath, timeoutMs) {
    // Prefer PTY execution for accurate terminal output capture.
    if (isPtyAvailable()) {
        console.log("[runner] Using PTY-backed execution");
        const result = await runScriptPty(scriptPath, timeoutMs);

        // Detect PTY spawn failure (e.g. posix_spawnp under Node.js
        // test runner) and fall back to basic runner transparently.
        if (result.stderr && result.stderr.startsWith("PTY spawn error:")) {
            console.log("[runner] PTY spawn failed, falling back to basic runner");
            return runScriptFallback(scriptPath, timeoutMs);
        }

        return result;
    }

    // Fallback: basic child_process.spawn with piped stdio.
    console.log("[runner] PTY unavailable, using basic spawn fallback");
    return runScriptFallback(scriptPath, timeoutMs);
}

/**
 * Fallback script runner using child_process.spawn with piped stdio.
 * Used when node-pty is not installed or cannot be loaded.
 *
 * @param {string} scriptPath — absolute path to the .js file
 * @param {number} timeoutMs  — max wall-clock milliseconds
 * @returns {Promise<{stdout: string, stderr: string, rawAnsi: string,
 *   exitCode: number, timedOut: boolean, durationMs: number}>}
 */
function runScriptFallback(scriptPath, timeoutMs) {
    return new Promise((resolve) => {
        let stdoutBuf = "";
        let stderrBuf = "";
        let timedOut = false;
        let settled = false;
        const startTime = Date.now();

        // Spawn the script as a child process using child_process.spawn
        // for cross-runtime compatibility (works in both Node and Bun).
        const child = spawn(CONFIG.runCommand, ["run", scriptPath], {
            env: { ...process.env, ...CONFIG.terminal.env },
            stdio: ["ignore", "pipe", "pipe"],
        });

        // Accumulate stdout chunks.
        child.stdout.on("data", (chunk) => {
            stdoutBuf += chunk.toString();
        });

        // Accumulate stderr chunks.
        child.stderr.on("data", (chunk) => {
            stderrBuf += chunk.toString();
        });

        // Wall-clock timeout guard. Kill runaway processes and mark result.
        const timer = setTimeout(() => {
            if (!settled) {
                timedOut = true;
                child.kill("SIGTERM");
            }
        }, timeoutMs);

        // Resolve when the child exits (normally or via timeout kill).
        child.on("close", (code) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve({
                stdout: stdoutBuf,
                stderr: stderrBuf,
                rawAnsi: "",
                exitCode: code ?? 1,
                timedOut,
                durationMs: Date.now() - startTime,
            });
        });

        // Handle spawn errors (e.g. command not found). Resolve with
        // non-zero exit code so the evaluator can still judge.
        child.on("error", (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve({
                stdout: stdoutBuf,
                stderr: `Spawn error: ${err.message}`,
                rawAnsi: "",
                exitCode: 1,
                timedOut: false,
                durationMs: Date.now() - startTime,
            });
        });
    });
}

module.exports = { extractScript, runScript };
