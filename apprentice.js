#!/usr/bin/env bun

/**
 * apprentice.js — Phase 5: Learning Distillation, Retrieval, and Reuse
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
const { bootstrapLearningDirs } = require("./apprentice/learning-store");
const { buildSummary, saveEpisodeSummary } = require("./apprentice/episode-summary");
const { distillEpisode } = require("./apprentice/distill");
const { loadBenchmarkTask, loadAllBenchmarkTasks } = require("./apprentice/benchmark-loader");
const { runBenchmarkSuite } = require("./apprentice/benchmark-runner");
const { loadEpisodeTask } = require("./apprentice/replay-runner");

/**
 * Hardcoded task for Phase 4.
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
 * @param {boolean} [disableRetrieval=false] — whether learning retrieval is disabled
 * @returns {Promise<{episodeDir: string, summary: object}>}
 */
async function runEpisode(task, disableRetrieval = false) {
    // Ensure all eight learning/ subdirectories exist before any
    // artifact writes occur. Idempotent — safe on repeat calls.
    await bootstrapLearningDirs();

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
            api, task, episodeDir, disableRetrieval
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

        // Step 5 — Distill learning artifacts from the episode.
        // Analyzes attempt history and creates memories, exemplars,
        // anti-patterns, and (conservatively) skills.
        const distillResult = await distillEpisode(
            id, task, history, stopReason
        );
        if (distillResult.created.length > 0) {
            console.log(`  Distilled ${distillResult.created.length} learning artifact(s):`);
            for (const a of distillResult.created) {
                console.log(`    - ${a.type}: ${a.id}`);
            }
        } else {
            console.log("  No learning artifacts distilled from this episode.");
        }

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
 * Main CLI entrypoint. Parses arguments to determine the operating mode.
 * 
 * Domain: The primary control surface for the Apprentice system. By default, 
 * it runs a single episode to solve a hardcoded task. But it also exposes 
 * utility modes like benchmarks, replay, cache cleanup, and artifact export.
 * Technical: Reads process.argv. Switches between `runEpisode`, `runBenchmarkSuite`,
 * `exportLearning`, and `runCleanupAndPromotion` based on the provided flags.
 * Intent & Trade-offs: The default mode uses a hardcoded task to keep the 
 * developer experience simple for rapid iteration without needing a complex TUI.
 * Assumptions/Failures: Catches all unhandled promises. Exits with process.exitCode = 1 
 * and prints the stack trace if any mode catastrophically fails.
 * 
 * @returns {Promise<void>}
 */
async function main() {
    try {
        console.log("Apprentice Phase 7 — Benchmarks, Replay, and Regression Reporting");
        console.log(`Gateway: ws://${CONFIG.gateway.host}:${CONFIG.gateway.port}`);
        console.log(`Apprentice provider: ${CONFIG.apprenticeProvider}`);
        console.log(`Evaluator provider: ${CONFIG.evaluatorProvider}`);
        console.log(`Timeout: ${CONFIG.timeoutMs}ms`);
        console.log(`Terminal: ${CONFIG.terminal.cols}x${CONFIG.terminal.rows}`);

        const args = process.argv.slice(2);
        const disableRetrieval = args.includes("--no-retrieval");
        
        let runMode = "default";
        let targetId = null;
        let exportDir = null;

        if (args.includes("--benchmark-all")) {
            runMode = "benchmark-all";
        } else if (args.includes("--compare-benchmarks")) {
            runMode = "compare-benchmarks";
        } else if (args.includes("--cleanup")) {
            runMode = "cleanup";
        } else if (args.includes("--export")) {
            runMode = "export";
            const expIdx = args.indexOf("--export");
            if (expIdx !== -1 && expIdx + 1 < args.length && !args[expIdx + 1].startsWith("--")) {
                exportDir = args[expIdx + 1];
            }
        } else {
            const benchIdx = args.indexOf("--benchmark");
            if (benchIdx !== -1 && benchIdx + 1 < args.length) {
                runMode = "benchmark";
                targetId = args[benchIdx + 1];
            } else {
                const replayIdx = args.indexOf("--replay");
                if (replayIdx !== -1 && replayIdx + 1 < args.length) {
                    runMode = "replay";
                    targetId = args[replayIdx + 1];
                }
            }
        }

        if (runMode === "benchmark-all") {
            const tasks = await loadAllBenchmarkTasks();
            if (tasks.length === 0) {
                throw new Error(
                    `Failed to run benchmark suite.\n` +
                    `Constraint violated: No valid benchmark tasks were found.\n` +
                    `Guidance: Ensure JSON task files exist in the learning/benchmarks/ directory.`
                );
            }
            const api = require("api-ape");
            await connectGateway(api);
            try {
                await runBenchmarkSuite(api, tasks, disableRetrieval);
            } finally {
                if (typeof api.close === "function") api.close();
            }
        } else if (runMode === "compare-benchmarks") {
            const tasks = await loadAllBenchmarkTasks();
            if (tasks.length === 0) {
                throw new Error(
                    `Failed to run benchmark suite.\n` +
                    `Constraint violated: No valid benchmark tasks were found.\n` +
                    `Guidance: Ensure JSON task files exist in the learning/benchmarks/ directory.`
                );
            }

            console.log("\n============================================================");
            console.log("  Pass 1: Retrieval DISABLED");
            console.log("============================================================\n");
            let api1 = require("api-ape");
            await connectGateway(api1);
            let reportWithout;
            try {
                reportWithout = await runBenchmarkSuite(api1, tasks, true);
            } finally {
                if (typeof api1.close === "function") api1.close();
            }

            console.log("\n============================================================");
            console.log("  Pass 2: Retrieval ENABLED");
            console.log("============================================================\n");
            let api2 = require("api-ape");
            await connectGateway(api2);
            let reportWith;
            try {
                reportWith = await runBenchmarkSuite(api2, tasks, false);
            } finally {
                if (typeof api2.close === "function") api2.close();
            }

            console.log("\n============================================================");
            console.log("                 BENCHMARK COMPARISON");
            console.log("============================================================");
            console.log(`  Tasks matched: ${reportWithout.totalTasks}`);
            console.log(`  Retrieval DISABLED: Pass Rate ${(reportWithout.passRate * 100).toFixed(1)}%, Mean Score ${reportWithout.meanScore.toFixed(2)}`);
            console.log(`  Retrieval ENABLED:  Pass Rate ${(reportWith.passRate * 100).toFixed(1)}%, Mean Score ${reportWith.meanScore.toFixed(2)}`);
            
            const diffPass = (reportWith.passRate - reportWithout.passRate) * 100;
            const diffScore = reportWith.meanScore - reportWithout.meanScore;
            
            console.log(`\n  Delta Pass Rate: ${diffPass >= 0 ? '+' : ''}${diffPass.toFixed(1)}%`);
            console.log(`  Delta Mean Score: ${diffScore >= 0 ? '+' : ''}${diffScore.toFixed(2)}`);
            console.log("============================================================\n");
        } else if (runMode === "export") {
            const { exportLearning } = require("./apprentice/export");
            await exportLearning(exportDir);
        } else if (runMode === "cleanup") {
            const { runCleanupAndPromotion } = require("./apprentice/promotion");
            const { generateSummaries, generatePromptPacks } = require("./apprentice/summary-generator");
            await runCleanupAndPromotion();
            await generateSummaries();
            await generatePromptPacks();
        } else if (runMode === "benchmark") {
            const task = await loadBenchmarkTask(targetId);
            const api = require("api-ape");
            await connectGateway(api);
            try {
                await runBenchmarkSuite(api, [task], disableRetrieval);
            } finally {
                if (typeof api.close === "function") api.close();
            }
        } else if (runMode === "replay") {
            const task = loadEpisodeTask(targetId);
            const api = require("api-ape");
            await connectGateway(api);
            try {
                await runBenchmarkSuite(api, [task], disableRetrieval);
            } finally {
                if (typeof api.close === "function") api.close();
            }
        } else {
            const { episodeDir, summary } = await runEpisode(TASK, disableRetrieval);
            console.log("✓ Sequence complete. Episode saved to:", episodeDir);
            console.log(`  Result: ${summary.finalVerdict} after ${summary.totalAttempts} attempt(s)`);
        }
    } catch (err) {
        console.error("\n✗ Episode failed:", err.message);
        console.error(err.stack);
        process.exitCode = 1;
    }
}

// Kick off the main function.
main();
