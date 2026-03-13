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
 * Domain: Translates abstract learning subsystem entities (e.g. "skill") into
 * their physical persistence boundaries.
 * Technical: Looks up the plural JSON filename using a static mapping and joins
 * it with the configured index directory path.
 * Intent & Trade-offs: Hardcoding the mapping (INDEX_FILES) avoids filesystem 
 * sniffing and ensures no unexpected file types are accessed, optimizing security
 * and determinism.
 * Assumptions/Edge Cases: Expects a valid key from INDEX_FILES. Throws otherwise.
 *
 * @param {string} type — artifact type (memory, skill, exemplar, anti-pattern)
 * @returns {string} absolute path to the index JSON file
 * @throws {Error} if type is not recognized
 */
function indexPath(type) {
    const filename = INDEX_FILES[type];
    if (!filename) {
        throw new Error(
            `Failed to resolve index path for type '${type}'. ` +
            `The requested artifact type is not registered in index mapping. ` +
            `Pass one of the registered valid types: ${Object.keys(INDEX_FILES).join(", ")}.`
        );
    }
    return path.join(CONFIG.paths.indexes, filename);
}

/**
 * Read and parse an index file. Returns an empty array if the
 * file does not exist yet (first write bootstraps the file).
 *
 * Domain: The primary read interface for fetching learning components into memory.
 * Technical: Reads the file at `indexPath(type)` as UTF-8 and parses it as JSON.
 * Intent & Trade-offs: Performs a synchronous-style complete file parse instead
 * of stream-parsing. Appropriate for small local indexes (hundreds of items).
 * Assumptions/Edge Cases: If the file is missing (ENOENT), returns an empty 
 * array instead of failing, allowing initial bootstrapping of the system.
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
            `Failed to read index for type '${type}' at '${filePath}'. ` +
            `Underlying fs operation failed: ${err.message}. ` +
            `Verify the index file is not corrupted, is valid JSON, and has read permissions.`
        );
    }
}

/**
 * Append or update an entry in an index file.
 *
 * Domain: Acts as the primary write path for the learning database.
 * Technical: Reads the current JSON array, upserts the new entity matching 
 * by `id`, and writes back atomically. Enforces export-friendly metadata shapes 
 * during mutation so old components get "upgraded" to the rich schema format.
 * Intent & Trade-offs: Performs a full read-modify-write cycle instead of stream 
 * appends. For databases with thousands of items this would be slow, but for 
 * hundreds of local markdown snippets, it's safe and simple.
 * Assumptions/Edge Cases: If `entry` lacks fields like `confidence` or `createdAt`, 
 * it populates safe defaults.
 *
 * Written paths:
 *   - learning/indexes/<type>s.json — the updated JSON index array
 *
 * Failure behavior: Throws if readIndex fails with non-ENOENT error or
 * if writeText fails. Index may be left in a partially-updated state if
 * the write is interrupted (no atomic rename).
 *
 * @param {string} type  - Artifact type (memory, skill, exemplar, anti-pattern).
 * @param {object} entry - Index entry to append or update.
 * @returns {Promise<void>}
 */
async function addToIndex(type, entry) {
    await ensureDirectory(CONFIG.paths.indexes);
    const entries = await readIndex(type);
    
    // Enforce rich metadata structure for exportability
    const richEntry = {
        id: entry.id,
        type: entry.type || type,
        title: entry.title || "Untitled",
        tags: entry.tags || [],
        confidence: entry.confidence != null ? entry.confidence : 0.5,
        path: entry.path || "unknown",
        createdAt: entry.createdAt || new Date().toISOString(),
        supportingEvidence: entry.supportingEvidence || [],
        relatedArtifacts: entry.relatedArtifacts || []
    };
    
    // Remove old entry with same ID if replacing/merging
    const existingIdx = entries.findIndex((e) => e.id === entry.id);
    if (existingIdx >= 0) {
        entries[existingIdx] = richEntry;
    } else {
        entries.push(richEntry);
    }
    
    const filePath = indexPath(type);
    await writeText(filePath, JSON.stringify(entries, null, 2));
}

/**
 * Rebuild an index by scanning the artifact directory and parsing YAML front-matter.
 *
 * Domain: Self-healing synchronization for the learning database. If a developer 
 * deletes a markdown file or manually edits its YAML, this routine rebuilds the 
 * truth state.
 * Technical: Re-reads all `.md` files in the target folder, calls `parseFrontMatter`, 
 * extracts `id, type, title, tags, confidence` etc., and reconstructs reality.
 * Intent & Trade-offs: Rebuilding relies strictly on front-matter keys. If an 
 * artifact is malformed without an `id` block, it will be skipped entirely to 
 * prevent corrupting the JSON index.
 * Assumptions/Invariants: Only scans files ending in `.md`.
 *
 * Written paths:
 *   - learning/indexes/<type>s.json — the rebuilt JSON index array
 *
 * Failure behavior: Throws for unknown type. Returns empty array if the
 * artifact directory doesn't exist (ENOENT). Throws for other readdir or
 * readFile errors. Malformed files without an `id` field are silently skipped.
 *
 * @param {string} type - Artifact type.
 * @returns {Promise<object[]>} The rebuilt index entries.
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
            `Failed to rebuild index for artifact type '${type}'. ` +
            `The requested type does not have a mapped artifact directory. ` +
            `Ensure the caller uses a valid type: ${Object.keys(dirMap).join(", ")}.`
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
        throw new Error(
            `Failed to rebuild index for artifact type '${type}'. ` +
            `The directory underlying the index could not be read ('${dir}'): ${err.message}. ` +
            `Ensure the directory has valid read permissions for the Node process.`
        );
    }
    const mdFiles = files.filter((f) => f.endsWith(".md"));

    // Parse front-matter from each file and build index entries.
    const entries = [];
    for (const filename of mdFiles) {
        const filePath = path.join(dir, filename);
        try {
            const content = await fs.promises.readFile(filePath, "utf-8");
            const meta = parseFrontMatter(content);
            if (meta.id) {
                entries.push({
                    id:                 meta.id,
                    type:               meta.type || type,
                    title:              meta.title || filename,
                    tags:               meta.tags || [],
                    path:               filePath,
                    createdAt:          meta.createdAt || null,
                    confidence:         meta.confidence != null ? meta.confidence : null,
                    supportingEvidence: meta.supportingEvidence || [],
                    relatedArtifacts:   meta.relatedArtifacts || []
                });
            }
        } catch (err) {
            console.warn(
                `Failed to parse artifact during index rebuild. ` +
                `File '${filePath}' read or parse failed: ${err.message}. ` +
                `Ensure the markdown file is readable and contains valid YAML front-matter.`
            );
        }
    }

    // Write the rebuilt index.
    await ensureDirectory(CONFIG.paths.indexes);
    const filePath = indexPath(type);
    await writeText(filePath, JSON.stringify(entries, null, 2));
    return entries;
}

module.exports = { addToIndex, readIndex, rebuildIndex, parseFrontMatter, indexPath };
