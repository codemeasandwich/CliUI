/**
 * apprentice/retag.js — Retroactive Tag Cleanup Utility
 *
 * One-time maintenance utility that re-extracts tags from existing
 * learning artifacts using the improved extractTags function (with
 * stop-word filtering). Updates both the YAML front-matter in each
 * artifact file and the corresponding JSON index.
 *
 * Why this exists: artifacts created before stop-word filtering was
 * added have polluted tag sets (56+ tags including "the", "and",
 * "that"). This utility cleans them without losing any content.
 *
 * Usage:
 *   bun apprentice/retag.js              — retag all artifact types
 *   bun apprentice/retag.js memory       — retag only memories
 *   bun apprentice/retag.js anti-pattern — retag only anti-patterns
 *
 * @module apprentice/retag
 */

const fs = require("fs");
const path = require("path");
const CONFIG = require("./config");
const { extractTags } = require("./distill");
const { rebuildIndex } = require("./index-manager");

/**
 * Resolve the storage directory for an artifact type.
 * Reads CONFIG.paths at call time (not module load time) so that
 * test overrides of CONFIG.paths take effect correctly.
 *
 * @param {string} type — artifact type
 * @returns {string|undefined} directory path, or undefined for unknown type
 */
function resolveDir(type) {
    const dirs = {
        memory:         CONFIG.paths.memories,
        skill:          CONFIG.paths.skills,
        exemplar:       CONFIG.paths.exemplars,
        "anti-pattern": CONFIG.paths.antiPatterns,
        requirement:    CONFIG.paths.requirements,
    };
    return dirs[type];
}

/**
 * All registered artifact types for retagAll iteration.
 */
const ALL_TYPES = ["memory", "skill", "exemplar", "anti-pattern", "requirement"];

/**
 * Retag all artifacts of a given type.
 *
 * For each .md file in the type's directory:
 *   1. Read the file content
 *   2. Extract the title and body text
 *   3. Re-extract tags using the improved extractTags (with stop-words)
 *   4. Replace the tags line in the YAML front-matter
 *   5. Write the updated file back
 *
 * After all files are updated, rebuilds the JSON index so it reflects
 * the cleaned tags.
 *
 * @param {string} type — artifact type (memory, skill, exemplar, anti-pattern, requirement)
 * @returns {Promise<{ retagged: number, type: string }>} count of files retagged
 */
async function retagIndex(type) {
    const dir = resolveDir(type);
    if (!dir) {
        throw new Error(
            `Cannot retag unknown artifact type '${type}'. ` +
            `Valid types: ${ALL_TYPES.join(", ")}.`
        );
    }

    // List all markdown artifacts in the directory.
    let files;
    try {
        files = await fs.promises.readdir(dir);
    } catch (err) {
        if (err.code === "ENOENT") return { retagged: 0, type };
        throw err;
    }
    const mdFiles = files.filter((f) => f.endsWith(".md"));

    let retagged = 0;
    for (const filename of mdFiles) {
        const filePath = path.join(dir, filename);
        const content = await fs.promises.readFile(filePath, "utf-8");

        // Split front-matter from body.
        const fmMatch = content.match(/^(---\n[\s\S]*?\n---)\n\n?([\s\S]*)$/);
        if (!fmMatch) continue;

        const frontMatter = fmMatch[1];
        const body = fmMatch[2];

        // Extract title from front-matter for tag input.
        const titleMatch = frontMatter.match(/^title:\s*"(.*)"/m);
        const title = titleMatch ? titleMatch[1] : "";

        // Re-extract tags from title + body using improved extractTags.
        const newTags = extractTags(`${title} ${body}`);

        // Replace the tags line in front-matter.
        const updatedFm = frontMatter.replace(
            /^tags:\s*\[.*\]$/m,
            `tags: [${newTags.join(", ")}]`
        );

        // Write back only if tags actually changed.
        if (updatedFm !== frontMatter) {
            const updatedContent = `${updatedFm}\n\n${body}`;
            await fs.promises.writeFile(filePath, updatedContent, "utf-8");
            retagged++;
        }
    }

    // Rebuild the index so it picks up cleaned tags from front-matter.
    await rebuildIndex(type);

    return { retagged, type };
}

/**
 * Retag all artifact types. Convenience function that calls retagIndex
 * for every registered type and reports results.
 *
 * @returns {Promise<object[]>} array of { retagged, type } results
 */
async function retagAll() {
    const results = [];
    for (const type of ALL_TYPES) {
        const result = await retagIndex(type);
        results.push(result);
    }
    return results;
}

// CLI entry point: run directly with `bun apprentice/retag.js [type]`
if (require.main === module) {
    const type = process.argv[2];
    const run = type ? retagIndex(type) : retagAll();
    run.then((results) => {
        const items = Array.isArray(results) ? results : [results];
        for (const r of items) {
            console.log(`  [retag] ${r.type}: ${r.retagged} file(s) retagged`);
        }
        console.log("Retag complete.");
    }).catch((err) => {
        console.error(`Retag failed: ${err.message}`);
        process.exit(1);
    });
}

module.exports = { retagIndex, retagAll };
