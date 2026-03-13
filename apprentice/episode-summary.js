/**
 * apprentice/episode-summary.js — Episode Summary Builder
 *
 * Builds and persists the final episode summary JSON after all
 * attempts have completed. The summary captures the full attempt
 * history, scores, verdicts, and the reason the loop stopped.
 *
 * Saved as episode-summary.json in the episode directory.
 *
 * @module apprentice/episode-summary
 */

const path = require("path");
const { writeText } = require("./filesystem");

/**
 * Build the episode summary object from the attempt history.
 *
 * @param {string}   episodeId  — unique episode identifier
 * @param {object}   task       — original task payload
 * @param {object[]} history    — array of per-attempt result objects
 * @param {string}   stopReason — why the loop stopped
 * @returns {object} the summary object
 */
function buildSummary(episodeId, task, history, stopReason) {
    // Guard against empty history — can happen if runner_error occurs
    // on the very first attempt before any result is recorded.
    if (history.length === 0) {
        return {
            episodeId,
            task,
            totalAttempts: 0,
            scores: [],
            verdicts: [],
            finalScore: 0,
            finalVerdict: "error",
            stopReason,
            attempts: [],
            timestamp: new Date().toISOString(),
        };
    }

    const lastAttempt = history[history.length - 1];

    // Extract score and verdict arrays for quick scanning.
    const scores = history.map((a) => a.score);
    const verdicts = history.map((a) => a.verdict);

    // Build per-attempt metadata entries without the full artifacts.
    const attempts = history.map((a, i) => ({
        attempt: i + 1,
        score: a.score,
        verdict: a.verdict,
        durationMs: a.durationMs,
        exitCode: a.exitCode,
        timedOut: a.timedOut,
        evaluatorScore: a.evaluatorResult ? a.evaluatorResult.evaluatorScore : a.score,
        deterministicPenalty: a.evaluatorResult ? a.evaluatorResult.deterministicPenalty : 0,
        passedChecks: a.evaluatorResult ? a.evaluatorResult.passedChecks : [],
        failedChecks: a.evaluatorResult ? a.evaluatorResult.failedChecks : []
    }));

    return {
        episodeId,
        task,
        totalAttempts: history.length,
        scores,
        verdicts,
        finalScore: lastAttempt.score,
        finalVerdict: lastAttempt.verdict,
        stopReason,
        attempts,
        timestamp: new Date().toISOString(),
    };
}

/**
 * Save the episode summary JSON to the episode directory.
 *
 * @param {string} episodeDir — absolute path to the episode folder
 * @param {object} summary   — the summary object from buildSummary
 */
async function saveEpisodeSummary(episodeDir, summary) {
    const summaryPath = path.join(episodeDir, "episode-summary.json");
    await writeText(summaryPath, JSON.stringify(summary, null, 2));
}

module.exports = { buildSummary, saveEpisodeSummary };
