#!/usr/bin/env node
'use strict';

/**
 * ESM index generator — reads index.js and source file @esm-group tags to
 * produce a categorized index.mjs with named exports.
 *
 * How it works:
 *   1. Parses index.js for `exports.NAME = require('./PATH')` lines
 *   2. Reads each source file's `// @esm-group GroupName` tag
 *   3. Groups custom exports by their declared group
 *   4. Reads blessed internals for core, class, factory, and alias exports
 *   5. Writes index.mjs only if content changed
 *
 * Underscores in group names become spaces in generated comments
 * (e.g. Server_Utils → "Server Utils exports").
 *
 * Run manually:  node scripts/generate-esm.js
 * Or via npm:    npm run generate:esm
 * Auto-runs via pre-commit hook when index.js or lib/ files change.
 */

var fs = require('fs');
var path = require('path');

// Project root is one level up from scripts/
var ROOT = path.resolve(__dirname, '..');

// ── Step 1: Parse index.js for explicit exports ────────────────────────

var indexSource = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8');
var lines = indexSource.split('\n');

// Pattern: exports.NAME = require('./PATH')
// Pattern: exports.NAME = require('./PATH').PROP
var exportLineRe = /^exports\.(\w+)\s*=\s*require\(\s*'([^']+)'\s*\)(?:\.(\w+))?/;

// Collect { name, filePath } for each explicit export in index.js.
// filePath is the resolved require target (without .PROP access).
var customExports = [];
for (var i = 0; i < lines.length; i++) {
  var line = lines[i];

  // Skip the blessed merge block (Object.keys(blessed).forEach)
  if (line.indexOf('Object.keys') !== -1) continue;

  // Skip side-effect imports (no exports. prefix)
  if (line.indexOf('exports.') === -1) continue;

  var match = line.match(exportLineRe);
  if (!match) continue;

  var exportName = match[1];
  var requirePath = match[2];

  // Resolve the require path to an absolute file path.
  // require('./lib/widget/gauge.js') → /abs/lib/widget/gauge.js
  // require('./lib/widget/map')      → /abs/lib/widget/map.js
  var resolved = path.resolve(ROOT, requirePath);
  if (!resolved.endsWith('.js')) resolved += '.js';

  customExports.push({ name: exportName, filePath: resolved });
}

// ── Step 2: Read @esm-group tags from each source file ─────────────────

// Map from group name → ordered array of export names.
// Uses insertion order from index.js to preserve grouping order.
var groupMap = {};
// Track group order by first appearance
var groupOrder = [];

var esmGroupRe = /\/\/\s*@esm-group\s+(\S+)/;

for (var j = 0; j < customExports.length; j++) {
  var exp = customExports[j];
  var group = null;

  // Read the source file and scan for @esm-group tag.
  // Only scan the first 10 lines — the tag should be near the top.
  try {
    var src = fs.readFileSync(exp.filePath, 'utf8');
    var srcLines = src.split('\n').slice(0, 10);
    for (var k = 0; k < srcLines.length; k++) {
      var gm = srcLines[k].match(esmGroupRe);
      if (gm) {
        group = gm[1];
        break;
      }
    }
  } catch (err) {
    // If the file can't be read, fall through to the warning below
  }

  if (!group) {
    // Warn but don't fail — place in an "Uncategorized" group so the
    // export still appears in index.mjs rather than being silently lost.
    process.stderr.write(
      'Warning: No @esm-group tag found in ' + exp.filePath + ' (export: ' + exp.name + ')\n'
    );
    group = 'Uncategorized';
  }

  if (!groupMap[group]) {
    groupMap[group] = [];
    groupOrder.push(group);
  }
  groupMap[group].push(exp.name);
}

// ── Step 3: Extract blessed export categories ──────────────────────────

// 3a. Core modules from blessed/lib/blessed.js
// Pattern: blessed.NAME = blessed.NAME = require(...)
// or blessed.NAME = require(...)
var blessedSrc = fs.readFileSync(path.join(ROOT, 'blessed', 'lib', 'blessed.js'), 'utf8');

// Extract core module names: program, Program, tput, Tput, widget, colors, unicode, helpers
// blessed.program = blessed.Program = require('./program')  →  program, Program
// blessed.widget = require('./widget')                     →  widget
var coreExports = [];
var coreRe = /blessed\.(\w+)\s*=\s*(?:blessed\.(\w+)\s*=\s*)?require/g;
var cm;
while ((cm = coreRe.exec(blessedSrc)) !== null) {
  // cm[1] is always present (e.g. "program"), cm[2] is the PascalCase alias if present
  if (cm[2]) {
    // blessed.program = blessed.Program = require(...)
    // cm[1] = "program", cm[2] = "Program"
    coreExports.push(cm[1]);
    coreExports.push(cm[2]);
  } else {
    coreExports.push(cm[1]);
  }
}

// 3b. Widget classes from blessed/lib/widget.js
var widgetSrc = fs.readFileSync(path.join(ROOT, 'blessed', 'lib', 'widget.js'), 'utf8');

// Extract widget.classes array entries
var classesMatch = widgetSrc.match(/widget\.classes\s*=\s*\[([\s\S]*?)\]/);
var widgetClasses = [];
if (classesMatch) {
  var classEntries = classesMatch[1].match(/'([^']+)'/g);
  if (classEntries) {
    widgetClasses = classEntries.map(function (e) { return e.replace(/'/g, ''); });
  }
}

// Factory names are lowercase versions of class names
var widgetFactories = widgetClasses.map(function (c) { return c.toLowerCase(); });

// 3c. Aliases from widget.aliases object
var aliasesMatch = widgetSrc.match(/widget\.aliases\s*=\s*\{([\s\S]*?)\}/);
var aliasExports = [];
if (aliasesMatch) {
  var aliasEntries = aliasesMatch[1].match(/'([^']+)'/g);
  if (aliasEntries) {
    // Every odd entry is the alias key (ListBar, PNG), even entries are the target
    for (var a = 0; a < aliasEntries.length; a += 2) {
      aliasExports.push(aliasEntries[a].replace(/'/g, ''));
    }
  }
}

// ── Step 4: Generate index.mjs ─────────────────────────────────────────

// Build a Set of all custom export names so blessed categories can skip
// names already declared (e.g. "line" is both a Charts export and a
// blessed factory — the custom export wins and blessed must not re-declare it).
var declaredNames = {};
for (var d = 0; d < customExports.length; d++) {
  declaredNames[customExports[d].name] = true;
}

// Helper: emit an export const block, skipping names already declared.
// Returns the names actually emitted (for tracking).
function emitBlock(out, names, declared) {
  var filtered = names.filter(function (n) { return !declared[n]; });
  for (var x = 0; x < filtered.length; x++) {
    var comma = (x < filtered.length - 1) ? ',' : '';
    out.push('  ' + filtered[x] + comma);
    declared[filtered[x]] = true;
  }
  return filtered;
}

var out = [];
out.push("import galactica from './index.js';");
out.push('');

// Custom export groups (from @esm-group tags)
for (var g = 0; g < groupOrder.length; g++) {
  var groupName = groupOrder[g];
  var names = groupMap[groupName];
  // Convert underscores to spaces for the comment
  var displayName = groupName.replace(/_/g, ' ');
  out.push('// ' + displayName + ' exports');
  out.push('export const {');
  for (var n = 0; n < names.length; n++) {
    var comma = (n < names.length - 1) ? ',' : '';
    out.push('  ' + names[n] + comma);
  }
  out.push('} = galactica;');
  out.push('');
}

// Blessed core exports — skip any already declared by custom groups
var filteredCore = coreExports.filter(function (n) { return !declaredNames[n]; });
if (filteredCore.length > 0) {
  out.push('// Blessed core exports');
  out.push('export const {');
  emitBlock(out, coreExports, declaredNames);
  out.push('} = galactica;');
  out.push('');
}

// Blessed widget classes (PascalCase) — skip any already declared
var filteredClasses = widgetClasses.filter(function (n) { return !declaredNames[n]; });
if (filteredClasses.length > 0) {
  out.push('// Blessed widget classes (PascalCase)');
  out.push('export const {');
  emitBlock(out, widgetClasses, declaredNames);
  out.push('} = galactica;');
  out.push('');
}

// Blessed widget factory functions (lowercase) — skip any already declared
// Custom exports like "line", "log", "table" shadow blessed factories
var filteredFactories = widgetFactories.filter(function (n) { return !declaredNames[n]; });
if (filteredFactories.length > 0) {
  out.push('// Blessed widget factory functions (lowercase)');
  out.push('export const {');
  emitBlock(out, widgetFactories, declaredNames);
  out.push('} = galactica;');
  out.push('');
}

// Blessed aliases — skip any already declared
var filteredAliases = aliasExports.filter(function (n) { return !declaredNames[n]; });
if (filteredAliases.length > 0) {
  out.push('// Blessed aliases');
  out.push('export const { ' + filteredAliases.join(', ') + ' } = galactica;');
  out.push('');
}

// Default export
out.push('// Default export');
out.push('export default galactica;');
out.push('');

var generated = out.join('\n');

// ── Step 5: Write only if changed ──────────────────────────────────────

var outputPath = path.join(ROOT, 'index.mjs');
var existing = '';
try {
  existing = fs.readFileSync(outputPath, 'utf8');
} catch (e) {
  // File doesn't exist yet — will be created
}

if (generated !== existing) {
  fs.writeFileSync(outputPath, generated, 'utf8');
  process.stdout.write('index.mjs regenerated\n');
} else {
  process.stdout.write('index.mjs is up to date\n');
}
