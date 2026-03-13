# Phase 6: Hybrid Scoring and Deterministic Evaluation Checks

This document explains the Hybrid Scoring mechanism introduced in Phase 6, which merges subjective LLM evaluation with objective deterministic checks to produce a robust, trustworthy final score for each Apprentice execution attempt.

## 1. Evaluator Score
The Evaluator score is a subjective assessment provided by an LLM (the Evaluator actor). It grades the captured, normalized terminal output from an execution attempt strictly on visual faithfulness, structural alignment, and completeness against the given task requirements. The evaluator score is an integer from 0 to 10.

However, relying purely on LLM judgment poses risks of "hallucinated passes," where an LLM mistakenly believes a task succeeded without verifying hard constraints.

## 2. Deterministic Checks
Deterministic checks provide hard boundaries by evaluating the execution result objectively. They parse the `runResult` (which includes `exitCode`, `timedOut`, `screenText`, and `stderr`) against concrete task expectations without AI involvement.

Checks include:
- `output_not_empty`: Ensures the screen text is not empty.
- `runtime_success`: Verifies the script completed successfully without crashing (exit code 0) or timing out.
- `required_text_'X'`: Ensures specific text required by the task is present.
- `forbidden_text_'X'`: Guarantees specified text is absent.
- `expects_border`: Ensures box-drawing characters are used.
- `expects_footer`: Uses heuristics to confirm footer text exists near the bottom.
- `title_mode_detached` / `title_mode_embedded`: Verifies the placement and framing of the title.
- `within_terminal_bounds`: Asserts the output line count does not exceed standard terminal capabilities.

## 3. Final Merged Score
The Hybrid Scorer calculates the final merged score by subtracting penalties from the base Evaluator LLM score. 

- Base score = Evaluator Score (0-10)
- Penalty of **-2** for standard missing requirements (e.g., missing specific text or boundaries).
- Severe penalty of **-4 / -5** for crashes, timeouts, or completely blank output.

The final score is clamped between 0 and 10.

**Edge Cases & Verdict Overrides:**
If the script suffers from a severe failure (like an execution crash), the maximum allowed hybrid score is hard-capped at 3. Even if the Evaluator hallucinates a perfect 10, the hybrid scorer will force a `fail` verdict and cap it to 3. 

Verdicts (`pass`, `partial`, `fail`) are dynamically re-evaluated and clamped based on the intersection of the numeric score and deterministic constraints. Crucially, the hybrid scorer strictly **downgrades** or clamps verdicts; it will never accidentally upgrade an LLM `fail` or `error` verdict into a `partial` or `pass` just because of penalty arithmetic.

## 4. Task Expectations
By supplying task expectations directly in the task payload, you provide parameters for deterministic evaluations:
- `requiredTexts`: Array of strings that must appear.
- `forbiddenTexts`: Array of strings that must be absent.
- `expectsBorder`: Boolean requesting border detection.
- `titleText`: Required title text string.
- `titleMode`: Defined as `'detached'`, `'embedded'`, or `'either'`.
- `expectsFooter`: Boolean requesting footer detection.

## 5. Examples of Passed and Failed Checks
**Passed Example:**
```json
"evaluatorScore": 9,
"passedChecks": [
  "output_not_empty",
  "runtime_success",
  "expects_border",
  "title_mode_detached"
],
"failedChecks": [],
"finalScore": 9,
"verdict": "pass"
```

**Failed Example:**
```json
"evaluatorScore": 10,
"passedChecks": ["output_not_empty"],
"failedChecks": [
  "runtime_success: Process failed (exitCode: 1, timedOut: false)",
  "required_text_'Dashboard': Missing required text: 'Dashboard'"
],
"finalScore": 3,
"verdict": "fail"
```
*(Notice how the Evaluator hallucinated a score of 10, but the hybrid scorer detected the crash and properly capped the total score to 3.)*

## 6. How to Inspect a Scored Attempt
When an attempt finishes, all artifacts (including the detailed scoring JSON) are persisted immediately to the episode's directory (e.g., `learning/episodes/episode_XXX_XXX/`).

To view the raw scoring details, inspect `attempt_NNN-evaluator.json`. This file reveals:
- Subjective critique.
- Base evaluator score and verdict.
- Lists of `passedChecks` and `failedChecks`.
- The final hybrid `score` and `verdict`.

## 7. Why Hybrid Scoring is Trustworthy
Hybrid scoring drastically increases trust compared to LLM judgment alone. An LLM may "hallucinate" an achievement or miss subtle flaws, such as a process exiting with a non-zero code after emitting text. 

By bounding subjective human-like visual critiques (LLM) within rigid, programmable constraints (Deterministic Checks), we achieve a highly reliable measurement loop that prevents regressions while maintaining flexibility for visual nuances.
