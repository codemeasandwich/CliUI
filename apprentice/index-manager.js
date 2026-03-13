/**
 * apprentice/index-manager.js — Learning Index Maintenance
 *
 * Maintains JSON index files under learning/indexes/ — one per
 * artifact type (memories, skills, exemplars, anti-patterns).
 * Each index is an array of entry objects that point to the
 * corresponding markdown artifact on disk.
 *
 * Index files are the primary machine-readable lookup surface
 * for future retrieval and promotion logic. They are append-only
 * during normal operation; rebuildIndex rescans from disk.
 *
 * @module apprentice/index-manager
 */

const fs = require("fs");
const path = require("path");
const CONFIG = require("./config");
const { ensureDirectory, writeText } = require("./filesystem");
const { parseFrontMatter } = require("./front-matter");

/**
 * Map artifact type names to their index filenames.
 * Keeps naming consistent across the codebase — callers pass
 * the singular type name, this resolves the plural JSON filename.
 */
const INDEX_FILES = {
    memory:         "memories.json",
    skill:          "skills.json",
    exemplar:       "exemplars.json",
    "anti-pattern": "anti-patterns.json",
};

/**
 * Resolve the absolute path for an index file by artifact type.
 *
 * @param {string} type — artifact type (memory, skill, exemplar, anti-pattern)
 * @returns {string} absolute path to the index JSON file
 * @throws {Error} if type is not recognized
 */
function indexPath(type) {
    const filename = INDEX_FILES[type];
    if (!filename) {
        throw new Error(
            `indexPath: unknown artifact type '${type}'. ` +
            `Valid types: ${Object.keys(INDEX_FILES).join(", ")}. ` +
            `Check the caller is passing a valid type string.`
        );
    }
    return path.join(CONFIG.paths.indexes, filename);
}

/**
 * Read and parse an index file. Returns an empty array if the
 * file does not exist yet (first write bootstraps the file).
 *
 * @param {string} type — artifact type
 * @returns {Promise<object[]>} array of index entries
 */
async function readIndex(type) {
    const filePath = indexPath(type);
    try {
        const raw = await fs.promises.readFile(filePath, "utf-8");
        return JSON.parse(raw);
    } catch (err) {
        // ENOENT means the index hasn't been created yet — return empty.
        // Any other error (corrupt JSON, permission denied) should surface.
        if (err.code === "ENOENT") {
            return [];
        }
        throw new Error(
            `readIndex failed for type '${type}' at '${filePath}': ${err.message}. ` +
            `The index file may be corrupted or unreadable.`
        );
    }
}

/**
 * Append an entry to an index file. Reads the current index,
 * pushes the new entry, and writes back atomically. Creates the
 * indexes directory and file if they don't exist.
 *
 * Entry shape: { id, title, tags, path, createdAt, confidence }
 *
 * @param {string} type  — artifact type
 * @param {object} entry — index entry to append
 * @returns {Promise<void>}
 */
async function addToIndex(type, entry) {
    await ensureDirectory(CONFIG.paths.indexes);
    const entries = await readIndex(type);
    entries.push(entry);
    const filePath = indexPath(type);
    await writeText(filePath, JSON.stringify(entries, null, 2));
}

/**
 * Rebuild an index by scanning the artifact directory and parsing
 * YAML front-matter from each markdown file. Useful for recovery
 * or after manual edits to artifact files.
 *
 * Reads all .md files in the type's directory, extracts front-matter
 * fields (id, title, tags, confidence, createdAt), and writes a
 * fresh index file.
 *
 * @param {string} type — artifact type
 * @returns {Promise<object[]>} the rebuilt index entries
 */
async function rebuildIndex(type) {
    // Resolve the directory that holds artifacts of this type.
    const dirMap = {
        memory:         CONFIG.paths.memories,
        skill:          CONFIG.paths.skills,
        exemplar:       CONFIG.paths.exemplars,
        "anti-pattern": CONFIG.paths.antiPatterns,
    };
    const dir = dirMap[type];
    if (!dir) {
        throw new Error(
            `rebuildIndex: unknown artifact type '${type}'. ` +
            `Valid types: ${Object.keys(dirMap).join(", ")}.`
        );
    }

    // List all .md files in the artifact directory.
    let files;
    try {
        files = await fs.promises.readdir(dir);
    } catch (err) {
        if (err.code === "ENOENT") {
            return [];
        }
        throw err;
    }
    const mdFiles = files.filter((f) => f.endsWith(".md"));

    // Parse front-matter from each file and build index entries.
    const entries = [];
    for (const filename of mdFiles) {
        const filePath = path.join(dir, filename);
        const content = await fs.promises.readFile(filePath, "utf-8");
        const meta = parseFrontMatter(content);
        if (meta.id) {
            entries.push({
                id:         meta.id,
                title:      meta.title || filename,
                tags:       meta.tags || [],
                path:       filePath,
                createdAt:  meta.createdAt || null,
                confidence: meta.confidence != null ? meta.confidence : null,
            });
        }
    }

    // Write the rebuilt index.
    await ensureDirectory(CONFIG.paths.indexes);
    const filePath = indexPath(type);
    await writeText(filePath, JSON.stringify(entries, null, 2));
    return entries;
}

module.exports = { addToIndex, readIndex, rebuildIndex, parseFrontMatter, indexPath };
