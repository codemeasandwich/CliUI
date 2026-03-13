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
 * Purpose: Calculate the hybrid score from the evaluator and deterministic results.
 * Inputs:
 *   - evaluatorResult: {object} Base LLM scoring payload: { score, verdict, critique, suggested_next_change }
 *   - detResult: {object} Deterministic check outcomes: { passedChecks, failedChecks }
 * Outputs: {object} Richer true hybrid scoring payload with detailed numeric scoring and verdict.
 * Scoring behavior: Base score is evaluator LLM score. Deducts -2 for each failed deterministic check, -4/-5 for severe failures, and clamps 0-10.
 * Merge logic: Subjective LLM reasoning merges with programmatic execution assertions to block "hallucinated passes".
 * Edge cases: Re-evaluates final verdicts (`pass`, `partial`, `fail`) dynamically if constraints force a score below validation thresholds.
 * Failure behavior: In cases of severe failure (e.g. process crash timeout or completely empty UI), score is hard-capped at 3 and verdict is forced to fail, ignoring optimistic LLM grades.
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
    
    // Determine the implied verdict tier from the final clamped score
    let scoreTier = "fail";
    if (finalScore >= 8) scoreTier = "pass";
    else if (finalScore >= 4) scoreTier = "partial";
    
    // Any deterministic failure strictly forbids a "pass",
    // regardless of the final numeric score.
    if (detResult.failedChecks.length > 0 && scoreTier === "pass") {
        scoreTier = "partial";
    }

    // Apply the downgrade. We only downgrade, never upgrade the evaluator's 
    // original verdict unless it's contradictory (e.g. LLM score 2 but verdict 'pass').
    const rank = v => v === "pass" ? 3 : (v === "partial" ? 2 : 1);
    if (rank(scoreTier) < rank(finalVerdict)) {
        finalVerdict = scoreTier;
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
