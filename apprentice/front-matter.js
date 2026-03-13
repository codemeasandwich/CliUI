/**
 * apprentice/front-matter.js — YAML Front-Matter Parser
 *
 * Minimal front-matter parser for learning artifact markdown files.
 * Parses the --- delimited header into a key-value object. Handles
 * strings, numbers, and inline arrays without external YAML deps.
 *
 * Intentionally lightweight — covers only the front-matter shape
 * used by artifact-writers.js. Not a general-purpose YAML parser.
 *
 * @module apprentice/front-matter
 */

/**
 * Parse simple YAML front-matter delimited by --- lines.
 * Returns an object with the parsed key-value pairs.
 * Handles: strings, numbers, arrays (inline [a, b, c]).
 *
 * Written paths: None (pure parser, no I/O).
 *
 * Assumptions:
 *   - Front-matter block starts at line 1 (no leading content)
 *   - Only covers the shape produced by formatFrontMatter in artifact-writers.js
 *   - Nested YAML objects, multi-line values, and block arrays are unsupported
 *   - ISO timestamps survive the number check because formatFrontMatter
 *     wraps them in double quotes — the quote-stripping branch fires first,
 *     and the stripped value "2026-03-13T08:03:33.432Z" contains non-numeric
 *     characters so isNaN() returns true, preserving it as a string
 *
 * Failure behavior: Returns an empty object ({}) if the content has no
 * valid front-matter block. Never throws — malformed lines are silently
 * skipped (no colon separator means the line is ignored).
 *
 * @param {string} content — full file content with front-matter
 * @returns {object} parsed front-matter key-value pairs
 */
function parseFrontMatter(content) {
    // Match the front-matter block: starts at line 1 with ---,
    // ends at the next --- line. Lazy match captures the content
    // between the delimiters.
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};

    const result = {};
    const lines = match[1].split("\n");
    for (const line of lines) {
        // Find the first colon separator for key: value splitting.
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) continue;

        const key = line.slice(0, colonIdx).trim();
        let value = line.slice(colonIdx + 1).trim();

        // Remove surrounding quotes from string values.
        // formatFrontMatter wraps strings in double quotes.
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
        }

        // Parse inline arrays: [tag1, tag2, tag3]
        // formatFrontMatter produces this bracket format for arrays.
        if (value.startsWith("[") && value.endsWith("]")) {
            value = value.slice(1, -1).split(",").map((s) => s.trim());
        // Parse numbers (for confidence scores and attempt numbers).
        } else if (!isNaN(value) && value !== "") {
            value = Number(value);
        }

        result[key] = value;
    }
    return result;
}

module.exports = { parseFrontMatter };
