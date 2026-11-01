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

export interface ObjectMeta {
  group?: string
  locked?: boolean
  opacity?: number
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

export type Item = StrokeItem | ShapeItem | TextItem | LabItem | ImageItem | GraphItem
export type BoxItem = TextItem | LabItem | ImageItem | GraphItem

/** Objects whose geometry is just their rectangle. */
export const isBox = (it: Item): it is BoxItem => it.t === 't' || it.t === 'l' || it.t === 'i' || it.t === 'g'

export const MARKER_ALPHA = 0.4

let counter = 0
export function newId(): string {
  counter = (counter + 1) % 1_000_000
  return Date.now().toString(36) + counter.toString(36) + Math.random().toString(36).slice(2, 6)
}
