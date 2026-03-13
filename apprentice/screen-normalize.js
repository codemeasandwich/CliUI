/**
 * apprentice/screen-normalize.js
 *
 * Purpose: ANSI to Plain Text translator.
 * Responsibilities: Converts raw terminal output (ANSI escape sequences, cursor movements, boxes) into a static plain-text representation (the final screen state).
 * Major sections:
 *   - createGrid / serializeGrid: Virtual frame buffer management.
 *   - normalizeScreen: Main parser loop processing bytes and CSI sequences.
 * Important invariants: The output matches exactly what a user would see on the terminal screen at exit (the snapshot).
 */

const { processCsi, scrollUp } = require("./screen-csi");

/**
 * Purpose: Create a rows × cols grid initialized with spaces.
 * Inputs:
 *   - rows: {number} number of terminal rows
 *   - cols: {number} number of terminal columns
 * Outputs: {string[][]} 2D character grid
 * Side effects: Allocates memory for the 2D array matrix.
 * Failure behavior: Throws native OutOfMemory exceptions if dimensions are impossibly large.
 * Important assumptions: Output is mutated iteratively by the parser later.
 */
function createGrid(rows, cols) {
    const grid = [];
    for (let r = 0; r < rows; r++) {
        grid.push(new Array(cols).fill(" "));
    }
    return grid;
}

/**
 * Purpose: Serialize the 2D character grid into a single plain-text string.
 * Inputs:
 *   - grid: {string[][]} the character grid
 * Outputs: {string} final screen text
 * Side effects: None
 * Failure behavior: None
 * Important assumptions: Trims trailing spaces from rows and trailing blank lines from the buffer bottom, but strictly preserves internal format.
 */
function serializeGrid(grid) {
    const lines = grid.map((row) => row.join("").trimEnd());

    // Find the last non-blank line to trim trailing blanks.
    let lastNonBlank = lines.length - 1;
    while (lastNonBlank >= 0 && lines[lastNonBlank].length === 0) {
        lastNonBlank--;
    }

    return lines.slice(0, lastNonBlank + 1).join("\n") + "\n";
}

/**
 * Purpose: Convert raw ANSI terminal output into a plain-text final-frame representation.
 * Inputs:
 *   - rawAnsi: {string} raw terminal output containing ANSI escapes
 *   - cols: {number} terminal width in columns
 *   - rows: {number} terminal height in rows
 * Outputs: {string} normalized plain text of the final screen
 * Side effects: Creates and mutates a virtual screen buffer object in memory. Routes CSI commands to screen-csi module.
 * Failure behavior: Silently skips unknown or malformed escape sequences to ensure a best-effort render rather than crashing.
 * Important assumptions: Relies on `processCsi` from `screen-csi.js` to handle complex terminal formatting.
 */
function normalizeScreen(rawAnsi, cols, rows) {
    const grid = createGrid(rows, cols);
    const state = { row: 0, col: 0, grid, rows, cols };

    let i = 0;
    const len = rawAnsi.length;

    while (i < len) {
        const ch = rawAnsi[i];

        // ESC character — start of an escape sequence.
        if (ch === "\x1b") {
            i++;
            if (i >= len) break;
            const next = rawAnsi[i];

            // CSI sequence: ESC [ <params> <command>
            if (next === "[") {
                i++;
                let paramStr = "";
                // Collect parameter bytes (digits, semicolons, ?)
                while (i < len && rawAnsi[i] >= "\x20" && rawAnsi[i] <= "\x3f") {
                    paramStr += rawAnsi[i];
                    i++;
                }
                // The command byte follows the parameter string.
                if (i < len) {
                    processCsi(paramStr, rawAnsi[i], state);
                    i++;
                }
            }
            // OSC sequence: ESC ] ... BEL or ST — skip entirely.
            else if (next === "]") {
                i++;
                while (i < len) {
                    if (rawAnsi[i] === "\x07") { i++; break; }
                    if (rawAnsi[i] === "\x1b" && i + 1 < len && rawAnsi[i + 1] === "\\") {
                        i += 2; break;
                    }
                    i++;
                }
            }
            // Other escape sequences — skip the next byte.
            else { i++; }
            continue;
        }

        // Carriage return — cursor to column 0.
        if (ch === "\r") { state.col = 0; i++; continue; }

        // Newline — cursor down one row; scroll if at bottom.
        if (ch === "\n") {
            if (state.row < state.rows - 1) { state.row++; }
            else { scrollUp(1, state); }
            i++;
            continue;
        }

        // Tab — advance to next 8-column tab stop.
        if (ch === "\t") {
            state.col = Math.min((Math.floor(state.col / 8) + 1) * 8, state.cols - 1);
            i++;
            continue;
        }

        // Backspace — move cursor back one column.
        if (ch === "\b") { if (state.col > 0) state.col--; i++; continue; }

        // BEL and other control characters — skip silently.
        if (ch.charCodeAt(0) < 0x20) { i++; continue; }

        // Visible character — write to grid at cursor position.
        if (state.col < state.cols && state.row < state.rows) {
            state.grid[state.row][state.col] = ch;
            state.col++;

            // Line wrap: cursor past right edge → next line start.
            if (state.col >= state.cols) {
                state.col = 0;
                if (state.row < state.rows - 1) { state.row++; }
                else { scrollUp(1, state); }
            }
        }
        i++;
    }

    return serializeGrid(grid);
}

module.exports = { normalizeScreen, createGrid };
