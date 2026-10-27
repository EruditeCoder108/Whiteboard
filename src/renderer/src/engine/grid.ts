import type { View } from './types'

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
  dpr: number, mode: 'none' | 'dots' | 'lines', dark: boolean): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  if (mode === 'none') return
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
