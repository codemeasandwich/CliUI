/**
 * apprentice/persistence.js
 *
 * Purpose: Per-Attempt Artifact Persistence.
 * Responsibilities: Saves all artifacts for a single attempt into a structured folder.
 * Major sections:
 *   - saveAttempt: Saves individual script, output, and evaluator results.
 *   - saveEpisode: Legacy wrapper.
 * Important invariants: Each attempt gets its own prefixed set of files to prevent overwrite races.
 */

const path = require("path");
const { ensureDirectory, writeText, attemptFilename } = require("./filesystem");

/**
 * Purpose: Derive the base name for attempt artifacts by stripping the .js extension.
 * Inputs:
 *   - attemptNum: {number} 1-based attempt number
 * Outputs: {string} base name without extension, e.g. "attempt_001"
 * Side effects: None
 * Failure behavior: None natively.
 * Important assumptions: Uses the standard padded filename generation from `filesystem.js`.
 */
function attemptBase(attemptNum) {
    return attemptFilename(attemptNum).replace(/\.js$/, "");
}

/**
 * Purpose: Save all artifacts for a single attempt to the episode directory.
 * Inputs:
 *   - episodeDir: {string} absolute path to the episode folder
 *   - attemptNum: {number} 1-based attempt number
 *   - artifacts: {object} attempt data to persist containing script, rawAnsi, screenText, stderr, evaluatorResult
 *   - retrievedArtifactIds: {string[]} [optional] IDs of retrieved learning artifacts
 * Outputs: {Promise<void>}
 * Side effects: Creates directories and files on the local filesystem.
 * Failure behavior: Bubbles up filesystem `writeText` rejections if unable to write.
 * Important assumptions: Sequential await writing prevents partial-write races. Memory artifacts are stringifiable.
 */
async function saveAttempt(episodeDir, attemptNum, artifacts, retrievedArtifactIds) {
    await ensureDirectory(episodeDir);
    const base = attemptBase(attemptNum);

    // Save generated script for re-run or inspection.
    await writeText(
        path.join(episodeDir, attemptFilename(attemptNum)),
        artifacts.script
    );

    // Save raw ANSI/PTY stream — the unprocessed terminal output.
    // Contains escape sequences, cursor movements, colors, etc.
    if (artifacts.rawAnsi) {
        await writeText(
            path.join(episodeDir, `${base}-raw.ansi`),
            artifacts.rawAnsi
        );
    }

    // Save normalized screen text — the primary evaluation artifact.
    // This is a plain-text snapshot of what the user would see.
    await writeText(
        path.join(episodeDir, `${base}-screen.txt`),
        artifacts.screenText || artifacts.stdout || ""
    );

    // Save captured stderr — useful for diagnosing runtime errors.
    await writeText(
        path.join(episodeDir, `${base}-stderr.txt`),
        artifacts.stderr || ""
    );

    // Save the evaluator's structured verdict as formatted JSON.
    await writeText(
        path.join(episodeDir, `${base}-evaluator.json`),
        JSON.stringify(artifacts.evaluatorResult, null, 2)
    );

    // Save retrieved artifact IDs for reuse visibility.
    // Records which learning artifacts were consulted during this attempt.
    if (retrievedArtifactIds && retrievedArtifactIds.length > 0) {
        await writeText(
            path.join(episodeDir, `${base}-retrieved.json`),
            JSON.stringify({ retrievedArtifactIds }, null, 2)
        );
    }
}

/**
 * Purpose: Legacy saveEpisode wrapper for backward compatibility with older tests.
 * Inputs:
 *   - episodeDir: {string} absolute path to the episode folder
 *   - artifacts: {object} all episode data
 * Outputs: {Promise<void>}
 * Side effects: Calls `saveAttempt` and writes metadata file.
 * Failure behavior: Bubbles up unhandled FS errors.
 * Important assumptions: Only used by existing Phase 2+ compatible test suites.
 */
async function saveEpisode(episodeDir, artifacts) {
    const num = artifacts.attemptNum || 1;
    await saveAttempt(episodeDir, num, artifacts);

    // Phase 2 compatibility: write episode-meta.json if provided.
    if (artifacts.metadata) {
        await writeText(
            path.join(episodeDir, "episode-meta.json"),
            JSON.stringify(artifacts.metadata, null, 2)
        );
    }
}

module.exports = { saveAttempt, saveEpisode };
