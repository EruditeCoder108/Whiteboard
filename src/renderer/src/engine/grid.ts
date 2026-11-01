import type { View } from './types'

/** Page backgrounds. 'dots' and 'lines' (squares) follow the zoom; the rest are ruled papers. */
export const PAPERS = ['none', 'dots', 'lines', 'ruled', 'fourline', 'hindi', 'graph', 'music'] as const
export type Paper = (typeof PAPERS)[number]
export const isPaper = (v: unknown): v is Paper => typeof v === 'string' && (PAPERS as readonly string[]).includes(v)

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

/** Decorative grid only. Scientific axes have their own calibrated SI scale.
 * Positions retain subpixel camera motion; Canvas antialiasing handles fractional
 * DPR instead of rounding positions on every pan. Size is always in CSS pixels. */
export function paintGrid(ctx: CanvasRenderingContext2D, view: View, width: number, height: number,
  dpr: number, mode: Paper, dark: boolean): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  if (mode === 'none') return
  if (mode !== 'dots' && mode !== 'lines') {
    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    paintRuled(ctx, view, width, height, mode, dark)
    ctx.restore()
    return
  }
  const { step, fade } = mode === 'lines' ? squareGridLevel(view.zoom) : gridLevel(view.zoom)
  const spacing = step * view.zoom
  const ix = Math.floor(view.x / step), iy = Math.floor(view.y / step)
  // Integer indices avoid accumulated addition drift at distant/negative views.
  const x0 = (ix * step - view.x) * view.zoom
  const y0 = (iy * step - view.y) * view.zoom
  const nx = Math.ceil(width / spacing) + 2, ny = Math.ceil(height / spacing) + 2
  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  // Neutral graph-paper lines remain quiet on white and coloured backgrounds.
  const rgb = dark ? '255,255,255' : mode === 'lines' ? '32,32,32' : '20,30,60'
  if (mode === 'lines') {
    const alpha = dark ? .16 : .075
    // Draw the complete fine lattice first, then top up its retained subset.
    // Source-over compensation keeps reference lines at exactly alpha instead
    // of doubling their darkness at intersections. At either level boundary
    // only one pass remains, so the outgoing and incoming images match.
    for (const coarse of [false, true]) {
      const passAlpha = coarse ? alpha * (1 - fade) / (1 - alpha * fade) : alpha * fade
      if (passAlpha < .00001) continue
      ctx.fillStyle = `rgba(${rgb},${passAlpha})`
      ctx.beginPath()
      // Filled strips share the same raster coverage on both axes. Their
      // screen-space width stays fixed; their edges follow subpixel pan motion.
      for (let x = 0; x < nx; x++) {
        if (coarse && (ix + x) % 4 !== 0) continue
        ctx.rect(x0 + x * spacing, 0, 1, height)
      }
      for (let y = 0; y < ny; y++) {
        if (coarse && (iy + y) % 4 !== 0) continue
        ctx.rect(0, y0 + y * spacing, width, 1)
      }
      ctx.fill()
    }
    ctx.restore()
    return
  }
  for (const coarse of [true, false]) {
    const alpha = (dark ? .38 : .32) * (coarse ? 1 : fade)
    if (alpha < .00001) continue
    ctx.beginPath()
    ctx.fillStyle = `rgba(${rgb},${alpha})`
    for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) {
      if (((ix + x) % 2 === 0 && (iy + y) % 2 === 0) !== coarse) continue
      const sx = x0 + x * spacing, sy = y0 + y * spacing
      ctx.moveTo(sx + 1.2, sy)
      ctx.arc(sx, sy, 1.2, 0, Math.PI * 2)
    }
    ctx.fill()
  }
  ctx.restore()
}

/** One repeating band of a ruled paper: line offsets within a period, in world units. */
interface Rule { at: number; color: string; width?: number; dash?: number[] }

/**
 * Ruled papers in world units, so the lines stay under the writing when the page moves.
 * At 100% on a typical board one unit is about a millimetre: ruled lines ~5 cm apart,
 * four-line copy bands ~4 cm tall, readable from the back of the room.
 */
function paintRuled(ctx: CanvasRenderingContext2D, view: View, width: number, height: number, mode: Exclude<Paper, 'none' | 'dots' | 'lines'>, dark: boolean): void {
  const ink = (light: string, chalk: string): string => dark ? chalk : light
  const blue = ink('rgba(47,107,255,.32)', 'rgba(140,180,255,.38)')
  const red = ink('rgba(229,72,77,.5)', 'rgba(255,140,140,.5)')
  const grey = ink('rgba(20,30,60,.22)', 'rgba(255,255,255,.26)')
  const z = view.zoom
  const sy = (y: number): number => (y - view.y) * z
  const sx = (x: number): number => (x - view.x) * z
  const hRules = (period: number, rules: Rule[]): void => {
    if (period * z < 6) return
    const k0 = Math.floor(view.y / period) - 1, k1 = Math.ceil((view.y + height / z) / period) + 1
    for (const r of rules) {
      ctx.strokeStyle = r.color
      ctx.lineWidth = r.width ?? 1
      ctx.setLineDash(r.dash ?? [])
      ctx.beginPath()
      for (let k = k0; k <= k1; k++) {
        const y = Math.round(sy(k * period + r.at)) + .5
        ctx.moveTo(0, y); ctx.lineTo(width, y)
      }
      ctx.stroke()
    }
    ctx.setLineDash([])
  }
  const margin = (): void => {
    const x = Math.round(sx(0)) + .5
    if (x < 0 || x > width) return
    ctx.strokeStyle = red; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke()
  }
  switch (mode) {
    case 'ruled':
      hRules(52, [{ at: 0, color: blue }])
      margin()
      break
    case 'fourline':
      // Indian copy-writing bands: four lines, the third (baseline) in red.
      hRules(96, [{ at: 0, color: blue }, { at: 16, color: blue }, { at: 32, color: red, width: 1.5 }, { at: 48, color: blue }])
      break
    case 'hindi':
      // Devanagari: a firm headline (shirorekha) and a lighter baseline under it.
      hRules(88, [{ at: 0, color: red, width: 1.5 }, { at: 40, color: blue, dash: [6, 6] }])
      margin()
      break
    case 'graph': {
      // Millimetre graph paper: fine every 10, bold every 50.
      const g = ink('rgba(22,140,110,', 'rgba(140,230,200,')
      for (const [step, alpha, w] of [[10, dark ? .16 : .14, 1], [50, dark ? .34 : .32, 1]] as const) {
        if (step * z < 4) continue
        ctx.strokeStyle = g + alpha + ')'; ctx.lineWidth = w
        ctx.beginPath()
        for (let x = Math.floor(view.x / step) * step; x <= view.x + width / z + step; x += step) { const X = Math.round(sx(x)) + .5; ctx.moveTo(X, 0); ctx.lineTo(X, height) }
        for (let y = Math.floor(view.y / step) * step; y <= view.y + height / z + step; y += step) { const Y = Math.round(sy(y)) + .5; ctx.moveTo(0, Y); ctx.lineTo(width, Y) }
        ctx.stroke()
      }
      break
    }
    case 'music':
      hRules(150, [0, 12, 24, 36, 48].map(at => ({ at, color: grey })))
      break
  }
}
