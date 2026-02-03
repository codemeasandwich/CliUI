# CliUI Coverage Report

Terminal dashboard widgets for blessed/blessed-contrib.  
Auto-generated coverage report from test suite.

## Summary

| Metric | Average |
|--------|--------|
| Lines | 93.93% |
| Branches | 79.45% |
| Functions | 91.04% |

---

## Missing Line Coverage

Files with less than 100% line coverage. Each uncovered line is listed below the table.

| File | Lines | Branches | Functions | Uncovered Lines |
|------|-------|----------|-----------|----------------|
| [lib/](lib/)[layout/](lib/layout/)[carousel.js](lib/layout/carousel.js) | 91.78% | 93.75% | 87.50% | 37, 38, 64, 65, 66... (6 total) |
| [lib/](lib/)[layout/](lib/layout/)[grid.js](lib/layout/grid.js) | 90.00% | 66.67% | 100.00% | 8, 18, 19, 20 |
| [lib/](lib/)[utils.js](lib/utils.js) | 86.11% | 85.00% | 75.00% | 12, 13, 27, 28, 29... (10 total) |
| [lib/](lib/)[widget/](lib/widget/)[canvas.js](lib/widget/canvas.js) | 94.12% | 75.00% | 80.00% | 12, 13, 36 |
| [lib/](lib/)[widget/](lib/widget/)[charts/](lib/widget/charts/)[bar.js](lib/widget/charts/bar.js) | 90.53% | 61.90% | 80.00% | 44, 45, 84, 85, 86... (9 total) |
| [lib/](lib/)[widget/](lib/widget/)[charts/](lib/widget/charts/)[line.js](lib/widget/charts/line.js) | 89.05% | 90.77% | 92.31% | 39, 40, 152, 245, 246... (30 total) |
| [lib/](lib/)[widget/](lib/widget/)[charts/](lib/widget/charts/)[scatter.js](lib/widget/charts/scatter.js) | 98.75% | 77.01% | 100.00% | 40, 41, 184, 185 |
| [lib/](lib/)[widget/](lib/widget/)[charts/](lib/widget/charts/)[stacked-bar.js](lib/widget/charts/stacked-bar.js) | 94.47% | 63.89% | 90.91% | 61, 62, 168, 169, 170... (12 total) |
| [lib/](lib/)[widget/](lib/widget/)[donut.js](lib/widget/donut.js) | 91.95% | 88.24% | 90.00% | 51, 52, 137, 138, 139... (12 total) |
| [lib/](lib/)[widget/](lib/widget/)[gauge-list.js](lib/widget/gauge-list.js) | 93.40% | 66.67% | 85.71% | 45, 46, 77, 78, 94... (7 total) |
| [lib/](lib/)[widget/](lib/widget/)[gauge.js](lib/widget/gauge.js) | 95.20% | 87.10% | 100.00% | 52, 53, 79, 80, 112... (6 total) |
| [lib/](lib/)[widget/](lib/widget/)[lcd.js](lib/widget/lcd.js) | 95.57% | 77.27% | 96.15% | 90, 91, 92, 93, 94... (20 total) |
| [lib/](lib/)[widget/](lib/widget/)[log.js](lib/widget/log.js) | 94.59% | 75.00% | 100.00% | 31, 32 |
| [lib/](lib/)[widget/](lib/widget/)[map.js](lib/widget/map.js) | 84.88% | 60.00% | 83.33% | 62, 63, 69, 70, 71... (13 total) |
| [lib/](lib/)[widget/](lib/widget/)[picture.js](lib/widget/picture.js) | 92.75% | 69.23% | 80.00% | 33, 61, 62, 63, 64 |
| [lib/](lib/)[widget/](lib/widget/)[table.js](lib/widget/table.js) | 94.09% | 78.26% | 87.50% | 16, 17, 18, 19, 45... (12 total) |
| [lib/](lib/)[widget/](lib/widget/)[tree.js](lib/widget/tree.js) | 95.29% | 84.62% | 83.33% | 49, 50, 51, 52, 53... (8 total) |

### Uncovered Line Details

#### lib/layout/carousel.js

- **Line 37**: `this.currPage=this.pages.length-1;`
- **Line 38**: `}`
- **Line 64**: `if (key.name=='right') self.next();`
- **Line 65**: `if (key.name=='left') self.prev();`
- **Line 66**: `if (key.name=='home') self.home();`
- **Line 67**: `if (key.name=='end') self.end();`

#### lib/layout/grid.js

- **Line 8**: `'Note: Release 2.0.0 has breaking changes. Please refer to the README or to https://github.com/codemeasandwich/CliUI/issues/39';`
- **Line 18**: `throw 'Error: A Grid is not allowed to be nested inside another grid.\r\n' +`
- **Line 19**: `'Note: Release 2.0.0 has breaking changes. Please refer to the README or to https://github.com/codemeasandwich/CliUI/issues/39';`
- **Line 20**: `}`

#### lib/utils.js

- **Line 12**: `return obj1;`
- **Line 13**: `}`
- **Line 27**: `// property in destination object not set; create it and set its value`
- **Line 28**: `obj1[p] = obj2[p];`
- **Line 29**: ``
- **Line 30**: `}`
- **Line 37**: `function getTypeName(thing){`
- **Line 38**: `if(thing===null)return '[object Null]'; // special case`
- **Line 39**: `return Object.prototype.toString.call(thing);`
- **Line 40**: `}`

#### lib/widget/canvas.js

- **Line 12**: `return new Canvas(options);`
- **Line 13**: `}`
- **Line 36**: `this.canvasSize = {width: this.width*2-12, height: this.height*4};`

#### lib/widget/charts/bar.js

- **Line 44**: `throw 'error: canvas context does not exist. setData() for bar charts must be called after the chart has been added to the screen via screen.append()';`
- **Line 45**: `}`
- **Line 84**: `return  {  barWidth: 1`
- **Line 85**: `,  barSpacing: 1`
- **Line 86**: `,  xOffset: 1`
- **Line 87**: `,  maxHeight: 1`
- **Line 88**: `,  data: { titles: ['s']`
- **Line 89**: `, data: [1]}`
- **Line 90**: `};`

#### lib/widget/charts/line.js

- **Line 39**: `throw 'error: canvas context does not exist. setData() for line charts must be called after the chart has been added to the screen via screen.append()';`
- **Line 40**: `}`
- **Line 152**: `// console.log("label[" + i + "] is undefined");`
- **Line 245**: `return { width: 80`
- **Line 246**: `, height: 30`
- **Line 247**: `, left: 15`
- **Line 248**: `, top: 12`
- **Line 249**: `, xPadding: 5`
- **Line 250**: `, label: 'Title'`
- **Line 251**: `, showLegend: true`
- **Line 252**: `, legend: {width: 12}`
- **Line 253**: `, data: [ { title: 'us-east',`
- **Line 254**: `x: ['t1', 't2', 't3', 't4'],`
- **Line 255**: `y: [5, 1, 7, 5],`
- **Line 256**: `style: {`
- **Line 257**: `line: 'red'`
- **Line 258**: `}`
- **Line 259**: `}`
- **Line 260**: `, { title: 'us-west',`
- **Line 261**: `x: ['t1', 't2', 't3', 't4'],`
- **Line 262**: `y: [2, 4, 9, 8],`
- **Line 263**: `style: {line: 'yellow'}`
- **Line 264**: `}`
- **Line 265**: `, {title: 'eu-north-with-some-long-string',`
- **Line 266**: `x: ['t1', 't2', 't3', 't4'],`
- **Line 267**: `y: [22, 7, 12, 1],`
- **Line 268**: `style: {line: 'blue'}`
- **Line 269**: `}]`
- **Line 270**: ``
- **Line 271**: `};`

#### lib/widget/charts/scatter.js

- **Line 40**: `throw 'error: canvas context does not exist. setData() for scatter plots must be called after the chart has been added to the screen via screen.append()';`
- **Line 41**: `}`
- **Line 184**: `xPadding = xLabelPadding;`
- **Line 185**: `}`

#### lib/widget/charts/stacked-bar.js

- **Line 61**: `throw 'error: canvas context does not exist. setData() for bar charts must be called after the chart has been added to the screen via screen.append()';`
- **Line 62**: `}`
- **Line 168**: `return  {  barWidth: 1`
- **Line 169**: `,  barSpacing: 1`
- **Line 170**: `,  xOffset: 1`
- **Line 171**: `,  maxValue: 1`
- **Line 172**: `,  barBgColor: 's'`
- **Line 173**: `,  data: { barCategory: ['s']`
- **Line 174**: `, stackedCategory: ['s']`
- **Line 175**: `, data: [ [ 1] ]`
- **Line 176**: `}`
- **Line 177**: `};`

#### lib/widget/donut.js

- **Line 51**: `throw 'error: canvas context does not exist. setData() for line charts must be called after the chart has been added to the screen via screen.append()';`
- **Line 52**: `}`
- **Line 137**: `return {`
- **Line 138**: `spacing: 1,`
- **Line 139**: `yPadding: 1,`
- **Line 140**: `radius: 1,`
- **Line 141**: `arcWidth: 1,`
- **Line 142**: `data: [ { color: 'red', percent: '50', label: 'a'}`
- **Line 143**: `, { color: 'blue', percent: '20', label: 'b'}`
- **Line 144**: `, { color: 'yellow', percent: '80', label: 'c'}`
- **Line 145**: `]`
- **Line 146**: `};`

#### lib/widget/gauge-list.js

- **Line 45**: `throw 'error: canvas context does not exist. setData() for gauges must be called after the gauge has been added to the screen via screen.append()';`
- **Line 46**: `}`
- **Line 77**: `percent = currentStack;`
- **Line 78**: `}`
- **Line 94**: `c.strokeStyle = 'normal';`
- **Line 95**: `}`
- **Line 103**: `return {percent: 10};`

#### lib/widget/gauge.js

- **Line 52**: `throw 'error: canvas context does not exist. setData() for gauges must be called after the gauge has been added to the screen via screen.append()';`
- **Line 53**: `}`
- **Line 79**: `throw 'error: canvas context does not exist. setData() for gauges must be called after the gauge has been added to the screen via screen.append()';`
- **Line 80**: `}`
- **Line 112**: `c.strokeStyle = 'normal';`
- **Line 113**: `}`

#### lib/widget/lcd.js

- **Line 90**: `return {`
- **Line 91**: `label: 'LCD Test',`
- **Line 92**: `segmentWidth: 0.06,`
- **Line 93**: `segmentInterval: 0.11,`
- **Line 94**: `strokeWidth: 0.1,`
- **Line 95**: `elements: 5,`
- **Line 96**: `display: 3210,`
- **Line 97**: `elementSpacing: 4,`
- **Line 98**: `elementPadding: 2`
- **Line 99**: `};`
- **Line 105**: `throw 'error: canvas context does not exist. setData() for line charts must be called after the chart has been added to the screen via screen.append()';`
- **Line 106**: `}`
- **Line 124**: `throw 'Invalid element count: ' + count;`
- **Line 125**: `}`
- **Line 135**: `value = '';`
- **Line 136**: `}`
- **Line 144**: `return;`
- **Line 145**: `}`
- **Line 152**: `mask = this.NullMask;`
- **Line 153**: `}`

#### lib/widget/log.js

- **Line 31**: `this.scrollTo(this.logLines.length);`
- **Line 32**: `}`

#### lib/widget/map.js

- **Line 62**: `throw 'error: canvas context does not exist. addMarker() for maps must be called after the map has been added to the screen via screen.append()';`
- **Line 63**: `}`
- **Line 69**: ``
- **Line 70**: `return { startLon: 10`
- **Line 71**: `, endLon: 10`
- **Line 72**: `, startLat: 10`
- **Line 73**: `, endLat: 10`
- **Line 74**: `, region: 'us'`
- **Line 75**: `, markers:`
- **Line 76**: `[  {'lon' : '-79.0000', 'lat' : '37.5000', color: 'red', char: 'X' }`
- **Line 77**: `,{'lon' : '79.0000', 'lat' : '37.5000', color: 'blue', char: 'O' }`
- **Line 78**: `]`
- **Line 79**: `};`

#### lib/widget/picture.js

- **Line 33**: `options.stream.pipe(tube);`
- **Line 61**: ``
- **Line 62**: `return { base64:'AAAA'`
- **Line 63**: `, cols: 1 };`
- **Line 64**: ``

#### lib/widget/table.js

- **Line 16**: `throw 'Error: columnSpacing cannot be an array.\r\n' +`
- **Line 17**: `'Note: From release 2.0.0 use property columnWidth instead of columnSpacing.\r\n' +`
- **Line 18**: `'Please refere to the README or to https://github.com/codemeasandwich/CliUI/issues/39';`
- **Line 19**: `}`
- **Line 45**: `listStyle.focus = options.style.focus;`
- **Line 46**: `}`
- **Line 74**: `self.rows.select(0);`
- **Line 75**: `self.screen.render();`
- **Line 78**: `self.rows.select(self.rows.items.length - 1);`
- **Line 79**: `self.screen.render();`
- **Line 166**: `spaceLength = 0;`
- **Line 167**: `}`

#### lib/widget/tree.js

- **Line 49**: `var selectedNode = self.nodeLines[this.getItemIndex(this.selected)];`
- **Line 50**: `if (selectedNode.children) {`
- **Line 51**: `selectedNode.extended = !selectedNode.extended;`
- **Line 52**: `self.setData(self.data);`
- **Line 53**: `self.screen.render();`
- **Line 54**: `}`
- **Line 55**: ``
- **Line 56**: `self.emit('select', selectedNode, this.getItemIndex(this.selected));`

---

## Missing Branch/Function Coverage

Files with 100% line coverage but missing branch or function coverage.

| File | Lines | Branches | Functions |
|------|-------|----------|----------|
| [lib/](lib/)[server-utils.js](lib/server-utils.js) | 100.00% | 89.47% | 100.00% |
| [lib/](lib/)[widget/](lib/widget/)[markdown.js](lib/widget/markdown.js) | 100.00% | 92.86% | 100.00% |
| [lib/](lib/)[widget/](lib/widget/)[sparkline.js](lib/widget/sparkline.js) | 100.00% | 85.71% | 100.00% |

### Details

- **lib/server-utils.js**: Branch coverage: 89.47%
- **lib/widget/markdown.js**: Branch coverage: 92.86%
- **lib/widget/sparkline.js**: Branch coverage: 85.71%

---

## Fully Covered Files

Files with 100% coverage across all metrics.

| File | Lines | Branches | Functions |
|------|-------|----------|----------|
| [lib/](lib/)[blessed.js](lib/blessed.js) | 100.00% | 100.00% | 100.00% |

---

*Generated: 2026-02-02T23:55:32.213Z*
