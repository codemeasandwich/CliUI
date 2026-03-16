# Apprentice — Self-Improving LLM Training System for Galactica

Apprentice is an autonomous training pipeline that teaches large language models to generate terminal UI code using the [Galactica](https://github.com/codemeasandwich/CliUI) library. It operates through iterative generate-execute-evaluate loops, accumulating reusable knowledge artifacts that improve future code generation quality over time.

## Problem

LLMs struggle to reliably produce working terminal dashboard code. They hallucinate APIs, misjudge ANSI layout constraints, and repeat the same mistakes across sessions. Without a feedback mechanism grounded in real execution, there is no way to systematically improve.

## Solution

Apprentice closes the loop between generation and reality. Every piece of code it produces is executed in a real pseudoterminal. The captured screen output — not the code itself — is what gets evaluated. Lessons from each episode are distilled into persistent knowledge artifacts that feed into future prompts, creating a compounding learning effect.

## Architecture

```
                         +-------------------+
                         |   Task Payload    |
                         | (request, dims,   |
                         |  constraints)     |
                         +---------+---------+
                                   |
                    +--------------v--------------+
                    |    Retrieval (retrieve.js)   |
                    | Load prior skills, memories, |
                    | exemplars, anti-patterns     |
                    +--------------+--------------+
                                   |
              +--------------------v--------------------+
              |           Attempt Loop                  |
              |  (attempt-loop.js, max 10 iterations)   |
              |                                         |
              |  +----------------------------------+   |
              |  | 1. Build Prompt (prompts.js /     |   |
              |  |    revision-prompt.js)            |   |
              |  +----------------+-----------------+   |
              |                   |                     |
              |  +----------------v-----------------+   |
              |  | 2. Apprentice LLM generates code |   |
              |  |    (via gateway.js -> api-ape)    |   |
              |  +----------------+-----------------+   |
              |                   |                     |
              |  +----------------v-----------------+   |
              |  | 3. Execute in PTY (pty-runner.js) |   |
              |  |    Capture raw ANSI stream        |   |
              |  +----------------+-----------------+   |
              |                   |                     |
              |  +----------------v-----------------+   |
              |  | 4. Normalize screen output        |   |
              |  |    (screen-normalize.js)          |   |
              |  +----------------+-----------------+   |
              |                   |                     |
              |  +----------------v-----------------+   |
              |  | 5. Evaluator LLM scores output   |   |
              |  |    (evaluator.js) 0-10            |   |
              |  +----------------+-----------------+   |
              |                   |                     |
              |  +----------------v-----------------+   |
              |  | 6. Deterministic checks           |   |
              |  |    (deterministic.js)             |   |
              |  +----------------+-----------------+   |
              |                   |                     |
              |  +----------------v-----------------+   |
              |  | 7. Hybrid scoring                 |   |
              |  |    (hybrid-scorer.js)             |   |
              |  +----------------+-----------------+   |
              |                   |                     |
              |  +----------------v-----------------+   |
              |  | 8. Stop? (pass / no-progress /   |   |
              |  |    max attempts)                  |   |
              |  |    If not: build revision prompt  |   |
              |  +----------------------------------+   |
              +-----------------------------------------+
                                   |
                    +--------------v--------------+
                    |   Episode Summary            |
                    |   (episode-summary.js)       |
                    +--------------+--------------+
                                   |
                    +--------------v--------------+
                    |   Distillation (distill.js)  |
                    |   -> memories, exemplars,    |
                    |      anti-patterns, skills   |
                    +-----------------------------+
```

## Key Invariants

1. **Evaluator blindness**: The Evaluator LLM never sees the generated JavaScript. It judges only the captured terminal output. This prevents "grading its own homework."

2. **Truth from capture**: All feedback comes from real PTY execution. No synthetic or hallucinated output is ever used for evaluation or revision.

3. **Deterministic terminals**: Scripts execute in a fixed 80x24 xterm-256color environment with controlled locale (`en_US.utf8`), making output reproducible across machines.

4. **Immediate persistence**: Every attempt's artifacts (script, raw ANSI, normalized screen, evaluator result) are saved to disk before the next attempt begins. Crash-safe by design.

5. **Conservative skill promotion**: Skills are only created when a task scores 8+ and converges in 2 or fewer attempts. Memories require 3+ independent episodes of evidence before promotion to skill status.

## Module Map

### Core Loop
| Module | Responsibility |
|--------|---------------|
| `apprentice.js` (parent dir) | CLI entry point, episode orchestration, argument parsing |
| `attempt-loop.js` | Multi-attempt refinement loop with stop conditions |
| `runner.js` | Script extraction and execution dispatch |

### Execution
| Module | Responsibility |
|--------|---------------|
| `pty-runner.js` | PTY backend selector and public API (preference: script → node-pty → basic spawn) |
| `script-pty-runner.js` | Pure-JS PTY execution via Unix `script` command (no native deps) |
| `screen-normalize.js` | ANSI-to-plaintext final-frame converter |
| `screen-csi.js` | CSI escape sequence processor (cursor, erase, scroll) |

### Prompts
| Module | Responsibility |
|--------|---------------|
| `prompts.js` | Apprentice and Evaluator prompt builders |
| `revision-prompt.js` | Revision prompts for attempts 2+ with prior feedback |

### Evaluation
| Module | Responsibility |
|--------|---------------|
| `evaluator.js` | Evaluator LLM invocation and response parsing |
| `deterministic.js` | Rule-based checks (required text, borders, bounds) |
| `hybrid-scorer.js` | Merges LLM score with deterministic penalties |

### Learning
| Module | Responsibility |
|--------|---------------|
| `retrieve.js` | Keyword-based artifact retrieval for prompt injection |
| `distill.js` | Post-episode extraction of memories, exemplars, anti-patterns, skills |
| `artifact-writers.js` | Markdown artifact creation with YAML front-matter |
| `learning-store.js` | Directory bootstrapping and ID generation |

### Persistence
| Module | Responsibility |
|--------|---------------|
| `filesystem.js` | Shared filesystem abstractions (ensureDirectory, writeText) |
| `persistence.js` | Per-attempt artifact saving to episode directory |
| `episode-summary.js` | Episode summary construction and serialization |
| `prompt-snapshot.js` | Prompt text saving for debugging and replay |
| `front-matter.js` | Minimal YAML front-matter parser (zero dependencies) |
| `index-manager.js` | JSON index maintenance with self-healing rebuild |

### Lifecycle
| Module | Responsibility |
|--------|---------------|
| `promotion.js` | Memory-to-skill promotion, duplicate merging, demotion |
| `summary-generator.js` | Rollup reports (common mistakes, reliable techniques, prompt packs) |
| `export.js` | Portable bundle creation with confidence filtering |

### Benchmarking
| Module | Responsibility |
|--------|---------------|
| `benchmark-loader.js` | Benchmark task loading and schema validation |
| `benchmark-runner.js` | Suite execution with aggregate reporting |
| `replay-runner.js` | Episode replay from saved summaries |

### Infrastructure
| Module | Responsibility |
|--------|---------------|
| `config.js` | Centralized configuration (gateway, providers, limits, paths) |
| `gateway.js` | WebSocket connection to LLM Gateway (api-ape) |
| `progress-detect.js` | No-progress detection (script/screen/score stagnation) |

## Learning Artifact Types

| Type | Purpose | Created When | Confidence Range |
|------|---------|-------------|-----------------|
| **Memory** | Single-trial observation from evaluator critique | Any failing attempt with substantive feedback | 0.4 - 0.7 |
| **Exemplar** | Clean, passing reference solution | Episode has an attempt scoring >= pass threshold | 0.8 - 1.0 |
| **Anti-pattern** | Repeated failure pattern | 2+ consecutive attempts with identical low scores | 0.6 - 0.9 |
| **Skill** | Proven operational recipe | Score >= 8, converged in <= 2 attempts | 0.85 - 1.0 |

### Artifact Lifecycle

```
Raw Episode
    |
    v
Memory (low confidence) --[3+ episodes]--> Skill (promoted)
    |
Anti-pattern (repeated failures)
    |
Exemplar (passing solution)
    |
    v
Cleanup: merge duplicates, demote unreliable skills (confidence < 0.4)
    |
    v
Export: bundle high-confidence artifacts for external use
```

## Persistence Layout

```
learning/
  episodes/          Per-episode directories with full attempt artifacts
  skills/            Promoted high-confidence techniques (.md with front-matter)
  memories/          Single-trial observations (.md with front-matter)
  exemplars/         Successful code solutions (.md with front-matter)
  anti-patterns/     Documented failure patterns (.md with front-matter)
  indexes/           JSON indexes for fast lookup (skill.json, memory.json, etc.)
  prompts/           Cached prompt snapshots
  summaries/         Human-readable rollups and prompt packs
  benchmarks/        Task definition files (.json) and reports/
  reports/           Benchmark performance reports
```

## Dependencies

| Dependency | Type | Purpose |
|-----------|------|---------|
| **Bun** | Runtime | JavaScript execution engine |
| **api-ape** | Local (symlinked) | WebSocket RPC client for LLM Gateway |
| **node-pty** | npm (optional) | Native PTY fallback — only needed if Unix `script` command is unavailable |
| **Node.js stdlib** | Built-in | fs, path, crypto, child_process, os |

No external YAML or markdown parsing libraries are used. Front-matter parsing is handled by a minimal inline parser in `front-matter.js`.

### PTY Backend Preference

The execution pipeline needs a real pseudoterminal so TUI programs render genuine ANSI output. Three backends are tried in order:

1. **`script` command** (pure JS) — Uses the Unix `script -q /dev/null` command to allocate a PTY. Zero native dependencies. Works on macOS and Linux. Terminal dimensions controlled via `stty rows R cols C`.
2. **`node-pty`** (native addon) — Falls back to the native C++ addon if `script` is unavailable (e.g. Windows). Requires compilation against the host Node/Bun ABI.
3. **Basic `child_process.spawn`** — Final fallback with piped stdio. `isTTY` is false, so TUI programs may not render correctly.

## Related Documentation

- [SETUP.md](SETUP.md) — Installation, configuration, and first run
- [HOWTO.md](HOWTO.md) — Usage workflows, benchmarking, and tuning
- [SKILLS.md](SKILLS.md) — Module API reference and extension guide
