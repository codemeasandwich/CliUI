/**
 * apprentice/distill.js — Episode Distillation Engine
 *
 * Analyzes a completed episode's attempt history and creates learning
 * artifacts: memories, exemplars, anti-patterns, and (conservatively)
 * skills. Called once after each episode completes.
 *
 * Distillation rules prioritize memory over skill when confidence is
 * limited. Skills are only created when evidence is strong: score ≥ 8
 * and the episode passed in ≤ 2 attempts.
 *
 * @module apprentice/distill
 */

const CONFIG = require("./config");
const {
    writeMemoryArtifact,
    writeSkillArtifact,
    writeExemplarArtifact,
    writeAntiPatternArtifact,
} = require("./artifact-writers");

/**
 * Extract searchable tags from a block of text. Tokenizes on
 * whitespace and punctuation, lowercases, deduplicates, and
 * filters to terms ≥ 3 characters that are likely meaningful.
 *
 * Domain-aware: retains common CliUI/terminal terms even if short.
 *
 * @param {string} text — raw text to extract tags from
 * @returns {string[]} deduplicated, lowercased keyword tags
 */
function extractTags(text) {
    if (!text) return [];

    // Split on whitespace and common punctuation boundaries.
    const tokens = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 3);

    // Deduplicate while preserving insertion order.
    return [...new Set(tokens)];
}

/**
 * Extract memory artifacts from evaluator critiques across attempts.
 * A memory captures a useful observation that may help future attempts.
 *
 * Trigger: any attempt with a critique containing actionable content
 * (more than 20 characters, indicating substantive feedback).
 *
 * Confidence scales with the score delta between the first and last
 * attempt — larger improvement signals more reliable observations.
 *
 * @param {object}   task    — { request, wireframe?, cols?, rows? }
 * @param {object[]} history — array of attempt result objects
 * @param {string}   source  — episode ID for evidence linking
 * @returns {Promise<object[]>} array of { type, id, path } records
 */
async function extractMemories(task, history, source) {
    const created = [];

    for (const attempt of history) {
        // Skip attempts without substantive evaluator feedback.
        const critique = attempt.evaluatorResult?.critique;
        if (!critique || critique.length < 20) continue;

        // Skip passing attempts — their value is captured as exemplars.
        if (attempt.score >= CONFIG.passThreshold) continue;

        // Compute confidence: higher when the critique gap is large (low score)
        // because strong failure feedback is more diagnostic.
        const confidence = Math.min(0.7, 0.4 + (1 - attempt.score / 10) * 0.3);

        // Combine task text and critique for tag extraction.
        const tags = extractTags(`${task.request} ${critique}`);

        const result = await writeMemoryArtifact({
            title: `Critique from attempt ${attempt.attemptNum}: ${critique.slice(0, 60)}`,
            tags,
            confidence,
            body: [
                `## Observation`,
                ``,
                `**Task:** ${task.request.slice(0, 120)}`,
                `**Attempt:** ${attempt.attemptNum}`,
                `**Score:** ${attempt.score}/10`,
                ``,
                `## Evaluator Critique`,
                ``,
                critique,
                ``,
                attempt.evaluatorResult?.suggested_next_change
                    ? `## Suggested Fix\n\n${attempt.evaluatorResult.suggested_next_change}`
                    : "",
            ].join("\n"),
            source,
        });

        created.push({ type: "memory", id: result.id, path: result.path });
    }

    return created;
}

/**
 * Extract an exemplar artifact from a passing episode. Saves the
 * best-scoring attempt's script as a reference solution.
 *
 * Trigger: episode has at least one attempt with score ≥ passThreshold.
 * Confidence: 0.8 base + 0.02 per score point above threshold.
 *
 * @param {string}   episodeId — unique episode identifier
 * @param {object}   task      — task payload
 * @param {object[]} history   — attempt history
 * @returns {Promise<object|null>} { type, id, path } or null
 */
async function extractExemplar(episodeId, task, history) {
    // Find the best-scoring attempt that meets the pass threshold.
    const passing = history
        .filter((a) => a.score >= CONFIG.passThreshold)
        .sort((a, b) => b.score - a.score);

    if (passing.length === 0) return null;

    const best = passing[0];
    const confidence = Math.min(1.0, 0.8 + (best.score - CONFIG.passThreshold) * 0.02);
    const tags = extractTags(task.request);

    const result = await writeExemplarArtifact({
        title: `Passing solution: ${task.request.slice(0, 60)}`,
        tags,
        confidence,
        episodeId,
        attemptNum: best.attemptNum,
        body: [
            `## Task`,
            ``,
            task.request,
            ``,
            `## Solution (Attempt ${best.attemptNum}, Score ${best.score}/10)`,
            ``,
            "```javascript",
            best.script,
            "```",
        ].join("\n"),
        source: episodeId,
    });

    return { type: "exemplar", id: result.id, path: result.path };
}

/**
 * Extract anti-pattern artifacts from repeated failure patterns.
 *
 * Trigger: two or more consecutive attempts share similar critiques
 * or the same low score, indicating a stuck failure pattern.
 *
 * Confidence: 0.6 base + 0.1 per additional repetition (capped at 0.9).
 *
 * @param {object}   task    — task payload
 * @param {object[]} history — attempt history
 * @param {string}   source  — episode ID for evidence linking
 * @returns {Promise<object[]>} array of { type, id, path } records
 */
async function extractAntiPatterns(task, history, source) {
    const created = [];

    // Need at least 2 attempts to detect repetition.
    if (history.length < 2) return created;

    // Check for repeated identical low scores.
    const failingAttempts = history.filter((a) => a.score < CONFIG.passThreshold);
    if (failingAttempts.length >= 2) {
        // Group consecutive failures with identical scores.
        const scoreGroups = [];
        let currentGroup = [failingAttempts[0]];

        for (let i = 1; i < failingAttempts.length; i++) {
            if (failingAttempts[i].score === currentGroup[0].score) {
                currentGroup.push(failingAttempts[i]);
            } else {
                if (currentGroup.length >= 2) scoreGroups.push(currentGroup);
                currentGroup = [failingAttempts[i]];
            }
        }
        if (currentGroup.length >= 2) scoreGroups.push(currentGroup);

        // Create anti-pattern for each group of repeated failures.
        for (const group of scoreGroups) {
            const repetitions = group.length;
            const confidence = Math.min(0.9, 0.6 + (repetitions - 2) * 0.1);
            const representativeCritique = group[0].evaluatorResult?.critique || "Unknown failure";
            const tags = extractTags(`${task.request} ${representativeCritique}`);

            const result = await writeAntiPatternArtifact({
                title: `Repeated failure (score ${group[0].score}): ${representativeCritique.slice(0, 50)}`,
                tags,
                confidence,
                body: [
                    `## Pattern`,
                    ``,
                    `${repetitions} consecutive attempts produced the same score of ${group[0].score}/10.`,
                    ``,
                    `## Representative Critique`,
                    ``,
                    representativeCritique,
                    ``,
                    `## Affected Attempts`,
                    ``,
                    group.map((a) => `- Attempt ${a.attemptNum}: score ${a.score}`).join("\n"),
                ].join("\n"),
                source,
            });

            created.push({ type: "anti-pattern", id: result.id, path: result.path });
        }
    }

    return created;
}

/**
 * Conservatively extract a skill artifact when evidence is strong.
 *
 * A skill represents a stable operational recipe — only created when:
 *   1. The episode passed (final score ≥ passThreshold)
 *   2. The final score is ≥ 8 (high quality)
 *   3. The episode passed in ≤ 2 attempts (efficient convergence)
 *
 * These strict criteria prevent premature skill promotion from
 * lucky one-off results or long grinding convergence paths.
 *
 * @param {string}   episodeId — episode identifier for evidence linking
 * @param {object}   task      — task payload
 * @param {object[]} history   — attempt history
 * @returns {Promise<object|null>} { type, id, path } or null
 */
async function maybeExtractSkill(episodeId, task, history) {
    // Gate 1: episode must have completed with a pass.
    if (history.length === 0) return null;
    const finalAttempt = history[history.length - 1];
    if (finalAttempt.score < CONFIG.passThreshold) return null;

    // Gate 2: final score must be high-quality (≥ 8).
    if (finalAttempt.score < 8) return null;

    // Gate 3: must have converged quickly (≤ 2 attempts).
    if (history.length > 2) return null;

    // All gates passed — extract a skill from the successful approach.
    const confidence = Math.min(1.0, 0.85 + (finalAttempt.score - 8) * 0.05);
    const tags = extractTags(task.request);

    const result = await writeSkillArtifact({
        title: `Technique: ${task.request.slice(0, 60)}`,
        tags,
        confidence,
        body: [
            `## Skill`,
            ``,
            `Proven approach for: ${task.request.slice(0, 200)}`,
            ``,
            `## Use when`,
            ``,
            `- The task involves requirements similar to: ${task.request.slice(0, 100)}...`,
            ``,
            `## Avoid when`,
            ``,
            `- The context differs significantly from the successful episode parameters.`,
            ``,
            `## Steps`,
            ``,
            `- [ ] Apply the reference implementation below.`,
            `- [ ] Adapt variables to match current context.`,
            ``,
            `## Validation checklist`,
            ``,
            `- [ ] Does the implementation match the reference structure?`,
            `- [ ] Are all necessary widgets rendering?`,
            ``,
            `## Known pitfalls`,
            ``,
            `- Adapting coordinate math requires care when terminal dimensions change.`,
            ``,
            `## Supporting Evidence`,
            ``,
            `- Episode: ${episodeId}`,
            `- Attempts: ${history.length}`,
            `- Final score: ${finalAttempt.score}/10`,
            ``,
            `## Reference Implementation`,
            ``,
            "```javascript",
            finalAttempt.script,
            "```",
        ].join("\n"),
        source: episodeId,
        extra: {
            supportingEvidence: [episodeId],
            relatedArtifacts: []
        }
    });

    return { type: "skill", id: result.id, path: result.path };
}

/**
 * Distill learning artifacts from a completed episode.
 *
 * Main entry point — called after each episode finishes. Runs all
 * four extraction routines and returns the full list of created
 * artifacts for metadata tracking.
 *
 * @param {string}   episodeId  — unique episode identifier
 * @param {object}   task       — original task payload
 * @param {object[]} history    — array of per-attempt result objects
 * @param {string}   stopReason — why the loop stopped
 * @returns {Promise<{ created: object[] }>} list of created artifacts
 */
async function distillEpisode(episodeId, task, history, stopReason) {
    const created = [];

    // Guard: nothing to distill from empty episodes.
    if (!history || history.length === 0) {
        return { created };
    }

    // Extract memories from evaluator critiques on failing attempts.
    const memories = await extractMemories(task, history, episodeId);
    created.push(...memories);

    // Extract exemplar from the best passing attempt.
    const exemplar = await extractExemplar(episodeId, task, history);
    if (exemplar) created.push(exemplar);

    // Extract anti-patterns from repeated failure patterns.
    const antiPatterns = await extractAntiPatterns(task, history, episodeId);
    created.push(...antiPatterns);

    // Conservatively extract a skill when evidence is strong.
    const skill = await maybeExtractSkill(episodeId, task, history);
    if (skill) created.push(skill);

    return { created };
}

module.exports = {
    distillEpisode,
    extractMemories,
    extractExemplar,
    extractAntiPatterns,
    maybeExtractSkill,
    extractTags,
};
