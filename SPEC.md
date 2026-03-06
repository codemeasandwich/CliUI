# Specification: Diagram Widget with Box-Drawing Border Sets, Arrows, and Animation

## Goal

Add a `diagram` widget to Galactica that renders interactive flowcharts and node-connection diagrams in the terminal, supporting six box-drawing border styles (light, heavy, double, rounded, dashed, heavy-dashed), animated connection lines with travelling markers, and keyboard-navigable focused nodes. This gives Galactica a native diagramming primitive alongside its existing chart and data widgets.

## Current State

Galactica exposes widgets through `lib/widget/` and registers them in `index.js`. Existing widgets (line, bar, gauge, donut, table, tree, sparkline, log, map, lcd, picture, markdown, stacked-bar) all follow the same pattern:

- Extend `blessed.widget` (or `blessed.box`) via `blessed.widget.make()`
- Accept an `options` object with `style`, `label`, and widget-specific data fields
- Implement a `setData(data)` method for updates
- Call `this.screen.render()` after mutation
- Are placed on screen via `grid.set(row, col, rowSpan, colSpan, widgetType, options)`

The grid layout (`lib/layout/grid.js`) allocates rectangular cells. The carousel layout (`lib/layout/carousel.js`) pages between screens.

There is no diagram, flowchart, or node-graph widget. There is no animation loop infrastructure — all current widgets are static renders that update only on explicit `setData()` calls. There are no shared border-character constants; each widget that draws borders uses inline characters.

Key files:

- `index.js` — exports all widgets and layouts
- `lib/widget/` — directory containing all widget implementations (e.g., `lib/widget/bar.js`, `lib/widget/line.js`, `lib/widget/table.js`)
- `lib/layout/grid.js` — grid layout system
- `examples/dashboards/dashboard.js` — main demo

## Target State

After implementation, users create diagrams like this:
```js
const galactica = require('galactica')
const screen = galactica.screen()
const grid = new galactica.grid({rows: 1, cols: 1, screen: screen})

const diagram = grid.set(0, 0, 1, 1, galactica.diagram, {
  label: 'Pipeline',
  border: 'rounded',
  focusable: true,
  animate: true,
})

diagram.setData({
  nodes: [
    { id: 'start', label: 'Start', border: 'double' },
    { id: 'process', label: 'Process', border: 'rounded' },
    { id: 'end', label: 'End', border: 'heavy' },
  ],
  connections: [
    { from: 'start', to: 'process', style: 'animated', marker: '○', head: '►', speed: 150 },
    { from: 'process', to: 'end', style: 'dashed', weight: 'heavy', head: '▶' },
  ],
})

screen.render()
```

The diagram renders nodes as bordered boxes with connection lines between them. Animated connections display a marker character (e.g., `○`, `●`, `◆`) travelling along the line. Users press Tab to cycle focus between nodes, which triggers a border-pulse animation (light → heavy → double → light). Arrow keys navigate between connected nodes. Connection labels display centered above connection lines.

## Acceptance Criteria

- WHEN `galactica.diagram` is passed to `grid.set()`, THEN the grid creates and returns a diagram widget instance
- WHEN `diagram.setData({ nodes, connections })` is called with valid node and connection arrays, THEN the widget displays each node as a bordered box at auto-laid-out positions
- WHEN a node specifies `border: 'light'`, THEN the widget displays that node using characters `┌ ─ ┐ │ └ ┘`
- WHEN a node specifies `border: 'heavy'`, THEN the widget displays that node using characters `┏ ━ ┓ ┃ ┗ ┛`
- WHEN a node specifies `border: 'double'`, THEN the widget displays that node using characters `╔ ═ ╗ ║ ╚ ╝`
- WHEN a node specifies `border: 'rounded'`, THEN the widget displays that node using characters `╭ ─ ╮ │ ╰ ╯`
- WHEN a node specifies `border: 'dashed'`, THEN the widget displays that node using characters `┌ ╌ ┐ ╎ └ ┘`
- WHEN a node specifies `border: 'dashedHeavy'`, THEN the widget displays that node using characters `┏ ╍ ┓ ╏ ┗ ┛`
- WHEN no `border` is specified on a node, THEN the widget defaults to the widget-level `border` option, falling back to `'light'`
- WHEN a connection specifies `style: 'animated'` and `animate: true` is set on the widget, THEN the widget displays a marker character travelling along the connection line at the specified `speed` interval in milliseconds
- WHEN a connection specifies `style: 'dashed'`, THEN the widget displays the connection using dashed line characters `╌` (light) or `╍` (heavy, when `weight: 'heavy'` is set)
- WHEN a connection specifies `style: 'snake'`, THEN the widget displays the connection using a scrolling pattern of `━┉┅╍╸` that shifts left each animation frame
- WHEN a connection specifies a `head` character (e.g., `►`, `▶`), THEN the widget displays that character at the terminal end of the connection line
- WHEN a connection specifies a `label` string, THEN the widget displays that label text centered above the midpoint of the connection line
- WHEN `focusable: true` is set and the user presses Tab, THEN focus cycles through nodes in declaration order and the focused node displays a border-pulse animation cycling through light → heavy → double → light characters at 200ms intervals
- WHEN a node is focused and the user presses Enter or Space, THEN the widget emits an `action` event with the node's `id` as payload
- WHEN a node is focused and the user presses an arrow key, THEN focus moves to the nearest connected node in that direction (by angle from current node position)
- WHEN `diagram.setData()` is called while animations are running, THEN existing `setInterval` timers are cleared before new animations are created
- WHEN the widget is destroyed or detached from the screen, THEN all `setInterval` timers for animations are cleared to prevent memory leaks
- WHEN the terminal is resized, THEN the diagram recomputes node positions and redraws connections to fit the new dimensions

## In Scope

- New `diagram` widget in `lib/widget/diagram.js`
- Shared `borderSets` constant module in `lib/utils/border-sets.js` defining all seven border character sets (light, heavy, double, rounded, dashed, dashedHeavy, ascii) with keyed properties `tl`, `tr`, `bl`, `br`, `h`, `v`, `cross`, and `tee: { l, r, t, b }`
- Animation engine within the diagram widget supporting four effects: marker-travel, snake-scroll, dash-blink, and focus-pulse
- Auto-layout algorithm for positioning nodes using a simple grid-based or force-directed approach
- Keyboard navigation: Tab for focus cycling, Enter/Space for action emission, arrow keys for directional movement between connected nodes
- Connection rendering with horizontal, vertical, and L-shaped (Manhattan) paths between nodes
- `galactica.diagram` export registration in `index.js`
- Example file `examples/diagrams/diagram.js` demonstrating the widget
- Drag-and-drop or mouse-based node repositioning
- Refactoring existing widgets to consume the shared `borderSets` module

## Out of Scope
- Exporting diagrams to image or SVG formats — rendering is terminal-only
- ANSI colour for status-coloured borders — colour is handled by blessed's existing `style` system and requires no new code here

## v2 - Add commet TODO: / placeholders 

- Curved or bezier connection paths — v1 connections use straight horizontal, vertical, and right-angle segments only
- Bi-directional animated arrows — v1 connections flow one direction only (from → to)
- Multiple simultaneous markers on a single connection for throughput visualization
- Carousel integration for paging between diagrams — the widget works within any existing layout

## Affected Files

- `lib/widget/diagram.js` — create: diagram widget implementing node layout, connection rendering with Manhattan routing, four animation effects (marker-travel, snake-scroll, dash-blink, focus-pulse), keyboard navigation (Tab/Enter/Space/arrows), `setData()` API, and `setInterval` lifecycle management
- `lib/utils/border-sets.js` — create: shared `borderSets` object exporting `{ light, heavy, double, rounded, dashed, dashedHeavy, ascii }` with each set containing `{ tl, tr, bl, br, h, v, cross, tee: { l, r, t, b } }`
- `index.js` — modify: add `exports.diagram = require('./lib/widget/diagram')` to the existing widget exports block
- `examples/diagrams/diagram.js` — create: example script demonstrating diagram creation with mixed border styles, animated and static connections, connection labels, and keyboard navigation
- `README.md` — modify: add `Diagram` to the widget list in the Documentation section alongside existing entries (Line Chart, Bar Chart, etc.)

## Assumptions

- The blessed dependency's `screen.render()` can be called from within `setInterval` callbacks to repaint animated frames without causing render conflicts or flickering
- Nodes are small enough (label text width + 2 padding + 2 border characters = typically 10–30 columns) that 3–8 nodes fit comfortably within a grid cell on a standard 80×24 terminal
- The existing `blessed.widget.make()` pattern used by other Galactica widgets (e.g., `lib/widget/bar.js`) supports custom `render()` overrides that write arbitrary characters to the widget's allocated screen buffer region
- Connection routing between nodes uses Manhattan-distance (horizontal-then-vertical) paths; a full graph routing algorithm with crossing minimization is not required
- The `screen.key()` API from blessed supports capturing Tab, Enter, Space, and arrow key events for widgets that declare `focusable: true`
- The `lib/utils/` directory exists or can be created for shared utility modules

## Blast Radius

| Category | Impact |
|----------|--------|
| `index.js` | One new `exports.diagram` line; no changes to existing exports |
| `lib/widget/` | New file only; no modifications to existing widget files |
| `lib/utils/` | New directory and file; no existing utils are affected |
| `examples/` | New example file; `dashboard.js` is not modified |
| `README.md` | One line added to the widget documentation list |
| Existing layouts | Grid and Carousel are not modified; diagram is a standard widget consumed by `grid.set()` |
| Dependencies | No new npm dependencies; uses only blessed APIs already available in the project |

## Sub-Requirements

- SR-1: `borderSets` module exports seven complete character sets with all 11 properties (`tl`, `tr`, `bl`, `br`, `h`, `v`, `cross`, `tee.l`, `tee.r`, `tee.t`, `tee.b`)
- SR-2: Diagram widget registers with blessed and is instantiable via `grid.set()` using the same pattern as existing widgets
- SR-3: Node auto-layout positions nodes without overlapping, with minimum 3-character gaps for connection lines
- SR-4: Manhattan connection routing draws horizontal and vertical segments with correct corner characters from the active border set
- SR-5: Animation timer lifecycle is fully managed — timers start on `setData()`, clear on re-`setData()`, and clear on widget `destroy`/`detach` events
- SR-6: Focus-pulse animation cycles the focused node's border through three visual states (light → heavy → double) at 200ms intervals
- SR-7: Keyboard navigation emits `action` events with node `id` payloads and moves focus directionally between connected nodes

## Wireframe

### Basic Diagram Layout
```
╭──────────────────────────────────────────────────────────────╮
│  Pipeline                                                    │
│                                                              │
│   ╔═════════╗         ╭───────────╮         ┏━━━━━━━━━┓     │
│   ║  Start  ║───○────►│  Process  │╍╍╍╍╍╍╍╍►┃   End   ┃     │
│   ╚═════════╝         ╰───────────╯         ┗━━━━━━━━━┛     │
│                                                              │
╰──────────────────────────────────────────────────────────────╯
```

### Connection Label with Branching
```
╭────────╮     yes      ╭────────╮
│ Check  │──────►───────│  Pass  │
╰────────╯              ╰────────╯
     │
     │ no
     ▼
╭────────╮
│  Fail  │
╰────────╯
```


### Focus Animation Frames (200ms cycle per frame)
```
Frame 1: ┌──────┐    Frame 2: ╔══════╗    Frame 3: ┏━━━━━━┓
         │ Node │             ║ Node ║             ┃ Node ┃
         └──────┘             ╚══════╝             ┗━━━━━━┛
```

### Animated Marker Travel (one frame per `speed` ms)
```
Frame 1: ║○─────►║
Frame 2: ║─○────►║
Frame 3: ║──○───►║
Frame 4: ║───○──►║
Frame 5: ║────○─►║
         (marker resets to position 0 after reaching end)
```

### Snake Scroll Animation (pattern shifts left each frame)
```
Frame 1: ━┉┅╍━╸┉┅╍╸►
Frame 2: ━╸┉┅╍━╸┉┅╍►
Frame 3: ╍━╸┉┅╍━╸┉┅►
```

### borderSets Character Reference
```
light:       tl:┌  tr:┐  bl:└  br:┘  h:─  v:│  cross:┼  tee: ├ ┤ ┬ ┴
heavy:       tl:┏  tr:┓  bl:┗  br:┛  h:━  v:┃  cross:╋  tee: ┣ ┫ ┳ ┻
double:      tl:╔  tr:╗  bl:╚  br:╝  h:═  v:║  cross:╬  tee: ╠ ╣ ╦ ╩
rounded:     tl:╭  tr:╮  bl:╰  br:╯  h:─  v:│  cross:┼  tee: ├ ┤ ┬ ┴
dashed:      tl:┌  tr:┐  bl:└  br:┘  h:╌  v:╎  cross:┼  tee: ├ ┤ ┬ ┴
dashedHeavy: tl:┏  tr:┓  bl:┗  br:┛  h:╍  v:╏  cross:╋  tee: ┣ ┫ ┳ ┻
ascii:       tl:+  tr:+  bl:+  br:+  h:-  v:|  cross:+  tee: + + + +
```

Target State
------------

After implementation, developers can import Diagram, Box, Arrow, and Line from cliUI/diagram and declaratively compose interactive terminal diagrams. The system renders using Unicode box-drawing characters across seven border style presets (light, heavy, double, rounded, dashed, dashedH, ascii), animates connection lines with configurable marker/snake/pulse/dash-blink effects, and supports full keyboard navigation (Tab to cycle focus, Enter/Space to trigger handlers, Arrow keys to traverse connected nodes). Boxes display status-colored ANSI borders and focus-glow animations when selected.

Acceptance Criteria
-------------------

*   WHEN a developer creates a Box({ label: 'Node', border: 'heavy' }), THEN the renderer displays a box using heavy border characters (┏, ━, ┓, ┃, ┗, ┛)
    
*   WHEN a developer creates a Box({ label: 'Node', border: 'double' }), THEN the renderer displays a box using double border characters (╔, ═, ╗, ║, ╚, ╝)
    
*   WHEN a developer creates a Box({ label: 'Node', border: 'rounded' }), THEN the renderer displays a box using rounded corner characters (╭, ╮, ╰, ╯) with light horizontal/vertical lines
    
*   WHEN a developer creates a Box({ label: 'Node', border: 'ascii' }), THEN the renderer displays a box using ASCII-safe characters (+, -, |)
    
*   WHEN a developer creates a Box({ label: 'Node', border: 'dashed' }), THEN the renderer displays a box using light dashed characters (╌ horizontal, ╎ vertical)
    
*   WHEN a developer passes an unknown border value, THEN Box() throws a BorderStyleError with message "Unknown border style: {value}. Expected one of: light, heavy, double, rounded, dashed, dashedH, ascii"
    
*   WHEN borderSets returns a character set, THEN it returns an object with keys tl, tr, bl, br, h, v, cross, and tee (containing l, r, t, b)
    
*   WHEN a developer creates Arrow(source, target, { style: 'animated', marker: '○', head: '►', speed: 150 }), THEN the renderer displays a connection line where the ○ marker travels from source to target at 150ms per frame, terminating with ►
    
*   WHEN a developer creates Arrow(source, target, { style: 'snaked' }), THEN the renderer displays a connection using the scrolling pattern ━┉┅╍╸
    
*   WHEN a developer creates Line(source, target, { style: 'dashed', weight: 'heavy' }), THEN the renderer displays a static dashed connection using heavy dashed characters (╍)
    
*   WHEN a developer sets Box({ focusable: true }) and the user presses Tab, THEN focus cycles to the next focusable box and the focused box displays a glow animation cycling through border weights (light → heavy → double → light)
    
*   WHEN a focused box has an onClick handler and the user presses Enter or Space, THEN the handler executes
    
*   WHEN a focused box is connected to other boxes and the user presses an Arrow key, THEN focus moves to the connected node in the corresponding direction
    
*   WHEN a developer sets Box({ status: 'success' }), THEN the box border renders with ANSI green coloring
    
*   WHEN a developer sets Box({ status: 'error' }), THEN the box border renders with ANSI red coloring
    
*   WHEN a developer sets Box({ status: 'pending' }), THEN the box border renders with ANSI yellow coloring and a pulse animation
    
*   WHEN Arrow() receives a source or target that is not a valid Box instance, THEN it throws a ConnectionError with message "Arrow source and target must be Box instances"
    
*   WHEN Diagram({ animate: false }) is set, THEN all animation effects are disabled and connections render as static lines
    
*   WHEN a developer creates an Arrow with { label: 'yes' }, THEN the label text displays inline on the connection line between source and target
    

In Scope
--------

*   borderSets configuration object with all seven preset border styles
    
*   Box component with label, border style, focusable, onClick, onFocus, and status props
    
*   Arrow component with animated marker, snaked, and static styles plus arrow heads and labels
    
*   Line component with dashed and weighted static connection styles
    
*   Diagram container component with global border, focusable, and animate settings
    
*   Animation engine supporting marker travel, pulse, snake scroll, and dash-blink effects
    
*   Keyboard navigation: Tab focus cycling, Enter/Space activation, Arrow key traversal
    
*   Focus-glow animation on active box (border weight cycling)
    
*   Status-colored borders via ANSI escape codes (green/red/yellow)
    
*   Braille spinner integration for loading states on connections (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏)
    
*   Bi-directional arrow support (◄───○───► with bouncing marker)