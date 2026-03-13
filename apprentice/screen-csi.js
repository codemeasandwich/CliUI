/**
 * apprentice/screen-csi.js — CSI Escape Sequence Processor
 *
 * Handles Control Sequence Introducer (CSI) commands for the virtual
 * screen buffer. Processes cursor movement, erase operations, scroll,
 * and SGR (which we strip for normalized output).
 *
 * This module is extracted from screen-normalize.js to keep each
 * file under the 200 NCLOC limit.
 *
 * @module apprentice/screen-csi
 */

/**
 * Parse a CSI parameter string like "5" or "1;2" into an array
 * of integers. Missing/empty params default to the provided
 * defaultVal (usually 1 for movement commands, 0 for erase).
 *
 * @param {string} paramStr — raw parameter string from the CSI seq
 * @param {number} defaultVal — value for missing params
 * @returns {number[]} parsed parameters
 */
function parseParams(paramStr, defaultVal) {
    if (!paramStr || paramStr.length === 0) {
        return [defaultVal];
    }
    return paramStr.split(";").map((s) => {
        const n = parseInt(s, 10);
        return isNaN(n) ? defaultVal : n;
    });
}

/**
 * Clamp a value between min and max (inclusive).
 *
 * @param {number} val — value to clamp
 * @param {number} min — lower bound
 * @param {number} max — upper bound
 * @returns {number} clamped value
 */
function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

/**
 * Erase part or all of the display based on the erase mode.
 *   0 — from cursor to end of screen
 *   1 — from start of screen to cursor
 *   2 or 3 — entire screen
 *
 * @param {number} mode  — erase mode
 * @param {object} state — screen state
 */
function eraseDisplay(mode, state) {
    if (mode === 2 || mode === 3) {
        for (let r = 0; r < state.rows; r++) {
            state.grid[r].fill(" ");
        }
    } else if (mode === 0) {
        for (let c = state.col; c < state.cols; c++) {
            state.grid[state.row][c] = " ";
        }
        for (let r = state.row + 1; r < state.rows; r++) {
            state.grid[r].fill(" ");
        }
    } else if (mode === 1) {
        for (let r = 0; r < state.row; r++) {
            state.grid[r].fill(" ");
        }
        for (let c = 0; c <= state.col; c++) {
            state.grid[state.row][c] = " ";
        }
    }
}

/**
 * Erase part or all of the current line based on the erase mode.
 *   0 — from cursor to end of line
 *   1 — from start of line to cursor
 *   2 — entire line
 *
 * @param {number} mode  — erase mode
 * @param {object} state — screen state
 */
function eraseLine(mode, state) {
    if (mode === 2) {
        state.grid[state.row].fill(" ");
    } else if (mode === 0) {
        for (let c = state.col; c < state.cols; c++) {
            state.grid[state.row][c] = " ";
        }
    } else if (mode === 1) {
        for (let c = 0; c <= state.col; c++) {
            state.grid[state.row][c] = " ";
        }
    }
}

/**
 * Scroll the screen up by n lines. The top n lines are discarded,
 * remaining lines move up, and the bottom n lines become blank.
 *
 * @param {number} n     — number of lines to scroll
 * @param {object} state — screen state
 */
function scrollUp(n, state) {
    for (let i = 0; i < n && i < state.rows; i++) {
        state.grid.shift();
        state.grid.push(new Array(state.cols).fill(" "));
    }
}

/**
 * Scroll the screen down by n lines. The bottom n lines are discarded,
 * remaining lines move down, and the top n lines become blank.
 *
 * @param {number} n     — number of lines to scroll
 * @param {object} state — screen state
 */
function scrollDown(n, state) {
    for (let i = 0; i < n && i < state.rows; i++) {
        state.grid.pop();
        state.grid.unshift(new Array(state.cols).fill(" "));
    }
}

/**
 * Process a single CSI escape sequence. Updates cursor position
 * and/or grid content based on the command character.
 *
 * Supported: A/B/C/D (cursor relative), H/f (cursor absolute),
 * G/d (cursor axis), E/F (next/prev line), J (erase display),
 * K (erase line), S/T (scroll), m (SGR — ignored).
 *
 * @param {string} paramStr — CSI parameter string
 * @param {string} cmd      — single-character command
 * @param {object} state    — { row, col, grid, rows, cols }
 */
function processCsi(paramStr, cmd, state) {
    // Default depends on command: J/K default to 0 (erase from cursor
    // to end), all others default to 1.
    const eraseCommands = new Set(["J", "K"]);
    const defVal = eraseCommands.has(cmd) ? 0 : 1;
    const p = parseParams(paramStr, defVal);

    switch (cmd) {
        case "A": state.row = clamp(state.row - p[0], 0, state.rows - 1); break;
        case "B": state.row = clamp(state.row + p[0], 0, state.rows - 1); break;
        case "C": state.col = clamp(state.col + p[0], 0, state.cols - 1); break;
        case "D": state.col = clamp(state.col - p[0], 0, state.cols - 1); break;
        case "H":
        case "f":
            state.row = clamp(p[0] - 1, 0, state.rows - 1);
            state.col = clamp((p[1] || 1) - 1, 0, state.cols - 1);
            break;
        case "G": state.col = clamp(p[0] - 1, 0, state.cols - 1); break;
        case "d": state.row = clamp(p[0] - 1, 0, state.rows - 1); break;
        case "E":
            state.row = clamp(state.row + p[0], 0, state.rows - 1);
            state.col = 0;
            break;
        case "F":
            state.row = clamp(state.row - p[0], 0, state.rows - 1);
            state.col = 0;
            break;
        case "J": eraseDisplay(p[0], state); break;
        case "K": eraseLine(p[0], state); break;
        case "S": scrollUp(p[0], state); break;
        case "T": scrollDown(p[0], state); break;
        // SGR, cursor visibility, mode changes — ignored.
        case "m": case "h": case "l": case "r": case "n":
        case "s": case "u": break;
        default: break;
    }
}

module.exports = { processCsi, scrollUp };
