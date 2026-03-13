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
 * Domain: Ensures the agent's natural language chatter is stripped away 
 * before we pass the code to the V8 execution environment.
 * Technical: Uses a regex to isolate the first markdown fenced code block 
 * (```js ... ```). If no fences exist, returns the raw text trimmed.
 * Intent & Trade-offs: The model is instructed not to use fences to save tokens, 
 * but models often ignore this and add fences anyway. The fallback extraction 
 * gracefully handles both cases.
 * Assumptions/Edge Cases: Warns and returns empty string if input is falsy.
 *
 * @param {string} response - Raw text from the Apprentice LLM.
 * @returns {string} Clean JavaScript source code.
 */
function extractScript(response) {
    if (!response) {
        console.warn("[runner] Received empty response to extract from.");
        return "";
    }
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
 * Domain: Executes the Apprentice's code attempt in the local process space.
 * Technical: Tries to spawn using the PTY runner (`node-pty`) first to capture 
 * ANSI control sequences exactly as a terminal would render them. If PTY fails 
 * or isn't built for the current architecture, transparently delegates to 
 * basic `child_process.spawn`.
 * Intent & Trade-offs: PTY capture is essential for TUI apps (like blessed/curses). 
 * However, `node-pty` is frequently broken in cross-platform CI environments. 
 * The fallback ensures the system degrades gracefully rather than crashing.
 * Assumptions/Failures: Always returns the same object shape. Broad catch blocks 
 * trap "Catastrophic" runner faults and surface them as valid exit codes.
 *
 * @param {string} scriptPath - Absolute path to the .js file.
 * @param {number} timeoutMs  - Max wall-clock execution milliseconds.
 * @returns {Promise<{stdout: string, stderr: string, rawAnsi: string, exitCode: number, timedOut: boolean, durationMs: number}>}
 */
async function runScript(scriptPath, timeoutMs) {
    try {
        // Prefer PTY execution for accurate terminal output capture.
        if (isPtyAvailable()) {
            console.log("[runner] Using PTY-backed execution");
            let result;
            try {
                result = await runScriptPty(scriptPath, timeoutMs);
            } catch (err) {
                console.warn(`[runner] PTY execution failed abruptly: ${err.message}`);
                return runScriptFallback(scriptPath, timeoutMs);
            }

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
    } catch (err) {
        return {
            stdout: "",
            stderr: `Catastrophic runner error: ${err.message}`,
            rawAnsi: "",
            exitCode: 1,
            timedOut: false,
            durationMs: 0,
        };
    }
}

/**
 * Fallback script runner using basic child_process spawn piped stdio.
 * 
 * Domain: Executes scripts without allocating a mock terminal wrapper.
 * Technical: Summons `child_process.spawn`. Connects `pipe` to stdout/stderr. 
 * Configures an explicit `setTimeout` loop mapped to the `kill` signal. 
 * Resolves properties linearly when the stream closes or errors.
 * Intent & Trade-offs: Sacrifices accurate screen layout mapping for high 
 * reliability. Best used for "headless" scripts or test pipelines where 
 * terminal dimensions are irrelevant.
 * Assumptions/Edge Cases: If `command not found`, returns the error text in 
 * `stderr` alongside an exitCode of 1, allowing the Evaluator to parse the failure.
 *
 * @param {string} scriptPath - Absolute path to the .js file.
 * @param {number} timeoutMs  - Max wall-clock milliseconds.
 * @returns {Promise<{stdout: string, stderr: string, rawAnsi: string, exitCode: number, timedOut: boolean, durationMs: number}>}
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
