import { isBoardColor } from './colour'
import { clamp } from './geometry'
import { isPaper } from './grid'
import type { Paper } from './grid'
import type { Rect, View } from './types'

/**
 * Two kinds of board:
 *  - notebook: a stack of fixed 16:9 sheets (PAGE_W × PAGE_H world units per screen). A sheet always
 *    fills the screen at one fixed size: no zooming, no panning, nothing beyond its edges. It can be
 *    lengthened a screen at a time ("more space below"), which only scrolls up and down.
 *  - canvas: one endless board, free to pan and zoom, with no pages. Sheet-sized frames can be placed
 *    on it and stepped through like slides; that is where the canvas and pagination meet.
 */
export type BoardKind = 'notebook' | 'canvas'
export const isBoardKind = (v: unknown): v is BoardKind => v === 'notebook' || v === 'canvas'
export const PAGE_W = 1600
export const PAGE_H = 900
export const MAX_EXTENT = 8

/** Top-left of the sheet in world units and its height in screens. */
export interface Frame { x: number; y: number; extent: number }

export const DEFAULT_FRAME: Frame = { x: 0, y: 0, extent: 1 }
export const isDefaultFrame = (f: Frame): boolean => f.x === 0 && f.y === 0 && f.extent === 1
export const frameRect = (f: Frame): Rect => [f.x, f.y, f.x + PAGE_W, f.y + PAGE_H * f.extent]
export const rectInside = (a: Rect, b: Rect): boolean => a[0] >= b[0] && a[1] >= b[1] && a[2] <= b[2] && a[3] <= b[3]

/** Zoom at which the sheet's width (or one screen of it) exactly fills the viewport. */
export const fitZoom = (w: number, h: number): number => Math.min(w / PAGE_W, h / PAGE_H)

/** A notebook view: the sheet at its one fixed size, only ever scrolled up and down. */
export function clampToFrame(v: View, f: Frame, w: number, h: number): View {
  const zoom = fitZoom(w, h)
  const vw = w / zoom, vh = h / zoom
  const [x0, y0, x1, y1] = frameRect(f)
  const x = vw >= x1 - x0 ? x0 - (vw - (x1 - x0)) / 2 : clamp(v.x, x0, x1 - vw)
  const y = vh >= y1 - y0 ? y0 - (vh - (y1 - y0)) / 2 : clamp(v.y, y0, y1 - vh)
  return { x, y, zoom }
}

/** The sheet at fit zoom, scrolled to `scroll` (0 = top, 1 = bottom). */
export function frameView(f: Frame, w: number, h: number, scroll = 0): View {
  const zoom = fitZoom(w, h)
  const room = PAGE_H * f.extent - h / zoom
  return clampToFrame({ x: f.x, y: f.y + Math.max(0, room) * scroll, zoom }, f, w, h)
}

/** How far down the sheet a view is (0 top … 1 bottom). */
export function scrollOf(v: View, f: Frame, h: number): number {
  const room = PAGE_H * f.extent - h / v.zoom
  return room > 0 ? clamp((v.y - f.y) / room, 0, 1) : 0
}

/**
 * A page drawn on the endless canvas, opened as a sheet: keep the default sheet when the
 * content fits on it, otherwise start the sheet at the content and make it tall enough.
 */
export function frameForContent(b: Rect | null): Frame {
  if (!b) return { ...DEFAULT_FRAME }
  if (b[0] >= 0 && b[1] >= 0 && b[2] <= PAGE_W && b[3] <= PAGE_H) return { ...DEFAULT_FRAME }
  const x = Math.floor(b[0] - 40), y = Math.floor(b[1] - 40)
  return { x, y, extent: clamp(Math.ceil((b[3] + 40 - y) / PAGE_H), 1, MAX_EXTENT) }
}

export function validFrame(v: unknown): Frame | undefined {
  if (!v || typeof v !== 'object') return undefined
  const { x, y, extent } = v as Record<string, unknown>
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e7 || Math.abs(y) > 1e7) return undefined
  if (!Number.isInteger(extent) || (extent as number) < 1 || (extent as number) > MAX_EXTENT) return undefined
  return { x, y, extent: extent as number }
}

/**
 * How a page (or canvas frame) looks and what it is called. Anything left out is inherited:
 * the colour from the lesson, the paper from "plain".
 *  - color: an override of the lesson's board colour for this page only
 *  - origin: where the paper pattern starts, in the same coordinates as the page's ink
 */
export interface PageLook { paper?: Paper; color?: string; title?: string; origin?: [number, number] }

/** A canvas frame: a sheet-sized region with a look of its own. */
export type LookFrame = Frame & PageLook

export const MAX_TITLE = 120

const coord = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e7

/** Only the valid parts of a look survive; the rest is ignored rather than failing the file. */
export function validLook(v: unknown): PageLook {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const look: PageLook = {}
  if (isPaper(o.paper)) look.paper = o.paper
  if (isBoardColor(o.color)) look.color = o.color
  if (typeof o.title === 'string' && o.title.trim()) look.title = o.title.trim().slice(0, MAX_TITLE)
  if (Array.isArray(o.origin) && o.origin.length === 2 && coord(o.origin[0]) && coord(o.origin[1]) && (o.origin[0] !== 0 || o.origin[1] !== 0)) look.origin = [o.origin[0], o.origin[1]]
  return look
}

export function validLookFrame(v: unknown): LookFrame | undefined {
  const frame = validFrame(v)
  return frame && { ...frame, ...validLook(v) }
}

/** The look as plain JSON: only what is set, origin rounded to hundredths. */
export function lookJson(look: PageLook): PageLook {
  const out: PageLook = {}
  if (look.paper) out.paper = look.paper
  if (look.color) out.color = look.color
  if (look.title) out.title = look.title
  if (look.origin && (look.origin[0] || look.origin[1])) out.origin = [Math.round(look.origin[0] * 100) / 100, Math.round(look.origin[1] * 100) / 100]
  return out
}

export const hasLook = (look: PageLook): boolean => Object.keys(lookJson(look)).some(k => k !== 'paper') || (!!look.paper && look.paper !== 'none')
