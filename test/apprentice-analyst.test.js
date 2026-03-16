/**
 * test/apprentice-analyst.test.js — E2E Test: Requirements Analyst Agent
 *
 * Tests the Requirements Analyst trigger logic, response parsing, artifact
 * persistence, retrieval integration, and prompt construction through the
 * public module API.
 *
 * All tests write to OS temp dirs and clean up after themselves.
 * No live LLM connection required — the LLM call is tested via
 * parseAnalystResponse with representative response strings.
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
    shouldAnalyze,
    parseAnalystResponse,
    formatRequirementBody,
} = require("../apprentice/analyst");
const {
    buildAnalystPrompt,
    buildCapabilitySummary,
} = require("../apprentice/analyst-prompt");
const { writeRequirementArtifact } = require("../apprentice/artifact-writers");
const { readIndex } = require("../apprentice/index-manager");
const { bootstrapLearningDirs } = require("../apprentice/learning-store");
const {
    retrieveForTask,
    hasRetrievedContent,
    retrievedIds,
} = require("../apprentice/retrieve");
const { formatLearningSection } = require("../apprentice/prompts");
const CONFIG = require("../apprentice/config");

/**
 * Create isolated temp directory for test writes.
 *
 * @param {string} prefix — prefix for the temp dir name
 * @returns {string} absolute path to temp dir
 */
function tempDir(prefix = "test-analyst") {
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
    CONFIG.paths.memories      = path.join(base, "memories");
    CONFIG.paths.skills        = path.join(base, "skills");
    CONFIG.paths.exemplars     = path.join(base, "exemplars");
    CONFIG.paths.antiPatterns  = path.join(base, "anti-patterns");
    CONFIG.paths.indexes       = path.join(base, "indexes");
    CONFIG.paths.prompts       = path.join(base, "prompts");
    CONFIG.paths.summaries     = path.join(base, "summaries");
    CONFIG.paths.episodes      = path.join(base, "episodes");
    CONFIG.paths.requirements  = path.join(base, "requirements");
    CONFIG.paths.benchmarks    = path.join(base, "benchmarks");
    CONFIG.paths.reports       = path.join(base, "benchmarks", "reports");
    return {
        restore() {
            Object.assign(CONFIG.paths, original);
        },
    };
}

/**
 * Build a mock attempt result object for analyst trigger testing.
 * Defaults to exitCode 0 (clean run) to match capability-gap scenarios
 * where the code runs but output is wrong.
 *
 * @param {number} attemptNum — attempt number (1-based)
 * @param {number} score      — evaluator score (0-10)
 * @param {object} [overrides] — optional field overrides
 * @returns {object} mock attempt result
 */
function mockAttempt(attemptNum, score, overrides = {}) {
    return {
        attemptNum,
        script: overrides.script || `console.log("attempt ${attemptNum}");`,
        screenText: overrides.screenText || `output from attempt ${attemptNum}`,
        rawAnsi: "",
        stdout: `output from attempt ${attemptNum}`,
        stderr: overrides.stderr || "",
        exitCode: overrides.exitCode != null ? overrides.exitCode : 0,
        timedOut: false,
        durationMs: 500,
        score,
        verdict: score >= 7 ? "pass" : score >= 4 ? "partial" : "fail",
        evaluatorResult: {
            score,
            verdict: score >= 7 ? "pass" : score >= 4 ? "partial" : "fail",
            critique: overrides.critique || `Score ${score}/10 — output does not match wireframe`,
            suggested_next_change: overrides.suggestion || "Try a different approach",
        },
    };
}

// ─── shouldAnalyze Trigger Tests ────────────────────────────────

test("shouldAnalyze returns true when all four conditions met", () => {
    // stopReason = no_progress, best score < 4, 3+ attempts, 2+ clean exits.
    const history = [
        mockAttempt(1, 2),
        mockAttempt(2, 3),
        mockAttempt(3, 1),
    ];
    assert.strictEqual(shouldAnalyze(history, "no_progress"), true);
});

test("shouldAnalyze returns true for max_attempts stopReason", () => {
    const history = [
        mockAttempt(1, 1), mockAttempt(2, 2), mockAttempt(3, 3),
    ];
    assert.strictEqual(shouldAnalyze(history, "max_attempts"), true);
});

test("shouldAnalyze returns false for pass_threshold stopReason", () => {
    const history = [
        mockAttempt(1, 2), mockAttempt(2, 3), mockAttempt(3, 1),
    ];
    assert.strictEqual(shouldAnalyze(history, "pass_threshold"), false);
});

test("shouldAnalyze returns false for runner_error stopReason", () => {
    const history = [
        mockAttempt(1, 2), mockAttempt(2, 3), mockAttempt(3, 1),
    ];
    assert.strictEqual(shouldAnalyze(history, "runner_error"), false);
});

test("shouldAnalyze returns false when best score >= 4", () => {
    // One attempt scored 4 — above the threshold.
    const history = [
        mockAttempt(1, 2), mockAttempt(2, 4), mockAttempt(3, 1),
    ];
    assert.strictEqual(shouldAnalyze(history, "no_progress"), false);
});

test("shouldAnalyze returns false when fewer than 3 attempts", () => {
    const history = [mockAttempt(1, 2), mockAttempt(2, 1)];
    assert.strictEqual(shouldAnalyze(history, "no_progress"), false);
});

test("shouldAnalyze returns false when fewer than 2 clean exits", () => {
    // Only 1 attempt has exitCode 0; the other two crashed.
    const history = [
        mockAttempt(1, 2, { exitCode: 1 }),
        mockAttempt(2, 3),
        mockAttempt(3, 1, { exitCode: 1 }),
    ];
    assert.strictEqual(shouldAnalyze(history, "no_progress"), false);
});

test("shouldAnalyze returns false for empty history", () => {
    assert.strictEqual(shouldAnalyze([], "no_progress"), false);
});

test("shouldAnalyze returns false for null history", () => {
    assert.strictEqual(shouldAnalyze(null, "no_progress"), false);
});

// ─── parseAnalystResponse Tests ─────────────────────────────────

test("parseAnalystResponse extracts valid JSON response", () => {
    const raw = JSON.stringify({
        classification: "capability_gap",
        problem_statement: "No gauge widget exists",
        wireframe_excerpt: "[====    ] 45%",
        capability_audit: {
            available: ["box", "list", "line-chart"],
            needed: ["gauge-widget"],
            gap: "No horizontal bar/gauge widget in CliUI",
        },
        recommendation: "new_widget",
        recommendation_detail: "Create a gauge widget that renders horizontal progress bars",
        acceptance_criteria: ["Gauge renders at specified width", "Supports percentage display"],
    });

    const result = parseAnalystResponse(raw);
    assert.strictEqual(result.classification, "capability_gap");
    assert.strictEqual(result.problem_statement, "No gauge widget exists");
    assert.strictEqual(result.capability_audit.needed[0], "gauge-widget");
    assert.strictEqual(result.acceptance_criteria.length, 2);
});

test("parseAnalystResponse extracts JSON from markdown code fences", () => {
    const raw = `Here is my analysis:

\`\`\`json
{
  "classification": "code_quality",
  "problem_statement": "Apprentice misused the Box API",
  "wireframe_excerpt": "",
  "capability_audit": { "available": ["box"], "needed": ["box"], "gap": "" },
  "recommendation": "apprentice_guidance",
  "recommendation_detail": "Teach correct Box constructor usage",
  "acceptance_criteria": ["Box renders with correct dimensions"]
}
\`\`\`

That's my assessment.`;

    const result = parseAnalystResponse(raw);
    assert.strictEqual(result.classification, "code_quality");
    assert.strictEqual(result.recommendation, "apprentice_guidance");
});

test("parseAnalystResponse handles completely malformed response", () => {
    const raw = "I couldn't parse the episode properly. The failure seems complex.";

    const result = parseAnalystResponse(raw);
    // Should fall back to unknown classification with raw text as problem statement.
    assert.strictEqual(result.classification, "unknown");
    assert.ok(result.problem_statement.includes("couldn't parse"));
    assert.deepStrictEqual(result.capability_audit.available, []);
});

test("parseAnalystResponse normalizes invalid classification to unknown", () => {
    const raw = JSON.stringify({
        classification: "not_a_valid_type",
        problem_statement: "Something broke",
    });

    const result = parseAnalystResponse(raw);
    assert.strictEqual(result.classification, "unknown");
});

test("parseAnalystResponse fills missing fields with defaults", () => {
    const raw = JSON.stringify({
        classification: "capability_gap",
    });

    const result = parseAnalystResponse(raw);
    assert.strictEqual(result.classification, "capability_gap");
    assert.strictEqual(result.problem_statement, "");
    assert.strictEqual(result.wireframe_excerpt, "");
    assert.deepStrictEqual(result.capability_audit.available, []);
    assert.deepStrictEqual(result.acceptance_criteria, []);
});

// ─── formatRequirementBody Tests ────────────────────────────────

test("formatRequirementBody produces structured markdown", () => {
    const analysis = {
        classification: "capability_gap",
        problem_statement: "No gauge widget",
        wireframe_excerpt: "[====    ] 45%",
        capability_audit: {
            available: ["box", "list"],
            needed: ["gauge"],
            gap: "Missing gauge widget",
        },
        recommendation: "new_widget",
        recommendation_detail: "Create a horizontal bar gauge widget",
        acceptance_criteria: ["Renders at specified width", "Shows percentage"],
    };

    const body = formatRequirementBody(analysis, "ep_test", { request: "Build a gauge dashboard" });

    assert.ok(body.includes("# Feature Requirement:"));
    assert.ok(body.includes("**Classification:** capability_gap"));
    assert.ok(body.includes("No gauge widget"));
    assert.ok(body.includes("[====    ] 45%"));
    assert.ok(body.includes("**Available:** box, list"));
    assert.ok(body.includes("**Needed:** gauge"));
    assert.ok(body.includes("- [ ] Renders at specified width"));
});

// ─── writeRequirementArtifact Tests ─────────────────────────────

test("writeRequirementArtifact creates file and updates index", async () => {
    const base = tempDir("req-write");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        const result = await writeRequirementArtifact({
            title: "capability_gap: No gauge widget exists in CliUI",
            tags: ["gauge", "widget", "dashboard"],
            confidence: 0.8,
            body: "# Feature Requirement: Gauge Widget\n\nNeed a gauge.",
            source: "ep_test_req",
            classification: "capability_gap",
            episodeId: "ep_test_req",
        });

        // Verify artifact file exists on disk.
        assert.ok(fs.existsSync(result.path), "artifact file should exist");

        // Verify file content has front-matter with classification.
        const content = fs.readFileSync(result.path, "utf-8");
        assert.ok(content.includes("capability_gap"), "should include classification");
        assert.ok(content.includes("ep_test_req"), "should include episodeId");

        // Verify index was updated.
        const index = await readIndex("requirement");
        assert.strictEqual(index.length, 1);
        assert.strictEqual(index[0].id, result.id);
        assert.ok(index[0].title.includes("gauge"));
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

// ─── Retrieval Round-Trip Tests ─────────────────────────────────

test("retrieveForTask finds requirement artifacts", async () => {
    const base = tempDir("req-retrieve");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        // Write a requirement about gauge widgets.
        await writeRequirementArtifact({
            title: "capability_gap: No gauge widget for dashboard rendering",
            tags: ["gauge", "widget", "dashboard", "rendering"],
            confidence: 0.8,
            body: "The CliUI library lacks a gauge widget needed for dashboard layouts.",
            source: "ep_gauge",
            classification: "capability_gap",
            episodeId: "ep_gauge",
        });

        // Retrieve for a task about dashboards with gauges.
        const task = { request: "Build a dashboard with gauge widgets showing CPU metrics" };
        const retrieved = await retrieveForTask(task);

        // Should find the requirement artifact.
        assert.ok(retrieved.requirements, "should have requirements field");
        assert.ok(retrieved.requirements.length > 0,
            `expected >= 1 requirement, got ${retrieved.requirements.length}`);
        assert.ok(retrieved.requirements[0].body.includes("gauge"),
            "requirement body should mention gauge");

        // hasRetrievedContent should detect requirements.
        assert.ok(hasRetrievedContent(retrieved));

        // retrievedIds should include the requirement ID.
        const ids = retrievedIds(retrieved);
        assert.ok(ids.length > 0);
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

// ─── formatLearningSection with Requirements ────────────────────

test("formatLearningSection includes Known Capability Gaps", () => {
    const retrieved = {
        skills: [],
        memories: [],
        exemplars: [],
        antiPatterns: [],
        requirements: [{
            id: "req_1",
            title: "capability_gap: No gauge widget",
            confidence: 0.8,
            body: "The CliUI library lacks a gauge widget for horizontal progress bars.",
        }],
    };

    const section = formatLearningSection(retrieved);
    assert.ok(section.includes("Known Capability Gaps"), "should include capability gaps heading");
    assert.ok(section.includes("gauge widget"), "should include requirement content");
});

test("formatLearningSection omits gaps section when no requirements", () => {
    const retrieved = {
        skills: [{ id: "sk_1", title: "test", confidence: 0.9, body: "test body" }],
        memories: [],
        exemplars: [],
        antiPatterns: [],
        requirements: [],
    };

    const section = formatLearningSection(retrieved);
    assert.ok(!section.includes("Known Capability Gaps"),
        "should NOT include capability gaps when requirements empty");
});

// ─── buildAnalystPrompt Tests ───────────────────────────────────

test("buildAnalystPrompt includes task, wireframe, and attempt data", () => {
    const task = {
        request: "Build a gauge dashboard",
        wireframe: "[====    ] 45%\n[========] 90%",
        cols: 80,
        rows: 24,
    };
    const history = [
        mockAttempt(1, 2, { critique: "Gauge not rendered at all" }),
        mockAttempt(2, 1, { critique: "Still no gauge widget found" }),
        mockAttempt(3, 3, { critique: "Output shows box but no gauge bar" }),
    ];

    const prompt = buildAnalystPrompt(task, history);

    // Should include the task.
    assert.ok(prompt.includes("Build a gauge dashboard"));
    // Should include the wireframe.
    assert.ok(prompt.includes("[====    ] 45%"));
    // Should include attempt data.
    assert.ok(prompt.includes("Attempt 1"));
    assert.ok(prompt.includes("Attempt 3"));
    // Should include evaluator critiques.
    assert.ok(prompt.includes("Gauge not rendered"));
    // Should include JSON output instructions.
    assert.ok(prompt.includes("classification"));
    assert.ok(prompt.includes("capability_audit"));
});

test("buildAnalystPrompt includes CliUI capability summary", () => {
    const task = { request: "test task", cols: 80, rows: 24 };
    const history = [mockAttempt(1, 2)];

    const prompt = buildAnalystPrompt(task, history);

    // Should include capability inventory section.
    assert.ok(prompt.includes("Available Capabilities"),
        "should include capabilities section header");
    // Should include lib/ listing (the repo has a lib/ directory).
    assert.ok(prompt.includes("lib/"),
        "should include lib/ directory listing");
});

test("buildCapabilitySummary returns non-empty string", () => {
    const summary = buildCapabilitySummary();
    assert.ok(summary.length > 0, "capability summary should not be empty");
    // Should mention lib/ since the CliUI repo has widget modules there.
    assert.ok(summary.includes("lib/"));
});

// ─── Config Integration Tests ───────────────────────────────────

test("CONFIG has analyst provider settings", () => {
    assert.ok(CONFIG.analystProvider, "should have analystProvider");
    assert.strictEqual(CONFIG.analystProvider, "claude-cli");
});

test("CONFIG has requirements path", () => {
    assert.ok(CONFIG.paths.requirements, "should have requirements path");
    assert.ok(CONFIG.paths.requirements.includes("requirements"));
});

test("CONFIG has maxRequirements retrieval limit", () => {
    assert.strictEqual(CONFIG.retrieval.maxRequirements, 3);
});
