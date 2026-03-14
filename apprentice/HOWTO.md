# Apprentice How-To Guide

This guide covers all operational workflows for the Apprentice training system.

## Running a Single Episode

The default mode runs one episode using the hardcoded task in `apprentice.js`:

```bash
bun apprentice.js
```

The system will:
1. Connect to the LLM Gateway
2. Retrieve relevant learning artifacts from prior episodes
3. Loop through up to 10 generate-execute-evaluate attempts
4. Save all artifacts to `learning/episodes/<episode-id>/`
5. Distill new learning artifacts (memories, exemplars, anti-patterns, possibly skills)

### Disabling Retrieval

To run an episode without injecting prior learning (useful for baseline measurements):

```bash
bun apprentice.js --no-retrieval
```

## Writing Task Descriptions

Tasks are defined as JSON objects. The more precise the task, the better the generated code.

### Task Payload Schema

```json
{
  "id": "unique-task-id",
  "title": "Human-readable task title",
  "request": "Plain English description of what to build",
  "wireframe": "Optional ASCII art of the target layout",
  "cols": 80,
  "rows": 24,
  "requiredTexts": ["text that must appear in output"],
  "forbiddenTexts": ["text that must NOT appear"],
  "expectsBorder": true,
  "titleText": "Expected title string",
  "titleMode": "detached",
  "expectsFooter": true
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (used in benchmark file naming) |
| `title` | string | Short human-readable title |
| `request` | string | Full task description in plain English |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `wireframe` | string | none | ASCII art layout the Apprentice should match |
| `cols` | number | 80 | Terminal width |
| `rows` | number | 24 | Terminal height |
| `requiredTexts` | string[] | none | Texts that must appear in the rendered output |
| `forbiddenTexts` | string[] | none | Texts that must NOT appear |
| `expectsBorder` | boolean | false | Whether box-drawing characters are expected |
| `titleText` | string | none | Specific title text to look for |
| `titleMode` | string | none | `"detached"` (title above border), `"embedded"` (title on border), or `"either"` |
| `expectsFooter` | boolean | false | Whether text near the bottom is expected |

### Task Writing Tips

**Be specific about layout:**
```json
{
  "request": "Create a terminal dashboard with a line chart in the top half (rows 1-12) and a log widget in the bottom half (rows 13-24). The dashboard should render once and exit after 2 seconds."
}
```

**Use wireframes for complex layouts:**
```json
{
  "request": "Create a three-panel dashboard matching the wireframe below.",
  "wireframe": "+-----------+-----------+\n|  Chart    |  Stats    |\n|           |           |\n+-----------+-----------+\n|       Log Panel       |\n+-----------------------+"
}
```

**Add deterministic constraints to catch failures early:**
```json
{
  "request": "Display a dashboard titled 'System Monitor' with CPU and memory sections.",
  "requiredTexts": ["System Monitor", "CPU", "Memory"],
  "expectsBorder": true,
  "titleText": "System Monitor",
  "titleMode": "embedded"
}
```

## Creating Benchmark Tasks

Benchmark tasks are JSON files stored in `learning/benchmarks/`. Each file defines one task.

### Example: Simple Box

File: `learning/benchmarks/simple-box.json`

```json
{
  "id": "simple-box",
  "title": "Simple Box Configuration",
  "request": "Create a terminal dashboard using galactica (CliUI) containing a single box (panel or markdown widget) that is 10 columns wide and 5 rows high, centered on the screen.",
  "cols": 80,
  "rows": 24
}
```

### Example: Two-Panel Dashboard

File: `learning/benchmarks/two-panel-dashboard.json`

```json
{
  "id": "two-panel-dashboard",
  "title": "Two-Panel Dashboard",
  "request": "Create a dashboard with two side-by-side panels, each taking half the terminal width.",
  "cols": 80,
  "rows": 24,
  "expectsBorder": true
}
```

### Validation Rules

Benchmark files must have:
- `id`: non-empty string
- `title`: non-empty string
- `request`: non-empty string

Invalid files are skipped with a warning when loading benchmark suites.

## Running Benchmarks

### Single Benchmark Task

```bash
bun apprentice.js --benchmark simple-box
```

The `--benchmark` flag takes the task `id` (which matches the filename without `.json`).

### Full Benchmark Suite

```bash
bun apprentice.js --benchmark-all
```

Runs every valid JSON file in `learning/benchmarks/`. Results are saved to `learning/benchmarks/reports/`.

Benchmark runs do NOT distill learning artifacts. This prevents test data from contaminating the training set.

### Comparing With and Without Retrieval

```bash
bun apprentice.js --compare-benchmarks
```

This runs the full benchmark suite twice:
1. **Pass 1**: Retrieval disabled (baseline)
2. **Pass 2**: Retrieval enabled (with accumulated knowledge)

Output includes a comparison showing delta in pass rate and mean score:

```
============================================================
                 BENCHMARK COMPARISON
============================================================
  Tasks matched: 3
  Retrieval DISABLED: Pass Rate 33.3%, Mean Score 4.50
  Retrieval ENABLED:  Pass Rate 66.7%, Mean Score 6.80

  Delta Pass Rate: +33.3%
  Delta Mean Score: +2.30
============================================================
```

### Benchmark Report Structure

Each benchmark run produces reports in `learning/benchmarks/reports/`:

**Per-task report** (`<taskId>-<runId>.json`):
```json
{
  "taskId": "simple-box",
  "episodeId": "episode_...",
  "attemptsTaken": 3,
  "finalScore": 8,
  "passType": "pass_threshold",
  "retrievedArtifactIds": ["skill_...", "memory_..."],
  "durationMs": 45000,
  "stopReason": "pass_threshold"
}
```

**Aggregate report** (`aggregate-<runId>.json`):
```json
{
  "runId": "2026-03-13T...",
  "timestamp": "2026-03-13T...",
  "retrievalEnabled": true,
  "totalTasks": 3,
  "passedTasks": 2,
  "passRate": 0.667,
  "meanScore": 6.8,
  "medianScore": 7.0,
  "attemptsToSuccessDist": { "2": 1, "3": 1 },
  "helpfulArtifacts": [{ "id": "skill_...", "count": 2 }],
  "commonFailureTypes": { "no_progress": 1 }
}
```

## Replaying Past Episodes

Replay re-runs a past task against the current learning state, measuring whether accumulated knowledge improves results:

```bash
bun apprentice.js --replay episode_2026-03-13T05_00_00.000Z_a3f1
```

The episode ID is found in `learning/episodes/` directory names or in episode summary files.

Replay loads the original task from the saved `episode-summary.json` and runs it as a benchmark (no distillation).

## Managing Learning Artifacts

### Cleanup and Promotion

```bash
bun apprentice.js --cleanup
```

This runs three operations:

1. **Promote memories to skills**: Memories with evidence from 3+ independent episodes, manual approval (confidence >= 0.99), or documentation support are promoted. The promoted skill gets a +0.2 confidence boost. The source memory's confidence is dropped to 0.1 to prevent re-promotion.

2. **Merge duplicate anti-patterns**: Anti-patterns with Jaccard tag similarity >= 0.7 are merged. The highest-confidence entry absorbs supporting evidence from duplicates. Duplicate confidence is set to 0.1.

3. **Demote unreliable skills**: Skills with confidence < 0.4 are demoted (confidence set to 0.1). They remain on disk but are effectively hidden from retrieval and export.

Cleanup also regenerates summary reports and prompt packs.

### Understanding Artifact Files

Each artifact is a markdown file with YAML front-matter:

```markdown
---
id: "memory_2026-03-13T05_00_00.000Z_a3f1"
type: "memory"
title: "Critique from attempt 2: layout spacing incorrect"
tags: [terminal, layout, spacing, dashboard]
confidence: 0.65
createdAt: "2026-03-13T05:00:00.000Z"
source: "episode_2026-03-13T05_00_00.000Z_b7c2"
supportingEvidence: ["episode_..."]
relatedArtifacts: ["skill_..."]
---

## Observation

**Task:** Create a terminal dashboard...
**Attempt:** 2
**Score:** 4/10

## Evaluator Critique

The layout spacing between widgets is incorrect...

## Suggested Fix

Adjust the grid positioning to account for border width...
```

### Browsing Indexes

Indexes are JSON arrays in `learning/indexes/`:

```bash
cat learning/indexes/skill.json | jq '.[].title'
cat learning/indexes/memory.json | jq 'length'
cat learning/indexes/anti-pattern.json | jq '.[] | select(.confidence > 0.5)'
```

### Rebuilding Indexes

If an index becomes corrupted or out of sync, it can be rebuilt from disk. The `rebuildIndex(type)` function in `index-manager.js` scans the artifact directory and reconstructs the JSON index from front-matter metadata. This is invoked programmatically:

```javascript
const { rebuildIndex } = require("./apprentice/index-manager");
await rebuildIndex("skill");
await rebuildIndex("memory");
await rebuildIndex("exemplar");
await rebuildIndex("anti-pattern");
```

## Exporting Knowledge Bundles

### Default Export

```bash
bun apprentice.js --export
```

Creates a portable bundle at `learning/exports/export_<timestamp>/` containing:

```
export_TIMESTAMP/
  skills/          Skills with confidence >= 0.6
  memories/        Memories with confidence >= 0.7
  exemplars/       Exemplars with confidence >= 0.8
  summaries/       Generated summary reports
  prompts/         Prompt packs grouped by tag
  bundle-manifest.json
```

### Custom Export Directory

```bash
bun apprentice.js --export /path/to/output
```

### Bundle Manifest

The `bundle-manifest.json` records what was exported:

```json
{
  "exportedAt": "2026-03-13T05:00:00.000Z",
  "contents": {
    "skills": [{ "id": "...", "title": "...", "confidence": 0.85, "path": "./skill_..." }],
    "memories": [...],
    "exemplars": [...]
  }
}
```

Paths in the manifest are relative to the bundle directory, making the bundle fully portable across machines.

## Understanding Hybrid Scoring

Each attempt receives a hybrid score combining two independent assessments:

### Evaluator Score (Subjective)

The Evaluator LLM scores the captured output 0-10 based on:
- Visual structure and layout correctness
- Border and alignment quality
- Faithfulness to the task description
- Completeness of requested elements

### Deterministic Checks (Objective)

Rule-based checks that produce pass/fail signals:

| Check | Trigger | Penalty |
|-------|---------|---------|
| `output_not_empty` | Always | -4 (severe) |
| `runtime_success` | Always | -5 (severe) |
| `required_text_'X'` | `task.requiredTexts` | -2 per text |
| `forbidden_text_'X'` | `task.forbiddenTexts` | -2 per text |
| `expects_border` | `task.expectsBorder` | -2 |
| `title_text_present` | `task.titleText` | -2 |
| `expects_footer` | `task.expectsFooter` | -2 |
| `title_mode_*` | `task.titleMode` | -2 |
| `within_terminal_bounds` | Always | -2 |

### Final Score Calculation

```
finalScore = clamp(0, 10, evaluatorScore - totalPenalty)
```

If a critical failure occurs (runtime crash, empty output), the score is capped at 3 regardless of the evaluator's assessment.

### Verdict Rules

| Final Score | Implied Verdict |
|-------------|----------------|
| >= 8 | pass |
| 4 - 7 | partial |
| < 4 | fail |

The verdict can only be downgraded from the evaluator's assessment, never upgraded. Any deterministic failure prevents a "pass" verdict.

## Tuning the System

### Faster Iteration

For rapid prototyping, reduce attempt limits and timeout:

```javascript
// config.js
maxAttempts: 5,
timeoutMs: 15000,
passThreshold: 6,
```

### Higher Quality

For thorough training episodes with strict quality gates:

```javascript
// config.js
maxAttempts: 10,
passThreshold: 8,
noProgressCutoff: 4,
```

### More Learning Context

To inject more prior knowledge into prompts (at the cost of token usage):

```javascript
// config.js
retrieval: {
    maxSkills: 5,
    maxMemories: 8,
    maxExemplars: 3,
    maxAntiPatterns: 5,
},
```

### Different Models per Actor

The Apprentice (code generator) and Evaluator (output judge) can use different models:

```javascript
// config.js
apprenticeProvider: "claude-cli",
apprenticeModel: "claude-sonnet-4-6",
evaluatorProvider: "gemini-cli",
evaluatorModel: undefined,  // use provider default
```

## Reading Episode Output

### Episode Summary

The `episode-summary.json` in each episode directory provides a complete record:

```json
{
  "episodeId": "episode_2026-03-13T...",
  "task": { "request": "...", "cols": 80, "rows": 24 },
  "totalAttempts": 4,
  "scores": [3, 5, 5, 8],
  "verdicts": ["fail", "partial", "partial", "pass"],
  "finalScore": 8,
  "finalVerdict": "pass",
  "stopReason": "pass_threshold",
  "timestamp": "2026-03-13T05:00:00.000Z",
  "attempts": [
    {
      "attemptNum": 1,
      "score": 3,
      "verdict": "fail",
      "durationMs": 2340,
      "exitCode": 0,
      "timedOut": false,
      "evaluatorScore": 5,
      "deterministicPenalty": 2,
      "passedChecks": ["output_not_empty", "runtime_success"],
      "failedChecks": ["required_text_'CPU'"]
    }
  ]
}
```

### Debugging a Failed Attempt

1. Check `attempt_NNN-stderr.txt` for runtime errors
2. Read `attempt_NNN-screen.txt` to see what was actually rendered
3. Read `attempt_NNN-evaluator.json` for the LLM's critique and suggested fix
4. Read `attempt_NNN-prompt.md` to see exactly what the LLM was asked
5. Compare `attempt_NNN-raw.ansi` with the normalized screen to check normalization accuracy
