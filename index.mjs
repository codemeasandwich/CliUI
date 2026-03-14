import galactica from './index.js';

// Layout exports
export const {
  grid,
  createComputedGrid,
  carousel,
  createPageFactory,
  createDashboardCarousel,
  createChrome,
  computePageLayout,
  GRID_COORD_MAP
} = galactica;

// Widgets exports
export const {
  map,
  canvas,
  gauge,
  gaugeList,
  lcd,
  donut,
  log,
  picture,
  sparkline,
  table,
  tree,
  markdown
} = galactica;

// Charts exports
export const {
  bar,
  stackedBar,
  line,
  scatter
} = galactica;

// Border exports
export const {
  charsets
} = galactica;

// Uncategorized exports
export const {
  renderCutoutBody,
  intersection,
  scrollbarGlyphs
} = galactica;

// Server Utils exports
export const {
  OutputBuffer,
  InputBuffer,
  createScreen,
  serverError,
  wrapScreenRender,
  resolveTTYOutput,
  resolveTTYInput,
  ensureRawMode,
  resolveTerminalIO
} = galactica;

// Utils exports
export const {
  displayWidth
} = galactica;

// Blessed core exports
export const {
  program,
  Program,
  tput,
  Tput,
  widget,
  colors,
  unicode,
  helpers
} = galactica;

// Blessed widget classes (PascalCase)
export const {
  Node,
  Screen,
  Element,
  Box,
  Text,
  Line,
  ScrollableBox,
  ScrollableText,
  BigText,
  List,
  Form,
  Input,
  Textarea,
  Textbox,
  Button,
  ProgressBar,
  FileManager,
  Checkbox,
  RadioSet,
  RadioButton,
  Prompt,
  Question,
  Message,
  Loading,
  Listbar,
  Log,
  Table,
  ListTable,
  Terminal,
  Image,
  ANSIImage,
  OverlayImage,
  Video,
  Layout
} = galactica;

// Blessed widget factory functions (lowercase)
export const {
  node,
  screen,
  element,
  box,
  text,
  scrollablebox,
  scrollabletext,
  bigtext,
  list,
  form,
  input,
  textarea,
  textbox,
  button,
  progressbar,
  filemanager,
  checkbox,
  radioset,
  radiobutton,
  prompt,
  question,
  message,
  loading,
  listbar,
  listtable,
  terminal,
  image,
  ansiimage,
  overlayimage,
  video,
  layout
} = galactica;

// Blessed aliases
export const { ListBar, PNG } = galactica;

// Default export
export default galactica;
