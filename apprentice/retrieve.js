/**
 * apprentice/retrieve.js — Learning Artifact Retrieval
 *
 * Loads relevant learning artifacts before each Apprentice attempt.
 * Scores index entries by keyword overlap with the task text, tag
 * relevance, and recency. Returns the top-scoring entries per type
 * with their full markdown bodies for prompt inclusion.
 *
 * Retrieval is intentionally simple for this phase: keyword matching
 * and tag overlap. More sophisticated retrieval (embedding similarity,
 * semantic search) can be added later without changing the interface.
 *
 * @module apprentice/retrieve
 */

const fs = require("fs");
const CONFIG = require("./config");
const { readIndex } = require("./index-manager");

/**
 * Tokenize text into searchable keyword terms.
 * Lowercases, splits on whitespace/punctuation, filters terms < 3 chars,
 * and deduplicates. Shared with distill.js logic but kept independent
 * to avoid coupling retrieval to distillation internals.
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
    return [...new Set(tokens)];
}

/**
 * Score how relevant an index entry is to a set of keywords.
 *
 * Relevance is computed from three signals:
 *   1. Title keyword overlap — words in the entry title matching keywords
 *   2. Tag overlap — entry tags matching keywords
 *   3. Confidence — the artifact's own confidence rating adds a small bonus
 *
 * Each matched keyword contributes 1 point. Title and tag matches are
 * weighted equally. Confidence adds a fractional bonus (0–1 range).
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

    // Count keyword overlaps in tags.
    const entryTags = (entry.tags || []).map((t) => t.toLowerCase());
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
 * Retrieve relevant learning artifacts for a task.
 *
 * Reads all four index types, scores each entry against the task
 * keywords, and returns the top-N results per type with their full
 * body text loaded for prompt inclusion.
 *
 * @param {object} task — { request, wireframe?, cols?, rows? }
 * @returns {Promise<object>} { skills, memories, exemplars, antiPatterns }
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

    // Load all four indexes (returns empty arrays if indexes don't exist).
    const [skillIndex, memoryIndex, exemplarIndex, antiPatternIndex] = await Promise.all([
        readIndex("skill"),
        readIndex("memory"),
        readIndex("exemplar"),
        readIndex("anti-pattern"),
    ]);

    /**
     * Score and sort entries, take top-N, load their bodies.
     *
     * @param {object[]} index — array of index entries
     * @param {number}   limit — max results to return
     * @returns {Promise<object[]>} top entries with body text loaded
     */
    async function topEntries(index, limit) {
        // Score all entries and filter to those with any relevance.
        const scored = index
            .map((entry) => ({ entry, score: scoreEntry(entry, keywords) }))
            .filter((s) => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        // Load the full body text for each top entry.
        const results = [];
        for (const { entry } of scored) {
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
    const [skills, memories, exemplars, antiPatterns] = await Promise.all([
        topEntries(skillIndex, maxSkills),
        topEntries(memoryIndex, maxMemories),
        topEntries(exemplarIndex, maxExemplars),
        topEntries(antiPatternIndex, maxAntiPatterns),
    ]);

    return { skills, memories, exemplars, antiPatterns };
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
        (retrieved.antiPatterns && retrieved.antiPatterns.length > 0)
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
    for (const type of ["skills", "memories", "exemplars", "antiPatterns"]) {
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
};
