import type { ClipItem, Rect } from './types'

/** Clips live inside the lesson, so it travels whole. Beyond this every autosave would drag, so a larger file is refused with a reason. */
export const MAX_CLIP_BYTES = 28 * 1024 * 1024
export const CLIP_SOURCE = /^data:(?:video\/(?:mp4|webm|ogg)|audio\/(?:mpeg|mp3|mp4|x-m4a|wav|x-wav|ogg|webm|aac))[;,]/
export const isClipFile = (type: string, name: string): boolean => /^(video|audio)\//.test(type) || /\.(mp4|webm|ogv|mp3|m4a|wav|ogg|aac)$/i.test(name)

const posters = new Map<string, HTMLImageElement>()

/** The middle of the clip's box: tapping here plays it, wherever a pen may have drawn around it. */
export function playSpot(p: Rect): { x: number; y: number; r: number } {
  const w = Math.abs(p[2] - p[0]), h = Math.abs(p[3] - p[1])
  return { x: (p[0] + p[2]) / 2, y: (p[1] + p[3]) / 2, r: Math.max(26, Math.min(w, h) * .24) }
}

export function paintClip(ctx: CanvasRenderingContext2D, it: ClipItem): void {
  const [x0, y0, x1, y1] = it.p, w = x1 - x0, h = y1 - y0
  const { x, y, r } = playSpot(it.p)
  ctx.save()
  ctx.beginPath(); ctx.roundRect(x0, y0, w, h, Math.min(16, h * .12))
  ctx.fillStyle = it.kind === 'audio' ? '#23304d' : '#111827'
  ctx.fill()
  ctx.clip()
  if (it.poster) {
    let img = posters.get(it.poster)
    if (!img) { img = new Image(); img.src = it.poster; posters.set(it.poster, img) }
    if (img.complete && img.naturalWidth) ctx.drawImage(img, x0, y0, w, h)
  }
  const font = Math.max(12, Math.min(26, h * .09))
  if (it.name) {
    ctx.fillStyle = 'rgba(8, 12, 24, .62)'
    ctx.fillRect(x0, y1 - font * 1.8, w, font * 1.8)
    ctx.fillStyle = '#ffffff'
    ctx.font = `600 ${font}px "Segoe UI", "Nirmala UI", sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(it.name, x0 + w / 2, y1 - font * .9, w * .92)
  }
  ctx.restore()
  ctx.save()
  ctx.fillStyle = 'rgba(255, 255, 255, .94)'
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#172033'
  ctx.beginPath(); ctx.moveTo(x - r * .34, y - r * .5); ctx.lineTo(x + r * .56, y); ctx.lineTo(x - r * .34, y + r * .5); ctx.closePath(); ctx.fill()
  ctx.restore()
}

/** Bytes for a player, without keeping a second copy of the data URL's text alive in the page. */
export function clipBlob(src: string): Blob {
  const comma = src.indexOf(',')
  const type = src.slice(5, src.indexOf(';'))
  const raw = atob(src.slice(comma + 1))
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return new Blob([bytes], { type })
}
