#!/usr/bin/env bun

/**
 * apprentice.js — Phase 2: PTY Runner and Normalized Output Capture
 *
 * Entry point for the trainer. Runs one complete episode:
 *   1. Connect to LLM Gateway via api-ape
 *   2. Send task to Apprentice actor → receive JS code
 *   3. Extract script, save to temp/, execute via PTY
 *   4. Capture real terminal output (raw ANSI + stderr)
 *   5. Normalize the ANSI stream into a final-frame screen text
 *   6. Send task + normalized screen to Evaluator actor
 *   7. Receive structured score and critique
 *   8. Persist episode with expanded artifact set
 *
 * Primary invariant: The Evaluator judges the normalized terminal
 * screen text, never anything the Apprentice claims about its output.
 *
 * Runtime: Bun (JavaScript)
 * LLM access: local LLM Gateway via api-ape WebSocket RPC
 */

const path = require("path");

const CONFIG = require("./apprentice/config");
const { ensureDirectory, writeText, episodeId } = require("./apprentice/filesystem");
const { connectGateway, askApprentice, askEvaluator } = require("./apprentice/gateway");
const { buildApprenticePrompt, buildEvaluatorPrompt } = require("./apprentice/prompts");
const { extractScript, runScript } = require("./apprentice/runner");
const { normalizeScreen } = require("./apprentice/screen-normalize");
const { evaluate } = require("./apprentice/evaluator");
const { saveEpisode } = require("./apprentice/persistence");
const { attemptFilename } = require("./apprentice/filesystem");

/**
 * Hardcoded task for Phase 2.
 *
 * Defines the work the Apprentice must accomplish. Shape matches
 * the task payload expected by the prompt builders:
 *   - request:   what to build (plain English)
 *   - wireframe: optional ASCII art of desired layout
 *   - cols/rows: terminal dimensions
 */
const TASK = {
    request:
        "Create a simple terminal dashboard using galactica (CliUI) that shows:\n" +
        "1. A line chart in the top half showing mock CPU usage over 10 time points\n" +
        "2. A log widget in the bottom half showing 5 system status messages\n" +
        "The dashboard should render once and then exit after 2 seconds.",
    cols: 80,
    rows: 24,
};

/**
 * Run one complete episode of the truth loop.
 *
 * Pipeline: connect → apprentice → extract → run → normalize → evaluate → persist.
 * Each step logs progress for traceability.
 *
 * @param {object} task — task payload { request, wireframe?, cols?, rows? }
 * @returns {Promise<{episodeDir: string, evaluatorResult: object}>}
 */
async function runEpisode(task) {
    const id = episodeId();
    const episodeDir = path.join(CONFIG.paths.episodes, id);
    const scriptFilename = attemptFilename(1);
    const scriptPath = path.join(CONFIG.paths.temp, scriptFilename);

    // Terminal dimensions for normalization — use task overrides or config defaults.
    const cols = task.cols || CONFIG.terminal.cols;
    const rows = task.rows || CONFIG.terminal.rows;

    console.log(`\n${"=".repeat(60)}`);
    console.log(`  Episode: ${id}`);
    console.log(`${"=".repeat(60)}\n`);

    // Step 1 — Connect to the LLM Gateway.
    const api = require("api-ape");
    await connectGateway(api);

    try {
        // Step 2 — Ask the Apprentice to generate code for the task.
        console.log("[step 2] Requesting code from Apprentice…");
        const apprenticePrompt = buildApprenticePrompt(task);
        const apprenticeResponse = await askApprentice(api, apprenticePrompt);
        console.log(
            `[step 2] Received ${apprenticeResponse.length} chars from Apprentice`
        );

        // Step 3 — Extract runnable JavaScript from the response.
        console.log("[step 3] Extracting script…");
        const script = extractScript(apprenticeResponse);

        // Step 4 — Save the script to temp/ for execution.
        console.log(`[step 4] Saving script to ${scriptPath}`);
        await ensureDirectory(CONFIG.paths.temp);
        await writeText(scriptPath, script);

        // Step 5 — Execute the script and capture all terminal output.
        // The PTY runner allocates a real pseudoterminal with controlled
        // dimensions, producing ANSI output matching what users see.
        console.log("[step 5] Running script…");
        const runResult = await runScript(scriptPath, CONFIG.timeoutMs);
        console.log(
            `[step 5] Script exited with code ${runResult.exitCode}` +
            (runResult.timedOut ? " (TIMED OUT)" : "") +
            ` (${runResult.durationMs}ms)`
        );
        if (runResult.rawAnsi && runResult.rawAnsi.length > 0) {
            console.log(`[step 5] rawAnsi: ${runResult.rawAnsi.length} chars`);
        }
        if (runResult.stdout.length > 0) {
            console.log(`[step 5] stdout: ${runResult.stdout.length} chars`);
        }
        if (runResult.stderr.length > 0) {
            console.log(`[step 5] stderr: ${runResult.stderr.length} chars`);
        }

        // Step 5b — Normalize the raw ANSI output into a final-frame
        // screen text. This is the "what would the user see" snapshot
        // that the Evaluator will judge against the task request.
        console.log("[step 5b] Normalizing terminal output…");
        const rawForNormalize = runResult.rawAnsi || runResult.stdout || "";
        const screenText = normalizeScreen(rawForNormalize, cols, rows);
        console.log(`[step 5b] Screen text: ${screenText.length} chars`);

        // Attach the normalized screen text to the run result so the
        // evaluator prompt builder can access it directly.
        runResult.screenText = screenText;

        // Step 6+7 — Send ONLY the task + normalized screen to the Evaluator.
        // The generated script and raw ANSI are deliberately excluded.
        console.log("[step 6] Evaluating normalized screen output…");
        const evaluatorPrompt = buildEvaluatorPrompt(task, runResult);
        const evaluatorResult = await evaluate(api, evaluatorPrompt);
        console.log(
            `[step 7] Evaluator verdict: ${evaluatorResult.verdict} ` +
            `(score: ${evaluatorResult.score}/10)`
        );

        // Step 8 — Persist the full episode with expanded artifacts.
        const metadata = {
            episodeId: id,
            timestamp: new Date().toISOString(),
            task,
            exitCode: runResult.exitCode,
            timedOut: runResult.timedOut,
            durationMs: runResult.durationMs,
            score: evaluatorResult.score,
            verdict: evaluatorResult.verdict,
            apprenticeProvider: CONFIG.apprenticeProvider,
            evaluatorProvider: CONFIG.evaluatorProvider,
            timeoutMs: CONFIG.timeoutMs,
            // Phase 2: terminal environment overrides in metadata
            // for reproducibility analysis.
            terminalEnv: CONFIG.terminal.env,
            terminalDimensions: { cols, rows },
            ptyBacked: !!(runResult.rawAnsi && runResult.rawAnsi.length > 0),
        };

        console.log(`[step 8] Saving episode to ${episodeDir}`);
        await saveEpisode(episodeDir, {
            script,
            rawAnsi: runResult.rawAnsi || "",
            screenText,
            stdout: runResult.stdout,
            stderr: runResult.stderr,
            evaluatorResult,
            metadata,
        });

        console.log(`\n${"=".repeat(60)}`);
        console.log(`  Episode complete: ${evaluatorResult.verdict}`);
        console.log(`  Score: ${evaluatorResult.score}/10`);
        console.log(`  Critique: ${evaluatorResult.critique}`);
        console.log(`  Artifacts: ${episodeDir}`);
        console.log(`${"=".repeat(60)}\n`);

        return { episodeDir, evaluatorResult };
    } finally {
        // Close the WebSocket connection to prevent resource leak.
        // api-ape.close() gracefully terminates the connection.
        if (typeof api.close === "function") {
            api.close();
        }
    }
}

/**
 * Main entrypoint. Runs a single episode with the hardcoded task,
 * logs the result summary, and exits.
 */
async function main() {
    try {
        console.log("Apprentice Phase 2 — PTY Runner and Normalized Output Capture");
        console.log(`Gateway: ws://${CONFIG.gateway.host}:${CONFIG.gateway.port}`);
        console.log(`Apprentice provider: ${CONFIG.apprenticeProvider}`);
        console.log(`Evaluator provider: ${CONFIG.evaluatorProvider}`);
        console.log(`Timeout: ${CONFIG.timeoutMs}ms`);
        console.log(`Terminal: ${CONFIG.terminal.cols}x${CONFIG.terminal.rows}`);
        console.log(`TERM=${CONFIG.terminal.env.TERM} LANG=${CONFIG.terminal.env.LANG}`);

        const { episodeDir } = await runEpisode(TASK);
        console.log("\n✓ Phase 2 complete. Episode saved to:", episodeDir);
    } catch (err) {
        console.error("\n✗ Episode failed:", err.message);
        console.error(err.stack);
        process.exitCode = 1;
    }
}

// Kick off the main function.
main();
