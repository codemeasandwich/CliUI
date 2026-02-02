# CliUI Coverage Report

Terminal dashboard widgets for blessed/blessed-contrib.  
Auto-generated coverage report from test suite.

## Summary

| Metric | Average |
|--------|--------|
| Lines | 85.61% |
| Branches | 75.67% |
| Functions | 81.66% |

---

## Missing Line Coverage

Files with less than 100% line coverage. Each uncovered line is listed below the table.

| File | Lines | Branches | Functions | Uncovered Lines |
|------|-------|----------|-----------|----------------|
| [lib/](lib/)[layout/](lib/layout/)[carousel.js](lib/layout/carousel.js) | 82.19% | 83.33% | 87.50% | 21, 22, 33, 34, 35... (13 total) |
| [lib/](lib/)[layout/](lib/layout/)[grid.js](lib/layout/grid.js) | 90.00% | 66.67% | 100.00% | 8, 18, 19, 20 |
| [lib/](lib/)[server-utils.js](lib/server-utils.js) | 20.83% | 100.00% | 0.00% | 6, 7, 8, 9, 10... (57 total) |
| [lib/](lib/)[utils.js](lib/utils.js) | 86.11% | 85.00% | 75.00% | 12, 13, 27, 28, 29... (10 total) |
| [lib/](lib/)[widget/](lib/widget/)[canvas.js](lib/widget/canvas.js) | 94.12% | 75.00% | 80.00% | 12, 13, 36 |
| [lib/](lib/)[widget/](lib/widget/)[charts/](lib/widget/charts/)[bar.js](lib/widget/charts/bar.js) | 88.42% | 55.00% | 80.00% | 44, 45, 64, 65, 84... (11 total) |
| [lib/](lib/)[widget/](lib/widget/)[charts/](lib/widget/charts/)[line.js](lib/widget/charts/line.js) | 89.05% | 90.77% | 92.31% | 39, 40, 152, 245, 246... (30 total) |
| [lib/](lib/)[widget/](lib/widget/)[charts/](lib/widget/charts/)[scatter.js](lib/widget/charts/scatter.js) | 85.98% | 58.67% | 93.33% | 40, 41, 88, 89, 107... (45 total) |
| [lib/](lib/)[widget/](lib/widget/)[charts/](lib/widget/charts/)[stacked-bar.js](lib/widget/charts/stacked-bar.js) | 94.47% | 63.89% | 90.91% | 61, 62, 168, 169, 170... (12 total) |
| [lib/](lib/)[widget/](lib/widget/)[donut.js](lib/widget/donut.js) | 91.95% | 88.24% | 90.00% | 51, 52, 137, 138, 139... (12 total) |
| [lib/](lib/)[widget/](lib/widget/)[gauge-list.js](lib/widget/gauge-list.js) | 93.40% | 66.67% | 85.71% | 45, 46, 77, 78, 94... (7 total) |
| [lib/](lib/)[widget/](lib/widget/)[gauge.js](lib/widget/gauge.js) | 94.40% | 86.67% | 85.71% | 52, 53, 79, 80, 112... (7 total) |
| [lib/](lib/)[widget/](lib/widget/)[lcd.js](lib/widget/lcd.js) | 95.57% | 77.27% | 96.15% | 90, 91, 92, 93, 94... (20 total) |
| [lib/](lib/)[widget/](lib/widget/)[log.js](lib/widget/log.js) | 94.59% | 75.00% | 100.00% | 31, 32 |
| [lib/](lib/)[widget/](lib/widget/)[map.js](lib/widget/map.js) | 84.88% | 60.00% | 83.33% | 62, 63, 69, 70, 71... (13 total) |
| [lib/](lib/)[widget/](lib/widget/)[markdown.js](lib/widget/markdown.js) | 79.69% | 88.89% | 80.00% | 44, 45, 46, 47, 48... (13 total) |
| [lib/](lib/)[widget/](lib/widget/)[picture.js](lib/widget/picture.js) | 92.75% | 69.23% | 80.00% | 33, 61, 62, 63, 64 |
| [lib/](lib/)[widget/](lib/widget/)[sparkline.js](lib/widget/sparkline.js) | 79.37% | 75.00% | 75.00% | 39, 40, 48, 49, 50... (13 total) |
| [lib/](lib/)[widget/](lib/widget/)[table.js](lib/widget/table.js) | 80.30% | 71.79% | 75.00% | 16, 17, 18, 19, 45... (40 total) |
| [lib/](lib/)[widget/](lib/widget/)[tree.js](lib/widget/tree.js) | 94.12% | 76.32% | 83.33% | 49, 50, 51, 52, 53... (10 total) |

### Uncovered Line Details

#### lib/layout/carousel.js

- **Line 21**: `this.currPage--;`
- **Line 22**: `return;`
- **Line 33**: `if (!this.options.rotate) {`
- **Line 34**: `this.currPage++;`
- **Line 35**: `return;`
- **Line 36**: `} else {`
- **Line 37**: `this.currPage=this.pages.length-1;`
- **Line 38**: `}`
- **Line 39**: `}`
- **Line 64**: `if (key.name=='right') self.next();`
- **Line 65**: `if (key.name=='left') self.prev();`
- **Line 66**: `if (key.name=='home') self.home();`
- **Line 67**: `if (key.name=='end') self.end();`

#### lib/layout/grid.js

- **Line 8**: `'Note: Release 2.0.0 has breaking changes. Please refer to the README or to https://github.com/codemeasandwich/CliUI/issues/39';`
- **Line 18**: `throw 'Error: A Grid is not allowed to be nested inside another grid.\r\n' +`
- **Line 19**: `'Note: Release 2.0.0 has breaking changes. Please refer to the README or to https://github.com/codemeasandwich/CliUI/issues/39';`
- **Line 20**: `}`

#### lib/server-utils.js

- **Line 6**: `function OutputBuffer(options) {`
- **Line 7**: `this.isTTY = true;`
- **Line 8**: `this.columns = options.cols;`
- **Line 9**: `this.rows = options.rows;`
- **Line 10**: `this.write = function(s) {`
- **Line 11**: `s = s.replace('\x1b8', ''); //not clear from where in blessed this code comes from. It forces the terminal to clear and loose existing content.`
- **Line 12**: `options.res.write(s);`
- **Line 13**: `};`
- **Line 14**: ``
- **Line 15**: `this.on = function() {};`
- **Line 16**: `}`
- **Line 18**: `function InputBuffer() {`
- **Line 19**: `this.isTTY = true;`
- **Line 20**: `this.isRaw = true;`
- **Line 21**: ``
- **Line 22**: `this.emit = function() {};`
- **Line 23**: ``
- **Line 24**: `this.setRawMode = function() {};`
- **Line 25**: `this.resume = function() {};`
- **Line 26**: `this.pause = function() {};`
- **Line 27**: ``
- **Line 28**: `this.on = function() {};`
- **Line 29**: `}`
- **Line 31**: `function serverError(req, res, err) {`
- **Line 32**: `setTimeout(function() {`
- **Line 33**: `if (!res.headersSent) res.writeHead(500, {'Content-Type': 'text/plain'});`
- **Line 34**: `res.write('\r\n\r\n'+err+'\r\n\r\n');`
- **Line 35**: `//restore cursor`
- **Line 36**: `res.end('\u001b[?25h');`
- **Line 37**: `}, 0);`
- **Line 38**: ``
- **Line 39**: `return true;`
- **Line 40**: `}`
- **Line 43**: `function createScreen(req, res) {`
- **Line 44**: `var query = url.parse(req.url, true).query;`
- **Line 45**: ``
- **Line 46**: `var cols = query.cols \|\| 250;`
- **Line 47**: `var rows = query.rows \|\| 50;`
- **Line 48**: ``
- **Line 49**: `if (cols<=35 \|\| cols>=500 \|\| rows<=5 \|\| rows>=300) {`
- **Line 50**: `serverError(req, res, 'cols must be bigger than 35 and rows must be bigger than 5');`
- **Line 51**: `return null;`
- **Line 52**: `}`
- **Line 53**: ``
- **Line 54**: `res.writeHead(200, {'Content-Type': 'text/plain'});`
- **Line 55**: ``
- **Line 56**: `var output = new contrib.OutputBuffer({res: res, cols: cols, rows: rows});`
- **Line 57**: `var input = new contrib.InputBuffer(); //required to run under forever since it replaces stdin to non-tty`
- **Line 58**: `var program = blessed.program({output: output, input: input});`
- **Line 59**: ``
- **Line 60**: `if (query.terminal) program.terminal = query.terminal;`
- **Line 61**: `if (query.isOSX) program.isOSXTerm = query.isOSX;`
- **Line 62**: `if (query.isiTerm2) program.isiTerm2 = query.isiTerm2;`
- **Line 63**: ``
- **Line 64**: `var screen = blessed.screen({program: program});`
- **Line 65**: `return screen;`
- **Line 66**: `}`

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
- **Line 64**: `c.strokeStyle = 'normal';`
- **Line 65**: `}`
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
- **Line 88**: `return self.options.minX;`
- **Line 89**: `}`
- **Line 107**: `return self.options.maxX;`
- **Line 108**: `}`
- **Line 128**: `return self.options.minY;`
- **Line 129**: `}`
- **Line 150**: `return self.options.maxY;`
- **Line 151**: `}`
- **Line 180**: `xLabelPadding = maxPadding;`
- **Line 181**: `}`
- **Line 184**: `xPadding = xLabelPadding;`
- **Line 185**: `}`
- **Line 221**: `c.moveTo(x, y-2); c.lineTo(x, y+2);`
- **Line 222**: `c.moveTo(x-2, y); c.lineTo(x+2, y);`
- **Line 223**: `c.moveTo(x-1, y-1); c.lineTo(x+1, y+1);`
- **Line 224**: `c.moveTo(x+1, y-1); c.lineTo(x-1, y+1);`
- **Line 225**: `break;`
- **Line 228**: `c.moveTo(x, y); c.lineTo(x, y);`
- **Line 229**: `break;`
- **Line 295**: `return { width: 80`
- **Line 296**: `, height: 30`
- **Line 297**: `, left: 15`
- **Line 298**: `, top: 12`
- **Line 299**: `, xPadding: 5`
- **Line 300**: `, label: 'Title'`
- **Line 301**: `, showLegend: true`
- **Line 302**: `, legend: {width: 12}`
- **Line 303**: `, marker: 'o'`
- **Line 304**: `, data: [ { title: 'us-east',`
- **Line 305**: `x: [1, 2, 3, 4, 5],`
- **Line 306**: `y: [5, 1, 7, 5, 2],`
- **Line 307**: `style: {`
- **Line 308**: `point: 'red',`
- **Line 309**: `marker: 'o'`
- **Line 310**: `}`
- **Line 311**: `}`
- **Line 312**: `, { title: 'us-west',`
- **Line 313**: `x: [1.5, 2.5, 3.5, 4.5],`
- **Line 314**: `y: [2, 4, 9, 8],`
- **Line 315**: `style: {point: 'yellow', marker: '+'}`
- **Line 316**: `}]`
- **Line 317**: ``
- **Line 318**: `};`

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
- **Line 121**: `return {percent: 10};`

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

#### lib/widget/markdown.js

- **Line 44**: `for (var st in options.style) {`
- **Line 45**: `if (typeof(options.style[st])!='string') continue;`
- **Line 46**: ``
- **Line 47**: `var tokens = options.style[st].split('.');`
- **Line 48**: `options.style[st] = chalk;`
- **Line 49**: `for (var j=1; j<tokens.length; j++) {`
- **Line 50**: `options.style[st] = options.style[st][tokens[j]];`
- **Line 51**: `}`
- **Line 52**: `}`
- **Line 56**: `return {`
- **Line 57**: `markdown: 'string',`
- **Line 58**: `markdownStyle: 'object'`
- **Line 59**: `};`

#### lib/widget/picture.js

- **Line 33**: `options.stream.pipe(tube);`
- **Line 61**: ``
- **Line 62**: `return { base64:'AAAA'`
- **Line 63**: `, cols: 1 };`
- **Line 64**: ``

#### lib/widget/sparkline.js

- **Line 39**: `res += titles[i]+':\r\n';`
- **Line 40**: `}`
- **Line 48**: `return { label: 'Sparkline'`
- **Line 49**: `, tags: true`
- **Line 50**: `, border: {type: 'line', fg: 'cyan'}`
- **Line 51**: `, width: '50%'`
- **Line 52**: `, height: '50%'`
- **Line 53**: `, style: { fg: 'blue' }`
- **Line 54**: `, data: { titles: [ 'Sparkline1', 'Sparkline2'],`
- **Line 55**: `data: [ [10, 20, 30, 20, 50, 70, 60, 30, 35, 38]`
- **Line 56**: `, [40, 10, 40, 50, 20, 30, 20, 20, 19, 40] ]`
- **Line 57**: `}`
- **Line 58**: `};`

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
- **Line 112**: `var numCols = table.headers ? table.headers.length : 0;`
- **Line 113**: `for (var i = 0; i < numCols; i++) {`
- **Line 114**: `var maxWidth = stripAnsi(table.headers[i].toString()).length;`
- **Line 115**: `if (table.data) {`
- **Line 116**: `table.data.forEach(function(row) {`
- **Line 117**: `if (row[i]) {`
- **Line 118**: `var cellWidth = stripAnsi(row[i].toString()).length;`
- **Line 119**: `if (cellWidth > maxWidth) maxWidth = cellWidth;`
- **Line 120**: `}`
- **Line 121**: `});`
- **Line 122**: `}`
- **Line 123**: `calculatedColumnWidths[i] = maxWidth;`
- **Line 124**: `}`
- **Line 125**: `}`
- **Line 166**: `spaceLength = 0;`
- **Line 167**: `}`
- **Line 185**: `return  { keys: true`
- **Line 186**: `, fg: 'white'`
- **Line 187**: `, interactive: false`
- **Line 188**: `, label: 'Active Processes'`
- **Line 189**: `, width: '30%'`
- **Line 190**: `, height: '30%'`
- **Line 191**: `, border: {type: 'line', fg: 'cyan'}`
- **Line 192**: `, columnSpacing: 10`
- **Line 193**: `, columnWidth: [16, 12]`
- **Line 194**: `, data: { headers: ['col1', 'col2']`
- **Line 195**: `, data: [ ['a', 'b']`
- **Line 196**: `, ['5', 'u']`
- **Line 197**: `, ['x', '16.1'] ]}`
- **Line 198**: `};`

#### lib/widget/tree.js

- **Line 49**: `var selectedNode = self.nodeLines[this.getItemIndex(this.selected)];`
- **Line 50**: `if (selectedNode.children) {`
- **Line 51**: `selectedNode.extended = !selectedNode.extended;`
- **Line 52**: `self.setData(self.data);`
- **Line 53**: `self.screen.render();`
- **Line 54**: `}`
- **Line 55**: ``
- **Line 56**: `self.emit('select', selectedNode, this.getItemIndex(this.selected));`
- **Line 121**: `treePrefix += '┬';`
- **Line 122**: `suffix = this.options.template.retract;`

---

## Missing Branch/Function Coverage

Files with 100% line coverage but missing branch or function coverage.

*No files in this category.*

---

## Fully Covered Files

Files with 100% coverage across all metrics.

*No files have 100% coverage across all metrics.*

---

*Generated: 2026-02-02T17:16:08.776Z*
