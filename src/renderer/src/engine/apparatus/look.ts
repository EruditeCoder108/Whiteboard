import type { C } from './parts'
import { box, disc, grip, line, shade, text } from './parts'

/**
 * One look for the physics bench, so every part belongs with the others:
 * - seen straight on, lit from above, with no perspective;
 * - real materials only: graphite plates, steel, brass, copper, glass, ivory;
 * - crisp, machined corners, and curves only where the real thing is round;
 * - every label is printed on the part, never floating beside it;
 * - a metal lead runs from each terminal into the component it serves.
 */
export const GRAPHITE = ['#5a6570', '#46505a', '#363e47'], EDGE = '#1b2025'
export const IVORY = ['#fbf8ef', '#efe9da']
/** Round bars and tubes, lit from above: dark edge, highlight, body, dark edge. */
export const R_STEEL = ['#77828c', '#f4f7f9', '#b7c0c8', '#68727c'], R_BRASS = ['#8a6a2a', '#f6e2a4', '#c9a24f', '#7a5c22'], R_COPPER = ['#6e3a1c', '#eeb285', '#b8693a', '#5a2e15'], R_BLACK = ['#0d0f12', '#555b63', '#23272c', '#0a0c0e']
export const DARK_METAL = ['#4c555f', '#23282e']
export const RED = '#c23a2e', AMBER = '#e39a2d', PRINT = '#e8edf1', WARN = '#ff9c8f', BRASS_LEAD = '#d9b665'

/** The plate a component is fixed to. */
export function mount(c: C, x: number, y: number, w: number, h: number): void {
  box(c, x, y, w, h, 3, shade(c, 0, y, 0, y + h, GRAPHITE), EDGE, 2)
  c.fillStyle = 'rgba(0,0,0,.24)'; c.fillRect(x + 1, y + h - 6, w - 2, 5)
  line(c, x + 3, y + 2, x + w - 3, y + 2, 'rgba(255,255,255,.2)', 1.5)
  if (w > 100 && h > 70) { screw(c, x + 11, y + 11); screw(c, x + w - 11, y + 11) }
}

export function screw(c: C, x: number, y: number, r = 4): void {
  disc(c, x, y, r, shade(c, x - r, y - r, x + r, y + r, ['#c9d0d6', '#6f7a84']), EDGE, 1)
  line(c, x - r * .6, y + r * .4, x + r * .6, y - r * .4, EDGE, 1.1)
}

/** A metal lead along these points, x, y, x, y… */
export function lead(c: C, pts: number[], color = '#cfd6dc'): void {
  c.beginPath(); c.moveTo(pts[0], pts[1])
  for (let i = 2; i + 1 < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1])
  c.lineJoin = 'miter'; c.lineCap = 'butt'
  c.strokeStyle = EDGE; c.lineWidth = 6; c.stroke()
  c.strokeStyle = color; c.lineWidth = 3.4; c.stroke()
  c.lineJoin = 'round'; c.lineCap = 'round'
}

/** Printed on the plate. */
export const print = (c: C, value: string, x: number, y: number, size = 16, color = PRINT, weight = 600): void => text(c, value, x, y, size, color, 'center', weight)

/** A small dark display, for anything that changes as the circuit runs. */
export function readout(c: C, value: string, x: number, y: number, size = 16, color = '#f4f6f8'): void {
  c.font = `600 ${size}px "Segoe UI", "Nirmala UI", sans-serif`
  const w = c.measureText(value).width + size * .9, h = size * 1.5
  box(c, x - w / 2, y - h / 2, w, h, 2, '#14181c', 'rgba(255,255,255,.25)', 1)
  text(c, value, x, y + size * .03, size, color)
}

/** The spot a teacher drags. */
export const handle = (c: C, x: number, y: number, r = 11): void => grip(c, x, y, r, AMBER)

/** Soft light around anything lit. `rgb` is 'r,g,b'. */
export function glow(c: C, x: number, y: number, r: number, rgb: string, strength: number): void {
  const g = c.createRadialGradient(x, y, r * .08, x, y, r)
  g.addColorStop(0, `rgba(${rgb},${strength})`); g.addColorStop(.45, `rgba(${rgb},${strength * .32})`); g.addColorStop(1, `rgba(${rgb},0)`)
  disc(c, x, y, r, g)
}

/**
 * A panel meter: dark case, ivory scale behind glass, a thin needle from a covered pivot, and the exact value
 * below. Drawn for a part 200 wide, whose terminals are in the case's bottom corners.
 */
export function meter(c: C, value: number, lo: number, hi: number, name: string, labels: string[], reading: string, wrong = false): void {
  const cx = 100, cy = 132, r = 90, from = Math.PI * 1.2, to = Math.PI * 1.8
  box(c, 6, 6, 188, 200, 4, shade(c, 0, 6, 0, 206, GRAPHITE), EDGE, 2)
  line(c, 10, 8, 190, 8, 'rgba(255,255,255,.2)', 1.5)
  box(c, 18, 18, 164, 126, 2, shade(c, 0, 18, 0, 144, IVORY), EDGE, 2.5)
  c.save(); c.beginPath(); c.rect(19, 19, 162, 124); c.clip()
  const point = (t: number, rad: number): [number, number] => { const a = from + (to - from) * t; return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)] }
  c.beginPath(); c.arc(cx, cy, r, from, to); c.strokeStyle = '#23282e'; c.lineWidth = 2; c.stroke()
  for (let i = 0; i <= 20; i++) {
    const t = i / 20, [ax, ay] = point(t, r), [bx, by] = point(t, r - (i % 10 === 0 ? 13 : i % 5 === 0 ? 10 : 6))
    line(c, ax, ay, bx, by, '#23282e', i % 5 === 0 ? 2 : 1)
  }
  labels.forEach((s, i) => { const [x, y] = point(i / (labels.length - 1), r - 25); text(c, s, x, y, 14, '#23282e') })
  text(c, name, 46, 122, 26, '#23282e', 'center', 700)
  // The needle stops just past each end of the scale, as a real one does.
  const t = (Math.max(lo, Math.min(hi, value)) - lo) / (hi - lo) * 1.02 - .01, [nx, ny] = point(t, r - 3)
  line(c, cx, cy, nx, ny, RED, 2.4)
  disc(c, cx, cy + 12, 25, shade(c, 0, cy - 13, 0, cy + 30, DARK_METAL), EDGE, 1.5)
  // The glass.
  c.beginPath(); c.moveTo(19, 19); c.lineTo(88, 19); c.lineTo(38, 143); c.lineTo(19, 143); c.closePath(); c.fillStyle = 'rgba(255,255,255,.2)'; c.fill()
  c.restore()
  screw(c, cx, 136, 4.5)
  readout(c, reading, cx, 165, 15, wrong ? WARN : '#f4f6f8')
}
