import galactica from './index.js';

// Galactica widget exports
export const {
  grid,
  carousel,
  createPageFactory,
  createDashboardCarousel,
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
  markdown,
  bar,
  stackedBar,
  line,
  scatter,
  OutputBuffer,
  InputBuffer,
  createScreen,
  serverError,
  charsets
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
  screen,
  box,
  text,
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
  layout,
  scrollablebox,
  scrollabletext,
  bigtext,
  element,
  node
} = galactica;

// Blessed aliases
export const { ListBar, PNG } = galactica;

// Default export
export default galactica;
