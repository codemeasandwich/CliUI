# Apprentice Module Reference & Extension Guide

Complete API reference for all 29 modules in the Apprentice system, organized by subsystem. Each entry documents the module's purpose, public functions, and key behaviors.

---

## Core Loop

### apprentice.js (parent directory)

Entry point and CLI argument parser. Orchestrates the full episode lifecycle.

**Public Functions:**

```javascript
async function runEpisode(task, disableRetrieval = false)
```
- **task**: `{ request, wireframe?, cols?, rows? }` — task payload
- **disableRetrieval**: `boolean` — skip learning artifact retrieval
- **Returns**: `{ episodeDir: string, summary: object }`
- **Side effects**: Bootstraps learning dirs, connects gateway, runs attempt loop, saves summary, distills artifacts, closes gateway
- **Failure**: Gateway connection is closed in `finally` block regardless of errors

```javascript
async function main()
```
- Parses `process.argv` for CLI flags
- Routes to the appropriate run mode
- Sets `process.exitCode = 1` on unhandled errors

**CLI Flags:**

| Flag | Mode | Description |
|------|------|-------------|
| (none) | default | Run one episode with the hardcoded TASK |
| `--benchmark <id>` | benchmark | Run a single benchmark task by ID |
| `--benchmark-all` | benchmark-all | Run all benchmark tasks |
| `--compare-benchmarks` | compare | Run suite twice (without/with retrieval), print delta |
| `--replay <episodeId>` | replay | Re-run a past episode's task |
| `--export [dir]` | export | Bundle high-confidence artifacts |
| `--cleanup` | cleanup | Promote, merge, demote, regenerate summaries |
| `--no-retrieval` | modifier | Disable retrieval (combinable with any mode) |

---

### attempt-loop.js

Multi-attempt refinement loop with stop condition detection.

**Public Functions:**

```javascript
async function runSingleAttempt(api, prompt, task, attemptNum)
```
- **api**: connected api-ape client
- **prompt**: compiled prompt text (base or revision)
- **task**: task payload
- **attemptNum**: 1-based attempt number
- **Returns**: Full attempt result object (see Data Structures below)
- **Flow**: prompt -> askApprentice -> extractScript -> runScript -> normalizeScreen -> evaluate -> deterministic checks -> hybrid score

```javascript
async function runAttemptLoop(api, task, episodeDir, disableRetrieval = false)
```
- **Returns**: `{ history: object[], stopReason: string, retrievedLearning: object|null }`
- **Stop reasons**: `"pass_threshold"`, `"no_progress"`, `"max_attempts"`, `"runner_error"`
- **Key behavior**: Retrieval happens once per episode (not per attempt). Prompt snapshots are saved before LLM calls. Artifacts are persisted immediately after each attempt.

---

### runner.js

Script extraction from LLM responses and execution dispatch.

**Public Functions:**

```javascript
function extractScript(response)
```
- **response**: raw LLM response string
- **Returns**: clean JavaScript source code
- **Behavior**: Extracts from ````javascript` or ````js` fenced blocks. Falls back to trimmed full response if no fences found. Returns empty string for falsy input.

```javascript
async function runScript(scriptPath, timeoutMs)
```
- **scriptPath**: absolute path to the `.js` file
- **timeoutMs**: max execution milliseconds
- **Returns**: `{ stdout, stderr, rawAnsi, exitCode, timedOut, durationMs }`
- **Behavior**: Prefers PTY execution. Falls back to `child_process.spawn` if PTY unavailable or fails. Catches catastrophic errors and returns them as valid result objects with `exitCode: 1`.

---

## Execution

### pty-runner.js

PTY-backed script execution that captures real ANSI terminal output.

**Public Functions:**

```javascript
function isPtyAvailable()
```
- **Returns**: `boolean` — whether node-pty loaded successfully (cached)

```javascript
async function runScriptPty(scriptPath, timeoutMs)
```
- **Returns**: `{ stdout: "", stderr, rawAnsi, exitCode, timedOut, durationMs }`
- **Behavior**: Spawns script in an 80x24 xterm-256color PTY. Captures raw ANSI stream from PTY data events. Redirects stderr to a temp file (PTY merges stdout/stderr by default). Kills process on timeout via SIGTERM.
- **Failure**: Returns `stderr: "PTY spawn error: ..."` on spawn failure, triggering fallback in runner.js.

---

### screen-normalize.js

Converts raw ANSI byte stream into a plain-text final-frame representation.

**Public Functions:**

```javascript
function normalizeScreen(rawAnsi, cols = 80, rows = 24)
```
- **rawAnsi**: raw terminal output string with escape sequences
- **cols/rows**: virtual terminal dimensions
- **Returns**: plain-text string representing the final screen state
- **Behavior**: Creates a virtual `cols x rows` character grid. Processes escape sequences via `screen-csi.js`. Handles newlines, tabs, backspace, carriage return, word wrapping, and scrolling. Returns grid serialized as string with trailing whitespace trimmed per line.

---

### screen-csi.js

CSI (Control Sequence Introducer) escape sequence processor.

**Public Functions:**

```javascript
function processCsi(grid, cursorState, params, command, cols, rows)
```
- **grid**: 2D character array
- **cursorState**: `{ row, col }` mutable cursor position
- **params**: parsed CSI parameter array
- **command**: single-character command (A/B/C/D/H/f/J/K/S/T/m)
- **Returns**: void (mutates grid and cursorState in place)

**Supported CSI Commands:**

| Command | Function |
|---------|----------|
| A | Cursor up N rows |
| B | Cursor down N rows |
| C | Cursor forward N columns |
| D | Cursor back N columns |
| H, f | Cursor absolute position (row;col) |
| J | Erase display (0=below, 1=above, 2=all) |
| K | Erase line (0=right, 1=left, 2=all) |
| S | Scroll up N lines |
| T | Scroll down N lines |
| m | SGR (Select Graphic Rendition) — stripped, no color tracking |

---

## Prompts

### prompts.js

Prompt builders for both LLM actors.

**Public Functions:**

```javascript
function buildApprenticePrompt(task, retrievedLearning)
```
- **Returns**: full prompt string including task, wireframe, terminal dimensions, repository paths, output format instructions, and learning section
- **Key details**: Instructs model to return ONLY runnable JavaScript. Lists available repo paths (README.md, COOKBOOK.md, docs/, examples/, lib/, test/). Appends formatted learning section with skills, memories, anti-patterns, and exemplars.

```javascript
function buildEvaluatorPrompt(task, runResult)
```
- **runResult**: `{ screenText, stderr, exitCode, timedOut }`
- **Returns**: prompt string with task, wireframe, captured output, and scoring instructions
- **Invariant**: Never includes the generated script. Instructs model to return JSON: `{ score, verdict, critique, suggested_next_change }`.

```javascript
function formatLearningSection(retrieved)
```
- **Returns**: markdown-formatted learning section or empty string
- **Truncation**: Skills body capped at 300 chars, memories/anti-patterns at 200 chars, exemplars at 500 chars

---

### revision-prompt.js

Revision prompts for attempts 2+ that include prior feedback.

**Public Functions:**

```javascript
function buildRevisionPrompt(task, priorAttempt, attemptNum, retrievedLearning)
```
- **priorAttempt**: previous attempt result object
- **Returns**: prompt including original task, previous script, real execution results (screen, stderr, exit code, timeout), evaluator feedback (score, verdict, critique, suggested change), and learning context
- **Behavior**: Instructs model to revise based on real feedback, not speculation

---

## Evaluation

### evaluator.js

Evaluator LLM invocation and structured response parsing.

**Public Functions:**

```javascript
async function evaluate(api, prompt)
```
- **Returns**: `{ score, verdict, critique, suggested_next_change }` or `{ score: 0, verdict: "fail", critique: "...", _parse_error: true }`
- **Behavior**: Calls `askEvaluator()`, attempts JSON parse of response. Falls back to extracting JSON from markdown fences. Returns structured error object on parse failure (never throws).

---

### deterministic.js

Rule-based checks producing pass/fail signals from execution output.

**Public Functions:**

```javascript
function runDeterministicChecks(task, runResult)
```
- **Returns**: `{ passedChecks: string[], failedChecks: string[] }`
- **Never throws** — gracefully handles missing properties

**Checks Performed:**

| Check Name | Condition | Always Runs |
|-----------|-----------|-------------|
| `output_not_empty` | Screen has non-whitespace content | Yes |
| `runtime_success` | Exit code 0 AND not timed out | Yes |
| `required_text_'X'` | Each text in `task.requiredTexts[]` present | If `requiredTexts` set |
| `forbidden_text_'X'` | Forbidden texts absent | If `forbiddenTexts` set |
| `expects_border` | Box-drawing characters found | If `expectsBorder` true |
| `title_text_present` | Specific title string found | If `titleText` set |
| `expects_footer` | Alphanumeric text in last 3 non-empty lines | If `expectsFooter` true |
| `title_mode_detached` | First content row has text but no borders | If `titleMode` = "detached" |
| `title_mode_embedded` | First content row has border characters | If `titleMode` = "embedded" |
| `within_terminal_bounds` | Output lines <= terminal rows + 1 | Yes |

---

### hybrid-scorer.js

Merges subjective LLM score with objective deterministic penalties.

**Public Functions:**

```javascript
function calculateHybridScore(evaluatorResult, detResult)
```
- **Returns**: Extended result object:
  ```javascript
  {
    evaluatorScore: number,      // Original LLM score
    deterministicPenalty: number, // Total penalty applied
    finalScore: number,          // Clamped 0-10 result
    score: number,               // Alias for finalScore (compatibility)
    verdict: string,             // "pass" | "partial" | "fail"
    evaluatorVerdict: string,    // Original LLM verdict
    passedChecks: string[],
    failedChecks: string[],
    critique: string,
    suggested_next_change: string
  }
  ```

**Penalty Schedule:**

| Failed Check | Penalty | Severity |
|-------------|---------|----------|
| `runtime_success` | -5 | Critical (caps score at 3) |
| `output_not_empty` | -4 | Critical (caps score at 3) |
| All others | -2 each | Standard |

**Verdict Rules:**
- Score >= 8 implies "pass", 4-7 implies "partial", < 4 implies "fail"
- Any deterministic failure prevents "pass" (forces "partial" at best)
- Verdict is only downgraded from the evaluator's original, never upgraded

---

## Learning

### retrieve.js

Keyword-based artifact retrieval for prompt injection.

**Public Functions:**

```javascript
async function retrieveForTask(task)
```
- **Returns**: `{ skills: [], memories: [], exemplars: [], antiPatterns: [] }`
- Each entry: `{ id, title, tags, confidence, body }`
- **Behavior**: Extracts keywords from task request + wireframe. Scores all index entries by title overlap + tag overlap + confidence bonus. Returns top-N per type with full bodies loaded.

```javascript
function scoreEntry(entry, keywords)
```
- **Returns**: relevance score (higher = more relevant)
- **Formula**: `titleHits + tagHits + (confidence * 0.5)`. Returns 0 if no keyword matches.

```javascript
function extractKeywords(text)
```
- **Returns**: deduplicated lowercase tokens (>= 3 chars)

```javascript
function hasRetrievedContent(retrieved)
```
- **Returns**: `boolean` — true if any arrays are non-empty

```javascript
function retrievedIds(retrieved)
```
- **Returns**: flat array of all artifact IDs across all types

```javascript
async function loadArtifactBody(entry)
```
- **Returns**: markdown body text with front-matter stripped

---

### distill.js

Post-episode learning artifact extraction.

**Public Functions:**

```javascript
async function distillEpisode(episodeId, task, history, stopReason)
```
- **Returns**: `{ created: [{ type, id, path }] }`
- **Behavior**: Runs all four extraction routines. Safe with empty history.

```javascript
async function extractMemories(task, history, source)
```
- **Trigger**: Failing attempts with critique > 20 chars
- **Confidence**: `min(0.7, 0.4 + (1 - score/10) * 0.3)` — lower scores produce higher confidence
- **Tags**: Extracted from task request + critique text

```javascript
async function extractExemplar(episodeId, task, history)
```
- **Trigger**: At least one attempt scoring >= passThreshold
- **Confidence**: `min(1.0, 0.8 + (bestScore - passThreshold) * 0.02)`
- **Returns**: `{ type, id, path }` or `null`

```javascript
async function extractAntiPatterns(task, history, source)
```
- **Trigger**: 2+ consecutive failures with identical scores
- **Confidence**: `min(0.9, 0.6 + (repetitions - 2) * 0.1)`

```javascript
async function maybeExtractSkill(episodeId, task, history)
```
- **Gates** (all must pass):
  1. Final score >= passThreshold (7)
  2. Final score >= 8
  3. Converged in <= 2 attempts
- **Confidence**: `min(1.0, 0.85 + (finalScore - 8) * 0.05)`

```javascript
function extractTags(text)
```
- **Returns**: deduplicated lowercase keyword tokens from text

---

### artifact-writers.js

Creates markdown artifacts with YAML front-matter and updates indexes.

**Public Functions:**

```javascript
async function writeMemoryArtifact({ title, tags, confidence, body, source })
async function writeSkillArtifact({ title, tags, confidence, body, source, extra? })
async function writeExemplarArtifact({ title, tags, confidence, body, source, episodeId, attemptNum })
async function writeAntiPatternArtifact({ title, tags, confidence, body, source })
```

All writers follow the same pipeline:
1. Generate unique ID via `artifactId(type)`
2. Format YAML front-matter header
3. Write markdown file to the type's directory
4. Add entry to the JSON index via `addToIndex()`
5. Return `{ id, path }`

---

### learning-store.js

Directory bootstrapping and ID generation.

**Public Functions:**

```javascript
async function bootstrapLearningDirs()
```
- Creates 10 subdirectories under the learning base path
- Idempotent — safe on repeat calls

```javascript
function artifactId(type)
```
- **Returns**: `"<type>_<timestamp>_<4-hex>"` (e.g., `"memory_2026-03-13T05_00_00.000Z_a3f1"`)

---

## Persistence

### filesystem.js

Shared filesystem abstractions.

**Public Functions:**

```javascript
async function ensureDirectory(dirPath)       // Recursive mkdir
async function writeText(filePath, content)   // UTF-8 file write
function timestamp()                          // ISO 8601 with colons -> underscores
function episodeId()                          // "episode_<timestamp>_<4-hex>"
function attemptFilename(attemptNum)          // "attempt_NNN.js" (zero-padded)
```

---

### persistence.js

Per-attempt artifact saving to episode directories.

**Public Functions:**

```javascript
async function saveAttempt(episodeDir, attemptNum, artifacts, retrievedArtifactIds)
```

**Files Written:**

| File | Content |
|------|---------|
| `attempt_NNN.js` | Generated script |
| `attempt_NNN-raw.ansi` | Raw PTY output (if non-empty) |
| `attempt_NNN-screen.txt` | Normalized plain text |
| `attempt_NNN-stderr.txt` | Captured errors |
| `attempt_NNN-evaluator.json` | Evaluator scoring result |
| `attempt_NNN-retrieved.json` | Retrieved artifact IDs (if non-empty) |

---

### episode-summary.js

Episode summary construction and serialization.

**Public Functions:**

```javascript
function buildSummary(episodeId, task, history, stopReason)
```
- **Returns**: Summary object with `episodeId`, `task`, `totalAttempts`, `scores[]`, `verdicts[]`, `finalScore`, `finalVerdict`, `stopReason`, `timestamp`, and per-attempt metadata

```javascript
async function saveEpisodeSummary(episodeDir, summary)
```
- Writes `episode-summary.json` to the episode directory

---

### prompt-snapshot.js

Prompt text saving for debugging and replay.

**Public Functions:**

```javascript
async function savePromptSnapshot(episodeDir, attemptNum, promptText)
```
- Writes `attempt_NNN-prompt.md` to the episode directory

---

### front-matter.js

Minimal YAML front-matter parser (zero external dependencies).

**Public Functions:**

```javascript
function parseFrontMatter(content)
```
- **Returns**: `{ data: object, body: string }` — parsed metadata and remaining content
- **Handles**: Quoted strings, numbers, inline arrays `[a, b, c]`, ISO timestamps
- **Returns** `{ data: {}, body: content }` if no front-matter found or parsing fails

---

### index-manager.js

JSON index maintenance with self-healing rebuild capability.

**Public Functions:**

```javascript
async function readIndex(type)
```
- **type**: `"skill"` | `"memory"` | `"exemplar"` | `"anti-pattern"`
- **Returns**: array of index entries (empty array if file doesn't exist)

```javascript
async function addToIndex(type, entry)
```
- Upserts entry by ID (updates existing or appends new)
- Enriches with defaults: `confidence: 0.5`, `createdAt`, `supportingEvidence: []`, `relatedArtifacts: []`

```javascript
async function rebuildIndex(type)
```
- Scans the artifact directory for `.md` files
- Parses front-matter from each file
- Reconstructs the full JSON index from disk
- Self-healing: recovers from corrupted or out-of-sync indexes

---

## Lifecycle

### promotion.js

Learning artifact lifecycle management.

**Public Functions:**

```javascript
function tagSimilarity(tagsA, tagsB)
```
- **Returns**: Jaccard similarity (0.0 - 1.0)

```javascript
function groupSimilarArtifacts(artifacts, similarityThreshold = 0.5)
```
- **Returns**: array of grouped artifact arrays (O(N^2) clustering)

```javascript
async function getMemoryMergePlan()
```
- **Returns**: `[{ primary, supersede: [], combinedEvidence: [] }]`
- Uses 0.6 similarity threshold for memory grouping

```javascript
async function getPromotionPlan()
```
- **Returns**: `[{ sourceMemory, reason }]`
- **Promotion criteria**: Evidence >= 3 episodes, OR confidence >= 0.99 (manual), OR tags include "docs"/"source"

```javascript
async function runCleanupAndPromotion()
```
- **Returns**: `{ promotions: number, antiPatternMerges: number, demotedSkills: number }`
- **Operations**: Promote memories to skills (+0.2 confidence), merge duplicate anti-patterns (0.7 threshold, +0.1 per merge), demote skills with confidence < 0.4

---

### summary-generator.js

Rollup reports and prompt packs.

**Public Functions:**

```javascript
async function generateSummaries()
```
- Writes `common-mistakes.md` (top 10 anti-patterns by confidence)
- Writes `reliable-techniques.md` (top 10 skills by confidence)

```javascript
async function generatePromptPacks()
```
- Groups memories by tag frequency
- Creates `prompt-pack-<tag>.md` for top 3 tags
- Each pack contains top 5 memories by confidence for that tag

---

### export.js

Portable bundle creation with confidence filtering.

**Public Functions:**

```javascript
async function exportLearning(outDir)
```
- **outDir**: target directory (defaults to `learning/exports/export_<timestamp>/`)
- **Returns**: path to the finished bundle directory
- **Confidence thresholds**: Skills >= 0.6, Memories >= 0.7, Exemplars >= 0.8
- **Bundle contents**: skills/, memories/, exemplars/, summaries/, prompts/, bundle-manifest.json

---

## Benchmarking

### benchmark-loader.js

Benchmark task loading and schema validation.

**Public Functions:**

```javascript
function validateBenchmark(task)
```
- Throws if `id`, `title`, or `request` are missing or not non-empty strings

```javascript
async function loadBenchmarkTask(id)
```
- Loads `learning/benchmarks/<id>.json`, validates, returns task object

```javascript
async function loadAllBenchmarkTasks()
```
- Loads all `*.json` files from the benchmarks directory
- Skips invalid files with console warnings

---

### benchmark-runner.js

Suite execution with aggregate reporting.

**Public Functions:**

```javascript
async function runBenchmarkSuite(api, tasks, disableRetrieval = false)
```
- **Returns**: aggregate report object
- **Behavior**: Runs each task through the attempt loop. Does NOT distill (prevents test contamination). Saves per-task and aggregate JSON reports to `learning/benchmarks/reports/`.
- **Aggregate metrics**: passRate, meanScore, medianScore, attemptsToSuccessDist, helpfulArtifacts, commonFailureTypes

---

### replay-runner.js

Episode replay from saved summaries.

**Public Functions:**

```javascript
function loadEpisodeTask(episodeId)
```
- Loads task from `learning/episodes/<episodeId>/episode-summary.json`
- Patches legacy summaries missing `id`/`title` fields
- Returns validated task object

---

## Infrastructure

### config.js

Centralized configuration. Exported as a single `CONFIG` object. See [SETUP.md](SETUP.md) for the full reference table.

---

### gateway.js

WebSocket connection to the LLM Gateway via api-ape.

**Public Functions:**

```javascript
async function connectGateway(api)
```
- Calls `api.connect()` and waits for `"connected"` state
- 10-second timeout on handshake

```javascript
async function requestLLM(api, prompt, provider, model)
```
- Sends prompt to gateway, streams response tokens, buffers into single string
- 5-minute hard timeout on stream completion
- Rejects on stream error, empty response with non-zero exit code, or timeout

```javascript
async function askApprentice(api, prompt)
```
- Wrapper: routes to `CONFIG.apprenticeProvider` / `CONFIG.apprenticeModel`

```javascript
async function askEvaluator(api, prompt)
```
- Wrapper: routes to `CONFIG.evaluatorProvider` / `CONFIG.evaluatorModel`

---

### progress-detect.js

No-progress detection to stop stalled loops early.

**Public Functions:**

```javascript
function detectNoProgress(history)
```
- **Returns**: `{ stalled: boolean, reason: string }`
- **Window**: Last `noProgressCutoff + 1` attempts (default 4)
- **Signals** (any one triggers stall):
  1. All consecutive scripts > 0.95 similar (character-level)
  2. All consecutive screens > 0.95 similar
  3. All scores identical across the window

```javascript
function similarity(a, b)
```
- **Returns**: 0.0 - 1.0 character-level positional match ratio

---

## Data Structures

### Task Payload

```javascript
{
  id: string,                    // Unique task identifier (required for benchmarks)
  title: string,                 // Human-readable title (required for benchmarks)
  request: string,               // Plain English task description (always required)
  wireframe: string,             // Optional ASCII art layout
  cols: number,                  // Terminal width (default 80)
  rows: number,                  // Terminal height (default 24)
  requiredTexts: string[],       // Texts that must appear in output
  forbiddenTexts: string[],      // Texts that must NOT appear
  expectsBorder: boolean,        // Whether box-drawing chars are expected
  titleText: string,             // Specific title to look for
  titleMode: string,             // "detached" | "embedded" | "either"
  expectsFooter: boolean         // Whether footer text is expected
}
```

### Attempt Result

```javascript
{
  attemptNum: number,
  script: string,                // Generated JavaScript
  screenText: string,            // Normalized plain-text output
  rawAnsi: string,               // Raw ANSI stream from PTY
  stdout: string,
  stderr: string,
  exitCode: number,
  timedOut: boolean,
  durationMs: number,
  score: number,                 // 0-10 hybrid score
  verdict: string,               // "pass" | "partial" | "fail"
  evaluatorResult: {             // Full hybrid scoring payload
    evaluatorScore: number,
    deterministicPenalty: number,
    finalScore: number,
    score: number,
    verdict: string,
    evaluatorVerdict: string,
    passedChecks: string[],
    failedChecks: string[],
    critique: string,
    suggested_next_change: string
  }
}
```

### Artifact Front-Matter

```yaml
---
id: "memory_2026-03-13T05_00_00.000Z_a3f1"
type: "memory"
title: "Critique from attempt 2: ..."
tags: [terminal, layout, spacing]
confidence: 0.65
createdAt: "2026-03-13T05:00:00.000Z"
source: "episode_2026-03-13T05_00_00.000Z_b7c2"
supportingEvidence: ["episode_1", "episode_2"]
relatedArtifacts: ["skill_..."]
---
```

### Episode Summary

```javascript
{
  episodeId: string,
  task: object,                  // Original task payload
  totalAttempts: number,
  scores: number[],              // Per-attempt scores
  verdicts: string[],            // Per-attempt verdicts
  finalScore: number,
  finalVerdict: string,
  stopReason: string,            // "pass_threshold" | "no_progress" | "max_attempts" | "runner_error"
  timestamp: string,
  attempts: [{
    attemptNum: number,
    score: number,
    verdict: string,
    durationMs: number,
    exitCode: number,
    timedOut: boolean,
    evaluatorScore: number,
    deterministicPenalty: number,
    passedChecks: string[],
    failedChecks: string[]
  }]
}
```

### Benchmark Aggregate Report

```javascript
{
  runId: string,
  timestamp: string,
  retrievalEnabled: boolean,
  totalTasks: number,
  passedTasks: number,
  passRate: number,              // 0.0 - 1.0
  meanScore: number,
  medianScore: number,
  attemptsToSuccessDist: object, // { "1": count, "2": count, ... }
  helpfulArtifacts: [{ id, count }],
  commonFailureTypes: object,    // { "no_progress": count, ... }
  taskReports: [{ taskId, episodeId, attemptsTaken, finalScore, passType, retrievedArtifactIds, durationMs, stopReason }]
}
```

---

## Extension Points

### Adding a New Deterministic Check

In `deterministic.js`, add a new `check()` call inside `runDeterministicChecks()`:

```javascript
// Example: check for minimum line count
if (task.minLines) {
    const lineCount = screen.split("\n").filter(l => l.trim().length > 0).length;
    check(
        "min_line_count",
        lineCount >= task.minLines,
        `Expected at least ${task.minLines} lines, got ${lineCount}`
    );
}
```

The hybrid scorer will automatically apply a -2 penalty for any new failed check. For critical checks that should cap the score at 3, add the check name to the critical failure detection in `hybrid-scorer.js`.

### Adding a New Artifact Type

1. Create a writer function in `artifact-writers.js` following the `writeMemoryArtifact` pattern
2. Add the directory to `learning-store.js` bootstrap list
3. Add an extraction function in `distill.js`
4. Register the type in `retrieve.js` (add to `retrieveForTask` index reads and limits)
5. Add formatting in `prompts.js` `formatLearningSection()`
6. Update `index-manager.js` if the type needs special index handling

### Adding a New CLI Mode

In `apprentice.js` `main()`:

1. Add argument parsing in the `if/else` chain
2. Implement the handler function
3. Follow the pattern: connect gateway -> execute -> close gateway in `finally`

### Customizing Retrieval Scoring

In `retrieve.js`, modify `scoreEntry()` to add new relevance signals:

```javascript
// Example: boost recent artifacts
const ageBonus = isRecentArtifact(entry) ? 0.3 : 0;
return baseScore + confidenceBonus * 0.5 + ageBonus;
```
