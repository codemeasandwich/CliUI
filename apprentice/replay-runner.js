/**
 * apprentice/replay-runner.js — Episode Replay Loader
 *
 * Extracts a task payload from a past episode's summary so it can
 * be re-run (e.g., replaying a previously failed attempt).
 *
 * @module apprentice/replay-runner
 */

const fs = require("fs");
const path = require("path");
const CONFIG = require("./config");
const { validateBenchmark } = require("./benchmark-loader");

/**
 * Loads the original task payload from a previous episode's summary.
 * 
 * Domain: Enables the "replay" workflow requirement, allowing developers 
 * to take a task that previously failed (or succeeded partially) and run 
 * it again against the latest apprentice learning states. This is crucial 
 * for verifying whether new exemplars or skills actually resolve old failures.
 * 
 * Technical: Reads the JSON episode-summary from the given episode ID's 
 * directory. Extracts the 'task' payload. Patches legacy summaries that 
 * predated the benchmark ID format to ensure they satisfy the current 
 * validation schema, routing them seamlessly into the benchmark pipeline.
 * 
 * Edge cases & Failure modes: Throws strict 3-part diagnostic errors if 
 * the episode directory is deleted, the JSON is malformed, or the 'task' 
 * property is missing from older unsupported episode formats.
 * 
 * @param {string} episodeId - The ID of the past episode to replay
 * @returns {object} The extracted task object
 * @throws {Error} if the episode directory or summary is missing/invalid
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
