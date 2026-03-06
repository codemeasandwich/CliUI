# Galactica Cookbook

Detailed widget documentation and examples for Galactica.

## Widgets

- [Line Chart](#line-chart)
- [Scatter Plot](#scatter-plot)
- [Bar Chart](#bar-chart)
- [Stacked Bar Chart](#stacked-bar-chart)
- [Map](#map)
- [Gauge](#gauge)
- [Stacked Gauge](#stacked-gauge)
- [Donut](#donut)
- [LCD Display](#lcd-display)
- [Rolling Log](#rolling-log)
- [Picture](#picture)
- [Sparkline](#sparkline)
- [Table](#table)
- [Tree](#tree)
- [Markdown](#markdown)
- [Diagram](#diagram)

## Layouts

- [Grid](#grid)
- [Computed Grid](#computed-grid)
- [Carousel](#carousel)

---

## Line Chart

<img src="./docs/images/line.gif" alt="line" width="400">

`````javascript
   var line = galactica.line(
         { style:
           { line: "yellow"
           , text: "green"
           , baseline: "black"}
         , xLabelPadding: 3
         , xPadding: 5
         , yPadding: 11 //bottom padding for x-axis labels (default: 11)
         , showLegend: true
         , wholeNumbersOnly: false //true=do not show fraction in y axis
         , label: 'Title'})
   var series1 = {
         title: 'apples',
         x: ['t1', 't2', 't3', 't4'],
         y: [5, 1, 7, 5]
      }
   var series2 = {
         title: 'oranges',
         x: ['t1', 't2', 't3', 't4'],
         y: [2, 1, 4, 8]
      }
   screen.append(line) //must append before setting data
   line.setData([series1, series2])
`````
**Examples:** [simple line chart](./examples/charts/line-fraction.js), [multiple lines](./examples/charts/multi-line-chart.js), [256 colors](./examples/charts/line-random-colors.js), [custom yPadding](./examples/charts/line-ypadding.js)

---

## Scatter Plot

`````javascript
   var scatter = galactica.scatter(
         { style:
           { point: "yellow"
           , text: "green"
           , baseline: "black"}
         , xPadding: 10
         , yPadding: 11
         , numYLabels: 5
         , numXLabels: 5
         , showLegend: true
         , marker: 'o' // 'o', '+', 'x', '*', '.'
         , label: 'Title'})
   var series1 = {
         title: 'apples',
         x: [1, 2, 3, 4, 5],
         y: [5, 1, 7, 5, 3],
         style: { point: 'red', marker: 'o' }
      }
   var series2 = {
         title: 'oranges',
         x: [1.5, 2.5, 3.5, 4.5],
         y: [2, 4, 9, 8],
         style: { point: 'yellow', marker: '+' }
      }
   screen.append(scatter) //must append before setting data
   scatter.setData([series1, series2])
`````

Unlike line charts which use categorical X labels, scatter plots use numeric X values and support multiple marker styles.

**Examples:** [scatter plot](./examples/scatter/scatter.js), [multi-series](./examples/scatter/scatter-multi.js)

---

## Bar Chart

<img src="./docs/images/bar.gif" alt="bar" width="250">

`````javascript
    var bar = galactica.bar(
       { label: 'Server Utilization (%)'
       , barWidth: 4
       , barSpacing: 6
       , xOffset: 0
       , maxHeight: 9})
    screen.append(bar) //must append before setting data
    bar.setData(
       { titles: ['bar1', 'bar2']
       , data: [5, 10]})
`````

---

## Stacked Bar Chart

<img src="./docs/images/stacked-bar.png" alt="stacked-bar" width="250">

`````javascript
    bar = galactica.stackedBar(
       { label: 'Server Utilization (%)'
       , barWidth: 4
       , barSpacing: 6
       , xOffset: 0
       //, maxValue: 15
       , height: "40%"
       , width: "50%"
       , barBgColor: [ 'red', 'blue', 'green' ]})
    screen.append(bar)
    bar.setData(
       { barCategory: ['Q1', 'Q2', 'Q3', 'Q4']
       , stackedCategory: ['US', 'EU', 'AP']
       , data:
          [ [ 7, 7, 5]
          , [8, 2, 0]
          , [0, 0, 0]
          , [2, 3, 2] ]
       })
`````

---

## Map

<img src="./docs/images/map.gif" alt="map" width="500">

`````javascript
   var map = galactica.map({label: 'World Map'})
   map.addMarker({"lon" : "-79.0000", "lat" : "37.5000", color: "red", char: "X" })
`````

---

## Gauge

<img src="./docs/images/gauge.gif" alt="gauge" width="170">

`````javascript
   var gauge = galactica.gauge({label: 'Progress', stroke: 'green', fill: 'white'})
   gauge.setPercent(25)
`````

---

## Stacked Gauge

<img src="./docs/images/stackgauge.gif" alt="stackedgauge">

Either specify each stacked portion with a `percent` and `stroke`...

`````javascript
   var gauge = galactica.gauge({label: 'Stacked '})
   gauge.setStack([{percent: 30, stroke: 'green'}, {percent: 30, stroke: 'magenta'}, {percent: 40, stroke: 'cyan'}])
`````

Or, you can just supply an array of numbers and random colors will be chosen.

`````javascript
   var gauge = galactica.gauge({label: 'Stacked Progress'})
   gauge.setStack([30,30,40])
`````

---

## Donut

<img src="./docs/images/donut.gif" alt="donut">


`````javascript
   var donut = galactica.donut({
	label: 'Test',
	radius: 8,
	arcWidth: 3,
	remainColor: 'black',
	yPadding: 2,
	data: [
	  {percent: 80, label: 'web1', color: 'green'}
	]
  });
`````

Data passed in uses `percent` and `label` to draw the donut graph. Color is optional and defaults to green.

`````javascript
   donut.setData([
   	{percent: 87, label: 'rcp','color': 'green'},
	{percent: 43, label: 'rcp','color': 'cyan'},
   ]);
`````

Updating the donut is as easy as passing in an array to `setData` using the same array format as in the constructor. Pass in as many objects to the array of data as you want, they will automatically resize and try to fit. However, please note that you will still be restricted to actual screen space.

You can also hardcode a specific numeric into the donut's core display instead of the percentage by passing an `percentAltNumber` property to the data, such as:

`````javascript
   var donut = galactica.donut({
	label: 'Test',
	radius: 8,
	arcWidth: 3,
	remainColor: 'black',
	yPadding: 2,
	data: [
	  {percentAltNumber: 50, percent: 80, label: 'web1', color: 'green'}
	]
  });
`````

See an example of this in one of the donuts settings on `./examples/charts/donut.js`.

---

## LCD Display

<img src="./docs/images/lcd.gif" alt="lcd">

`````javascript
   var lcd = galactica.lcd(
     { segmentWidth: 0.06 // how wide are the segments in % so 50% = 0.5
     , segmentInterval: 0.11 // spacing between the segments in % so 50% = 0.550% = 0.5
     , strokeWidth: 0.11 // spacing between the segments in % so 50% = 0.5
     , elements: 4 // how many elements in the display. or how many characters can be displayed.
     , display: 321 // what should be displayed before first call to setDisplay
     , elementSpacing: 4 // spacing between each element
     , elementPadding: 2 // how far away from the edges to put the elements
     , color: 'white' // color for the segments
     , label: 'Storage Remaining'})
`````

`````javascript

	lcd.setDisplay(23 + 'G'); // will display "23G"
	lcd.setOptions({}) // adjust options at runtime

`````

Please see the **examples/gauges/lcd.js** for an example. The example provides keybindings to adjust the `segmentWidth` and `segmentInterval` and `strokeWidth` in real-time so that you can see how they manipulate the look and feel.

---

## Rolling Log

<img src="./docs/images/log.gif" alt="log" width="180">

`````javascript
   var log = galactica.log(
      { fg: "green"
      , selectedFg: "green"
      , label: 'Server Log'})
   log.log("new log line")
`````

---

## Picture

(Also check the built-in image widget which has several benefits over this one.)

<img src="./docs/images/picture.png" alt="log" width="180">

`````javascript
    var pic = galactica.picture(
       { file: './flower.png'
       , cols: 25
       , onReady: ready})
    function ready() {screen.render()}
`````

note: only png images are supported

---

## Sparkline

<img src="./docs/images/spark.gif" alt="spark" width="180">

`````javascript
   var spark = galactica.sparkline(
     { label: 'Throughput (bits/sec)'
     , tags: true
     , style: { fg: 'blue' }})

   sparkline.setData(
   [ 'Sparkline1', 'Sparkline2'],
   [ [10, 20, 30, 20]
   , [40, 10, 40, 50]])
`````

---

## Table

<img src="./docs/images/table.gif" alt="table" width="250">

`````javascript
   var table = galactica.table(
     { keys: true
     , fg: 'white'
     , selectedFg: 'white'
     , selectedBg: 'blue'
     , interactive: true
     , label: 'Active Processes'
     , width: '30%'
     , height: '30%'
     , border: {type: "line", fg: "cyan"}
     , columnSpacing: 10 //in chars
     , columnWidth: [16, 12, 12] /*in chars, or use percentages: ['30%', '40%', '30%']*/ })

   //allow control the table with the keyboard
   table.focus()

   table.setData(
   { headers: ['col1', 'col2', 'col3']
   , data:
      [ [1, 2, 3]
      , [4, 5, 6] ]})
`````

**Examples:** [basic table](./examples/tables/table.js), [percentage column widths](./examples/tables/table-percentage-width.js)

---

## Tree

<img src="./docs/images/tree.gif" alt="table" width="250">

`````javascript
   var tree = galactica.tree({fg: 'green'})

   //allow control the table with the keyboard
   tree.focus()

   tree.on('select',function(node){
     if (node.myCustomProperty){
       console.log(node.myCustomProperty);
     }
     console.log(node.name);
   }

   // you can specify a name property at root level to display root
   tree.setData(
   { extended: true
   , children:
     {
       'Fruit':
       { children:
         { 'Banana': {}
         , 'Apple': {}
         , 'Cherry': {}
         , 'Exotics': {
             children:
             { 'Mango': {}
             , 'Papaya': {}
             , 'Kiwi': { name: 'Kiwi (not the bird!)', myCustomProperty: "hairy fruit" }
             }}
         , 'Pear': {}}}
     , 'Vegetables':
       { children:
         { 'Peas': {}
         , 'Lettuce': {}
         , 'Pepper': {}}}}})
`````

### Options

 * keys : Key to expand nodes. Default : ['enter','default']
 * extended : Should nodes be extended/generated by default? Be careful with this setting when using a callback function. Default : false
 * template :
   * extend : Suffix "icon" for closed node. Default : '[+]'
   * retract : Suffix "icon" for opened node. Default : '[-]'
   * lines : Show lines in tree. Default : true

### Nodes

Every node is a hash and it can have custom properties that can be used in "select" event callback. However, there are several special keys :

* name
  * *Type* : `string`
  * *Desc* : Node name
  * If the node isn't the root and you don't specify the name, will be set to hash key
  * *Example* : <code>{ name: 'Fruit'}</code>
* children
  * *Type* : `hash` or `function(node){ return children }`
  * *Desc* : Node children.
  * The function must return a hash that could have been used as children property
  * If you use a function, the result will be stored in `node.childrenContent` and `children`
  * *Example* :
    * Hash : <code>{'Fruit':{ name: 'Fruit', children:{ 'Banana': {}, 'Cherry': {}}}}</code>
    * Function : see `examples/tables/explorer.js`
* childrenContent
  * *Type* : `hash`
  * *Desc* : Children content for internal usage *DO NOT MODIFY*
  * If `node.children` is a hash, `node.children===node.childrenContent`
  * If `node.children` is a function, it's used to store the `node.children()` result
  * You can read this property, but you should never write it.
  * Usually this will be used to check `if(node.childrenContent)` in your `node.children` function to generate children only once
* extended
  * *Type* : `boolean`
  * *Desc* : Determine if this node is extended
  * No effect when the node have no child
  * Default value for each node will be `treeInstance.options.extended` if the node `extended` option is not set
  * *Example* : <code>{'Fruit':{ name: 'Fruit', extended: true, children:{ 'Banana': {}, 'Cherry': {}}}}</code>

---

## Markdown

<img src="./docs/images/markdown.png" alt="table">

`````javascript
   var markdown = galactica.markdown()
   markdown.setMarkdown('# Hello \n Galactica renders markdown using `marked-terminal`')
`````

---

## Diagram

ASCII diagram editor — define boxes, connectors, and labels using plain-text or programmatic APIs. Supports interactive mouse-driven editing (click, double-click, drag), orthogonal A* connector routing, Sugiyama-style auto-layout, checked (✔) and current-work (╭╍╍╯) box states, and smooth dot-pair animation.

`````
┌──────────┐       ┌──────────┐       ┌──────────┐
│  Auth    │       │  API     │       │ ✔ Web    │
│  Service │──────▶│  Gateway │──────▶│  Client  │
└──────────┘       └──────────┘       └──────────┘
                        │
                        ▼
                   ╭╍╍╍╍╍╍╍╍╍╍╮
                   ┇ Database ┇
                   ╰╍╍╍╍╍╍╍╍╍╍╯
`````

### Quick Start

Create a diagram widget from an ASCII source string:

`````javascript
const galactica = require('galactica')
const screen = galactica.screen()

const diag = galactica.diagram({
  parent: screen,
  label: ' Diagram ',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  border: { type: 'line' },
  interactive: true,
  animate: true,
  source: [
    '┌──────────┐       ┌──────────┐',
    '│  Build   │──────▶│  Deploy  │',
    '└──────────┘       └──────────┘'
  ].join('\n')
})

diag.on('box:click', function (ev) {
  console.log('Clicked box', ev.boxId)
})

screen.key(['q', 'escape'], function () { process.exit(0) })
screen.render()
`````

### `setData` Format

The standard CliUI data setter accepts two shapes:

`````javascript
// Shape 1 — raw ASCII string
diag.setData('┌───┐\n│ A │\n└───┘')

// Shape 2 — object with source property
diag.setData({ source: '┌───┐\n│ A │\n└───┘' })
`````

Both are forwarded to `setSource()` internally.

### Programmatic Model Building

Instead of parsing ASCII text you can build the model directly:

`````javascript
const galactica = require('galactica')
const DiagramModel = galactica.DiagramModel

const model = new DiagramModel(80, 24)

const boxA = model.addBox(1, 1, 12, 3, 'Commit')
const boxB = model.addBox(20, 1, 12, 3, 'Build')

// Create ports on the right side of boxA and left side of boxB
const portOut = model.addPort(boxA.id, 'right', 0)
const portIn  = model.addPort(boxB.id, 'left', 0)

// Connect them
model.addConnector(portOut.id, portIn.id, 'right')

// Apply to a widget
diag.setModel(model)
diag.route()
`````

### Headless Parse / Render (No Widget)

Parse and render diagrams without creating a blessed screen:

`````javascript
const galactica = require('galactica')

// Parse ASCII → model
const model = galactica.parseDiagram('┌───┐\n│ A │──▶┌───┐\n└───┘   │ B │\n        └───┘')

console.log(model.boxes.size)      // 2
console.log(model.connectors.size) // 1

// Render model → ASCII
const text = galactica.renderDiagram(model)
console.log(text)
`````

### Options

All standard blessed `Box` options (e.g. `top`, `left`, `width`, `height`, `border`, `style`, `label`) are supported, plus:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `source` | `string` | — | Initial ASCII diagram text. Parsed on construction. |
| `interactive` | `boolean` | `true` | Enable mouse click, double-click, and drag interactions. |
| `animate` | `boolean` | `true` | Enable ● dot-pair animation on current-work boxes. |
| `data` | `string \| { source }` | — | Alternative data input (CliUI convention). Forwarded to `setSource()`. |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `box:click` | `{ boxId, hit }` | Single click on a box interior or border. |
| `box:dblclick` | `{ boxId, hit }` | Double-click on a box. Toggles ✔ checked state by default. |
| `connector:click` | `{ connectorId, hit }` | Click on a connector segment, junction, or arrowhead. |
| `label:click` | `{ labelId, hit }` | Click on a label. |
| `gate:click` | `{ boxId, portId, hit }` | Click on a gate (╢) or port position. |
| `drag:start` | `{ boxId, x, y }` | Drag begins on a box. |
| `drag:move` | `{ boxId, dx, dy }` | Box position updated by `(dx, dy)` delta. |
| `drag:end` | `{ boxId }` | Drag released. |
| `model:change` | *(none)* | Emitted after any model mutation (toggle, drag, layout, etc.). |

### Public Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setSource` | `(text: string): void` | Parse ASCII text, rebuild model, route connectors, render. |
| `getSource` | `(): string` | Render current model back to canonical ASCII text. |
| `setModel` | `(model: DiagramModel): void` | Replace the live model, re-route and re-render. |
| `getModel` | `(): DiagramModel \| null` | Return the live mutable model. |
| `parse` | `(text: string): DiagramModel` | Parse text without applying (for preview / validation). |
| `load` | `(text: string): void` | Alias for `setSource()`. |
| `serialize` | `(): string` | Alias for `getSource()`. |
| `setData` | `(data): void` | Standard CliUI data setter — accepts string or `{ source }`. |
| `toggleChecked` | `(boxId: number): void` | Toggle ✔ checked state on a box. |
| `startCurrentWork` | `(boxId: number): void` | Mark a box as current-work (dashed border + ● animation). |
| `stopCurrentWork` | `(boxId: number): void` | Remove current-work state from a box. |
| `layout` | `(options?): void` | Auto-arrange all boxes using the Sugiyama-style layout engine. |
| `route` | `(): void` | Recompute all connector paths via A* pathfinding. |

### Layout Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `gapX` | `number` | `6` | Horizontal gap between layers. |
| `gapY` | `number` | `2` | Vertical gap between nodes within a layer. |
| `startX` | `number` | `1` | Left margin. |
| `startY` | `number` | `1` | Top margin. |
| `margin` | `number` | `2` | Padding around the entire diagram. |

### Box States

Boxes can be in one of three visual states:

| State | Border Style | Description |
|-------|-------------|-------------|
| Standard | `┌─┐│└─┘` | Normal solid-border box. |
| Checked | `┌─┐│└─┘` + `✔` prefix | Text is prefixed with ✔ to indicate completion. |
| Current Work | `╭╍╍╮┇╰╍╍╯` | Dashed/rounded border with animated ● dots travelling clockwise. |

Toggle checked state with `toggleChecked(boxId)` or by double-clicking. Activate current-work with `startCurrentWork(boxId)` and deactivate with `stopCurrentWork(boxId)`.

### Serialization & Persistence

The model supports JSON round-tripping for save/restore workflows:

`````javascript
// Save
const json = JSON.stringify(diag.getModel().toJSON())

// Restore
const restored = galactica.DiagramModel.fromJSON(JSON.parse(json))
diag.setModel(restored)
diag.route()
`````

For ASCII round-tripping use `serialize()` → `load()`.

### Top-Level Exports

| Export | Description |
|--------|-------------|
| `galactica.diagram(options)` | Create a Diagram widget (blessed Box subclass). |
| `galactica.DiagramModel` | The `DiagramModel` class for programmatic model building. |
| `galactica.parseDiagram(text, options?)` | Parse ASCII text into a `DiagramModel` (headless, no widget). |
| `galactica.renderDiagram(model, options?)` | Render a `DiagramModel` back to ASCII text (headless). |

**Examples:** [interactive demo](./examples/diagrams/diagram.js), [CI/CD pipeline](./examples/diagrams/diagram-pipeline.js), [sprint checklist](./examples/diagrams/diagram-checklist.js), [infra topology](./examples/diagrams/diagram-topology.js)

---

## Colors

You can use 256 colors ([source](./examples/charts/line-random-colors.js)):

`````javascript
  function randomColor() {
    return [Math.random() * 255,Math.random()*255, Math.random()*255]
  }

  line = galactica.line(
  {
    ...
    , style: { line: randomColor(), text: randomColor(), baseline: randomColor() }
  })
`````

---

## Grid

A grid layout can auto position your elements in a grid layout.
When using a grid, you should not create the widgets, rather specify to the grid which widget to create and with which params.
Each widget can span multiple rows and columns.

`````javascript
   var screen = galactica.screen()

   var grid = new galactica.grid({rows: 12, cols: 12, screen: screen})

   //grid.set(row, col, rowSpan, colSpan, obj, opts)
   var map = grid.set(0, 0, 4, 4, galactica.map, {label: 'World Map'})
   var box = grid.set(4, 4, 4, 4, galactica.box, {content: 'My Box'})

   screen.render()
`````

---

## Computed Grid

A proportional layout engine that positions widgets at exact terminal cell coordinates scaled from a 120×40 baseline, rather than using percentage-based positioning.

The key difference from Grid is **label extraction**: templates require titles on a separate row above the box border (e.g. `  Phase Timeline` on row 4, `┌──┐` on row 5). Galactica normally embeds labels in borders (`┌─ Label ─┐`). Computed Grid intercepts the `label` from widget opts, creates a separate title `box()` element above the bordered widget, and monkey-patches `setLabel()` so dynamic label updates (from widgets like task-tracker) are redirected to the title element instead of the border.

Falls back to the percentage-based Grid when no computed layout exists for the requested page name.

### API

`````javascript
   var galactica = require('galactica')
   var screen = galactica.screen()

   // Create a computed grid for a named page layout
   var cGrid = galactica.createComputedGrid(screen, 'spec')

   // Same .set() API as Grid — positions come from the computed layout
   // Labels are automatically extracted and rendered above the border
   var timeline = cGrid.set(0, 0, 4, 6, galactica.line, {label: 'Phase Timeline'})
   var tasks = cGrid.set(0, 6, 4, 6, galactica.table, {label: 'Task Tracker'})

   // Dynamic label updates go to the title element, not the border
   tasks.setLabel('Task Tracker [3/5]')

   screen.render()
`````

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `parent` | Object | — | Galactica screen or chrome box instance |
| `pageName` | string | `'spec'` | Page identifier matching a layout in `computePageLayout` |

### `.set(row, col, rowSpan, colSpan, factory, opts)`

Same signature as `Grid.set()`. The grid coordinates are mapped to widget names via `GRID_COORD_MAP`, then looked up in the computed layout. Each layout entry provides `top`, `left`, `width`, `height` for the bordered box and `titleY`, `titleX` for the title text position.

---

## Carousel

A carousel layout switches between different views based on time or keyboard activity.
One use case is an office dashboard with rotating views:

`````javascript
    var galactica = require('galactica')
      , screen = galactica.screen()

    function page1(screen) {
       var map = galactica.map()
       screen.append(map)
    }

    function page2(screen) {
      var line = galactica.line(
       { width: 80
       , height: 30
       , left: 15
       , top: 12
       , xPadding: 5
       , label: 'Title'
       })

      var data = [ { title: 'us-east',
                 x: ['t1', 't2', 't3', 't4'],
                 y: [0, 0.0695652173913043, 0.11304347826087, 2],
                 style: {
                  line: 'red'
                 }
               }
            ]

      screen.append(line)
      line.setData(data)
    }

    screen.key(['escape', 'q', 'C-c'], function(ch, key) {
      return process.exit(0);
    });

    var carousel = new galactica.carousel( [page1, page2]
                                       , { screen: screen
                                         , interval: 3000 //how often to switch views (set 0 to never swicth automatically)
                                         , controlKeys: true  //should right and left keyboard arrows control view rotation
                                         })
    carousel.start()

`````

---

## Border Charsets

Choose from built-in border character sets or provide your own. Charsets apply to cutout step borders and are specified via the `charset` option on any bordered element.

`````javascript
   var box = galactica.box({
     border: { type: 'line', charset: 'heavy' },
     content: 'Heavy borders'
   })
`````

### Built-in Charsets

| Name | Characters | Example |
|------|-----------|---------|
| `'light'` | `┌ ┐ └ ┘ ─ │` | Default when `charset` is omitted |
| `'heavy'` | `┏ ┓ ┗ ┛ ━ ┃` | Bold/thick borders |
| `'double'` | `╔ ╗ ╚ ╝ ═ ║` | Double-line borders |
| `'rounded'` | `╭ ╮ ╰ ╯ ─ │` | Rounded corners |

### Custom Charset

Pass an object with all six character keys:

`````javascript
   var box = galactica.box({
     border: {
       type: 'line',
       charset: {
         topLeft: '╭', topRight: '╮',
         bottomLeft: '╰', bottomRight: '╯',
         horizontal: '─', vertical: '│'
       }
     }
   })
`````

---

## Corner Cutouts

Attach text to any corner of a bordered element. The border steps around the text, creating an L-shaped notch. The text renders outside the border with a transparent background.

`````
                 cutout here ┌───────────────────────┐
  ┌──────────────────────────┘                       │
  │ content                                          │
  │                                                  │
  └──────────────────────────────────────────────────┘
`````

### `setCutout(position, content, [style])`

`````javascript
   var box = galactica.box({
     border: { type: 'line' },
     content: 'Hello world'
   })

   // Single line cutout
   box.setCutout('top-right', 'Status: OK')

   // Multi-line cutout
   box.setCutout('bottom-left', 'v1.0.0\nstable')

   // With custom foreground color
   box.setCutout('top-right', 'Alert!', { fg: 'red' })
`````

**Positions:** `'top-left'`, `'top-right'`, `'bottom-left'`, `'bottom-right'`

Setting the same corner twice replaces the previous cutout.

### `clearCutout(position)`

`````javascript
   box.clearCutout('top-right')
`````

### Inner Tab Space

When a cutout has 2+ lines, a bordered space exists beside the cutout text inside the step. Use `getCutoutInner()` to get its absolute screen bounds and place content there:

`````
  ░▀█▀▒▄▀▄▒█▀▄░▄▀▀ ┌───────────────────────────────────────────────┐
  ░▒█▒░█▀█░█▀▄▒▄██ │ F1 Spec  F2 Plan  F3 Run  F4 Task            │  ← inner tab space
  ┌─────────────────┘───────────────────────────────────────────────┤
  │ content                                                         │
  └─────────────────────────────────────────────────────────────────┘
`````

### `getCutoutInner(position)`

Returns `{ top, left, width, height }` in absolute screen coordinates, or `null` if no cutout is set or the cutout has only 1 line (no usable inner space).

`````javascript
   box.setCutout('top-right', 'LOGO LINE 1\nLOGO LINE 2')

   screen.render()

   var inner = box.getCutoutInner('top-right')
   // → { top: 3, left: 20, width: 74, height: 1 }
   // → null if no cutout or single-line cutout

   if (inner) {
     var tabBar = galactica.box({
       parent: screen,
       top: inner.top,
       left: inner.left,
       width: inner.width,
       height: inner.height,
       content: 'F1 Spec  F2 Plan  F3 Run  F4 Task',
       style: { transparent: true, fg: 'white' }
     })
   }
`````

Parent the inner content to `screen` (not the box) and use the absolute coordinates from `getCutoutInner()`. Reposition on resize:

`````javascript
   screen.on('resize', function() {
     screen.render()
     var inner = box.getCutoutInner('top-right')
     if (inner && tabBar) {
       tabBar.top = inner.top
       tabBar.left = inner.left
       tabBar.width = inner.width
     }
     screen.render()
   })
`````

| Lines | Inner rows | Notes |
|-------|-----------|-------|
| 1 | 0 | No inner space. `getCutoutInner()` returns `null`. |
| 2 | 1 | One usable row beside the cutout. |
| 3 | 2 | Two usable rows, etc. |

### Text Alignment

Short lines align toward the step border (flush against the box edge):

| Position | Text extends | Short lines align |
|----------|-------------|-------------------|
| `top-right` | leftward | right |
| `top-left` | rightward | left |
| `bottom-right` | rightward | left |
| `bottom-left` | leftward | right |

### All Four Corners

`````
                        text ┌─────────────────────────┐  text ┌───────────────────────┐
  ┌──────────────────────────┘                         │  │    └───────────────────────┤
  │               top-right                            │  │          top-left           │
  │                                                    │  │                             │
  └────────────────────────────────────────────────────┘  └─────────────────────────────┘

  ┌────────────────────────────────────────────────────┐  ┌─────────────────────────────┐
  │                                                    │  │                             │
  │            bottom-right                            │  │        bottom-left          │
  │                    ┌───────────────────────────────┘  └───────────────────────┐     │
  └────────────────────┘ text                             text                    └─────┘
`````

**Examples:** [cutout-quick.js](./examples/layout/cutout-quick.js), [cutout-tabbar.js](./examples/layout/cutout-tabbar.js)

---

## Utilities

- [Slot Layout](#slot-layout)

---

## Slot Layout

Fixed-width slot layout utilities for terminal dashboard widgets. Dashboard chrome paints separator characters (`║`, `│`, `─`) at fixed screen columns **after** widgets render. If widget text is not padded to exact slot widths, separators overwrite mid-word characters (e.g. `SCAN` → `SC║N`). These utilities ensure widget content fills its allocated slot exactly, so chrome separators land on single-space boundaries between slots.

All width calculations handle CJK double-wide characters, combining marks, and emoji via the `displayWidth` utility. Blessed tags (`{green-fg}`, `{/bold}`, etc.) are treated as zero-width — stripped for measurement, preserved in output.

### `fitToWidth(str, width)`

Pad or truncate a string to an exact terminal display width.

`````javascript
var galactica = require('galactica')

// Pad short strings to fill the slot
galactica.fitToWidth('SCAN', 10)    // → 'SCAN      '  (6 trailing spaces)

// Truncate long strings at the boundary
galactica.fitToWidth('SCANNING PHASE', 10) // → 'SCANNING P'

// Blessed tags are zero-width — preserved in output, excluded from measurement
galactica.fitToWidth('{green-fg}OK{/green-fg}', 6) // → '{green-fg}OK{/green-fg}    '
`````

| Parameter | Type | Description |
|-----------|------|-------------|
| `str` | string | Input string (may contain blessed tags) |
| `width` | number | Target display width in terminal cells |

**Returns:** String whose visible width is exactly `width` cells.

### `joinFields(fields, [separator])`

Join `[value, slotWidth]` pairs with a separator character, padding each value to its exact slot width.

`````javascript
var galactica = require('galactica')

// Status bar with │ separators (default)
galactica.joinFields([
  ['S:56 O:7', 12],
  ['CPU: 23%', 10],
  ['MEM: 1.2G', 10]
])
// → 'S:56 O:7    │CPU: 23%  │MEM: 1.2G '

// Phase flow with space separator (chrome overwrites with ║)
galactica.joinFields([
  ['SCAN',  8],
  ['BUILD', 8],
  ['TEST',  8]
], ' ')
// → 'SCAN     BUILD    TEST    '
`````

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fields` | Array<[string, number]> | — | Array of `[value, slotWidth]` pairs |
| `separator` | string | `'│'` | Separator character between fields |

**Returns:** Content string with separators at exact column positions.

### `scaleWidths(baseWidths, newSlotSpace)`

Proportionally scale baseline field widths to fit a new total slot space. Each field (except the last) is scaled via `Math.round`, preserving its proportion of the baseline total. The last field absorbs rounding error so the returned array always sums to exactly `newSlotSpace`.

`````javascript
var galactica = require('galactica')

// Baseline widths designed at 120 columns, scaled to 80
var base = [30, 30, 30, 30]
galactica.scaleWidths(base, 80) // → [20, 20, 20, 20]

// Rounding remainder absorbed by last field
galactica.scaleWidths([10, 10, 10], 25) // → [8, 8, 9]
`````

| Parameter | Type | Description |
|-----------|------|-------------|
| `baseWidths` | number[] | Baseline field widths (e.g. at 120×40) |
| `newSlotSpace` | number | Target total slot space at the current size |

**Returns:** Scaled widths summing to exactly `newSlotSpace`.

### `renderSlotRow(items, slotWidths, formatter, [separator])`

Render items into fixed-width slots via a formatter callback. Each item is formatted by the callback, then padded to its assigned slot width.

`````javascript
var galactica = require('galactica')

var phases = [
  { name: 'SCAN',  pct: 100 },
  { name: 'BUILD', pct: 45 },
  { name: 'TEST',  pct: 0 }
]

var widths = [12, 12, 12]

var row = galactica.renderSlotRow(phases, widths, function (phase, w, i) {
  return phase.name + ' ' + phase.pct + '%'
})
// → 'SCAN 100%    BUILD 45%    TEST 0%     '
`````

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `items` | Array | — | Data items to render (e.g. phase objects) |
| `slotWidths` | number[] | — | Per-slot display widths. Items beyond the array fall back to 12. |
| `formatter` | Function | — | `(item, slotWidth, index) => string` — produces raw label before padding |
| `separator` | string | `' '` | Join character between padded slots |

**Returns:** Rendered row with items at fixed column positions.

### `buildFieldRow(fields, contentWidth, [opts])`

High-level row builder that deducts separator space, computes final field widths (proportional or fixed-absorb), pads each field, and joins with the separator. Encapsulates the boilerplate shared by status-bar and tab-bar widgets.

**Two width strategies:**

- **Proportional** (default): Baseline widths are scaled via `scaleWidths()` to fill available space. Used by tab-bar where field proportions must adapt to varying terminal sizes.
- **Fixed + absorb** (`opts.fixedWidths = true`): Field widths are used as-is for all fields except the last, which absorbs remaining space. Used by status-bar where most fields are fixed-width and only the last field (e.g. keyboard legend) flexes.

`````javascript
var galactica = require('galactica')

// Proportional — tab bar adapting to 80-column terminal
var tabRow = galactica.buildFieldRow([
  ['F1 Spec',   30],
  ['F2 Plan',   30],
  ['F3 Run',    30],
  ['F4 Tasks',  30]
], 80)
// Fields scaled proportionally to fill 80 cols minus separator space

// Fixed + absorb — status bar with fixed fields + flexible last field
var statusRow = galactica.buildFieldRow([
  ['S:56 O:7',    12],
  ['CPU: 23%',    10],
  ['↑↓ Navigate', 40]
], 80, { fixedWidths: true })
// First two fields are exactly 12 and 10 wide; last field absorbs the rest

// Custom separator
var row = galactica.buildFieldRow([
  ['SCAN',  20],
  ['BUILD', 20]
], 42, { separator: ' ' })
`````

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fields` | Array<[string, number]> | — | `[content, baselineWidth]` pairs |
| `contentWidth` | number | — | Total available width for fields + separators |
| `opts.separator` | string | `'│'` | Join character between fields |
| `opts.fixedWidths` | boolean | `false` | When `true`, use declared widths as-is and make the last field absorb remaining space |

**Returns:** Content string of exactly `contentWidth` display cells.
