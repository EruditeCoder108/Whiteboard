import type { Rect } from './types'

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export function rectsHit(a: Rect, b: Rect): boolean {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3])
}

export function unionRect(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b
  if (!b) return a
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]
}

export function inflate(r: Rect, d: number): Rect {
  return [r[0] - d, r[1] - d, r[2] + d, r[3] + d]
}

export function rectContains(r: Rect, x: number, y: number): boolean {
  return x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]
}

/** squared distance from point to segment */
export function segDistSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy
  if (l2 <= 1e-12) return (px - ax) ** 2 + (py - ay) ** 2
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1)
  const qx = ax + t * dx - px
  const qy = ay + t * dy - py
  return qx * qx + qy * qy
}

/** Bounds of a flat [x,y,…] list with the given stride. */
export function boundsOfFlat(p: ArrayLike<number>, stride = 2): Rect {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let i = 0; i + 1 < p.length; i += stride) {
    const x = p[i]
    const y = p[i + 1]
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  return [x0, y0, x1, y1]
}

export function boundsOfPoints(pts: ArrayLike<ArrayLike<number>>): Rect {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let i = 0; i < pts.length; i++) {
    const x = pts[i][0]
    const y = pts[i][1]
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  return [x0, y0, x1, y1]
}

/**
 * Insert points so consecutive samples are at most `step` apart.
 * Input/output are flat triples (x, y, v) where v is interpolated (pressure).
 */
export function densifyTriples(src: ArrayLike<number>, step: number): number[] {
  const out: number[] = []
  const n = Math.floor(src.length / 3)
  if (n === 0) return out
  out.push(src[0], src[1], src[2])
  for (let i = 1; i < n; i++) {
    const x0 = src[(i - 1) * 3]
    const y0 = src[(i - 1) * 3 + 1]
    const v0 = src[(i - 1) * 3 + 2]
    const x1 = src[i * 3]
    const y1 = src[i * 3 + 1]
    const v1 = src[i * 3 + 2]
    const d = Math.hypot(x1 - x0, y1 - y0)
    if (d > step) {
      const k = Math.ceil(d / step)
      for (let j = 1; j < k; j++) {
        const t = j / k
        out.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, v0 + (v1 - v0) * t)
      }
    }
    out.push(x1, y1, v1)
  }
  return out
}

/**
 * Split a dense triple list into the runs that survive an eraser circle.
 * `radiusAt(v)` is the extra reach (half the stroke width) for a sample.
 */
export function runsOutsideCircle(
  dense: ArrayLike<number>,
  cx: number,
  cy: number,
  r: number,
  halfWidthAt: (v: number) => number
): number[][] {
  const runs: number[][] = []
  let cur: number[] = []
  for (let i = 0; i + 2 < dense.length; i += 3) {
    const x = dense[i]
    const y = dense[i + 1]
    const v = dense[i + 2]
    const rr = r + halfWidthAt(v)
    if ((x - cx) ** 2 + (y - cy) ** 2 <= rr * rr) {
      if (cur.length) {
        runs.push(cur)
        cur = []
      }
    } else {
      cur.push(x, y, v)
    }
  }
  if (cur.length) runs.push(cur)
  return runs
}
