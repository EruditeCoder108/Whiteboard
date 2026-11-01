import type { Item, ShapeItem, TextItem } from './types'
import { newId } from './types'

// ── student zones ─────────────────────────────────────────────────────────────
export const ZONE_CHOICES = [2, 3, 4, 6] as const
const LIGHT = ['#2f6bff', '#e5484d', '#2fa66a', '#8a4fff', '#f28c28', '#db2777']
const DARK = ['#6cb6ff', '#ff8a8a', '#5ad07a', '#c4a5ff', '#ffa24a', '#ff7ab6']
export const zoneInks = (dark: boolean): string[] => [...(dark ? DARK : LIGHT)]

/** Which zone a point on the screen falls in; the board is shared in equal strips, side by side. */
export const zoneAt = (x: number, width: number, count: number): number => Math.max(0, Math.min(count - 1, Math.floor(x / width * count)))
export const zoneSpan = (i: number, width: number, count: number): [number, number] => [i * width / count, (i + 1) * width / count]

/** A stroke stays on its writer's side, however far the hand wanders. */
export const keepInZone = (x: number, i: number, width: number, count: number): number => {
  const [lo, hi] = zoneSpan(i, width, count)
  return Math.max(lo + 1, Math.min(hi - 1, x))
}

// ── name picker ───────────────────────────────────────────────────────────────
export const parseNames = (text: string): string[] => [...new Set(text.split(/[\r\n,;]+/).map(s => s.trim()).filter(Boolean))].slice(0, 500)
export const rollNumbers = (from: number, to: number): string[] => {
  const lo = Math.max(0, Math.round(Math.min(from, to))), hi = Math.min(lo + 999, Math.round(Math.max(from, to)))
  return Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i))
}

/** The next name. With `fresh`, nobody comes up twice until everyone has had a turn. Returns who is left. */
export function pickFrom(all: string[], used: string[], fresh: boolean, random: () => number = Math.random): { pick: string | null; used: string[] } {
  if (!all.length) return { pick: null, used: [] }
  const seen = fresh ? new Set(used) : new Set<string>()
  let left = all.filter(n => !seen.has(n))
  if (!left.length) { left = all; seen.clear() }
  const pick = left[Math.min(left.length - 1, Math.floor(random() * left.length))]
  return { pick, used: fresh ? [...seen, pick] : [] }
}

// ── dice ──────────────────────────────────────────────────────────────────────
export const rollDice = (count: number, random: () => number = Math.random): number[] =>
  Array.from({ length: count }, () => Math.min(6, Math.floor(random() * 6) + 1))

/** Where the dots sit on a die face, on a 3 × 3 grid (row, column). */
export const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]], 6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]]
}

// ── clock ─────────────────────────────────────────────────────────────────────
/** Hand angles in degrees, clockwise from 12. */
export function clockHands(h: number, m: number, s: number): { hour: number; minute: number; second: number } {
  return { hour: ((h % 12) + m / 60) * 30, minute: (m + s / 60) * 6, second: s * 6 }
}

// ── poll results on the board ─────────────────────────────────────────────────
/** Poll results as a plain bar chart of ordinary objects, to keep in the lesson. */
export function pollChart(question: string, options: string[], counts: number[], dark: boolean): Item[] {
  const ink = dark ? '#ffffff' : '#111827', fills = zoneInks(dark)
  const group = newId(), total = counts.reduce((a, b) => a + b, 0), top = Math.max(1, ...counts)
  const text = (x: number, y: number, w: number, value: string, fontSize: number, bold = false, align: 'left' | 'right' = 'left'): TextItem =>
    ({ t: 't', id: newId(), c: ink, w: 1, p: [x, y, x + w, y + fontSize * 1.6], text: value, fontSize, note: false, fill: 'none', align, group, ...(bold ? { bold: true } : {}) })
  const out: Item[] = [text(0, 0, 1100, question || 'Class poll', 36, true)]
  options.forEach((o, i) => {
    const y = 90 + i * 76, w = Math.max(6, 640 * counts[i] / top)
    const bar: ShapeItem = { t: 'h', id: newId(), c: fills[i % fills.length], w: 2, k: 'rect', p: [270, y, 270 + w, y + 54], fill: fills[i % fills.length], radius: 8, group }
    out.push(text(0, y + 4, 250, o, 28, false, 'right'), bar, text(280 + w, y + 4, 200, `${counts[i]}`, 28, true))
  })
  out.push(text(0, 90 + options.length * 76 + 6, 500, `${total} answer${total === 1 ? '' : 's'}`, 22))
  return out
}
