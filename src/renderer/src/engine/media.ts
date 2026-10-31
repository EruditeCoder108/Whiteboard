import type { ImageItem, Item } from './types'

/** Longest side kept for imported pictures; enough for a projector, small enough to stay fast. */
export const MAX_IMAGE_SIDE = 2400

const decoded = new Map<string, HTMLImageElement>()
const loading = new Set<string>()
let ready: (() => void) | null = null

/** The board repaints once a picture finishes decoding. */
export function onImageReady(fn: () => void): void { ready = fn }

/** Equations are SVG drawn in `currentColor`; the item's colour is substituted when painting. */
const coloured = new WeakMap<ImageItem, string>()
function sourceFor(it: ImageItem): string {
  if (it.latex === undefined || !it.src.startsWith('data:image/svg+xml')) return it.src
  let src = coloured.get(it)
  if (!src) {
    const svg = decodeURIComponent(it.src.slice(it.src.indexOf(',') + 1))
    src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replaceAll('currentColor', it.c))
    coloured.set(it, src)
  }
  return src
}

function load(src: string): Promise<HTMLImageElement> {
  const done = decoded.get(src)
  if (done) return Promise.resolve(done)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => { decoded.set(src, img); loading.delete(src); resolve(img); ready?.() }
    img.onerror = () => { loading.delete(src); reject(new Error('Could not decode image')) }
    loading.add(src)
    img.src = src
  })
}

export function paintImage(ctx: CanvasRenderingContext2D, it: ImageItem): void {
  const [x0, y0, x1, y1] = it.p
  const src = sourceFor(it)
  const img = decoded.get(src)
  if (img) {
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0)
    // A hairline edge keeps white pages (PDF worksheets) visible on a white board.
    if (it.latex === undefined) { ctx.strokeStyle = 'rgba(100,110,130,.35)'; ctx.lineWidth = Math.max(.5, (x1 - x0) / 1200); ctx.strokeRect(x0, y0, x1 - x0, y1 - y0) }
    return
  }
  if (!loading.has(src)) void load(src).catch(() => {})
  if (it.latex !== undefined) return
  ctx.fillStyle = 'rgba(128,128,128,.12)'
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
}

/** Decode every picture first, for exports that paint pages the user has not opened. */
export async function preloadImages(items: Item[]): Promise<void> {
  await Promise.all(items.filter((it): it is ImageItem => it.t === 'i').map(it => load(sourceFor(it)).catch(() => {})))
}

/** Downscale and re-encode an imported picture. WebP keeps transparency at a fraction of PNG size. */
export async function imageFromBlob(blob: Blob): Promise<{ src: string; width: number; height: number }> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el); el.onerror = () => reject(new Error('This file is not a supported picture'))
      el.src = url
    })
    const width = img.naturalWidth || 800, height = img.naturalHeight || 600
    return { src: rasterize(img, width, height), width, height }
  } finally { URL.revokeObjectURL(url) }
}

export function rasterize(source: CanvasImageSource, width: number, height: number, quality = .9): string {
  const k = Math.min(1, MAX_IMAGE_SIDE / Math.max(width, height))
  const cv = document.createElement('canvas')
  cv.width = Math.max(1, Math.round(width * k)); cv.height = Math.max(1, Math.round(height * k))
  const ctx = cv.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, cv.width, cv.height)
  return cv.toDataURL('image/webp', quality)
}

const keys = new Map<string, string>()
/** Content key for a picture: FNV-1a over the data URL, cached per string. */
export function assetKey(src: string): string {
  let key = keys.get(src)
  if (key) return key
  let a = 0x811c9dc5, b = 0x01000193 ^ src.length
  for (let i = 0; i < src.length; i++) {
    const c = src.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193)
    b = Math.imul(b ^ c, 0x5bd1e995)
  }
  key = (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0') + src.length.toString(16)
  keys.set(src, key)
  return key
}
