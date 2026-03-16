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

/**
 * Compute context-adaptive diversity weight and MMR floor for retrieval.
 *
 * Static diversityWeight fails in three scenarios: clustered scores (ties
 * broken by iteration order), spread scores (over-penalizes strong-but-similar
 * candidates), and sparse pools (suppresses results when few exist). This
 * function adapts both the diversity weight and MMR floor based on three
 * observable signals from the candidate pool.
 *
 * Signals:
 *   1. Score concentration — coefficient of variation of relevance scores.
 *      Clustered scores → higher weight (use diversity to break ties).
 *      Spread scores → lower weight (scores already differentiate).
 *   2. Saturation ratio — candidates available vs slots requested.
 *      Sparse pool → lower weight and floor (don't suppress the few you have).
 *      Deep pool → full weight (plenty of alternatives to choose from).
 *   3. Tag homogeneity — mean pairwise Jaccard across sampled pairs.
 *      Identical tags → higher weight (tags don't differentiate, force diversity).
 *      Diverse tags → lower weight (tags already provide natural variety).
 *
 * Combined formula:
 *   adjustmentFactor = mean(scoreConcentration, saturation, meanJaccard)
 *   effectiveWeight  = clamp(baseline * (0.4 + 1.2 * adjustmentFactor), 0, 1)
 *
 * The 0.4–1.6 multiplier range means the baseline is scaled down to 40% at
 * minimum (spread scores, sparse pool, diverse tags) and up to 160% at maximum
 * (clustered scores, deep pool, homogeneous tags), clamped to [0, 1].
 *
 * @param {Array<{entry: {tags?: string[]}, score: number}>} candidates — scored entries
 * @param {number} limit — number of retrieval slots available
 * @param {number} baselineWeight — static diversityWeight from config (default 0.7)
 * @returns {{ effectiveWeight: number, mmrFloorMultiplier: number }}
 */
function computeAdaptiveWeight(candidates, limit, baselineWeight) {
    // Baseline 0 means diversity is explicitly disabled — skip computation.
    if (baselineWeight === 0) return { effectiveWeight: 0, mmrFloorMultiplier: 0.5 };

    // Single or no candidates — diversity is meaningless.
    if (candidates.length <= 1) return { effectiveWeight: baselineWeight, mmrFloorMultiplier: 0.5 };

    // ── Signal 1: Score concentration (coefficient of variation) ──
    // Low CV = scores are clustered = diversity should do more work.
    const scores = candidates.map((c) => c.score);
    const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    let scoreConcentration = 1.0;
    if (meanScore > 0) {
        const variance = scores.reduce((sum, s) => sum + (s - meanScore) ** 2, 0) / scores.length;
        const cv = Math.sqrt(variance) / meanScore;
        scoreConcentration = 1 / (1 + cv);
    }

    // ── Signal 2: Saturation ratio (candidates vs slots) ──
    // Sparse pool (ratio < 1) = lower weight to avoid over-suppression.
    // Cap at 3x to prevent absurdly large pools from inflating the signal.
    const saturation = Math.min(candidates.length / limit, 3) / 3;

    // ── Signal 3: Tag homogeneity (sampled mean Jaccard) ──
    // Compare tags across candidate pairs to measure redundancy in the pool.
    // For small pools compute all pairs; for larger pools sample 20 pairs
    // to keep computation bounded at O(1) rather than O(n^2).
    let meanJaccard = 0;
    const cleanedTags = candidates.map((c) =>
        filterStopWords((c.entry.tags || []).map((t) => t.toLowerCase()))
    );

    const pairs = [];
    if (candidates.length <= 6) {
        // All pairwise combinations for small pools.
        for (let i = 0; i < candidates.length; i++) {
            for (let j = i + 1; j < candidates.length; j++) {
                pairs.push([i, j]);
            }
        }
    } else {
        // Sample 20 random pairs for larger pools.
        for (let p = 0; p < 20; p++) {
            const i = Math.floor(Math.random() * candidates.length);
            let j = Math.floor(Math.random() * (candidates.length - 1));
            if (j >= i) j++;
            pairs.push([i, j]);
        }
    }

    if (pairs.length > 0) {
        let totalSim = 0;
        for (const [i, j] of pairs) {
            // Both-empty tags = no evidence of redundancy, treat as 0.
            if (cleanedTags[i].length === 0 && cleanedTags[j].length === 0) continue;
            totalSim += jaccardSimilarity(cleanedTags[i], cleanedTags[j]);
        }
        meanJaccard = totalSim / pairs.length;
    }

    // ── Combine signals into adjustment factor ──
    const adjustmentFactor = (scoreConcentration + saturation + meanJaccard) / 3;

    // Scale baseline by [0.4, 1.6] range, clamp to [0, 1].
    const raw = baselineWeight * (0.4 + 1.2 * adjustmentFactor);
    const effectiveWeight = isNaN(raw) ? baselineWeight : Math.min(Math.max(raw, 0), 1.0);

    // Adaptive floor: sparse pools get a lower floor (0.3) to retain results,
    // deep pools keep the standard floor (0.5) to suppress redundancy.
    const mmrFloorMultiplier = 0.3 + 0.2 * saturation;

    return { effectiveWeight, mmrFloorMultiplier };
}

module.exports = { STOP_WORDS, filterStopWords, jaccardSimilarity, computeAdaptiveWeight };
