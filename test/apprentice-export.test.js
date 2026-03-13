/**
 * test/apprentice-export.test.js — E2E Test: Export and Cleanup
 *
 * Tests the Phase 8 learning export and cleanup logic.
 *
 * Runtime: Node.js test runner (node --test)
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const cp = require("child_process");

const { addToIndex } = require("../apprentice/index-manager");
const { bootstrapLearningDirs } = require("../apprentice/learning-store");
const { writeText } = require("../apprentice/filesystem");
const CONFIG = require("../apprentice/config");

function tempDir(prefix = "test-export") {
    const id = Math.random().toString(36).slice(2, 8);
    return path.join(os.tmpdir(), `${prefix}-${id}`);
}

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
 * Helper to run the CLI synchronously with custom data dir
 */
function runCli(args, dataDir) {
    const entrypoint = path.join(__dirname, "..", "apprentice.js");
    return cp.spawnSync("node", [entrypoint, ...args], {
        env: {
            ...process.env,
            APPRENTICE_DATA_DIR: dataDir
        },
        encoding: "utf-8"
    });
}

test("exportLearning bundles high-confidence artifacts through CLI", async () => {
    const base = tempDir("export-bundle");
    const handle = overrideConfigPaths(base);
    
    try {
        await bootstrapLearningDirs();

        // 1. Create a mock skill file and add to index
        const skillPath = path.join(base, "skills", "skill_1.md");
        fs.writeFileSync(skillPath, "Mock skill content");
        await addToIndex("skill", {
            id: "sk_1",
            title: "High confidence skill",
            tags: ["test"],
            confidence: 0.9,
            path: skillPath
        });

        // 2. Create a mock memory file with low confidence (should be filtered)
        const memPath = path.join(base, "memories", "mem_1.md");
        fs.writeFileSync(memPath, "Mock memory content");
        await addToIndex("memory", {
            id: "mem_1",
            title: "Low confidence memory",
            tags: ["test"],
            confidence: 0.3,
            path: memPath
        });

        // 3. Create a mock summary
        await writeText(path.join(base, "summaries", "test-summary.md"), "Mock summary");

        // 4. Run export via CLI
        const exportDir = path.join(base, "my-export");
        const result = runCli(["--export", exportDir], base);
        
        assert.strictEqual(result.status, 0, `CLI failed: ${result.stderr}`);

        // 5. Verify bundle contents
        const manifestPath = path.join(exportDir, "bundle-manifest.json");
        assert.ok(fs.existsSync(manifestPath), "Manifest should exist");
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        
        assert.strictEqual(manifest.contents.skills.length, 1);
        assert.strictEqual(manifest.contents.memories.length, 0, "Low confidence memory should be filtered");

        const bundledSkillPath = path.join(exportDir, "skills", "skill_1.md");
        assert.ok(fs.existsSync(bundledSkillPath), "Skill file should be copied");

        const bundledSummaryPath = path.join(exportDir, "summaries", "test-summary.md");
        assert.ok(fs.existsSync(bundledSummaryPath), "Summary should be copied");

    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});

test("runCleanupAndPromotion demotes low confidence skills through CLI", async () => {
    const base = tempDir("cleanup-rules");
    const handle = overrideConfigPaths(base);
    
    try {
        await bootstrapLearningDirs();

        const skillPath = path.join(base, "skills", "skill_demote.md");
        fs.writeFileSync(skillPath, "Mock skill content");
        await addToIndex("skill", {
            id: "sk_demote",
            title: "Low confidence skill",
            tags: ["test"],
            confidence: 0.2, // Below 0.4 threshold
            path: skillPath
        });

        const result = runCli(["--cleanup"], base);
        assert.strictEqual(result.status, 0, `CLI failed: ${result.stderr}`);
        
        // Assert demotion was actually written to the index (in-process config is already pointing to 'base' via handle)
        const { readIndex } = require("../apprentice/index-manager");
        const skills = await readIndex("skill");
        assert.strictEqual(skills[0].confidence, 0.1, "Skill should be demoted to 0.1");

    } finally {
        handle.restore();
        fs.rmSync(base, { recursive: true, force: true });
    }
});
