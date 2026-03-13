/**
 * apprentice/replay-runner.js
 *
 * Purpose: Extracts a task payload from a past episode's summary so it can be re-run.
 * Responsibilities: Enables replaying a previously failed or completed attempt against the *current* learning state.
 * Major sections:
 *   - loadEpisodeTask: The primary loader function for historical tasks.
 * Important invariants: Patches missing fields dynamically to ensure backward compatibility with pre-benchmark legacy summary formats.
 * Report generation behavior: It enables downstream benchmark runners to generate new performance reports for old tasks, creating a direct before-and-after comparison of learning efficacy.
 * Replay behavior: Replay is the core function of this module. It takes an old episode, extracts its constraints and request, and patches legacy missing fields (like `id` and `title`) to ensure compatibility with the modern benchmark pipeline.
 * Task loading assumptions: Assumes the episode summary exists in `learning/episodes/<id>/episode-summary.json` and contains a `task` payload.
 * Failure behavior: Throws strict 3-part diagnostic errors if the episode directory is deleted, the summary JSON is malformed, or if the `task` property is missing from unsupported legacy formats.
 */

const fs = require("fs");
const path = require("path");
const CONFIG = require("./config");
const { validateBenchmark } = require("./benchmark-loader");

/**
 * Purpose: Load the original task payload from a previous episode's summary.
 * Inputs:
 *   - episodeId: {string} The ID of the past episode to replay.
 * Outputs: {object} The extracted and patched task object.
 * Side effects: Reads the JSON episode-summary from the local filesystem.
 * Failure behavior: Throws strict 3-part diagnostic logic errors if the episode directory is deleted, the summary JSON is malformed, or the 'task' property is missing from older unsupported episode formats.
 * Important assumptions: Enables the "replay" workflow requirement, allowing developers to take a task that previously failed and run it again against the latest apprentice learning states. Patches legacy summaries that predated the benchmark ID format to ensure they satisfy the current validation schema.
 */
function loadEpisodeTask(episodeId) {
    const summaryPath = path.join(CONFIG.paths.episodes, episodeId, "episode-summary.json");
    if (!fs.existsSync(summaryPath)) {
        throw new Error(
            `Failed to load replay task for episode ID: '${episodeId}'.\n` +
            `Constraint violated: Episode summary does not exist at expected path [${summaryPath}].\n` +
            `Guidance: Verify the episode ID is correct and the episode was previously executed.`
        );
    }

    const content = fs.readFileSync(summaryPath, "utf-8");
    const summary = JSON.parse(content);
    
    if (!summary.task) {
        throw new Error(
            `Failed to load replay task for episode ID: '${episodeId}'.\n` +
            `Constraint violated: The episode summary JSON lacks a 'task' property.\n` +
            `Guidance: Ensure the episode summary is well-formed. Older episodes may not support replay.`
        );
    }

    // Attempt to validate, but if the task was from before benchmarks 
    // it might miss `id` or `title`. If so we patch them to be able to run it.
    const task = summary.task;
    if (!task.id) task.id = `replay-${episodeId}`;
    if (!task.title) task.title = `Replay of ${episodeId}`;

    validateBenchmark(task);
    return task;
}

module.exports = { loadEpisodeTask };
