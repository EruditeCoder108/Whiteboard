import type { Rect } from './types'

/**
 * Measured papers and playing fields, each fitted to one screen of a page and drawn to true proportions.
 * Plain line lists in world units, so painting, thumbnails, PNG and PDF share them like every other paper.
 */
export const FIELDS = ['semilog', 'loglog', 'polar', 'football', 'cricket', 'basketball', 'kabaddi'] as const
export type Field = (typeof FIELDS)[number]
export const isField = (p: string): p is Field => (FIELDS as readonly string[]).includes(p)

export interface FieldMarks { major: number[]; minor: number[] }

const MARGIN = 48
/** Where 1, 2 … 9 fall within a decade of log paper. */
export const logTicks = (): number[] => [2, 3, 4, 5, 6, 7, 8, 9].map(Math.log10)

export function fieldMarks(field: Field, cell: Rect): FieldMarks {
  // The toolbar sits over the bottom of the screen in class, so a field stays clear of it.
  const x0 = cell[0] + MARGIN, y0 = cell[1] + MARGIN, x1 = cell[2] - MARGIN, y1 = cell[3] - MARGIN * 2
  const W = x1 - x0, H = y1 - y0
  const major: number[] = [], minor: number[] = []
  const line = (out: number[], ax: number, ay: number, bx: number, by: number): void => { out.push(ax, ay, bx, by) }
  const arc = (out: number[], cx: number, cy: number, r: number, from = 0, to = Math.PI * 2): void => {
    const n = Math.max(6, Math.ceil(Math.abs(to - from) * Math.max(8, r / 6)))
    for (let i = 0; i < n; i++) {
      const a = from + (to - from) * i / n, b = from + (to - from) * (i + 1) / n
      out.push(cx + r * Math.cos(a), cy + r * Math.sin(a), cx + r * Math.cos(b), cy + r * Math.sin(b))
    }
  }
  const box = (out: number[], ax: number, ay: number, bx: number, by: number): void => {
    line(out, ax, ay, bx, ay); line(out, bx, ay, bx, by); line(out, bx, by, ax, by); line(out, ax, by, ax, ay)
  }

  if (field === 'semilog' || field === 'loglog') {
    const decadesY = 3, decadesX = 4
    box(major, x0, y0, x1, y1)
    for (let d = 0; d < decadesY; d++) {
      const yd = y1 - H * d / decadesY
      if (d) line(major, x0, yd, x1, yd)
      for (const t of logTicks()) { const y = yd - H / decadesY * t; line(minor, x0, y, x1, y) }
    }
    if (field === 'semilog') {
      for (let i = 1; i < 20; i++) { const x = x0 + W * i / 20; line(i % 2 === 0 ? major : minor, x, y0, x, y1) }
    } else for (let d = 0; d < decadesX; d++) {
      const xd = x0 + W * d / decadesX
      if (d) line(major, xd, y0, xd, y1)
      for (const t of logTicks()) { const x = xd + W / decadesX * t; line(minor, x, y0, x, y1) }
    }
    return { major, minor }
  }

  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2

  if (field === 'polar') {
    const R = Math.min(W, H) / 2
    for (let i = 1; i <= 6; i++) arc(i === 6 ? major : minor, cx, cy, R * i / 6)
    for (let d = 0; d < 360; d += 15) {
      const a = d * Math.PI / 180, inner = d % 30 === 0 ? 0 : R / 6
      line(d % 30 === 0 ? major : minor, cx + inner * Math.cos(a), cy + inner * Math.sin(a), cx + R * Math.cos(a), cy + R * Math.sin(a))
    }
    return { major, minor }
  }

  if (field === 'football') {
    const k = Math.min(W / 105, H / 68), hw = 105 * k / 2, hh = 68 * k / 2
    box(major, cx - hw, cy - hh, cx + hw, cy + hh)
    line(major, cx, cy - hh, cx, cy + hh)
    arc(major, cx, cy, 9.15 * k); arc(major, cx, cy, .35 * k)
    for (const s of [-1, 1]) {
      const end = cx + s * hw
      box(major, end, cy - 20.16 * k, end - s * 16.5 * k, cy + 20.16 * k)
      box(major, end, cy - 9.16 * k, end - s * 5.5 * k, cy + 9.16 * k)
      const spot = end - s * 11 * k
      arc(major, spot, cy, .35 * k)
      // The penalty arc is the part of its circle outside the penalty area.
      const open = Math.acos(5.5 / 9.15)
      if (s > 0) arc(major, spot, cy, 9.15 * k, Math.PI - open, Math.PI + open)
      else arc(major, spot, cy, 9.15 * k, -open, open)
      for (const t of [-1, 1]) {
        const from = s > 0 ? (t < 0 ? Math.PI / 2 : Math.PI) : (t < 0 ? 0 : -Math.PI / 2)
        arc(major, end, cy + t * hh, 1 * k, from, from + Math.PI / 2)
      }
    }
    return { major, minor }
  }

  if (field === 'cricket') {
    const k = H / 150, rx = Math.min(W / 2, 90 * k), ry = 75 * k, ring = 27.43 * k, half = 10.06 * k, wide = 1.52 * k
    // Oval boundary drawn as a scaled circle.
    const n = 96
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2
      line(major, cx + rx * Math.cos(a), cy + ry * Math.sin(a), cx + rx * Math.cos(b), cy + ry * Math.sin(b))
    }
    // The 30-yard circle: half circles around each set of stumps, joined by straight lines.
    arc(minor, cx, cy - half, ring, Math.PI, Math.PI * 2)
    arc(minor, cx, cy + half, ring, 0, Math.PI)
    line(minor, cx - ring, cy - half, cx - ring, cy + half)
    line(minor, cx + ring, cy - half, cx + ring, cy + half)
    box(major, cx - wide, cy - half, cx + wide, cy + half)
    for (const s of [-1, 1]) line(major, cx - wide * 1.4, cy + s * (half - 1.22 * k), cx + wide * 1.4, cy + s * (half - 1.22 * k))
    return { major, minor }
  }

  if (field === 'basketball') {
    const k = Math.min(W / 28, H / 15), hw = 14 * k, hh = 7.5 * k
    box(major, cx - hw, cy - hh, cx + hw, cy + hh)
    line(major, cx, cy - hh, cx, cy + hh)
    arc(major, cx, cy, 1.8 * k)
    for (const s of [-1, 1]) {
      const end = cx + s * hw, hoop = end - s * 1.575 * k, free = end - s * 5.8 * k
      box(major, end, cy - 2.45 * k, free, cy + 2.45 * k)
      arc(major, free, cy, 1.8 * k)
      arc(major, hoop, cy, .225 * k)
      // The three-point line: straight beside the baseline, then an arc around the hoop.
      const side = 6.6 * k, r = 6.75 * k, turn = Math.asin(6.6 / 6.75), along = hoop - s * r * Math.cos(turn)
      line(major, end, cy - side, along, cy - side)
      line(major, end, cy + side, along, cy + side)
      if (s > 0) arc(major, hoop, cy, r, Math.PI - turn, Math.PI + turn)
      else arc(major, hoop, cy, r, -turn, turn)
    }
    return { major, minor }
  }

  // Kabaddi: 13 m by 10 m with a 1 m lobby along each side, a mid line, and baulk and bonus lines in each half.
  const k = Math.min(W / 13, H / 10), hw = 6.5 * k, hh = 5 * k
  box(major, cx - hw, cy - hh, cx + hw, cy + hh)
  line(major, cx, cy - hh, cx, cy + hh)
  line(major, cx - hw, cy - 4 * k, cx + hw, cy - 4 * k)
  line(major, cx - hw, cy + 4 * k, cx + hw, cy + 4 * k)
  for (const s of [-1, 1]) {
    line(major, cx + s * 3.75 * k, cy - 4 * k, cx + s * 3.75 * k, cy + 4 * k)
    line(minor, cx + s * 4.75 * k, cy - 4 * k, cx + s * 4.75 * k, cy + 4 * k)
  }
  return { major, minor }
}
