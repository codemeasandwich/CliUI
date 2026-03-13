/**
 * apprentice/promotion.js — Learning Promotion and Cleanup Rules
 *
 * Rules engine for artifact lifecycle management:
 * - Merging duplicate memories and anti-patterns
 * - Promoting mature memories to skills
 * - Demoting or flagging unreliable skills
 *
 * Designed to run periodically (e.g., during export or batch distillation).
 * Relies on deterministic tag overlap and evidence counting.
 *
 * @module apprentice/promotion
 */

const { readIndex, addToIndex, rebuildIndex } = require("./index-manager");
const { writeSkillArtifact } = require("./artifact-writers");
const { writeText } = require("./filesystem");
const fs = require("fs");

/**
 * Calculate Jaccard similarity between two arrays of tags.
 * 
 * Domain: Enables the promotion engine to detect duplicate or highly related 
 * learning artifacts (memories/anti-patterns) by comparing their structural keywords.
 * Technical: Computes the intersection over union (IoU) of two tag sets.
 * Intent & Trade-offs: Jaccard is chosen over Levenshtein distance or embeddings 
 * because tags are already normalized and deterministic keyword overlap is sufficient 
 * and much faster to compute for small local datasets.
 * Assumptions: Assumes both input arrays contain strings. If both are empty, 
 * returns 1.0 (identical edge case). If one is empty, returns 0.0.
 *
 * @param {string[]} tagsA - First array of tags.
 * @param {string[]} tagsB - Second array of tags.
 * @returns {number} Score between 0.0 (no overlap) and 1.0 (perfect overlap).
 */
function tagSimilarity(tagsA, tagsB) {
    if (!tagsA.length && !tagsB.length) return 1.0;
    if (!tagsA.length || !tagsB.length) return 0.0;
    
    const setA = new Set(tagsA);
    const setB = new Set(tagsB);
    let intersection = 0;
    
    for (const t of setA) {
        if (setB.has(t)) intersection++;
    }
    
    const union = setA.size + setB.size - intersection;
    return intersection / union;
}

/**
 * Group artifacts based on tag overlap similarity score.
 *
 * Domain: Helps deduplicate the learning database, ensuring the trainer does 
 * not flood its prompt context with identical overlapping memories.
 * Technical: A naive O(N^2) clustering algorithm. Iterates over all artifacts
 * comparing pairs against a threshold. Matches are gathered into sub-arrays.
 * Intent & Trade-offs: Since artifact counts are expected to stay relatively 
 * low (hundreds, not millions), a simple greedy O(N^2) loop is preferred 
 * over a complex clustering tree for maintainability.
 * Assumptions/Edge Cases: Artifacts must have a `tags` array. `similarityThreshold` 
 * ensures only highly correlated items merge.
 * 
 * @param {object[]} artifacts - Array of artifact metadata objects containing tags.
 * @param {number} [similarityThreshold=0.5] - Minimum Jaccard score to group.
 * @returns {object[][]} Array of grouped artifacts.
 */
function groupSimilarArtifacts(artifacts, similarityThreshold = 0.5) {
    const groups = [];
    const used = new Set();
    
    for (let i = 0; i < artifacts.length; i++) {
        if (used.has(i)) continue;
        
        const currentGroup = [artifacts[i]];
        used.add(i);
        
        for (let j = i + 1; j < artifacts.length; j++) {
            if (used.has(j)) continue;
            
            const sim = tagSimilarity(artifacts[i].tags, artifacts[j].tags);
            if (sim >= similarityThreshold) {
                currentGroup.push(artifacts[j]);
                used.add(j);
            }
        }
        groups.push(currentGroup);
    }
    
    return groups;
}

/**
 * Draft a merge plan for duplicate memory artifacts.
 * 
 * Domain: Reusable knowledge degrades if the same finding is stored repeatedly. 
 * This identifies identical observations across different episodes and flags them 
 * to combine their "supporting evidence", strengthening the memory's weight.
 * Technical: Reads the memory index, clusters using `groupSimilarArtifacts` with 
 * a 0.6 threshold, and designates the highest-confidence artifact as the primary.
 * Intent & Trade-offs: Generates a plan instead of performing in-place edits to 
 * allow dry-runs and decoupling file manipulation from logic extraction.
 * Assumptions: Assumes memories have `confidence` metrics and `supportingEvidence` 
 * metadata arrays populated in their front-matter index.
 * 
 * @returns {Promise<object[]>} Array of merge plans containing primary, superseded, and combined evidence.
 */
async function getMemoryMergePlan() {
    const memories = await readIndex("memory");
    const groups = groupSimilarArtifacts(memories, 0.6);
    
    const merges = [];
    for (const group of groups) {
        if (group.length > 1) {
            // Pick the highest confidence memory as primary
            group.sort((a, b) => b.confidence - a.confidence);
            const primary = group[0];
            const others = group.slice(1);
            
            // Combine supporting evidence
            const allEvidence = new Set(primary.supportingEvidence || []);
            for (const item of group) {
                // If the older artifacts used 'source' instead of supportingEvidence
                // we'll need to fetch that from front-matter, but index rebuilding handles it.
                // Assuming supportingEvidence is populated or we use path as dummy.
                if (item.supportingEvidence) {
                    item.supportingEvidence.forEach(e => allEvidence.add(e));
                }
            }
            
            merges.push({
                primary,
                supersede: others,
                combinedEvidence: Array.from(allEvidence)
            });
        }
    }
    
    return merges;
}

/**
 * Draft a promotion plan for mature memories to become skills.
 * 
 * Domain: Skills are highly confident, executable recipes. Memories are raw
 * observations. This function decides when a memory has proven itself enough
 * (e.g., solved problems across multiple episodes) to be upgraded to a skill.
 * Technical: Iterates over the merge plan output. If the combined evidence
 * reaches 3+ episodes, or if the memory implies repository docs (tags), 
 * it flags it for promotion.
 * Intent & Trade-offs: We err on the side of caution. False positives in 
 * skills pollute the prompt worse than missing skills, so the threshold is high.
 * Assumptions/Edge Cases: Depends on `getMemoryMergePlan` to supply combined evidence.
 * 
 * @returns {Promise<object[]>} Array of promotion plans with source memory and reason.
 */
async function getPromotionPlan() {
    const merges = await getMemoryMergePlan();
    const promotions = [];
    
    for (const merge of merges) {
        const evidenceCount = merge.combinedEvidence.length;
        const isManuallyApproved = merge.primary.confidence >= 0.99;
        const hasDocSupport = merge.primary.tags.includes("docs") || merge.primary.tags.includes("source");
        
        if (evidenceCount >= 3 || isManuallyApproved || hasDocSupport) {
            promotions.push({
                sourceMemory: merge.primary,
                reason: evidenceCount >= 3 ? "Repeated across >= 3 episodes" 
                      : (isManuallyApproved ? "Manually approved" : "Supported by repository docs")
            });
        }
    }
    
    return promotions;
}

/**
 * Execute artifact cleanup and promotion routines.
 * 
 * Domain: Keeps the learning database healthy over time by actively merging 
 * concepts, promoting proven memories, and punishing unreliable skills. Called 
 * periodically (e.g., manually via CLI `--cleanup`, or before an export).
 * Technical: Orchestrates the merge and promotion plans. For each promotion, 
 * it provisions a new Skill artifact by calling `writeSkillArtifact`, synthesizing 
 * a markdown body that matches the enhanced skill template. Then flags underperforming 
 * skills via confidence checks (< 0.4).
 * Intent & Trade-offs: Performs writes. We intentionally synthesize a standard 
 * markdown structure here rather than calling the LLM, keeping the operation 
 * fast, offline, and deterministic.
 * Assumptions/Invariants: Indexes are updated synchronously by `writeSkillArtifact`.
 * 
 * @returns {Promise<object>} Audit report containing counts for promotions, merges, and demotions.
 */
async function runCleanupAndPromotion() {
    console.log("Running learning index cleanup and promotion rules...");
    
    // 1. Promote memories to skills
    const promotions = await getPromotionPlan();
    for (const promo of promotions) {
        console.log(`Promoting memory ${promo.sourceMemory.id} to skill. Reason: ${promo.reason}`);
        
        // Generate a new skill artifact derived from the memory.
        // We use the memory's title and tags.
        // In a real system, we might ask the LLM to synthesize this, but for now
        // we use a template based on the memory title.
        const result = await writeSkillArtifact({
            title: `Promoted Technique: ${promo.sourceMemory.title.slice(0, 50)}`,
            tags: promo.sourceMemory.tags,
            confidence: Math.min(1.0, promo.sourceMemory.confidence + 0.2), // Boost confidence
            body: [
                `## Skill (Promoted from Memory)`,
                ``,
                `Proven approach originally discovered as: ${promo.sourceMemory.title}`,
                ``,
                `## Use when`,
                ``,
                `- Encountering scenarios related to: ${promo.sourceMemory.tags.join(', ')}`,
                ``,
                `## Expected Outcome`,
                ``,
                `- Improved script evaluation score based on prior combined evidence.`,
                ``,
                `## Promotion Reason`,
                ``,
                `- ${promo.reason}`,
                ``,
                `## Known pitfalls`,
                ``,
                `- Ensure this heuristic remains valid as the codebase evolves.`,
                ``,
            ].join("\n"),
            source: "promotion_engine",
            extra: {
                supportingEvidence: [promo.sourceMemory.id],
                relatedArtifacts: [promo.sourceMemory.id]
            }
        });
        // Map the old memory to superseded by lowering its confidence deeply.
        // It remains in the index for provenance but avoids re-promotion.
        promo.sourceMemory.confidence = 0.1;
        await addToIndex("memory", promo.sourceMemory);
    }
    
    // 2. Merge anti-patterns
    const antiPatterns = await readIndex("anti-pattern");
    const apGroups = groupSimilarArtifacts(antiPatterns, 0.7);
    let apMergedCount = 0;
    
    for (const group of apGroups) {
        if (group.length > 1) {
            apMergedCount++;
            const primary = group[0];
            const others = group.slice(1);
            
            // Collect all supporting evidence logically
            const allEvidence = new Set(primary.supportingEvidence || []);
            others.forEach(o => {
                if (o.supportingEvidence) o.supportingEvidence.forEach(e => allEvidence.add(e));
                allEvidence.add(o.id);
            });
            
            primary.supportingEvidence = Array.from(allEvidence);
            primary.confidence = Math.min(1.0, primary.confidence + 0.1 * others.length);
            
            // Overwrite the primary in the index with merged evidence
            await addToIndex("anti-pattern", primary);
            
            // Demote the superseded duplicates
            for (const other of others) {
                other.confidence = 0.1;
                await addToIndex("anti-pattern", other);
            }
        }
    }
    if (apMergedCount > 0) {
        console.log(`Identified and merged ${apMergedCount} groups of duplicate anti-patterns.`);
    }
    
    // 3. Demote unreliable skills
    const skills = await readIndex("skill");
    let demotedCount = 0;
    for (const skill of skills) {
        // Flag skills with confidence < 0.4 for demotion 
        if (skill.confidence < 0.4) {
            console.log(`Demoting skill ${skill.id} (confidence ${skill.confidence.toFixed(2)} < 0.4)`);
            skill.confidence = 0.1;
            await addToIndex("skill", skill);
            demotedCount++;
        }
    }
    
    // We don't delete files here (destructive), just manipulate their index confidence
    // which effectively hides them from retrieval and export.
    return {
        promotions: promotions.length,
        antiPatternMerges: apMergedCount,
        demotedSkills: demotedCount
    };
}

module.exports = {
    tagSimilarity,
    groupSimilarArtifacts,
    getMemoryMergePlan,
    getPromotionPlan,
    runCleanupAndPromotion
};
