/**
 * apprentice/filesystem.js
 *
 * Purpose: Shared filesystem abstractions layer.
 * Responsibilities: Provides safe directory creation, file writing, timestamp generation, episode ID creation, and filename derivations.
 * Major sections:
 *   - Async wrappers: ensureDirectory, writeText
 *   - Namers: timestamp, episodeId, attemptFilename
 * Important invariants: All file paths passed must be absolute. Directory creation is transparently recursive.
 */

const fs = require("fs");
const crypto = require("crypto");

/**
 * Purpose: Recursively create a directory if it does not already exist.
 * Inputs:
 *   - dirPath: {string} absolute path to ensure exists
 * Outputs: {Promise<void>} 
 * Side effects: Creates directories on the local filesystem.
 * Failure behavior: Throws an Error if creation fails due to permissions or if a file already exists at a required path node.
 * Important assumptions: Requires write permissions to the parent directories.
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
 * Purpose: Write text content to a file, creating it if it does not exist and overwriting if it does.
 * Inputs:
 *   - filePath: {string} absolute path to write
 *   - content: {string} string content to write
 * Outputs: {Promise<void>}
 * Side effects: Writes a string with utf-8 encoding to the filesystem.
 * Failure behavior: Throws a descriptive Error if writing fails.
 * Important assumptions: Parent directory must already exist (call ensureDirectory first).
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
 * Purpose: Get an ISO 8601 timestamp string for the current moment, safe for file names.
 * Inputs: None
 * Outputs: {string} e.g. "2026-03-12T21_39_49.123Z" with colons replaced by underscores
 * Side effects: None
 * Failure behavior: None (uses native Date API)
 * Important assumptions: Caller expects string to not contain colons, preventing path resolution issues on some OSes.
 */
function timestamp() {
    return new Date().toISOString().replace(/:/g, "_");
}

/**
 * Purpose: Generate a globally unique sequence-friendly episode identifier.
 * Inputs: None
 * Outputs: {string} formatted like "episode_<timestamp>_<4-hex-chars>"
 * Side effects: Uses underlying crypto implementation to generate random bytes.
 * Failure behavior: None typically, propagates crypto failures if the OS lacks entropy.
 * Important assumptions: Used to create isolated directories for episodes, preventing collisions.
 */
function episodeId() {
    const rand = crypto.randomBytes(2).toString("hex");
    return `episode_${timestamp()}_${rand}`;
}

/**
 * Purpose: Derive the uniform filename for a specific attempt number.
 * Inputs:
 *   - attemptNum: {number} 1-based attempt integer
 * Outputs: {string} e.g. "attempt_001.js"
 * Side effects: None
 * Failure behavior: Coerces invalid numbers to strings natively, string.padStart might fail if attemptNum is undefined.
 * Important assumptions: Padding is exactly 3 digits for lexicographical sorting.
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
