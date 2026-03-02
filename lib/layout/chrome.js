'use strict';
// @esm-group Layout

/**
 * lib/layout/chrome.js
 *
 * Generic L-shaped chrome frame widget for terminal dashboards.
 *
 * Creates a borderless full-screen box and paints the entire chrome border
 * (logo, heavy frame, section separators, tee junctions, vertical dividers,
 * L-shaped footer step, footer text, static character fixups) into the screen
 * buffer via a post-render hook. This replaces manual cell-by-cell painting
 * in consumer code with a configurable API.
 *
 * The chrome frame layout:
 *   Row 0:          Logo line 1 (cols 0 to logoWidth-1) + ┏━━━┓ heavy top border
 *   Row 1:          Logo line 2 (cols 0 to logoWidth-1) + ┃ tab bar ┃ walls
 *   Row 2:          Transition ┏━━━━━━━━━━━━━━━━┻─────...─┫
 *   Rows 3-maxY-2:  ┃ content ┃ with page-specific section separators + dividers
 *   Row maxY-1:     ┃ spaces ┏━━━━━━━━━━━━━━━...━─┘ footer step
 *   Row maxY:       ┗━━━━━━━━┛ footer text
 *
 * Page-specific layout (separators, dividers, static fixups) is injected via
 * setLayout(). The chrome module has no knowledge of page names or how layout
 * is computed — it just paints whatever layout spec it receives.
 */

var blessed = require('../blessed');
var screenLines = require('../border/screen-lines');
var writeCell = screenLines.writeCell;
var cellAttr = screenLines.cellAttr;

/**
 * Create an L-shaped chrome frame for a dashboard screen.
 *
 * The frame is painted directly into screen.lines via a render event hook,
 * running after all child widgets have rendered. This ensures chrome characters
 * (borders, separators, fixups) overlay widget content where required by the
 * layout template contract.
 *
 * @param {Object} screen    - Blessed screen instance
 * @param {Object} opts      - Chrome configuration
 * @param {string[]} opts.logo      - Up to 2 lines of logo text (raw strings).
 *   Combining characters (U+0300-U+036F) are handled: they attach to the
 *   previous cell's content string rather than advancing the column counter.
 * @param {string} opts.footer      - Footer text placed after the ┛ on the
 *   bottom row. Leading spaces are significant (provide gap between ┛ and text).
 * @param {number} [opts.stepRatio] - L-step column as a fraction of screen
 *   width. Default 38/120 (step at col 38 in a 120-col terminal).
 * @param {number} [opts.logoWidth] - Column width of the logo area (cols 0 to
 *   logoWidth-1). Default 16. Determines where the top border starts and
 *   where the transition row connects heavy→light borders.
 *
 * @returns {{
 *   element: Object,
 *   setLayout: Function,
 *   getCutoutInner: Function,
 *   setCutout: Function
 * }}
 */
module.exports = function createChrome(screen, opts) {
  var logo = opts.logo || [];
  var footer = opts.footer || '';
  var stepRatio = opts.stepRatio != null ? opts.stepRatio : 38 / 120;
  var logoWidth = opts.logoWidth || 16;

  // Borderless full-screen container — all chrome characters are painted
  // by the render hook below, not by blessed's border system. Child widgets
  // (grid cells, tab bar, status bar) are appended to this element.
  var el = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    tags: true,
    style: { transparent: false },
  });

  // Current page layout — contains separators, dividers, and static fixup
  // positions. Set via setLayout() when the consumer changes pages. The render
  // hook reads this on every frame to paint page-specific chrome elements.
  var currentLayout = null;

  // ── Render hook: paints the entire L-shaped chrome border into screen.lines
  // after blessed renders the base box and all child widgets. Runs every frame.
  el.on('render', function paintChrome() {
    var lines = screen.lines;
    if (!lines || !lines[0]) return;

    var maxX = screen.cols - 1;
    var maxY = screen.rows - 1;
    // Footer L-shape step column — scales proportionally with screen width.
    // At 120 cols → 38, at 245 cols → 77, at 121 cols → 38.
    var stepCol = Math.floor(screen.cols * stepRatio);

    // Get attribute from existing cells for consistent coloring — inherits
    // whatever fg/bg the screen uses without hardcoding color values.
    var attr = cellAttr(lines, 0, 0);

    // ── Row 0: Logo line 1 + heavy top border ────────────────────────
    // Logo occupies cols 0 to logoWidth-1, space at logoWidth, ┏ at logoWidth+1,
    // ━ fill, ┓ at maxX.
    paintLogoLine(lines, 0, logo[0] || '', attr, logoWidth);
    writeCell(lines, 0, logoWidth, attr, ' ');
    writeCell(lines, 0, logoWidth + 1, attr, '\u250F'); // ┏
    for (var x0 = logoWidth + 2; x0 < maxX; x0++) writeCell(lines, 0, x0, attr, '\u2501'); // ━
    writeCell(lines, 0, maxX, attr, '\u2513'); // ┓
    if (lines[0]) lines[0].dirty = true;

    // ── Row 1: Logo line 2 + ┃ tab bar area ┃ ───────────────────────
    paintLogoLine(lines, 1, logo[1] || '', attr, logoWidth);
    writeCell(lines, 1, logoWidth, attr, ' ');
    writeCell(lines, 1, logoWidth + 1, attr, '\u2503'); // ┃
    writeCell(lines, 1, logoWidth + 2, attr, ' '); // Static space before tab bar
    // Tab bar content (cols logoWidth+3 to maxX-1) rendered by tab-bar widget
    writeCell(lines, 1, maxX, attr, '\u2503'); // ┃
    if (lines[1]) lines[1].dirty = true;

    // ── Row 2: Transition row ┏━━━━━━━━━━━━━━━━┻─────...─┫ ──────────
    // Heavy border on the left (logo area), tee junction where the logo area
    // meets the content area, light horizontal fill, heavy right wall.
    writeCell(lines, 2, 0, attr, '\u250F'); // ┏
    for (var x2 = 1; x2 <= logoWidth; x2++) writeCell(lines, 2, x2, attr, '\u2501'); // ━
    writeCell(lines, 2, logoWidth + 1, attr, '\u253B'); // ┻ heavy up and horizontal
    for (var x2b = logoWidth + 2; x2b < maxX; x2b++) writeCell(lines, 2, x2b, attr, '\u2500'); // ─ light
    writeCell(lines, 2, maxX, attr, '\u252B'); // ┫ heavy vertical and left
    if (lines[2]) lines[2].dirty = true;

    // ── Rows 3 to maxY-2: Heavy vertical borders on left and right ──
    for (var ys = 3; ys <= maxY - 2; ys++) {
      writeCell(lines, ys, 0, attr, '\u2503');    // ┃
      writeCell(lines, ys, maxX, attr, '\u2503'); // ┃
    }

    // ── Section separators — page-specific horizontal rules with tee junctions
    // Reads from the injected layout (which is size-aware) to support
    // correct rendering at any terminal size.
    var separators = currentLayout ? currentLayout.separators : [];
    for (var si = 0; si < separators.length; si++) {
      var sep = separators[si];
      var sepY = sep.y;
      var teeCols = sep.cols;
      var dir = sep.dir;
      if (sepY < 3 || sepY > maxY - 2 || !lines[sepY]) continue;

      if (dir === 'heavy') {
        // Full-width heavy separator: ┣──────────────────────────────┫
        // Templates use light ─ between heavy ┣/┫ for visual distinction
        // from the chrome's heavy ━ outer border.
        writeCell(lines, sepY, 0, attr, '\u2523');    // ┣
        for (var xh = 1; xh < maxX; xh++) writeCell(lines, sepY, xh, attr, '\u2500'); // ─
        writeCell(lines, sepY, maxX, attr, '\u252B'); // ┫
      } else {
        // Light separator with tee junctions: ┣────┬────┫ or ┣────┴────┫
        writeCell(lines, sepY, 0, attr, '\u2523');    // ┣
        for (var xl = 1; xl < maxX; xl++) writeCell(lines, sepY, xl, attr, '\u2500'); // ─
        writeCell(lines, sepY, maxX, attr, '\u252B'); // ┫
        // Place tee chars at column split positions
        var teeChar = dir === 'down' ? '\u252C' : '\u2534'; // ┬ or ┴
        for (var ti = 0; ti < teeCols.length; ti++) {
          writeCell(lines, sepY, teeCols[ti], attr, teeChar);
        }
      }
      if (lines[sepY]) lines[sepY].dirty = true;
    }

    // ── Vertical dividers — light │ between widget columns ───────────
    // Reads from the injected layout instead of hardcoded tables.
    var dividers = currentLayout ? currentLayout.dividers : [];
    for (var di = 0; di < dividers.length; di++) {
      var divCol = dividers[di].col;
      var fromY = dividers[di].fromY;
      var toY = dividers[di].toY;
      for (var yd = fromY + 1; yd < toY; yd++) {
        writeCell(lines, yd, divCol, attr, '\u2502'); // │
      }
    }

    // ── Row maxY-1: Footer step ┃ spaces ┏━━━...━─┘ ─────────────────
    // The L-shaped step creates the distinctive asymmetric bottom border.
    // stepCol scales proportionally with screen width via stepRatio.
    var stepY = maxY - 1;
    writeCell(lines, stepY, 0, attr, '\u2503'); // ┃ left border continues
    for (var xs = 1; xs < stepCol; xs++) writeCell(lines, stepY, xs, attr, ' ');
    writeCell(lines, stepY, stepCol, attr, '\u250F'); // ┏ step corner
    for (var xs2 = stepCol + 1; xs2 < maxX - 1; xs2++) writeCell(lines, stepY, xs2, attr, '\u2501'); // ━
    writeCell(lines, stepY, maxX - 1, attr, '\u2500'); // ─ light transition
    writeCell(lines, stepY, maxX, attr, '\u2518');     // ┘ light bottom-right
    if (lines[stepY]) lines[stepY].dirty = true;

    // ── Row maxY: Bottom border ┗━━━┛ + footer text ─────────────────
    var botY = maxY;
    writeCell(lines, botY, 0, attr, '\u2517'); // ┗
    for (var xb = 1; xb < stepCol; xb++) writeCell(lines, botY, xb, attr, '\u2501'); // ━
    writeCell(lines, botY, stepCol, attr, '\u251B'); // ┛
    // Footer text after the step — footer string provides its own leading
    // space for the gap between ┛ and text content.
    for (var fi = 0; fi < footer.length; fi++) {
      var xf = stepCol + 1 + fi;
      if (xf <= maxX) writeCell(lines, botY, xf, attr, footer[fi]);
    }
    // Fill remaining columns with spaces to clear any stale content
    for (var xr = stepCol + 1 + footer.length; xr <= maxX; xr++) {
      writeCell(lines, botY, xr, attr, ' ');
    }
    if (lines[botY]) lines[botY].dirty = true;

    // ── Static character fixups — paint template-contract characters after
    // all widget children have rendered. Overwrites blessed's content padding
    // with exact characters the layout template requires at gap positions,
    // title-row separators, widget-internal field separators, sub-box borders,
    // histogram axes, and dialog frames.
    //
    // Each entry can specify:
    //   cols      — array of individual column positions
    //   fromCol/toCol — inclusive range of columns (for dense runs like ═══)
    //   char      — character to paint (defaults to │ for backward compat)
    //   y or fromY/toY — row or row range
    var pipes = currentLayout ? currentLayout.staticPipes : null;
    if (pipes) {
      for (var pi = 0; pi < pipes.length; pi++) {
        var entry = pipes[pi];
        var startY = entry.y != null ? entry.y : entry.fromY;
        var endY = entry.y != null ? entry.y : entry.toY;
        var ch = entry.char || '\u2502'; // default │
        for (var yp = startY; yp <= endY; yp++) {
          // Paint at individual column positions
          if (entry.cols) {
            for (var ci = 0; ci < entry.cols.length; ci++) {
              writeCell(lines, yp, entry.cols[ci], attr, ch);
            }
          }
          // Paint across a column range (for dense runs like ═══ or ───)
          if (entry.fromCol != null) {
            for (var xp = entry.fromCol; xp <= entry.toCol; xp++) {
              writeCell(lines, yp, xp, attr, ch);
            }
          }
        }
      }
    }
  });

  // ── Public API ─────────────────────────────────────────────────────

  return {
    /** Borderless full-screen box — parent element for all dashboard widgets. */
    element: el,

    /**
     * Set the page-specific layout for separator, divider, and fixup painting.
     * Called when the consumer changes pages. The layout spec has the shape:
     *   { separators: Array, dividers: Array, staticPipes: Array|null }
     *
     * @param {Object} spec - Layout specification (from computePageLayout or equivalent)
     */
    setLayout: function setLayout(spec) {
      currentLayout = spec;
    },

    /**
     * Get the inner bounds for a cutout zone (e.g. tab bar area).
     * Currently only 'top-right' is supported — returns the tab bar slot
     * on row 1 between the ┃ walls, after the logo area.
     *
     * @param {'top-right'} position - Cutout position identifier
     * @returns {{ top: number, left: number, width: number, height: number }|null}
     */
    getCutoutInner: function getCutoutInner(position) {
      if (position === 'top-right') {
        // Tab bar area: row 1, starting after logo + space + ┃ + space.
        // logoWidth (16) + 1 (space) + 1 (┃) + 1 (space) = logoWidth + 3 = 19
        // Width extends to maxX - 1 (inside the right ┃ wall).
        var left = logoWidth + 3;
        return {
          top: 1,
          left: left,
          width: screen.cols - left - 1,
          height: 1,
        };
      }
      return null;
    },

    /**
     * No-op — preserved for API compatibility. The chrome render hook
     * paints logo and footer directly; setCutout is not needed.
     */
    setCutout: function setCutout() {},
  };
};

// ── Logo line painter ────────────────────────────────────────────────

/**
 * Paint a logo line into screen.lines at the given row.
 *
 * Handles Unicode combining characters (U+0300-U+036F) which have zero width
 * and must be appended to the previous cell's content string rather than
 * occupying their own cell. Fills remaining columns up to logoWidth with
 * spaces if the logo text is shorter than the allocated area.
 *
 * @param {Array} lines     - screen.lines array
 * @param {number} row      - Row index to paint on
 * @param {string} text     - Logo line text (raw string, may contain combining chars)
 * @param {number} attr     - Cell attribute for consistent coloring
 * @param {number} logoWidth - Column width of the logo area
 */
function paintLogoLine(lines, row, text, attr, logoWidth) {
  var chars = Array.from(text);
  var col = 0;

  for (var i = 0; i < chars.length; i++) {
    var ch = chars[i];
    var cp = ch.codePointAt(0);

    // Combining characters (width 0) attach to previous cell — skip col advance.
    // Must process combining chars even after col exceeds logoWidth because the
    // combining char modifies the previous cell's content, not a new cell.
    if (cp >= 0x0300 && cp <= 0x036F) {
      if (col > 0 && lines[row] && lines[row][col - 1]) {
        lines[row][col - 1] = [attr, (lines[row][col - 1][1] || '') + ch];
      }
      continue;
    }

    // Stop placing new base characters once logo area is full
    if (col >= logoWidth) break;
    writeCell(lines, row, col, attr, ch);
    col++;
  }

  // Fill remaining logo area with spaces if text is shorter
  while (col < logoWidth) {
    writeCell(lines, row, col, attr, ' ');
    col++;
  }
}
