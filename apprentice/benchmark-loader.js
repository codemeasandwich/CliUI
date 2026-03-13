/**
 * apprentice/benchmark-loader.js — Benchmark Task Config Loader
 *
 * Loads JSON benchmark configurations from learning/benchmarks/*.json
 * Validates the schema and ensures they can be passed as a 'task'
 * object to the episode runner.
 *
 * @module apprentice/benchmark-loader
 */

const fs = require("fs");
const path = require("path");
const CONFIG = require("./config");
const { ensureDirectory } = require("./filesystem");

/**
 * Validates that a parsed JSON object has the required benchmark task fields.
 *
 * Domain: Ensures that benchmark JSON files satisfy the minimum schema 
 * required to execute an episode. Protects the runner from runtime failures 
 * caused by malformed manual task definitions.
 *
 * Technical: Checks for the existence and type correctness of 'id', 'title', 
 * and 'request'. Throws 3-part diagnostic errors detailing specific violations 
 * and actionable guidance to pinpoint configuration typos quickly.
 *
 * @param {object} task - Parsed JSON object
 * @throws {Error} if validation fails
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
 * Loads a single benchmark task file by ID (filename without .json).
 *
 * Domain: Facilitates the execution of single targeted benchmark tasks 
 * (\`--benchmark <id>\`) for localized regression testing without running 
 * the entire suite.
 *
 * Technical: Reads the JSON file from the learning/benchmarks directory, 
 * parses it, and heavily relies on validateBenchmark to ensure schema 
 * correctness before returning the payload. 
 *
 * @param {string} id - The benchmark task ID (e.g. "simple-box")
 * @returns {object} The loaded task object
 * @throws {Error} If tasks file doesn't exist or is invalid
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
 * Loads all benchmark tasks from the learning/benchmarks/ directory.
 *
 * Domain: Powers the \`--benchmark-all\` and \`--compare-benchmarks\` suite 
 * execution modes. Aggregates all defined tasks in the repository to form 
 * the complete set of regression tests.
 *
 * Technical: Scans the benchmarks directory, yielding only \`.json\` files. 
 * Safely traps parsing and validation errors on individual files, logging 
 * diagnostic warnings for skipped tasks while continuing to load others, 
 * ensuring a single bad file doesn't block suite execution.
 *
 * @returns {Promise<object[]>} Array of validated task objects
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
