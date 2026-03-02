// Merge blessed core into main export for unified API
var blessed = require('./lib/blessed')
Object.keys(blessed).forEach(function(key) {
  exports[key] = blessed[key]
})

exports.grid = require('./lib/layout/grid')
exports.createComputedGrid = require('./lib/layout/computed-grid')
exports.carousel = require('./lib/layout/carousel')
exports.createPageFactory = require('./lib/layout/page-factory')
exports.createDashboardCarousel = require('./lib/layout/dashboard-carousel')
exports.createChrome = require('./lib/layout/chrome')

exports.map = require('./lib/widget/map')
exports.canvas = require('./lib/widget/canvas')

exports.gauge = require('./lib/widget/gauge.js')
exports.gaugeList = require('./lib/widget/gauge-list.js')

exports.lcd = require('./lib/widget/lcd.js')
exports.donut = require('./lib/widget/donut.js')
exports.log = require('./lib/widget/log.js')
exports.picture = require('./lib/widget/picture.js')
exports.sparkline = require('./lib/widget/sparkline.js')
exports.table = require('./lib/widget/table.js')
exports.tree = require('./lib/widget/tree.js')
exports.markdown = require('./lib/widget/markdown.js')

exports.bar = require('./lib/widget/charts/bar')
exports.stackedBar = require('./lib/widget/charts/stacked-bar')
exports.line = require('./lib/widget/charts/line')
exports.scatter = require('./lib/widget/charts/scatter')

exports.charsets = require('./lib/border/charsets');
require('./lib/border/cutout'); // patches Element.prototype on import

exports.OutputBuffer = require('./lib/server-utils').OutputBuffer
exports.InputBuffer = require('./lib/server-utils').InputBuffer
exports.createScreen = require('./lib/server-utils').createScreen
exports.serverError = require('./lib/server-utils').serverError
exports.wrapScreenRender = require('./lib/utils/safe-render')
exports.resolveTTYOutput = require('./lib/utils/tty-resolve').resolveTTYOutput
exports.resolveTTYInput = require('./lib/utils/tty-resolve').resolveTTYInput
exports.ensureRawMode = require('./lib/utils/tty-resolve').ensureRawMode
exports.resolveTerminalIO = require('./lib/utils/tty-resolve').resolveTerminalIO

// Display-width utility — combining character detection, cell width, display width
exports.displayWidth = require('./lib/utils/display-width')

// Slot-layout utility — fixed-width padding, field joining, proportional scaling
var slotLayout = require('./lib/utils/slot-layout')
exports.fitToWidth = slotLayout.fitToWidth
exports.joinFields = slotLayout.joinFields
exports.scaleWidths = slotLayout.scaleWidths
exports.renderSlotRow = slotLayout.renderSlotRow
exports.buildFieldRow = slotLayout.buildFieldRow

// Layout computation — proportional page layout engine
exports.computePageLayout = require('./lib/layout/page-compute').computePageLayout
exports.GRID_COORD_MAP = require('./lib/layout/page-compute').GRID_COORD_MAP
