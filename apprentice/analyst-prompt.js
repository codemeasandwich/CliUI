/**
 * apprentice/analyst-prompt.js — Requirements Analyst Prompt Builder
 *
 * Constructs the prompt for the Requirements Analyst actor. The prompt
 * includes the full episode context (task, wireframe, all attempts with
 * their scripts, screen outputs, and evaluator critiques) plus a CliUI
 * capability inventory built by scanning the repository.
 *
 * Separated from analyst.js to stay under 200 NCLOC per file and to
 * mirror the existing pattern where prompts.js is separate from loop logic.
 *
 * @module apprentice/analyst-prompt
 */

const fs = require("fs");
const path = require("path");
const CONFIG = require("./config");

/**
 * Build a flat listing of available CliUI widgets and modules by scanning
 * the repository's lib/, docs/, examples/, and COOKBOOK.md.
 *
 * Gives the analyst LLM ground-truth about what the library actually
 * provides, so it can distinguish "this widget doesn't exist" from
 * "the Apprentice used it wrong."
 *
 * Uses synchronous reads because this runs once per analyst invocation
 * (rare event) and the file list is small.
 *
 * @returns {string} formatted capability inventory for prompt inclusion
 */
function buildCapabilitySummary() {
    const repoRoot = CONFIG.repoRoot;
    const sections = [];

    // Scan lib/ for widget and module files.
    const libDir = path.join(repoRoot, "lib");
    try {
        const libEntries = listDirRecursive(libDir, repoRoot);
        sections.push("### lib/ (widget and rendering modules)");
        sections.push(libEntries.join("\n"));
    } catch {
        sections.push("### lib/ — (not found or unreadable)");
    }

    // Scan examples/ for usage demonstrations.
    const examplesDir = path.join(repoRoot, "examples");
    try {
        const exEntries = listDirRecursive(examplesDir, repoRoot);
        sections.push("\n### examples/");
        sections.push(exEntries.join("\n"));
    } catch {
        sections.push("\n### examples/ — (not found or unreadable)");
    }

    // Read COOKBOOK.md table of contents (first 100 lines) for API surface.
    const cookbookPath = path.join(repoRoot, "COOKBOOK.md");
    try {
        const cookbook = fs.readFileSync(cookbookPath, "utf-8");
        const preview = cookbook.split("\n").slice(0, 100).join("\n");
        sections.push("\n### COOKBOOK.md (first 100 lines)");
        sections.push("```");
        sections.push(preview);
        sections.push("```");
    } catch {
        sections.push("\n### COOKBOOK.md — (not found)");
    }

    return sections.join("\n");
}

/**
 * Recursively list files in a directory, returning paths relative to
 * the repository root. Limited to 2 levels deep to keep output manageable.
 *
 * @param {string} dir      — absolute directory path to scan
 * @param {string} repoRoot — repository root for relative path computation
 * @param {number} depth    — current recursion depth (max 2)
 * @returns {string[]} array of "- relative/path" entries
 */
function listDirRecursive(dir, repoRoot, depth = 0) {
    if (depth > 2) return [];
    const entries = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        const relPath = path.relative(repoRoot, fullPath);
        if (item.isDirectory()) {
            entries.push(`- ${relPath}/`);
            entries.push(...listDirRecursive(fullPath, repoRoot, depth + 1));
        } else {
            entries.push(`- ${relPath}`);
        }
    }
    return entries;
}

/**
 * Build the Requirements Analyst prompt from a failed episode's data.
 *
 * The prompt instructs the analyst to:
 * 1. Compare the wireframe against the CliUI capability inventory
 * 2. Examine all attempt scripts to see what APIs they tried
 * 3. Examine all evaluator critiques to identify the consistent failure mode
 * 4. Classify the root cause and produce a structured requirement document
 *
 * Attempt scripts are truncated to the last 80 lines and screen outputs
 * to the last 24 lines to control prompt size with 10 attempts.
 *
 * @param {object}   task    — { request, wireframe?, cols?, rows? }
 * @param {object[]} history — array of per-attempt result objects
 * @returns {string} the complete analyst prompt
 */
function buildAnalystPrompt(task, history) {
    const cols = task.cols || CONFIG.terminal.cols;
    const rows = task.rows || CONFIG.terminal.rows;

    let prompt = `You are a Requirements Analyst investigating why a CliUI training episode persistently failed.

## Original Task

${task.request}

## Terminal Dimensions

${cols} columns × ${rows} rows
`;

    // Include wireframe if provided — this is the target the Apprentice couldn't reproduce.
    if (task.wireframe) {
        prompt += `
## Target Layout (ASCII Wireframe)

\`\`\`
${task.wireframe}
\`\`\`
`;
    }

    // Include all attempts with their scripts, outputs, and critiques.
    prompt += `\n## Attempt History (${history.length} attempts)\n`;
    for (const attempt of history) {
        prompt += `\n### Attempt ${attempt.attemptNum} — Score: ${attempt.score}/10, Exit Code: ${attempt.exitCode}\n`;

        // Script (truncated to last 80 lines to control prompt size).
        if (attempt.script) {
            const scriptLines = attempt.script.split("\n");
            const truncated = scriptLines.length > 80
                ? scriptLines.slice(-80).join("\n")
                : attempt.script;
            prompt += `\n**Script** (${scriptLines.length} lines${scriptLines.length > 80 ? ", last 80 shown" : ""}):\n\`\`\`javascript\n${truncated}\n\`\`\`\n`;
        }

        // Screen output (truncated to last 24 lines — one terminal page).
        if (attempt.screenText) {
            const screenLines = attempt.screenText.split("\n");
            const truncated = screenLines.length > 24
                ? screenLines.slice(-24).join("\n")
                : attempt.screenText;
            prompt += `\n**Screen Output** (${screenLines.length} lines${screenLines.length > 24 ? ", last 24 shown" : ""}):\n\`\`\`\n${truncated}\n\`\`\`\n`;
        }

        // Evaluator critique and suggestion.
        const critique = attempt.evaluatorResult?.critique;
        if (critique) {
            prompt += `\n**Evaluator Critique:** ${critique}\n`;
        }
        const suggestion = attempt.evaluatorResult?.suggested_next_change;
        if (suggestion) {
            prompt += `**Suggested Change:** ${suggestion}\n`;
        }
    }

    // Include the CliUI capability inventory so the analyst has ground-truth.
    prompt += `
## CliUI Repository — Available Capabilities

${buildCapabilitySummary()}

## Instructions

Analyze the episode above and determine the root cause of the persistent failure.

Classify the failure as one of:
- **capability_gap** — the CliUI library lacks a widget, feature, or rendering capability that the task requires
- **code_quality** — the required APIs exist but the Apprentice consistently used them incorrectly
- **prompt_clarity** — the task description is ambiguous, contradictory, or impossible to interpret

Return ONLY a JSON object (no markdown fences, no explanation) with exactly these fields:

{
  "classification": "<capability_gap | code_quality | prompt_clarity>",
  "problem_statement": "<what the wireframe requires that could not be produced>",
  "wireframe_excerpt": "<the specific visual element that failed, or empty string>",
  "capability_audit": {
    "available": ["<list of relevant existing widgets/modules>"],
    "needed": ["<list of capabilities the task requires>"],
    "gap": "<description of what is missing or insufficient>"
  },
  "recommendation": "<extend_existing | new_widget | api_improvement | apprentice_guidance | task_revision>",
  "recommendation_detail": "<specific recommendation with API suggestions or widget extension ideas>",
  "acceptance_criteria": ["<how to verify the gap is filled — wireframe-to-output matching tests>"]
}
`;

    return prompt;
}

module.exports = { buildAnalystPrompt, buildCapabilitySummary };
