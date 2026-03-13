/**
 * apprentice/summary-generator.js — High-level Summary and Prompt Packs
 *
 * Reads artifact indexes to generate high-level markdown summaries and
 * reusable prompt packs for external agents to consume directly.
 * 
 * Target directories:
 * - learning/summaries/
 * - learning/prompts/
 *
 * @module apprentice/summary-generator
 */

const path = require("path");
const CONFIG = require("./config");
const { readIndex } = require("./index-manager");
const { writeText, ensureDirectory } = require("./filesystem");

/**
 * Group an array of index artifacts by their discrete tags.
 * 
 * Domain: To auto-generate learning prompt packs, we need to cluster artifacts 
 * by their topic (keyword/tag) rather than chronologically or by type.
 * Technical: Iterates through all given artifacts, maintaining a Map where 
 * the key is the string tag and the value is an array of artifact references.
 * Intent & Trade-offs: A single artifact can appear in multiple tag buckets. 
 * This is intended, as cross-pollination of domains helps the prompt pack richness.
 * Assumptions/Edge Cases: Ignores items without a `tags` array.
 * 
 * @param {object[]} artifacts - Array of index metadata objects.
 * @returns {Map<string, object[]>} Mapping of tags to matching artifacts.
 */
function groupByTags(artifacts) {
    const map = new Map();
    for (const item of artifacts) {
        if (!item.tags) continue;
        for (const tag of item.tags) {
            if (!map.has(tag)) map.set(tag, []);
            map.get(tag).push(item);
        }
    }
    return map;
}

/**
 * Generate high-level markdown summaries from the knowledge base.
 * 
 * Domain: Produces human-readable roll-up reports of accumulated knowledge 
 * (e.g., Common Mistakes and Reliable Techniques) to give operators insight 
 * into what the Apprentice is learning. 
 * Technical: Reads the skill and anti-pattern indexes, sorts them by 
 * confidence desc, and writes Markdown files aggregating the top 10 items.
 * Intent & Trade-offs: Hardcoded to take standard output paths from config. 
 * Overwrites the existing summaries entirely on each run to reflect the latest state.
 * Assumptions/Invariants: Directory `CONFIG.paths.summaries` will be created if missing.
 * System relies on index manager's `readIndex` and file system's `writeText`.
 * 
 * @returns {Promise<void>}
 */
async function generateSummaries() {
    try {
        await ensureDirectory(CONFIG.paths.summaries);
    } catch (err) {
        throw new Error(
            `Failed to generate summaries. ` +
            `Could not create or access summary directory '${CONFIG.paths.summaries}': ${err.message}. ` +
            `Ensure directory permissions allow creation and writing.`
        );
    }
    
    const skills = await readIndex("skill");
    const antiPatterns = await readIndex("anti-pattern");
    
    // Summary 1: Common Mistakes (from Anti-Patterns)
    const mistakesBody = [
        `# Common CliUI Mistakes`,
        ``,
        `*Auto-generated summary of frequent failure patterns.* `,
        ``,
    ];
    
    if (antiPatterns.length === 0) {
        mistakesBody.push(`*No anti-patterns accumulated yet.*`);
    } else {
        const sortedAP = antiPatterns.sort((a, b) => b.confidence - a.confidence);
        for (const ap of sortedAP.slice(0, 10)) {
            mistakesBody.push(`## ${ap.title}`);
            mistakesBody.push(`- **Keywords**: ${ap.tags.join(", ")}`);
            mistakesBody.push(`- **Confidence**: ${ap.confidence.toFixed(2)}`);
            mistakesBody.push(`- **See Also**: ${ap.path}`);
            mistakesBody.push(``);
        }
    }
    
    try {
        await writeText(path.join(CONFIG.paths.summaries, "common-mistakes.md"), mistakesBody.join("\n"));
    } catch (err) {
        throw new Error(
            `Failed to write common-mistakes summary. ` +
            `Underlying file write operation rejected: ${err.message}. ` +
            `Check filesystem space and permissions in ${CONFIG.paths.summaries}.`
        );
    }

    // Summary 2: Reliable Techniques (from Skills)
    const techniquesBody = [
        `# Reliable CliUI Techniques`,
        ``,
        `*Auto-generated summary of proven operational recipes.* `,
        ``,
    ];
    
    if (skills.length === 0) {
        techniquesBody.push(`*No skills promoted yet.*`);
    } else {
        const sortedSkills = skills.sort((a, b) => b.confidence - a.confidence);
        for (const sk of sortedSkills.slice(0, 10)) {
            techniquesBody.push(`## ${sk.title}`);
            techniquesBody.push(`- **Applies when**: ${sk.tags.join(", ")}`);
            techniquesBody.push(`- **Confidence**: ${sk.confidence.toFixed(2)}`);
            techniquesBody.push(`- **See Also**: ${sk.path}`);
            techniquesBody.push(``);
        }
    }
    
    try {
        await writeText(path.join(CONFIG.paths.summaries, "reliable-techniques.md"), techniquesBody.join("\n"));
        console.log(`Generated summaries in ${CONFIG.paths.summaries}`);
    } catch (err) {
        throw new Error(
            `Failed to write reliable-techniques summary. ` +
            `Underlying file write operation rejected: ${err.message}. ` +
            `Check filesystem space and permissions in ${CONFIG.paths.summaries}.`
        );
    }
}

/**
 * Generate reusable prompt packs based on clustered knowledge.
 * 
 * Domain: Creates contextual knowledge blocks that can be injected into 
 * standard agent prompts. When a user request mentions a specific keyword 
 * (tag), the corresponding prompt pack provides proven techniques and insights.
 * Technical: Reads the memory index, clusters by tag, and takes the top 3 
 * most frequent tags. For each, it extracts up to 5 highest-confidence 
 * memories and formats them into a markdown prompt pack.
 * Intent & Trade-offs: Hardcoded limits (top 3 tags, top 5 insights) prevent 
 * the prompt packs from becoming too large and exceeding LLM context windows.
 * Assumptions/Edge Cases: Requires `CONFIG.paths.prompts` to be writable.
 * 
 * @returns {Promise<void>}
 */
async function generatePromptPacks() {
    try {
        await ensureDirectory(CONFIG.paths.prompts);
    } catch (err) {
        throw new Error(
            `Failed to generate prompt packs. ` +
            `Could not create or access prompts directory '${CONFIG.paths.prompts}': ${err.message}. ` +
            `Ensure directory permissions allow creation and writing.`
        );
    }
    
    const memories = await readIndex("memory");
    const tagMap = groupByTags(memories);
    
    // Sort tags by frequency
    const sortedTags = Array.from(tagMap.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 3); // top 3 tag clusters

    for (const [tag, items] of sortedTags) {
        if (items.length < 2) continue; // Only create pack if there's sufficient data
        
        const packName = `prompt-pack-${tag}.md`;
        
        const packBody = [
            `# Prompt Pack: ${tag}`,
            ``,
            `When assisting with tasks related to **${tag}**, consider the following accumulated knowledge:`,
            ``,
        ];
        
        // Add insights from highest confidence memories
        const topInsights = items.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
        for (const insight of topInsights) {
            packBody.push(`## ${insight.title}`);
            packBody.push(`(Confidence: ${insight.confidence.toFixed(2)})`);
            packBody.push(``);
            packBody.push(`- **Source**: ${insight.path}`);
            packBody.push(``);
        }
        
        packBody.push(`---\n*Use this pack to augment standard prompts when the word '${tag}' appears in user requests.*`);
        try {
            await writeText(path.join(CONFIG.paths.prompts, packName), packBody.join("\n"));
        } catch (err) {
            throw new Error(
                `Failed to write prompt pack for tag '${tag}'. ` +
                `Underlying file write operation rejected: ${err.message}. ` +
                `Check filesystem space and permissions in ${CONFIG.paths.prompts}.`
            );
        }
    }
    
    console.log(`Generated prompt packs in ${CONFIG.paths.prompts}`);
}

module.exports = {
    generateSummaries,
    generatePromptPacks,
    groupByTags
};
