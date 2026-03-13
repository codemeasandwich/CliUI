/**
 * apprentice/prompts.js — Prompt Builders
 *
 * Constructs the full prompt text for each actor. The Apprentice
 * prompt includes task context plus CliUI repo references. The
 * Evaluator prompt includes the task and the real captured output
 * — never the generated code — to enforce the truth invariant.
 *
 * @module apprentice/prompts
 */

const CONFIG = require("./config");

/**
 * Build the Apprentice prompt.
 *
 * Tells the model what to build, terminal size to target, which
 * local repo files it may inspect, and that its response must be
 * a single runnable JS program with no commentary.
 *
 * @param {object} task — { request, wireframe?, cols?, rows? }
 * @returns {string} the full prompt text
 */
function buildApprenticePrompt(task) {
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

    return prompt;
}

/**
 * Build the Evaluator prompt.
 *
 * The evaluator receives the original task, normalized terminal screen
 * text, stderr, exit code, and timed-out flag. It does NOT receive the
 * generated script, raw ANSI, or anything the Apprentice said —
 * enforcing the primary truth invariant.
 *
 * The normalized screen text is the primary evaluation surface: it
 * represents what a user would actually see in the terminal.
 *
 * @param {object} task      — { request, wireframe?, cols?, rows? }
 * @param {object} runResult — { screenText, stderr, exitCode, timedOut }
 * @returns {string} the full evaluator prompt text
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

module.exports = { buildApprenticePrompt, buildEvaluatorPrompt };
