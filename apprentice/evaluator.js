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
 * Domain: Acts as the primary automated feedback loop for the learning 
 * system. Judges the quality of an Apprentice's script execution against 
 * the original goal, assigning a score and providing a critique.
 * Technical: Sends original task and captured stdout/stderr/exitCode 
 * to the Evaluator via the gateway. Parses the JSON response into `{ score, 
 * verdict, critique, suggested_next_change }`.
 * Intent & Trade-offs: Built resiliently. Language models occasionally fail 
 * to adhere strictly to JSON schemes (e.g., wrapping in markdown). The parser 
 * attempts extraction rather than failing outright, to save the expensive LLM token run.
 * Assumptions/Failures: If the Evaluator entirely fails to respond or returns 
 * unparseable content, we return a structured "error" result (`_parse_error: true`) 
 * so the episode lifecycle can safely continue and the attempt is recorded.
 *
 * @param {object} api    - Connected api-ape client for LLM communication.
 * @param {string} prompt - Pre-built evaluator prompt text containing context.
 * @returns {Promise<object>} Parsed evaluator verdict.
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
