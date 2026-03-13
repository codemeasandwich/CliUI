/**
 * apprentice/artifact-writers.js — Learning Artifact Persistence
 *
 * Provides four writer functions that create standardized markdown
 * artifacts with YAML front-matter in the corresponding learning/
 * subdirectory. Each writer generates a unique ID, formats the
 * document, writes it to disk, and updates the type's index.
 *
 * Artifact types: memory, skill, exemplar, anti-pattern.
 *
 * All artifacts share a consistent front-matter schema so they
 * can be parsed uniformly by the index-manager rebuild logic.
 *
 * @module apprentice/artifact-writers
 */

const path = require("path");
const CONFIG = require("./config");
const { writeText, ensureDirectory } = require("./filesystem");
const { artifactId } = require("./learning-store");
const { addToIndex } = require("./index-manager");

/**
 * Format YAML front-matter block from a metadata object.
 * Produces the --- delimited header that precedes markdown body.
 *
 * Handles strings, numbers, and arrays (inline [a, b, c] format).
 * Strings with special characters are double-quoted for safety.
 *
 * @param {object} meta — key-value pairs for front-matter
 * @returns {string} formatted front-matter block
 */
function formatFrontMatter(meta) {
    const lines = ["---"];
    for (const [key, value] of Object.entries(meta)) {
        if (Array.isArray(value)) {
            // Inline array format: [tag1, tag2, tag3]
            lines.push(`${key}: [${value.join(", ")}]`);
        } else if (typeof value === "number") {
            lines.push(`${key}: ${value}`);
        } else {
            // Quote string values to handle special characters.
            lines.push(`${key}: "${value}"`);
        }
    }
    lines.push("---");
    return lines.join("\n");
}

/**
 * Write a learning artifact to disk and update its index.
 *
 * Internal helper used by all four public writer functions.
 * Handles: ID generation, directory creation, file write,
 * and index append in a single consistent pipeline.
 *
 * @param {string} type      — artifact type (memory, skill, exemplar, anti-pattern)
 * @param {string} targetDir — absolute path to the type's directory
 * @param {object} opts      — artifact content and metadata
 * @param {string} opts.title      — human-readable title
 * @param {string[]} opts.tags     — categorization tags
 * @param {number} [opts.confidence] — confidence score 0-1
 * @param {string} opts.body       — markdown body content
 * @param {string} [opts.source]   — source episode/context ID
 * @param {object} [opts.extra]    — additional front-matter fields
 * @returns {Promise<{id: string, path: string}>} written artifact location
 */
async function writeArtifact(type, targetDir, opts) {
    const id = artifactId(type);
    const createdAt = new Date().toISOString();

    // Build front-matter metadata object.
    const meta = {
        id,
        type,
        title: opts.title || "Untitled",
        tags: opts.tags || [],
        confidence: opts.confidence != null ? opts.confidence : 0.5,
        createdAt,
        source: opts.source || "unknown",
        ...opts.extra,
    };

    // Compose the full markdown document.
    const frontMatter = formatFrontMatter(meta);
    const content = `${frontMatter}\n\n${opts.body || ""}\n`;

    // Write the artifact file.
    await ensureDirectory(targetDir);
    const filePath = path.join(targetDir, `${id}.md`);
    await writeText(filePath, content);

    // Update the index for this artifact type.
    await addToIndex(type, {
        id,
        title: meta.title,
        tags: meta.tags,
        path: filePath,
        createdAt,
        confidence: meta.confidence,
    });

    return { id, path: filePath };
}

/**
 * Write a memory artifact — an observed fact or pattern learned
 * from episode execution and evaluation.
 *
 * @param {object} opts — { title, tags, confidence, body, source }
 * @returns {Promise<{id: string, path: string}>}
 */
async function writeMemoryArtifact(opts) {
    return writeArtifact("memory", CONFIG.paths.memories, opts);
}

/**
 * Write a skill artifact — a reusable technique or approach
 * that produced good results.
 *
 * @param {object} opts — { title, tags, confidence, body, source }
 * @returns {Promise<{id: string, path: string}>}
 */
async function writeSkillArtifact(opts) {
    return writeArtifact("skill", CONFIG.paths.skills, opts);
}

/**
 * Write an exemplar artifact — a reference example of high-quality
 * output tied to a specific episode and attempt.
 *
 * Adds episodeId and attemptNum to front-matter for traceability.
 *
 * @param {object} opts — { title, tags, episodeId, attemptNum, body, source }
 * @returns {Promise<{id: string, path: string}>}
 */
async function writeExemplarArtifact(opts) {
    return writeArtifact("exemplar", CONFIG.paths.exemplars, {
        ...opts,
        extra: {
            episodeId: opts.episodeId || "unknown",
            attemptNum: opts.attemptNum || 0,
        },
    });
}

/**
 * Write an anti-pattern artifact — a documented mistake or approach
 * that consistently produces poor results.
 *
 * @param {object} opts — { title, tags, confidence, body, source }
 * @returns {Promise<{id: string, path: string}>}
 */
async function writeAntiPatternArtifact(opts) {
    return writeArtifact("anti-pattern", CONFIG.paths.antiPatterns, opts);
}

module.exports = {
    writeMemoryArtifact,
    writeSkillArtifact,
    writeExemplarArtifact,
    writeAntiPatternArtifact,
    formatFrontMatter,
};
