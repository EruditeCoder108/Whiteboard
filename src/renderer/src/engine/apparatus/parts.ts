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

/** A screw post where a wire joins. */
export function post(c: C, x: number, y: number, kind: 'plus' | 'minus' | 'plain'): void {
  // A brass collar with a knurled edge, under a coloured cap.
  disc(c, x, y, 13, shade(c, x - 10, y - 10, x + 10, y + 10, ['#f6e2a4', '#c9a24f', '#7a5c22']), '#1b2025', 1.5)
  for (let i = 0; i < 20; i++) { const a = i * Math.PI / 10; line(c, x + 10.5 * Math.cos(a), y + 10.5 * Math.sin(a), x + 12.5 * Math.cos(a), y + 12.5 * Math.sin(a), 'rgba(60,40,10,.6)', 1) }
  const cap = kind === 'plus' ? ['#e2665a', '#b83025'] : kind === 'minus' ? ['#555b63', '#15181b'] : ['#f6e2a4', '#a9843a']
  disc(c, x, y, 9.5, shade(c, x - 7, y - 7, x + 7, y + 7, cap), '#1b2025', 1)
  if (kind === 'plain') disc(c, x, y, 3, '#2b2115')
  else text(c, kind === 'plus' ? '+' : '−', x, y + .5, 16, '#fff', 'center', 700)
}
