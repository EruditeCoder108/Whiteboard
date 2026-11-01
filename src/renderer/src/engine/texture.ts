/**
 * Board surfaces: a quiet texture laid over the board colour, so a blackboard reads as slate with
 * old chalk dust and a paper board as paper. Tiles are generated in code (no image assets, the same on
 * every PC), seamless, and painted at a fixed size on screen: the grain stays fine at any zoom and
 * moves with the board when it is panned. The texture only darkens and lightens; the colour is the
 * board colour, so any colour can have any texture.
 *  - chalk: soft clouds of erased chalk, faint eraser strokes and a fine grain
 *  - slate: natural stone with mineral flecks
 *  - paper: fibres and gentle mottling
 */
export const TEXTURES = ['none', 'chalk', 'slate', 'paper'] as const
export type Texture = (typeof TEXTURES)[number]
export const isTexture = (v: unknown): v is Texture => typeof v === 'string' && (TEXTURES as readonly string[]).includes(v)

/** Side of a tile in pixels: large enough that the repeat is not noticed. */
export const TILE = 512

/** Deterministic hash of a lattice point to [0, 1). */
function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const smooth = (t: number): number => t * t * (3 - 2 * t)
const wrap = (i: number, n: number): number => ((i % n) + n) % n

/**
 * Value noise that repeats every `cellsX` × `cellsY` cells across a tile of `size` pixels, so the tile
 * joins up with itself on every side. Different cell counts per axis stretch it into streaks.
 */
export function tileNoise(x: number, y: number, size: number, cellsX: number, cellsY: number, seed: number): number {
  const fx = x / size * cellsX, fy = y / size * cellsY
  const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = smooth(fx - x0), ty = smooth(fy - y0)
  const v = (i: number, j: number): number => hash(wrap(i, cellsX), wrap(j, cellsY), seed)
  const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * tx
  const b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * tx
  return a + (b - a) * ty
}

/** Several octaves of `tileNoise`, still seamless, in [0, 1]. */
export function tileFbm(x: number, y: number, size: number, cellsX: number, cellsY: number, octaves: number, seed: number): number {
  let sum = 0, amp = 1, total = 0
  for (let o = 0; o < octaves; o++) {
    sum += tileNoise(x, y, size, cellsX << o, cellsY << o, seed + o * 101) * amp
    total += amp; amp *= .5
  }
  return sum / total
}

const band = (v: number, lo: number, hi: number): number => v <= lo ? 0 : v >= hi ? 1 : smooth((v - lo) / (hi - lo))

/**
 * A texture has two layers, so its repeat is never noticed:
 *  - grain: fine detail (grain, flecks, fibres) in a tile drawn pixel for pixel; it repeats every 512
 *    pixels, but fine grain has nothing for the eye to catch on
 *  - clouds: soft, large patches (old chalk, mottling) made at low resolution and drawn `CLOUD_SCALE`
 *    times larger, so one repeat spans most of a screen
 */
export const CLOUD_TILE = 256
export const CLOUD_SCALE = 7

/** White and black amounts as a grey-with-alpha RGBA tile, to lay over any colour. */
function toRgba(white: Float32Array, black: Float32Array): Uint8ClampedArray {
  const n = white.length, out = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n; i++) {
    const w = Math.min(.35, white[i]), b = Math.min(.35, black[i]), a = w + b
    if (a <= 0) continue
    const v = Math.round(255 * w / a)
    out[i * 4] = v; out[i * 4 + 1] = v; out[i * 4 + 2] = v; out[i * 4 + 3] = Math.round(Math.min(1, a) * 255)
  }
  return out
}

/**
 * The cloud layer as RGBA bytes: chalk that was wiped but never quite came off, with long soft
 * eraser sweeps; the gentle unevenness of stone or paper. Pure, so tests can check it without a canvas.
 */
export function cloudTile(kind: Texture, size = CLOUD_TILE, seed = 7): Uint8ClampedArray {
  const n = size * size
  const white = new Float32Array(n), black = new Float32Array(n)
  for (let y = 0, i = 0; y < size; y++) for (let x = 0; x < size; x++, i++) {
    const c = tileFbm(x, y, size, 3, 3, 5, seed)
    if (kind === 'chalk') {
      white[i] = band(c, .5, .85) * .085 + band(tileFbm(x, y, size, 1, 7, 4, seed + 31), .6, .92) * .03
      black[i] = band(1 - c, .62, .9) * .03
    } else if (kind === 'slate') {
      white[i] = band(c, .58, .9) * .03
      black[i] = band(1 - c, .55, .88) * .05
    } else if (kind === 'paper') {
      black[i] = band(c, .55, .88) * .035
      white[i] = band(1 - c, .58, .9) * .025
    }
  }
  return toRgba(white, black)
}

/**
 * The grain layer as RGBA bytes. Each pixel blends a white amount (dust, flecks) and a black amount
 * (pores, fibres); both stay small, so ink keeps its contrast. Pure, so tests can check it.
 */
export function textureTile(kind: Texture, size = TILE, seed = 7): Uint8ClampedArray {
  const n = size * size
  const white = new Float32Array(n), black = new Float32Array(n)
  const rand = (i: number, k: number): number => hash(i, k, seed + 999)
  if (kind === 'chalk' || kind === 'slate') {
    const chalk = kind === 'chalk'
    for (let y = 0, i = 0; y < size; y++) for (let x = 0; x < size; x++, i++) {
      const g = rand(i, 1)
      white[i] = g > .62 ? (g - .62) * (chalk ? .08 : .09) : 0
      black[i] = g < .3 ? (.3 - g) * (chalk ? .14 : .2) : 0
      // a fine, even dusting of chalk in the pores of the board
      if (chalk) white[i] += band(tileNoise(x, y, size, 128, 128, seed + 3), .55, .95) * .03
      else {
        // mineral flecks in the stone: a few bright, more dark
        const f = rand(i, 2)
        if (f > .9965) white[i] += .16 * band(tileNoise(x, y, size, 64, 64, seed + 5), .3, .9)
        else if (f < .006) black[i] += .14
        black[i] += band(tileNoise(x, y, size, 96, 96, seed + 77), .6, .95) * .05
      }
    }
  } else if (kind === 'paper') {
    for (let i = 0; i < n; i++) {
      const g = rand(i, 1)
      black[i] = g < .25 ? (.25 - g) * .07 : 0
      white[i] = g > .8 ? (g - .8) * .06 : 0
    }
    // fibres: short, faint strands at every angle, wrapping round the tile edges
    const count = Math.round(n / 260)
    for (let k = 0; k < count; k++) {
      const x0 = rand(k, 11) * size, y0 = rand(k, 12) * size, a = rand(k, 13) * Math.PI
      const len = 3 + rand(k, 14) * 8, dark = rand(k, 15) < .55, strength = .012 + rand(k, 16) * .02
      for (let s = 0; s < len; s++) {
        const i = wrap(Math.round(y0 + Math.sin(a) * s), size) * size + wrap(Math.round(x0 + Math.cos(a) * s), size)
        if (dark) black[i] += strength; else white[i] += strength
      }
    }
  }
  return toRgba(white, black)
}

const tiles = new Map<string, HTMLCanvasElement>()
/** A layer as a canvas, made once per texture. */
function layerCanvas(kind: Texture, layer: 'grain' | 'cloud'): HTMLCanvasElement {
  const key = kind + layer
  let cv = tiles.get(key)
  if (!cv) {
    const size = layer === 'grain' ? TILE : CLOUD_TILE
    cv = document.createElement('canvas')
    cv.width = cv.height = size
    const data = layer === 'grain' ? textureTile(kind) : cloudTile(kind)
    cv.getContext('2d')!.putImageData(new ImageData(data as Uint8ClampedArray<ArrayBuffer>, size, size), 0, 0)
    tiles.set(key, cv)
  }
  return cv
}

/**
 * Lay the texture over the whole canvas. `offsetX/Y` (device pixels) is where the world origin is on
 * the canvas, so the texture moves with the board; `scale` is device pixels per tile pixel (the DPR).
 */
export function paintTexture(ctx: CanvasRenderingContext2D, kind: Texture, offsetX: number, offsetY: number, scale: number, opacity = 1): void {
  if (kind === 'none' || opacity <= 0) return
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = opacity
  ctx.imageSmoothingEnabled = true
  for (const [layer, size, k] of [['cloud', CLOUD_TILE, scale * CLOUD_SCALE], ['grain', TILE, scale]] as const) {
    const pattern = ctx.createPattern(layerCanvas(kind, layer), 'repeat')
    if (!pattern) continue
    // Only the offset within one repeat matters; keeping it small keeps the pattern exact far from the origin.
    const period = size * k
    pattern.setTransform(new DOMMatrix([k, 0, 0, k, offsetX % period, offsetY % period]))
    ctx.fillStyle = pattern
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  }
  ctx.restore()
}
