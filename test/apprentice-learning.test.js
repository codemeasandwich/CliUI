/**
 * test/apprentice-learning.test.js — E2E Test: Learning Store Scaffolding
 *
 * Tests the Phase 4 learning store through the public module API.
 * Covers: directory bootstrap, artifact ID generation, all four
 * artifact writers (memory, skill, exemplar, anti-pattern), index
 * management (add, read, rebuild), front-matter parsing, and
 * prompt snapshot persistence.
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
const { bootstrapLearningDirs, artifactId } = require("../apprentice/learning-store");
const {
    writeMemoryArtifact,
    writeSkillArtifact,
    writeExemplarArtifact,
    writeAntiPatternArtifact,
    formatFrontMatter,
} = require("../apprentice/artifact-writers");
const {
    addToIndex,
    readIndex,
    rebuildIndex,
    parseFrontMatter,
    indexPath,
} = require("../apprentice/index-manager");
const { savePromptSnapshot, promptFilename } = require("../apprentice/prompt-snapshot");
const CONFIG = require("../apprentice/config");

/**
 * Create a temporary directory for isolated test writes.
 * Returns the absolute path. Caller responsible for cleanup.
 *
 * @param {string} prefix — prefix for the temp dir name
 * @returns {string} absolute path to temp dir
 */
function tempDir(prefix = "test-learning") {
    const id = Math.random().toString(36).slice(2, 8);
    return path.join(os.tmpdir(), `${prefix}-${id}`);
}

/**
 * Helper to temporarily override CONFIG.paths for isolated tests.
 * Returns the original paths and a restore function.
 *
 * @param {string} base — base temp directory
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

// ─── Bootstrap Tests ────────────────────────────────────────────

test("bootstrapLearningDirs creates all required directories", async () => {
    const base = tempDir("bootstrap");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        // Verify every configured learning directory exists.
        for (const key of Object.keys(CONFIG.paths)) {
            if (key === "temp") continue; // temp is not a learning dir
            const dir = CONFIG.paths[key];
            const stat = fs.statSync(dir);
            assert.ok(stat.isDirectory(), `${key} should be a directory`);
        }
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

test("bootstrapLearningDirs is idempotent", async () => {
    const base = tempDir("bootstrap-idem");
    const handle = overrideConfigPaths(base);
    try {
        // Call twice — second call must not throw or corrupt.
        await bootstrapLearningDirs();
        await bootstrapLearningDirs();

        const stat = fs.statSync(CONFIG.paths.memories);
        assert.ok(stat.isDirectory());
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

// ─── Artifact ID Tests ──────────────────────────────────────────

test("artifactId generates unique IDs with correct prefix", () => {
    const memId = artifactId("memory");
    const skillId = artifactId("skill");

    assert.ok(memId.startsWith("memory_"), `should start with memory_, got: ${memId}`);
    assert.ok(skillId.startsWith("skill_"), `should start with skill_, got: ${skillId}`);

    // Two IDs generated close together should still be unique.
    assert.notStrictEqual(memId, artifactId("memory"));
});

test("artifactId contains timestamp pattern", () => {
    const id = artifactId("exemplar");
    // Should contain a timestamp-like segment: YYYY-MM-DD
    assert.ok(/\d{4}-\d{2}-\d{2}/.test(id), `should contain date: ${id}`);
});

// ─── Front-Matter Formatting Tests ──────────────────────────────

test("formatFrontMatter produces valid YAML-like block", () => {
    const fm = formatFrontMatter({
        id: "test_001",
        title: "Test Title",
        tags: ["a", "b"],
        confidence: 0.8,
    });

    assert.ok(fm.startsWith("---"), "should start with ---");
    assert.ok(fm.endsWith("---"), "should end with ---");
    assert.ok(fm.includes('title: "Test Title"'), "should include title");
    assert.ok(fm.includes("tags: [a, b]"), "should include inline tags");
    assert.ok(fm.includes("confidence: 0.8"), "should include confidence");
});

test("formatFrontMatter and parseFrontMatter roundtrip correctly", () => {
    // Build front-matter with all field types, then parse it back.
    // This roundtrip is critical because rebuildIndex depends on it.
    const meta = {
        id: "memory_2026-01-01T00_00_00.000Z_abcd",
        type: "memory",
        title: "Roundtrip Test",
        tags: ["tag-a", "tag-b", "tag-c"],
        confidence: 0.75,
        createdAt: "2026-01-01T00:00:00.000Z",
        source: "episode_test_999",
    };

    const formatted = formatFrontMatter(meta);
    const content = `${formatted}\n\nBody text here.\n`;
    const parsed = parseFrontMatter(content);

    assert.strictEqual(parsed.id, meta.id);
    assert.strictEqual(parsed.type, meta.type);
    assert.strictEqual(parsed.title, meta.title);
    assert.deepStrictEqual(parsed.tags, meta.tags);
    assert.strictEqual(parsed.confidence, meta.confidence);
    assert.strictEqual(parsed.createdAt, meta.createdAt);
    assert.strictEqual(parsed.source, meta.source);
});

// ─── Front-Matter Parsing Tests ─────────────────────────────────

test("parseFrontMatter extracts key-value pairs", () => {
    const content = `---
id: "test_001"
title: "My Memory"
tags: [api, galactica]
confidence: 0.7
createdAt: "2026-03-13T05:00:00.000Z"
---

Body text here.`;

    const meta = parseFrontMatter(content);
    assert.strictEqual(meta.id, "test_001");
    assert.strictEqual(meta.title, "My Memory");
    assert.deepStrictEqual(meta.tags, ["api", "galactica"]);
    assert.strictEqual(meta.confidence, 0.7);
    assert.strictEqual(meta.createdAt, "2026-03-13T05:00:00.000Z");
});

test("parseFrontMatter returns empty object for no front-matter", () => {
    const meta = parseFrontMatter("Just plain text.");
    assert.deepStrictEqual(meta, {});
});

// ─── Memory Artifact Writer Tests ───────────────────────────────

test("writeMemoryArtifact writes markdown with front-matter and updates index", async () => {
    const base = tempDir("memory-write");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        const result = await writeMemoryArtifact({
            title: "Line chart needs data array",
            tags: ["line-chart", "galactica"],
            confidence: 0.8,
            body: "The line chart widget requires an explicit array of numbers.",
            source: "episode_test_001",
        });

        // Verify the artifact file exists and has correct content.
        assert.ok(result.id.startsWith("memory_"));
        assert.ok(fs.existsSync(result.path));

        const content = fs.readFileSync(result.path, "utf-8");
        assert.ok(content.includes("---"), "should have front-matter");
        assert.ok(content.includes("Line chart needs data array"), "should include title");
        assert.ok(content.includes("line-chart"), "should include tags");
        assert.ok(content.includes("0.8"), "should include confidence");
        assert.ok(content.includes("explicit array"), "should include body");

        // Verify the index was updated.
        const index = await readIndex("memory");
        assert.strictEqual(index.length, 1);
        assert.strictEqual(index[0].id, result.id);
        assert.strictEqual(index[0].title, "Line chart needs data array");
        assert.deepStrictEqual(index[0].tags, ["line-chart", "galactica"]);
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

// ─── Skill Artifact Writer Tests ────────────────────────────────

test("writeSkillArtifact writes markdown with front-matter and updates index", async () => {
    const base = tempDir("skill-write");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        const result = await writeSkillArtifact({
            title: "Use contrib.line for time series",
            tags: ["line-chart", "contrib"],
            confidence: 0.9,
            body: "Always use contrib.line() with explicit x/y data.",
            source: "episode_test_002",
        });

        assert.ok(result.id.startsWith("skill_"));
        assert.ok(fs.existsSync(result.path));

        const content = fs.readFileSync(result.path, "utf-8");
        assert.ok(content.includes("Use contrib.line"), "should include title");

        const index = await readIndex("skill");
        assert.strictEqual(index.length, 1);
        assert.strictEqual(index[0].id, result.id);
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

// ─── Exemplar Artifact Writer Tests ─────────────────────────────

test("writeExemplarArtifact writes markdown with episodeId and updates index", async () => {
    const base = tempDir("exemplar-write");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        const result = await writeExemplarArtifact({
            title: "Perfect dashboard layout",
            tags: ["dashboard", "layout"],
            episodeId: "episode_test_003",
            attemptNum: 3,
            body: "```javascript\nconsole.log('exemplar');\n```",
            source: "episode_test_003",
        });

        assert.ok(result.id.startsWith("exemplar_"));
        assert.ok(fs.existsSync(result.path));

        const content = fs.readFileSync(result.path, "utf-8");
        assert.ok(content.includes("episodeId"), "should include episodeId field");
        assert.ok(content.includes("attemptNum"), "should include attemptNum field");

        const index = await readIndex("exemplar");
        assert.strictEqual(index.length, 1);
        assert.strictEqual(index[0].title, "Perfect dashboard layout");
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

// ─── Anti-Pattern Artifact Writer Tests ─────────────────────────

test("writeAntiPatternArtifact writes markdown with front-matter and updates index", async () => {
    const base = tempDir("anti-pattern-write");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        const result = await writeAntiPatternArtifact({
            title: "Never use screen.render() in a loop",
            tags: ["performance", "render"],
            confidence: 0.95,
            body: "Calling screen.render() inside a tight loop causes flickering.",
            source: "episode_test_004",
        });

        assert.ok(result.id.startsWith("anti-pattern_"));
        assert.ok(fs.existsSync(result.path));

        const content = fs.readFileSync(result.path, "utf-8");
        assert.ok(content.includes("Never use screen.render()"), "should include title");
        assert.ok(content.includes('type: "anti-pattern"'), "should include type");

        const index = await readIndex("anti-pattern");
        assert.strictEqual(index.length, 1);
        assert.strictEqual(index[0].confidence, 0.95);
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

// ─── Index Manager Tests ────────────────────────────────────────

test("addToIndex appends entry and readIndex retrieves it", async () => {
    const base = tempDir("index-add");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        // Add two entries sequentially.
        await addToIndex("memory", {
            id: "mem_001", title: "First", tags: ["a"],
            path: "/fake/path/001.md", createdAt: "2026-01-01", confidence: 0.5,
        });
        await addToIndex("memory", {
            id: "mem_002", title: "Second", tags: ["b"],
            path: "/fake/path/002.md", createdAt: "2026-01-02", confidence: 0.7,
        });

        const entries = await readIndex("memory");
        assert.strictEqual(entries.length, 2);
        assert.strictEqual(entries[0].id, "mem_001");
        assert.strictEqual(entries[1].id, "mem_002");
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

test("readIndex returns empty array for non-existent index", async () => {
    const base = tempDir("index-empty");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();
        const entries = await readIndex("skill");
        assert.deepStrictEqual(entries, []);
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

test("indexPath throws for unknown type", () => {
    assert.throws(
        () => indexPath("bogus"),
        /unknown artifact type/,
        "should throw for unrecognized type"
    );
});

test("rebuildIndex reconstructs from front-matter on disk", async () => {
    const base = tempDir("index-rebuild");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        // Write two artifacts so there's content to rebuild from.
        await writeMemoryArtifact({
            title: "Rebuild Test A",
            tags: ["rebuild"],
            confidence: 0.6,
            body: "Body A",
            source: "ep_rebuild_a",
        });
        await writeMemoryArtifact({
            title: "Rebuild Test B",
            tags: ["rebuild"],
            confidence: 0.8,
            body: "Body B",
            source: "ep_rebuild_b",
        });

        // Verify initial index has 2 entries.
        const before = await readIndex("memory");
        assert.strictEqual(before.length, 2);

        // Delete the index file to simulate corruption.
        fs.unlinkSync(indexPath("memory"));

        // Rebuild should recreate from front-matter.
        const rebuilt = await rebuildIndex("memory");
        assert.strictEqual(rebuilt.length, 2);

        // Titles should match original artifacts.
        const titles = rebuilt.map((e) => e.title).sort();
        assert.deepStrictEqual(titles, ["Rebuild Test A", "Rebuild Test B"]);

        // Verify the rebuilt index is persisted.
        const afterRebuild = await readIndex("memory");
        assert.strictEqual(afterRebuild.length, 2);
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

test("rebuildIndex returns empty for empty directory", async () => {
    const base = tempDir("index-rebuild-empty");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();
        const rebuilt = await rebuildIndex("skill");
        assert.deepStrictEqual(rebuilt, []);
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

// ─── Prompt Snapshot Tests ──────────────────────────────────────

test("promptFilename generates correct name", () => {
    assert.strictEqual(promptFilename(1), "attempt_001-prompt.md");
    assert.strictEqual(promptFilename(12), "attempt_012-prompt.md");
    assert.strictEqual(promptFilename(100), "attempt_100-prompt.md");
});

test("savePromptSnapshot writes prompt text to episode dir", async () => {
    const dir = tempDir("prompt-snap");
    try {
        fs.mkdirSync(dir, { recursive: true });

        const promptText = "You are an Apprentice developer.\n\n## Task\n\nBuild a chart.";
        const savedPath = await savePromptSnapshot(dir, 1, promptText);

        assert.ok(fs.existsSync(savedPath));
        assert.ok(savedPath.endsWith("attempt_001-prompt.md"));

        const content = fs.readFileSync(savedPath, "utf-8");
        assert.strictEqual(content, promptText);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("savePromptSnapshot handles multiple attempts", async () => {
    const dir = tempDir("prompt-multi");
    try {
        fs.mkdirSync(dir, { recursive: true });

        await savePromptSnapshot(dir, 1, "Prompt for attempt 1");
        await savePromptSnapshot(dir, 2, "Prompt for attempt 2");
        await savePromptSnapshot(dir, 3, "Prompt for attempt 3");

        const files = fs.readdirSync(dir);
        assert.ok(files.includes("attempt_001-prompt.md"));
        assert.ok(files.includes("attempt_002-prompt.md"));
        assert.ok(files.includes("attempt_003-prompt.md"));

        // Verify content is distinct per attempt.
        const content2 = fs.readFileSync(path.join(dir, "attempt_002-prompt.md"), "utf-8");
        assert.strictEqual(content2, "Prompt for attempt 2");
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

// ─── Config Verification ────────────────────────────────────────

test("config has all learning paths", () => {
    assert.ok(CONFIG.paths.memories, "should have memories path");
    assert.ok(CONFIG.paths.skills, "should have skills path");
    assert.ok(CONFIG.paths.exemplars, "should have exemplars path");
    assert.ok(CONFIG.paths.antiPatterns, "should have antiPatterns path");
    assert.ok(CONFIG.paths.indexes, "should have indexes path");
    assert.ok(CONFIG.paths.prompts, "should have prompts path");
    assert.ok(CONFIG.paths.summaries, "should have summaries path");

    // All learning paths should resolve under learning/.
    for (const key of ["memories", "skills", "exemplars", "antiPatterns", "indexes", "prompts", "summaries"]) {
        assert.ok(
            CONFIG.paths[key].includes("learning"),
            `${key} path should be under learning/`
        );
    }
});

// ─── Default Confidence Tests ───────────────────────────────────

test("artifact writers use default confidence when not provided", async () => {
    const base = tempDir("default-conf");
    const handle = overrideConfigPaths(base);
    try {
        await bootstrapLearningDirs();

        const result = await writeMemoryArtifact({
            title: "Default confidence test",
            tags: [],
            body: "No confidence specified.",
            source: "ep_default",
        });

        const content = fs.readFileSync(result.path, "utf-8");
        // Default confidence should be 0.5.
        assert.ok(content.includes("confidence: 0.5"), "should default to 0.5");

        const index = await readIndex("memory");
        assert.strictEqual(index[0].confidence, 0.5);
    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});
