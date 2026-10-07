import { boundsOfPoints, rectContains, rectsHit, segDistSq } from './geometry'
import { itemBounds, rotatePoint, shapePolylines } from './items'
import { pointInPolygon } from './transforms'
import type { Item, Rect } from './types'

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
export type SelectionHandle = ResizeHandle | 'rotate'
export const HANDLE_ORDER: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

/** Grip locations stay a fixed visual distance from one another at every zoom. */
export function selectionHandles(bounds: Rect, zoom: number): Record<SelectionHandle, [number, number]> {
  const [x0, y0, x1, y1] = bounds, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  return { nw: [x0, y0], n: [cx, y0], ne: [x1, y0], e: [x1, cy], se: [x1, y1], s: [cx, y1], sw: [x0, y1], w: [x0, cy], rotate: [cx, y0 - 28 / zoom] }
}

export function pickSelectionHandle(bounds: Rect, zoom: number, x: number, y: number, touch = false): SelectionHandle | null {
  const handles = selectionHandles(bounds, zoom), radius = (touch ? 14 : 9) / zoom
  // Prefer corners to edge grips when a very small selection makes them overlap.
  for (const key of ['rotate', 'nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'] as SelectionHandle[]) {
    if (Math.hypot(handles[key][0] - x, handles[key][1] - y) <= radius) return key
  }
  return null
}

export function handleCursor(handle: SelectionHandle): string {
  if (handle === 'rotate') return 'grab'
  if (handle === 'n' || handle === 's') return 'ns-resize'
  if (handle === 'e' || handle === 'w') return 'ew-resize'
  return handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize'
}

/** Positive scales avoid accidental flips when a pointer crosses the opposite edge. */
export function resizeSelection(bounds: Rect, handle: ResizeHandle, dx: number, dy: number, uniform: boolean): { anchor: [number, number]; sx: number; sy: number } {
  const [x0, y0, x1, y1] = bounds, width = Math.max(1e-6, x1 - x0), height = Math.max(1e-6, y1 - y0)
  const horizontal = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0
  const vertical = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0
  const anchor: [number, number] = [horizontal > 0 ? x0 : horizontal < 0 ? x1 : (x0 + x1) / 2, vertical > 0 ? y0 : vertical < 0 ? y1 : (y0 + y1) / 2]
  let sx = horizontal ? 1 + dx * horizontal / width : 1
  let sy = vertical ? 1 + dy * vertical / height : 1
  if (uniform) {
    // A least-squares projection onto the original diagonal avoids jumps near its axes.
    const scale = horizontal && vertical ? 1 + (dx * horizontal * width + dy * vertical * height) / (width * width + height * height) : horizontal ? sx : sy
    sx = sy = Math.max(0.02, Math.min(100, scale))
  } else {
    sx = Math.max(0.02, Math.min(100, sx))
    sy = Math.max(0.02, Math.min(100, sy))
  }
  return { anchor, sx, sy }
}

function segmentsMeet(a: [number, number], b: [number, number], c: [number, number], d: [number, number]): boolean {
  const cross = (p: [number, number], q: [number, number], r: [number, number]): number => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
  const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b)
  if (((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))) return true
  return segDistSq(...a, ...c, ...d) < 1e-10 || segDistSq(...b, ...c, ...d) < 1e-10 || segDistSq(...c, ...a, ...b) < 1e-10 || segDistSq(...d, ...a, ...b) < 1e-10
}

/** Select actual object geometry, avoiding empty space inside a long stroke's bounds. */
export function itemInLasso(item: Item, polygon: [number, number][]): boolean {
  if (polygon.length < 3 || !rectsHit(itemBounds(item), boundsOfPoints(polygon))) return false
  let paths: [number, number][][]
  if (item.t === 's') {
    const points: [number, number][] = []
    for (let i = 0; i < item.p.length; i += 3) points.push([item.p[i], item.p[i + 1]])
    paths = [points]
  } else {
    const cx = (item.p[0] + item.p[2]) / 2, cy = (item.p[1] + item.p[3]) / 2
    const polylines = item.t === 'h' ? shapePolylines(item) : [[item.p[0], item.p[1], item.p[2], item.p[1], item.p[2], item.p[3], item.p[0], item.p[3], item.p[0], item.p[1]]]
    paths = polylines.map(path => {
      const points: [number, number][] = []
      for (let i = 0; i < path.length; i += 2) points.push(rotatePoint(path[i], path[i + 1], cx, cy, item.angle ?? 0))
      return points
    })
  }
  for (const path of paths) {
    if (path.some(([x, y]) => pointInPolygon(x, y, polygon))) return true
    for (let i = 1; i < path.length; i++) {
      for (let j = 0; j < polygon.length; j++) if (segmentsMeet(path[i - 1], path[i], polygon[j], polygon[(j + 1) % polygon.length])) return true
    }
  }
  // A lasso entirely inside a closed object selects that object as well.
  const closed = item.t === 't' || (item.t === 'h' && item.k !== 'line' && item.k !== 'arrow')
  return closed && paths.some(path => polygon.some(([x, y]) => pointInPolygon(x, y, path)))
}

export function insideSelection(bounds: Rect | null, x: number, y: number): boolean {
  return !!bounds && rectContains(bounds, x, y)
}
