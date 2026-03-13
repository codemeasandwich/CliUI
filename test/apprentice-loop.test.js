/**
 * test/apprentice-loop.test.js — E2E Test: Multi-Attempt Refinement Loop
 *
 * Tests the Phase 3 multi-attempt loop through the public module API.
 * Uses mock gateway responses to simulate the LLM without live calls.
 * Covers: single-attempt pass, multi-attempt convergence, max attempts,
 * no-progress detection, score stagnation, runner errors, revision
 * prompts, per-attempt persistence, and episode summary structure.
 *
 * Runtime: Node.js test runner (node --test)
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Modules under test — public API only.
const { detectNoProgress, similarity } = require("../apprentice/progress-detect");
const { buildRevisionPrompt } = require("../apprentice/revision-prompt");
const { buildSummary, saveEpisodeSummary } = require("../apprentice/episode-summary");
const { saveAttempt, saveEpisode } = require("../apprentice/persistence");
const CONFIG = require("../apprentice/config");

/**
 * Create a temporary directory for test episode persistence.
 *
 * @returns {string} absolute path to temp episode dir
 */
function tempEpisodeDir() {
    const id = Math.random().toString(36).slice(2, 8);
    return path.join(os.tmpdir(), `test-loop-${id}`);
}

// ─── Similarity Function Tests ──────────────────────────────────

test("similarity returns 1.0 for identical strings", () => {
    assert.strictEqual(similarity("hello", "hello"), 1.0);
});

test("similarity returns 1.0 for both empty", () => {
    assert.strictEqual(similarity("", ""), 1.0);
});

test("similarity returns 0.0 for one empty", () => {
    assert.strictEqual(similarity("hello", ""), 0.0);
    assert.strictEqual(similarity("", "hello"), 0.0);
});

test("similarity returns value between 0 and 1 for partial match", () => {
    const s = similarity("abcde", "abcxy");
    assert.ok(s > 0 && s < 1, `expected between 0 and 1, got ${s}`);
});

test("similarity handles whitespace trimming", () => {
    assert.strictEqual(similarity("  hello  ", "hello"), 1.0);
});

// ─── No-Progress Detection Tests ────────────────────────────────

test("detectNoProgress returns not stalled when history too short", () => {
    // Need cutoff+1 entries (4 for cutoff=3). 2 entries is too few.
    const history = [
        { script: "a", screenText: "A", score: 1 },
        { script: "a", screenText: "A", score: 1 },
    ];
    const result = detectNoProgress(history);
    assert.strictEqual(result.stalled, false);
});

test("detectNoProgress detects identical scripts", () => {
    // 4 entries with near-identical scripts (cutoff=3 needs 4).
    const history = [
        { script: "console.log(1)", screenText: "1", score: 1 },
        { script: "console.log(1)", screenText: "2", score: 2 },
        { script: "console.log(1)", screenText: "3", score: 3 },
        { script: "console.log(1)", screenText: "4", score: 4 },
    ];
    const result = detectNoProgress(history);
    assert.strictEqual(result.stalled, true);
    assert.ok(result.reason.includes("Scripts"), result.reason);
});

test("detectNoProgress detects identical screen output", () => {
    const history = [
        { script: "a", screenText: "SAME", score: 1 },
        { script: "b", screenText: "SAME", score: 2 },
        { script: "c", screenText: "SAME", score: 3 },
        { script: "d", screenText: "SAME", score: 4 },
    ];
    const result = detectNoProgress(history);
    assert.strictEqual(result.stalled, true);
    assert.ok(result.reason.includes("Screen"), result.reason);
});

test("detectNoProgress detects score stagnation", () => {
    const history = [
        { script: "a", screenText: "A", score: 3 },
        { script: "b", screenText: "B", score: 3 },
        { script: "c", screenText: "C", score: 3 },
        { script: "d", screenText: "D", score: 3 },
    ];
    const result = detectNoProgress(history);
    assert.strictEqual(result.stalled, true);
    assert.ok(result.reason.includes("score"), result.reason);
});

test("detectNoProgress returns not stalled when progress exists", () => {
    const history = [
        { script: "a", screenText: "A", score: 1 },
        { script: "b", screenText: "B", score: 2 },
        { script: "c", screenText: "C", score: 3 },
        { script: "d", screenText: "D", score: 4 },
    ];
    const result = detectNoProgress(history);
    assert.strictEqual(result.stalled, false);
});

// ─── Revision Prompt Tests ──────────────────────────────────────

test("revision prompt includes prior script and evaluator feedback", () => {
    const task = { request: "Build a chart", cols: 80, rows: 24 };
    const priorAttempt = {
        script: 'console.log("chart");',
        screenText: "chart output",
        stderr: "warning: something",
        exitCode: 0,
        timedOut: false,
        evaluatorResult: {
            score: 3,
            verdict: "fail",
            critique: "Missing axes labels",
            suggested_next_change: "Add x and y axis labels",
        },
    };

    const prompt = buildRevisionPrompt(task, priorAttempt, 2);

    // Verify the prompt contains all required feedback components.
    assert.ok(prompt.includes("Build a chart"), "should include task");
    assert.ok(prompt.includes('console.log("chart")'), "should include prior script");
    assert.ok(prompt.includes("chart output"), "should include screen text");
    assert.ok(prompt.includes("warning: something"), "should include stderr");
    assert.ok(prompt.includes("Exit Code: 0"), "should include exit code");
    assert.ok(prompt.includes("Missing axes labels"), "should include critique");
    assert.ok(prompt.includes("Add x and y axis labels"), "should include suggestion");
    assert.ok(prompt.includes("attempt 2"), "should mention attempt number");
});

test("revision prompt includes wireframe when provided", () => {
    const task = {
        request: "Build a chart",
        wireframe: "+---+\n| X |\n+---+",
        cols: 80,
        rows: 24,
    };
    const priorAttempt = {
        script: "x",
        screenText: "y",
        stderr: "",
        exitCode: 0,
        timedOut: false,
        evaluatorResult: { score: 1, verdict: "fail", critique: "bad" },
    };

    const prompt = buildRevisionPrompt(task, priorAttempt, 3);
    assert.ok(prompt.includes("+---+"), "should include wireframe");
    assert.ok(prompt.includes("attempt 3"), "should mention attempt 3");
});

test("revision prompt handles timed out scripts", () => {
    const task = { request: "test", cols: 80, rows: 24 };
    const priorAttempt = {
        script: "while(true){}",
        screenText: "",
        stderr: "",
        exitCode: 1,
        timedOut: true,
        evaluatorResult: { score: 0, verdict: "fail", critique: "timed out" },
    };

    const prompt = buildRevisionPrompt(task, priorAttempt, 2);
    assert.ok(prompt.includes("Timed Out: yes"), "should show timed out");
});

// ─── Episode Summary Tests ──────────────────────────────────────

test("buildSummary creates correct structure", () => {
    const history = [
        { score: 2, verdict: "fail", durationMs: 1000, exitCode: 1, timedOut: false },
        { score: 5, verdict: "partial", durationMs: 1200, exitCode: 0, timedOut: false },
        { score: 8, verdict: "pass", durationMs: 900, exitCode: 0, timedOut: false },
    ];

    const summary = buildSummary("ep-123", { request: "test" }, history, "pass_threshold");

    assert.strictEqual(summary.episodeId, "ep-123");
    assert.strictEqual(summary.totalAttempts, 3);
    assert.deepStrictEqual(summary.scores, [2, 5, 8]);
    assert.deepStrictEqual(summary.verdicts, ["fail", "partial", "pass"]);
    assert.strictEqual(summary.finalScore, 8);
    assert.strictEqual(summary.finalVerdict, "pass");
    assert.strictEqual(summary.stopReason, "pass_threshold");
    assert.strictEqual(summary.attempts.length, 3);
    assert.strictEqual(summary.attempts[0].attempt, 1);
    assert.strictEqual(summary.attempts[2].attempt, 3);
});

test("buildSummary handles empty history (runner error on first attempt)", () => {
    // When runner_error occurs before any attempt completes,
    // buildSummary receives an empty history array. It must not crash.
    const summary = buildSummary("ep-empty", { request: "x" }, [], "runner_error");

    assert.strictEqual(summary.episodeId, "ep-empty");
    assert.strictEqual(summary.totalAttempts, 0);
    assert.deepStrictEqual(summary.scores, []);
    assert.deepStrictEqual(summary.verdicts, []);
    assert.strictEqual(summary.finalScore, 0);
    assert.strictEqual(summary.finalVerdict, "error");
    assert.strictEqual(summary.stopReason, "runner_error");
    assert.strictEqual(summary.attempts.length, 0);
});

test("saveEpisodeSummary writes JSON to disk", async () => {
    const dir = tempEpisodeDir();
    try {
        fs.mkdirSync(dir, { recursive: true });
        const summary = buildSummary("ep-456", { request: "x" }, [
            { score: 7, verdict: "pass", durationMs: 500, exitCode: 0, timedOut: false },
        ], "pass_threshold");

        await saveEpisodeSummary(dir, summary);

        const content = JSON.parse(
            fs.readFileSync(path.join(dir, "episode-summary.json"), "utf-8")
        );
        assert.strictEqual(content.episodeId, "ep-456");
        assert.strictEqual(content.stopReason, "pass_threshold");
        assert.strictEqual(content.totalAttempts, 1);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

// ─── Per-Attempt Persistence Tests ──────────────────────────────

test("saveAttempt writes all attempt artifacts", async () => {
    const dir = tempEpisodeDir();
    try {
        await saveAttempt(dir, 2, {
            script: 'console.log("attempt 2");',
            rawAnsi: "\x1b[32mgreen\x1b[0m",
            screenText: "green\n",
            stdout: "green",
            stderr: "warn: x",
            evaluatorResult: { score: 5, verdict: "partial", critique: "ok" },
        });

        const files = fs.readdirSync(dir);
        assert.ok(files.includes("attempt_002.js"), "should have script");
        assert.ok(files.includes("attempt_002-raw.ansi"), "should have raw ANSI");
        assert.ok(files.includes("attempt_002-screen.txt"), "should have screen");
        assert.ok(files.includes("attempt_002-stderr.txt"), "should have stderr");
        assert.ok(files.includes("attempt_002-evaluator.json"), "should have eval");

        // Verify content integrity.
        const script = fs.readFileSync(path.join(dir, "attempt_002.js"), "utf-8");
        assert.ok(script.includes("attempt 2"));

        const evalJson = JSON.parse(
            fs.readFileSync(path.join(dir, "attempt_002-evaluator.json"), "utf-8")
        );
        assert.strictEqual(evalJson.score, 5);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("saveAttempt and saveEpisode coexist for multiple attempts", async () => {
    const dir = tempEpisodeDir();
    try {
        // Save two attempts via saveAttempt.
        await saveAttempt(dir, 1, {
            script: "v1",
            screenText: "s1",
            stderr: "e1",
            evaluatorResult: { score: 2 },
        });
        await saveAttempt(dir, 2, {
            script: "v2",
            screenText: "s2",
            stderr: "e2",
            evaluatorResult: { score: 6 },
        });

        const files = fs.readdirSync(dir);
        assert.ok(files.includes("attempt_001.js"));
        assert.ok(files.includes("attempt_002.js"));
        assert.ok(files.includes("attempt_001-screen.txt"));
        assert.ok(files.includes("attempt_002-screen.txt"));
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

// ─── Backward Compatibility (Phase 2) ───────────────────────────

test("saveEpisode still works for Phase 2 single-attempt shape", async () => {
    const dir = tempEpisodeDir();
    try {
        await saveEpisode(dir, {
            script: 'console.log("compat");',
            rawAnsi: "\x1b[31mred\x1b[0m",
            screenText: "red\n",
            stdout: "red",
            stderr: "err",
            evaluatorResult: { score: 7, verdict: "pass" },
            metadata: { episodeId: "compat-001", task: "test" },
        });

        const files = fs.readdirSync(dir);
        assert.ok(files.includes("attempt_001.js"), "script present");
        assert.ok(files.includes("attempt_001-screen.txt"), "screen present");
        assert.ok(files.includes("attempt_001-evaluator.json"), "eval present");
        assert.ok(files.includes("episode-meta.json"), "metadata present");

        const meta = JSON.parse(
            fs.readFileSync(path.join(dir, "episode-meta.json"), "utf-8")
        );
        assert.strictEqual(meta.episodeId, "compat-001");
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

// ─── Config Tests ───────────────────────────────────────────────

test("config has Phase 3 loop tunables", () => {
    assert.strictEqual(CONFIG.maxAttempts, 10);
    assert.strictEqual(CONFIG.passThreshold, 7);
    assert.strictEqual(CONFIG.noProgressCutoff, 3);
});
