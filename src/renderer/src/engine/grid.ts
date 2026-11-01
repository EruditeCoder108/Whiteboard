import { clamp } from './geometry'
import { hexRgb } from './colour'
import type { Rect, View } from './types'

/**
 * Page backgrounds.
 *  - dots, lines (squares): decorative lattices that adapt to the zoom
 *  - ruled, fourline, hindi, music: writing papers, fixed in world units
 *  - graph, isodots, isogrid: working papers with a fixed scale (world units, not calibrated millimetres)
 *  - compare, worked, predict, exit: lesson layouts that follow each screen of the page
 */
export const PAPERS = ['none', 'dots', 'lines', 'ruled', 'fourline', 'hindi', 'graph', 'music', 'isodots', 'isogrid', 'compare', 'worked', 'predict', 'exit'] as const
export type Paper = (typeof PAPERS)[number]
export const isPaper = (v: unknown): v is Paper => typeof v === 'string' && (PAPERS as readonly string[]).includes(v)
export const LAYOUTS: readonly Paper[] = ['compare', 'worked', 'predict', 'exit']
export const isLayout = (p: Paper): boolean => LAYOUTS.includes(p)
/** A layout follows the page, so only the patterns have a spacing. */
export const hasSpacing = (p: Paper): boolean => p !== 'none' && !isLayout(p)

/**
 * How a paper is drawn. `spacing` scales the whole pattern (1 = the preset), `strength` its
 * opacity, and `lines` replaces the main line colour (margins and baselines keep their red).
 */
export interface PaperStyle { spacing: number; strength: number; lines?: string }
export const PRESET: PaperStyle = { spacing: 1, strength: 1 }
export const SPACING_RANGE = [.5, 3] as const
export const STRENGTH_RANGE = [.25, 2.5] as const
/** Paper always stays lighter than ink, however strong it is set. */
const MAX_ALPHA = .7

/** Compatible powers of two, shared at the world origin. At a level boundary
 * the departing lattice equals the fully opaque part of the arriving one.
 * Stateless smoothstep also makes reversals stable, without temporal lag. */
export function gridLevel(zoom: number): { step: number; fade: number } {
  const step = 40 * 2 ** Math.floor(Math.log2(36 / (40 * zoom)))
  const t = Math.max(0, Math.min(1, (step * zoom - 18) / 18))
  return { step, fade: t * t * (3 - 2 * t) }
}

/** Square graph paper: three subdivisions between each retained line. Fade
 * those subdivisions out before they crowd the screen, and promote them to the
 * retained lattice before changing levels. Both ends describe the same image.
 * At 100% this gives subtle 20-unit squares with an 80-unit reference grid. */
export function squareGridLevel(zoom: number): { step: number; fade: number } {
  const step = 20 * 4 ** Math.floor(Math.log(32 / (20 * zoom)) / Math.log(4))
  const t = Math.max(0, Math.min(1, (step * zoom - 8) / 24))
  return { step, fade: t * t * (3 - 2 * t) }
}

/** 0 when marks `px` apart would crowd the screen (≤ lo), 1 from `hi` up, smooth between. */
export function fadeIn(px: number, lo: number, hi: number): number {
  const t = clamp((px - lo) / (hi - lo), 0, 1)
  return t * t * (3 - 2 * t)
}

/**
 * One layer of paper marks in CSS pixels, painted in a single path so crossings are never darker
 * than the lines themselves. `rgb` is "r,g,b".
 *  - rects: x, y, w, h quadruples (lines as thin strips that follow subpixel camera motion)
 *  - dots: x, y pairs of radius `radius`
 *  - segs: x0, y0, x1, y1 lines of `width` (slanted lines)
 */
export interface PaperPass { rgb: string; alpha: number; rects?: number[]; dots?: number[]; radius?: number; segs?: number[]; width?: number }

/** Line colours on light and dark (chalk) boards. */
const INK = {
  blue: ['47,107,255', '140,180,255'], red: ['229,72,77', '255,140,140'], grey: ['20,30,60', '255,255,255'],
  green: ['22,140,110', '140,230,200'], squares: ['32,32,32', '255,255,255'], dots: ['20,30,60', '255,255,255']
} as const

/**
 * The marks of a paper over a `width`×`height` CSS-pixel view. `view` is in the paper's own
 * coordinates (the page origin already taken off). `cells` are the screens of the page in the
 * same coordinates; layouts are drawn in each of them. `adapt` (the open canvas) lets writing
 * papers follow the zoom (see `writingLevels`); pages and frames keep their paper fixed to the page.
 */
export function planPaper(view: View, width: number, height: number, mode: Paper, dark: boolean, style: PaperStyle = PRESET, cells: Rect[] = [], adapt = false): PaperPass[] {
  if (mode === 'none') return []
  const k = clamp(style.strength, STRENGTH_RANGE[0], STRENGTH_RANGE[1])
  const custom = style.lines ? hexRgb(style.lines) : null
  /** main lines take the teacher's colour; accents (margin, baseline, headline) keep theirs */
  const tone = (ink: keyof typeof INK, alpha: number, accent = false): { rgb: string; alpha: number } =>
    ({ rgb: (!accent && custom) || INK[ink][dark ? 1 : 0], alpha: Math.min(MAX_ALPHA, alpha * k) })
  if (isLayout(mode)) return planLayout(view, mode, cells, tone(custom ? 'grey' : 'blue', dark ? .42 : .36))
  // Spacing scales the pattern: draw it in coordinates `spacing` times larger.
  const s = clamp(style.spacing, SPACING_RANGE[0], SPACING_RANGE[1])
  const v: View = { x: view.x / s, y: view.y / s, zoom: view.zoom * s }
  switch (mode) {
    case 'lines': return planSquares(v, width, height, tone('squares', dark ? .16 : .075))
    case 'dots': return planDots(v, width, height, tone('dots', dark ? .38 : .32))
    case 'isodots': case 'isogrid': return planIso(v, width, height, mode === 'isodots', tone('grey', mode === 'isodots' ? dark ? .42 : .36 : dark ? .2 : .16))
    case 'graph': return planGraph(v, width, height, tone('green', dark ? .16 : .14), tone('green', dark ? .34 : .32))
    default:
      if (!adapt) return planRuled(v, width, height, mode, dark, tone)
      return writingLevels(view.zoom).flatMap((l, i) =>
        planRuled({ x: v.x / l.scale, y: v.y / l.scale, zoom: v.zoom * l.scale }, width, height, mode, dark, tone, l.weight, i === 0))
  }
}

/**
 * Writing papers on the open canvas: zooming in or out redraws the pattern at half or double size
 * (powers of two, so the lines always fall on the same world lattice), keeping the lines a
 * comfortable distance apart at any zoom. Near 100% the paper is exactly its preset; between two
 * sizes one fades into the other, so nothing jumps.
 */
export function writingLevels(zoom: number): { scale: number; weight: number }[] {
  const L = -Math.log2(zoom), n = Math.floor(L), t = fadeIn(L - n, .35, .65)
  return [{ scale: 2 ** n, weight: 1 - t }, { scale: 2 ** (n + 1), weight: t }].filter(l => l.weight > 1e-5)
}

/** Draw the passes from `planPaper`. The transform must already map CSS pixels. */
export function paintPasses(ctx: CanvasRenderingContext2D, passes: PaperPass[]): void {
  for (const p of passes) {
    if (p.alpha < .00001) continue
    const style = `rgba(${p.rgb},${p.alpha})`
    if (p.rects?.length || p.dots?.length) {
      ctx.fillStyle = style
      ctx.beginPath()
      const r = p.rects ?? []
      for (let i = 0; i < r.length; i += 4) ctx.rect(r[i], r[i + 1], r[i + 2], r[i + 3])
      const d = p.dots ?? [], rad = p.radius ?? 1.2
      for (let i = 0; i < d.length; i += 2) { ctx.moveTo(d[i] + rad, d[i + 1]); ctx.arc(d[i], d[i + 1], rad, 0, Math.PI * 2) }
      ctx.fill()
    }
    if (p.segs?.length) {
      ctx.strokeStyle = style
      ctx.lineWidth = p.width ?? 1
      ctx.beginPath()
      const g = p.segs
      for (let i = 0; i < g.length; i += 4) { ctx.moveTo(g[i], g[i + 1]); ctx.lineTo(g[i + 2], g[i + 3]) }
      ctx.stroke()
    }
  }
}

/** Decorative grid only. Scientific axes have their own calibrated SI scale.
 * Positions retain subpixel camera motion; Canvas antialiasing handles fractional
 * DPR instead of rounding positions on every pan. Size is always in CSS pixels.
 * `clear: false` paints over what is already there (a coloured sheet, a frame). */
export function paintGrid(ctx: CanvasRenderingContext2D, view: View, width: number, height: number,
  dpr: number, mode: Paper, dark: boolean, clear = true, style: PaperStyle = PRESET, cells: Rect[] = [], adapt = false): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  if (clear) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  if (mode === 'none') return
  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  paintPasses(ctx, planPaper(view, width, height, mode, dark, style, cells, adapt))
  ctx.restore()
}

/** Indices k with k·step on screen (plus one either side), and where index `i0` lands. */
function span(origin: number, zoom: number, size: number, step: number): { i0: number; n: number; s0: number; px: number } {
  const i0 = Math.floor(origin / step)
  // Integer indices avoid accumulated addition drift at distant/negative views.
  return { i0, n: Math.ceil(size / (step * zoom)) + 2, s0: (i0 * step - origin) * zoom, px: step * zoom }
}

/**
 * Vertical and horizontal 1px strips through every `step`, optionally only every `every`-th.
 * `centred: false` starts each strip on its line (the squares' historical placement).
 */
function strips(v: View, width: number, height: number, step: number, every = 1, centred = true): number[] {
  const out: number[] = [], o = centred ? .5 : 0
  const X = span(v.x, v.zoom, width, step), Y = span(v.y, v.zoom, height, step)
  for (let i = 0; i < X.n; i++) if ((X.i0 + i) % every === 0) out.push(X.s0 + i * X.px - o, 0, 1, height)
  for (let i = 0; i < Y.n; i++) if ((Y.i0 + i) % every === 0) out.push(0, Y.s0 + i * Y.px - o, width, 1)
  return out
}

function planSquares(v: View, width: number, height: number, ink: { rgb: string; alpha: number }): PaperPass[] {
  const { step, fade } = squareGridLevel(v.zoom)
  const alpha = ink.alpha
  // Draw the complete fine lattice first, then top up its retained subset.
  // Source-over compensation keeps reference lines at exactly alpha instead
  // of doubling their darkness at intersections. At either level boundary
  // only one pass remains, so the outgoing and incoming images match.
  return [
    { rgb: ink.rgb, alpha: alpha * fade, rects: strips(v, width, height, step, 1, false) },
    { rgb: ink.rgb, alpha: alpha * (1 - fade) / (1 - alpha * fade), rects: strips(v, width, height, step, 4, false) }
  ]
}

function planDots(v: View, width: number, height: number, ink: { rgb: string; alpha: number }): PaperPass[] {
  const { step, fade } = gridLevel(v.zoom)
  const X = span(v.x, v.zoom, width, step), Y = span(v.y, v.zoom, height, step)
  const coarse: number[] = [], fine: number[] = []
  for (let x = 0; x < X.n; x++) for (let y = 0; y < Y.n; y++) {
    const keep = (X.i0 + x) % 2 === 0 && (Y.i0 + y) % 2 === 0
    ;(keep ? coarse : fine).push(X.s0 + x * X.px, Y.s0 + y * Y.px)
  }
  return [{ rgb: ink.rgb, alpha: ink.alpha, dots: coarse }, { rgb: ink.rgb, alpha: ink.alpha * fade, dots: fine }]
}

/**
 * Graph paper with a fixed scale: fine lines every 10 units, bold every 50. The fine lines fade out
 * (rather than vanish) as they crowd together; the bold ones are topped up over them, so a crossing
 * is exactly as dark as a line.
 */
function planGraph(v: View, width: number, height: number, fine: { rgb: string; alpha: number }, major: { rgb: string; alpha: number }): PaperPass[] {
  const af = fine.alpha * fadeIn(10 * v.zoom, 4, 8)
  const am = Math.max(af, major.alpha * fadeIn(50 * v.zoom, 5, 10))
  const passes: PaperPass[] = []
  if (af > .00001) passes.push({ rgb: fine.rgb, alpha: af, rects: strips(v, width, height, 10) })
  if (am > af) passes.push({ rgb: major.rgb, alpha: (am - af) / (1 - af), rects: strips(v, width, height, 50) })
  return passes
}

/** Isometric paper: a triangular lattice with vertical columns (for drawing solids). */
function planIso(v: View, width: number, height: number, dots: boolean, ink: { rgb: string; alpha: number }): PaperPass[] {
  const a = 40, col = a * Math.sqrt(3) / 2, z = v.zoom
  const fade = fadeIn(col * z, 12, 20)
  if (fade < .00001) return []
  const alpha = ink.alpha * fade
  if (dots) {
    const out: number[] = []
    const X = span(v.x, z, width, col)
    for (let i = 0; i < X.n; i++) {
      const c = X.i0 + i, off = ((c % 2) + 2) % 2 ? a / 2 : 0
      const Y = span(v.y - off, z, height, a)
      for (let j = 0; j < Y.n; j++) out.push(X.s0 + i * X.px, Y.s0 + j * Y.px)
    }
    return [{ rgb: ink.rgb, alpha, dots: out, radius: 1.4 }]
  }
  const segs: number[] = []
  const X = span(v.x, z, width, col)
  for (let i = 0; i < X.n; i++) { const x = X.s0 + i * X.px; segs.push(x, 0, x, height) }
  // Lines at ±30°: world y = ±x·t + k·a, which on screen is Y = ±X·t + c.
  const t = Math.tan(Math.PI / 6)
  for (const sign of [1, -1]) {
    const base = sign * v.x * t - v.y
    const lo = sign > 0 ? -width * t : 0, hi = sign > 0 ? height : height + width * t
    for (let k = Math.floor((lo / z - base) / a) - 1, end = Math.ceil((hi / z - base) / a) + 1; k <= end; k++) {
      const c = (base + k * a) * z
      segs.push(0, c, width, c + sign * width * t)
    }
  }
  return [{ rgb: ink.rgb, alpha, segs, width: 1 }]
}

/** One repeating band of a ruled paper: line offsets within a period, in world units. */
interface Rule { at: number; ink: keyof typeof INK; alpha: number; accent?: boolean; width?: number; dash?: boolean }

/**
 * Ruled papers in world units, so the lines stay under the writing when the page moves.
 * At 100% on a typical board one unit is about a millimetre: ruled lines ~5 cm apart,
 * four-line copy bands ~4 cm tall, readable from the back of the room. Lines fade out as they
 * crowd together instead of disappearing at once.
 */
function planRuled(v: View, width: number, height: number, mode: Paper, dk: boolean,
  tone: (ink: keyof typeof INK, alpha: number, accent?: boolean) => { rgb: string; alpha: number }, weight = 1, withMargin = true): PaperPass[] {
  const z = v.zoom
  const blue = dk ? .38 : .32, red = .5, grey = dk ? .26 : .22
  const passes: PaperPass[] = []
  const bands = (period: number, gap: number, rules: Rule[]): void => {
    const fade = fadeIn(gap * z, 3, 7) * weight
    if (fade < .00001) return
    const Y = span(v.y, z, height, period)
    for (const r of rules) {
      const { rgb, alpha } = tone(r.ink, r.alpha, r.accent)
      const w = r.width ?? 1, rects: number[] = []
      for (let i = -1; i < Y.n; i++) {
        const y = Y.s0 + i * Y.px + r.at * z - w / 2
        if (!r.dash) { rects.push(0, y, width, w); continue }
        // Dashes are anchored to the page (8 units on, 8 off), so they do not crawl when it moves.
        if (16 * z < 6) { rects.push(0, y, width, w); continue }
        const D = span(v.x, z, width, 16)
        for (let d = 0; d < D.n; d++) rects.push(D.s0 + d * D.px, y, 8 * z, w)
      }
      passes.push({ rgb, alpha: alpha * (r.dash && 16 * z < 6 ? .5 : 1) * fade, rects })
    }
  }
  const margin = (): void => {
    const x = -v.x * z
    if (!withMargin || x < -2 || x > width + 2) return
    passes.push({ ...tone('red', red, true), rects: [x - .75, 0, 1.5, height] })
  }
  switch (mode) {
    case 'ruled':
      bands(52, 52, [{ at: 0, ink: 'blue', alpha: blue }])
      margin()
      break
    case 'fourline':
      // Indian copy-writing bands: four lines, the third (baseline) in red.
      bands(96, 16, [{ at: 0, ink: 'blue', alpha: blue }, { at: 16, ink: 'blue', alpha: blue }, { at: 32, ink: 'red', alpha: red, accent: true, width: 1.5 }, { at: 48, ink: 'blue', alpha: blue }])
      break
    case 'hindi':
      // Devanagari: a firm headline (shirorekha) and a lighter dashed baseline under it.
      bands(88, 40, [{ at: 0, ink: 'red', alpha: red, accent: true, width: 1.5 }, { at: 40, ink: 'blue', alpha: blue, dash: true }])
      margin()
      break
    case 'music':
      bands(150, 12, [0, 12, 24, 36, 48].map(at => ({ at, ink: 'grey' as const, alpha: grey })))
      break
  }
  return passes
}

/**
 * Lesson layouts: quiet guide lines on each screen of the page, for the teacher to write headings in.
 *  - compare: a heading band over two columns (compare / contrast, before / after)
 *  - worked: the question across the top, working on the left, notes on the right
 *  - predict: a heading band over three columns (predict / observe / explain)
 *  - exit: three numbered answer boxes (exit ticket)
 */
function planLayout(v: View, mode: Paper, cells: Rect[], ink: { rgb: string; alpha: number }): PaperPass[] {
  const z = v.zoom
  const X = (x: number): number => (x - v.x) * z, Y = (y: number): number => (y - v.y) * z
  const segs: number[] = []
  const h = (x0: number, x1: number, y: number): void => { segs.push(X(x0), Y(y), X(x1), Y(y)) }
  const vert = (x: number, y0: number, y1: number): void => { segs.push(X(x), Y(y0), X(x), Y(y1)) }
  for (const [x0, y0, x1, y1] of cells) {
    const m = 48, W = x1 - x0, l = x0 + m, r = x1 - m, t = y0 + m, b = y1 - m
    const head = y0 + 130
    switch (mode) {
      case 'compare': h(l, r, head); vert(x0 + W / 2, head, b); break
      case 'predict': h(l, r, head); vert(x0 + W / 3, head, b); vert(x0 + 2 * W / 3, head, b); break
      case 'worked': { const q = y0 + 240; h(l, r, q); vert(x0 + W * 2 / 3, q, b); break }
      case 'exit': {
        for (let i = 1; i < 3; i++) h(l, r, t + (b - t) * i / 3)
        vert(l + 90, t, b)
        segs.push(X(l), Y(t), X(r), Y(t), X(r), Y(t), X(r), Y(b), X(r), Y(b), X(l), Y(b), X(l), Y(b), X(l), Y(t))
        break
      }
    }
  }
  return segs.length ? [{ rgb: ink.rgb, alpha: ink.alpha, segs, width: 2 }] : []
}
