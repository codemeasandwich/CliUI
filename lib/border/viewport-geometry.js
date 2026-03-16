'use strict';

/**
 * lib/border/viewport-geometry.js
 *
 * Row-local geometry calculator for cutout-shaped viewports.
 *
 * Given the outer box dimensions, cutout shape, and scrollbar presence,
 * computes the usable content region for each row. This enables the body
 * compositor to know exactly how many columns are available for content,
 * where inner borders can legally exist, and where clipping must occur.
 *
 * The viewport is bounded by:
 *   - Outer left border (col xi, heavy ┃)
 *   - Outer right border (col xl-1, heavy ┃)
 *   - Scrollbar column (col xl-2, inside the right border)
 *   - Top cutout step (reduces available width in the step region)
 *   - Bottom cutout step (reduces available width in the step region)
 *
 * Key concepts:
 *   bodyTop     — first row of the body content area (yi with top cutout, yi+1 otherwise)
 *   bodyBottom  — last row of the body content area (yl-2, above bottom border)
 *   contentLeft — first usable content column per row (xi+1 normally)
 *   contentRight— last usable content column per row (before scrollbar)
 */

/**
 * Compute viewport geometry for a cutout-aware body render.
 *
 * @param {object} opts
 * @param {number} opts.xi - Outer box left column (inclusive)
 * @param {number} opts.xl - Outer box right column (exclusive)
 * @param {number} opts.yi - Outer box top row
 * @param {number} opts.yl - Outer box bottom row (exclusive)
 * @param {boolean} opts.hasScrollbar - Whether a scrollbar column is present
 * @param {object} [opts.topCutout] - Top cutout: { width, height } (step at top-right)
 * @param {object} [opts.bottomCutout] - Bottom cutout: { width, height } (step at bottom-right)
 * @returns {object} Viewport geometry with row-local width data
 */
function computeViewport(opts) {
  var xi = opts.xi;
  var xl = opts.xl;
  var yi = opts.yi;
  var yl = opts.yl;
  var hasScrollbar = opts.hasScrollbar;
  var topCutout = opts.topCutout || null;
  var bottomCutout = opts.bottomCutout || null;

  // Body content area: rows between outer top/bottom borders.
  // When a top cutout exists, the step junction row (yi) doubles as the first
  // body row — the top transition renderer handles the left side (step closure),
  // while body content and scrollbar occupy the right side. Without a top
  // cutout, the first body row is yi+1 (below the outer top border).
  var bodyTop = topCutout ? yi : (yi + 1);
  var bodyBottom = yl - 2;

  // Outer border columns
  var outerLeft = xi;
  var outerRight = xl - 1;

  // Scrollbar column sits inside the outer right border
  var scrollbarCol = hasScrollbar ? (outerRight - 1) : -1;

  // Default content bounds (without cutout effects)
  // Content starts after the outer left border
  var defaultLeft = xi + 1;
  // Content ends before the scrollbar (if present) and outer right border
  var defaultRight = hasScrollbar ? (scrollbarCol - 1) : (outerRight - 1);

  // Bottom cutout transition: the last row(s) of the body may be narrower
  // because the cutout step border cuts into the content area from the left.
  // The step border structure looks like:
  //   ┃│ text ┏━━━━━━━━┷━┛
  //   ┗┷━━━━━━┛ footer
  // The step border starts at column (xi + cutoutWidth + 1) on the transition row.
  var bottomTransitionRow = -1;
  var bottomStepCol = -1;
  if (bottomCutout) {
    bottomTransitionRow = bodyBottom;
    // The step starts at xi + CW + 1 where CW = cutout.width
    bottomStepCol = xi + bottomCutout.width + 1;
  }

  // Top cutout: similar but at the top — reduces width in top rows
  var topTransitionRow = -1;
  var topStepCol = -1;
  if (topCutout) {
    topTransitionRow = bodyTop;
    topStepCol = xi + topCutout.width + 1;
  }

  return {
    // Overall body bounds
    bodyTop: bodyTop,
    bodyBottom: bodyBottom,
    bodyHeight: bodyBottom - bodyTop + 1,

    // Outer border positions
    outerLeft: outerLeft,
    outerRight: outerRight,

    // Default content bounds
    defaultContentLeft: defaultLeft,
    defaultContentRight: defaultRight,
    defaultContentWidth: defaultRight - defaultLeft + 1,

    // Scrollbar
    scrollbarCol: scrollbarCol,
    hasScrollbar: hasScrollbar,

    // Cutout transition info (for the compositor to resolve special rows)
    bottomTransitionRow: bottomTransitionRow,
    bottomStepCol: bottomStepCol,
    topTransitionRow: topTransitionRow,
    topStepCol: topStepCol
  };
}

/**
 * Get the content width available for a specific body row.
 *
 * Accounts for the cutout step narrowing certain rows. On the bottom
 * transition row, content is clipped at the step column.
 *
 * @param {object} viewport - Result from computeViewport()
 * @param {number} row - Absolute screen row index
 * @param {number} [stepCol] - If on a transition row, the step column that cuts in
 * @returns {{ left: number, right: number, width: number }}
 */
function getRowBounds(viewport, row, stepCol) {
  var left = viewport.defaultContentLeft;
  var right = viewport.defaultContentRight;

  // If a step column is specified, content ends before the step
  if (stepCol > 0 && stepCol <= right) {
    right = stepCol - 1;
  }

  return {
    left: left,
    right: right,
    width: Math.max(0, right - left + 1)
  };
}

exports.computeViewport = computeViewport;
exports.getRowBounds = getRowBounds;
