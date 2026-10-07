import { getStroke } from 'perfect-freehand'
import {
  boundsOfFlat,
  boundsOfPoints,
  densifyTriples,
  inflate,
  runsOutsideCircle,
  segDistSq
} from './geometry'
import { MARKER_ALPHA, newId } from './types'
import type { Item, Rect, ShapeItem, StrokeItem } from './types'
import { paintText } from './text'

export function rotatePoint(x: number, y: number, cx: number, cy: number, angle: number): [number, number] {
  const c = Math.cos(angle), s = Math.sin(angle)
  return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]
}

export function localPoint(it: Item, x: number, y: number): [number, number] {
  return it.t !== 's' && it.angle ? rotatePoint(x, y, (it.p[0] + it.p[2]) / 2, (it.p[1] + it.p[3]) / 2, -it.angle) : [x, y]
}

/** How strongly pressure changes the width (see perfect-freehand `thinning`). */
export const THINNING = 0.6

/** width multiplier for a pressure value (0.4× … 1.6×, 1× at pressure 0.5) */
export const widthFactor = (pressure: number): number => 1 + (pressure - 0.5) * 2 * THINNING

const halfWidth = (it: StrokeItem, v: number): number => (it.w / 2) * (it.v ? widthFactor(v) : 1)

// ── stroke outline ────────────────────────────────────────────────────────────
export function strokeOutline(it: StrokeItem): number[][] {
  const pts: [number, number, number][] = []
  for (let i = 0; i + 2 < it.p.length; i += 3) pts.push([it.p[i], it.p[i + 1], it.p[i + 2]])
  return getStroke(pts, {
    size: it.w,
    thinning: it.v ? THINNING : 0,
    smoothing: 0.55,
    streamline: 0.2,
    simulatePressure: false,
    last: true,
    start: { cap: true },
    end: { cap: true }
  })
}

// ── shape geometry ────────────────────────────────────────────────────────────
const ELLIPSE_SEGMENTS = 72

/** Centre-line of a shape as polylines (flat x,y lists). */
export function shapePolylines(s: ShapeItem): number[][] {
  const [x0, y0, x1, y1] = s.p
  switch (s.k) {
    case 'line':
      return [[x0, y0, x1, y1]]
    case 'arrow': {
      const out: number[][] = [[x0, y0, x1, y1]]
      const L = Math.hypot(x1 - x0, y1 - y0)
      if (L > 1e-6) {
        const head = Math.min(Math.max(12, s.w * 4.5), L * 0.6)
        const ux = (x0 - x1) / L
        const uy = (y0 - y1) / L
        const a = (27 * Math.PI) / 180
        const ca = Math.cos(a)
        const sa = Math.sin(a)
        out.push([
          x1 + head * (ux * ca - uy * sa),
          y1 + head * (ux * sa + uy * ca),
          x1,
          y1,
          x1 + head * (ux * ca + uy * sa),
          y1 + head * (-ux * sa + uy * ca)
        ])
      }
      return out
    }
    case 'rect': {
      const lx = Math.min(x0, x1)
      const hx = Math.max(x0, x1)
      const ly = Math.min(y0, y1)
      const hy = Math.max(y0, y1)
      return [[lx, ly, hx, ly, hx, hy, lx, hy, lx, ly]]
    }
    case 'diamond': {
      const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2]
      return [[cx, y0, x1, cy, cx, y1, x0, cy, cx, y0]]
    }
    case 'triangle':
      return [[(x0 + x1) / 2, Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), Math.min(x0, x1), Math.max(y0, y1), (x0 + x1) / 2, Math.min(y0, y1)]]
    case 'ellipse': {
      const cx = (x0 + x1) / 2
      const cy = (y0 + y1) / 2
      const rx = Math.abs(x1 - x0) / 2
      const ry = Math.abs(y1 - y0) / 2
      const pts: number[] = []
      for (let i = 0; i <= ELLIPSE_SEGMENTS; i++) {
        const a = (i / ELLIPSE_SEGMENTS) * Math.PI * 2
        pts.push(cx + rx * Math.cos(a), cy + ry * Math.sin(a))
      }
      return [pts]
    }
  }
}

// ── caches (items are immutable, so these never go stale) ────────────────────
const boundsCache = new WeakMap<Item, Rect>()
const denseCache = new WeakMap<StrokeItem, number[]>()
const polyCache = new WeakMap<ShapeItem, number[][]>()
const outlineCache = new WeakMap<StrokeItem, number[][]>()
const pathCache = new WeakMap<Item, Path2D>()

function outlineOf(it: StrokeItem): number[][] {
  let o = outlineCache.get(it)
  if (!o) {
    o = strokeOutline(it)
    outlineCache.set(it, o)
  }
  return o
}

function polysOf(s: ShapeItem): number[][] {
  let p = polyCache.get(s)
  if (!p) {
    p = shapePolylines(s)
    polyCache.set(s, p)
  }
  return p
}

export function itemBounds(it: Item): Rect {
  let b = boundsCache.get(it)
  if (b) return b
  if (it.t === 's') {
    const o = outlineOf(it)
    b = o.length ? boundsOfPoints(o) : boundsOfFlat(it.p, 3)
    b = inflate(b, 1)
  } else if (it.t === 't') {
    b = [Math.min(it.p[0], it.p[2]), Math.min(it.p[1], it.p[3]), Math.max(it.p[0], it.p[2]), Math.max(it.p[1], it.p[3])]
  } else {
    let r: Rect | null = null
    for (const poly of polysOf(it)) {
      const pb = boundsOfFlat(poly)
      r = r ? [Math.min(r[0], pb[0]), Math.min(r[1], pb[1]), Math.max(r[2], pb[2]), Math.max(r[3], pb[3])] : pb
    }
    b = inflate(r ?? [0, 0, 0, 0], it.w * (it.k === 'rect' ? 0.8 : 0.55) + 1)
  }
  if (it.t !== 's' && it.angle) {
    const cx = (it.p[0] + it.p[2]) / 2, cy = (it.p[1] + it.p[3]) / 2
    b = boundsOfPoints([[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]].map(([x, y]) => rotatePoint(x, y, cx, cy, it.angle!)))
  }
  boundsCache.set(it, b)
  return b
}

// ── painting ──────────────────────────────────────────────────────────────────
function outlineToPath(pts: number[][]): Path2D {
  const path = new Path2D()
  const n = pts.length
  if (n < 3) return path
  const mx = (a: number[], b: number[]): number => (a[0] + b[0]) / 2
  const my = (a: number[], b: number[]): number => (a[1] + b[1]) / 2
  path.moveTo(mx(pts[0], pts[1]), my(pts[0], pts[1]))
  for (let i = 1; i <= n; i++) {
    const a = pts[i % n]
    const b = pts[(i + 1) % n]
    path.quadraticCurveTo(a[0], a[1], mx(a, b), my(a, b))
  }
  path.closePath()
  return path
}

export function itemPath(it: Item): Path2D {
  let p = pathCache.get(it)
  if (p) return p
  if (it.t === 's') {
    p = outlineToPath(outlineOf(it))
  } else {
    p = new Path2D()
    const [x0, y0, x1, y1] = it.p
    if (it.t === 't' || it.k === 'rect') {
      p.roundRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0), it.t === 't' ? (it.note ? 3 : 0) : Math.min(it.radius ?? 0, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2))
    } else if (it.k === 'ellipse') {
      p.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2)
    } else {
      for (const poly of polysOf(it)) {
        p.moveTo(poly[0], poly[1])
        for (let i = 2; i + 1 < poly.length; i += 2) p.lineTo(poly[i], poly[i + 1])
      }
    }
  }
  pathCache.set(it, p)
  return p
}

/** Paint one item.  The context must already carry the world→screen transform. */
export function paintItem(ctx: CanvasRenderingContext2D, it: Item, alpha = 1): void {
  ctx.save()
  alpha *= it.opacity ?? 1
  if (it.t !== 's' && it.angle) {
    const cx = (it.p[0] + it.p[2]) / 2, cy = (it.p[1] + it.p[3]) / 2
    ctx.translate(cx, cy); ctx.rotate(it.angle); ctx.translate(-cx, -cy)
  }
  const path = itemPath(it)
  if (it.t === 's') {
    ctx.globalAlpha = alpha * (it.m ? MARKER_ALPHA : 1)
    ctx.fillStyle = it.c
    ctx.fill(path)
  } else if (it.t === 't') {
    ctx.globalAlpha = alpha
    if (it.fill && it.fill !== 'none') { ctx.fillStyle = it.fill; ctx.fill(path) }
    paintText(ctx, it)
  } else {
    ctx.globalAlpha = alpha
    if (it.fill && it.fill !== 'none' && it.k !== 'line' && it.k !== 'arrow') { ctx.fillStyle = it.fill; ctx.fill(path) }
    ctx.strokeStyle = it.c
    ctx.lineWidth = it.w
    ctx.lineCap = 'round'
    ctx.lineJoin = it.k === 'rect' ? 'miter' : 'round'
    ctx.miterLimit = 4
    ctx.setLineDash(it.dash === 'dashed' ? [it.w * 4, it.w * 3] : it.dash === 'dotted' ? [it.w * 0.1, it.w * 2.5] : [])
    ctx.stroke(path)
    paintText(ctx, it)
  }
  ctx.restore()
}

// ── dense polylines for hit-testing / erasing ────────────────────────────────
/** Stroke samples at ≤2 world-unit spacing, as triples (x, y, pressure). */
export function denseOf(it: StrokeItem): number[] {
  let d = denseCache.get(it)
  if (!d) {
    d = densifyTriples(it.p, 2)
    denseCache.set(it, d)
  }
  return d
}

export function hitCircle(it: Item, cx: number, cy: number, r: number): boolean {
  ;[cx, cy] = localPoint(it, cx, cy)
  if (it.t === 't') return cx + r >= Math.min(it.p[0], it.p[2]) && cx - r <= Math.max(it.p[0], it.p[2]) && cy + r >= Math.min(it.p[1], it.p[3]) && cy - r <= Math.max(it.p[1], it.p[3])
  if (it.t === 's') {
    const d = denseOf(it)
    const n = d.length / 3
    if (n === 1) {
      const rr = r + halfWidth(it, d[2])
      return (d[0] - cx) ** 2 + (d[1] - cy) ** 2 <= rr * rr
    }
    for (let i = 0; i + 1 < n; i++) {
      const a = i * 3
      const b = a + 3
      const rr = r + Math.max(halfWidth(it, d[a + 2]), halfWidth(it, d[b + 2]))
      if (segDistSq(cx, cy, d[a], d[a + 1], d[b], d[b + 1]) <= rr * rr) return true
    }
    return false
  }
  const rr = (r + it.w / 2) ** 2
  for (const poly of polysOf(it)) {
    for (let i = 0; i + 3 < poly.length; i += 2) {
      if (segDistSq(cx, cy, poly[i], poly[i + 1], poly[i + 2], poly[i + 3]) <= rr) return true
    }
  }
  return false
}

/**
 * Pixel-erase: remove the part of `it` under the circle.
 * Returns the surviving pieces (strokes).  Shapes become ordinary strokes.
 */
export function splitErase(it: Item, cx: number, cy: number, r: number): StrokeItem[] {
  if (it.t === 't') return []
  if (it.t === 'h' && it.angle) {
    const cX = (it.p[0] + it.p[2]) / 2, cY = (it.p[1] + it.p[3]) / 2
    const [lx, ly] = localPoint(it, cx, cy)
    return splitErase({ ...it, angle: 0 }, lx, ly, r).map(s => ({ ...s, p: s.p.map((v, i, pts) => i % 3 === 2 ? v : rotatePoint(pts[i - i % 3], pts[i - i % 3 + 1], cX, cY, it.angle!)[i % 3]) }))
  }
  const frags: StrokeItem[] = []
  const mk = (run: number[], base: Pick<StrokeItem, 'c' | 'w' | 'm' | 'v' | 'group' | 'opacity'>): void => {
    if (run.length < 6) return // drop crumbs: a lone sample left between two cuts
    frags.push({ t: 's', id: newId(), ...base, p: run })
  }
  if (it.t === 's') {
    const d = denseOf(it)
    if (d.length <= 3) return []
    const base = { c: it.c, w: it.w, m: it.m, v: it.v, group: it.group, opacity: it.opacity }
    for (const run of runsOutsideCircle(d, cx, cy, r, (v) => halfWidth(it, v))) mk(run, base)
  } else {
    const base = { c: it.c, w: it.w, m: false, v: false, group: it.group, opacity: it.opacity }
    for (const poly of polysOf(it)) {
      const tri: number[] = []
      for (let i = 0; i + 1 < poly.length; i += 2) tri.push(poly[i], poly[i + 1], 0.5)
      for (const run of runsOutsideCircle(densifyTriples(tri, 2), cx, cy, r, () => it.w / 2)) mk(run, base)
    }
  }
  return frags
}

// ── immutable edits ───────────────────────────────────────────────────────────
export function translateItem(it: Item, dx: number, dy: number): Item {
  if (it.t === 's') {
    const p = it.p.slice()
    for (let i = 0; i + 2 < p.length; i += 3) {
      p[i] += dx
      p[i + 1] += dy
    }
    return { ...it, p }
  }
  return { ...it, p: [it.p[0] + dx, it.p[1] + dy, it.p[2] + dx, it.p[3] + dy] }
}

export function recolorItem(it: Item, color: string): Item {
  return { ...it, c: color }
}

/** Fresh copy with a new id (for duplicate / paste). */
export function cloneItem(it: Item, dx = 0, dy = 0): Item {
  const t = translateItem(it, dx, dy)
  return { ...t, id: newId() }
}

/** Selection includes the interior of closed shapes, even when their fill is transparent. */
export function hitObject(it: Item, x: number, y: number, tolerance: number): boolean {
  if (hitCircle(it, x, y, tolerance)) return true
  if (it.t !== 'h' || it.k === 'line' || it.k === 'arrow') return false
  const [px, py] = localPoint(it, x, y)
  const cx = (it.p[0] + it.p[2]) / 2, cy = (it.p[1] + it.p[3]) / 2
  const rx = Math.abs(it.p[2] - it.p[0]) / 2, ry = Math.abs(it.p[3] - it.p[1]) / 2
  if (!rx || !ry) return false
  if (it.k === 'ellipse') return ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1
  if (it.k === 'diamond') return Math.abs((px - cx) / rx) + Math.abs((py - cy) / ry) <= 1
  if (it.k === 'triangle') return py >= cy - ry && py <= cy + ry && Math.abs(px - cx) <= rx * (py - (cy - ry)) / (2 * ry)
  return Math.abs(px - cx) <= rx && Math.abs(py - cy) <= ry
}
