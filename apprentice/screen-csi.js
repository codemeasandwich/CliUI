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
 * Purpose: Parse a CSI parameter string like "5" or "1;2" into an array
 * of integers. Missing or empty params default to the provided defaultVal
 * (usually 1 for movement commands, 0 for erase commands).
 * Inputs:
 *   - paramStr: {string} raw parameter string from the CSI sequence
 *   - defaultVal: {number} fallback value for missing or NaN params
 * Outputs: {number[]} parsed integer parameters
 * Side effects: None — pure function.
 * Runner/env interactions: None.
 * Capture behavior: None — operates on already-captured data.
 * Failure behavior: Returns [defaultVal] for empty/null input; NaN entries become defaultVal.
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
 * Purpose: Clamp a value between min and max (inclusive).
 * Inputs:
 *   - val: {number} value to clamp
 *   - min: {number} lower bound
 *   - max: {number} upper bound
 * Outputs: {number} clamped value
 * Side effects: None — pure function.
 * Runner/env interactions: None.
 * Capture behavior: None.
 * Failure behavior: None — always returns a valid number.
 */
function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

/**
 * Purpose: Erase part or all of the display based on the erase mode.
 *   0 — from cursor to end of screen
 *   1 — from start of screen to cursor
 *   2 or 3 — entire screen
 * Inputs:
 *   - mode: {number} erase mode (0, 1, 2, or 3)
 *   - state: {object} screen state { row, col, grid, rows, cols }
 * Outputs: None (mutates state.grid in place).
 * Side effects: Fills grid cells with spaces according to the erase mode.
 * Runner/env interactions: None.
 * Capture behavior: None — operates on the virtual screen buffer.
 * Failure behavior: Unrecognized modes are silently ignored (no-op).
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
 * Purpose: Erase part or all of the current line based on the erase mode.
 *   0 — from cursor to end of line
 *   1 — from start of line to cursor
 *   2 — entire line
 * Inputs:
 *   - mode: {number} erase mode (0, 1, or 2)
 *   - state: {object} screen state { row, col, grid, rows, cols }
 * Outputs: None (mutates state.grid in place).
 * Side effects: Fills grid cells on the current row with spaces.
 * Runner/env interactions: None.
 * Capture behavior: None — operates on the virtual screen buffer.
 * Failure behavior: Unrecognized modes are silently ignored (no-op).
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
 * Purpose: Scroll the screen up by n lines. The top n lines are discarded,
 * remaining lines move up, and the bottom n lines become blank.
 * Inputs:
 *   - n: {number} number of lines to scroll
 *   - state: {object} screen state { row, col, grid, rows, cols }
 * Outputs: None (mutates state.grid in place).
 * Side effects: Shifts rows out of state.grid and pushes blank rows at the bottom.
 * Runner/env interactions: None.
 * Capture behavior: None — operates on the virtual screen buffer.
 * Failure behavior: Clamps to state.rows to prevent over-scrolling.
 */
function scrollUp(n, state) {
    for (let i = 0; i < n && i < state.rows; i++) {
        state.grid.shift();
        state.grid.push(new Array(state.cols).fill(" "));
    }
}

/**
 * Purpose: Scroll the screen down by n lines. The bottom n lines are discarded,
 * remaining lines move down, and the top n lines become blank.
 * Inputs:
 *   - n: {number} number of lines to scroll
 *   - state: {object} screen state { row, col, grid, rows, cols }
 * Outputs: None (mutates state.grid in place).
 * Side effects: Pops rows from the bottom of state.grid and unshifts blank rows at the top.
 * Runner/env interactions: None.
 * Capture behavior: None — operates on the virtual screen buffer.
 * Failure behavior: Clamps to state.rows to prevent over-scrolling.
 */
function scrollDown(n, state) {
    for (let i = 0; i < n && i < state.rows; i++) {
        state.grid.pop();
        state.grid.unshift(new Array(state.cols).fill(" "));
    }
}

/**
 * Purpose: Process a single CSI escape sequence. Updates cursor position
 * and/or grid content based on the command character.
 * Supported: A/B/C/D (cursor relative), H/f (cursor absolute),
 * G/d (cursor axis), E/F (next/prev line), J (erase display),
 * K (erase line), S/T (scroll), m (SGR — ignored).
 * Inputs:
 *   - paramStr: {string} CSI parameter string (e.g. "5" or "1;2")
 *   - cmd: {string} single-character command letter (e.g. "H", "J", "m")
 *   - state: {object} screen state { row, col, grid, rows, cols }
 * Outputs: None (mutates state in place — cursor position and/or grid content).
 * Side effects: Delegates to eraseDisplay, eraseLine, scrollUp, or scrollDown for grid mutations.
 * Runner/env interactions: None.
 * Capture behavior: None — operates on already-captured and parsed data.
 * Failure behavior: Unknown commands fall through the default case and are silently ignored.
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
