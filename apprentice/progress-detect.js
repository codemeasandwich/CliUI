/**
 * apprentice/progress-detect.js — No-Progress Detection
 *
 * Detects when the multi-attempt loop is making no meaningful
 * progress. Checks three independent signals against the recent
 * attempt history to determine if the loop should stop early.
 *
 * Signals:
 *   1. Script similarity — identical generated scripts
 *   2. Screen similarity — identical normalized screen output
 *   3. Score stagnation — unchanged evaluator score
 *
 * @module apprentice/progress-detect
 */

const CONFIG = require("./config");

/**
 * Compute a simple similarity ratio between two strings.
 * Uses character-level comparison after trimming. Returns a
 * value between 0.0 (completely different) and 1.0 (identical).
 *
 * This is intentionally simple — we only need to detect obvious
 * stalls, not subtle semantic similarity.
 *
 * @param {string} a — first string
 * @param {string} b — second string
 * @returns {number} similarity ratio 0.0–1.0
 */
function similarity(a, b) {
    const sa = (a || "").trim();
    const sb = (b || "").trim();

    // Identical strings (including both empty) → perfect match.
    if (sa === sb) return 1.0;

    // One empty, one not → zero similarity.
    if (sa.length === 0 || sb.length === 0) return 0.0;

    // Count matching characters at each position up to the
    // shorter string's length. Gives a rough positional match.
    const maxLen = Math.max(sa.length, sb.length);
    const minLen = Math.min(sa.length, sb.length);
    let matches = 0;
    for (let i = 0; i < minLen; i++) {
        if (sa[i] === sb[i]) matches++;
    }

    return matches / maxLen;
}

/**
 * Check whether the last N attempts show no meaningful progress.
 *
 * Examines the tail of the attempt history (up to noProgressCutoff
 * entries) and checks each signal. If any signal shows consistent
 * stagnation across the cutoff window, the loop should stop.
 *
 * @param {object[]} history — array of attempt result objects
 * @param {string}   history[].script     — generated script text
 * @param {string}   history[].screenText — normalized screen output
 * @param {number}   history[].score      — evaluator score
 * @returns {{ stalled: boolean, reason: string }}
 */
function detectNoProgress(history) {
    const cutoff = CONFIG.noProgressCutoff;

    // Need at least cutoff+1 attempts to compare a window of cutoff
    // pairs. E.g., cutoff=3 requires 4 attempts (3 consecutive pairs).
    if (history.length < cutoff + 1) {
        return { stalled: false, reason: "" };
    }

    // Take the last (cutoff + 1) attempts to form the comparison window.
    const window = history.slice(-(cutoff + 1));

    // Signal 1: Check if all consecutive script pairs are near-identical.
    // Threshold of 0.95 catches trivial whitespace-only changes.
    const scriptStalled = window.slice(1).every(
        (attempt, i) => similarity(attempt.script, window[i].script) > 0.95
    );
    if (scriptStalled) {
        return {
            stalled: true,
            reason: `Scripts near-identical for ${cutoff} consecutive attempts`,
        };
    }

    // Signal 2: Check if all consecutive screen outputs are near-identical.
    const screenStalled = window.slice(1).every(
        (attempt, i) => similarity(attempt.screenText, window[i].screenText) > 0.95
    );
    if (screenStalled) {
        return {
            stalled: true,
            reason: `Screen output near-identical for ${cutoff} consecutive attempts`,
        };
    }

    // Signal 3: Check if the evaluator score is unchanged across the window.
    const scores = window.map((a) => a.score);
    const allSameScore = scores.every((s) => s === scores[0]);
    if (allSameScore) {
        return {
            stalled: true,
            reason: `Evaluator score unchanged at ${scores[0]} for ${cutoff + 1} attempts`,
        };
    }

    return { stalled: false, reason: "" };
}

module.exports = { detectNoProgress, similarity };
