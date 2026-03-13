/**
 * apprentice/benchmark-runner.js — Benchmark Execution & Reporting
 *
 * Runs a suite of benchmark tasks, leveraging the normal episode
 * machinery, and produces both per-task regression reports and
 * an aggregate suite report.
 *
 * @module apprentice/benchmark-runner
 */

const path = require("path");
const fs = require("fs");
const CONFIG = require("./config");
const { episodeId, ensureDirectory, timestamp, writeText } = require("./filesystem");
const attemptLoop = require("./attempt-loop");
const { buildSummary, saveEpisodeSummary } = require("./episode-summary");

/**
 * Executes a suite of benchmark tasks and compiles regression reports.
 *
 * Domain: Orchestrates a multi-task benchmarking suite to measure 
 * performance and track regressions over time. It satisfies the need 
 * to prove whether accumulated learning genuinely improves success rates 
 * or if it leads to stagnation, providing concrete evidence of progress.
 *
 * Technical: Iterates over the provided tasks, running full 
 * attempts (via the attempt loop) for each one. Generates a per-task 
 * JSON report containing scores, attempt counts, and utilized artifacts, 
 * as well as a suite-wide aggregate JSON report indicating central tendencies 
 * (mean/median scores) and common failure bottlenecks.
 *
 * Intent & Trade-offs: Intentionally disables the distillation of new 
 * learning artifacts from benchmark runs themselves to prevent test-data 
 * contamination into the training set. Reports are flushed to disk 
 * iteratively to prevent memory/data loss in the event of an abrupt runner crash.
 *
 * Edge cases & Failure modes: Handles graceful degradation and zero-division 
 * checks if provided an empty task payload, bypassing mathematical errors.
 * 
 * @param {object} api               - connected api-ape client
 * @param {object[]} tasks           - array of standard task payloads
 * @param {boolean} disableRetrieval - whether to disable learning retrieval
 * @returns {Promise<object>} The aggregate report JSON object describing the entire suite's performance
 */
async function runBenchmarkSuite(api, tasks, disableRetrieval = false) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`  Starting Benchmark Suite`);
    console.log(`  Tasks: ${tasks.length}`);
    console.log(`  Retrieval: ${disableRetrieval ? "DISABLED" : "ENABLED"}`);
    console.log(`${"=".repeat(60)}\n`);

    const runId = timestamp().replace(/[:.]/g, "-");
    const reportsDir = CONFIG.paths.reports;
    await ensureDirectory(reportsDir);

    const taskReports = [];

    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const id = episodeId();
        const episodeDir = path.join(CONFIG.paths.episodes, id);

        console.log(`\n--- Benchmark Task ${i + 1}/${tasks.length}: ${task.id} ---`);
        console.log(`Episode: ${id}`);

        const startTime = Date.now();
        const { history, stopReason, retrievedLearning } = await attemptLoop.runAttemptLoop(
            api, task, episodeDir, disableRetrieval
        );
        const durationMs = Date.now() - startTime;

        const summary = buildSummary(id, task, history, stopReason);
        await saveEpisodeSummary(episodeDir, summary);

        // We do *not* distill during a benchmark run by default to prevent 
        // the benchmark itself from polluting the learning metrics of normal runs,
        // although depending on requirements we could. For now, we only measure.
        
        // Build per-task regression report
        let passType = "fail";
        if (summary.finalScore >= CONFIG.passThreshold) passType = "pass";
        else if (summary.finalScore > 0) passType = "partial";

        // Aggregate retrieved artifact IDs from all attempts in the history
        // to see what was most helpful. Wait, retrievedLearning is constant per episode.
        let retrievedIds = [];
        if (retrievedLearning && retrievedLearning.memories) {
            retrievedIds = retrievedIds.concat(retrievedLearning.memories.map(m => m.id));
        }
        if (retrievedLearning && retrievedLearning.skills) {
            retrievedIds = retrievedIds.concat(retrievedLearning.skills.map(s => s.id));
        }
        if (retrievedLearning && retrievedLearning.exemplars) {
            retrievedIds = retrievedIds.concat(retrievedLearning.exemplars.map(e => e.id));
        }
        if (retrievedLearning && retrievedLearning.antiPatterns) {
            retrievedIds = retrievedIds.concat(retrievedLearning.antiPatterns.map(a => a.id));
        }

        const taskReport = {
            taskId: task.id,
            episodeId: id,
            attemptsTaken: summary.totalAttempts,
            finalScore: summary.finalScore,
            passType,
            retrievedArtifactIds: retrievedIds,
            durationMs,
            stopReason
        };

        taskReports.push(taskReport);

        // Save per-task report
        const taskReportFilename = `report_${runId}_${task.id}.json`;
        await writeText(path.join(reportsDir, taskReportFilename), JSON.stringify(taskReport, null, 2));

        console.log(`Result: ${passType} (Score: ${summary.finalScore}/10) in ${summary.totalAttempts} attempts`);
    }

    // Build aggregate report
    const totalTasks = tasks.length;
    const passedTasks = taskReports.filter(r => r.passType === "pass").length;
    const passRate = totalTasks > 0 ? passedTasks / totalTasks : 0;
    
    const sumScore = taskReports.reduce((acc, r) => acc + r.finalScore, 0);
    const meanScore = totalTasks > 0 ? sumScore / totalTasks : 0;

    const scores = taskReports.map(r => r.finalScore).sort((a, b) => a - b);
    const medianScore = totalTasks > 0 ? (scores.length % 2 === 0 ? (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2 : scores[Math.floor(scores.length / 2)]) : 0;

    const attemptsToSuccessDist = {};
    for (const report of taskReports) {
        if (report.passType === "pass") {
            const att = report.attemptsTaken;
            attemptsToSuccessDist[att] = (attemptsToSuccessDist[att] || 0) + 1;
        }
    }

    const artifactUsage = {};
    for (const report of taskReports) {
        for (const artId of report.retrievedArtifactIds) {
            artifactUsage[artId] = (artifactUsage[artId] || 0) + 1;
        }
    }
    const helpfulArtifacts = Object.entries(artifactUsage)
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => ({ id, count }));

    const failureTypes = {};
    for (const report of taskReports) {
        if (report.passType !== "pass") {
            failureTypes[report.stopReason] = (failureTypes[report.stopReason] || 0) + 1;
        }
    }

    const aggregateReport = {
        runId,
        timestamp: new Date().toISOString(),
        retrievalEnabled: !disableRetrieval,
        totalTasks,
        passedTasks,
        passRate,
        meanScore,
        medianScore,
        attemptsToSuccessDist,
        helpfulArtifacts,
        commonFailureTypes: failureTypes,
        taskReports
    };

    const aggFilename = `aggregate_${runId}.json`;
    await writeText(path.join(reportsDir, aggFilename), JSON.stringify(aggregateReport, null, 2));

    console.log(`\n${"=".repeat(60)}`);
    console.log(`  Benchmark Suite Complete`);
    console.log(`  Pass Rate: ${(passRate * 100).toFixed(1)}% (${passedTasks}/${totalTasks})`);
    console.log(`  Mean Score: ${meanScore.toFixed(2)}/10`);
    console.log(`  Aggregate Report: ${path.join(reportsDir, aggFilename)}`);
    console.log(`${"=".repeat(60)}\n`);

    return aggregateReport;
}

module.exports = { runBenchmarkSuite };
