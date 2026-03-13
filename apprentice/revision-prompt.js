/**
 * apprentice/revision-prompt.js — Revision Prompt Builder
 *
 * Constructs the prompt for attempts 2+ of the refinement loop.
 * Includes the original task, the prior script, the real captured
 * terminal output, stderr, exit code, and the Evaluator's critique
 * so the Apprentice can make an informed revision.
 *
 * The key invariant: every piece of feedback in the revision prompt
 * comes from actual execution and evaluation — never fabricated.
 *
 * @module apprentice/revision-prompt
 */

const CONFIG = require("./config");

/**
 * Build a revision prompt for a subsequent attempt.
 *
 * The prompt provides the Apprentice with a complete picture of what
 * happened on the previous attempt: the original task context, the
 * exact script it generated, what the terminal actually showed, any
 * errors that occurred, and the Evaluator's critique with a specific
 * suggestion for improvement.
 *
 * @param {object} task          — { request, wireframe?, cols?, rows? }
 * @param {object} priorAttempt  — artifacts from the previous attempt
 * @param {string} priorAttempt.script       — prior generated JS
 * @param {string} priorAttempt.screenText   — normalized screen output
 * @param {string} priorAttempt.stderr       — captured stderr
 * @param {number} priorAttempt.exitCode     — process exit code
 * @param {boolean} priorAttempt.timedOut    — whether script timed out
 * @param {object} priorAttempt.evaluatorResult — evaluator verdict
 * @param {number} attemptNum    — the upcoming attempt number (2+)
 * @returns {string} the full revision prompt text
 */
function buildRevisionPrompt(task, priorAttempt, attemptNum) {
    const cols = task.cols || CONFIG.terminal.cols;
    const rows = task.rows || CONFIG.terminal.rows;
    const evalResult = priorAttempt.evaluatorResult;

    // Build the prompt in sections so each piece of evidence is
    // clearly labeled and easy for the model to parse.
    let prompt = `You are an Apprentice developer. This is attempt ${attemptNum} at the task below.
Your previous attempt did not fully pass. You must revise your script based on the real execution results and evaluator feedback shown below.

## Original Task

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

## Your Previous Script (Attempt ${attemptNum - 1})

\`\`\`javascript
${priorAttempt.script}
\`\`\`

## Actual Execution Results

### Terminal Screen (normalized final frame)
\`\`\`
${priorAttempt.screenText || "(empty — nothing was rendered)"}
\`\`\`

### stderr
\`\`\`
${priorAttempt.stderr || "(empty)"}
\`\`\`

### Exit Code: ${priorAttempt.exitCode}
### Timed Out: ${priorAttempt.timedOut ? "yes" : "no"}

## Evaluator Feedback

- **Score:** ${evalResult.score}/10
- **Verdict:** ${evalResult.verdict}
- **Critique:** ${evalResult.critique}
- **Suggested Change:** ${evalResult.suggested_next_change || "none"}

## Instructions

Study the evaluator feedback and actual output carefully.
Fix the issues identified in the critique.
Focus especially on the suggested change.

Return ONLY a single, complete, runnable JavaScript program.
Do NOT include explanations, commentary, or multiple alternatives.
The program must be executable with: bun run <filename>.js

Import the library with: const galactica = require('galactica')
`;

    return prompt;
}

module.exports = { buildRevisionPrompt };
