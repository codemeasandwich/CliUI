/**
 * apprentice/distill.js — Episode Distillation Engine
 *
 * Analyzes a completed episode's attempt history and creates learning
 * artifacts: memories, exemplars, anti-patterns, and (conservatively)
 * skills. Called once after each episode completes.
 *
 * Distillation rules prioritize memory over skill when confidence is
 * limited. Skills are only created when evidence is strong: score >= 8
 * and the episode passed in <= 2 attempts.
 *
 * The four extraction routines live in extractors.js to keep each module
 * under the 200 NCLOC limit. This file owns tag extraction (shared with
 * retrieve.js via the same stop-word vocabulary) and the distillation
 * orchestrator.
 *
 * @module apprentice/distill
 */

const { filterStopWords } = require("./tag-processing");
const {
    extractMemories,
    extractExemplar,
    extractAntiPatterns,
    maybeExtractSkill,
} = require("./extractors");

/**
 * Extract searchable tags from a block of text. Tokenizes on
 * whitespace and punctuation, lowercases, deduplicates, filters
 * to terms >= 3 characters, and removes stop words.
 *
 * Domain-aware: retains common CliUI/terminal terms even if short,
 * and filters English stop words plus low-signal verbs/nouns that
 * appear in every artifact (via tag-processing.js).
 *
 * @param {string} text — raw text to extract tags from
 * @returns {string[]} deduplicated, lowercased, filtered keyword tags
 */
function extractTags(text) {
    if (!text) return [];

    // Split on whitespace and common punctuation boundaries.
    const tokens = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 3);

    // Deduplicate, then remove stop words for clean, high-signal tags.
    return filterStopWords([...new Set(tokens)]);
}

/**
 * Distill learning artifacts from a completed episode.
 *
 * Main entry point — called after each episode finishes. Runs all
 * four extraction routines and returns the full list of created
 * artifacts for metadata tracking.
 *
 * Written paths (delegated to artifact-writers.js via extractors.js):
 *   - learning/memories/<id>.md       — from extractMemories
 *   - learning/exemplars/<id>.md      — from extractExemplar
 *   - learning/anti-patterns/<id>.md  — from extractAntiPatterns
 *   - learning/skills/<id>.md         — from maybeExtractSkill
 *   - learning/indexes/*.json         — updated by addToIndex via each writer
 *
 * Failure behavior: If any individual artifact write fails, the error
 * propagates immediately — already-written artifacts remain on disk.
 * Partial distillation is safe because each artifact + index update is
 * independent. On re-run, new IDs are generated (no collision risk).
 *
 * @param {string}   episodeId  — unique episode identifier
 * @param {object}   task       — original task payload
 * @param {object[]} history    — array of per-attempt result objects
 * @param {string}   stopReason — why the loop stopped
 * @returns {Promise<{ created: object[] }>} list of created artifacts
 */
async function distillEpisode(episodeId, task, history, stopReason) {
    const created = [];

    // Guard: nothing to distill from empty episodes.
    if (!history || history.length === 0) {
        return { created };
    }

    // Extract memories from evaluator critiques on failing attempts.
    const memories = await extractMemories(task, history, episodeId, extractTags);
    created.push(...memories);

    // Extract exemplar from the best passing attempt.
    const exemplar = await extractExemplar(episodeId, task, history, extractTags);
    if (exemplar) created.push(exemplar);

    // Extract anti-patterns from repeated failure patterns.
    const antiPatterns = await extractAntiPatterns(task, history, episodeId, extractTags);
    created.push(...antiPatterns);

    // Conservatively extract a skill when evidence is strong.
    const skill = await maybeExtractSkill(episodeId, task, history, extractTags);
    if (skill) created.push(skill);

    return { created };
}

module.exports = {
    distillEpisode,
    extractMemories,
    extractExemplar,
    extractAntiPatterns,
    maybeExtractSkill,
    extractTags,
};
