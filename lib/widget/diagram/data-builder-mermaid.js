'use strict';

/**
 * lib/widget/diagram/data-builder-mermaid.js
 *
 * Parses a subset of Mermaid syntax (Flowcharts, Graphs, State Diagrams)
 * into the structured data format expected by `buildModelFromData`.
 *
 * Supports:
 *   - Directional graphs: `graph TD`, `flowchart LR`
 *   - State diagrams: `stateDiagram-v2`
 *   - Inline node definitions: `A[Label]`, `B(Rounded)`, `C{{Hex}}`
 *   - Edge styles: `-->`, `---`, `-.->`, `==>`, `<-->`, `<==>`
 *   - Edge labels: `-->|label|`, `-- label -->`
 *   - State blocks: `state "Label" as Id { ... }`
 *   - Comments: `%% comment`
 *   - `[*]` start/end pseudo-nodes for state diagrams
 *
 * Zero external dependencies — all parsing is regex-based.
 */

var buildModelFromData = require('./data-builder').buildModelFromData;

/**
 * Parse a Mermaid node string (e.g. `A[Label]`, `B(Rounded)`, `First`)
 * into the nodes array, tracking it in nodeMap to prevent redefinition.
 *
 * Called both for standalone node lines and for source/target strings
 * extracted from edge lines (enabling inline node definitions in edges).
 *
 * @param {string}   str          - Raw node string from Mermaid text.
 * @param {Object}   nodeMap      - Lookup tracking defined nodes by ID.
 * @param {Array}    nodes        - Accumulator array for node descriptors.
 * @param {string}   format       - Current diagram format ('flowchart' or 'stateDiagram-v2').
 * @param {string}   [defaultBorder] - Fallback border style.
 * @returns {string} The resolved node ID.
 */
function parseNodeStr(str, nodeMap, nodes, format, defaultBorder) {
    str = str.trim();

    /* Try to match a shaped node: ID + optional shape bracket + label + close bracket.
     * Examples: A, A[Label], B(Rounded), C{{Hexagon}}, D[/Parallelogram\] */
    var m = str.match(
        /^([A-Za-z0-9_*-]+)(?:(\[|\(|\{\{|\[\/|\[\\|\(\[)("?[^\]\)\}]+"?)(\]|\)|\}\}|\\]|\/\]|\]\)))?$/
    );

    /* For state diagrams, also try: state "Label" as Id */
    if (!m && format === 'stateDiagram-v2') {
        var stateAliasMatch = str.match(
            /^state\s+"([^"]+)"\s+as\s+([A-Za-z0-9_*-]+)$/
        );
        if (stateAliasMatch) {
            m = [str, stateAliasMatch[2], '[', stateAliasMatch[1], ']'];
        }
    }

    if (m) {
        var id = m[1];
        var shapeOpen = m[2];
        var labelText = m[3];
        var borderStyle = null;

        /* Strip surrounding double-quotes from label if present */
        if (labelText && labelText.startsWith('"') && labelText.endsWith('"')) {
            labelText = labelText.substring(1, labelText.length - 1);
        }

        /* Map Mermaid shape brackets to CliUI border styles */
        if (shapeOpen === '(' || shapeOpen === '([') borderStyle = 'round';
        else if (shapeOpen === '{{') borderStyle = 'hex';
        else if (shapeOpen === '[/' || shapeOpen === '[\\') borderStyle = 'double';

        if (!nodeMap[id]) {
            var nDef = {
                id: id,
                text: labelText || id,
                borderStyle: borderStyle || defaultBorder
            };
            nodes.push(nDef);
            nodeMap[id] = nDef;
        } else {
            /* Update existing node with new label/border if provided */
            if (labelText) nodeMap[id].text = labelText;
            if (borderStyle) nodeMap[id].borderStyle = borderStyle;
        }
        return id;
    }

    /* If no shape matched, treat entire string as a plain node ID */
    if (!nodeMap[str]) {
        var plainDef = { id: str, text: str, borderStyle: defaultBorder };
        nodes.push(plainDef);
        nodeMap[str] = plainDef;
    }
    return str;
}

/**
 * Build a DiagramModel from a Mermaid string.
 *
 * Parses the Mermaid text line-by-line, extracts nodes and edges,
 * then delegates to `buildModelFromData` to produce the model.
 *
 * @param {string} text - The Mermaid text.
 * @param {string} [defaultBorder] - Fallback border style.
 * @returns {{ model: DiagramModel, idMap: Map, reverseMap: Map, format: string }}
 */
function buildMermaidFromData(text, defaultBorder) {
    var lines = text.split(/\r?\n/);
    var nodes = [];
    var connections = [];
    var nodeMap = {};
    var format = 'flowchart';

    /* State-block tracking for nested state definitions */
    var inStateBlock = false;

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].replace(/%%.*/, '').trim();
        if (!line) continue;

        /* ── Detect diagram type from header line ──────────────── */
        if (/^(graph|flowchart)\s+(TD|BT|RL|LR|TB)/i.test(line)) {
            format = 'flowchart';
            continue;
        }
        if (/^stateDiagram(-v2)?/i.test(line)) {
            format = 'stateDiagram-v2';
            continue;
        }

        /* ── State blocks: state "Label" as Id { ... } ────────── */
        if (/^state\s+([^\{]+)\{/.test(line)) {
            inStateBlock = true;
            var match = line.match(/^state\s+([^\{]+)\{/);
            if (match) {
                var stateDef = match[1].trim();
                var stateId = stateDef;
                var stateLabel = stateDef;
                var aliasMatch = stateDef.match(
                    /^(?:"(.*)"|([^ ]+))\s+as\s+(.+)$/
                );
                if (aliasMatch) {
                    stateLabel = aliasMatch[1] || aliasMatch[2];
                    stateId = aliasMatch[3];
                }
                if (!nodeMap[stateId]) {
                    var n = { id: stateId, text: stateLabel, borderStyle: 'line' };
                    nodes.push(n);
                    nodeMap[stateId] = n;
                }
            }
            continue;
        }

        if (inStateBlock && line === '}') {
            inStateBlock = false;
            continue;
        }

        /* ── Edge parsing ─────────────────────────────────────── */
        /* Two regex patterns handle the two Mermaid edge syntaxes:
         *   altEdgeRegex: `A -- label --> B`  (label between arrow halves)
         *   edgeRegex:    `A -->|label| B`    (label in pipe delimiters)
         * Alt is tried first because the standard regex would greedily
         * consume the `-- label` portion as part of the source node string. */
        var altEdgeRegex = /^(.*?)\s+(--|-\.|==)\s+([^-=]+)\s+(-{2,}>|-{3,}|-\.->|-\.-|={2,}>|={3,})\s*(.*)$/;
        var edgeRegex = /^(.*?)\s+(-{2,}>|-{3,}|-\.->|-\.-|={2,}>|={3,}|<-->|<==>)\s*(?:\|([^\|]+)\|\s*)?(.*)$/;

        var altMatch = line.match(altEdgeRegex);
        var edgeMatch = null;
        var sourceStr = null, targetStr = null, linkType = null, linkLabel = null;

        if (altMatch) {
            sourceStr = altMatch[1];
            linkType = altMatch[4];
            linkLabel = altMatch[3];
            targetStr = altMatch[5];
        } else {
            edgeMatch = line.match(edgeRegex);
            if (edgeMatch) {
                sourceStr = edgeMatch[1];
                linkType = edgeMatch[2];
                linkLabel = edgeMatch[3];
                targetStr = edgeMatch[4];
            }
        }

        if (sourceStr && targetStr) {
            var sourceId = parseNodeStr(sourceStr, nodeMap, nodes, format, defaultBorder);
            var targetId = parseNodeStr(targetStr, nodeMap, nodes, format, defaultBorder);

            var isDotted = linkType.indexOf('.') !== -1;
            var isThick = linkType.indexOf('=') !== -1;
            var isArrow = linkType.endsWith('>');
            var isBi = linkType.startsWith('<');

            var connDef = { from: sourceId, to: targetId };
            if (linkLabel) connDef.label = linkLabel.trim();
            if (isDotted) connDef.style = 'dashed';
            if (isThick) connDef.weight = 2;
            if (!isArrow) connDef.arrow = 'none';
            if (isBi) connDef.bidirectional = true;

            connections.push(connDef);
            continue;
        }

        /* If not an edge, treat as standalone node definition */
        parseNodeStr(line, nodeMap, nodes, format, defaultBorder);
    }

    var buildResult = buildModelFromData(
        { nodes: nodes, connections: connections },
        defaultBorder
    );

    /* Tag format so widget-api can route getSource() correctly */
    buildResult.format = format === 'stateDiagram-v2'
        ? 'mermaid:state'
        : 'mermaid:flowchart';

    return buildResult;
}

module.exports = {
    buildMermaidFromData: buildMermaidFromData
};
