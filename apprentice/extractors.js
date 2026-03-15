/**
 * apprentice/extractors.js — Learning Artifact Extraction Functions
 *
 * Contains the four extraction routines that create learning artifacts
 * from a completed episode's attempt history. Split from distill.js
 * to keep each module under the 200 NCLOC limit.
 *
 * Each extractor has its own trigger conditions, confidence formula,
 * and artifact shape. All write through artifact-writers.js and update
 * the corresponding index automatically.
 *
 * @module apprentice/extractors
 */

const CONFIG = require("./config");
const {
    writeMemoryArtifact,
    writeSkillArtifact,
    writeExemplarArtifact,
    writeAntiPatternArtifact,
} = require("./artifact-writers");

/**
 * Extract memory artifacts from evaluator critiques across attempts.
 * A memory captures a useful observation that may help future attempts.
 *
 * Trigger: any failing attempt with a critique > 20 characters (substantive
 * feedback). Passing attempts are skipped — their value lives in exemplars.
 *
 * Confidence formula: min(0.7, 0.4 + (1 - score/10) * 0.3). Lower scores
 * produce higher confidence because severe failures yield more diagnostic
 * critiques. Capped at 0.7 to reflect single-observation uncertainty.
 *
 * @param {object}   task    — { request, wireframe?, cols?, rows? }
 * @param {object[]} history — array of attempt result objects
 * @param {string}   source  — episode ID for evidence linking
 * @param {Function} extractTags — tag extraction function from distill.js
 * @returns {Promise<object[]>} array of { type, id, path } records
 */
async function extractMemories(task, history, source, extractTags) {
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
 * Trigger: episode has at least one attempt with score >= passThreshold.
 * Confidence: 0.8 base + 0.02 per score point above threshold, capped at 1.0.
 *
 * @param {string}   episodeId — unique episode identifier
 * @param {object}   task      — task payload
 * @param {object[]} history   — attempt history
 * @param {Function} extractTags — tag extraction function from distill.js
 * @returns {Promise<object|null>} { type, id, path } or null
 */
async function extractExemplar(episodeId, task, history, extractTags) {
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
 * Trigger: two or more consecutive failing attempts share the same low
 * score, indicating a stuck failure pattern the system cannot escape.
 *
 * Confidence: 0.6 base + 0.1 per additional repetition beyond 2, capped at 0.9.
 * More repetitions = higher confidence that this is a real anti-pattern.
 *
 * @param {object}   task    — task payload
 * @param {object[]} history — attempt history
 * @param {string}   source  — episode ID for evidence linking
 * @param {Function} extractTags — tag extraction function from distill.js
 * @returns {Promise<object[]>} array of { type, id, path } records
 */
async function extractAntiPatterns(task, history, source, extractTags) {
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
 *   1. The episode passed (final score >= passThreshold)
 *   2. The final score is >= 8 (high quality)
 *   3. The episode passed in <= 2 attempts (efficient convergence)
 *
 * These strict criteria prevent premature skill promotion from
 * lucky one-off results or long grinding convergence paths.
 *
 * @param {string}   episodeId — episode identifier for evidence linking
 * @param {object}   task      — task payload
 * @param {object[]} history   — attempt history
 * @param {Function} extractTags — tag extraction function from distill.js
 * @returns {Promise<object|null>} { type, id, path } or null
 */
async function maybeExtractSkill(episodeId, task, history, extractTags) {
    // Gate 1: episode must have completed with a pass.
    if (history.length === 0) return null;
    const finalAttempt = history[history.length - 1];
    if (finalAttempt.score < CONFIG.passThreshold) return null;

    // Gate 2: final score must be high-quality (>= 8).
    if (finalAttempt.score < 8) return null;

    // Gate 3: must have converged quickly (<= 2 attempts).
    if (history.length > 2) return null;

    // All gates passed — extract a skill from the successful approach.
    const confidence = Math.min(1.0, 0.85 + (finalAttempt.score - 8) * 0.05);
    const tags = extractTags(task.request);

    const body = `## Skill\n\nProven approach for: ${task.request.slice(0, 200)}\n`
        + `\n## Use when\n\n- The task involves requirements similar to: ${task.request.slice(0, 100)}...\n`
        + `\n## Avoid when\n\n- The context differs significantly from the successful episode parameters.\n`
        + `\n## Steps\n\n- [ ] Apply the reference implementation below.\n- [ ] Adapt variables to match current context.\n`
        + `\n## Validation checklist\n\n- [ ] Does the implementation match the reference structure?\n- [ ] Are all necessary widgets rendering?\n`
        + `\n## Known pitfalls\n\n- Adapting coordinate math requires care when terminal dimensions change.\n`
        + `\n## Supporting Evidence\n\n- Episode: ${episodeId}\n- Attempts: ${history.length}\n- Final score: ${finalAttempt.score}/10\n`
        + `\n## Reference Implementation\n\n\`\`\`javascript\n${finalAttempt.script}\n\`\`\``;

    const result = await writeSkillArtifact({
        title: `Technique: ${task.request.slice(0, 60)}`,
        tags, confidence, body, source: episodeId,
        extra: { supportingEvidence: [episodeId], relatedArtifacts: [] }
    });

    return { type: "skill", id: result.id, path: result.path };
}

module.exports = {
    extractMemories,
    extractExemplar,
    extractAntiPatterns,
    maybeExtractSkill,
};
