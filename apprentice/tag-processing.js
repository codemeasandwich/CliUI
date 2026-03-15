/**
 * apprentice/tag-processing.js — Tag Utilities for Learning Artifacts
 *
 * Shared tag-level operations used by both distillation (writing artifacts)
 * and retrieval (querying artifacts). Centralizes stop-word filtering and
 * similarity computation so both paths produce and match consistent tags.
 *
 * Why a dedicated module: config.js holds tunables (numbers, paths). A
 * stop-word vocabulary is a domain artifact — stable, curated, and large
 * enough to warrant its own file. Jaccard similarity is a tag-level
 * operation that both retrieval and future consolidation need.
 *
 * @module apprentice/tag-processing
 */

/**
 * Curated set of English stop words and low-signal terms.
 *
 * Three categories:
 *   1. Function words — determiners, prepositions, conjunctions, pronouns.
 *      These appear in every artifact and carry zero retrieval signal.
 *   2. Low-signal verbs — generic actions that describe every coding task.
 *      "using", "create", "build", "render" match everything, diluting scores.
 *   3. Low-signal nouns — terms that appear in nearly every evaluator critique
 *      ("file", "code", "output", "error", "program"). These inflate tag
 *      overlap between unrelated artifacts because all critiques use them.
 *
 * Domain terms like "terminal", "dashboard", "chart", "widget", "galactica",
 * "cliui", "braille", "grid", "layout", "buffer", "sparkline", "gauge" are
 * deliberately excluded — they carry real retrieval signal.
 *
 * @type {Set<string>}
 */
const STOP_WORDS = new Set([
    // ── Function words (determiners, prepositions, conjunctions, pronouns) ──
    "the", "and", "that", "this", "with", "from", "for", "are", "was",
    "were", "been", "being", "have", "has", "had", "will", "would", "could",
    "should", "shall", "may", "might", "can", "but", "not", "nor", "yet",
    "also", "then", "than", "when", "where", "which", "what", "who", "whom",
    "how", "its", "our", "your", "his", "her", "their", "any", "all", "each",
    "every", "some", "most", "more", "less", "few", "many", "much", "very",
    "just", "only", "even", "still", "once", "both", "such", "into", "over",
    "under", "after", "before", "during", "between", "through", "about",
    "above", "below", "upon", "onto", "along", "across", "toward", "among",
    "within", "without", "until", "since", "while", "unless", "because",
    "although", "though", "whether", "either", "neither",

    // ── Low-signal verbs (appear in every task/critique, no retrieval value) ──
    "using", "showing", "render", "create", "build", "make", "does", "done",
    "did", "doing", "get", "got", "getting", "set", "let", "use", "used",
    "run", "running", "try", "trying", "see", "saw", "need", "needed",
    "keep", "kept", "take", "taken", "give", "given", "come", "came",
    "going", "went", "show", "shows",

    // ── Low-signal nouns (ubiquitous in evaluator critiques) ──
    "file", "code", "output", "program", "error", "errors", "text", "none",
    "met", "contains", "resulting", "rendered", "completely", "blank",
    "entirely", "instead", "valid", "actual", "indicating",
    "failure", "produced", "immediate", "caused", "causing", "confirmed",
    "confirming", "attempted", "suggests", "visible",
]);

/**
 * Remove stop words from a token array.
 *
 * Filters out tokens present in STOP_WORDS. Intended to be called after
 * tokenization (lowercase, split, length-filtered) but before deduplication
 * or storage. Safe to call on already-filtered arrays — idempotent.
 *
 * @param {string[]} tokens — lowercased keyword tokens
 * @returns {string[]} tokens with stop words removed (preserves order)
 */
function filterStopWords(tokens) {
    return tokens.filter((t) => !STOP_WORDS.has(t));
}

/**
 * Compute Jaccard similarity between two tag arrays.
 *
 * Jaccard index = |A ∩ B| / |A ∪ B|. Returns a value in [0, 1] where
 * 1.0 means identical sets and 0.0 means completely disjoint.
 *
 * Used by MMR retrieval to detect near-duplicate artifacts: entries with
 * Jaccard > 0.6 on cleaned tags are considered redundant observations.
 *
 * Edge cases:
 *   - Both empty → 1.0 (two empty sets are trivially identical)
 *   - One empty, one non-empty → 0.0 (no overlap possible)
 *
 * @param {string[]} tagsA — first tag array
 * @param {string[]} tagsB — second tag array
 * @returns {number} Jaccard similarity coefficient [0, 1]
 */
function jaccardSimilarity(tagsA, tagsB) {
    if (tagsA.length === 0 && tagsB.length === 0) return 1.0;
    if (tagsA.length === 0 || tagsB.length === 0) return 0.0;

    const setA = new Set(tagsA);
    const setB = new Set(tagsB);

    // Count elements in A that also appear in B.
    let intersection = 0;
    for (const t of setA) {
        if (setB.has(t)) intersection++;
    }

    // Union size = |A| + |B| - |A ∩ B| (avoids building a merged set).
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

module.exports = { STOP_WORDS, filterStopWords, jaccardSimilarity };
