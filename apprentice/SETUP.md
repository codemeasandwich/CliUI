# Apprentice Setup Guide

## Prerequisites

### Bun Runtime

Apprentice runs on [Bun](https://bun.sh). Install it if not already present:

```bash
curl -fsSL https://bun.sh/install | bash
```

Verify:

```bash
bun --version
```

### Node.js (for node-pty)

The `node-pty` native module requires Node.js headers for compilation. Ensure Node.js is installed alongside Bun:

```bash
node --version   # v18+ recommended
```

### node-pty

Terminal output capture requires the `node-pty` native addon. Install from the CliUI project root:

```bash
cd /path/to/CliUI
npm install       # or: bun install
```

If `node-pty` fails to compile, ensure you have build tools installed:

- **macOS**: `xcode-select --install`
- **Linux**: `sudo apt-get install build-essential python3`

Apprentice gracefully degrades to `child_process.spawn` if PTY is unavailable, but ANSI output capture will be incomplete and normalized screen output less accurate.

### LLM Gateway (api-ape)

Apprentice communicates with LLMs through a local WebSocket gateway provided by `api-ape`. The gateway must be running before launching Apprentice.

**Start the gateway:**

```bash
cd /path/to/api-ape
bun run server.js
```

The default gateway address is `ws://localhost:3456`. The gateway must have at least one LLM provider configured (e.g., `gemini-cli`, `claude-cli`, `anthropic-api`, `ollama`).

## Configuration Reference

All configuration lives in `apprentice/config.js`. Settings are read at startup and cannot be changed mid-episode.

### Gateway Connection

| Setting | Default | Description |
|---------|---------|-------------|
| `gateway.host` | `"localhost"` | Gateway hostname |
| `gateway.port` | `3456` | Gateway port |

### LLM Providers

| Setting | Default | Description |
|---------|---------|-------------|
| `apprenticeProvider` | `"gemini-cli"` | Provider for code generation |
| `apprenticeModel` | `undefined` | Model override (uses provider default if undefined) |
| `evaluatorProvider` | `"gemini-cli"` | Provider for output evaluation |
| `evaluatorModel` | `undefined` | Model override (uses provider default if undefined) |

Any provider registered in the LLM Gateway is valid. To switch providers, edit `config.js`:

```javascript
apprenticeProvider: "claude-cli",
evaluatorProvider: "anthropic-api",
```

### Terminal Environment

| Setting | Default | Description |
|---------|---------|-------------|
| `terminal.cols` | `80` | Terminal width in columns |
| `terminal.rows` | `24` | Terminal height in rows |
| `terminal.env.LANG` | `"en_US.utf8"` | Locale for deterministic output |
| `terminal.env.TERM` | `"xterm-256color"` | Terminal type for ANSI support |

These values are communicated to the Apprentice LLM in the prompt and enforced by the PTY runner at execution time.

### Execution Limits

| Setting | Default | Description |
|---------|---------|-------------|
| `runCommand` | `"bun"` | Command used to execute generated scripts |
| `timeoutMs` | `30000` | Max wall-clock ms before script is killed |
| `maxAttempts` | `10` | Maximum attempts per episode |
| `passThreshold` | `7` | Score (0-10) at which the loop stops with success |
| `noProgressCutoff` | `3` | Consecutive stalled attempts before early stop |

### Retrieval Limits

| Setting | Default | Description |
|---------|---------|-------------|
| `retrieval.maxSkills` | `3` | Max skill artifacts loaded per episode |
| `retrieval.maxMemories` | `5` | Max memory artifacts loaded per episode |
| `retrieval.maxExemplars` | `2` | Max exemplar artifacts loaded per episode |
| `retrieval.maxAntiPatterns` | `3` | Max anti-pattern artifacts loaded per episode |

Higher values provide richer context but risk prompt bloat. Artifact bodies are truncated (skills: 300 chars, memories: 200 chars, anti-patterns: 200 chars, exemplars: 500 chars) to control prompt length.

### Filesystem Paths

| Setting | Default | Description |
|---------|---------|-------------|
| `paths.temp` | `./temp` | Temporary script storage |
| `paths.episodes` | `./learning/episodes` | Per-episode artifact directories |
| `paths.skills` | `./learning/skills` | Skill artifacts |
| `paths.memories` | `./learning/memories` | Memory artifacts |
| `paths.exemplars` | `./learning/exemplars` | Exemplar artifacts |
| `paths.antiPatterns` | `./learning/anti-patterns` | Anti-pattern artifacts |
| `paths.indexes` | `./learning/indexes` | JSON index files |
| `paths.prompts` | `./learning/prompts` | Prompt snapshots |
| `paths.summaries` | `./learning/summaries` | Summary reports |
| `paths.benchmarks` | `./learning/benchmarks` | Benchmark task files |
| `paths.reports` | `./learning/benchmarks/reports` | Benchmark run reports |

All paths are relative to the project root unless overridden by the `APPRENTICE_DATA_DIR` environment variable.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `APPRENTICE_DATA_DIR` | Override the base learning directory (default: `./learning`). All subdirectories (episodes, skills, etc.) are created under this path. |

Example:

```bash
APPRENTICE_DATA_DIR=/tmp/apprentice-test bun apprentice.js
```

## Directory Bootstrap

On first run, Apprentice automatically creates all required learning subdirectories via `bootstrapLearningDirs()`. This is idempotent and safe to run repeatedly. The directories created are:

```
learning/
  episodes/
  skills/
  memories/
  exemplars/
  anti-patterns/
  indexes/
  prompts/
  summaries/
  benchmarks/
  reports/      (under benchmarks/)
```

No manual directory creation is needed.

## Verifying the Setup

### 1. Start the LLM Gateway

```bash
cd /path/to/api-ape
bun run server.js
```

Confirm the gateway is listening on port 3456 (or your configured port).

### 2. Run a Test Episode

From the CliUI project root:

```bash
bun apprentice.js
```

Expected output:

```
Apprentice Phase 7 — Benchmarks, Replay, and Regression Reporting
Gateway: ws://localhost:3456
Apprentice provider: gemini-cli
Evaluator provider: gemini-cli
Timeout: 30000ms
Terminal: 80x24

============================================================
  Episode: episode_2026-03-13T...
  Max attempts: 10
  Pass threshold: 7/10
  No-progress cutoff: 3
============================================================

  [attempt 1] Requesting code from Apprentice...
  [attempt 1] Received XXXX chars
  [attempt 1] Running script...
  [attempt 1] Exit code 0 (XXXms)
  [attempt 1] Score: X/10 — verdict (X checks passed, X failed)
  ...
```

The episode will continue until it passes (score >= 7), detects no progress, or exhausts 10 attempts.

### 3. Check the Output

After the episode completes, examine the artifacts:

```bash
ls learning/episodes/
```

Each episode directory contains:

```
episode_TIMESTAMP_XXXX/
  attempt_001.js              # Generated script
  attempt_001-raw.ansi        # Raw PTY output
  attempt_001-screen.txt      # Normalized plain text
  attempt_001-stderr.txt      # Captured errors
  attempt_001-evaluator.json  # Evaluator scoring result
  attempt_001-prompt.md       # Compiled prompt text
  attempt_001-retrieved.json  # Retrieved artifact IDs
  episode-summary.json        # Full episode summary
```

## Troubleshooting

### Gateway Connection Refused

```
Error: Failed to connect to LLM Gateway at ws://localhost:3456
```

**Cause**: The api-ape gateway is not running or is on a different port.

**Fix**: Start the gateway (`bun run server.js` in the api-ape directory) and verify the port matches `config.js`.

### PTY Spawn Failure

```
[pty-runner] PTY unavailable, falling back to basic runner
```

**Cause**: `node-pty` is not installed or failed to compile.

**Fix**: Run `npm install` in the CliUI root. If compilation fails, install platform build tools (Xcode CLI tools on macOS, build-essential on Linux). Apprentice will still function with the fallback runner, but ANSI output fidelity will be reduced.

### Script Timeout

```
[attempt N] Exit code 1 (TIMED OUT)
```

**Cause**: The generated script took longer than `timeoutMs` (default 30s).

**Fix**: Increase `timeoutMs` in `config.js` if the task legitimately requires more time. For most Galactica dashboards, 30s is generous — timeouts usually indicate infinite loops or missing exit logic in the generated code.

### LLM Stream Timeout

```
Error: Gateway LLM stream timed out after 300000ms
```

**Cause**: The LLM provider took too long to respond (5-minute hard limit in `gateway.js`).

**Fix**: Check the provider's status and connectivity. If the provider is slow, consider switching to a faster model or provider in `config.js`.

### Empty Screen Output

```
[attempt N] Score: 0/10 — fail (0 checks passed, 3 failed)
```

**Cause**: The script produced no visible terminal output, or the output was not captured correctly.

**Fix**: Check the `attempt_NNN-stderr.txt` file for errors. Common causes: missing `require('galactica')`, incorrect API usage, or the script exiting before rendering.

### No Learning Artifacts Found

```
[learning] Retrieved 0 prior artifact(s)
```

This is normal for the first few episodes. Artifacts accumulate as episodes complete and are distilled. After several episodes, retrieval should begin returning relevant prior knowledge.
