import { itemBounds, translateItem } from './items'
import { DEFAULT_FRAME, MAX_EXTENT, PAGE_H, PAGE_W, frameForContent, frameRect } from './pages'
import type { Frame } from './pages'
import type { Item, Rect } from './types'

/** Space between frames laid out side by side on a canvas. */
export const FRAME_GAP = 200

const bounds = (items: Item[]): Rect | null => {
  let r: Rect | null = null
  for (const it of items) {
    const b = itemBounds(it)
    r = r ? [Math.min(r[0], b[0]), Math.min(r[1], b[1]), Math.max(r[2], b[2]), Math.max(r[3], b[3])] : b
  }
  return r
}

const centre = (it: Item): [number, number] => { const b = itemBounds(it); return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] }
const holds = (f: Frame, [x, y]: [number, number]): boolean => { const r = frameRect(f); return x >= r[0] && x < r[2] && y >= r[1] && y < r[3] }

/** Where the next frame goes on a canvas: to the right of the last frame, or of the drawing. */
export function nextFrameSlot(frames: Frame[], items: Item[]): { x: number; y: number } {
  const last = frames.at(-1)
  if (last) return { x: last.x + PAGE_W + FRAME_GAP, y: last.y }
  const b = bounds(items)
  return b ? { x: Math.ceil(b[2] + FRAME_GAP), y: Math.floor(b[1]) } : { x: 0, y: 0 }
}

/** Notebook → canvas: the sheets side by side, left to right in page order, each one a frame. */
export function notebookToCanvas(pages: { items: Item[]; frame?: Frame }[]): { items: Item[]; frames: Frame[] } {
  const items: Item[] = [], frames: Frame[] = []
  let x = 0
  for (const pg of pages) {
    const f = pg.frame ?? frameForContent(bounds(pg.items))
    for (const it of pg.items) items.push(translateItem(it, x - f.x, -f.y))
    frames.push({ x, y: 0, extent: f.extent })
    x += PAGE_W + FRAME_GAP
  }
  return { items, frames }
}

/** Sheets covering a drawing: columns a page wide, each as tall as the drawing (up to 8 screens). */
export function tileFrames(b: Rect): Frame[] {
  const x0 = Math.floor(b[0] - 40), y0 = Math.floor(b[1] - 40)
  const cols = Math.max(1, Math.ceil((b[2] + 40 - x0) / PAGE_W))
  const screens = Math.max(1, Math.ceil((b[3] + 40 - y0) / PAGE_H))
  const out: Frame[] = []
  for (let top = 0; top < screens; top += MAX_EXTENT)
    for (let c = 0; c < cols; c++) out.push({ x: x0 + c * PAGE_W, y: y0 + top * PAGE_H, extent: Math.min(MAX_EXTENT, screens - top) })
  return out
}

/**
 * Canvas → notebook: every frame becomes a page holding what is drawn in it (judged by each
 * object's centre). Drawing outside all frames is covered by extra pages, so nothing is lost.
 */
export function canvasToNotebook(items: Item[], frames: Frame[]): { items: Item[]; frame: Frame }[] {
  const sheets = frames.map(f => ({ f, items: [] as Item[] }))
  const rest: Item[] = []
  for (const it of items) {
    const sheet = sheets.find(s => holds(s.f, centre(it)))
    if (sheet) sheet.items.push(it)
    else rest.push(it)
  }
  const b = bounds(rest)
  if (b) {
    const extra = tileFrames(b).map(f => ({ f, items: [] as Item[] }))
    for (const it of rest) (extra.find(s => holds(s.f, centre(it))) ?? extra[0]).items.push(it)
    sheets.push(...extra.filter(s => s.items.length))
  }
  if (!sheets.length) return [{ items: [], frame: { ...DEFAULT_FRAME } }]
  return sheets.map(s => ({ items: s.items.map(it => translateItem(it, -s.f.x, -s.f.y)), frame: { x: 0, y: 0, extent: s.f.extent } }))
}
