/**
 * apprentice/export.js — Learning Artifact Export
 *
 * Bundles selected skills, memories, exemplars, and summaries
 * into a portable pack for later agent use. This supports
 * transferring knowledge between different instances or agents.
 *
 * @module apprentice/export
 */

const fs = require("fs");
const path = require("path");
const CONFIG = require("./config");
const { ensureDirectory, timestamp } = require("./filesystem");

/**
 * Filter an index array by a minimum confidence threshold.
 * 
 * Domain: Ensures that only high-quality, proven knowledge is included 
 * in exported bundles, preventing the spread of low-value or raw insights.
 * Technical: Array filter using the `confidence` property.
 * Intent & Trade-offs: Simple synchronous filter. Keeps data processing decoupled 
 * from the asynchronous file reads.
 * Assumptions: Objects in the index have a numeric `confidence` property.
 * 
 * @param {object[]} index - Array of index metadata records.
 * @param {number} [threshold=0.5] - Minimum confidence required (0.0 to 1.0).
 * @returns {object[]} Filtered array.
 */
function filterByConfidence(index, threshold = 0.5) {
    return index.filter(entry => entry.confidence >= threshold);
}

/**
 * Copy files defined by index entries into a target directory.
 * 
 * Domain: Packages physical markdown artifacts into the flat bundle folder structure.
 * Technical: Iterates over paths in index entries, reads file contents, writes 
 * them to the destination directory, and mutates the in-memory entry path to be 
 * relative (`./filename`).
 * Intent & Trade-offs: We mutate the entry's path in memory to easily serialize 
 * it into the final `bundle-manifest.json` pointing to local files. Path rewriting 
 * avoids absolute path leakage to other machines.
 * Assumptions/Failures: Logs a warning if a file cannot be read, rather than 
 * failing the entire export.
 * 
 * @param {object[]} entries - Array of index metadata records to copy.
 * @param {string} targetDir - Absolute or relative destination path.
 * @returns {Promise<void>}
 */
async function copyArtifacts(entries, targetDir) {
    await ensureDirectory(targetDir);
    for (const entry of entries) {
        if (!entry.path) continue;
        try {
            const fileName = path.basename(entry.path);
            const content = await fs.promises.readFile(entry.path, "utf-8");
            await fs.promises.writeFile(path.join(targetDir, fileName), content, "utf-8");
            
            // Rewrite path in the entry to be relative to the bundle
            entry.path = `./${fileName}`;
        } catch (err) {
            console.warn(`Failed to copy artifact ${entry.path}: ${err.message}`);
        }
    }
}

/**
 * Export a curated bundle of learning artifacts to a target directory.
 * 
 * Domain: Acts as the primary export mechanism to share accumulated wisdom
 * with other agents or projects. Extracts out mature skills and memories
 * into a standalone portable folder package (`bundle-manifest.json`).
 * Technical: Reads all indexes, filters them aggressively by high confidence 
 * thresholds (Skills: 0.6, Memories: 0.7, Exemplars: 0.8), copies files into 
 * sub-directories, invokes summary generation to bundle fresh summaries/prompts, 
 * and writes a master manifest JSON.
 * Intent & Trade-offs: Bundles are entirely self-contained, meaning no external 
 * index links are preserved.
 * Assumptions/Invariants: Assumes `index-manager.js` and `summary-generator.js` 
 * are functioning.
 * 
 * @param {string} [outDir] - Output directory path. Defaults to `learning/exports/export_TIMESTAMP/`.
 * @returns {Promise<string>} Path to the finished export bundle directory.
 */
async function exportLearning(outDir) {
    const bundleDir = outDir || path.join("learning", "exports", `export_${timestamp()}`);
    await ensureDirectory(bundleDir);
    console.log(`\nExporting portable learning bundle to: ${bundleDir}`);

    // 1. Load indices
    const { readIndex } = require("./index-manager");
    const skills = await readIndex("skill");
    const memories = await readIndex("memory");
    const exemplars = await readIndex("exemplar");

    // 2. Select high-quality artifacts
    const selectedSkills = filterByConfidence(skills, 0.6);
    const selectedMemories = filterByConfidence(memories, 0.7); // require higher confidence for raw memories
    const selectedExemplars = filterByConfidence(exemplars, 0.8);

    // 3. Create subdirectories and copy files
    await copyArtifacts(selectedSkills, path.join(bundleDir, "skills"));
    await copyArtifacts(selectedMemories, path.join(bundleDir, "memories"));
    await copyArtifacts(selectedExemplars, path.join(bundleDir, "exemplars"));

    // 4. Generate updated summary files for the bundle
    const { generateSummaries, generatePromptPacks } = require("./summary-generator");
    await generateSummaries();
    await generatePromptPacks();
    
    // Copy summaries explicitly into the bundle
    const bundleSummariesDir = path.join(bundleDir, "summaries");
    await ensureDirectory(bundleSummariesDir);
    try {
        const smFiles = await fs.promises.readdir(CONFIG.paths.summaries);
        for (const file of smFiles) {
            await fs.promises.copyFile(
                path.join(CONFIG.paths.summaries, file), 
                path.join(bundleSummariesDir, file)
            );
        }
    } catch(err) {
        // ok if empty
    }

    const bundlePromptsDir = path.join(bundleDir, "prompts");
    await ensureDirectory(bundlePromptsDir);
    try {
        const pmFiles = await fs.promises.readdir(CONFIG.paths.prompts);
        for (const file of pmFiles) {
            await fs.promises.copyFile(
                path.join(CONFIG.paths.prompts, file), 
                path.join(bundlePromptsDir, file)
            );
        }
    } catch(err) {
        // ok if empty
    }

    // 5. Write a master bundle index
    const bundleManifest = {
        exportedAt: new Date().toISOString(),
        contents: {
            skills: selectedSkills,
            memories: selectedMemories,
            exemplars: selectedExemplars
        }
    };
    await fs.promises.writeFile(
        path.join(bundleDir, "bundle-manifest.json"),
        JSON.stringify(bundleManifest, null, 2),
        "utf-8"
    );

    console.log(`- Included ${selectedSkills.length} skills`);
    console.log(`- Included ${selectedMemories.length} memories`);
    console.log(`- Included ${selectedExemplars.length} exemplars`);
    console.log(`- Included summaries and prompt packs`);
    console.log(`Bundle export complete.\n`);
    
    return bundleDir;
}

module.exports = {
    exportLearning
};
