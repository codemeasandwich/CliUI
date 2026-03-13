/**
 * apprentice/persistence.js — Episode Persistence
 *
 * Saves all episode artifacts into a structured folder under
 * learning/episodes/<episodeId>/. Each episode contains per-attempt
 * artifacts (script, raw ANSI, normalized screen, stderr, evaluator
 * verdict) and a single episode metadata file.
 *
 * Phase 2 naming convention uses attempt-prefixed filenames to
 * support multi-attempt episodes in later phases:
 *   attempt_001.js          — generated script
 *   attempt_001-raw.ansi    — raw PTY stream
 *   attempt_001-screen.txt  — normalized final-frame text
 *   attempt_001-stderr.txt  — captured stderr
 *   attempt_001-evaluator.json — evaluator verdict
 *   episode-meta.json       — episode metadata
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
 * Save all artifacts for a completed episode to disk.
 *
 * Creates the episode directory and writes the full artifact set.
 * Each artifact is named with the attempt prefix for multi-attempt
 * support in later phases.
 *
 * @param {string} episodeDir — absolute path to the episode folder
 * @param {object} artifacts  — all episode data to persist
 * @param {string} artifacts.script          — generated JS source
 * @param {string} artifacts.rawAnsi         — raw PTY ANSI stream
 * @param {string} artifacts.screenText      — normalized screen text
 * @param {string} artifacts.stdout          — stdout (kept for compat)
 * @param {string} artifacts.stderr          — captured stderr
 * @param {object} artifacts.evaluatorResult — parsed evaluator response
 * @param {object} artifacts.metadata        — episode metadata
 * @param {number} [artifacts.attemptNum=1]  — which attempt (default 1)
 */
async function saveEpisode(episodeDir, artifacts) {
    await ensureDirectory(episodeDir);
    const num = artifacts.attemptNum || 1;
    const base = attemptBase(num);

    // Save generated script for re-run or inspection.
    await writeText(
        path.join(episodeDir, attemptFilename(num)),
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
        artifacts.stderr
    );

    // Save the evaluator's structured verdict as formatted JSON.
    await writeText(
        path.join(episodeDir, `${base}-evaluator.json`),
        JSON.stringify(artifacts.evaluatorResult, null, 2)
    );

    // Save episode metadata for provenance and later analysis.
    await writeText(
        path.join(episodeDir, "episode-meta.json"),
        JSON.stringify(artifacts.metadata, null, 2)
    );
}

module.exports = { saveEpisode };
