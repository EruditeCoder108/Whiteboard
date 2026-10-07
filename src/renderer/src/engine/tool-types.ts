import type { Doc, EditOp } from './doc'
import type { Item, Rect, View } from './types'

/** A normalised pointer sample.  x/y are CSS px relative to the stage. */
export interface Ptr {
  id: number
  type: 'mouse' | 'pen' | 'touch'
  x: number
  y: number
  wx: number
  wy: number
  pressure: number
  buttons: number
  shift: boolean
  alt: boolean
  ctrl: boolean
  /** seconds (monotonic) */
  t: number
}

/** What a tool may ask of the board. */
export interface ToolHost {
  readonly doc: Doc
  readonly view: View
  readonly selection: Item[]
  setSelection(items: Item[]): void
  /** push an already-applied edit onto the undo stack */
  commit(op: EditOp | null): void
  /** add an item, record it for undo and paint it incrementally */
  commitAdd(it: Item, timing?: import('./replay').InkTiming): void
  /** repaint a world-space region of the committed layer (null = everything) */
  refresh(region: Rect | null): void
  requestOverlay(): void
  /** items hidden from the committed layer (the tool paints them itself) */
  setExcluded(items: Iterable<Item>): void
  panBy(dsx: number, dsy: number): void
  toWorld(sx: number, sy: number): [number, number]
  /** run `fn` with the world→screen transform applied */
  withWorld(ctx: CanvasRenderingContext2D, fn: () => void): void
  pruneSelection(): void
  createText(wx: number, wy: number, note?: boolean): void
  fitItem(it: Item): Item
}

export interface Tool {
  readonly name: string
  /** the tool wants the press-and-hold radial menu */
  readonly allowsRadial: boolean
  /** needs overlay frames even when idle (laser trail) */
  readonly animating: boolean
  cursor(): string
  down(p: Ptr): void
  move(p: Ptr): void
  up(p: Ptr): void
  /** abort the current gesture and leave the document untouched */
  cancel(): void
  hover?(p: Ptr): void
  leave?(): void
  /** far enough along that a stray second finger must not cancel it */
  underway(): boolean
  paintOverlay?(ctx: CanvasRenderingContext2D): void
}
