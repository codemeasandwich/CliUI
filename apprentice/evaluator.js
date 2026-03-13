/**
 * apprentice/evaluator.js
 *
 * Purpose: Evaluator Pipeline.
 * Responsibilities: Sends the task and captured output to the Evaluator actor, parses the structured JSON response, and handles parse failures gracefully.
 * Major sections:
 *   - evaluate: Orchestrates the LLM call and JSON extraction.
 * Important invariants: The evaluator must NEVER receive the generated script — only the text output.
 */

const { askEvaluator } = require("./gateway");

/**
 * Purpose: Evaluate a script's execution result through the Evaluator actor.
 * Inputs:
 *   - api: {object} Connected api-ape client for LLM communication.
 *   - prompt: {string} Pre-built evaluator prompt text containing context.
 * Outputs: {Promise<object>} Parsed evaluator verdict (score, verdict, critique, etc).
 * Scoring behavior: Relies on the external LLM to grade output from 0-10 based purely on visual and functional matching of task specs.
 * Merge logic: The result from this LLM provides the base subjective score for hybrid scoring.
 * Edge cases: Safely parses JSON extracted from markdown fences if standard object parsing fails.
 * Failure behavior: Catches network/API errors and JSON parsing errors, returning a structured error object with `_parse_error: true` so the episode can continue.
 */
async function evaluate(api, prompt) {
    let rawResponse;
    try {
        rawResponse = await askEvaluator(api, prompt);
    } catch (err) {
        console.warn(`[evaluator] API call failed: ${err.message}`);
        return {
            score: 0,
            verdict: "error",
            critique: `Evaluator API call failed: ${err.message}`,
            suggested_next_change: "Ensure the gateway is reachable and the provider is functioning.",
            _parse_error: true,
            _api_error: true
        };
    }

    // Attempt direct JSON parse first (ideal case).
    try {
        return JSON.parse(rawResponse);
    } catch (_directParseError) {
        // ... (rest handles extraction)
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (_extractedParseError) {
                // Fall through to error result below.
            }
        }

        // JSON extraction failed — return structured error result
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
