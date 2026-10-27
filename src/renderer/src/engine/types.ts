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
export type Item = StrokeItem | ShapeItem | TextItem | LabItem

export const MARKER_ALPHA = 0.4

let counter = 0
export function newId(): string {
  counter = (counter + 1) % 1_000_000
  return Date.now().toString(36) + counter.toString(36) + Math.random().toString(36).slice(2, 6)
}
