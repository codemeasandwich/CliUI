/**
 * apprentice/prompts.js
 *
 * Purpose: Prompt Builders.
 * Responsibilities: Constructs the full prompt text for each actor (Apprentice, Evaluator).
 * Major sections:
 *   - formatLearningSection: Formats prior learning artifacts for context.
 *   - buildApprenticePrompt: Builds prompt for the Apprentice.
 *   - buildEvaluatorPrompt: Builds prompt for the Evaluator.
 * Important invariants: The Evaluator must never receive the generated script — only the task and the real captured output.
 */

const CONFIG = require("./config");
const { hasRetrievedContent } = require("./retrieve");

/**
 * Purpose: Format a concise learning section from retrieved artifacts for inclusion in the Apprentice prompt.
 * Inputs:
 *   - retrieved: {object|null} result from retrieveForTask (skills, memories, exemplars, etc)
 * Outputs: {string} formatted markdown section or empty string
 * Side effects: None
 * Failure behavior: Returns empty string if retrieved is null or empty.
 * Important assumptions: Output is kept short and truncated to prevent prompt bloat.
 */
function formatLearningSection(retrieved) {
    if (!hasRetrievedContent(retrieved)) return "";

    const sections = [];
    sections.push("\n## Prior Learning\n");
    sections.push("The following knowledge was retrieved from prior episodes. Use it as guidance, not as ground truth.\n");

    // Skills: numbered list of proven techniques.
    if (retrieved.skills && retrieved.skills.length > 0) {
        sections.push("### Skills\n");
        retrieved.skills.forEach((s, i) => {
            sections.push(`${i + 1}. **${s.title}** (confidence: ${s.confidence})`);
            // Include body but cap length to prevent bloat.
            if (s.body) sections.push(`   ${s.body.slice(0, 300)}\n`);
        });
    }

    // Memories: bullet list of observations.
    if (retrieved.memories && retrieved.memories.length > 0) {
        sections.push("### Observations\n");
        for (const m of retrieved.memories) {
            sections.push(`- **${m.title}** — ${(m.body || "").slice(0, 200)}`);
        }
        sections.push("");
    }

    // Anti-patterns: bullet list of mistakes to avoid.
    if (retrieved.antiPatterns && retrieved.antiPatterns.length > 0) {
        sections.push("### Mistakes to Avoid\n");
        for (const ap of retrieved.antiPatterns) {
            sections.push(`- **${ap.title}** — ${(ap.body || "").slice(0, 200)}`);
        }
        sections.push("");
    }

    // Exemplars: one reference example (truncated script).
    if (retrieved.exemplars && retrieved.exemplars.length > 0) {
        const ex = retrieved.exemplars[0];
        sections.push("### Reference Example\n");
        sections.push(`**${ex.title}** (confidence: ${ex.confidence})\n`);
        if (ex.body) sections.push(`${ex.body.slice(0, 500)}\n`);
    }

    return sections.join("\n");
}

/**
 * Purpose: Build the Apprentice prompt containing task instructions and retrieved learning context.
 * Inputs:
 *   - task: {object} { request, wireframe?, cols?, rows? }
 *   - retrievedLearning: {object|null} [optional] result from retrieveForTask
 * Outputs: {string} the full prompt text
 * Side effects: None
 * Failure behavior: Assumes defaults from CONFIG if task dimensions are missing.
 * Important assumptions: Instructs model to return a single runnable JS program with no commentary.
 */
function buildApprenticePrompt(task, retrievedLearning) {
    const cols = task.cols || CONFIG.terminal.cols;
    const rows = task.rows || CONFIG.terminal.rows;

    // List of repository paths the model may inspect for API reference.
    const repoPaths = [
        "README.md",
        "COOKBOOK.md",
        "docs/",
        "examples/",
        "lib/",
        "test/",
    ];

    let prompt = `You are an Apprentice developer. Your job is to write a JavaScript program that runs in the terminal.

## Task

${task.request}
`;

    // Include the optional ASCII wireframe if the task provides one.
    if (task.wireframe) {
        prompt += `
## Target Layout (ASCII Wireframe)

\`\`\`
${task.wireframe}
\`\`\`
`;
    }

    prompt += `
## Terminal Dimensions

The program will run in a terminal with ${cols} columns and ${rows} rows.

## Available Repository

You are working inside the CliUI repository (npm package: "galactica").
You may inspect the following paths for API documentation and examples:

${repoPaths.map((p) => `- ${p}`).join("\n")}

IMPORTANT: Use real CliUI / galactica APIs only. Do not invent or guess
APIs that are not documented in the files above. If you are unsure whether
an API exists, prefer simpler alternatives that you can confirm from the
repository contents.

Import the library with: const galactica = require('galactica')
Or with ES modules:      import galactica from 'galactica'

## Output Format

Return ONLY a single, complete, runnable JavaScript program.
Do NOT include explanations, commentary, or multiple alternatives.
The program must be executable with: bun run <filename>.js
`;

    // Append retrieved learning section if available.
    prompt += formatLearningSection(retrievedLearning || null);

    return prompt;
}

/**
 * Purpose: Build the Evaluator prompt.
 * Inputs:
 *   - task: {object} { request, wireframe?, cols?, rows? }
 *   - runResult: {object} { screenText, stderr, exitCode, timedOut }
 * Outputs: {string} the full evaluator prompt text
 * Side effects: None
 * Failure behavior: Casts missing truthy values in runResult to "(empty)" for safety.
 * Important assumptions: Enforces truth invariant by strictly excluding the generated script.
 */
function buildEvaluatorPrompt(task, runResult) {
    const cols = task.cols || CONFIG.terminal.cols;
    const rows = task.rows || CONFIG.terminal.rows;

    let prompt = `You are an Evaluator. Your job is to judge whether a program's real execution output satisfies a task.

## Original Task

${task.request}
`;

    if (task.wireframe) {
        prompt += `
## Target Layout (ASCII Wireframe)

\`\`\`
${task.wireframe}
\`\`\`
`;
    }

    prompt += `
## Terminal Dimensions

The target terminal is ${cols} columns × ${rows} rows.

## Captured Execution Output

### Terminal Screen (normalized final frame)
\`\`\`
${runResult.screenText || "(empty)"}
\`\`\`

### stderr
\`\`\`
${runResult.stderr || "(empty)"}
\`\`\`

### Exit Code: ${runResult.exitCode}
### Timed Out: ${runResult.timedOut ? "yes" : "no"}

## Instructions

Judge the captured output above against the original task requirements.
Focus on: structure, borders, title placement, spacing and alignment, faithfulness to the request, and visible completeness.
Do NOT speculate about the code that produced this output.
Base your judgment solely on what the output shows.

Return ONLY a JSON object (no markdown fences, no explanation) with exactly these fields:

{
  "score": <number 0-10>,
  "verdict": "<pass|fail|partial>",
  "critique": "<string explaining what worked and what did not>",
  "suggested_next_change": "<string describing the single most impactful change to try next>"
}
`;

    return prompt;
}

module.exports = { buildApprenticePrompt, buildEvaluatorPrompt, formatLearningSection };
