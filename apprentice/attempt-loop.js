/**
 * apprentice/attempt-loop.js
 *
 * Purpose: Multi-Attempt Orchestration Loop.
 * Responsibilities: Runs the core refinement loop: generate → execute → normalize → evaluate → (revise or stop).
 * Major sections:
 *   - runSingleAttempt: Single pass execution logic.
 *   - runAttemptLoop: Manages state across multiple attempts and checks stop conditions.
 * Important invariants: Each attempt persists its artifacts immediately for crash-safe inspection.
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
const { runDeterministicChecks } = require("./deterministic");
const { calculateHybridScore } = require("./hybrid-scorer");

/**
 * Purpose: Print a labeled, framed block of text to the console for verbose training observation.
 * Inputs:
 *   - label: {string} header text for the block (e.g. "TARGET WIREFRAME")
 *   - content: {string} multi-line text to display
 * Outputs: None (writes to stdout).
 * Side effects: Console output only.
 * Failure behavior: Prints "(empty)" if content is falsy.
 * Important assumptions: Uses box-drawing characters for visual separation in scrolling terminal logs.
 */
function logFramedBlock(label, content) {
    // Fixed frame width for consistent visual scanning in terminal logs.
    const width = 60;
    const header = `  ┌─ ${label} ${"─".repeat(Math.max(0, width - label.length - 5))}┐`;
    const footer = `  └${"─".repeat(width - 1)}┘`;
    const lines = (content || "(empty)").split("\n");

    console.log(header);
    for (const line of lines) {
        // Pad or truncate each line to fit inside the frame.
        const padded = line.length >= width - 4
            ? line.slice(0, width - 4)
            : line + " ".repeat(width - 4 - line.length);
        console.log(`  │ ${padded} │`);
    }
    console.log(footer);
}

/**
 * Purpose: Run a single execution attempt: prompt → extract → execute → normalize → evaluate.
 * Inputs:
 *   - api: {object} connected api-ape client
 *   - prompt: {string} apprentice prompt (base or revision)
 *   - task: {object} task payload { request, wireframe?, cols?, rows? }
 *   - attemptNum: {number} 1-based attempt integer
 * Outputs: {Promise<object>} attempt result with all execution artifacts and evaluator verdict
 * Side effects: Invokes local script execution, normalizes PTY/terminal outputs, triggers gateway LLM evaluations, and logs progress.
 * Failure behavior: Bubbles up unrecoverable script runner faults dynamically.
 * Important assumptions: Requires deterministic execution environments and evaluator prompts to function cleanly.
 */
async function runSingleAttempt(api, prompt, task, attemptNum) {
    const cols = task.cols || CONFIG.terminal.cols;
    const rows = task.rows || CONFIG.terminal.rows;

    // Step A — Ask the Apprentice (base or revision prompt).
    console.log(`  [attempt ${attemptNum}] Requesting code from Apprentice…`);
    const response = await askApprentice(api, prompt);
    console.log(`  [attempt ${attemptNum}] Received ${response.length} chars`);

    // Verbose: show the target wireframe on the first attempt so the
    // developer watching the logs knows what the apprentice is aiming for.
    // Only printed once because the wireframe is constant across attempts.
    if (attemptNum === 1 && task.wireframe) {
        logFramedBlock("TARGET WIREFRAME", task.wireframe);
    }

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

    // Verbose: show the captured screen output so the developer can
    // visually compare it against the target wireframe above.
    logFramedBlock(`CAPTURED OUTPUT (attempt ${attemptNum})`, screenText);

    // Step E — Evaluate through the Evaluator actor.
    // Attach screenText to runResult so the evaluator prompt builder
    // can access it via runResult.screenText.
    runResult.screenText = screenText;
    const evalPrompt = buildEvaluatorPrompt(task, runResult);
    const evaluatorResult = await evaluate(api, evalPrompt);

    // Phase 6: Deterministic Checks and Hybrid Scoring
    const detResult = runDeterministicChecks(task, runResult);
    const hybridResult = calculateHybridScore(evaluatorResult, detResult);

    console.log(
        `  [attempt ${attemptNum}] Score: ${hybridResult.score}/10` +
        ` — ${hybridResult.verdict} ` +
        `(${detResult.passedChecks.length} checks passed, ${detResult.failedChecks.length} failed)`
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
        score: hybridResult.score,
        verdict: hybridResult.verdict,
        evaluatorResult: hybridResult,
    };
}

/**
 * Purpose: Run the multi-attempt refinement loop for one episode.
 * Inputs:
 *   - api: {object} connected api-ape client
 *   - task: {object} task payload
 *   - episodeDir: {string} absolute path to the episode folder
 *   - disableRetrieval: {boolean} [default=false] if true, learning artifact retrieval is skipped
 * Outputs: {Promise<{ history: object[], stopReason: string, retrievedLearning: object|null }>} full attempt history and loop metadata
 * Side effects: Fetches learning artifacts, loops attempt generations, manages prompt snapshots, persists attempt artifacts serially to disk.
 * Failure behavior: Aborts the loop safely and returns "runner_error" if execution critically fails.
 * Important assumptions: Stops automatically on passing score threshold, no-progress detection, or max attempts reached.
 */
async function runAttemptLoop(api, task, episodeDir, disableRetrieval = false) {
    await ensureDirectory(episodeDir);
    const history = [];

    // Retrieve relevant learning artifacts once per episode.
    // The task doesn't change between attempts, so retrieval
    // results are reused across all attempts in the loop.
    let retrievedLearning = null;
    if (!disableRetrieval) {
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
    } else {
        console.log(`  [learning] Retrieval explicitly disabled for this run.`);
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
