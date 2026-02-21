'use strict';

/**
 * lib/border/geometry.js
 *
 * Step geometry and text alignment helpers for corner cutouts.
 *
 * All coordinates are absolute screen positions derived from element lpos fields:
 *   xi = element left col (includes border)
 *   xl = element right col exclusive
 *   yi = element top row
 *   yl = element bottom row exclusive
 *
 * CH = cutout height (line count)
 * CW = cutout width (max line length)
 *
 * CH=1 edge case: there are zero wall rows — the junction and closing rows collapse
 * into a single visual unit. The step has only the junction row (part of the box edge)
 * plus the text sitting outside the border. No step walls are drawn.
 */

/**
 * stepGeometry(position, xi, xl, yi, yl, CH, CW)
 *
 * Compute absolute screen coordinates for each part of the step.
 *
 * Returns:
 *   junctionRow   — the row where the box edge meets the step
 *   stepLeftCol   — left column of the step opening
 *   stepRightCol  — right column of the step opening (inclusive)
 *   textColBase   — starting column for text rendering (left edge of text area)
 *
 * Corner geometry table:
 *
 * | Corner        | junctionRow | stepLeftCol  | stepRightCol | textColBase      |
 * |---------------|-------------|--------------|--------------|------------------|
 * | top-right     | yi          | xl-CW-2      | xl-1         | xl-CW-2          |
 * | top-left      | yi          | xi           | xi+CW+1      | xi+1             |
 * | bottom-right  | yl-1        | xl-CW-2      | xl-1         | xl-CW-2          |
 * | bottom-left   | yl-1        | xi           | xi+CW+1      | xi+1             |
 *
 * textColBase is the step wall column for right-side corners (top-right, bottom-right),
 * or the first text column for left-side corners (top-left, bottom-left).
 *
 * Text is rendered in the CW interior columns between the two step walls:
 *   right-side corners: text columns [stepLeftCol+1 .. stepLeftCol+CW]  (= [textColBase+1 .. textColBase+CW])
 *   left-side corners:  text columns [stepLeftCol+1 .. stepRightCol-1]  (= [textColBase .. textColBase+CW-1])
 *
 * @param {string} position  - 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
 * @param {number} xi        - element absolute left col (including border)
 * @param {number} xl        - element absolute right col (exclusive)
 * @param {number} yi        - element absolute top row
 * @param {number} yl        - element absolute bottom row (exclusive)
 * @param {number} CH        - cutout height
 * @param {number} CW        - cutout width
 * @returns {{ junctionRow: number, stepLeftCol: number, stepRightCol: number, textColBase: number }}
 */
function stepGeometry(position, xi, xl, yi, yl, CH, CW) {
  switch (position) {
  case 'top-right':
    return {
      junctionRow:  yi,
      stepLeftCol:  xl - CW - 2,
      stepRightCol: xl - 1,
      textColBase:  xl - CW - 2   // = stepLeftCol; text in [textColBase+1 .. textColBase+CW], right-aligned
    };
  case 'top-left':
    return {
      junctionRow:  yi,
      stepLeftCol:  xi,
      stepRightCol: xi + CW + 1,
      textColBase:  xi + 1        // = stepLeftCol+1; text in [textColBase .. textColBase+CW-1], left-aligned
    };
  case 'bottom-right':
    return {
      junctionRow:  yl - 1,
      stepLeftCol:  xl - CW - 2,
      stepRightCol: xl - 1,
      textColBase:  xl - CW - 2   // = stepLeftCol; text in [textColBase+1 .. textColBase+CW], left-aligned
    };
  case 'bottom-left':
    return {
      junctionRow:  yl - 1,
      stepLeftCol:  xi,
      stepRightCol: xi + CW + 1,
      textColBase:  xi + 1        // = stepLeftCol+1; text in [textColBase .. textColBase+CW-1], right-aligned
    };
  default:
    return null;
  }
}

/**
 * stepJunctionChars(position, charset)
 *
 * Return the junction characters for a given corner position.
 *
 * Per §4.4, the junction row replaces the original box corner with step characters:
 *
 * | Corner       | At stepLeftCol   | At stepRightCol  |
 * |--------------|------------------|------------------|
 * | top-right    | bottomRight      | (original topRight, unchanged) |
 * | top-left     | (original topLeft, unchanged) | bottomLeft |
 * | bottom-right | topLeft          | bottomRight (original, unchanged) |
 * | bottom-left  | bottomLeft (original, unchanged) | topRight |
 *
 * Returns { leftChar, rightChar } where either may be null to indicate
 * the original box corner character should be preserved (not overwritten).
 *
 * @param {string} position - corner position
 * @param {object} charset  - resolved charset object with topLeft, topRight, etc.
 * @returns {{ leftChar: string|null, rightChar: string|null }}
 */
function stepJunctionChars(position, charset) {
  switch (position) {
  case 'top-right':
    // Junction (box top row): bottomRight at stepLeftCol; topRight at stepRightCol (unchanged)
    return { leftChar: charset.bottomRight, rightChar: null };
  case 'top-left':
    // Junction (box top row): topLeft at stepLeftCol (unchanged); bottomLeft at stepRightCol
    return { leftChar: null, rightChar: charset.bottomLeft };
  case 'bottom-right':
    // Junction (box bottom row): topLeft at stepLeftCol; bottomRight at stepRightCol (unchanged)
    return { leftChar: charset.topLeft, rightChar: null };
  case 'bottom-left':
    // Junction (box bottom row): bottomLeft at stepLeftCol (unchanged); topRight at stepRightCol
    return { leftChar: null, rightChar: charset.topRight };
  default:
    return { leftChar: null, rightChar: null };
  }
}

/**
 * textAlignment(position)
 *
 * Return the text alignment direction for a given corner position.
 *
 * Per §4.3, short lines are padded toward the box edge (flush against the step border wall):
 *   - top-right, bottom-left: RIGHT-align (pad left with spaces, flush against right step wall)
 *   - top-left, bottom-right: LEFT-align (pad right with spaces, flush against left step wall)
 *
 * @param {string} position - corner position
 * @returns {'left'|'right'}
 */
function textAlignment(position) {
  if (position === 'top-right' || position === 'bottom-left') {
    return 'right';
  }
  return 'left';
}

/**
 * rightAlign(str, width)
 *
 * Pad str on the left with spaces to reach exactly `width` characters.
 * Truncates if str is longer than width.
 */
function rightAlign(str, width) {
  str = str || '';
  if (str.length >= width) return str.slice(0, width);
  return Array(width - str.length + 1).join(' ') + str;
}

/**
 * leftAlign(str, width)
 *
 * Pad str on the right with spaces to reach exactly `width` characters.
 * Truncates if str is longer than width.
 */
function leftAlign(str, width) {
  str = str || '';
  if (str.length >= width) return str.slice(0, width);
  return str + Array(width - str.length + 1).join(' ');
}

/**
 * alignText(str, width, alignment)
 *
 * Convenience: align str to width according to the given alignment direction.
 *
 * @param {string} str
 * @param {number} width
 * @param {'left'|'right'} alignment
 * @returns {string}
 */
function alignText(str, width, alignment) {
  return alignment === 'right' ? rightAlign(str, width) : leftAlign(str, width);
}

exports.stepGeometry    = stepGeometry;
exports.stepJunctionChars = stepJunctionChars;
exports.textAlignment   = textAlignment;
exports.rightAlign      = rightAlign;
exports.leftAlign       = leftAlign;
exports.alignText       = alignText;
