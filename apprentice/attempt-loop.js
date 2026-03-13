/**
 * apprentice/attempt-loop.js — Multi-Attempt Orchestration Loop
 *
 * Runs the core refinement loop: generate → execute → normalize →
 * evaluate → (revise or stop). Each attempt persists its artifacts
 * immediately for crash-safe inspection.
 *
 * Stop conditions (checked in priority order):
 *   1. Pass threshold — evaluator score >= CONFIG.passThreshold
 *   2. No-progress — detected by progress-detect module
 *   3. Max attempts — CONFIG.maxAttempts reached
 *   4. Runner error — unrecoverable script execution failure
 *
 * @module apprentice/attempt-loop
 */

const path = require("path");
const CONFIG = require("./config");
const { ensureDirectory, writeText, attemptFilename } = require("./filesystem");
const { buildApprenticePrompt, buildEvaluatorPrompt } = require("./prompts");
const { buildRevisionPrompt } = require("./revision-prompt");
const { askApprentice } = require("./gateway");
const { extractScript, runScript } = require("./runner");
const { normalizeScreen } = require("./screen-normalize");
const { evaluate } = require("./evaluator");
const { saveAttempt } = require("./persistence");
const { detectNoProgress } = require("./progress-detect");
const { savePromptSnapshot } = require("./prompt-snapshot");
const { retrieveForTask, retrievedIds, hasRetrievedContent } = require("./retrieve");

/**
 * Run a single attempt: prompt → extract → execute → normalize → evaluate.
 *
 * @param {object} api       — connected api-ape client
 * @param {string} prompt    — apprentice prompt (base or revision)
 * @param {object} task      — task payload { request, wireframe?, cols?, rows? }
 * @param {number} attemptNum — 1-based attempt number
 * @returns {Promise<object>} attempt result with all artifacts
 */
async function runSingleAttempt(api, prompt, task, attemptNum) {
    const cols = task.cols || CONFIG.terminal.cols;
    const rows = task.rows || CONFIG.terminal.rows;

    // Step A — Ask the Apprentice (base or revision prompt).
    console.log(`  [attempt ${attemptNum}] Requesting code from Apprentice…`);
    const response = await askApprentice(api, prompt);
    console.log(`  [attempt ${attemptNum}] Received ${response.length} chars`);

    // Step B — Extract the runnable script from the response.
    const script = extractScript(response);

    // Step C — Save to temp/ and execute via PTY runner.
    const scriptPath = path.join(CONFIG.paths.temp, attemptFilename(attemptNum));
    await ensureDirectory(CONFIG.paths.temp);
    await writeText(scriptPath, script);

    console.log(`  [attempt ${attemptNum}] Running script…`);
    const runResult = await runScript(scriptPath, CONFIG.timeoutMs);
    console.log(
        `  [attempt ${attemptNum}] Exit code ${runResult.exitCode}` +
        (runResult.timedOut ? " (TIMED OUT)" : "") +
        ` (${runResult.durationMs}ms)`
    );

    // Step D — Normalize the raw ANSI output to final-frame text.
    const rawForNormalize = runResult.rawAnsi || runResult.stdout || "";
    const screenText = normalizeScreen(rawForNormalize, cols, rows);

    // Step E — Evaluate through the Evaluator actor.
    // Attach screenText to runResult so the evaluator prompt builder
    // can access it via runResult.screenText.
    runResult.screenText = screenText;
    const evalPrompt = buildEvaluatorPrompt(task, runResult);
    const evaluatorResult = await evaluate(api, evalPrompt);

    console.log(
        `  [attempt ${attemptNum}] Score: ${evaluatorResult.score}/10` +
        ` — ${evaluatorResult.verdict}`
    );

    // Return the complete attempt result with all artifacts.
    return {
        attemptNum,
        script,
        screenText,
        rawAnsi: runResult.rawAnsi || "",
        stdout: runResult.stdout,
        stderr: runResult.stderr,
        exitCode: runResult.exitCode,
        timedOut: runResult.timedOut,
        durationMs: runResult.durationMs,
        score: evaluatorResult.score,
        verdict: evaluatorResult.verdict,
        evaluatorResult,
    };
}

/**
 * Run the multi-attempt refinement loop for one episode.
 *
 * Attempt 1 uses the base Apprentice prompt. Subsequent attempts
 * use a revision prompt containing real output and evaluator feedback
 * from the previous attempt. Stops on pass, stall, max, or error.
 *
 * @param {object} api        — connected api-ape client
 * @param {object} task       — task payload
 * @param {string} episodeDir — absolute path to the episode folder
 * @returns {Promise<{ history: object[], stopReason: string, retrievedLearning: object|null }>}
 */
async function runAttemptLoop(api, task, episodeDir) {
    await ensureDirectory(episodeDir);
    const history = [];

    // Retrieve relevant learning artifacts once per episode.
    // The task doesn't change between attempts, so retrieval
    // results are reused across all attempts in the loop.
    let retrievedLearning = null;
    try {
        retrievedLearning = await retrieveForTask(task);
        if (hasRetrievedContent(retrievedLearning)) {
            const ids = retrievedIds(retrievedLearning);
            console.log(`  [learning] Retrieved ${ids.length} prior artifact(s)`);
        }
    } catch (err) {
        // Retrieval failure is non-fatal — proceed without prior learning.
        console.warn(`  [learning] Retrieval failed (proceeding without): ${err.message}`);
    }

    // Track which artifact IDs were retrieved so each attempt
    // can record them in its metadata for reuse visibility.
    const retrievedArtifactIds = retrievedLearning
        ? retrievedIds(retrievedLearning)
        : [];

    for (let attemptNum = 1; attemptNum <= CONFIG.maxAttempts; attemptNum++) {
        // Build the prompt — base for attempt 1, revision for 2+.
        let prompt;
        if (attemptNum === 1) {
            prompt = buildApprenticePrompt(task, retrievedLearning);
        } else {
            const prior = history[history.length - 1];
            prompt = buildRevisionPrompt(task, prior, attemptNum, retrievedLearning);
        }

        // Persist the compiled prompt for debugging and replay.
        // Saved before sending to the LLM so it's available even if
        // the LLM call fails, crashes, or times out.
        await savePromptSnapshot(episodeDir, attemptNum, prompt);

        // Run the attempt and persist artifacts immediately.
        let result;
        try {
            result = await runSingleAttempt(api, prompt, task, attemptNum);
        } catch (err) {
            // Unrecoverable error — log and stop the loop.
            console.error(`  [attempt ${attemptNum}] Runner error: ${err.message}`);
            return { history, stopReason: "runner_error", retrievedLearning };
        }

        // Persist this attempt's artifacts to the episode directory.
        // Include the list of retrieved artifact IDs for reuse visibility.
        await saveAttempt(episodeDir, attemptNum, result, retrievedArtifactIds);
        history.push(result);

        // Check stop condition 1: pass threshold.
        if (result.score >= CONFIG.passThreshold) {
            console.log(`  [loop] Pass threshold reached (${result.score} >= ${CONFIG.passThreshold})`);
            return { history, stopReason: "pass_threshold", retrievedLearning };
        }

        // Check stop condition 2: no-progress detection.
        const progress = detectNoProgress(history);
        if (progress.stalled) {
            console.log(`  [loop] No progress detected: ${progress.reason}`);
            return { history, stopReason: "no_progress", retrievedLearning };
        }
    }

    // Stop condition 3: max attempts exhausted.
    console.log(`  [loop] Max attempts (${CONFIG.maxAttempts}) reached`);
    return { history, stopReason: "max_attempts", retrievedLearning };
}

module.exports = { runAttemptLoop, runSingleAttempt };
