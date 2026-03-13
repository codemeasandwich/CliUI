/**
 * apprentice/deterministic.js — Deterministic Output Evaluation
 *
 * Performs deterministic checks on the captured execution output (runResult)
 * against expectations defined in the task payload.
 *
 * Supported task expectations:
 * - requiredTexts: string[] (all must be present)
 * - forbiddenTexts: string[] (none must be present)
 * - expectsBorder: boolean (checks for box characters)
 * - expectsFooter: boolean (checks for text near bottom)
 * - titleMode: 'detached' | 'embedded' | 'either' (heuristics for title presence)
 * - titleText: string (specific title to look for)
 *
 * @module apprentice/deterministic
 */

/**
 * Purpose: Run deterministic checks on the execution result.
 * Inputs:
 *   - task: {object} Original task payload containing expectations
 *   - runResult: {object} Execution result { screenText, stderr, exitCode, timedOut }
 * Outputs: {object} { passedChecks: string[], failedChecks: string[] }
 * Scoring behavior: Evaluates execution output producing pass/fail signals. Does not output a numeric score itself.
 * Merge logic: The signals outputted are used by the hybrid scorer to penalize the base evaluator score.
 * Edge cases: Handles missing output, varied title formats, missing properties natively.
 * Failure behavior: Never throws; falls back gracefully for invalid checks.
 */
function runDeterministicChecks(task, runResult) {
    const passedChecks = [];
    const failedChecks = [];
    const screen = runResult.screenText || "";
    
    // Helper to evaluate a check
    const check = (name, condition, failureMessage) => {
        if (condition) {
            passedChecks.push(name);
        } else {
            failedChecks.push(`${name}: ${failureMessage}`);
        }
    };

    // 1. Minimum output presence
    check(
        "output_not_empty",
        screen.trim().length > 0,
        "Screen output is empty or only whitespace."
    );

    // 2. Runtime success
    check(
        "runtime_success",
        runResult.exitCode === 0 && !runResult.timedOut,
        `Process failed (exitCode: ${runResult.exitCode}, timedOut: ${runResult.timedOut})`
    );

    // 3. Required texts
    if (Array.isArray(task.requiredTexts)) {
        for (const reqText of task.requiredTexts) {
            check(
                `required_text_'${reqText}'`,
                screen.includes(reqText),
                `Missing required text: '${reqText}'`
            );
        }
    }

    // 4. Forbidden texts
    if (Array.isArray(task.forbiddenTexts)) {
        for (const forbidText of task.forbiddenTexts) {
            check(
                `forbidden_text_'${forbidText}'`,
                !screen.includes(forbidText),
                `Present forbidden text: '${forbidText}'`
            );
        }
    }

    // 5. Border characters
    if (task.expectsBorder) {
        // Look for at least a few common box-drawing characters
        const boxCharsRegex = /[┌└┐┘├┤┬┴┼─│]/;
        check(
            "expects_border",
            boxCharsRegex.test(screen),
            "Missing expected border characters."
        );
    }

    // 6. Title text
    if (task.titleText) {
        check(
            "title_text_present",
            screen.includes(task.titleText),
            `Missing expected title text: '${task.titleText}'`
        );
    }

    // 7. Footer text heuristic
    if (task.expectsFooter) {
        // Footer heuristic: look for non-empty text in the last 3 non-empty lines
        const lines = screen.split("\n").filter(l => l.trim().length > 0);
        const lastFewLines = lines.slice(-3).join("\n");
        // We look for alphanumeric characters which indicate text rather than just borders
        check(
            "expects_footer",
            /[A-Za-z0-9]/.test(lastFewLines),
            "Missing expected footer text near the bottom of the screen."
        );
    }

    // 8. Title mode heuristic
    if (task.titleMode === 'detached' || task.titleMode === 'embedded') {
        const lines = screen.split("\n");
        let firstContentRowIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().length > 0) {
                firstContentRowIndex = i;
                break;
            }
        }
        
        if (firstContentRowIndex !== -1) {
            const firstRow = lines[firstContentRowIndex];
            const hasBorder = /[┌┐─│]/.test(firstRow);
            
            if (task.titleMode === 'detached') {
                check(
                    "title_mode_detached",
                    !hasBorder && /[A-Za-z0-9]/.test(firstRow),
                    "Expected detached title, but first content row appears to be bordered or empty."
                );
            } else if (task.titleMode === 'embedded') {
                check(
                    "title_mode_embedded",
                    hasBorder,
                    "Expected embedded title, but first content row lacks border characters."
                );
            }
        } else {
             check(`title_mode_${task.titleMode}`, false, "No content found on screen to evaluate title mode.");
        }
    }

    // 9. Output line count within terminal bounds
    const maxRows = task.rows || 24;
    // Expected max lines from split is maxRows + 1 due to trailing newline from normalizeScreen
    const lineCount = screen.split("\n").length;
    check(
        "within_terminal_bounds",
        lineCount <= maxRows + 1,
        `Output line count (${lineCount}) exceeds terminal bounds (${maxRows}).`
    );

    return { passedChecks, failedChecks };
}

module.exports = { runDeterministicChecks };
