/**
 * test/apprentice-benchmark.test.js — Benchmark & Replay Tests
 *
 * Tests the loader, replay extraction, and aggregate reporting
 * functionality for the Phase 7 benchmark system.
 *
 * Runtime: Node.js test runner (node --test)
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

const { loadBenchmarkTask, loadAllBenchmarkTasks, validateBenchmark } = require("../apprentice/benchmark-loader");
const { loadEpisodeTask } = require("../apprentice/replay-runner");
const { runBenchmarkSuite } = require("../apprentice/benchmark-runner");
const attemptLoop = require("../apprentice/attempt-loop");
const CONFIG = require("../apprentice/config");

function tempDir(prefix = "test-bench") {
    const id = Math.random().toString(36).slice(2, 8);
    return path.join(os.tmpdir(), `${prefix}-${id}`);
}

function overrideConfigPaths(base) {
    const original = { ...CONFIG.paths };
    CONFIG.paths.benchmarks = path.join(base, "benchmarks");
    CONFIG.paths.reports = path.join(base, "benchmarks", "reports");
    CONFIG.paths.episodes = path.join(base, "episodes");
    return {
        restore() {
            Object.assign(CONFIG.paths, original);
        },
    };
}

// ─── Loader Tests ───────────────────────────────────────────────

test("validateBenchmark throws on invalid tasks", () => {
    assert.throws(() => validateBenchmark({}), /Constraint violated: 'id' must be a non-empty string/);
    assert.throws(() => validateBenchmark({ id: "foo" }), /Constraint violated: 'title' must be a non-empty string/);
    assert.throws(() => validateBenchmark({ id: "foo", title: "Foo" }), /Constraint violated: 'request' must be a non-empty string/);
    assert.doesNotThrow(() => validateBenchmark({ id: "foo", title: "Foo", request: "Do it" }));
});

test("loadBenchmarkTask reads and validates specific task", async () => {
    const base = tempDir("loader-single");
    const handle = overrideConfigPaths(base);
    try {
        fs.mkdirSync(CONFIG.paths.benchmarks, { recursive: true });
        fs.writeFileSync(path.join(CONFIG.paths.benchmarks, "task1.json"), JSON.stringify({
            id: "task1",
            title: "Task One",
            request: "req 1"
        }));

        const task = await loadBenchmarkTask("task1");
        assert.strictEqual(task.id, "task1");
        assert.strictEqual(task.title, "Task One");
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

test("loadAllBenchmarkTasks reads directory bypassing invalid files", async () => {
    const base = tempDir("loader-all");
    const handle = overrideConfigPaths(base);
    try {
        fs.mkdirSync(CONFIG.paths.benchmarks, { recursive: true });
        fs.writeFileSync(path.join(CONFIG.paths.benchmarks, "task1.json"), JSON.stringify({
            id: "task1", title: "T1", request: "r1"
        }));
        // File extension doesn't match
        fs.writeFileSync(path.join(CONFIG.paths.benchmarks, "notes.txt"), "hello");
        // Invalid task structure
        fs.writeFileSync(path.join(CONFIG.paths.benchmarks, "task2.json"), JSON.stringify({
            id: "task2" // missing title & request
        }));

        const tasks = await loadAllBenchmarkTasks();
        assert.strictEqual(tasks.length, 1);
        assert.strictEqual(tasks[0].id, "task1");
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

// ─── Replay Tests ───────────────────────────────────────────────

test("loadEpisodeTask extracts task from summary", () => {
    const base = tempDir("replay");
    const handle = overrideConfigPaths(base);
    try {
        const epDir = path.join(CONFIG.paths.episodes, "ep-123");
        fs.mkdirSync(epDir, { recursive: true });
        
        const summary = {
            episodeId: "ep-123",
            task: {
                id: "historical-task",
                title: "Prior Work",
                request: "Do the thing",
                cols: 80,
                rows: 24
            }
        };
        fs.writeFileSync(path.join(epDir, "episode-summary.json"), JSON.stringify(summary));

        const extracted = loadEpisodeTask("ep-123");
        assert.strictEqual(extracted.id, "historical-task");
        assert.strictEqual(extracted.request, "Do the thing");
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

test("loadEpisodeTask patches missing id and title for legacy summaries", () => {
    const base = tempDir("replay-legacy");
    const handle = overrideConfigPaths(base);
    try {
        const epDir = path.join(CONFIG.paths.episodes, "ep-456");
        fs.mkdirSync(epDir, { recursive: true });
        
        const summary = {
            episodeId: "ep-456",
            task: {
                request: "Old request",
                cols: 80,
                rows: 24
            }
        };
        fs.writeFileSync(path.join(epDir, "episode-summary.json"), JSON.stringify(summary));

        const extracted = loadEpisodeTask("ep-456");
        assert.strictEqual(extracted.id, "replay-ep-456");
        assert.strictEqual(extracted.title, "Replay of ep-456");
        assert.strictEqual(extracted.request, "Old request");
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

// ─── Benchmark Runner Tests ─────────────────────────────────────

test("runBenchmarkSuite aggregates task results correctly", async (t) => {
    const base = tempDir("runner");
    const handle = overrideConfigPaths(base);
    try {
        // We inject mock history responses by mocking attempt-loop.
        // Node's native test runner has mock.method.
        t.mock.method(attemptLoop, "runAttemptLoop", async (api, task, dir, disableRetrieval) => {
            fs.mkdirSync(dir, { recursive: true });
            if (task.id === "task1") {
                return {
                    history: [ { score: 8, verdict: "pass", durationMs: 100 } ],
                    stopReason: "pass_threshold",
                    retrievedLearning: {
                        memories: [{id: "mem1"}],
                        skills: []
                    }
                };
            } else if (task.id === "task2") {
                return {
                    history: [ 
                        { score: 3, verdict: "fail", durationMs: 100 },
                        { score: 5, verdict: "partial", durationMs: 100 } 
                    ],
                    stopReason: "max_attempts",
                    retrievedLearning: null
                };
            }
        });

        const tasks = [
            { id: "task1", title: "T1", request: "R1" },
            { id: "task2", title: "T2", request: "R2" }
        ];

        const report = await runBenchmarkSuite({}, tasks, false);

        assert.strictEqual(report.totalTasks, 2);
        assert.strictEqual(report.passedTasks, 1);
        assert.strictEqual(report.passRate, 0.5);
        
        // Task 1: 8, Task 2: 5 => Mean: 6.5
        assert.strictEqual(report.meanScore, 6.5);
        assert.strictEqual(report.medianScore, 6.5);
        
        assert.strictEqual(report.taskReports.length, 2);
        const tr1 = report.taskReports.find(r => r.taskId === "task1");
        assert.strictEqual(tr1.passType, "pass");
        assert.deepStrictEqual(tr1.retrievedArtifactIds, ["mem1"]);
        
        const tr2 = report.taskReports.find(r => r.taskId === "task2");
        assert.strictEqual(tr2.passType, "partial");
        
        const reportsDirFiles = fs.readdirSync(CONFIG.paths.reports);
        assert.ok(reportsDirFiles.some(f => f.startsWith("aggregate_") && f.endsWith(".json")));

    } finally {
        handle.restore();
        t.mock.restoreAll();
        fs.rmSync(base, { recursive: true, force: true });
    }
});
