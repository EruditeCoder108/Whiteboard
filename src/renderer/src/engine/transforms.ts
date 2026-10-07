import type { Item, Rect } from './types'
import { rotatePoint } from './items'

/** World-space transform with scale about an anchor followed by rotation and translation. */
export function transformItem(it: Item, anchor: [number, number], sx = 1, sy = 1, angle = 0, dx = 0, dy = 0): Item {
  const point = (x: number, y: number): [number, number] => {
    const p = rotatePoint(anchor[0] + (x - anchor[0]) * sx, anchor[1] + (y - anchor[1]) * sy, ...anchor, angle)
    return [p[0] + dx, p[1] + dy]
  }
  const scale = Math.sqrt(Math.abs(sx * sy))
  const width = scale === 1 ? it.w : Math.max(0.001, Math.min(1000, it.w * scale))
  if (it.t === 's') {
    const p = it.p.slice()
    for (let i = 0; i < p.length; i += 3) [p[i], p[i + 1]] = point(p[i], p[i + 1])
    return { ...it, p, w: width }
  }
  if (it.t === 'h' && (it.k === 'line' || it.k === 'arrow')) {
    const cx = (it.p[0] + it.p[2]) / 2, cy = (it.p[1] + it.p[3]) / 2
    const a = rotatePoint(it.p[0], it.p[1], cx, cy, it.angle ?? 0), b = rotatePoint(it.p[2], it.p[3], cx, cy, it.angle ?? 0)
    return { ...it, p: [...point(...a), ...point(...b)], angle: 0, w: width }
  }
  const center = point((it.p[0] + it.p[2]) / 2, (it.p[1] + it.p[3]) / 2)
  const hw = Math.abs(it.p[2] - it.p[0]) * sx / 2, hh = Math.abs(it.p[3] - it.p[1]) * sy / 2
  const p: Rect = [center[0] - hw, center[1] - hh, center[0] + hw, center[1] + hh]
  // Side handles change wrapping; uniform scaling also scales the lettering.
  const fontScale = Math.abs(sx - sy) < 1e-8 ? scale : 1
  return { ...it, p, angle: ((it.angle ?? 0) + angle) % (Math.PI * 2), w: width, ...(it.fontSize !== undefined ? { fontSize: fontScale === 1 ? it.fontSize : Math.max(1, Math.min(1000, it.fontSize * fontScale)) } : {}) }
}

export function expandGroups(items: Item[], selected: Item[]): Item[] {
  const ids = new Set(selected.map(it => it.id)), groups = new Set(selected.map(it => it.group).filter(Boolean))
  return items.filter(it => ids.has(it.id) || (it.group && groups.has(it.group)))
}

export function pointInPolygon(x: number, y: number, points: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[i], [bx, by] = points[j]
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside
  }
  return inside
}
