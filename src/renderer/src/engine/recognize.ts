import type { ShapeItem, StrokeItem } from './types'

/**
 * Turns a hand-drawn stroke into a clean line, circle/ellipse, rectangle, diamond or straight-edged
 * polygon. Returns null when the stroke is not clearly one of these.
 */
export function recognize(stroke: StrokeItem): ShapeItem | StrokeItem | null {
  const pts: [number, number][] = []
  for (let i = 0; i + 2 < stroke.p.length; i += 3) pts.push([stroke.p[i], stroke.p[i + 1]])
  if (pts.length < 6) return null
  let length = 0
  for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  const [sx, sy] = pts[0], [ex, ey] = pts.at(-1)!
  const chord = Math.hypot(ex - sx, ey - sy)
  if (length < 30) return null
  const base = { id: stroke.id, c: stroke.c, w: stroke.w, ...(stroke.opacity !== undefined ? { opacity: stroke.opacity } : {}) }

  // Straight line: every sample stays close to the chord.
  if (chord > length * .85) {
    const deviation = Math.max(...pts.map(([x, y]) => Math.abs((x - sx) * (ey - sy) - (y - sy) * (ex - sx)) / chord))
    if (deviation > Math.max(4, chord * .07)) return null
    let [x1, y1] = [ex, ey]
    // Within 4° of horizontal, vertical or diagonal: straighten exactly.
    const a = Math.atan2(y1 - sy, x1 - sx), snap = Math.round(a / (Math.PI / 4)) * (Math.PI / 4)
    if (Math.abs(a - snap) < Math.PI / 45) { x1 = sx + chord * Math.cos(snap); y1 = sy + chord * Math.sin(snap) }
    return { t: 'h', k: 'line', ...base, p: [sx, sy, x1, y1] }
  }

  // Closed shapes end near where they began.
  if (chord > length * .22) return null
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const w = x1 - x0, h = y1 - y0
  if (w < 12 || h < 12) return null
  const corners = polygon(pts, Math.hypot(w, h) * .07)
  if (corners.length === 4) {
    // Corners near the box corners: rectangle. Near the side midpoints: diamond.
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
    const near = (targets: [number, number][]): boolean => targets.every(t => corners.some(c => Math.hypot(c[0] - t[0], c[1] - t[1]) < Math.hypot(w, h) * .16))
    if (near([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])) return { t: 'h', k: 'rect', ...base, p: [x0, y0, x1, y1] }
    if (near([[cx, y0], [x1, cy], [cx, y1], [x0, cy]])) return { t: 'h', k: 'diamond', ...base, p: [x0, y0, x1, y1] }
  }
  if (corners.length === 3 || corners.length === 4) {
    // Any other triangle or quadrilateral keeps its corners with straight sides.
    const p: number[] = []
    for (const [x, y] of [...corners, corners[0]]) p.push(x, y, .5)
    return { t: 's', ...base, m: false, v: false, p }
  }
  // Ellipse: radial distance (normalised by the box) stays close to 1.
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = w / 2, ry = h / 2
  const residual = pts.reduce((sum, [x, y]) => sum + Math.abs(Math.hypot((x - cx) / rx, (y - cy) / ry) - 1), 0) / pts.length
  if (residual > .14) return null
  // Nearly round becomes a true circle.
  if (Math.abs(rx - ry) < Math.max(rx, ry) * .15) { const r = (rx + ry) / 2; return { t: 'h', k: 'ellipse', ...base, p: [cx - r, cy - r, cx + r, cy + r] } }
  return { t: 'h', k: 'ellipse', ...base, p: [x0, y0, x1, y1] }
}

/** Corner points of a closed stroke (Douglas–Peucker, then merging the start/end seam). */
function polygon(pts: [number, number][], epsilon: number): [number, number][] {
  // Split at the point farthest from the start so the seam is not treated as a corner.
  let far = 0
  pts.forEach((p, i) => { if (Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) > Math.hypot(pts[far][0] - pts[0][0], pts[far][1] - pts[0][1])) far = i })
  const a = simplify(pts.slice(0, far + 1), epsilon), b = simplify([...pts.slice(far), pts[0]], epsilon)
  let ring = [...a.slice(0, -1), ...b.slice(0, -1)]
  // Drop near-collinear vertices (including at the seam).
  for (let changed = true; changed && ring.length > 3;) {
    changed = false
    for (let i = 0; i < ring.length; i++) {
      const p = ring[(i + ring.length - 1) % ring.length], q = ring[i], r = ring[(i + 1) % ring.length]
      const turn = Math.abs(Math.atan2(r[1] - q[1], r[0] - q[0]) - Math.atan2(q[1] - p[1], q[0] - p[0]))
      const bend = Math.min(turn, Math.PI * 2 - turn)
      if (bend < Math.PI / 7 || Math.hypot(q[0] - p[0], q[1] - p[1]) < epsilon) { ring = ring.filter((_, j) => j !== i); changed = true; break }
    }
  }
  return ring
}

function simplify(pts: [number, number][], epsilon: number): [number, number][] {
  if (pts.length < 3) return pts
  const [a, b] = [pts[0], pts.at(-1)!]
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  let index = 0, max = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((pts[i][0] - a[0]) * (b[1] - a[1]) - (pts[i][1] - a[1]) * (b[0] - a[0])) / L
    if (d > max) { max = d; index = i }
  }
  if (max <= epsilon) return [a, b]
  return [...simplify(pts.slice(0, index + 1), epsilon).slice(0, -1), ...simplify(pts.slice(index), epsilon)]
}
