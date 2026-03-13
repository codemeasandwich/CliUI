/**
 * test/apprentice-deterministic.test.js — E2E Test: Deterministic Checks & Hybrid Scoring
 *
 * Validates the new Phase 6 scoring integration. Tests the checks
 * separately, and the hybrid scorer combination logic.
 *
 * Runtime: Node.js test runner (node --test)
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { runDeterministicChecks } = require("../apprentice/deterministic");
const { calculateHybridScore } = require("../apprentice/hybrid-scorer");

// ─── Deterministic Checks Tests ────────────────────────────────────

test("runDeterministicChecks: passes minimum requirements for empty task", () => {
    const task = {}; // no special expectations
    const runResult = { screenText: "Hello world\n", exitCode: 0, timedOut: false };
    
    const detResult = runDeterministicChecks(task, runResult);
    
    assert.strictEqual(detResult.failedChecks.length, 0);
    assert.ok(detResult.passedChecks.includes("output_not_empty"));
    assert.ok(detResult.passedChecks.includes("runtime_success"));
});

test("runDeterministicChecks: fails on empty output", () => {
    const task = {};
    const runResult = { screenText: "   \n  \n", exitCode: 0, timedOut: false };
    
    const detResult = runDeterministicChecks(task, runResult);
    
    assert.ok(detResult.failedChecks.some(f => f.includes("output_not_empty")));
    assert.ok(detResult.passedChecks.includes("runtime_success"));
});

test("runDeterministicChecks: fails on non-zero exit code or timeout", () => {
    const task = {};
    const runResult1 = { screenText: "Crash", exitCode: 1, timedOut: false };
    const runResult2 = { screenText: "Hang", exitCode: null, timedOut: true };
    
    const detResult1 = runDeterministicChecks(task, runResult1);
    const detResult2 = runDeterministicChecks(task, runResult2);
    
    assert.ok(detResult1.failedChecks.some(f => f.includes("runtime_success")));
    assert.ok(detResult2.failedChecks.some(f => f.includes("runtime_success")));
});

test("runDeterministicChecks: evaluates required and forbidden texts", () => {
    const task = {
        requiredTexts: ["Welcome", "Dashboard"],
        forbiddenTexts: ["Error", "Undefined"]
    };
    
    const runResult = { screenText: "Welcome to Dashboard\nNothing wrong here", exitCode: 0, timedOut: false };
    const detResult = runDeterministicChecks(task, runResult);
    
    assert.strictEqual(detResult.failedChecks.length, 0);
    assert.ok(detResult.passedChecks.includes("required_text_'Welcome'"));
    assert.ok(detResult.passedChecks.includes("forbidden_text_'Error'"));
});

test("runDeterministicChecks: fails when required text is missing", () => {
    const task = { requiredTexts: ["Welcome"] };
    const runResult = { screenText: "Hello there", exitCode: 0, timedOut: false };
    
    const detResult = runDeterministicChecks(task, runResult);
    assert.ok(detResult.failedChecks.some(f => f.includes("required_text_'Welcome'")));
});

test("runDeterministicChecks: evaluates borders", () => {
    const task = { expectsBorder: true };
    
    const passResult = { screenText: "┌─────┐\n│ Box │\n└─────┘\n", exitCode: 0, timedOut: false };
    const failResult = { screenText: "No borders here\njust text", exitCode: 0, timedOut: false };
    
    assert.strictEqual(runDeterministicChecks(task, passResult).failedChecks.length, 0);
    assert.ok(runDeterministicChecks(task, failResult).failedChecks.some(f => f.includes("expects_border")));
});

test("runDeterministicChecks: evaluates titleMode", () => {
    const detachedTask = { titleMode: "detached" };
    const embeddedTask = { titleMode: "embedded" };
    
    const detachedScreen = "\nTitle Header\n┌─────┐\n│ Box │\n└─────┘\n";
    const embeddedScreen = "┌──────────┐\n│ Title Header │\n└──────────┘\n";
    
    // Detached title should pass detached but fail embedded
    assert.strictEqual(runDeterministicChecks(detachedTask, { screenText: detachedScreen, exitCode: 0, timedOut: false }).failedChecks.length, 0);
    assert.ok(runDeterministicChecks(embeddedTask, { screenText: detachedScreen, exitCode: 0, timedOut: false }).failedChecks.some(f => f.includes("title_mode_embedded")));
    
    // Embedded title should pass embedded but fail detached
    assert.strictEqual(runDeterministicChecks(embeddedTask, { screenText: embeddedScreen, exitCode: 0, timedOut: false }).failedChecks.length, 0);
    assert.ok(runDeterministicChecks(detachedTask, { screenText: embeddedScreen, exitCode: 0, timedOut: false }).failedChecks.some(f => f.includes("title_mode_detached")));
});

// ─── Hybrid Scorer Tests ─────────────────────────────────────────

test("calculateHybridScore: perfect score", () => {
    const evaluator = { score: 10, verdict: "pass", critique: "Perfect", suggested_next_change: "" };
    const detResult = { passedChecks: ["runtime_success"], failedChecks: [] };
    
    const hybrid = calculateHybridScore(evaluator, detResult);
    
    assert.strictEqual(hybrid.finalScore, 10);
    assert.strictEqual(hybrid.verdict, "pass");
});

test("calculateHybridScore: penalizes and downgrades verdict", () => {
    const evaluator = { score: 9, verdict: "pass", critique: "Looks good", suggested_next_change: "" };
    // Missing border is standard penalty (-2)
    const detResult = { passedChecks: ["runtime_success"], failedChecks: ["expects_border: missing"] };
    
    const hybrid = calculateHybridScore(evaluator, detResult);
    
    assert.strictEqual(hybrid.finalScore, 7);
    assert.strictEqual(hybrid.verdict, "partial");
});

test("calculateHybridScore: severe penalties clamp and force failure", () => {
    const evaluator = { score: 10, verdict: "pass", critique: "Great output", suggested_next_change: "" };
    // Process crash is severe penalty (-5)
    const detResult = { passedChecks: [], failedChecks: ["runtime_success: crash"] };
    
    const hybrid = calculateHybridScore(evaluator, detResult);
    
    assert.ok(hybrid.finalScore <= 5);
    // Severe failure caps the score at 4 to force fail when starting high
    assert.strictEqual(hybrid.verdict, "fail");
    assert.ok(hybrid.finalScore <= 4);
});
