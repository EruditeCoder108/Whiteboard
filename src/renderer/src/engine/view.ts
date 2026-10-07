import { clamp } from './geometry'
import type { Rect, View } from './types'

export const MIN_ZOOM = 0.05
export const MAX_ZOOM = 16

export const toWorld = (v: View, sx: number, sy: number): [number, number] => [
  v.x + sx / v.zoom,
  v.y + sy / v.zoom
]

export const toScreen = (v: View, wx: number, wy: number): [number, number] => [
  (wx - v.x) * v.zoom,
  (wy - v.y) * v.zoom
]

/** Zoom by `factor`, keeping the world point under screen (sx, sy) fixed. */
export function zoomAt(v: View, factor: number, sx: number, sy: number): View {
  const z = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM)
  if (z === v.zoom) return v
  const wx = v.x + sx / v.zoom
  const wy = v.y + sy / v.zoom
  return { x: wx - sx / z, y: wy - sy / z, zoom: z }
}

export function panBy(v: View, dsx: number, dsy: number): View {
  return { x: v.x - dsx / v.zoom, y: v.y - dsy / v.zoom, zoom: v.zoom }
}

/** View that shows `r` centred in a `w`×`h` viewport with padding. */
export function fitRect(r: Rect, w: number, h: number, pad = 80, maxZoom = 2): View {
  const bw = Math.max(r[2] - r[0], 1)
  const bh = Math.max(r[3] - r[1], 1)
  const z = clamp(Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh), MIN_ZOOM, maxZoom)
  const cx = (r[0] + r[2]) / 2
  const cy = (r[1] + r[3]) / 2
  return { x: cx - w / 2 / z, y: cy - h / 2 / z, zoom: z }
}

/** View with the same centre as `v` but a different zoom. */
export function zoomAboutCentre(v: View, zoom: number, w: number, h: number): View {
  const z = clamp(zoom, MIN_ZOOM, MAX_ZOOM)
  const cx = v.x + w / 2 / v.zoom
  const cy = v.y + h / 2 / v.zoom
  return { x: cx - w / 2 / z, y: cy - h / 2 / z, zoom: z }
}

export function visibleWorldRect(v: View, w: number, h: number): Rect {
  return [v.x, v.y, v.x + w / v.zoom, v.y + h / v.zoom]
}
