/**
 * apprentice/config.js — Trainer Configuration
 *
 * All tunables for the Apprentice trainer live here so later phases
 * can externalise them without hunting through business logic.
 * Controls gateway connection, LLM providers, terminal dimensions,
 * script execution, and persistence paths.
 *
 * @module apprentice/config
 */

const path = require("path");

// Central configuration object for the Apprentice trainer.
// Every setting that affects the trainer's behaviour is here.
const CONFIG = {
    // LLM Gateway connection — must be running before this script starts.
    // Default: localhost:3456 matching the standard gateway dev port.
    gateway: {
        host: "localhost",
        port: 3456,
    },

    // Provider used when asking the Apprentice to generate code.
    // Any provider registered in the LLM Gateway is valid (e.g. "claude-cli",
    // "gemini-cli", "anthropic-api", "ollama").
    apprenticeProvider: "claude-cli",

    // Model to request from the provider. When undefined, the gateway
    // uses the provider's default_model from its config.
    // Model alias for the Claude CLI. Valid aliases: "sonnet", "opus",
    // or full names like "claude-sonnet-4-5-20250929". When undefined,
    // the gateway uses the provider's default_model from its config.
    apprenticeModel: undefined,

    // Provider used when asking the Evaluator to score the captured output.
    // Switched from gemini-cli (quota exhausted) to claude-cli.
    evaluatorProvider: "claude-cli",

    // Model for the Evaluator actor. Undefined = provider default.
    evaluatorModel: undefined,

    // Provider used when asking the Requirements Analyst to diagnose
    // persistent failures. Activates only when trigger conditions are met.
    analystProvider: "claude-cli",

    // Model for the Analyst actor. Undefined = provider default.
    analystModel: undefined,

    // Virtual terminal dimensions and environment communicated to the
    // Apprentice and enforced by the PTY runner at execution time.
    terminal: {
        cols: 80,
        rows: 24,

        // Environment variables injected into the PTY child process.
        // Ensures consistent locale and terminal type across machines
        // so ANSI output is deterministic and comparable.
        env: {
            LANG: "en_US.utf8",
            TERM: "xterm-256color",
        },
    },

    // Command used to execute the generated script. The script path
    // is appended as the final argument at runtime.
    runCommand: "bun",

    // Maximum wall-clock milliseconds before the generated script is killed.
    // Prevents runaway processes from blocking the trainer indefinitely.
    timeoutMs: 30_000,

    // Maximum wall-clock milliseconds to wait for a streaming LLM response.
    // Accommodates slower CLI providers (claude-cli in agentic mode).
    // Default: 600s (10 min).
    streamTimeoutMs: 600_000,

    // Maximum attempts per episode before the loop gives up.
    // The loop may stop earlier if it detects no progress.
    maxAttempts: 10,

    // Evaluator score threshold for a passing verdict.
    // Score >= passThreshold stops the loop with "pass_threshold".
    passThreshold: 7,

    // Number of consecutive no-progress attempts before the loop stops.
    // Triggers when scripts, screen output, or scores are identical.
    noProgressCutoff: 3,

    // Maximum number of retrieved learning artifacts per type.
    // Controls how many prior artifacts are loaded for prompt inclusion.
    // Higher values provide more context but risk prompt bloat.
    retrieval: {
        maxSkills: 3,
        maxMemories: 5,
        maxExemplars: 2,
        maxAntiPatterns: 3,
        maxRequirements: 3,

        // MMR diversity weight (lambda). Controls how strongly the retrieval
        // penalizes near-duplicate artifacts. Range [0, 1]:
        //   0.0 = no diversity (pure top-N by score, legacy behavior)
        //   0.7 = strong diversity (suppresses entries with >70% tag overlap)
        //   1.0 = maximum diversity (similarity penalty equals full score)
        diversityWeight: 0.7,

        // Cross-type deduplication threshold. After per-type MMR selection,
        // artifacts from different types (e.g. a memory and an anti-pattern)
        // with Jaccard tag similarity above this threshold are deduplicated —
        // the lower-priority type's artifact is removed. Range [0, 1]:
        //   0.0  = disabled (no cross-type dedup)
        //   0.65 = remove cross-type duplicates with >65% tag overlap
        //   1.0  = only remove identical-tag duplicates across types
        crossTypeThreshold: 0.65,
    },

    // Filesystem paths relative to the project root or overridden by APPRENTICE_DATA_DIR.
    // All learning subdirectories live under the base path so they can
    // be gitignored together while preserving internal structure.
    paths: (function() {
        const base = process.env.APPRENTICE_DATA_DIR ? path.resolve(process.env.APPRENTICE_DATA_DIR) : path.resolve("learning");
        return {
            temp:         path.resolve("temp"),
            episodes:     path.join(base, "episodes"),
            skills:       path.join(base, "skills"),
            memories:     path.join(base, "memories"),
            exemplars:    path.join(base, "exemplars"),
            antiPatterns: path.join(base, "anti-patterns"),
            indexes:      path.join(base, "indexes"),
            prompts:      path.join(base, "prompts"),
            summaries:    path.join(base, "summaries"),
            benchmarks:   path.join(base, "benchmarks"),
            reports:      path.join(base, "benchmarks", "reports"),
            requirements: path.join(base, "requirements"),
        };
    })(),

    // Root of the CliUI repository — used to build the Apprentice prompt
    // so the model knows which files it may reference.
    repoRoot: path.resolve("."),
};

module.exports = CONFIG;
