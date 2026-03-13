/**
 * apprentice/persistence.js — Per-Attempt Artifact Persistence
 *
 * Saves all artifacts for a single attempt into a structured folder
 * under learning/episodes/<episodeId>/. Each attempt gets its own
 * prefixed set of files for inspection and debugging.
 *
 * Naming convention (zero-padded for natural sort):
 *   attempt_001.js          — generated script
 *   attempt_001-raw.ansi    — raw PTY stream
 *   attempt_001-screen.txt  — normalized final-frame text
 *   attempt_001-stderr.txt  — captured stderr
 *   attempt_001-evaluator.json — evaluator verdict
 *
 * Episode-level summary is handled by episode-summary.js.
 *
 * @module apprentice/persistence
 */

const path = require("path");
const { ensureDirectory, writeText, attemptFilename } = require("./filesystem");

/**
 * Derive the base name for attempt artifacts by stripping the .js
 * extension from the attempt filename. Used to construct the
 * prefixed artifact names (e.g., "attempt_001" → "attempt_001-screen.txt").
 *
 * @param {number} attemptNum — 1-based attempt number
 * @returns {string} base name without extension, e.g. "attempt_001"
 */
function attemptBase(attemptNum) {
    return attemptFilename(attemptNum).replace(/\.js$/, "");
}

/**
 * Save all artifacts for a single attempt to the episode directory.
 *
 * Each artifact is named with the attempt prefix so multiple
 * attempts coexist in the same directory without conflicts.
 * Files are written sequentially to avoid partial-write races.
 *
 * @param {string} episodeDir  — absolute path to the episode folder
 * @param {number} attemptNum  — 1-based attempt number
 * @param {object} artifacts   — attempt data to persist
 * @param {string} artifacts.script          — generated JS source
 * @param {string} artifacts.rawAnsi         — raw PTY ANSI stream
 * @param {string} artifacts.screenText      — normalized screen text
 * @param {string} artifacts.stdout          — stdout (kept for compat)
 * @param {string} artifacts.stderr          — captured stderr
 * @param {object} artifacts.evaluatorResult — parsed evaluator response
 * @param {string[]} [retrievedArtifactIds]  — IDs of retrieved learning artifacts
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
 * Legacy saveEpisode wrapper for backward compatibility with Phase 2.
 * Delegates to saveAttempt for the single-attempt case plus writes
 * episode metadata. Used only by existing Phase 2 tests.
 *
 * @param {string} episodeDir — absolute path to the episode folder
 * @param {object} artifacts  — all episode data (Phase 2 shape)
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
