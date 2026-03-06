import * as Blessed from 'blessed'
export = Galactica
declare namespace Galactica {

    export type Optionals<T, K extends keyof T> = {
        [P in keyof K]?: T[K]
        }
    export type Picker<T, K extends keyof T> = {
        [P in K]: T[P];
        };


    export module Widgets {
        import IHasOptions = Blessed.Widgets.IHasOptions;
        import BoxOptions = Blessed.Widgets.BoxOptions;
        import ListOptions = Blessed.Widgets.ListOptions;
        import Types = Blessed.Widgets.Types;
        import ListElementStyle = Blessed.Widgets.ListElementStyle;
        import BoxElement = Blessed.Widgets.BoxElement;
        import ListElement = Blessed.Widgets.ListElement;

        export interface GridOptions {

            top?: Types.TTopLeft;
            left?: Types.TTopLeft;
            right?: Types.TPosition;
            bottom?: Types.TPosition;
            rows?: number
            cols?: number
            screen: Blessed.Widgets.Screen
            border?: Blessed.Widgets.Border
            hideBorder?: boolean
        }

        export type WidgetOptions =
            BoxOptions
            | BarOptions
            | StackedBarOptions
            | CanvasOptions
            | TreeOptions
            | TableOptions
            | PictureOptions
            | MarkdownOptions
            | MapOptions
            | SparklineOptions
            | LogOptions
            | LcdOptions
            | GaugeOptions
            | GaugeListOptions
            | DonutOptions
            | ScatterOptions
            | DiagramOptions


        export type WidgetElements = BoxElement
            | BarElement
            | LineElement
            | ScatterElement
            | StackedBarElement
            | CanvasElement
            | TreeElement
            | TableElement
            | PictureElement
            | MarkdownElement
            | MapElement
            | SparklineElement
            | LogElement
            | LcdElement
            | GaugeElement
            | GaugeListElement
            | DonutElement
            | DiagramElement


        export class GridElement extends BoxElement implements IHasOptions<GridOptions> {
            constructor(opts: GridOptions);

            set<T extends (options?: TreeOptions) => S, S extends TreeElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: T, opt: TreeOptions): TreeElement
            set<T extends (options?: TableOptions) => S, S extends TableElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: T, opt: TableOptions): TableElement
            set<T extends (options?: PictureOptions) => S, S extends PictureElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: T, opt: PictureOptions): PictureElement
            set<T extends (options?: MarkdownOptions) => S, S extends MarkdownElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: T, opt: MarkdownOptions): MarkdownElement
            set<T extends (options?: MapOptions) => S, S extends MapElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: T, opt: MapOptions): MapElement
            set<T extends (options?: LogOptions) => S, S extends LogElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: T, opt: LogOptions): LogElement
            set<T extends (options?: LcdOptions) => S, S extends LcdElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: T, opt: LcdOptions): LcdElement
            set<T extends (options?: GaugeOptions) => S, S extends GaugeElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: T, opt: GaugeOptions): GaugeElement
            set<T extends (options?: GaugeListOptions) => S, S extends GaugeListElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: T, opt: GaugeListOptions): GaugeListElement
            set<T extends (options?: DonutOptions) => S, S extends DonutElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: T, opt: DonutOptions): DonutElement

            set<T extends (options?: BarOptions) => S, S extends BarElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: T, opt: BarOptions): BarElement
            set<T extends (options?: LineOptions) => S, S extends LineElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: T, opt: LineOptions): LineElement
            set<T extends (options?: ScatterOptions) => S, S extends ScatterElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: T, opt: ScatterOptions): ScatterElement
            set<T extends (options?: StackedBarOptions) => S, S extends StackedBarElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: T, opt: StackedBarOptions): StackedBarElement
            set<T extends (options?: CanvasOptions) => S, S extends CanvasElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: T, opt: CanvasOptions): CanvasElement


            // set<T extends (options?: WidgetOptions) => S, S extends WidgetElements>(row: number, col: number, rowSpan: number, colSpan: number, obj: T, opt: WidgetOptions): WidgetElements
            set<T, S>(...args:any[]): any

            // set<K extends keyof Factories>(row: number, col: number, rowSpan: number, colSpan: number,
            //     obj: T, opts?: P<T> ): P<T>
            // set<A =BarOptions, T=BarElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: A, opts?: O): T //typeof bar
            // set<A =Line, T=LineElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: A, opts?: O): T //typeof line
            // set<A =StackedBar, T=StackedBarElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: A, opts?: O): T //typeof stackedBar
            // set<A =Canvas, T=CanvasElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: A, opts?: O): T //typeof canvas
            // set<A =Tree, T=TreeElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: A, opts?: O): T //typeof tree
            // set<A =Table, T=TableElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: A, opts?: O): T //typeof table
            // set<A =Picture, T=PictureElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: A, opts?: O): T //typeof picture
            // set<A =Markdown, T=MarkdownElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: A, opts?: O): T //typeof markdown
            // set<A =Map, T=MapElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: A, opts?: O): T //typeof map
            // set<A =Log, T=LogElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: A, opts?: O): T //typeof log
            // set<A =Lcd, T=LcdElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: A, opts?: O): T //typeof lcd
            // set<A =Gauge, T=GaugeElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: A, opts?: O): T //typeof gauge
            // set<A =GaugeList, T=GaugeListElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: A, opts?: O): T //typeof gaugeList
            // set<A =Donut, T=DonutElement>(row: number, col: number, rowSpan: number, colSpan: number, obj: A, opts?: O): T //typeof donut

            options: GridOptions;
        }


        export interface BarData {
            titles?: string[],
            data?: number[]
        }

        export interface BarOptions extends CanvasOptions<BarData> {
            barWidth?: number
            barSpacing?: number
            xOffset?: number
            maxHeight?: number
            showText?: boolean
            barBgColor?: string
            barFgColor?: string
        }


        export class BarElement extends CanvasElement<BarData> implements IHasOptions<BarOptions> {
            constructor(opts: BarOptions);

            setData(data: BarData): void;

            options: BarOptions;
        }


        export interface LineData {
            title?: string
            x?: string[]
            y?: number[]
            style?: {
                line?: string
                text?: string
                baseline?: string
            }
        }

        export interface LineOptions extends CanvasOptions<LineData[]> {
            showNthLabel?: boolean
            style?: {
                line?: string
                text?: string
                baseline?: string
            }
            xLabelPadding?: number
            xPadding?: number
            /** Bottom padding for X-axis labels (default: 11) */
            yPadding?: number
            numYLabels?: number
            legend?: { width: number }
            wholeNumbersOnly?: boolean
            minY?: number
            maxY?: number
            label?: string
        }

        export class LineElement extends CanvasElement<LineData[]> implements IHasOptions<LineOptions> {
            constructor(opts: LineOptions);

            setData(data: LineData[]): void;

            options: LineOptions;
        }

        export interface ScatterData {
            title?: string
            x?: number[]
            y?: number[]
            style?: {
                point?: string
                marker?: 'o' | '+' | 'x' | '*' | '.'
            }
        }

        export interface ScatterOptions extends CanvasOptions<ScatterData[]> {
            style?: {
                point?: string
                text?: string
                baseline?: string
            }
            xLabelPadding?: number
            xPadding?: number
            yPadding?: number
            numYLabels?: number
            numXLabels?: number
            legend?: { width: number }
            wholeNumbersOnly?: boolean
            minX?: number
            maxX?: number
            minY?: number
            maxY?: number
            label?: string
            /** Default marker style: 'o' | '+' | 'x' | '*' | '.' */
            marker?: 'o' | '+' | 'x' | '*' | '.'
        }

        export class ScatterElement extends CanvasElement<ScatterData[]> implements IHasOptions<ScatterOptions> {
            constructor(opts: ScatterOptions);

            setData(data: ScatterData[]): void;

            options: ScatterOptions;
        }

        export interface StackedBarData {
            barCategory?: string[]
            stackedCategory?: string[]
            data?: Array<number[]>
        }

        export interface StackedBarOptions extends CanvasOptions<StackedBarData[]> {

            barWidth?: number
            barSpacing?: number
            xOffset?: number
            maxValue?: number
            barBgColor?: string
            showLegend?: boolean
            legend?: any
            showText?: boolean
        }

        export class StackedBarElement extends CanvasElement<StackedBarData[]> implements IHasOptions<StackedBarOptions> {
            constructor(opts: StackedBarOptions)

            setData(data: StackedBarData): void;

            options: StackedBarOptions;

            addLegend(bars: any, x: number): void;
        }


        export interface CanvasOptions<D extends any=any>  extends BoxOptions {
            canvasSize?: {
                width?: number,
                height?: number
            }
            data?: D
        }

        export class CanvasElement<D extends any=any> extends BoxElement implements IHasOptions<CanvasOptions> {
            constructor(opts: CanvasOptions<D>)

            options: CanvasOptions<D>;

            calcSize(): void;

            clear(): void;

            canvasSize: { width: number, height: number }
        }

        export interface DonutData {
            percent?: string,
            label?: string,
            color?: string
        }

        export interface DonutOptions extends CanvasOptions<DonutData[]> {
            stroke?: string
            fill?: string
            label?: string
            radius?: number
            arcWidth?: number
            spacing?: number
            remainColor?: string
            yPadding?: number


        }

        export class DonutElement extends CanvasElement<DonutData[]> implements IHasOptions<DonutOptions> {
            constructor(opts: DonutOptions)

            setData(data: DonutData[]): void;

            options: DonutOptions;

        }


        export interface GaugeListOptions extends CanvasOptions {
        }

        export class GaugeListElement extends CanvasElement implements IHasOptions<GaugeListOptions> {
            constructor(opts: GaugeListOptions)

            options: GaugeListOptions;
        }


        export interface GaugeOptions extends CanvasOptions {
            percent: number[]
            stroke?: string
            fill?: string
            label?: string
            stack?: any
            showLabel?: boolean
        }

        export class GaugeElement extends CanvasElement implements IHasOptions<GaugeOptions> {
            constructor(opts: GaugeOptions)

            options: GaugeOptions;

            setPercent(number: number): void;

            setStack(stack: Array<{ percent: number, stroke: string }>): void;

            setData(percent: number[]): void;
            setData(percent: number): void;
        }


        export interface LcdOptions extends CanvasOptions {
            segmentWidth?: number// how wide are the segments in % so 50% = 0.5
            segmentInterval?: number// spacing between the segments in % so 50% = 0.550% = 0.5
            strokeWidth?: number// spacing between the segments in % so 50% = 0.5
            elements?: number// how many elements in the display. or how many characters can be displayed.
            display?: number// what should be displayed before first call to setDisplay
            elementSpacing?: number// spacing between each element
            elementPadding?: number// how far away from the edges to put the elements
            color?: string // color for the segments
            label?: string
        }

        export class LcdElement extends CanvasElement implements IHasOptions<LcdOptions> {
            constructor(opts: LcdOptions)

            options: LcdOptions;

            increaseWidth(): void;

            decreaseWidth(): void;

            increaseInterval(): void;

            decreaseInterval(): void;

            increaseStroke(): void;

            decreaseStroke(): void;

            setOptions(options: any): void;

            setDisplay(display: any): void;
        }

        export interface LogOptions extends ListOptions<ListElementStyle> {
            border: Blessed.Widgets.Border
            bufferLength?: number
            logLines?: string[]
            interactive?: boolean
        }

        export class LogElement extends ListElement implements IHasOptions<LogOptions> {
            constructor(opts: LogOptions);

            options: LogOptions;

            log(str: string): boolean;

            emit(str:any): boolean;
        }


        export interface MapMarker {
            lon: string | number;
            lat: string | number;
            color?: string;
            char?: string;
        }

        export interface MapOptions extends CanvasOptions {
            startLon?: number;
            endLon?: number;
            startLat?: number;
            endLat?: number;
            region?: string;
            markers?: MapMarker[];
            excludeAntarctica?: boolean;
            disableBackground?: boolean;
            disableMapBackground?: boolean;
            disableGraticule?: boolean;
            disableFill?: boolean;
            labelSpace?: number;
        }

        export class MapElement extends CanvasElement implements IHasOptions<MapOptions> {
            constructor(opts: MapOptions)

            addMarker(marker: MapMarker): void;

            clearMarkers(): void;

            options: MapOptions;
        }


        export interface SparklineOptions extends CanvasOptions<string[]> {
        }

        export class SparklineElement extends CanvasElement<string[]> implements IHasOptions<SparklineOptions> {
            constructor(opts: CanvasOptions);

            options: SparklineOptions;

            setData(...str: any[]): void;
        }

        export interface MarkdownOptions extends CanvasOptions {
          /** 
           * Markdown text to render.
           */
          markdown?: string;

          markdownStyle?: any;
        }

        export class MarkdownElement extends CanvasElement implements IHasOptions<MarkdownOptions> {
            constructor(opts: MarkdownOptions)

            options: MarkdownOptions;

            setOptions(options: any): void;

            setMarkdown(markdown: string): void;
        }


        export interface PictureOptions extends CanvasOptions {
        }

        export class PictureElement extends CanvasElement implements IHasOptions<PictureOptions> {
            constructor(opts: PictureOptions)

            options: PictureOptions;
        }

        export interface TableData {
            headers?: string[]
            data?: Array<string[]>
        }

        export interface TableOptions extends CanvasOptions<TableData> {
            parent?: any
            bold?: string
            columnSpacing?: number
            /** Column widths as fixed chars (16) or percentages ('25%') */
            columnWidth?: (number | string)[]
            rows?: ListOptions<ListElementStyle>
            selectedFg?: string
            selectedBg?: string
            label?: string
            fg?: string
            bg?: string
            width?: string
            height?: string
            border?: object
            interactive?: string
            mouse?: boolean
            keys?: boolean
            vi?: boolean
        }

        export class TableElement extends CanvasElement<TableData> implements IHasOptions<TableOptions> {
            constructor(opts: TableOptions);

            setData(data: TableData): void;

            focus(): void;

            rows: Blessed.Widgets.ListElement;

            options: TableOptions;
        }


        export interface TreeNode {
            name?: string,
            children?: TreeChildren | ((node: TreeNode) => TreeChildren | Promise<TreeChildren>),
            childrenContent?: TreeChildren,
            extended?: boolean,
            parent?: TreeNode,
            [custom: string]: any
        }

        export type TreeChildren = Record<string, TreeNode>

        export interface TreeOptions extends BoxOptions {
            data?: any
            extended?: boolean
            keys?: string[]
            template?: {
                extend?: string
                retract?: string
                lines?: boolean
            }
        }

        export class TreeElement extends BoxElement implements IHasOptions<TreeOptions> {
            constructor(opts: TreeOptions)

            rows: Blessed.Widgets.ListElement
            nodeLines?: string[]
            lineNbr?: number
            data: any

            options: TreeOptions;

            setData(data: TreeNode): void
        }


    }

    export module widget {

        export class Grid extends Widgets.GridElement {}

        export class Bar extends Widgets.BarElement {}

        export class Line extends Widgets.LineElement {}

        export class Scatter extends Widgets.ScatterElement {}

        export class StackedBar extends Widgets.StackedBarElement {}

        export class Canvas extends Widgets.CanvasElement {}

        export class Tree extends Widgets.TreeElement {}

        export class Table extends Widgets.TableElement {}

        export class Picture extends Widgets.PictureElement {}

        export class Markdown extends Widgets.MarkdownElement {}

        export class Map extends Widgets.MapElement {}

        export class Log extends Widgets.LogElement {}

        export class Lcd extends Widgets.LcdElement {}

        export class Gauge extends Widgets.GaugeElement {}

        export class GaugeList extends Widgets.GaugeListElement {}

        export class Donut extends Widgets.DonutElement {}

        export class Sparkline extends Widgets.SparklineElement {}

    }


    export class grid extends Widgets.GridElement {}

    export function line(options?: Widgets.LineOptions): Widgets.LineElement

    export function scatter(options?: Widgets.ScatterOptions): Widgets.ScatterElement

    export function bar(options?: Widgets.BarOptions): Widgets.BarElement

    export function stackedBar(options?: Widgets.StackedBarOptions): Widgets.StackedBarElement

    export function canvas(options?: Widgets.CanvasOptions): Widgets.CanvasElement

    export function tree(options?: Widgets.TreeOptions): Widgets.TreeElement

    export function table(options?: Widgets.TableOptions): Widgets.TableElement

    export function picture(options?: Widgets.PictureOptions): Widgets.PictureElement

    export function markdown(options?: Widgets.MarkdownOptions): Widgets.MarkdownElement

    export function sparkline(options?: Widgets.SparklineOptions): Widgets.SparklineElement

    export function map(options?: Widgets.MapOptions): Widgets.MapElement

    export function log(options?: Widgets.LogOptions): Widgets.LogElement

    export function lcd(options?: Widgets.LcdOptions): Widgets.LcdElement

    export function gauge(options?: Widgets.GaugeOptions): Widgets.GaugeElement

    export function gaugeList(options?: Widgets.GaugeListOptions): Widgets.GaugeListElement

    export function donut(options?: Widgets.DonutOptions): Widgets.DonutElement

    // ── Display-width utility ─────────────────────────────────────────
    // Character-width detection for combining characters, double-wide CJK/emoji,
    // and terminal cell measurement. Used by chrome.js for combining-char-safe
    // painting and by consumers for display-width calculations.

    export namespace displayWidth {
        /** Check whether a Unicode code point is a combining character (zero-width). */
        function isCombining(cp: number): boolean;
        /** Terminal cell width of a single Unicode code point (0, 1, or 2). */
        function charWidth(cp: number): number;
        /** Terminal display width of a string (total cell columns consumed). */
        function displayWidth(str: string): number;
        /** Slice a string by terminal cell columns, not JavaScript char indices. */
        function sliceCells(str: string, start: number, width: number): string;
    }

    // ── Page layout computation ───────────────────────────────────────
    // Proportional layout engine that computes widget positions for any screen
    // size by scaling from the 120×40 baseline. Returns layout specs consumed
    // by chrome.setLayout / chrome.setPage.

    /** Grid coordinate → widget name mappings per page. Keys are 'row,col,rowSpan,colSpan'. */
    export const GRID_COORD_MAP: {
        [page: string]: { [gridKey: string]: string };
    };

    /** Widget position descriptor returned by computePageLayout. */
    export interface WidgetPosition {
        top: number;
        left: number;
        width: number;
        height: number;
        titleY: number;
        titleX: number;
    }

    /** Separator descriptor for horizontal rules with tee junctions. */
    export interface SeparatorSpec {
        y: number;
        cols: number[];
        dir: 'down' | 'up' | 'heavy';
    }

    /** Vertical divider descriptor between widget columns. */
    export interface DividerSpec {
        col: number;
        fromY: number;
        toY: number;
    }

    /** Full layout specification for a dashboard page. */
    export interface PageLayoutSpec {
        page: string;
        separators: SeparatorSpec[];
        dividers: DividerSpec[];
        widgets: { [name: string]: WidgetPosition };
        staticPipes?: any[] | null;
        statusRow?: number;
        phaseFlow?: any;
    }

    /**
     * Compute the full layout for a dashboard page at the given screen dimensions.
     * At 120×40 returns exact hand-derived baselines; at other sizes uses
     * proportional scaling.
     */
    export function computePageLayout(
        pageName: 'spec' | 'plan' | 'run' | 'task' | 'errors' | 'perf',
        cols: number,
        rows: number
    ): PageLayoutSpec | null;

    // ── Chrome frame ──────────────────────────────────────────────────
    // L-shaped terminal border renderer that paints logo, heavy frame,
    // separators, dividers, footer, and static fixups into screen.lines.

    export interface ChromeOptions {
        /** Up to 2 lines of logo text. Combining characters (U+0300-U+036F) are handled. */
        logo?: string[];
        /** Footer text placed after the ┛ on the bottom row. */
        footer?: string;
        /** L-step column as a fraction of screen width. Default 38/120. */
        stepRatio?: number;
        /** Column width of the logo area. Default 16. */
        logoWidth?: number;
    }

    export interface ChromeInstance {
        /** Borderless full-screen box — parent element for all dashboard widgets. */
        element: Blessed.Widgets.BoxElement;
        /** Set the page-specific layout for separator, divider, and fixup painting. */
        setLayout(spec: PageLayoutSpec): void;
        /** Set the current page by name — internally calls computePageLayout. */
        setPage(pageName: 'spec' | 'plan' | 'run' | 'task' | 'errors' | 'perf'): void;
        /** Get the inner bounds for a cutout zone (e.g. tab bar area). */
        getCutoutInner(position: 'top-right'): { top: number; left: number; width: number; height: number } | null;
        /** No-op — preserved for API compatibility. */
        setCutout(): void;
    }

    /** Create an L-shaped chrome frame for a dashboard screen. */
    export function createChrome(
        screen: Blessed.Widgets.Screen,
        opts: ChromeOptions
    ): ChromeInstance;

    // ── Diagram — Diegetic ASCII diagram editor ────────────────────

    /** Side enum for port placement on a box. */
    export type DiagramSide = 'top' | 'bottom' | 'left' | 'right';

    /** Box state enum. */
    export type DiagramBoxState = 'standard' | 'checked' | 'currentWork';

    /** Label type enum. */
    export type DiagramLabelType = 'line' | 'endpoint' | 'entry';

    /** A segment of an orthogonal connector path. */
    export interface DiagramSegment {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
    }

    /** A box in the diagram model. */
    export interface DiagramBox {
        id: number;
        x: number;
        y: number;
        width: number;
        height: number;
        text: string;
        checked: boolean;
        currentWork: boolean;
    }

    /** A port on a box border. */
    export interface DiagramPort {
        id: number;
        boxId: number;
        side: DiagramSide;
        offset: number;
        connectorIds: number[];
    }

    /** A connector between two ports. */
    export interface DiagramConnector {
        id: number;
        sourcePortId: number;
        destPortId: number;
        segments: DiagramSegment[];
        arrowDir: string | null;
    }

    /** A text label in the diagram. */
    export interface DiagramLabel {
        id: number;
        text: string;
        x: number;
        y: number;
        type: DiagramLabelType;
        anchorId: number | null;
    }

    /** The DiagramModel class — structural truth of a diagram. */
    export class DiagramModel {
        width: number;
        height: number;
        boxes: Map<number, DiagramBox>;
        ports: Map<number, DiagramPort>;
        connectors: Map<number, DiagramConnector>;
        labels: Map<number, DiagramLabel>;
        opaqueBlocks: string[];

        addBox(x: number, y: number, width: number, height: number, text?: string, checked?: boolean, currentWork?: boolean): DiagramBox;
        removeBox(id: number): void;
        moveBox(id: number, x: number, y: number): void;
        resizeBox(id: number, w: number, h: number): void;
        toggleChecked(id: number): void;
        setCurrentWork(id: number, on: boolean): void;
        getBox(id: number): DiagramBox | undefined;
        addPort(boxId: number, side: DiagramSide, offset: number): DiagramPort;
        getPort(id: number): DiagramPort | undefined;
        getPortPosition(portId: number): { x: number; y: number } | null;
        findOrCreatePort(boxId: number, side: DiagramSide, offset: number): DiagramPort;
        addConnector(sourcePortId: number, destPortId: number, arrowDir?: string | null): DiagramConnector;
        removeConnector(id: number): void;
        getConnector(id: number): DiagramConnector | undefined;
        getConnectorsForBox(boxId: number): DiagramConnector[];
        setConnectorSegments(id: number, segs: DiagramSegment[]): void;
        addLabel(type: DiagramLabelType, text: string, x: number, y: number, anchorId?: number | null): DiagramLabel;
        clone(): DiagramModel;
        toJSON(): object;
        static fromJSON(json: object): DiagramModel;
    }

    /** Options for the Diagram widget. */
    export interface DiagramOptions extends Blessed.Widgets.BoxOptions {
        /** Initial ASCII diagram text. */
        source?: string;
        /** Enable mouse interaction (default true). */
        interactive?: boolean;
        /** Enable current-work animation (default true). */
        animate?: boolean;
        /** Alternative data input. */
        data?: string | { source: string };
    }

    /** Diagram widget element. */
    export interface DiagramElement extends Blessed.Widgets.BoxElement {
        setSource(text: string): void;
        getSource(): string;
        setModel(model: DiagramModel): void;
        getModel(): DiagramModel | null;
        parse(text: string): DiagramModel;
        load(text: string): void;
        serialize(): string;
        setData(data: string | { source: string }): void;
        toggleChecked(boxId: number): void;
        startCurrentWork(boxId: number): void;
        stopCurrentWork(boxId: number): void;
        transitionCurrentWork(fromBoxId: number, toBoxId: number, callback?: () => void): void;
        layout(options?: { gapX?: number; gapY?: number; startX?: number; startY?: number }): void;
        route(): void;
    }

    /** Diagram widget constructor. */
    export function diagram(options?: DiagramOptions): DiagramElement;

    /** Parse ASCII text into a DiagramModel. */
    export function parseDiagram(text: string, options?: { mode?: 'strict' | 'lenient' }): DiagramModel;

    /** Render a DiagramModel to canonical ASCII text. */
    export function renderDiagram(model: DiagramModel, options?: { frame?: number; width?: number; height?: number }): string;

}

