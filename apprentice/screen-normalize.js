/**
 * apprentice/screen-normalize.js — ANSI → Plain Text Final Frame
 *
 * Converts raw terminal output (with ANSI escape sequences, cursor
 * movements, box drawing, colors) into a plain-text representation
 * of the final screen state. This is the "what the user would see"
 * snapshot used by the Evaluator.
 *
 * Uses screen-csi.js for CSI command processing and scroll ops.
 * Zero external dependencies.
 *
 * @module apprentice/screen-normalize
 */

const { processCsi, scrollUp } = require("./screen-csi");

/**
 * Create a rows × cols grid of spaces. Each row is an array of
 * single characters representing the terminal screen buffer.
 *
 * @param {number} rows — number of rows
 * @param {number} cols — number of columns
 * @returns {string[][]} 2D character grid initialized to spaces
 */
function createGrid(rows, cols) {
    const grid = [];
    for (let r = 0; r < rows; r++) {
        grid.push(new Array(cols).fill(" "));
    }
    return grid;
}

/**
 * Serialize the grid to a plain-text string. Trims trailing spaces
 * from each row and trailing blank lines from the output, but
 * preserves all internal spacing and box-drawing characters.
 *
 * @param {string[][]} grid — the character grid
 * @returns {string} final screen text
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
 * Convert raw ANSI terminal output into a plain-text final-frame
 * representation. Builds a virtual screen buffer, processes all
 * escape sequences, and returns the visible text.
 *
 * @param {string} rawAnsi — raw terminal output with ANSI escapes
 * @param {number} cols    — terminal width in columns
 * @param {number} rows    — terminal height in rows
 * @returns {string} normalized plain text of the final screen
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
