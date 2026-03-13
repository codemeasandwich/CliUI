/**
 * test/apprentice-pty.test.js — E2E Test: PTY Runner & Screen Normalizer
 *
 * Validates that the PTY-backed execution path and the ANSI-to-text
 * screen normalizer work end-to-end through the public module API.
 * Tests cover: PTY execution, ANSI normalization of cursor/color/box
 * sequences, timeout handling, fallback behavior, and episode artifact
 * persistence including the expanded Phase 2 file set.
 *
 * Runtime: Node.js test runner (node --test)
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Modules under test — public API only.
const { runScript, extractScript } = require("../apprentice/runner");
const { normalizeScreen, createGrid } = require("../apprentice/screen-normalize");
const { saveEpisode } = require("../apprentice/persistence");
const { isPtyAvailable } = require("../apprentice/pty-runner");
const CONFIG = require("../apprentice/config");

/**
 * Write a temporary test script and return its path.
 * Cleans up on process exit for hermetic tests.
 *
 * @param {string} content — JS source code
 * @returns {string} absolute path to the temp script
 */
function writeTempScript(content) {
    const id = Math.random().toString(36).slice(2, 8);
    const scriptPath = path.join(os.tmpdir(), `test-pty-${id}.js`);
    fs.writeFileSync(scriptPath, content, "utf-8");
    return scriptPath;
}

/**
 * Create a temporary directory for test episode persistence.
 * Returns the absolute path. Caller is responsible for cleanup.
 *
 * @returns {string} absolute path to temp episode dir
 */
function tempEpisodeDir() {
    const id = Math.random().toString(36).slice(2, 8);
    return path.join(os.tmpdir(), `test-episode-${id}`);
}

// ─── PTY Runner Tests ────────────────────────────────────────────

test("runScript executes a simple script and captures output", async () => {
    // Script prints a known string to stdout and exits cleanly.
    const script = writeTempScript('console.log("HELLO_PTY_TEST");');
    try {
        const result = await runScript(script, 10_000);

        // The output must contain our known string regardless of
        // whether PTY or fallback was used.
        assert.ok(
            result.stdout.includes("HELLO_PTY_TEST"),
            `stdout should contain 'HELLO_PTY_TEST', got: ${result.stdout.slice(0, 200)}`
        );
        assert.strictEqual(result.exitCode, 0);
        assert.strictEqual(result.timedOut, false);
        assert.ok(typeof result.durationMs === "number");
        assert.ok(typeof result.rawAnsi === "string");
    } finally {
        fs.unlinkSync(script);
    }
});

test("runScript captures stderr separately", async () => {
    // Script writes to stderr via console.error.
    const script = writeTempScript('console.error("ERR_PTY_TEST");');
    try {
        const result = await runScript(script, 10_000);

        assert.ok(
            result.stderr.includes("ERR_PTY_TEST"),
            `stderr should contain 'ERR_PTY_TEST', got: ${result.stderr.slice(0, 200)}`
        );
        assert.strictEqual(result.exitCode, 0);
    } finally {
        fs.unlinkSync(script);
    }
});

test("runScript enforces timeout", async () => {
    // Script that runs forever. The runner should kill it.
    const script = writeTempScript('setInterval(() => {}, 1000);');
    try {
        const result = await runScript(script, 1_000);

        assert.strictEqual(result.timedOut, true);
        assert.ok(result.durationMs >= 900, "should have waited ~1s");
    } finally {
        fs.unlinkSync(script);
    }
});

test("runScript captures non-zero exit code", async () => {
    const script = writeTempScript('process.exit(42);');
    try {
        const result = await runScript(script, 10_000);

        // PTY may report exit code differently for signal kills,
        // but a clean process.exit(42) should come through.
        assert.ok(result.exitCode !== 0, "exit code should be non-zero");
        assert.strictEqual(result.timedOut, false);
    } finally {
        fs.unlinkSync(script);
    }
});

test("runScript returns rawAnsi when PTY is available", async () => {
    if (!isPtyAvailable()) {
        // Skip if PTY is not available — the fallback path
        // correctly returns empty rawAnsi.
        return;
    }

    // Script that outputs ANSI-colored text via a real PTY.
    const script = writeTempScript(
        'process.stdout.write("\\x1b[31mRED\\x1b[0m");'
    );
    try {
        const result = await runScript(script, 10_000);

        // If PTY spawn succeeded, rawAnsi should contain the escape
        // sequences. If PTY spawn failed and we fell back to basic
        // runner, rawAnsi will be empty — that's acceptable.
        if (result.rawAnsi.length > 0) {
            assert.ok(
                result.rawAnsi.includes("RED"),
                "rawAnsi should contain the text 'RED'"
            );
        } else {
            // Fallback path: stdout should contain RED without ANSI
            // since piped stdio doesn't produce escape sequences.
            assert.ok(
                result.stdout.includes("RED"),
                "stdout should contain 'RED' in fallback mode"
            );
        }
    } finally {
        fs.unlinkSync(script);
    }
});

// ─── Screen Normalizer Tests ────────────────────────────────────

test("normalizeScreen handles plain text with newlines", () => {
    const input = "Hello\nWorld\n";
    const result = normalizeScreen(input, 80, 24);

    assert.ok(result.includes("Hello"), "should contain 'Hello'");
    assert.ok(result.includes("World"), "should contain 'World'");
});

test("normalizeScreen strips ANSI color codes", () => {
    // Red text followed by reset — only "Hello" should remain.
    const input = "\x1b[31mHello\x1b[0m";
    const result = normalizeScreen(input, 80, 24);

    assert.ok(result.includes("Hello"), "should contain 'Hello'");
    assert.ok(!result.includes("\x1b"), "should not contain ESC character");
    assert.ok(!result.includes("[31m"), "should not contain color code");
});

test("normalizeScreen positions text via CSI H cursor move", () => {
    // Move cursor to row 3, col 5 (1-based) then write "X".
    const input = "\x1b[3;5HX";
    const result = normalizeScreen(input, 80, 24);
    const lines = result.split("\n");

    // Row 3 (0-indexed line 2) should have "X" at position 4.
    assert.ok(lines.length >= 3, "should have at least 3 lines");
    assert.strictEqual(lines[2][4], "X", "X should be at col 5 (0-indexed 4)");
});

test("normalizeScreen handles erase display (CSI 2J)", () => {
    // Write some text, then clear the screen, then write new text.
    const input = "OLD\x1b[2J\x1b[1;1HNEW";
    const result = normalizeScreen(input, 80, 24);

    assert.ok(!result.includes("OLD"), "OLD should be erased");
    assert.ok(result.includes("NEW"), "NEW should be present");
});

test("normalizeScreen preserves box-drawing characters", () => {
    // Box-drawing characters used by TUI frameworks.
    const input = "┌──────┐\n│ Test │\n└──────┘\n";
    const result = normalizeScreen(input, 80, 24);

    assert.ok(result.includes("┌"), "should preserve top-left corner");
    assert.ok(result.includes("┐"), "should preserve top-right corner");
    assert.ok(result.includes("│"), "should preserve vertical bar");
    assert.ok(result.includes("└"), "should preserve bottom-left corner");
    assert.ok(result.includes("Test"), "should preserve label text");
});

test("normalizeScreen handles carriage return (\\r) overwrite", () => {
    // CR moves cursor back to column 0, then overwrite.
    const input = "AAAA\rBB";
    const result = normalizeScreen(input, 80, 24);
    const firstLine = result.split("\n")[0];

    // "AAAA" written first, then "BB" overwrites first 2 chars.
    assert.ok(
        firstLine.startsWith("BBAA"),
        `expected 'BBAA' at start, got '${firstLine.slice(0, 10)}'`
    );
});

test("normalizeScreen handles line wrapping", () => {
    // Write more chars than cols. Should wrap to the next line.
    const cols = 10;
    const input = "ABCDEFGHIJKLM";
    const result = normalizeScreen(input, cols, 5);
    const lines = result.split("\n");

    assert.strictEqual(lines[0], "ABCDEFGHIJ");
    assert.ok(lines[1].startsWith("KLM"), "overflow should wrap");
});

test("normalizeScreen handles scroll up on bottom overflow", () => {
    // Fill the entire screen (3 rows), then add another line.
    // The first line should scroll off.
    const input = "AAA\nBBB\nCCC\nDDD";
    const result = normalizeScreen(input, 80, 3);

    assert.ok(!result.includes("AAA"), "first line should have scrolled off");
    assert.ok(result.includes("BBB"), "second line should remain");
    assert.ok(result.includes("DDD"), "last line should be present");
});

test("normalizeScreen handles erase in line (CSI K)", () => {
    // Write text, move cursor back, erase to end of line.
    const input = "ABCDEF\x1b[1;4H\x1b[K";
    const result = normalizeScreen(input, 80, 24);
    const firstLine = result.split("\n")[0].trimEnd();

    // Cursor moved to col 4 (0-indexed 3), erase from there to EOL.
    // Should keep "ABC" and erase "DEF".
    assert.strictEqual(firstLine, "ABC");
});

test("createGrid creates correct dimensions", () => {
    const grid = createGrid(5, 10);

    assert.strictEqual(grid.length, 5, "should have 5 rows");
    assert.strictEqual(grid[0].length, 10, "should have 10 cols");
    assert.strictEqual(grid[0][0], " ", "should be filled with spaces");
});

// ─── Script Extraction Tests ────────────────────────────────────

test("extractScript handles markdown-fenced code", () => {
    const raw = "Here is the code:\n```javascript\nconsole.log('hi');\n```\n";
    const result = extractScript(raw);
    assert.strictEqual(result, "console.log('hi');");
});

test("extractScript handles raw code without fences", () => {
    const raw = "console.log('hi');";
    const result = extractScript(raw);
    assert.strictEqual(result, "console.log('hi');");
});

// ─── Persistence Tests ──────────────────────────────────────────

test("saveEpisode writes expanded Phase 2 artifact set", async () => {
    const dir = tempEpisodeDir();
    try {
        await saveEpisode(dir, {
            script: 'console.log("test");',
            rawAnsi: "\x1b[31mred\x1b[0m",
            screenText: "red\n",
            stdout: "red output",
            stderr: "some error",
            evaluatorResult: { score: 7, verdict: "pass", critique: "good" },
            metadata: { episodeId: "test-123", task: "test" },
        });

        // Verify all expected files exist with correct content.
        const files = fs.readdirSync(dir);
        assert.ok(files.includes("attempt_001.js"), "should have script");
        assert.ok(files.includes("attempt_001-raw.ansi"), "should have raw ANSI");
        assert.ok(files.includes("attempt_001-screen.txt"), "should have screen text");
        assert.ok(files.includes("attempt_001-stderr.txt"), "should have stderr");
        assert.ok(files.includes("attempt_001-evaluator.json"), "should have evaluator");
        assert.ok(files.includes("episode-meta.json"), "should have metadata");

        // Verify content of key files.
        const screenContent = fs.readFileSync(path.join(dir, "attempt_001-screen.txt"), "utf-8");
        assert.strictEqual(screenContent, "red\n");

        const rawContent = fs.readFileSync(path.join(dir, "attempt_001-raw.ansi"), "utf-8");
        assert.ok(rawContent.includes("\x1b[31m"), "raw ANSI should contain escape seq");

        const evalContent = JSON.parse(
            fs.readFileSync(path.join(dir, "attempt_001-evaluator.json"), "utf-8")
        );
        assert.strictEqual(evalContent.score, 7);

        const metaContent = JSON.parse(
            fs.readFileSync(path.join(dir, "episode-meta.json"), "utf-8")
        );
        assert.strictEqual(metaContent.episodeId, "test-123");
    } finally {
        // Cleanup temp episode dir.
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

// ─── Integration: Run + Normalize Pipeline ──────────────────────

test("end-to-end: run script → normalize → readable screen", async () => {
    // Script that prints a simple box-like TUI layout.
    const script = writeTempScript(
        [
            'process.stdout.write("\\x1b[2J\\x1b[1;1H");',
            'process.stdout.write("┌────────────┐\\n");',
            'process.stdout.write("│  Dashboard │\\n");',
            'process.stdout.write("└────────────┘\\n");',
        ].join("\n")
    );

    try {
        const result = await runScript(script, 10_000);
        const raw = result.rawAnsi || result.stdout;
        const screen = normalizeScreen(raw, 80, 24);

        // The normalized screen should contain the box characters
        // and the label, without ANSI escape sequences.
        assert.ok(screen.includes("Dashboard"), "should contain 'Dashboard'");
        assert.ok(screen.includes("┌"), "should contain box corner");
        assert.ok(!screen.includes("\x1b"), "should not contain raw ESC");
    } finally {
        fs.unlinkSync(script);
    }
});

// ─── Config Verification ────────────────────────────────────────

test("config includes terminal environment overrides", () => {
    assert.strictEqual(CONFIG.terminal.env.LANG, "en_US.utf8");
    assert.strictEqual(CONFIG.terminal.env.TERM, "xterm-256color");
    assert.strictEqual(CONFIG.terminal.cols, 80);
    assert.strictEqual(CONFIG.terminal.rows, 24);
});

// ─── Edge Case Tests (audit-discovered) ─────────────────────────

test("normalizeScreen handles empty input", () => {
    const result = normalizeScreen("", 80, 24);
    // Empty input should produce a trailing newline and nothing else.
    assert.strictEqual(result, "\n");
});

test("normalizeScreen skips OSC sequences (window title)", () => {
    // OSC: ESC ] 0;Title BEL — sets window title, should be skipped.
    const input = "\x1b]0;My Title\x07Hello";
    const result = normalizeScreen(input, 80, 24);

    assert.ok(result.includes("Hello"), "text after OSC should render");
    assert.ok(!result.includes("My Title"), "OSC title should not render");
});

test("normalizeScreen handles backspace correctly", () => {
    // Write "ABC", backspace, write "X" → "ABX"
    const input = "ABC\bX";
    const result = normalizeScreen(input, 80, 24);
    const firstLine = result.split("\n")[0].trimEnd();

    assert.strictEqual(firstLine, "ABX");
});

test("normalizeScreen handles tab stops", () => {
    // Tab should advance to the next 8-col boundary.
    const input = "A\tB";
    const result = normalizeScreen(input, 80, 24);
    const firstLine = result.split("\n")[0];

    // "A" at col 0, tab to col 8, "B" at col 8.
    assert.strictEqual(firstLine[0], "A");
    assert.strictEqual(firstLine[8], "B");
    // Columns 1-7 should be spaces.
    for (let c = 1; c < 8; c++) {
        assert.strictEqual(firstLine[c], " ", `col ${c} should be space`);
    }
});

test("runScript handles script path with spaces", async () => {
    // Create a temp script with a space in its path to verify
    // the shell quoting fix in the PTY runner.
    const id = Math.random().toString(36).slice(2, 8);
    const dir = path.join(os.tmpdir(), `test dir ${id}`);
    fs.mkdirSync(dir, { recursive: true });
    const scriptPath = path.join(dir, "my script.js");
    fs.writeFileSync(scriptPath, 'console.log("SPACE_PATH_OK");', "utf-8");

    try {
        const result = await runScript(scriptPath, 10_000);
        assert.ok(
            result.stdout.includes("SPACE_PATH_OK"),
            `stdout should contain 'SPACE_PATH_OK', got: ${result.stdout.slice(0, 200)}`
        );
        assert.strictEqual(result.exitCode, 0);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
