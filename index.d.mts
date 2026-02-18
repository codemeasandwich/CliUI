import type * as Blessed from 'blessed';
import type Galactica from './index.js';

// Re-export namespace types
export type { Galactica };
export type Widgets = typeof Galactica.Widgets;
export type widget = typeof Galactica.widget;

// Galactica widget factory functions
export declare const grid: typeof Galactica.grid;
export declare const line: typeof Galactica.line;
export declare const scatter: typeof Galactica.scatter;
export declare const bar: typeof Galactica.bar;
export declare const stackedBar: typeof Galactica.stackedBar;
export declare const canvas: typeof Galactica.canvas;
export declare const tree: typeof Galactica.tree;
export declare const table: typeof Galactica.table;
export declare const picture: typeof Galactica.picture;
export declare const markdown: typeof Galactica.markdown;
export declare const sparkline: typeof Galactica.sparkline;
export declare const map: typeof Galactica.map;
export declare const log: typeof Galactica.log;
export declare const lcd: typeof Galactica.lcd;
export declare const gauge: typeof Galactica.gauge;
export declare const gaugeList: typeof Galactica.gaugeList;
export declare const donut: typeof Galactica.donut;
export declare const carousel: (options?: any) => any;

// Server utilities
export declare const OutputBuffer: new (options: any) => any;
export declare const InputBuffer: new () => any;
export declare const createScreen: (req: any, res: any) => Blessed.Widgets.Screen | null;
export declare const serverError: (req: any, res: any, err: any) => boolean;

// Blessed core exports
export declare const program: typeof Blessed.program;
export declare const Program: typeof Blessed.Program;
export declare const tput: typeof Blessed.tput;
export declare const Tput: typeof Blessed.Tput;
export declare const colors: typeof Blessed.colors;
export declare const unicode: typeof Blessed.unicode;
export declare const helpers: typeof Blessed.helpers;

// Blessed widget classes
export declare const Node: typeof Blessed.Widgets.Node;
export declare const Screen: typeof Blessed.Widgets.Screen;
export declare const Element: typeof Blessed.Widgets.BlessedElement;
export declare const Box: typeof Blessed.Widgets.BoxElement;
export declare const Text: typeof Blessed.Widgets.TextElement;
export declare const Line: typeof Blessed.Widgets.LineElement;
export declare const ScrollableBox: typeof Blessed.Widgets.ScrollableBoxElement;
export declare const ScrollableText: typeof Blessed.Widgets.ScrollableTextElement;
export declare const BigText: typeof Blessed.Widgets.BigTextElement;
export declare const List: typeof Blessed.Widgets.ListElement;
export declare const Form: typeof Blessed.Widgets.FormElement;
export declare const Input: typeof Blessed.Widgets.InputElement;
export declare const Textarea: typeof Blessed.Widgets.TextareaElement;
export declare const Textbox: typeof Blessed.Widgets.TextboxElement;
export declare const Button: typeof Blessed.Widgets.ButtonElement;
export declare const ProgressBar: typeof Blessed.Widgets.ProgressBarElement;
export declare const FileManager: typeof Blessed.Widgets.FileManagerElement;
export declare const Checkbox: typeof Blessed.Widgets.CheckboxElement;
export declare const RadioSet: typeof Blessed.Widgets.RadioSetElement;
export declare const RadioButton: typeof Blessed.Widgets.RadioButtonElement;
export declare const Prompt: typeof Blessed.Widgets.PromptElement;
export declare const Question: typeof Blessed.Widgets.QuestionElement;
export declare const Message: typeof Blessed.Widgets.MessageElement;
export declare const Loading: typeof Blessed.Widgets.LoadingElement;
export declare const Listbar: typeof Blessed.Widgets.ListbarElement;
export declare const Log: typeof Blessed.Widgets.Log;
export declare const Table: typeof Blessed.Widgets.TableElement;
export declare const ListTable: typeof Blessed.Widgets.ListTableElement;
export declare const Terminal: typeof Blessed.Widgets.TerminalElement;
export declare const Image: typeof Blessed.Widgets.ImageElement;
export declare const ANSIImage: typeof Blessed.Widgets.ANSIImageElement;
export declare const OverlayImage: typeof Blessed.Widgets.OverlayImageElement;
export declare const Video: typeof Blessed.Widgets.VideoElement;
export declare const Layout: typeof Blessed.Widgets.LayoutElement;

// Blessed widget factory functions (lowercase)
export declare const screen: typeof Blessed.screen;
export declare const box: typeof Blessed.box;
export declare const text: typeof Blessed.text;
export declare const list: typeof Blessed.list;
export declare const form: typeof Blessed.form;
export declare const input: typeof Blessed.input;
export declare const textarea: typeof Blessed.textarea;
export declare const textbox: typeof Blessed.textbox;
export declare const button: typeof Blessed.button;
export declare const progressbar: typeof Blessed.progressbar;
export declare const filemanager: typeof Blessed.filemanager;
export declare const checkbox: typeof Blessed.checkbox;
export declare const radioset: typeof Blessed.radioset;
export declare const radiobutton: typeof Blessed.radiobutton;
export declare const prompt: typeof Blessed.prompt;
export declare const question: typeof Blessed.question;
export declare const message: typeof Blessed.message;
export declare const loading: typeof Blessed.loading;
export declare const listbar: typeof Blessed.listbar;
export declare const listtable: typeof Blessed.listtable;
export declare const terminal: typeof Blessed.terminal;
export declare const image: typeof Blessed.image;
export declare const ansiimage: typeof Blessed.ansiimage;
export declare const overlayimage: typeof Blessed.overlayimage;
export declare const video: typeof Blessed.video;
export declare const layout: typeof Blessed.layout;
export declare const scrollablebox: typeof Blessed.scrollablebox;
export declare const scrollabletext: typeof Blessed.scrollabletext;
export declare const bigtext: typeof Blessed.bigtext;
export declare const element: any;
export declare const node: any;

// Aliases
export declare const ListBar: typeof Blessed.Widgets.ListbarElement;
export declare const PNG: typeof Blessed.Widgets.ANSIImageElement;

// Default export
declare const _default: typeof Galactica;
export default _default;
