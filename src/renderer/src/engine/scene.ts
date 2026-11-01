import { isDarkColor } from './colour'
import { paintGrid } from './grid'
import type { Paper } from './grid'
import type { PageLook } from './pages'
import type { View } from './types'

/**
 * Everything behind the ink of one page: its colour and a paper whose pattern starts at `origin`.
 * Screen, thumbnails, the page map, PNG and PDF all paint it through `paintBackdrop`, so they agree.
 */
export interface Backdrop { color: string; paper: Paper; origin: [number, number] }

/** The backdrop of a page or frame: what it sets itself, otherwise the board's base. */
export function backdropOf(base: { color: string; paper: Paper }, look: PageLook = {}): Backdrop {
  return { color: look.color ?? base.color, paper: look.paper ?? base.paper, origin: look.paper ? look.origin ?? [0, 0] : [0, 0] }
}

/**
 * Colour (when `opaque`) and paper over the whole canvas. `view` and `w`×`h` are in world units and
 * CSS pixels; `dpr` scales them to the canvas. Transparent output keeps only the paper lines.
 */
export function paintBackdrop(ctx: CanvasRenderingContext2D, view: View, w: number, h: number, dpr: number, b: Backdrop, opaque = true): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  if (opaque) {
    ctx.fillStyle = b.color
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  }
  paintGrid(ctx, { x: view.x - b.origin[0], y: view.y - b.origin[1], zoom: view.zoom }, w, h, dpr, b.paper, isDarkColor(b.color), !opaque)
}
