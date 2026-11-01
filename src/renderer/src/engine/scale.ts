import type { Rect, ScaleAxis, ScaleItem } from './types'

/**
 * Number lines and coordinate axes: measured objects, not decoration. Each axis states its own range,
 * tick step, name and unit; a marked point is a value, so it stays exact wherever the object goes.
 * Axes with `equal` keep one unit the same length both ways, so a square stays square; the plot sits
 * centred in whatever box it is given.
 */
export const MAX_TICKS = 200
export const MAX_POINTS = 100
export const MAX_NAME = 40
const LIMIT = 1e6

export const validAxis = (a: unknown): a is ScaleAxis => {
  if (!a || typeof a !== 'object') return false
  const { min, max, step, den, name } = a as Record<string, unknown>
  if (typeof min !== 'number' || typeof max !== 'number' || typeof step !== 'number' || ![min, max, step].every(Number.isFinite)) return false
  if (Math.abs(min) > LIMIT || Math.abs(max) > LIMIT || min >= max || step <= 0 || (max - min) / step > MAX_TICKS) return false
  if (den !== undefined && (!Number.isInteger(den) || (den as number) < 2 || (den as number) > 100)) return false
  return name === undefined || (typeof name === 'string' && name.length <= MAX_NAME)
}

/** The tick values: whole multiples of the step, worked out from whole numbers so 0.1 steps stay clean. */
export function ticksOf(a: ScaleAxis): number[] {
  const out: number[] = []
  const first = Math.ceil(a.min / a.step - 1e-9), last = Math.floor(a.max / a.step + 1e-9)
  for (let i = first; i <= last && out.length <= MAX_TICKS; i++) out.push(i === 0 ? 0 : Number((i * a.step).toFixed(10)))
  return out
}

/** What is being typed: text, because "−" or "1/4" pass through states that are not yet numbers. */
export interface AxisDraft { min: string; max: string; step: string; name: string }

const number = (s: string): number => Number(s.replace('\u2212', '-').trim() || NaN)

/** "1/4" or "0.5" or "2". A fraction also says to label the ticks as fractions. */
export function parseStep(s: string): { step: number; den?: number } | null {
  const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(s)
  if (m) {
    const top = Number(m[1]), den = Number(m[2])
    return top > 0 && den >= 2 && den <= 100 ? { step: top / den, den } : null
  }
  const step = number(s)
  return Number.isFinite(step) && step > 0 ? { step } : null
}

/** The axis as typed, or what is wrong with it in plain words. */
export function parseAxis(d: AxisDraft): { axis: ScaleAxis } | { problem: string } {
  const min = number(d.min), max = number(d.max), step = parseStep(d.step)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { problem: '“From” and “To” must be numbers.' }
  if (min >= max) return { problem: '“To” must be more than “From”.' }
  if (Math.abs(min) > LIMIT || Math.abs(max) > LIMIT) return { problem: 'Numbers up to a million in size only.' }
  if (!step) return { problem: 'The step must be a number like 2, 0.5 or 1/4.' }
  if ((max - min) / step.step > MAX_TICKS) return { problem: 'That is too many marks. Choose a bigger step.' }
  const name = d.name.trim()
  return { axis: { min, max, step: step.step, ...(step.den ? { den: step.den } : {}), ...(name ? { name } : {}) } }
}

export type TickLabel = { text: string } | { whole: string; num: number; den: number }

const MINUS = '−'

/** "−2", "0.25", or with a denominator a proper fraction: 1¾ is whole 1 over 3/4. */
export function tickLabel(v: number, den?: number): TickLabel {
  const sign = v < 0 ? MINUS : '', size = Math.abs(v)
  if (den) {
    const n = Math.round(size * den)
    if (Math.abs(n / den - size) < 1e-6 && n % den !== 0) {
      const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a
      const whole = Math.floor(n / den), rest = n - whole * den, g = gcd(rest, den)
      return { whole: `${sign}${whole || ''}`, num: rest / g, den: den / g }
    }
  }
  return { text: `${sign}${Number(size.toFixed(6))}` }
}

const widthOf = (l: TickLabel, font: number): number => 'text' in l
  ? l.text.length * font * .56
  : l.whole.length * font * .56 + (l.whole ? font * .08 : 0) + Math.max(String(l.num).length, String(l.den).length) * font * .72 * .62

export const fontOf = (it: ScaleItem): number => {
  const w = Math.abs(it.p[2] - it.p[0]), h = Math.abs(it.p[3] - it.p[1])
  return it.y ? Math.max(8, Math.min(w, h) / 26) : Math.max(8, h * .24)
}

/** Where values go: the plot's rectangle and the size of one unit each way. */
export interface Plot { x0: number; y0: number; x1: number; y1: number; ux: number; uy: number }

export function plotOf(it: ScaleItem): Plot {
  const X0 = Math.min(it.p[0], it.p[2]), X1 = Math.max(it.p[0], it.p[2]), Y0 = Math.min(it.p[1], it.p[3]), Y1 = Math.max(it.p[1], it.p[3])
  const f = fontOf(it), xr = it.x.max - it.x.min
  if (!it.y) {
    const pad = f * 1.9, y = Y0 + (Y1 - Y0) * .42
    return { x0: X0 + pad, x1: X1 - pad, y0: y, y1: y, ux: Math.max(1e-6, X1 - X0 - 2 * pad) / xr, uy: 0 }
  }
  const pad = f * 2.3, yr = it.y.max - it.y.min
  const w = Math.max(1e-6, X1 - X0 - 2 * pad), h = Math.max(1e-6, Y1 - Y0 - 2 * pad)
  const ux = it.equal ? Math.min(w / xr, h / yr) : w / xr, uy = it.equal ? ux : h / yr
  const cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2
  return { x0: cx - ux * xr / 2, x1: cx + ux * xr / 2, y0: cy - uy * yr / 2, y1: cy + uy * yr / 2, ux, uy }
}

/** The point on the board (before any rotation) for a value. */
export function toWorld(it: ScaleItem, x: number, y: number): [number, number] {
  const p = plotOf(it)
  return [p.x0 + (x - it.x.min) * p.ux, it.y ? p.y1 - (y - it.y.min) * p.uy : p.y0]
}

const nearest = (v: number, a: ScaleAxis): number => {
  const snapped = Math.round(v / a.step) * a.step
  const clean = Number(snapped.toFixed(10))
  return Math.max(Math.ceil(a.min / a.step - 1e-9) * a.step, Math.min(Math.floor(a.max / a.step + 1e-9) * a.step, clean))
}

/** The nearest tick value to a place on the object: tapping marks a point exactly on the scale. */
export function snapAt(it: ScaleItem, wx: number, wy: number): [number, number] {
  const p = plotOf(it)
  const x = nearest(it.x.min + (wx - p.x0) / p.ux, it.x)
  return [Number(x.toFixed(10)), it.y ? Number(nearest(it.y.min + (p.y1 - wy) / p.uy, it.y).toFixed(10)) : 0]
}

const same = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6

/** Tap a place: mark that value, or take the mark away if it is already there. */
export function togglePoint(points: [number, number][], at: [number, number]): [number, number][] {
  const rest = points.filter(p => !(same(p[0], at[0]) && same(p[1], at[1])))
  return rest.length < points.length ? rest : points.length >= MAX_POINTS ? points : [...points, at]
}

/** The size for a new object, fitting `view` with room around it. Equal axes get a true-shaped box. */
export function scaleBox(x: ScaleAxis, y: ScaleAxis | undefined, equal: boolean, cx: number, cy: number, roomW: number, roomH: number): Rect {
  let w: number, h: number
  if (!y) { w = Math.min(roomW * .85, 1200); h = Math.max(80, Math.min(120, w * .12)) }
  else if (equal) {
    const xr = x.max - x.min, yr = y.max - y.min
    const unit = Math.min(roomW * .7 / xr, roomH * .68 / yr)
    w = unit * xr * 1.2; h = unit * yr * 1.2
    // a very long, thin plot still needs room for its labels
    w = Math.max(w, 160); h = Math.max(h, 160)
  } else { w = roomW * .7; h = roomH * .78 }
  return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]
}

function paintLabel(ctx: CanvasRenderingContext2D, l: TickLabel, x: number, y: number, font: number, align: 'center' | 'right' | 'left'): void {
  ctx.textBaseline = 'middle'
  const width = widthOf(l, font)
  const left = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x
  if ('text' in l) {
    ctx.textAlign = 'left'
    ctx.font = `${font}px "Segoe UI", sans-serif`
    ctx.fillText(l.text, left, y)
    return
  }
  // A stacked fraction reads as children write it.
  ctx.textAlign = 'left'
  ctx.font = `${font}px "Segoe UI", sans-serif`
  ctx.fillText(l.whole, left, y)
  const small = font * .72, fx = left + l.whole.length * font * .56 + (l.whole ? font * .08 : 0)
  const fw = Math.max(String(l.num).length, String(l.den).length) * small * .62
  ctx.font = `${small}px "Segoe UI", sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(String(l.num), fx + fw / 2, y - small * .62)
  ctx.fillText(String(l.den), fx + fw / 2, y + small * .72)
  ctx.beginPath()
  ctx.moveTo(fx, y); ctx.lineTo(fx + fw, y)
  ctx.lineWidth = Math.max(.6, font * .06)
  ctx.stroke()
}

/** Label every 1, 2, 5, 10, 20… ticks: how a teacher counts along a scale. */
export function niceStride(need: number): number {
  for (let unit = 1; ; unit *= 10) for (const k of [1, 2, 5]) if (k * unit >= need) return k * unit
}

/** Every how-many ticks there is room for a label, so numbers never run together. The step itself stays as stated. */
function labelStride(a: ScaleAxis, ticks: number[], spacing: number, font: number): number {
  const widest = Math.max(1, ...ticks.map(t => widthOf(tickLabel(t, a.den), font)))
  return niceStride((widest + font * .5) / Math.max(1e-6, spacing))
}

function arrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, size: number): void {
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x - dx * size - dy * size * .5, y - dy * size - dx * size * .5)
  ctx.lineTo(x - dx * size + dy * size * .5, y - dy * size + dx * size * .5)
  ctx.closePath()
  ctx.fill()
}

/** The object, in its own colour on a clear background, so writing on it and any board colour work. */
export function paintScale(ctx: CanvasRenderingContext2D, it: ScaleItem): void {
  const f = fontOf(it), p = plotOf(it), line = Math.max(.5, it.w), tick = f * .42, tip = f * .9, head = f * .55
  ctx.save()
  ctx.strokeStyle = ctx.fillStyle = it.c
  ctx.lineCap = 'round'
  const stroke = (x0: number, y0: number, x1: number, y1: number): void => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke() }
  const xt = ticksOf(it.x)
  const xStride = labelStride(it.x, xt, it.x.step * p.ux, f)
  const named = (text: string, x: number, y: number, align: CanvasTextAlign): void => {
    ctx.font = `600 ${f}px "Segoe UI", "Nirmala UI", sans-serif`
    ctx.textAlign = align; ctx.textBaseline = 'middle'
    ctx.fillText(text, x, y)
  }
  const onStride = (v: number, stride: number, a: ScaleAxis): boolean => Math.round(v / a.step) % stride === 0

  if (!it.y) {
    ctx.lineWidth = line
    stroke(p.x0 - tip, p.y0, p.x1 + tip, p.y0)
    arrowHead(ctx, p.x1 + tip + head * .4, p.y0, 1, 0, head * 1.6)
    arrowHead(ctx, p.x0 - tip - head * .4, p.y0, -1, 0, head * 1.6)
    for (const v of xt) {
      const x = p.x0 + (v - it.x.min) * p.ux, major = onStride(v, xStride, it.x)
      ctx.lineWidth = line
      stroke(x, p.y0 - (major ? tick : tick * .6), x, p.y0 + (major ? tick : tick * .6))
      if (major) paintLabel(ctx, tickLabel(v, it.x.den), x, p.y0 + tick + f * .95, f, 'center')
    }
    if (it.x.name) named(it.x.name, p.x1 + tip, p.y0 - tick - f * .7, 'right')
    for (const [v] of it.points ?? []) {
      const x = p.x0 + (v - it.x.min) * p.ux
      ctx.beginPath(); ctx.arc(x, p.y0, f * .34, 0, Math.PI * 2); ctx.fill()
      if (it.coords) { const l = tickLabel(v, it.x.den); paintLabel(ctx, l, x, p.y0 - tick - f * .85, f, 'center') }
    }
    ctx.restore()
    return
  }

  const yAxis = it.y, yt = ticksOf(yAxis)
  const yStride = niceStride(f * 1.3 / Math.max(1e-6, yAxis.step * p.uy))
  // Axes cross at zero when zero is in range, otherwise along the lower edge.
  const ox = it.x.min <= 0 && it.x.max >= 0 ? p.x0 - it.x.min * p.ux : p.x0
  const oy = yAxis.min <= 0 && yAxis.max >= 0 ? p.y1 + yAxis.min * p.uy : p.y1
  if (it.grid) {
    ctx.save()
    ctx.globalAlpha *= .24
    ctx.lineWidth = Math.max(.4, line * .4)
    for (const v of xt) { const x = p.x0 + (v - it.x.min) * p.ux; stroke(x, p.y0, x, p.y1) }
    for (const v of yt) { const y = p.y1 - (v - yAxis.min) * p.uy; stroke(p.x0, y, p.x1, y) }
    ctx.restore()
  }
  ctx.lineWidth = line
  stroke(p.x0 - tip * .4, oy, p.x1 + tip, oy)
  stroke(ox, p.y1 + tip * .4, ox, p.y0 - tip)
  arrowHead(ctx, p.x1 + tip + head * .3, oy, 1, 0, head * 1.5)
  arrowHead(ctx, ox, p.y0 - tip - head * .3, 0, -1, head * 1.5)
  for (const v of xt) {
    const x = p.x0 + (v - it.x.min) * p.ux
    stroke(x, oy - tick * .6, x, oy + tick * .6)
    if (v !== 0 && onStride(v, xStride, it.x)) paintLabel(ctx, tickLabel(v, it.x.den), x, oy + tick + f * .75, f, 'center')
  }
  for (const v of yt) {
    const y = p.y1 - (v - yAxis.min) * p.uy
    stroke(ox - tick * .6, y, ox + tick * .6, y)
    if (v !== 0 && onStride(v, yStride, yAxis)) paintLabel(ctx, tickLabel(v, yAxis.den), ox - tick - f * .3, y, f, 'right')
  }
  if (it.x.min <= 0 && it.x.max >= 0 && yAxis.min <= 0 && yAxis.max >= 0) paintLabel(ctx, { text: '0' }, ox - tick * .8, oy + f * .85, f, 'right')
  named(it.x.name || 'x', p.x1 + tip * .4, oy - tick - f * .6, 'right')
  named(yAxis.name || 'y', ox + tick + f * .3, p.y0 - tip * .6, 'left')
  for (const [vx, vy] of it.points ?? []) {
    const x = p.x0 + (vx - it.x.min) * p.ux, y = p.y1 - (vy - yAxis.min) * p.uy
    ctx.beginPath(); ctx.arc(x, y, f * .3, 0, Math.PI * 2); ctx.fill()
    if (it.coords) {
      ctx.font = `600 ${f * .9}px "Segoe UI", sans-serif`
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
      const say = (v: number, den?: number): string => { const l = tickLabel(v, den); return 'text' in l ? l.text : `${l.whole}${l.whole && l.whole !== MINUS ? ' ' : ''}${l.num}/${l.den}` }
      ctx.fillText(`(${say(vx, it.x.den)}, ${say(vy, yAxis.den)})`, x + f * .4, y - f * .25)
    }
  }
  ctx.restore()
}
