/**
 * apprentice/benchmark-loader.js
 *
 * Purpose: Load JSON benchmark configurations from learning/benchmarks/*.json.
 * Responsibilities: Validates the schema and ensures they can be passed as a 'task' object to the episode runner.
 * Major sections:
 *   - validateBenchmark: Checks that a parsed JSON object has required fields.
 *   - loadBenchmarkTask: Loads a single benchmark task by ID.
 *   - loadAllBenchmarkTasks: Loads all valid benchmark tasks from the directory.
 * Important invariants: Missing or malformed tasks throw strict, 3-part diagnostic errors.
 * Report generation behavior: Validation guarantees that downstream reporting functions have necessary metadata to structure reports properly.
 * Replay behavior: Used by `replay-runner.js` to ensure that historical tasks extracted from legacy summaries meet modern benchmark requirements before replay.
 * Task loading assumptions: Assumes tasks exist in `learning/benchmarks/` with a `.json` extension. Expects `id`, `title`, and `request` string fields.
 * Failure behavior: Throws 3-part diagnostic errors if a file is missing, malformed, or fails schema validation. For suite-loading, it logs errors and skips invalid files rather than failing the entire suite.
 */

const fs = require("fs");
const path = require("path");
const CONFIG = require("./config");
const { ensureDirectory } = require("./filesystem");

/**
 * Purpose: Validate that a parsed JSON object has the required benchmark task fields.
 * Inputs:
 *   - task: {object} Parsed JSON object representing a benchmark task.
 * Outputs: None (void function).
 * Side effects: None.
 * Failure behavior: Throws 3-part diagnostic logic errors (What failed, Why it failed, How to prevent it) if `id`, `title`, or `request` are missing or invalid types.
 * Important assumptions: Protects the runner from runtime failures caused by malformed manual task definitions.
 */
function validateBenchmark(task) {
    if (!task.id || typeof task.id !== "string") {
        throw new Error(
            `Failed to validate benchmark task configuration.\n` +
            `Constraint violated: 'id' must be a non-empty string. Received type [${typeof task.id}], value [${task.id}].\n` +
            `Guidance: Ensure the JSON config file includes a valid "id" field.`
        );
    }
    if (!task.title || typeof task.title !== "string") {
        throw new Error(
            `Failed to validate benchmark task configuration for task ID [${task.id || 'unknown'}].\n` +
            `Constraint violated: 'title' must be a non-empty string. Received type [${typeof task.title}], value [${task.title}].\n` +
            `Guidance: Ensure the JSON config file includes a valid "title" field.`
        );
    }
    if (!task.request || typeof task.request !== "string") {
        throw new Error(
            `Failed to validate benchmark task configuration for task ID [${task.id || 'unknown'}].\n` +
            `Constraint violated: 'request' must be a non-empty string. Received type [${typeof task.request}], value [${task.request}].\n` +
            `Guidance: Ensure the JSON config file includes a valid "request" field.`
        );
    }
}

/**
 * Purpose: Load a single benchmark task file by ID.
 * Inputs:
 *   - id: {string} The benchmark task ID (e.g. "simple-box").
 * Outputs: {Promise<object>} The loaded and validated task object.
 * Side effects: Reads from the local filesystem.
 * Failure behavior: Throws if the file doesn't exist or if validation fails.
 * Important assumptions: Facilitates the execution of single targeted benchmark tasks (`--benchmark <id>`) for localized regression testing.
 */
async function loadBenchmarkTask(id) {
    const filePath = path.join(CONFIG.paths.benchmarks, `${id}.json`);
    if (!fs.existsSync(filePath)) {
        throw new Error(
            `Failed to load benchmark task by ID: '${id}'.\n` +
            `Constraint violated: File does not exist at expected path [${filePath}].\n` +
            `Guidance: Verify the benchmark ID is correct and the JSON file exists in the learning/benchmarks directory.`
        );
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const task = JSON.parse(content);
    validateBenchmark(task);
    return task;
}

/**
 * Purpose: Load all benchmark tasks from the learning/benchmarks/ directory.
 * Inputs: None. (Reads directly from CONFIG.paths.benchmarks)
 * Outputs: {Promise<object[]>} Array of validated task objects.
 * Side effects: Scans the benchmarks directory and yields `.json` files.
 * Failure behavior: Safely traps parsing and validation errors on individual files, logging diagnostic warnings for skipped tasks while continuing to load others, ensuring a single bad file doesn't block suite execution.
 * Important assumptions: Powers the `--benchmark-all` and `--compare-benchmarks` suite execution modes. Aggregates all defined tasks in the repository to form the complete set of regression tests.
 */
async function loadAllBenchmarkTasks() {
    await ensureDirectory(CONFIG.paths.benchmarks);
    const files = fs.readdirSync(CONFIG.paths.benchmarks);

    const tasks = [];
    for (const file of files) {
        if (!file.endsWith(".json")) continue;

        const id = file.replace(/\.json$/, "");
        try {
            const task = await loadBenchmarkTask(id);
            tasks.push(task);
        } catch (err) {
            console.error(
                `Failed to load benchmark task from file [${file}].\n` +
                `Error details: ${err.message}\n` +
                `Guidance: Fix the JSON formatting or ensure it matches the task schema.`
            );
        }
    }
    return tasks;
}

module.exports = { loadBenchmarkTask, loadAllBenchmarkTasks, validateBenchmark };
