/** Core data model. Items are immutable – "editing" an item means replacing it. */

/** x0, y0, x1, y1 */
export type Rect = [number, number, number, number]

export interface View {
  /** world coordinates of the viewport's top-left corner */
  x: number
  y: number
  zoom: number
}

export type ShapeKind = 'line' | 'arrow' | 'rect' | 'ellipse' | 'diamond' | 'triangle'

/** A prepared reveal: the object stays hidden in class until this step (see reveals.ts). */
export interface RevealStep {
  n: number
  name?: string
  shown?: boolean
  /** while hidden, a card to tap stands in its place */
  cover?: boolean
}

export interface ObjectMeta {
  group?: string
  locked?: boolean
  opacity?: number
  step?: RevealStep
  /** a web address the object opens (see objects.ts) */
  link?: string
}

export interface TextStyle {
  text?: string
  fontSize?: number
  bold?: boolean
  italic?: boolean
  align?: 'left' | 'center' | 'right'
  list?: 'none' | 'bullet' | 'number'
  textColor?: string
}

/** How a pen stroke looks (see ink.ts); no style is the plain pen. */
export type PenStyle = 'pencil' | 'brush' | 'chalk' | 'felt'
export const PEN_STYLES: PenStyle[] = ['pencil', 'brush', 'chalk', 'felt']

/** A freehand stroke (pen or highlighter). `p` is flat: x, y, pressure, x, y, pressure … */
export interface StrokeItem extends ObjectMeta {
  t: 's'
  id: string
  /** colour, #rrggbb */
  c: string
  /** brush size in world units */
  w: number
  /** highlighter (translucent) */
  m: boolean
  /** width follows pressure */
  v: boolean
  style?: PenStyle
  p: number[]
}

/** What one end of an arrow or line holds on to: another object, and on a picture the spot on it (fractions of its size). */
export interface Anchor { id: string; at?: [number, number] }

export interface ShapeItem extends ObjectMeta, TextStyle {
  t: 'h'
  id: string
  c: string
  w: number
  k: ShapeKind
  /** x0, y0, x1, y1 */
  p: [number, number, number, number]
  angle?: number
  fill?: string
  dash?: 'solid' | 'dashed' | 'dotted'
  radius?: number
  /** arrows and lines: the objects their ends are attached to (see connectors.ts) */
  from?: Anchor
  to?: Anchor
  /** arrows and lines: square corners instead of a straight run, leaving sideways (h) or up and down (v) */
  elbow?: 'h' | 'v'
}

export interface TextItem extends ObjectMeta, TextStyle {
  t: 't'
  id: string
  c: string
  w: number
  p: Rect
  text: string
  fontSize: number
  note: boolean
  fill?: string
  angle?: number
}

export type EditableItem = ShapeItem | TextItem
  export interface MagnetSample { t: number; x: number }
  export interface LabItem extends ObjectMeta {
  t: 'l'
  id: string
  c: string
  w: number
  p: Rect
  angle?: number
  labVersion: number
  model: string
  modelVersion: number
  params: Record<string, number>
    gesture?: MagnetSample[]
  frozenTime: number
  theme: 'paper' | 'blueprint'
  reveal: LabReveal
}
export interface LabReveal {
  trajectory: boolean
  vectors: boolean
  graphs: boolean
  energy: boolean
  strobes: boolean
  equations: boolean
  compare: boolean
}
/** A picture: pasted/imported image, PDF page, or typeset equation (`latex` set, SVG source). */
export interface ImageItem extends ObjectMeta {
  t: 'i'
  id: string
  c: string
  w: number
  p: Rect
  angle?: number
  /** data URL (png, jpeg, webp or svg+xml) */
  src: string
  /** natural width / height, kept when resizing */
  aspect: number
  latex?: string
  /** mirrored left to right, or upside down */
  flipX?: boolean
  flipY?: boolean
}

/** A function plot drawn as vectors at every zoom. */
export interface GraphItem extends ObjectMeta {
  t: 'g'
  id: string
  c: string
  w: number
  p: Rect
  angle?: number
  /** expressions in x, e.g. "sin(x)", "x^2 - 2" */
  fns: string[]
  xr: [number, number]
  yr: [number, number]
}

/** One axis of a number line or coordinate axes: its range, tick step, optional name and unit (see scale.ts). */
export interface ScaleAxis {
  min: number
  max: number
  step: number
  /** label the ticks as fractions over this */
  den?: number
  name?: string
}

/** A number line (no `y`) or coordinate axes, drawn as vectors, with points marked by value. */
export interface ScaleItem extends ObjectMeta {
  t: 'n'
  id: string
  c: string
  w: number
  p: Rect
  angle?: number
  x: ScaleAxis
  y?: ScaleAxis
  grid?: boolean
  /** one unit is the same length both ways */
  equal?: boolean
  points?: [number, number][]
  /** write each point's value next to it */
  coords?: boolean
}

/** A table of typed text. `cols` and `rows` are shares of its width and height, each adding up to 1 (see table.ts). */
export interface TableItem extends ObjectMeta {
  t: 'b'
  id: string
  /** its lines */
  c: string
  w: number
  p: Rect
  angle?: number
  cols: number[]
  rows: number[]
  /** rows × columns */
  cells: string[][]
  fontSize: number
  textColor?: string
  /** the first row is a heading row */
  head?: boolean
}

/** A video or audio clip kept in the lesson. On the page it is a picture with a play button (see clip.ts). */
export interface ClipItem extends ObjectMeta {
  t: 'm'
  id: string
  c: string
  w: number
  p: Rect
  angle?: number
  kind: 'video' | 'audio'
  src: string
  name: string
  poster?: string
  aspect: number
}

export type Item = StrokeItem | ShapeItem | TextItem | LabItem | ImageItem | GraphItem | ScaleItem | TableItem | ClipItem
export type BoxItem = TextItem | LabItem | ImageItem | GraphItem | ScaleItem | TableItem | ClipItem

/** Objects whose geometry is just their rectangle. */
export const isBox = (it: Item): it is BoxItem => it.t === 't' || it.t === 'l' || it.t === 'i' || it.t === 'g' || it.t === 'n' || it.t === 'b' || it.t === 'm'

export const MARKER_ALPHA = 0.4

let counter = 0
export function newId(): string {
  counter = (counter + 1) % 1_000_000
  return Date.now().toString(36) + counter.toString(36) + Math.random().toString(36).slice(2, 6)
}
