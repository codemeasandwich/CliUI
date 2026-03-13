/**
 * apprentice/hybrid-scorer.js — Hybrid Evaluation Scorer
 *
 * Merges the subjective Evaluator LLM score with the objective
 * deterministic checks and runtime status to produce a final,
 * bounded hybrid score and verdict.
 *
 * @module apprentice/hybrid-scorer
 */

/**
 * Calculate the hybrid score from the evaluator and deterministic results.
 * 
 * Score modifications:
 * - base score is evaluator score
 * - -2 for each failed deterministic check
 * - -4 for severe failures (e.g. timeout, non-zero exit code if not caught by checks)
 * - clamp to 0-10 range
 * 
 * @param {object} evaluatorResult - { score, verdict, critique, suggested_next_change }
 * @param {object} detResult - { passedChecks, failedChecks }
 * @returns {object} richer hybrid result object
 */
function calculateHybridScore(evaluatorResult, detResult) {
    let score = evaluatorResult.score;
    // ensure score is numeric
    if (typeof score !== "number" || isNaN(score)) {
        score = 0;
    }

    let penalty = 0;
    let hasCriticalFailure = false;

    // Apply baseline penalties for failed checks
    for (const fail of detResult.failedChecks) {
        if (fail.startsWith("runtime_success")) {
            penalty += 5; // Severe penalty for crashing/timing out
            hasCriticalFailure = true;
        } else if (fail.startsWith("output_not_empty")) {
            penalty += 4; // Output is empty
            hasCriticalFailure = true;
        } else {
            penalty += 2; // Standard missing requirement
        }
    }

    let finalScore = Math.max(0, Math.min(10, score - penalty));
    
    if (hasCriticalFailure) {
        finalScore = Math.min(finalScore, 3); // cap score to ensure fail
    }
    
    // Replay verdict logic based on the final score. 
    let finalVerdict = evaluatorResult.verdict;
    
    if (detResult.failedChecks.length > 0) {
        if (finalScore >= 8 && evaluatorResult.verdict === 'pass') {
            finalVerdict = "partial";
        } else if (finalScore < 8 && finalScore >= 4) {
            finalVerdict = "partial";
        } else if (finalScore < 4) {
            finalVerdict = "fail";
        }
    } else {
        // No failed deterministic checks
        if (finalScore >= 8 && evaluatorResult.verdict === 'fail') {
             // We stick to evaluator's verdict unless it's contradictory. For now, trust finalScore.
        }
    }

    return {
        evaluatorScore: Number(score.toFixed(1)),
        deterministicPenalty: penalty,
        finalScore: Number(finalScore.toFixed(1)),
        score: Number(finalScore.toFixed(1)), // For compatibility with older code expecting .score
        verdict: finalVerdict,
        evaluatorVerdict: evaluatorResult.verdict,
        passedChecks: detResult.passedChecks,
        failedChecks: detResult.failedChecks,
        critique: evaluatorResult.critique,
        suggested_next_change: evaluatorResult.suggested_next_change
    };
}

module.exports = { calculateHybridScore };
