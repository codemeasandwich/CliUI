/**
 * apprentice/analyst.js — Requirements Analyst Agent
 *
 * Diagnoses persistent training failures by determining whether they stem
 * from a capability gap in the CliUI library, code quality issues in the
 * Apprentice's output, or unclear task descriptions.
 *
 * The analyst is a conditional post-distillation actor that only activates
 * when specific trigger conditions indicate the failure is structural rather
 * than transient. When triggered, it sends the full episode context plus a
 * CliUI capability inventory to an LLM, parses the structured diagnosis,
 * and writes a feature requirement document to learning/requirements/.
 *
 * This closes the learning loop: future episodes see "Known Capability Gaps"
 * in their prompts and avoid attempting impossible tasks.
 *
 * @module apprentice/analyst
 */

const { askAnalyst } = require("./gateway");
const { buildAnalystPrompt } = require("./analyst-prompt");
const { writeRequirementArtifact } = require("./artifact-writers");
const { extractTags } = require("./distill");

/**
 * Determine whether the Requirements Analyst should activate for a
 * completed episode. All four conditions must be true:
 *
 * 1. stopReason is "no_progress" or "max_attempts" — the episode failed
 *    in a way that suggests a structural problem, not a transient error
 * 2. Best score across all attempts < 4 — persistently low quality output
 * 3. At least 3 attempts completed — enough evidence to judge, not a fluke
 * 4. exitCode === 0 on 2+ attempts — the code runs but output is wrong,
 *    suggesting the problem is not a crash bug but a capability mismatch
 *
 * @param {object[]} history    — array of per-attempt result objects
 * @param {string}   stopReason — why the episode loop terminated
 * @returns {boolean} true if all trigger conditions are met
 */
function shouldAnalyze(history, stopReason) {
    // Condition 1: episode ended due to structural failure, not success or crash.
    const structuralStop = stopReason === "no_progress" || stopReason === "max_attempts";
    if (!structuralStop) return false;

    // Condition 2: no attempt ever achieved a reasonable score.
    if (!history || history.length === 0) return false;
    const bestScore = Math.max(...history.map((a) => a.score));
    if (bestScore >= 4) return false;

    // Condition 3: enough attempts to establish a pattern.
    if (history.length < 3) return false;

    // Condition 4: code runs successfully on at least 2 attempts —
    // output is wrong, not crashing. This distinguishes capability
    // gaps from runtime errors.
    const cleanExits = history.filter((a) => a.exitCode === 0).length;
    if (cleanExits < 2) return false;

    return true;
}

/**
 * Parse the analyst LLM's response into a structured diagnosis object.
 *
 * Tries three extraction strategies in order:
 * 1. Direct JSON.parse of the full response
 * 2. Regex extraction of JSON from markdown code fences
 * 3. Fallback: create a minimal diagnosis from the raw text
 *
 * The fallback ensures the analyst never crashes the episode pipeline
 * even if the LLM returns unstructured text.
 *
 * @param {string} raw — raw LLM response text
 * @returns {object} structured diagnosis with classification and requirement fields
 */
function parseAnalystResponse(raw) {
    // Strategy 1: direct parse — the LLM returned clean JSON.
    try {
        const parsed = JSON.parse(raw.trim());
        return normalizeAnalysis(parsed);
    } catch {
        // Not valid JSON — try extraction from code fences.
    }

    // Strategy 2: extract JSON from markdown code fences (```json ... ``` or ``` ... ```).
    const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) {
        try {
            const parsed = JSON.parse(fenceMatch[1].trim());
            return normalizeAnalysis(parsed);
        } catch {
            // Malformed JSON inside fences — fall through to fallback.
        }
    }

    // Strategy 3: fallback — create minimal diagnosis from raw text.
    // Preserves the LLM's analysis as the problem statement so the
    // information is not lost even if parsing failed.
    return {
        classification: "unknown",
        problem_statement: raw.slice(0, 500),
        wireframe_excerpt: "",
        capability_audit: { available: [], needed: [], gap: "Could not parse analyst response" },
        recommendation: "unknown",
        recommendation_detail: "",
        acceptance_criteria: [],
    };
}

/**
 * Normalize a parsed analysis object by filling in missing fields with
 * safe defaults. Prevents downstream code from crashing on partial responses.
 *
 * @param {object} parsed — raw parsed JSON from the analyst LLM
 * @returns {object} normalized analysis with all required fields present
 */
function normalizeAnalysis(parsed) {
    const VALID_CLASSIFICATIONS = ["capability_gap", "code_quality", "prompt_clarity"];
    const classification = VALID_CLASSIFICATIONS.includes(parsed.classification)
        ? parsed.classification
        : "unknown";

    return {
        classification,
        problem_statement: parsed.problem_statement || "",
        wireframe_excerpt: parsed.wireframe_excerpt || "",
        capability_audit: {
            available: parsed.capability_audit?.available || [],
            needed: parsed.capability_audit?.needed || [],
            gap: parsed.capability_audit?.gap || "",
        },
        recommendation: parsed.recommendation || "unknown",
        recommendation_detail: parsed.recommendation_detail || "",
        acceptance_criteria: Array.isArray(parsed.acceptance_criteria)
            ? parsed.acceptance_criteria
            : [],
    };
}

/**
 * Run the full Requirements Analyst pipeline for a failed episode.
 *
 * Orchestrates: prompt building → LLM call → response parsing → artifact
 * writing. Returns the created artifact metadata and the root-cause
 * classification for logging by the caller.
 *
 * @param {object}   api       — connected api-ape client (WebSocket must be open)
 * @param {string}   episodeId — unique episode identifier for traceability
 * @param {object}   task      — original task payload { request, wireframe?, cols?, rows? }
 * @param {object[]} history   — array of per-attempt result objects
 * @returns {Promise<{ created: { type: string, id: string, path: string }, classification: string }>}
 */
async function analyzeFailure(api, episodeId, task, history) {
    // Step 1: build the analyst prompt with full episode context and capability inventory.
    const prompt = buildAnalystPrompt(task, history);

    // Step 2: send to the analyst LLM via the gateway.
    const raw = await askAnalyst(api, prompt);

    // Step 3: parse the structured response.
    const analysis = parseAnalystResponse(raw);

    // Step 4: build the requirement document body from the analysis.
    const body = formatRequirementBody(analysis, episodeId, task);

    // Step 5: extract tags from task and analysis for searchable indexing.
    const tags = extractTags(
        `${task.request} ${analysis.problem_statement} ${analysis.capability_audit?.gap || ""}`
    );

    // Step 6: compute confidence based on classification clarity.
    // capability_gap classifications are highest confidence because the analyst
    // had the full capability inventory to compare against.
    const confidenceMap = { capability_gap: 0.8, code_quality: 0.6, prompt_clarity: 0.5 };
    const confidence = confidenceMap[analysis.classification] || 0.4;

    // Step 7: persist the requirement artifact.
    const result = await writeRequirementArtifact({
        title: `${analysis.classification}: ${analysis.problem_statement.slice(0, 60)}`,
        tags,
        confidence,
        body,
        source: episodeId,
        classification: analysis.classification,
        episodeId,
    });

    return {
        created: { type: "requirement", id: result.id, path: result.path },
        classification: analysis.classification,
    };
}

/**
 * Format the requirement document body from a parsed analysis object.
 * Produces structured markdown suitable for both human review and
 * machine retrieval via the learning artifact system.
 *
 * @param {object} analysis  — normalized analysis from parseAnalystResponse
 * @param {string} episodeId — source episode for traceability
 * @param {object} task      — original task payload
 * @returns {string} formatted markdown body
 */
function formatRequirementBody(analysis, episodeId, task) {
    const lines = [
        `# Feature Requirement: ${analysis.problem_statement.slice(0, 80)}`,
        ``,
        `**Generated by:** Requirements Analyst`,
        `**Episode:** ${episodeId}`,
        `**Classification:** ${analysis.classification}`,
        `**Task:** ${task.request.slice(0, 120)}`,
        ``,
        `## Problem Statement`,
        ``,
        analysis.problem_statement,
        ``,
    ];

    // Include wireframe excerpt if the analyst identified the specific failing element.
    if (analysis.wireframe_excerpt) {
        lines.push(`## Target Wireframe (excerpt)`, ``, "```", analysis.wireframe_excerpt, "```", ``);
    }

    // Capability audit table showing what exists vs what's needed.
    lines.push(`## Existing Capabilities Audit`, ``);
    if (analysis.capability_audit.available.length > 0) {
        lines.push(`**Available:** ${analysis.capability_audit.available.join(", ")}`);
    }
    if (analysis.capability_audit.needed.length > 0) {
        lines.push(`**Needed:** ${analysis.capability_audit.needed.join(", ")}`);
    }
    if (analysis.capability_audit.gap) {
        lines.push(`**Gap:** ${analysis.capability_audit.gap}`);
    }
    lines.push(``);

    // Recommendation section.
    lines.push(`## Recommendation`, ``);
    lines.push(`**Type:** ${analysis.recommendation}`);
    if (analysis.recommendation_detail) {
        lines.push(``, analysis.recommendation_detail);
    }
    lines.push(``);

    // Acceptance criteria as a checklist.
    if (analysis.acceptance_criteria.length > 0) {
        lines.push(`## Acceptance Criteria`, ``);
        for (const criterion of analysis.acceptance_criteria) {
            lines.push(`- [ ] ${criterion}`);
        }
        lines.push(``);
    }

    return lines.join("\n");
}

module.exports = {
    shouldAnalyze,
    analyzeFailure,
    parseAnalystResponse,
    formatRequirementBody,
};
