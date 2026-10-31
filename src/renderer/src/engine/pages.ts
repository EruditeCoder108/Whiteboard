import { clamp } from './geometry'
import type { Rect, View } from './types'
import { MAX_ZOOM } from './view'

/**
 * Page mode: every page is a fixed 16:9 sheet (PAGE_W × PAGE_H world units per screen) that can
 * be extended downward a screen at a time. The view always fills the screen with the sheet:
 * zooming in is allowed, zooming out past "whole width" and panning off the sheet are not, so a
 * teacher can never get lost. Canvas mode leaves the view free (the endless board).
 */
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

/** Keep a view on the sheet: no smaller than the fit, and never showing beyond its edges. */
export function clampToFrame(v: View, f: Frame, w: number, h: number): View {
  const zoom = clamp(v.zoom, fitZoom(w, h), MAX_ZOOM)
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
