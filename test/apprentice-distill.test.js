/**
 * test/apprentice-distill.test.js — E2E Test: Distillation, Retrieval, and Reuse
 *
 * Tests the Phase 5 learning distillation, retrieval, and prompt
 * integration through the public module API. Covers: tag extraction,
 * memory/exemplar/anti-pattern/skill creation, retrieval scoring,
 * prompt integration, and reuse metadata persistence.
 *
 * All tests write to OS temp dirs and clean up after themselves.
 *
 * Runtime: Node.js test runner (node --test)
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Modules under test — public API only.
const {
    distillEpisode,
    extractMemories,
    extractExemplar,
    extractAntiPatterns,
    maybeExtractSkill,
    extractTags,
} = require("../apprentice/distill");
const {
    retrieveForTask,
    hasRetrievedContent,
    retrievedIds,
    scoreEntry,
    extractKeywords,
    loadArtifactBody,
} = require("../apprentice/retrieve");
const {
    buildApprenticePrompt,
    buildEvaluatorPrompt,
    formatLearningSection,
} = require("../apprentice/prompts");
const { buildRevisionPrompt } = require("../apprentice/revision-prompt");
const { saveAttempt } = require("../apprentice/persistence");
const { readIndex } = require("../apprentice/index-manager");
const { bootstrapLearningDirs } = require("../apprentice/learning-store");
const CONFIG = require("../apprentice/config");

/**
 * Create isolated temp directory for test writes.
 *
 * @param {string} prefix — prefix for the temp dir name
 * @returns {string} absolute path to temp dir
 */
function tempDir(prefix = "test-distill") {
    const id = Math.random().toString(36).slice(2, 8);
    return path.join(os.tmpdir(), `${prefix}-${id}`);
}

/**
 * Override CONFIG.paths for isolated test writes.
 * Returns a restore function to reset paths after the test.
 *
 * @param {string} base — base temp directory for learning paths
 * @returns {{ restore: Function }} cleanup handle
 */
function overrideConfigPaths(base) {
    const original = { ...CONFIG.paths };
    CONFIG.paths.memories     = path.join(base, "memories");
    CONFIG.paths.skills       = path.join(base, "skills");
    CONFIG.paths.exemplars    = path.join(base, "exemplars");
    CONFIG.paths.antiPatterns = path.join(base, "anti-patterns");
    CONFIG.paths.indexes      = path.join(base, "indexes");
    CONFIG.paths.prompts      = path.join(base, "prompts");
    CONFIG.paths.summaries    = path.join(base, "summaries");
    CONFIG.paths.episodes     = path.join(base, "episodes");
    return {
        restore() {
            Object.assign(CONFIG.paths, original);
        },
    };
}

/**
 * Build a mock attempt result object for testing.
 *
 * @param {number} attemptNum — attempt number (1-based)
 * @param {number} score      — evaluator score (0-10)
 * @param {string} [critique] — evaluator critique text
 * @param {string} [script]   — generated script text
 * @returns {object} mock attempt result
 */
function mockAttempt(attemptNum, score, critique, script) {
    return {
        attemptNum,
        script: script || `console.log("attempt ${attemptNum}");`,
        screenText: `output from attempt ${attemptNum}`,
        rawAnsi: "",
        stdout: `output from attempt ${attemptNum}`,
        stderr: "",
        exitCode: score >= 7 ? 0 : 1,
        timedOut: false,
        durationMs: 500,
        score,
        verdict: score >= 7 ? "pass" : score >= 4 ? "partial" : "fail",
        evaluatorResult: {
            score,
            verdict: score >= 7 ? "pass" : score >= 4 ? "partial" : "fail",
            critique: critique || `Score ${score}/10`,
            suggested_next_change: "Improve the output",
        },
    };
}

// ─── Tag Extraction Tests ───────────────────────────────────────

test("extractTags tokenizes text into lowercase keywords", () => {
    const tags = extractTags("Create a Line Chart with CPU usage data");
    assert.ok(tags.includes("create"), "should include 'create'");
    assert.ok(tags.includes("line"), "should include 'line'");
    assert.ok(tags.includes("chart"), "should include 'chart'");
    assert.ok(tags.includes("cpu"), "should include 'cpu'");
    assert.ok(tags.includes("usage"), "should include 'usage'");
    assert.ok(tags.includes("data"), "should include 'data'");
});

test("extractTags deduplicates and filters short tokens", () => {
    const tags = extractTags("a bb ccc ccc ddd a");
    // 'a' and 'bb' are < 3 chars and should be filtered.
    assert.ok(!tags.includes("a"), "should not include 'a'");
    assert.ok(!tags.includes("bb"), "should not include 'bb'");
    // 'ccc' should appear only once.
    assert.strictEqual(tags.filter((t) => t === "ccc").length, 1);
});

test("extractTags returns empty for null/empty input", () => {
    assert.deepStrictEqual(extractTags(null), []);
    assert.deepStrictEqual(extractTags(""), []);
});

// ─── extractKeywords (retrieve.js) Tests ────────────────────────

test("extractKeywords produces searchable terms from task text", () => {
    const kw = extractKeywords("Build a terminal dashboard with charts");
    assert.ok(kw.includes("build"));
    assert.ok(kw.includes("terminal"));
    assert.ok(kw.includes("dashboard"));
    assert.ok(kw.includes("charts"));
});

// ─── scoreEntry Tests ───────────────────────────────────────────

test("scoreEntry returns positive score for matching keywords", () => {
    const entry = {
        id: "mem_001",
        title: "Line chart API requires data array",
        tags: ["line-chart", "galactica"],
        confidence: 0.8,
    };
    const score = scoreEntry(entry, ["line", "chart", "data", "array"]);
    assert.ok(score > 0, `expected positive score, got ${score}`);
});

test("scoreEntry returns 0 for no keyword overlap", () => {
    const entry = {
        id: "mem_002",
        title: "Database connection timeout",
        tags: ["database", "timeout"],
        confidence: 0.9,
    };
    const score = scoreEntry(entry, ["chart", "dashboard", "widget"]);
    assert.strictEqual(score, 0);
});

test("scoreEntry returns 0 for empty keywords", () => {
    const entry = { id: "mem_003", title: "Any title", tags: ["x"], confidence: 0.5 };
    assert.strictEqual(scoreEntry(entry, []), 0);
});

// ─── Memory Distillation Tests ──────────────────────────────────

test("extractMemories creates memory from evaluator critique", async () => {
    const base = tempDir("mem-extract");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        const task = { request: "Create a line chart showing CPU usage" };
        const history = [
            mockAttempt(1, 4, "The line chart is missing axis labels and the data array is empty. Need to populate data."),
        ];

        const created = await extractMemories(task, history, "ep_test_mem");

        // Should create a memory for the failing attempt's critique.
        assert.strictEqual(created.length, 1);
        assert.strictEqual(created[0].type, "memory");

        // Verify the memory was written to disk.
        const index = await readIndex("memory");
        assert.strictEqual(index.length, 1);
        assert.ok(index[0].title.includes("Critique from attempt 1"));
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

test("extractMemories skips passing attempts", async () => {
    const base = tempDir("mem-skip-pass");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        const task = { request: "Build a dashboard" };
        // Score 8 passes threshold (default 7), so no memory should be created.
        const history = [mockAttempt(1, 8, "Great dashboard, everything looks perfect!")];

        const created = await extractMemories(task, history, "ep_skip");
        assert.strictEqual(created.length, 0);
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

// ─── Exemplar Distillation Tests ────────────────────────────────

test("extractExemplar creates exemplar from passing episode", async () => {
    const base = tempDir("exemplar-extract");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        const task = { request: "Create a terminal dashboard" };
        const history = [
            mockAttempt(1, 4, "Missing chart widget"),
            mockAttempt(2, 8, "Looks great!", 'const galactica = require("galactica");\n// perfect dashboard'),
        ];

        const result = await extractExemplar("ep_exemplar", task, history);

        // Should create an exemplar for the passing attempt.
        assert.ok(result !== null, "should create exemplar");
        assert.strictEqual(result.type, "exemplar");

        // Verify the exemplar index entry exists.
        const index = await readIndex("exemplar");
        assert.strictEqual(index.length, 1);
        assert.ok(index[0].title.includes("Passing solution"));
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

test("extractExemplar returns null when no passing attempts exist", async () => {
    const base = tempDir("exemplar-none");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        const task = { request: "Build something" };
        const history = [mockAttempt(1, 3, "Failed"), mockAttempt(2, 4, "Still failing")];

        const result = await extractExemplar("ep_no_exemplar", task, history);
        assert.strictEqual(result, null);
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

// ─── Anti-Pattern Distillation Tests ────────────────────────────

test("extractAntiPatterns detects repeated failure scores", async () => {
    const base = tempDir("anti-extract");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        const task = { request: "Build a chart widget" };
        // Three consecutive failures with identical score.
        const history = [
            mockAttempt(1, 3, "Widget not found in output"),
            mockAttempt(2, 3, "Widget not found in output"),
            mockAttempt(3, 3, "Widget not rendered"),
        ];

        const created = await extractAntiPatterns(task, history, "ep_anti");

        // Should detect the group of 3 identical scores.
        assert.ok(created.length >= 1, `expected at least 1 anti-pattern, got ${created.length}`);
        assert.strictEqual(created[0].type, "anti-pattern");

        const index = await readIndex("anti-pattern");
        assert.ok(index.length >= 1);
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

test("extractAntiPatterns returns empty for single attempt", async () => {
    const base = tempDir("anti-single");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        const task = { request: "test" };
        const created = await extractAntiPatterns(task, [mockAttempt(1, 2, "bad")], "ep_s");
        assert.strictEqual(created.length, 0);
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

// ─── Skill Promotion Tests ──────────────────────────────────────

test("maybeExtractSkill creates skill for high-score quick pass", async () => {
    const base = tempDir("skill-yes");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        const task = { request: "Create a simple chart" };
        // Single attempt, score 9 — meets all gates.
        const history = [mockAttempt(1, 9, "Perfect!", "// great script")];

        const result = await maybeExtractSkill("ep_skill", task, history);
        assert.ok(result !== null, "should create skill");
        assert.strictEqual(result.type, "skill");

        const index = await readIndex("skill");
        assert.strictEqual(index.length, 1);
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

test("maybeExtractSkill refuses skill for long convergence", async () => {
    const base = tempDir("skill-no-long");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        const task = { request: "Build a complex dashboard" };
        // 5 attempts — too many for skill promotion even though final score is 9.
        const history = [
            mockAttempt(1, 2, "bad"), mockAttempt(2, 4, "partial"),
            mockAttempt(3, 5, "better"), mockAttempt(4, 6, "close"),
            mockAttempt(5, 9, "pass!"),
        ];

        const result = await maybeExtractSkill("ep_no_skill", task, history);
        assert.strictEqual(result, null, "should NOT create skill for 5-attempt pass");
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

test("maybeExtractSkill refuses skill for score below 8", async () => {
    const base = tempDir("skill-no-low");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        const task = { request: "Build something" };
        // Score 7 passes threshold but < 8, so no skill.
        const history = [mockAttempt(1, 7, "ok")];

        const result = await maybeExtractSkill("ep_low", task, history);
        assert.strictEqual(result, null, "should NOT create skill for score 7");
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

// ─── Full Distillation Tests ────────────────────────────────────

test("distillEpisode returns created artifact list", async () => {
    const base = tempDir("distill-full");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        const task = { request: "Create a terminal dashboard with line chart" };
        const history = [
            mockAttempt(1, 3, "Chart widget is not rendering any data points on screen"),
            mockAttempt(2, 9, "Excellent dashboard!", 'require("galactica");\n// perfect'),
        ];

        const result = await distillEpisode("ep_full", task, history, "pass_threshold");

        // Should have at least: 1 memory (from attempt 1 critique)
        // + 1 exemplar (from attempt 2 passing).
        assert.ok(result.created.length >= 2,
            `expected at least 2 artifacts, got ${result.created.length}`);

        const types = result.created.map((a) => a.type);
        assert.ok(types.includes("memory"), "should include memory");
        assert.ok(types.includes("exemplar"), "should include exemplar");

        // Should also create a skill (score 9, 2 attempts).
        assert.ok(types.includes("skill"), "should include skill (score 9, 2 attempts)");
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

test("distillEpisode returns empty for empty history", async () => {
    const result = await distillEpisode("ep_empty", { request: "x" }, [], "runner_error");
    assert.deepStrictEqual(result.created, []);
});

// ─── Retrieval Tests ────────────────────────────────────────────

test("retrieveForTask finds previously created artifacts", async () => {
    const base = tempDir("retrieve-find");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        // First: distill artifacts from an episode about charts.
        const task1 = { request: "Create a line chart showing CPU usage" };
        const history1 = [
            mockAttempt(1, 3, "The line chart requires a data array with numeric values for CPU metrics"),
            mockAttempt(2, 9, "Perfect chart!", 'const g = require("galactica");\ng.chart()'),
        ];
        await distillEpisode("ep_chart1", task1, history1, "pass_threshold");

        // Second: retrieve for a similar task.
        const task2 = { request: "Build a line chart with memory usage data" };
        const retrieved = await retrieveForTask(task2);

        // Should find the memory and/or exemplar from the first episode.
        assert.ok(hasRetrievedContent(retrieved),
            "should find relevant artifacts");

        // Should have at least one non-empty category.
        const totalFound = (
            (retrieved.memories?.length || 0) +
            (retrieved.exemplars?.length || 0) +
            (retrieved.skills?.length || 0) +
            (retrieved.antiPatterns?.length || 0)
        );
        assert.ok(totalFound > 0, `expected at least 1 retrieved artifact, got ${totalFound}`);
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

test("retrieveForTask returns empty for unrelated task", async () => {
    const base = tempDir("retrieve-empty");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        // Create chart-specific artifacts.
        const task1 = { request: "Create a line chart showing CPU usage" };
        const history1 = [
            mockAttempt(1, 3, "The line chart requires data array for CPU metrics"),
        ];
        await distillEpisode("ep_chart_only", task1, history1, "no_progress");

        // Retrieve for a completely unrelated task.
        const task2 = { request: "Connect to database and run migration" };
        const retrieved = await retrieveForTask(task2);

        // Should find nothing relevant (no keyword overlap).
        const totalFound = (
            (retrieved.memories?.length || 0) +
            (retrieved.exemplars?.length || 0) +
            (retrieved.skills?.length || 0) +
            (retrieved.antiPatterns?.length || 0)
        );
        assert.strictEqual(totalFound, 0, `expected 0, got ${totalFound}`);
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

test("retrievedIds collects all IDs from retrieved result", () => {
    const retrieved = {
        skills: [{ id: "sk_1" }],
        memories: [{ id: "mem_1" }, { id: "mem_2" }],
        exemplars: [],
        antiPatterns: [{ id: "ap_1" }],
    };
    const ids = retrievedIds(retrieved);
    assert.strictEqual(ids.length, 4);
    assert.ok(ids.includes("sk_1"));
    assert.ok(ids.includes("mem_1"));
    assert.ok(ids.includes("mem_2"));
    assert.ok(ids.includes("ap_1"));
});

test("hasRetrievedContent correctly detects presence/absence", () => {
    assert.strictEqual(hasRetrievedContent(null), false);
    assert.strictEqual(hasRetrievedContent({}), false);
    assert.strictEqual(
        hasRetrievedContent({ skills: [], memories: [], exemplars: [], antiPatterns: [] }),
        false
    );
    assert.strictEqual(
        hasRetrievedContent({ skills: [{ id: "s1" }], memories: [], exemplars: [], antiPatterns: [] }),
        true
    );
});

// ─── loadArtifactBody Tests ─────────────────────────────────────

test("loadArtifactBody strips front-matter and returns body", async () => {
    const dir = tempDir("body-load");
    fs.mkdirSync(dir, { recursive: true });
    try {
        const filePath = path.join(dir, "test.md");
        fs.writeFileSync(filePath, "---\nid: \"test\"\ntitle: \"Test\"\n---\n\n## Body\n\nContent here.", "utf-8");

        const body = await loadArtifactBody({ path: filePath });
        assert.ok(body.includes("## Body"), "should include body heading");
        assert.ok(body.includes("Content here"), "should include body text");
        assert.ok(!body.includes("---"), "should not include front-matter delimiters");
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("loadArtifactBody returns empty for missing file", async () => {
    const body = await loadArtifactBody({ path: "/nonexistent/path/xyz.md" });
    assert.strictEqual(body, "");
});

// ─── Prompt Integration Tests ───────────────────────────────────

test("buildApprenticePrompt includes Prior Learning when provided", () => {
    const task = { request: "Build a chart", cols: 80, rows: 24 };
    const retrieved = {
        skills: [{
            id: "sk_1", title: "Use contrib.line for charts",
            confidence: 0.9, body: "Always use contrib.line() for line charts",
        }],
        memories: [{
            id: "mem_1", title: "Data arrays must be numeric",
            confidence: 0.7, body: "Ensure all data points are numbers",
        }],
        exemplars: [],
        antiPatterns: [{
            id: "ap_1", title: "Avoid render loops",
            confidence: 0.85, body: "Do not call render in a loop",
        }],
    };

    const prompt = buildApprenticePrompt(task, retrieved);

    // Should include the prior learning section.
    assert.ok(prompt.includes("Prior Learning"), "should include Prior Learning heading");
    assert.ok(prompt.includes("contrib.line"), "should include skill content");
    assert.ok(prompt.includes("Data arrays"), "should include memory content");
    assert.ok(prompt.includes("render loops"), "should include anti-pattern content");
    assert.ok(prompt.includes("guidance, not as ground truth"), "should include disclaimer");
});

test("buildApprenticePrompt excludes learning section when empty", () => {
    const task = { request: "Build a chart", cols: 80, rows: 24 };
    const prompt = buildApprenticePrompt(task);

    assert.ok(!prompt.includes("Prior Learning"), "should NOT include Prior Learning");
});

test("buildApprenticePrompt excludes learning section when all arrays empty", () => {
    const task = { request: "Build a chart", cols: 80, rows: 24 };
    const retrieved = { skills: [], memories: [], exemplars: [], antiPatterns: [] };
    const prompt = buildApprenticePrompt(task, retrieved);

    assert.ok(!prompt.includes("Prior Learning"), "should NOT include Prior Learning");
});

test("buildRevisionPrompt includes Prior Learning when provided", () => {
    const task = { request: "Build a chart", cols: 80, rows: 24 };
    const priorAttempt = {
        script: 'console.log("chart");',
        screenText: "chart output",
        stderr: "",
        exitCode: 0,
        timedOut: false,
        evaluatorResult: { score: 3, verdict: "fail", critique: "Missing chart" },
    };
    const retrieved = {
        skills: [],
        memories: [{ id: "mem_1", title: "Chart needs data", confidence: 0.6, body: "Data required" }],
        exemplars: [],
        antiPatterns: [],
    };

    const prompt = buildRevisionPrompt(task, priorAttempt, 2, retrieved);

    assert.ok(prompt.includes("Prior Learning"), "should include Prior Learning");
    assert.ok(prompt.includes("Chart needs data"), "should include memory");
});

test("buildRevisionPrompt works without retrieved learning", () => {
    const task = { request: "test", cols: 80, rows: 24 };
    const priorAttempt = {
        script: "x", screenText: "y", stderr: "",
        exitCode: 0, timedOut: false,
        evaluatorResult: { score: 1, verdict: "fail", critique: "bad" },
    };

    // Should not throw when called without retrievedLearning.
    const prompt = buildRevisionPrompt(task, priorAttempt, 2);
    assert.ok(!prompt.includes("Prior Learning"));
});

// ─── formatLearningSection Tests ────────────────────────────────

test("formatLearningSection returns empty for null input", () => {
    assert.strictEqual(formatLearningSection(null), "");
});

test("formatLearningSection includes exemplar reference", () => {
    const retrieved = {
        skills: [],
        memories: [],
        exemplars: [{
            id: "ex_1", title: "Perfect chart solution",
            confidence: 0.95, body: "## Solution\n\n```js\nconsole.log('chart');\n```",
        }],
        antiPatterns: [],
    };

    const section = formatLearningSection(retrieved);
    assert.ok(section.includes("Reference Example"), "should include Reference Example heading");
    assert.ok(section.includes("Perfect chart solution"), "should include exemplar title");
});

// ─── Reuse Metadata Tests ───────────────────────────────────────

test("saveAttempt writes retrieved.json when artifact IDs provided", async () => {
    const dir = tempDir("reuse-meta");
    try {
        const artifacts = {
            script: 'console.log("test");',
            screenText: "test output",
            stderr: "",
            evaluatorResult: { score: 5, verdict: "partial" },
        };
        const retrievedArtifactIds = ["mem_001", "sk_001", "ex_001"];

        await saveAttempt(dir, 1, artifacts, retrievedArtifactIds);

        // Verify retrieved.json was written.
        const retrievedPath = path.join(dir, "attempt_001-retrieved.json");
        assert.ok(fs.existsSync(retrievedPath), "should write retrieved.json");

        const content = JSON.parse(fs.readFileSync(retrievedPath, "utf-8"));
        assert.deepStrictEqual(content.retrievedArtifactIds, retrievedArtifactIds);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("saveAttempt does not write retrieved.json when no IDs", async () => {
    const dir = tempDir("reuse-no-meta");
    try {
        const artifacts = {
            script: 'console.log("test");',
            screenText: "test output",
            stderr: "",
            evaluatorResult: { score: 5, verdict: "partial" },
        };

        await saveAttempt(dir, 1, artifacts);

        // Should NOT write retrieved.json when no IDs provided.
        const retrievedPath = path.join(dir, "attempt_001-retrieved.json");
        assert.ok(!fs.existsSync(retrievedPath), "should NOT write retrieved.json");
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("saveAttempt does not write retrieved.json for empty IDs array", async () => {
    const dir = tempDir("reuse-empty-ids");
    try {
        const artifacts = {
            script: "x",
            screenText: "y",
            stderr: "",
            evaluatorResult: { score: 1 },
        };

        await saveAttempt(dir, 1, artifacts, []);

        const retrievedPath = path.join(dir, "attempt_001-retrieved.json");
        assert.ok(!fs.existsSync(retrievedPath), "should NOT write retrieved.json for empty array");
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

// ─── End-to-End: Distill Then Retrieve ──────────────────────────

test("end-to-end: distill creates artifacts that retrieval finds", async () => {
    const base = tempDir("e2e-distill-retrieve");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        // Episode 1: about terminal dashboards with charts.
        const task1 = { request: "Create a terminal dashboard with a line chart and log widget" };
        const history1 = [
            mockAttempt(1, 3, "The dashboard layout is wrong. Line chart not visible. Log widget missing border."),
            mockAttempt(2, 9, "Dashboard renders correctly with chart and log!", 'require("galactica"); // chart + log'),
        ];

        const distillResult = await distillEpisode("ep_e2e_1", task1, history1, "pass_threshold");

        // Verify artifacts were created.
        assert.ok(distillResult.created.length >= 2,
            `expected >= 2 created, got ${distillResult.created.length}`);

        // Episode 2: retrieve for a related task (also about dashboards + charts).
        const task2 = { request: "Build a terminal dashboard with charts showing network traffic" };
        const retrieved = await retrieveForTask(task2);

        // Should find relevant artifacts from episode 1.
        assert.ok(hasRetrievedContent(retrieved), "should find relevant artifacts");

        // Verify the retrieved IDs can be collected.
        const ids = retrievedIds(retrieved);
        assert.ok(ids.length > 0, `expected > 0 retrieved IDs, got ${ids.length}`);

        // Verify the prompt integrates the retrieved learning.
        const prompt = buildApprenticePrompt(task2, retrieved);
        assert.ok(prompt.includes("Prior Learning"), "prompt should include Prior Learning");
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

// ─── Config Tests ───────────────────────────────────────────────

test("config has retrieval limits", () => {
    assert.ok(CONFIG.retrieval, "should have retrieval config");
    assert.strictEqual(CONFIG.retrieval.maxSkills, 3);
    assert.strictEqual(CONFIG.retrieval.maxMemories, 5);
    assert.strictEqual(CONFIG.retrieval.maxExemplars, 2);
    assert.strictEqual(CONFIG.retrieval.maxAntiPatterns, 3);
});
