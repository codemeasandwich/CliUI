/**
 * apprentice/prompt-snapshot.js — Prompt Persistence Per Attempt
 *
 * Saves the final compiled prompt text for each attempt inside the
 * episode directory. These snapshots enable offline debugging,
 * replay, and prompt quality analysis without re-running episodes.
 *
 * Naming follows the same attempt_NNN convention as other per-attempt
 * artifacts so all files for a given attempt sort together.
 *
 * @module apprentice/prompt-snapshot
 */

const path = require("path");
const { writeText, attemptFilename } = require("./filesystem");

/**
 * Derive the prompt snapshot filename from the attempt number.
 * Reuses the attemptFilename helper's zero-padding for consistency,
 * then replaces the .js suffix with -prompt.md.
 *
 * @param {number} attemptNum — 1-based attempt number
 * @returns {string} filename, e.g. "attempt_001-prompt.md"
 */
function promptFilename(attemptNum) {
    return attemptFilename(attemptNum).replace(/\.js$/, "-prompt.md");
}

/**
 * Save the compiled prompt text for a specific attempt.
 *
 * Writes the prompt as markdown to the episode directory so it
 * can be inspected alongside the generated script, screen capture,
 * and evaluator result for the same attempt.
 *
 * @param {string} episodeDir  — absolute path to the episode folder
 * @param {number} attemptNum  — 1-based attempt number
 * @param {string} promptText  — the full compiled prompt sent to the LLM
 * @returns {Promise<string>} absolute path to the saved prompt file
 */
async function savePromptSnapshot(episodeDir, attemptNum, promptText) {
    const filename = promptFilename(attemptNum);
    const filePath = path.join(episodeDir, filename);
    await writeText(filePath, promptText);
    return filePath;
}

module.exports = { savePromptSnapshot, promptFilename };
