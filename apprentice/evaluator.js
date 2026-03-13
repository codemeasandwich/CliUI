/**
 * apprentice/evaluator.js — Evaluator Pipeline
 *
 * Sends the task and captured output to the Evaluator actor,
 * parses the structured JSON response, and handles parse failures
 * gracefully by wrapping them in a structured error result.
 *
 * @module apprentice/evaluator
 */

const { askEvaluator } = require("./gateway");

/**
 * Evaluate a script's execution result through the Evaluator actor.
 *
 * Sends the original task and captured stdout/stderr/exitCode to the
 * Evaluator via the gateway. Expects JSON: { score, verdict, critique,
 * suggested_next_change }.
 *
 * If the Evaluator returns invalid JSON (e.g. wraps it in markdown),
 * we attempt to extract JSON from the response. If that fails, we
 * return a structured error result so the episode is still persisted.
 *
 * @param {object} api       — connected api-ape client
 * @param {string} prompt    — pre-built evaluator prompt text
 * @returns {Promise<object>} parsed evaluator verdict
 */
async function evaluate(api, prompt) {
    const rawResponse = await askEvaluator(api, prompt);

    // Attempt direct JSON parse first (ideal case).
    try {
        return JSON.parse(rawResponse);
    } catch (_directParseError) {
        // The evaluator may have wrapped JSON in markdown fences.
        // Try to extract the JSON object by finding { ... }.
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (_extractedParseError) {
                // Fall through to error result below.
            }
        }

        // JSON extraction failed — return structured error result
        // so the episode can still be saved with diagnostic info.
        console.warn(
            "[evaluator] Failed to parse evaluator response as JSON. " +
            "Saving raw response for manual inspection."
        );
        return {
            score: 0,
            verdict: "error",
            critique: "Evaluator response was not valid JSON.",
            suggested_next_change: "Retry with stricter JSON-only instruction.",
            _raw_response: rawResponse,
            _parse_error: true,
        };
    }
}

module.exports = { evaluate };
