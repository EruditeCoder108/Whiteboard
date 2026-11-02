import type { PenStyle, StrokeItem } from './types'

/** What the plain pen is called where a choice is shown; a stroke with no `style` is this pen. */
export type PenChoice = 'pen' | PenStyle

export const PEN_CHOICES: { id: PenChoice; label: string }[] = [
  { id: 'pen', label: 'Pen' }, { id: 'pencil', label: 'Pencil' }, { id: 'brush', label: 'Brush' }, { id: 'chalk', label: 'Chalk' }, { id: 'felt', label: 'Marker' }
]

/** The size buttons stay Thin / Medium / Thick for every pen, so each style sets how wide that really is. */
const WIDTH: Record<PenChoice, number> = { pen: 1, pencil: .8, brush: 1.7, chalk: 1.6, felt: 2 }
export const inkWidth = (size: number, style: PenChoice): number => Math.round(size * WIDTH[style] * 10) / 10

/** A brush thins with speed even without a pressure pen; chalk and the marker keep a steady hand. */
export const inkVaries = (style: PenChoice): boolean => style !== 'chalk' && style !== 'felt'
export const inkFollowsSpeed = (style: PenChoice): boolean => style === 'brush'

/** How a stroke's outline is built (see perfect-freehand). `null` end taper keeps a round cap. */
export function outlineOptions(style: PenStyle | undefined, w: number, varies: boolean, points: number): { thinning: number; smoothing: number; streamline: number; start: { cap: boolean; taper?: number }; end: { cap: boolean; taper?: number } } {
  const round = { start: { cap: true }, end: { cap: true } }
  switch (style) {
    case 'pencil': return { thinning: varies ? .35 : 0, smoothing: .5, streamline: .25, ...round }
    // A dab must stay a dab: tapers only once there is a stroke to taper.
    case 'brush': return { thinning: .75, smoothing: .6, streamline: .3, ...(points >= 6 ? { start: { cap: false, taper: w * 2.5 }, end: { cap: false, taper: w * 4 } } : round) }
    case 'chalk': return { thinning: 0, smoothing: .4, streamline: .15, ...round }
    case 'felt': return { thinning: .5, smoothing: .55, streamline: .25, ...round }
    default: return { thinning: varies ? .6 : 0, smoothing: .55, streamline: .2, ...round }
  }
}

/**
 * A marker's chisel tip: thick when the hand travels across the tip, thin along it, the same at any speed.
 * Written as pressure so the outline code needs no special case.
 */
export function chiselPressures(flat: number[]): [number, number, number][] {
  const out: [number, number, number][] = []
  let last = .75
  for (let i = 0; i + 2 < flat.length; i += 3) {
    const x = flat[i], y = flat[i + 1]
    if (i >= 3) {
      const dx = x - flat[i - 3], dy = y - flat[i - 2]
      if (dx || dy) {
        const across = Math.abs(Math.sin(Math.atan2(dy, dx) + Math.PI / 4))
        last = last * .7 + (.35 + .55 * across) * .3
      }
    }
    out.push([x, y, last])
  }
  return out
}

/** Same seed, same grain: the screen, thumbnails, PNG and PDF all show the same chalk. */
export function grainValue(seed: number): number {
  const v = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return v - Math.floor(v)
}

const TILE = 256

/** How opaque one grain cell is: chalk leaves gaps in the board's surface; a pencil only leaves it thin. */
export function grainAlpha(kind: 'chalk' | 'pencil', fine: number, coarse: number): number {
  const n = fine * .55 + coarse * .45
  if (kind === 'chalk') return n < .3 ? 0 : Math.min(1, .5 + n * .6)
  return n < .14 ? .25 : Math.min(1, .6 + n * .5)
}

const grains = new Map<string, CanvasPattern>()

/** A seamless tile of one colour with holes in it. Patterns follow the view, so the grain stays put on the board. */
function grain(ctx: CanvasRenderingContext2D, kind: 'chalk' | 'pencil', color: string): CanvasPattern | null {
  const key = kind + color
  const hit = grains.get(key)
  if (hit) return hit
  const tile = document.createElement('canvas')
  tile.width = tile.height = TILE
  const g = tile.getContext('2d')
  if (!g) return null
  g.fillStyle = color
  g.fillRect(0, 0, 1, 1)
  const [r, gr, b] = g.getImageData(0, 0, 1, 1).data
  const image = g.createImageData(TILE, TILE)
  const cell = kind === 'chalk' ? 3 : 2
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const fine = grainValue(x + y * TILE)
    const coarse = grainValue(1e5 + Math.floor(x / cell) + Math.floor(y / cell) * TILE)
    const i = (x + y * TILE) * 4
    image.data[i] = r; image.data[i + 1] = gr; image.data[i + 2] = b
    image.data[i + 3] = Math.round(255 * grainAlpha(kind, fine, coarse))
  }
  g.putImageData(image, 0, 0)
  const pattern = ctx.createPattern(tile, 'repeat')
  if (pattern) {
    if (grains.size > 64) grains.clear()
    grains.set(key, pattern)
  }
  return pattern
}

/** Fill a stroke's outline in its pen style. The context already holds the stroke's alpha. */
export function paintInk(ctx: CanvasRenderingContext2D, it: StrokeItem, outline: Path2D): void {
  if (it.style === 'chalk' || it.style === 'pencil') {
    ctx.fillStyle = grain(ctx, it.style, it.c) ?? it.c
    ctx.fill(outline)
    return
  }
  ctx.fillStyle = it.c
  ctx.fill(outline)
}
