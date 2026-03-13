/**
 * apprentice/learning-store.js — Learning Directory Bootstrap & ID Helpers
 *
 * Ensures all ten learning/ subdirectories exist on startup so that
 * artifact writers, index managers, and prompt snapshots have reliable
 * write targets. Also provides ID generators for artifact types.
 *
 * Called once at the start of each episode from apprentice.js.
 * Idempotent — safe to call multiple times.
 *
 * @module apprentice/learning-store
 */

const crypto = require("crypto");
const CONFIG = require("./config");
const { ensureDirectory, timestamp } = require("./filesystem");

/**
 * Collect the learning directory paths from CONFIG.paths at call time.
 * Must be computed dynamically (not cached at module load) because
 * tests may override CONFIG.paths after import.
 *
 * @returns {string[]} array of absolute directory paths
 */
function learningDirPaths() {
    return [
        CONFIG.paths.episodes,
        CONFIG.paths.skills,
        CONFIG.paths.memories,
        CONFIG.paths.exemplars,
        CONFIG.paths.antiPatterns,
        CONFIG.paths.indexes,
        CONFIG.paths.prompts,
        CONFIG.paths.summaries,
        CONFIG.paths.benchmarks,
        CONFIG.paths.reports,
    ];
}

/**
 * Create all learning directories. Uses ensureDirectory (recursive mkdir)
 * so intermediate parents are created and existing dirs are no-ops.
 *
 * Written paths: Creates up to 10 directories under the learning/ base
 * (episodes, skills, memories, exemplars, anti-patterns, indexes,
 * prompts, summaries, benchmarks, benchmarks/reports).
 *
 * Failure behavior: Throws an Error if any directory creation fails
 * (bubbled from ensureDirectory). Directories are created sequentially,
 * so a failure mid-way leaves earlier directories intact.
 *
 * @returns {Promise<void>}
 */
async function bootstrapLearningDirs() {
    for (const dir of learningDirPaths()) {
        await ensureDirectory(dir);
    }
}

/**
 * Generate a unique artifact ID for a given type.
 *
 * Format: <type>_<filesystem-safe-timestamp>_<4-hex-chars>
 * Examples:
 *   memory_2026-03-13T05_00_00.000Z_a3f1
 *   skill_2026-03-13T05_00_00.000Z_b7c2
 *
 * The random suffix avoids collisions when artifacts are created
 * in rapid succession within the same millisecond.
 *
 * @param {string} type — artifact type prefix (memory, skill, exemplar, anti-pattern)
 * @returns {string} unique artifact identifier
 */
function artifactId(type) {
    const rand = crypto.randomBytes(2).toString("hex");
    return `${type}_${timestamp()}_${rand}`;
}

module.exports = { bootstrapLearningDirs, artifactId, learningDirPaths };
