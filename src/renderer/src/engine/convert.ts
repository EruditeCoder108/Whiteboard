import { itemBounds, translateItem } from './items'
import { DEFAULT_FRAME, MAX_EXTENT, PAGE_H, PAGE_W, STYLE_KEYS, frameForContent, frameRect } from './pages'
import type { Frame, LookFrame, PageLook } from './pages'
import type { Paper } from './grid'
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

/** A paper origin moved along with the ink it sits under; (0, 0) is "not set". */
const moved = (origin: [number, number] | undefined, dx: number, dy: number): [number, number] | undefined => {
  const x = (origin?.[0] ?? 0) + dx || 0, y = (origin?.[1] ?? 0) + dy || 0
  return x || y ? [x, y] : undefined
}

/** The paper settings (spacing, strength, line colour) of a look, to travel with its paper. */
const paperStyle = (look: PageLook): PageLook => {
  const out: PageLook = {}
  for (const k of STYLE_KEYS) if (look[k] !== undefined) (out as Record<string, unknown>)[k] = look[k]
  return out
}

/** Where the next frame goes on a canvas: to the right of the last frame, or of the drawing. */
export function nextFrameSlot(frames: Frame[], items: Item[]): { x: number; y: number } {
  const last = frames.at(-1)
  if (last) return { x: last.x + PAGE_W + FRAME_GAP, y: last.y }
  const b = bounds(items)
  return b ? { x: Math.ceil(b[2] + FRAME_GAP), y: Math.floor(b[1]) } : { x: 0, y: 0 }
}

/**
 * Notebook → canvas: the sheets side by side, left to right in page order, each one a frame that
 * keeps its page's paper, colour and title (the paper pattern moves with its ink).
 */
export function notebookToCanvas(pages: ({ items: Item[]; frame?: Frame } & PageLook)[]): { items: Item[]; frames: LookFrame[] } {
  const items: Item[] = [], frames: LookFrame[] = []
  let x = 0
  for (const pg of pages) {
    const f = pg.frame ?? frameForContent(bounds(pg.items))
    const dx = x - f.x, dy = -f.y
    for (const it of pg.items) items.push(translateItem(it, dx, dy))
    const frame: LookFrame = { x, y: 0, extent: f.extent }
    if (pg.paper) { frame.paper = pg.paper; Object.assign(frame, paperStyle(pg)); const origin = moved(pg.origin, dx, dy); if (origin) frame.origin = origin }
    if (pg.color) frame.color = pg.color
    if (pg.texture) frame.texture = pg.texture
    if (pg.title) frame.title = pg.title
    if (pg.art) frame.art = pg.art // placed on the sheet, so it moves with it
    frames.push(frame)
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
 * object's centre) with the frame's paper, colour and title. Frames without a paper of their own
 * show the canvas paper (`surface`), so the page looks as the frame did. Drawing outside all
 * frames is covered by extra pages, so nothing is lost. `surface` is the canvas's own look (or just
 * its paper); a canvas without frames hands its background picture to the first page.
 */
export function canvasToNotebook(items: Item[], frames: LookFrame[], surface: Paper | PageLook = 'none'): ({ items: Item[]; frame: Frame } & PageLook)[] {
  const base: PageLook = typeof surface === 'string' ? { paper: surface } : surface
  const sheets = frames.map(f => ({ f, items: [] as Item[] }))
  const rest: Item[] = []
  for (const it of items) {
    const sheet = sheets.find(s => holds(s.f, centre(it)))
    if (sheet) sheet.items.push(it)
    else rest.push(it)
  }
  const b = bounds(rest)
  if (b) {
    const extra = tileFrames(b).map(f => ({ f: f as LookFrame, items: [] as Item[] }))
    for (const it of rest) (extra.find(s => holds(s.f, centre(it))) ?? extra[0]).items.push(it)
    sheets.push(...extra.filter(s => s.items.length))
  }
  const surfaceArt = !frames.length && base.art ? { art: base.art } : {}
  if (!sheets.length) return [{ items: [], frame: { ...DEFAULT_FRAME }, paper: base.paper ?? 'none', ...paperStyle(base), ...surfaceArt }]
  return sheets.map(({ f, items: inside }, i) => {
    const page: { items: Item[]; frame: Frame } & PageLook = {
      items: inside.map(it => translateItem(it, -f.x, -f.y)), frame: { x: 0, y: 0, extent: f.extent },
      paper: f.paper ?? base.paper ?? 'none', ...paperStyle(f.paper ? f : base)
    }
    const origin = moved(f.paper ? f.origin : base.origin, -f.x, -f.y)
    if (origin) page.origin = origin
    if (f.color) page.color = f.color
    if (f.texture) page.texture = f.texture
    if (f.title) page.title = f.title
    if (f.art) page.art = f.art
    else if (i === 0) Object.assign(page, surfaceArt)
    return page
  })
}
