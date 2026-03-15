/**
 * apprentice/retrieve.js — Learning Artifact Retrieval
 *
 * Loads relevant learning artifacts before each Apprentice attempt.
 * Scores index entries by keyword overlap with the task text, tag
 * relevance, and recency. Uses Maximal Marginal Relevance (MMR) to
 * select diverse results — preventing near-duplicate artifacts from
 * consuming all retrieval slots.
 *
 * Retrieval pipeline:
 *   1. Tokenize task text → keywords (with stop-word filtering)
 *   2. Score each index entry by keyword overlap + confidence bonus
 *   3. MMR selection: greedily pick entries that maximize relevance
 *      while penalizing similarity to already-selected entries
 *   4. Load full markdown bodies for selected entries
 *   5. Cross-type dedup: remove lower-priority artifacts when a
 *      higher-priority type covers the same failure (by tag overlap)
 *
 * @module apprentice/retrieve
 */

const fs = require("fs");
const CONFIG = require("./config");
const { readIndex } = require("./index-manager");
const { filterStopWords, jaccardSimilarity, computeAdaptiveWeight } = require("./tag-processing");

/**
 * Tokenize text into searchable keyword terms.
 * Lowercases, splits on whitespace/punctuation, filters terms < 3 chars,
 * removes stop words, and deduplicates. Uses the same stop-word vocabulary
 * as distill.js so tags created at write time match queries at read time.
 *
 * @param {string} text — raw text to tokenize
 * @returns {string[]} deduplicated lowercase keyword tokens
 */
function extractKeywords(text) {
    if (!text) return [];
    const tokens = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 3);
    return filterStopWords([...new Set(tokens)]);
}

/**
 * Score how relevant an index entry is to a set of keywords.
 *
 * Relevance is computed from three signals:
 *   1. Title keyword overlap — words in the entry title matching keywords
 *   2. Tag overlap — entry tags matching keywords
 *   3. Confidence — the artifact's own confidence rating adds a small bonus
 *
 * Each matched keyword contributes 1 point. Confidence adds a fractional
 * bonus (0–1 range × 0.5 weight) to prefer higher-quality entries.
 *
 * @param {object}   entry    — index entry { id, title, tags, confidence }
 * @param {string[]} keywords — search keywords from the task text
 * @returns {number} relevance score (higher = more relevant)
 */
function scoreEntry(entry, keywords) {
    if (!keywords.length) return 0;

    // Tokenize the entry title for keyword matching.
    const titleTokens = extractKeywords(entry.title || "");

    // Count keyword overlaps in title.
    let titleHits = 0;
    for (const kw of keywords) {
        if (titleTokens.includes(kw)) titleHits++;
    }

    // Count keyword overlaps in tags (apply stop-word filter to stored tags
    // for consistency — older artifacts may have unfiltered tags).
    const entryTags = filterStopWords((entry.tags || []).map((t) => t.toLowerCase()));
    let tagHits = 0;
    for (const kw of keywords) {
        if (entryTags.includes(kw)) tagHits++;
    }

    const baseScore = titleHits + tagHits;
    if (baseScore === 0) return 0;

    // Confidence adds a small bonus (0–1 range) to prefer higher-quality entries.
    const confidenceBonus = typeof entry.confidence === "number" ? entry.confidence : 0;

    return baseScore + confidenceBonus * 0.5;
}

/**
 * Read the full body text of an artifact from its markdown file.
 * Strips the YAML front-matter and returns just the body content.
 *
 * @param {object} entry — index entry with { path }
 * @returns {Promise<string>} artifact body text (empty string on error)
 */
async function loadArtifactBody(entry) {
    if (!entry.path) return "";
    try {
        const content = await fs.promises.readFile(entry.path, "utf-8");
        // Strip front-matter (--- ... ---) and return the body.
        const bodyMatch = content.match(/^---[\s\S]*?---\n\n?([\s\S]*)$/);
        return bodyMatch ? bodyMatch[1].trim() : content.trim();
    } catch (err) {
        // File may have been deleted or moved — degrade gracefully.
        if (err.code === "ENOENT") return "";
        throw new Error(
            `loadArtifactBody failed for '${entry.path}': ${err.message}. ` +
            `The artifact file may be corrupted or unreadable.`
        );
    }
}

/**
 * Remove cross-type duplicates from a retrieval result set.
 *
 * After per-type MMR selection, artifacts from different types may still
 * describe the same failure (e.g. a memory and an anti-pattern created
 * from the same episode critique). This function compares every cross-type
 * pair by Jaccard tag similarity and removes the lower-priority duplicate.
 *
 * Type priority (highest kept): skills > antiPatterns > memories > exemplars > requirements.
 * A skill supersedes a memory because it contains actionable instructions.
 * An anti-pattern supersedes a memory because its repetition signal is stronger.
 *
 * @param {object} result    — { skills, memories, exemplars, antiPatterns, requirements }
 * @param {number} threshold — Jaccard similarity above which two artifacts are duplicates (0 = disabled)
 * @returns {object} cleaned result with lower-priority duplicates removed
 */
function deduplicateAcrossTypes(result, threshold) {
    // Threshold 0 disables cross-type dedup entirely.
    if (!threshold || threshold <= 0) return result;

    // Priority determines which artifact survives when two are near-duplicates.
    // Higher number = higher priority = kept over lower.
    const TYPE_PRIORITY = {
        skills: 5,
        antiPatterns: 4,
        memories: 3,
        exemplars: 2,
        requirements: 1,
    };

    // Flatten all artifacts with their type label for pairwise comparison.
    const all = [];
    for (const type of Object.keys(TYPE_PRIORITY)) {
        for (const artifact of (result[type] || [])) {
            all.push({ artifact, type });
        }
    }

    // Track artifact IDs marked for removal.
    const removeIds = new Set();

    // Compare every cross-type pair. Within the same type, MMR already
    // handled diversity — only cross-type pairs need checking here.
    for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
            if (all[i].type === all[j].type) continue;

            const tagsA = filterStopWords((all[i].artifact.tags || []).map((t) => t.toLowerCase()));
            const tagsB = filterStopWords((all[j].artifact.tags || []).map((t) => t.toLowerCase()));
            const sim = jaccardSimilarity(tagsA, tagsB);

            if (sim > threshold) {
                // Remove the lower-priority artifact.
                const priA = TYPE_PRIORITY[all[i].type];
                const priB = TYPE_PRIORITY[all[j].type];
                if (priA >= priB) {
                    removeIds.add(all[j].artifact.id);
                } else {
                    removeIds.add(all[i].artifact.id);
                }
            }
        }
    }

    // Filter removed artifacts from each type array.
    if (removeIds.size === 0) return result;
    return {
        skills:       (result.skills || []).filter((a) => !removeIds.has(a.id)),
        memories:     (result.memories || []).filter((a) => !removeIds.has(a.id)),
        exemplars:    (result.exemplars || []).filter((a) => !removeIds.has(a.id)),
        antiPatterns: (result.antiPatterns || []).filter((a) => !removeIds.has(a.id)),
        requirements: (result.requirements || []).filter((a) => !removeIds.has(a.id)),
    };
}

/**
 * Retrieve relevant learning artifacts for a task.
 *
 * Reads all five index types, scores each entry against the task
 * keywords, and uses MMR (Maximal Marginal Relevance) to select
 * diverse top-N results per type. This prevents near-duplicate
 * artifacts from consuming all slots within a category.
 *
 * @param {object} task — { request, wireframe?, cols?, rows? }
 * @returns {Promise<object>} { skills, memories, exemplars, antiPatterns, requirements }
 *   Each array contains { id, title, tags, confidence, body } entries.
 */
async function retrieveForTask(task) {
    // Combine task text and optional wireframe for keyword extraction.
    const searchText = [task.request, task.wireframe || ""].join(" ");
    const keywords = extractKeywords(searchText);

    // Resolve retrieval limits from config (with defaults).
    const limits = CONFIG.retrieval || {};
    const maxSkills       = limits.maxSkills || 3;
    const maxMemories     = limits.maxMemories || 5;
    const maxExemplars    = limits.maxExemplars || 2;
    const maxAntiPatterns = limits.maxAntiPatterns || 3;
    const maxRequirements = limits.maxRequirements || 3;

    // MMR diversity weight: higher = stronger duplicate suppression.
    const diversityWeight = (limits.diversityWeight != null) ? limits.diversityWeight : 0.7;

    // Load all five indexes (returns empty arrays if indexes don't exist).
    const [skillIndex, memoryIndex, exemplarIndex, antiPatternIndex, requirementIndex] = await Promise.all([
        readIndex("skill"),
        readIndex("memory"),
        readIndex("exemplar"),
        readIndex("anti-pattern"),
        readIndex("requirement"),
    ]);

    /**
     * Score, rank, and diversify entries using Maximal Marginal Relevance.
     *
     * MMR greedily selects entries that maximize:
     *   mmrScore = relevanceScore - effectiveWeight * maxSimilarity(candidate, selected)
     *
     * The effectiveWeight is computed adaptively from the candidate pool by
     * computeAdaptiveWeight() — it increases when scores are clustered or tags
     * are homogeneous, and decreases when the pool is sparse. The config
     * diversityWeight serves as the baseline. When diversityWeight = 0,
     * MMR degrades to plain top-N by score.
     *
     * @param {object[]} index — array of index entries
     * @param {number}   limit — max results to return
     * @returns {Promise<object[]>} selected entries with body text loaded
     */
    async function topEntries(index, limit) {
        // Score all entries and filter to those with any relevance.
        const candidates = index
            .map((entry) => ({ entry, score: scoreEntry(entry, keywords) }))
            .filter((s) => s.score > 0);

        if (candidates.length === 0) return [];

        // Greedy MMR selection for diversity.
        // Compute adaptive weight from the candidate pool: adjusts diversity
        // pressure based on score clustering, pool depth, and tag homogeneity.
        // When scores are clustered, weight increases to break ties meaningfully.
        // When the pool is sparse, both weight and floor decrease to retain results.
        const selected = [];
        const remaining = [...candidates];
        const topScore = Math.max(...candidates.map((c) => c.score));
        const { effectiveWeight, mmrFloorMultiplier } = computeAdaptiveWeight(candidates, limit, diversityWeight);
        const mmrFloor = topScore * mmrFloorMultiplier;

        while (selected.length < limit && remaining.length > 0) {
            let bestIdx = 0;
            let bestMmr = -Infinity;

            for (let i = 0; i < remaining.length; i++) {
                const candidate = remaining[i];

                // Compute max Jaccard similarity to any already-selected entry.
                // Clean tags through stop-word filter for consistent comparison
                // (older artifacts may have unfiltered tags in the index).
                let maxSim = 0;
                const candidateTags = filterStopWords(
                    (candidate.entry.tags || []).map((t) => t.toLowerCase())
                );

                for (const sel of selected) {
                    const selTags = filterStopWords(
                        (sel.entry.tags || []).map((t) => t.toLowerCase())
                    );
                    const sim = jaccardSimilarity(candidateTags, selTags);
                    if (sim > maxSim) maxSim = sim;
                }

                // MMR formula: balance relevance against redundancy.
                // Uses adaptive weight computed from pool characteristics.
                const mmrScore = candidate.score - effectiveWeight * maxSim * candidate.score;
                if (mmrScore > bestMmr) {
                    bestMmr = mmrScore;
                    bestIdx = i;
                }
            }

            // Stop if the best remaining candidate is too redundant.
            // This prevents near-duplicate entries from filling all slots
            // when their information is already covered by selected entries.
            if (selected.length > 0 && bestMmr < mmrFloor) break;

            selected.push(remaining[bestIdx]);
            remaining.splice(bestIdx, 1);
        }

        // Load the full body text for each selected entry.
        const results = [];
        for (const { entry } of selected) {
            const body = await loadArtifactBody(entry);
            results.push({
                id: entry.id,
                title: entry.title,
                tags: entry.tags || [],
                confidence: entry.confidence,
                body,
            });
        }
        return results;
    }

    // Retrieve top entries for each artifact type in parallel.
    const [skills, memories, exemplars, antiPatterns, requirements] = await Promise.all([
        topEntries(skillIndex, maxSkills),
        topEntries(memoryIndex, maxMemories),
        topEntries(exemplarIndex, maxExemplars),
        topEntries(antiPatternIndex, maxAntiPatterns),
        topEntries(requirementIndex, maxRequirements),
    ]);

    // Cross-type deduplication: remove artifacts that duplicate findings
    // already covered by a higher-priority type (e.g. an anti-pattern
    // supersedes a memory from the same failure episode).
    const crossThreshold = (limits.crossTypeThreshold != null) ? limits.crossTypeThreshold : 0.65;
    return deduplicateAcrossTypes(
        { skills, memories, exemplars, antiPatterns, requirements },
        crossThreshold
    );
}

/**
 * Check whether a retrieval result set contains any artifacts.
 *
 * @param {object} retrieved — result from retrieveForTask
 * @returns {boolean} true if any artifacts were found
 */
function hasRetrievedContent(retrieved) {
    if (!retrieved) return false;
    return Boolean(
        (retrieved.skills && retrieved.skills.length > 0) ||
        (retrieved.memories && retrieved.memories.length > 0) ||
        (retrieved.exemplars && retrieved.exemplars.length > 0) ||
        (retrieved.antiPatterns && retrieved.antiPatterns.length > 0) ||
        (retrieved.requirements && retrieved.requirements.length > 0)
    );
}

/**
 * Collect all retrieved artifact IDs into a flat array.
 * Used for metadata tracking — records which artifacts were
 * consulted during each attempt.
 *
 * @param {object} retrieved — result from retrieveForTask
 * @returns {string[]} array of artifact IDs
 */
function retrievedIds(retrieved) {
    if (!retrieved) return [];
    const ids = [];
    for (const type of ["skills", "memories", "exemplars", "antiPatterns", "requirements"]) {
        if (retrieved[type]) {
            for (const entry of retrieved[type]) {
                if (entry.id) ids.push(entry.id);
            }
        }
    }
    return ids;
}

module.exports = {
    retrieveForTask,
    hasRetrievedContent,
    retrievedIds,
    scoreEntry,
    extractKeywords,
    loadArtifactBody,
    deduplicateAcrossTypes,
};
