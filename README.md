## Galactica

[![npm version](https://img.shields.io/npm/v/galactica.svg)](https://www.npmjs.com/package/galactica)
[![npm downloads](https://img.shields.io/npm/dm/galactica.svg)](https://www.npmjs.com/package/galactica)
[![license](https://img.shields.io/npm/l/galactica.svg)](https://opensource.org/licenses/MIT)

Build dashboards (or any other application) using ascii/ansi art and javascript.

Friendly to terminals, ssh and developers. Features custom drawille rendering and powerful layout widgets.


**Maintained by [Brian Shannon](https://www.linkedin.com/in/brianshann/)**
[Bluesky](https://bsky.app/profile/codemeasandwich.bsky.social) • [GitHub](https://github.com/codemeasandwich)

**Demo ([full size](https://raw.githubusercontent.com/codemeasandwich/CliUI/master/docs/images/term3.gif)):**

<img src="./docs/images/truload.png" alt="term" width="800">

<img src="./docs/images/term3.gif" alt="term" width="800">

([source code](./examples/dashboard.js))

**Running the demo**

    git clone https://github.com/codemeasandwich/CliUI.git
    cd CliUI
    npm install
    node ./examples/dashboard.js

Works on Linux, OS X and Windows. For Windows follow the [pre requisites](http://webservices20.blogspot.co.il/2015/04/running-terminal-dashboards-on-windows.html).

## Installation

    npm install galactica

## Quick Start

**CommonJS**
`````javascript
const galactica = require('galactica')
const screen = galactica.screen()
const grid = new galactica.grid({rows: 1, cols: 2, screen: screen})

const line = grid.set(0, 0, 1, 1, galactica.line,
  { style: { line: "yellow", text: "green", baseline: "black" }
  , xLabelPadding: 3
  , xPadding: 5
  , label: 'Stocks'})

const map = grid.set(0, 1, 1, 1, galactica.map, {label: 'Servers Location'})

line.setData([{ x: ['t1', 't2', 't3', 't4'], y: [5, 1, 7, 5] }])

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0)
})

screen.render()
`````

**ES Modules**
`````javascript
import { screen, grid, line, map } from 'galactica'

const scr = screen()
const grd = new grid({rows: 1, cols: 2, screen: scr})

const lineChart = grd.set(0, 0, 1, 1, line,
  { style: { line: "yellow", text: "green", baseline: "black" }
  , xLabelPadding: 3
  , xPadding: 5
  , label: 'Stocks'})

const worldMap = grd.set(0, 1, 1, 1, map, {label: 'Servers Location'})

lineChart.setData([{ x: ['t1', 't2', 't3', 't4'], y: [5, 1, 7, 5] }])

scr.key(['escape', 'q', 'C-c'], () => process.exit(0))

scr.render()
`````

## Documentation

See [COOKBOOK.md](./COOKBOOK.md) for detailed widget documentation including:

**Widgets:** Line Chart, Scatter Plot, Bar Chart, Stacked Bar, Map, Gauge, Donut, LCD Display, Rolling Log, Picture, Sparkline, Table, Tree, Markdown

**Borders:** [Corner Cutouts](./COOKBOOK.md#corner-cutouts), [Border Charsets](./COOKBOOK.md#border-charsets)

**Layouts:** [Grid](./COOKBOOK.md#grid), [Computed Grid](./COOKBOOK.md#computed-grid), [Carousel](./COOKBOOK.md#carousel)

**Utilities:** [Slot Layout](./COOKBOOK.md#slot-layout) — fixed-width field padding, proportional scaling, row builders for status/tab bars

## Troubleshooting

If you see question marks or missing characters try running with these env vars:
`````
$> LANG=en_US.utf8 TERM=xterm-256color node your-code.js
`````

## License

This library is under the [MIT License](http://opensource.org/licenses/MIT)

## More Information

**Maintained by [Brian Shannon](https://www.linkedin.com/in/brianshann/)**
[Bluesky](https://bsky.app/profile/codemeasandwich.bsky.social) • [GitHub](https://github.com/codemeasandwich)
