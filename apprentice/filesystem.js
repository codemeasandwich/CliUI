/**
 * apprentice/filesystem.js — Filesystem Helpers
 *
 * Thin wrappers around fs.promises for episode management.
 * Provides directory creation, file writing, timestamp generation,
 * episode ID creation, and attempt filename derivation.
 *
 * @module apprentice/filesystem
 */

const fs = require("fs");
const crypto = require("crypto");

/**
 * Recursively create a directory if it does not already exist.
 * Uses { recursive: true } so intermediate parents are created.
 *
 * @param {string} dirPath — absolute path to ensure exists
 */
async function ensureDirectory(dirPath) {
    try {
        await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (err) {
        throw new Error(
            `ensureDirectory failed for '${dirPath}': ${err.message}. ` +
            `Check that the parent path is writable and not a file.`
        );
    }
}

/**
 * Write text content to a file, creating it if it does not exist
 * and overwriting if it does.
 *
 * @param {string} filePath — absolute path to write
 * @param {string} content  — string content to write
 */
async function writeText(filePath, content) {
    try {
        await fs.promises.writeFile(filePath, content, "utf-8");
    } catch (err) {
        throw new Error(
            `writeText failed for '${filePath}': ${err.message}. ` +
            `Ensure the parent directory exists and is writable.`
        );
    }
}

/**
 * ISO 8601 timestamp string for the current moment.
 * Colons are replaced with underscores for filesystem safety.
 *
 * @returns {string} e.g. "2026-03-12T21_39_49.123Z"
 */
function timestamp() {
    return new Date().toISOString().replace(/:/g, "_");
}

/**
 * Generate a unique episode identifier by combining a filesystem-safe
 * timestamp with 4 random hex characters. The random suffix avoids
 * collisions when episodes are created in rapid succession.
 *
 * @returns {string} e.g. "episode_2026-03-12T21_39_49.123Z_a3f1"
 */
function episodeId() {
    const rand = crypto.randomBytes(2).toString("hex");
    return `episode_${timestamp()}_${rand}`;
}

/**
 * Derive the filename for a specific attempt number.
 * Zero-padded to 3 digits for natural sort order.
 *
 * @param {number} attemptNum — 1-based attempt number
 * @returns {string} e.g. "attempt_001.js"
 */
function attemptFilename(attemptNum) {
    return `attempt_${String(attemptNum).padStart(3, "0")}.js`;
}

module.exports = {
    ensureDirectory,
    writeText,
    timestamp,
    episodeId,
    attemptFilename,
};
