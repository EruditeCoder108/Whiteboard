import type { ApparatusItem } from '../types'
import type { CircuitPart } from './circuit'

export type Subject = 'physics' | 'chemistry' | 'biology'
export type C = CanvasRenderingContext2D
export type Params = Record<string, number>

/** What the page's circuits and neighbours make of a part right now (see world.ts). */
export interface Live {
  volts: number; amps: number
  /** seconds, for anything that moves */
  time: number
  /** the board behind it is dark, so glass and labels need light lines */
  dark: boolean
  /** a value worked out from what is nearby: a compass bearing, a thermometer in a flask */
  value?: number
  warn?: string
}

export interface Setting { key: string; label: string; min?: number; max?: number; step?: number; unit?: string; choices?: string[]; toggle?: boolean; apply?: (value: number, q: Params) => void }

/** A live spot on a part: a switch to tap, a slider to drag. Positions are in the part's own units. */
export interface Control {
  name: string
  at(q: Params): [number, number]
  reach?: number
  tap?(q: Params): void
  drag?(q: Params, x: number, y: number): void
}

export interface Part {
  kind: string
  name: string
  subject: Subject
  group: string
  w: number
  h: number
  params: Params
  settings?: Setting[]
  controls?: Control[]
  /** where wires join, in the part's own units; the first is + on a part with a polarity */
  terminals?: [number, number][]
  polar?: boolean
  circuit?(id: string, a: string, b: string, q: Params, time: number): CircuitPart
  /** keeps being redrawn while this is true */
  moving?(q: Params, live: Live): boolean
  paint(c: C, q: Params, live: Live, it: ApparatusItem): void
}

const registry = new Map<string, Part>()
export const PARTS: Part[] = []
export function addParts(list: Part[]): void { for (const p of list) { registry.set(p.kind, p); PARTS.push(p) } }
export const partOf = (kind: string): Part | undefined => registry.get(kind)

// ── drawing kit ───────────────────────────────────────────────────────────────
export const STEEL = ['#eef1f4', '#b3bcc6', '#7f8a96'], BRASS = ['#f3dd9c', '#c9a14f', '#8a6a2a'], WOOD = ['#c99a62', '#a87842', '#7d5730'], BLACK = ['#4a4f58', '#2b2f36', '#17191d']

export function shade(c: C, x0: number, y0: number, x1: number, y1: number, colors: string[]): CanvasGradient {
  const g = c.createLinearGradient(x0, y0, x1, y1)
  colors.forEach((s, i) => g.addColorStop(i / (colors.length - 1), s))
  return g
}

export function box(c: C, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, line = 'rgba(30,25,20,.55)', lw = 2): void {
  c.beginPath(); c.roundRect(x, y, w, h, r)
  c.fillStyle = fill; c.fill()
  if (line) { c.strokeStyle = line; c.lineWidth = lw; c.stroke() }
}

export function disc(c: C, x: number, y: number, r: number, fill: string | CanvasGradient, line = '', lw = 2): void {
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2)
  c.fillStyle = fill; c.fill()
  if (line) { c.strokeStyle = line; c.lineWidth = lw; c.stroke() }
}

export function poly(c: C, pts: number[], fill: string | CanvasGradient | null, line = '', lw = 2, close = true): void {
  c.beginPath(); c.moveTo(pts[0], pts[1])
  for (let i = 2; i + 1 < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1])
  if (close) c.closePath()
  if (fill) { c.fillStyle = fill; c.fill() }
  if (line) { c.strokeStyle = line; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke() }
}

export function line(c: C, x0: number, y0: number, x1: number, y1: number, color: string, lw = 2): void {
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1)
  c.strokeStyle = color; c.lineWidth = lw; c.lineCap = 'round'; c.stroke()
}

export function text(c: C, value: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center', weight = 600): void {
  c.font = `${weight} ${size}px "Segoe UI", "Nirmala UI", sans-serif`
  c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle'
  c.fillText(value, x, y)
}

/** A label that reads on any board colour: a small plate behind it. */
export function plate(c: C, value: string, x: number, y: number, size = 19, color = '#172033'): void {
  c.font = `600 ${size}px "Segoe UI", "Nirmala UI", sans-serif`
  const w = c.measureText(value).width + size * .8, h = size * 1.45
  box(c, x - w / 2, y - h / 2, w, h, h / 2.4, 'rgba(255,253,247,.94)', 'rgba(30,25,20,.25)', 1)
  text(c, value, x, y + size * .03, size, color)
}

/** A grab point: a soft dot that says "you can move this". */
export function grip(c: C, x: number, y: number, r = 13, color = '#4262ff'): void {
  disc(c, x, y, r, '#ffffff', color, 3)
  disc(c, x, y, r * .35, color)
}

/** Glass: a pale body with a bright edge, drawn so it reads on white and on a chalkboard. */
export function glass(c: C, path: () => void, dark: boolean, lw = 3): void {
  c.beginPath(); path()
  c.fillStyle = dark ? 'rgba(220,235,245,.1)' : 'rgba(205,225,240,.2)'; c.fill()
  c.strokeStyle = dark ? 'rgba(235,245,255,.9)' : 'rgba(55,80,105,.85)'; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke()
}

export const ink = (live: Live): string => live.dark ? '#f4f6fb' : '#172033'
export const fmt = (v: number, unit: string): string => {
  const a = Math.abs(v)
  if (unit && a > 0 && a < 1) return a >= .001 ? `${(v * 1000).toFixed(a < .01 ? 1 : 0)} m${unit}` : `${(v * 1e6).toFixed(0)} µ${unit}`
  return `${v.toFixed(a >= 100 ? 0 : a >= 10 ? 1 : 2)} ${unit}`
}

/** A meter face: an arc scale, a needle that swings, and the exact value printed under it. */
export function meter(c: C, cx: number, cy: number, r: number, value: number, lo: number, hi: number, name: string, labels: string[], reading: string, redNeedle = '#c0261e'): void {
  const from = Math.PI * 1.2, to = Math.PI * 1.8
  disc(c, cx, cy, r + 14, shade(c, cx, cy - r, cx, cy + r, ['#fffdf6', '#f2ecdd']), 'rgba(30,25,20,.5)', 2)
  c.beginPath(); c.arc(cx, cy + r * .28, r * .86, from, to); c.strokeStyle = '#2b2f36'; c.lineWidth = 2.5; c.stroke()
  const point = (t: number, rad: number): [number, number] => { const a = from + (to - from) * t; return [cx + rad * Math.cos(a), cy + r * .28 + rad * Math.sin(a)] }
  for (let i = 0; i <= 20; i++) {
    const t = i / 20, [ax, ay] = point(t, r * .86), [bx, by] = point(t, r * (i % 5 === 0 ? .74 : .8))
    line(c, ax, ay, bx, by, '#2b2f36', i % 5 === 0 ? 2.4 : 1.2)
  }
  labels.forEach((s, i) => { const [x, y] = point(i / (labels.length - 1), r * .62); text(c, s, x, y, r * .17, '#2b2f36') })
  text(c, name, cx, cy + r * .1, r * .3, '#7a2f24', 'center', 700)
  const t = (Math.max(lo, Math.min(hi, value)) - lo) / (hi - lo) * 1.02 - .01
  const [nx, ny] = point(t, r * .92)
  line(c, cx, cy + r * .28, nx, ny, redNeedle, 3)
  disc(c, cx, cy + r * .28, 7, '#2b2f36')
  plate(c, reading, cx, cy + r * .72, r * .22)
}

/** A screw post where a wire joins. */
export function post(c: C, x: number, y: number, kind: 'plus' | 'minus' | 'plain'): void {
  const color = kind === 'plus' ? '#d43b33' : kind === 'minus' ? '#2b2f36' : '#b58a3a'
  disc(c, x, y, 13, shade(c, x - 10, y - 10, x + 10, y + 10, [kind === 'plain' ? '#f0d693' : '#fff', color, color]), 'rgba(20,15,10,.65)', 2)
  if (kind !== 'plain') text(c, kind === 'plus' ? '+' : '−', x, y + 1, 19, '#fff', 'center', 800)
}
