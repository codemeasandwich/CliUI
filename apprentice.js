#!/usr/bin/env bun

/**
 * apprentice.js — Phase 3: Multi-Attempt Refinement Loop
 *
 * Entry point for the trainer. Runs one complete episode with
 * iterative refinement:
 *   1. Connect to LLM Gateway via api-ape
 *   2. Run the multi-attempt loop (generate → execute → evaluate → revise)
 *   3. Stop when pass threshold, max attempts, no-progress, or error
 *   4. Save per-attempt artifacts and episode summary
 *
 * Primary invariant: Each revision attempt is based on real output
 * and evaluator feedback from the previous attempt — never invented.
 *
 * Runtime: Bun (JavaScript)
 * LLM access: local LLM Gateway via api-ape WebSocket RPC
 */

const path = require("path");

const CONFIG = require("./apprentice/config");
const { episodeId } = require("./apprentice/filesystem");
const { connectGateway } = require("./apprentice/gateway");
const { runAttemptLoop } = require("./apprentice/attempt-loop");
const { buildSummary, saveEpisodeSummary } = require("./apprentice/episode-summary");

/**
 * Hardcoded task for Phase 3.
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
 * Run one complete episode of the multi-attempt refinement loop.
 *
 * Pipeline: connect → attempt loop → summary → close.
 * Each attempt within the loop persists its own artifacts. The
 * episode summary is written after all attempts complete.
 *
 * @param {object} task — task payload { request, wireframe?, cols?, rows? }
 * @returns {Promise<{episodeDir: string, summary: object}>}
 */
async function runEpisode(task) {
    const id = episodeId();
    const episodeDir = path.join(CONFIG.paths.episodes, id);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`  Episode: ${id}`);
    console.log(`  Max attempts: ${CONFIG.maxAttempts}`);
    console.log(`  Pass threshold: ${CONFIG.passThreshold}/10`);
    console.log(`  No-progress cutoff: ${CONFIG.noProgressCutoff}`);
    console.log(`${"=".repeat(60)}\n`);

    // Step 1 — Connect to the LLM Gateway.
    const api = require("api-ape");
    await connectGateway(api);

    try {
        // Step 2 — Run the multi-attempt refinement loop.
        // The loop handles: prompt building, script execution,
        // normalization, evaluation, revision, and per-attempt saves.
        const { history, stopReason } = await runAttemptLoop(
            api, task, episodeDir
        );

        // Step 3 — Build and save the episode summary.
        const summary = buildSummary(id, task, history, stopReason);
        await saveEpisodeSummary(episodeDir, summary);

        // Step 4 — Print the final episode report.
        console.log(`\n${"=".repeat(60)}`);
        console.log(`  Episode complete: ${summary.finalVerdict}`);
        console.log(`  Attempts: ${summary.totalAttempts}`);
        console.log(`  Scores: [${summary.scores.join(", ")}]`);
        console.log(`  Final score: ${summary.finalScore}/10`);
        console.log(`  Stop reason: ${summary.stopReason}`);
        console.log(`  Artifacts: ${episodeDir}`);
        console.log(`${"=".repeat(60)}\n`);

        return { episodeDir, summary };
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
        console.log("Apprentice Phase 3 — Multi-Attempt Refinement Loop");
        console.log(`Gateway: ws://${CONFIG.gateway.host}:${CONFIG.gateway.port}`);
        console.log(`Apprentice provider: ${CONFIG.apprenticeProvider}`);
        console.log(`Evaluator provider: ${CONFIG.evaluatorProvider}`);
        console.log(`Timeout: ${CONFIG.timeoutMs}ms`);
        console.log(`Terminal: ${CONFIG.terminal.cols}x${CONFIG.terminal.rows}`);

        const { episodeDir, summary } = await runEpisode(TASK);
        console.log("✓ Phase 3 complete. Episode saved to:", episodeDir);
        console.log(`  Result: ${summary.finalVerdict} after ${summary.totalAttempts} attempt(s)`);
    } catch (err) {
        console.error("\n✗ Episode failed:", err.message);
        console.error(err.stack);
        process.exitCode = 1;
    }
}

// Kick off the main function.
main();
