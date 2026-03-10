'use strict';

/**
 * lib/widget/diagram/diagram-mermaid-renderer.js
 *
 * Serializes a live `DiagramModel` back into Mermaid syntax.
 *
 * This module enables two-way binding: parse Mermaid → edit in UI →
 * serialize back to Mermaid. It requires the `reverseMap` (numeric
 * box ID → original Mermaid string ID) produced by `buildModelFromData`
 * so that output uses the original user-defined identifiers rather
 * than internal numeric IDs.
 *
 * Supports both `flowchart` and `stateDiagram-v2` output formats.
 */

/**
 * Sanitize a Mermaid ID string, removing characters that would
 * break Mermaid syntax. `[*]` is a special case preserved for
 * state diagram start/end pseudo-nodes.
 *
 * @param {string} id - The original Mermaid identifier.
 * @returns {string} A safe Mermaid identifier.
 */
function toMermaidId(id) {
    if (id === '[*]') return id;
    if (/^[A-Za-z0-9_-]+$/.test(id)) return id;
    return id.replace(/[^A-Za-z0-9_-]/g, '_');
}

/**
 * Serialize a DiagramModel into Mermaid syntax.
 *
 * @param {import('./diagram-model').DiagramModel} model      - The live model.
 * @param {string}      format      - 'mermaid:flowchart' or 'mermaid:state'.
 * @param {Map<number,string>} reverseMap - Numeric box ID → original Mermaid string ID.
 * @returns {string} Valid Mermaid text.
 */
function renderMermaid(model, format, reverseMap) {
    var isState = format === 'mermaid:state';
    var lines = [];

    /* Header line: determines diagram type */
    if (isState) {
        lines.push('stateDiagram-v2');
    } else {
        lines.push('flowchart TD');
    }

    /* ── Emit node/state definitions ─────────────────────────────── */
    model.boxes.forEach(function (box) {
        /* Recover the original Mermaid string ID from reverseMap.
         * Fall back to the numeric ID only if the map is missing. */
        var mermaidId = (reverseMap && reverseMap.get(box.id)) || box.id.toString();
        var id = toMermaidId(mermaidId);
        var txt = box.text || mermaidId;

        /* Map CliUI border styles back to Mermaid shape brackets */
        var open = '[', close = ']';
        if (box.borderStyle === 'round') { open = '('; close = ')'; }
        else if (box.borderStyle === 'hex') { open = '{{'; close = '}}'; }
        else if (box.borderStyle === 'double') { open = '[/'; close = '\\]'; }

        /* Quote labels containing structural characters */
        if (/[\(\)\[\]\{\}\/]/.test(txt)) {
            txt = '"' + txt + '"';
        }

        if (isState) {
            /* [*] pseudo-nodes are only referenced in edges, never defined */
            if (id === '[*]') return;

            if (id !== txt) {
                lines.push('  state "' + txt + '" as ' + id);
            }
            /* If id === txt, state is implicitly defined by edge references */
        } else {
            if (id === txt && open === '[' && close === ']') {
                lines.push('  ' + id);
            } else {
                lines.push('  ' + id + open + txt + close);
            }
        }
    });

    /* ── Emit edge definitions ───────────────────────────────────── */
    model.connectors.forEach(function (conn) {
        /* Connectors reference ports by sourcePortId/destPortId.
         * Look up the port to find which box it belongs to. */
        var srcPort = model.ports.get(conn.sourcePortId);
        var dstPort = model.ports.get(conn.destPortId);
        if (!srcPort || !dstPort) return;

        /* Recover original Mermaid IDs for source and target */
        var srcMermaidId = (reverseMap && reverseMap.get(srcPort.boxId)) || srcPort.boxId.toString();
        var dstMermaidId = (reverseMap && reverseMap.get(dstPort.boxId)) || dstPort.boxId.toString();
        var srcId = toMermaidId(srcMermaidId);
        var dstId = toMermaidId(dstMermaidId);

        /* Determine link type from connector properties */
        var linkType = '-->';
        if (conn.style === 'dashed') linkType = '-.->';
        else if (conn.weight > 1) linkType = '==>';

        /* Remove arrowhead if arrow is 'none' */
        if (conn.arrow === 'none') {
            if (linkType === '-->') linkType = '---';
            else if (linkType === '-.->') linkType = '-.-';
            else if (linkType === '==>') linkType = '===';
        }

        /* Add reverse arrowhead for bidirectional */
        if (conn.bidirectional) {
            if (linkType === '-->') linkType = '<-->';
            else if (linkType === '==>') linkType = '<==>';
        }

        /* Build the edge string with optional pipe-delimited label */
        var edgeStr = '  ' + srcId + ' ' + linkType;
        if (conn.lineLabel) {
            edgeStr += '|' + conn.lineLabel + '|';
        }
        edgeStr += ' ' + dstId;

        lines.push(edgeStr);
    });

    return lines.join('\n');
}

module.exports = {
    renderMermaid: renderMermaid
};
