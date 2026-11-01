import { isDarkColor } from './colour'
import { PRESET, isLayout, paintGrid } from './grid'
import type { Paper, PaperStyle } from './grid'
import { decodedImage } from './media'
import { PAGE_H, PAGE_W } from './pages'
import type { Artwork, PageLook } from './pages'
import type { Rect, View } from './types'

/**
 * Everything behind the ink of one page: its colour, a background picture and a paper whose
 * pattern starts at `origin`. `sheet` is the page (or frame) in world units; a canvas has none.
 * Screen, thumbnails, the page map, PNG and PDF all paint it through `paintBackdrop`, so they agree.
 * `adapt`: the open canvas on screen, where writing papers follow the zoom.
 */
export interface Backdrop { color: string; paper: Paper; origin: [number, number]; style: PaperStyle; art?: Artwork; sheet?: Rect; adapt?: boolean }

/** The paper settings of a look, the preset where it sets none. */
export const styleOf = (look: PageLook): PaperStyle => ({ spacing: look.spacing ?? 1, strength: look.strength ?? 1, ...(look.lines ? { lines: look.lines } : {}) })

/**
 * The backdrop of a page or frame: what it sets itself, otherwise the base (the lesson, or the canvas
 * a frame sits on). The paper settings go with the paper; a picture belongs to its own page only.
 */
export function backdropOf(base: PageLook & { color: string; paper: Paper }, look: PageLook = {}, sheet?: Rect): Backdrop {
  const own = !!look.paper
  return {
    color: look.color ?? base.color, paper: look.paper ?? base.paper, origin: own ? look.origin ?? [0, 0] : base.origin ?? [0, 0],
    style: own ? styleOf(look) : styleOf(base), ...(look.art ? { art: look.art } : {}), ...(sheet ? { sheet } : {})
  }
}

/** The screens of a page in world units, or for a canvas the page-sized tiles from `origin` that are in view. */
export function screensOf(b: Pick<Backdrop, 'sheet' | 'origin'>, visible: Rect): Rect[] {
  if (b.sheet) {
    const [x0, y0, x1, y1] = b.sheet, out: Rect[] = []
    for (let y = y0; y < y1 - 1; y += PAGE_H) out.push([x0, y, x1, Math.min(y1, y + PAGE_H)])
    return out
  }
  const [ox, oy] = b.origin
  const i0 = Math.floor((visible[0] - ox) / PAGE_W), i1 = Math.floor((visible[2] - ox) / PAGE_W)
  const j0 = Math.floor((visible[1] - oy) / PAGE_H), j1 = Math.floor((visible[3] - oy) / PAGE_H)
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > 400) return [] // too far out to see either
  const out: Rect[] = []
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) out.push([ox + i * PAGE_W, oy + j * PAGE_H, ox + (i + 1) * PAGE_W, oy + (j + 1) * PAGE_H])
  return out
}

/** Where a picture of `iw`×`ih` goes in `r`: fitted whole, or filling it (cropped by `clip`), placed by `align`. */
export function placeArt(art: Pick<Artwork, 'fit' | 'align'>, iw: number, ih: number, r: Rect): Rect {
  const W = r[2] - r[0], H = r[3] - r[1]
  const k = art.fit === 'fill' ? Math.max(W / iw, H / ih) : Math.min(W / iw, H / ih)
  const w = iw * k, h = ih * k
  const x = r[0] + (W - w) * art.align[0], y = r[1] + (H - h) * art.align[1]
  return [x, y, x + w, y + h]
}

/** The rectangles (world units) a background picture is shown in. */
export function artTargets(b: Backdrop, visible: Rect): Rect[] {
  const art = b.art
  if (!art) return []
  if (art.span === 'whole' && b.sheet) return [b.sheet]
  if (art.span === 'each') return screensOf(b, visible)
  const [ox, oy] = b.sheet ? [b.sheet[0], b.sheet[1]] : b.origin
  return [[ox, oy, ox + PAGE_W, oy + PAGE_H]]
}

/**
 * Colour (when `opaque`), picture and paper over the whole canvas. `view` and `w`×`h` are in world
 * units and CSS pixels; `dpr` scales them to the canvas. Transparent output keeps the picture and
 * paper lines over nothing.
 */
export function paintBackdrop(ctx: CanvasRenderingContext2D, view: View, w: number, h: number, dpr: number, b: Backdrop, opaque = true): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  if (opaque) {
    ctx.fillStyle = b.color
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  } else ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  const visible: Rect = [view.x, view.y, view.x + w / view.zoom, view.y + h / view.zoom]
  const img = b.art && decodedImage(b.art.src)
  if (b.art && img) {
    const z = view.zoom * dpr
    ctx.save()
    ctx.setTransform(z, 0, 0, z, -view.x * z, -view.y * z)
    ctx.globalAlpha = b.art.opacity
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    for (const r of artTargets(b, visible)) {
      if (r[2] < visible[0] || r[0] > visible[2] || r[3] < visible[1] || r[1] > visible[3]) continue
      const p = placeArt(b.art, img.naturalWidth || 1, img.naturalHeight || 1, r)
      ctx.save()
      ctx.beginPath(); ctx.rect(r[0], r[1], r[2] - r[0], r[3] - r[1]); ctx.clip()
      ctx.drawImage(img, p[0], p[1], p[2] - p[0], p[3] - p[1])
      ctx.restore()
    }
    ctx.restore()
  }
  const [ox, oy] = b.origin
  const cells = isLayout(b.paper)
    ? screensOf(b, visible).map(([x0, y0, x1, y1]): Rect => [x0 - ox, y0 - oy, x1 - ox, y1 - oy]) : []
  paintGrid(ctx, { x: view.x - ox, y: view.y - oy, zoom: view.zoom }, w, h, dpr, b.paper, isDarkColor(b.color), false, b.style ?? PRESET, cells, b.adapt)
}
