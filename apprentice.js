#!/usr/bin/env bun

/**
 * apprentice.js
 *
 * Purpose: Entry point for the Apprentice system.
 * Responsibilities: Orchestrates the core execution loop (generate -> execute -> evaluate) and provides various CLI utility modes.
 * Major sections:
 *   - runEpisode: Runs the core loop.
 *   - main: CLI entrypoint and argument parsing.
 * Important invariants: Each attempt is evaluated solely on its real captured output — never invented or guessed.
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
const { shouldAnalyze, analyzeFailure } = require("./apprentice/analyst");
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
 * Purpose: Run one complete episode of the multi-attempt refinement loop.
 * Inputs:
 *   - task: {object} task payload { request, wireframe?, cols?, rows? }
 *   - disableRetrieval: {boolean} [default=false] whether learning retrieval is disabled
 * Outputs: {Promise<{episodeDir: string, summary: object}>} Contains the path to the episode directory and the summary object.
 * Side effects: Bootstraps learning directories, connects to the LLM gateway, creates an episode directory, logs progress to stdout, saves the summary, and distills learning artifacts locally.
 * Failure behavior: Ensure WebSocket connection is closed in `finally` block to prevent resource leaks. Throws underlying errors upward.
 * Important assumptions: Assumes `api-ape` gateway is reachable and that task object has the expected keys.
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

        // Step 6 — Conditional failure analysis.
        // When the episode shows persistent low-quality output despite
        // running code, the Requirements Analyst investigates whether
        // the CliUI library lacks the capabilities the task demands.
        // Wrapped in try/catch — analyst failure must not prevent
        // normal episode completion.
        if (shouldAnalyze(history, stopReason)) {
            console.log("  [analyst] Persistent failure detected — running requirements analysis…");
            try {
                const analysisResult = await analyzeFailure(api, id, task, history);
                console.log(`  [analyst] Classification: ${analysisResult.classification}`);
                console.log(`  [analyst] Requirement: ${analysisResult.created.id}`);
            } catch (err) {
                console.warn(`  [analyst] Analysis failed (non-fatal): ${err.message}`);
            }
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
 * Purpose: Main CLI entrypoint. Parses arguments to determine the operating mode.
 * Inputs: None directly (reads process.argv for flags like --benchmark, --export, etc.).
 * Outputs: {Promise<void>} Resolves when the selected active mode completes.
 * Side effects: Executes CLI specific routines (benchmarks, cleanup, episode running), writes files to the persistence directories, and prints results to stdout/stderr.
 * Failure behavior: Catches all unhandled promises. Exits process with process.exitCode = 1 and prints the stack trace if any mode catastrophically fails.
 * Important assumptions: Expects terminal dimensions from CONFIG and valid task definition if no alternate run mode is provided.
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
