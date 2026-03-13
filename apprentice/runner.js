/**
 * apprentice/runner.js
 *
 * Purpose: Script Extraction & Execution Dispatcher.
 * Responsibilities: Extracts runnable JavaScript from responses and executes scripts (via PTY or fallback).
 * Major sections:
 *   - extractScript: Extracts code inside markdown blocks.
 *   - runScript: Orchestrates script execution and selects the appropriate runner backend.
 *   - runScriptFallback: Pure child_process execution fallback.
 * Important invariants: Execution backends must return the identical result shape regardless of path.
 */

const { spawn } = require("child_process");
const CONFIG = require("./config");
const { isPtyAvailable, runScriptPty } = require("./pty-runner");

/**
 * Purpose: Extract a clean JavaScript program from the Apprentice response.
 * Inputs:
 *   - response: {string} Raw text from the Apprentice LLM.
 * Outputs: {string} Clean JavaScript source code.
 * Side effects: None
 * Failure behavior: Warns and returns empty string if input is falsy.
 * Important assumptions: Models often prepend/append explanations so we look for fences first, and trim otherwise.
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
 * Purpose: Run a JavaScript file locally and capture its output.
 * Inputs:
 *   - scriptPath: {string} Absolute path to the .js file.
 *   - timeoutMs: {number} Max wall-clock execution milliseconds.
 * Outputs: {Promise<{stdout: string, stderr: string, rawAnsi: string, exitCode: number, timedOut: boolean, durationMs: number}>} executed process payload
 * Side effects: Spawns sub-processes and waits for timers.
 * Failure behavior: Broad catch blocks trap "Catastrophic" runner faults and surface them as valid exit codes rather than failing.
 * Important assumptions: PTY capture is essential for true TUI mapping, but fallback degrades gracefully where PTY cannot be attached.
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
 * Purpose: Fallback script runner using basic child_process spawn piped stdio.
 * Inputs:
 *   - scriptPath: {string} Absolute path to the .js file.
 *   - timeoutMs: {number} Max wall-clock milliseconds.
 * Outputs: {Promise<{stdout: string, stderr: string, rawAnsi: string, exitCode: number, timedOut: boolean, durationMs: number}>} executed process payload
 * Side effects: Spawns processes without allocating a mock terminal wrapper, binds listeners.
 * Failure behavior: Catches missing commands (error) or timeouts and assigns non-zero exit codes.
 * Important assumptions: Sacrifices terminal size/box-drawing constraints for raw reliability.
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
