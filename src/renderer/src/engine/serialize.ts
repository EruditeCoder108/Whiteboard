import { CLIP_SOURCE } from './clip'
import { safeLink } from './objects'
import { validStep } from './reveals'
import { MAX_POINTS, validAxis } from './scale'
import { validTable } from './table'
import type { TableItem } from './types'
import { PEN_STYLES } from './types'
import type { Anchor, ClipItem, GraphItem, ImageItem, Item, ObjectMeta, PenStyle, ScaleAxis, ScaleItem, ShapeItem, StrokeItem, TextItem, TextStyle, View } from './types'
import { assetKey } from './media'
import { artJson, hasLook, isBoardKind, lookJson, validArt, validLook, validLookFrame } from './pages'
import type { Artwork, BoardKind, Frame, LookFrame, PageLook } from './pages'
import { isTexture } from './texture'
import type { Texture } from './texture'
import { isBoardColor, sameColor, DEFAULT_BOARD_COLOR } from './colour'
import { isDefaultFrame, validFrame } from './pages'
import { newId } from './types'
import { MAX_ZOOM, MIN_ZOOM } from './view'
import { clamp } from './geometry'
import { validModelParams, labDuration, getModel } from './science/models'
import { validMagnetTrace } from './science/showcase-models'
import type { LabItem, LabReveal } from './types'

export const FORMAT = 'floating-whiteboard'
export const VERSION = 2
export const LAB_BOARD_VERSION = 3
/** Pages and pictures. Pictures live in a shared `assets` table, keyed by content. */
export const PAGES_VERSION = 4

export const MAX_TEXT_LENGTH = 100_000
const MAX_ID_LENGTH = 128
const MAX_IMAGE_CHARS = 40 * 1024 * 1024
const MAX_ITEMS = 100_000
const MAX_FILE_CHARS = 300 * 1024 * 1024
const MAX_PAGES = 500

const r2 = (v: number): number => Math.round(v * 100) / 100
const r3 = (v: number): number => Math.round(v * 1000) / 1000

export interface BoardFile {
  format: typeof FORMAT
  version: number
  view?: View
  items: unknown[]
}

export function itemToJson(it: Item): unknown {
  const meta: ObjectMeta = { group: it.group, locked: it.locked, opacity: it.opacity, step: it.step, ...(it.link ? { link: it.link } : {}) }
  if (it.t === 'l') return { ...it, p: [...it.p], params: { ...it.params }, reveal: { ...it.reveal }, ...(it.gesture ? { gesture: it.gesture.map(p => ({ ...p })) } : {}) }
  if (it.t === 'i') return { t: 'i', id: it.id, c: it.c, w: it.w, p: it.p.map(r2), angle: it.angle, src: it.src, aspect: it.aspect, latex: it.latex, ...(it.flipX ? { flipX: true } : {}), ...(it.flipY ? { flipY: true } : {}), ...meta }
  if (it.t === 'a') return { t: 'a', id: it.id, c: it.c, w: it.w, p: it.p.map(r2), angle: it.angle, kind: it.kind, params: { ...it.params }, ...meta }
  if (it.t === 'm') return { t: 'm', id: it.id, c: it.c, w: it.w, p: it.p.map(r2), angle: it.angle, kind: it.kind, src: it.src, name: it.name, poster: it.poster, aspect: it.aspect, ...meta }
  if (it.t === 'b') return { t: 'b', id: it.id, c: it.c, w: it.w, p: it.p.map(r2), angle: it.angle, cols: [...it.cols], rows: [...it.rows], cells: it.cells.map(row => [...row]), fontSize: it.fontSize, textColor: it.textColor, head: it.head, ...meta }
  if (it.t === 'n') return { t: 'n', id: it.id, c: it.c, w: it.w, p: it.p.map(r2), angle: it.angle, x: { ...it.x }, y: it.y && { ...it.y }, grid: it.grid, equal: it.equal, points: it.points?.map(q => [...q]), coords: it.coords, ...meta }
  if (it.t === 'g') return { t: 'g', id: it.id, c: it.c, w: it.w, p: it.p.map(r2), angle: it.angle, fns: [...it.fns], xr: [...it.xr], yr: [...it.yr], ...meta }
  if (it.t === 's') {
    const p: number[] = new Array(it.p.length)
    for (let i = 0; i + 2 < it.p.length; i += 3) {
      p[i] = r2(it.p[i])
      p[i + 1] = r2(it.p[i + 1])
      p[i + 2] = r3(it.p[i + 2])
    }
    return { t: 's', id: it.id, c: it.c, w: r2(it.w) || it.w, m: it.m ? 1 : 0, v: it.v ? 1 : 0, ...(it.style ? { style: it.style } : {}), p, ...meta }
  }
  const text: TextStyle = {
    text: it.text, fontSize: it.fontSize, bold: it.bold, italic: it.italic,
    align: it.align, list: it.list, textColor: it.textColor
  }
  const common = { id: it.id, c: it.c, w: r2(it.w) || it.w, p: it.p.map(r2), angle: it.angle, fill: it.fill, ...meta, ...text }
  if (it.t === 't') return { t: 't', ...common, note: it.note }
  return { t: 'h', ...common, k: it.k, dash: it.dash, radius: it.radius, from: it.from, to: it.to, elbow: it.elbow, ...(it.wire ? { wire: true } : {}) }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isColor = (v: unknown): v is string => typeof v === 'string' && /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)
const isCoord = (v: unknown): v is number => isNum(v) && Math.abs(v) <= 1e9
const isFlag = (v: unknown): boolean => v === undefined || typeof v === 'boolean' || v === 0 || v === 1
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= MAX_ID_LENGTH && v.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(v)
const isText = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_TEXT_LENGTH
const isFontSize = (v: unknown): v is number => isNum(v) && v >= 1 && v <= 1000
const isFill = (v: unknown): v is string => v === 'none' || isColor(v)

/** Optional values must be valid when present, not silently discarded on load. */
function objectMeta(o: Record<string, unknown>): ObjectMeta | null {
  if (o.group !== undefined && !isId(o.group)) return null
  if (o.locked !== undefined && typeof o.locked !== 'boolean') return null
  if (o.opacity !== undefined && (!isNum(o.opacity) || o.opacity < 0 || o.opacity > 1)) return null
  const meta: ObjectMeta = {}
  if (o.group !== undefined) meta.group = o.group as string
  if (o.locked !== undefined) meta.locked = o.locked as boolean
  if (o.opacity !== undefined) meta.opacity = o.opacity as number
  // A bad step only loses the step, never the object: better a visible answer than a lost one.
  const step = validStep(o.step)
  if (step) meta.step = step
  // A link that is not an ordinary web address is dropped, never opened.
  const link = safeLink(o.link)
  if (link) meta.link = link
  return meta
}

function textStyle(o: Record<string, unknown>): TextStyle | null {
  if (o.text !== undefined && !isText(o.text)) return null
  if (o.fontSize !== undefined && !isFontSize(o.fontSize)) return null
  if (o.bold !== undefined && typeof o.bold !== 'boolean') return null
  if (o.italic !== undefined && typeof o.italic !== 'boolean') return null
  if (o.align !== undefined && !['left', 'center', 'right'].includes(o.align as string)) return null
  if (o.list !== undefined && !['none', 'bullet', 'number'].includes(o.list as string)) return null
  if (o.textColor !== undefined && !isColor(o.textColor)) return null
  const style: TextStyle = {}
  if (o.text !== undefined) style.text = o.text as string
  if (o.fontSize !== undefined) style.fontSize = o.fontSize as number
  if (o.bold !== undefined) style.bold = o.bold as boolean
  if (o.italic !== undefined) style.italic = o.italic as boolean
  if (o.align !== undefined) style.align = o.align as TextStyle['align']
  if (o.list !== undefined) style.list = o.list as TextStyle['list']
  if (o.textColor !== undefined) style.textColor = o.textColor as string
  return style
}

function anchorOf(raw: unknown): Anchor | null {
  if (!raw || typeof raw !== 'object') return null
  const { id, at } = raw as { id?: unknown; at?: unknown }
  if (!isId(id)) return null
  if (Array.isArray(at) && at.length === 2 && at.every(v => isNum(v) && v >= 0 && v <= 1)) return { id, at: [at[0], at[1]] }
  return { id }
}

/** Defensive parse: bad items are skipped, never thrown on. */
export function itemFromJson(raw: unknown): Item | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!isColor(o.c) || !isNum(o.w) || o.w <= 0 || o.w > 1000 || !Array.isArray(o.p)) return null
  if (o.id !== undefined && !isId(o.id)) return null
  const id = typeof o.id === 'string' ? o.id : newId()
  const meta = objectMeta(o)
  if (!meta) return null
  if (o.t === 'l') {
    const p = o.p as number[]
    if (p.length !== 4 || !p.every(isCoord) || p[2] <= p[0] || p[3] <= p[1] || p[2] - p[0] > 100000 || p[3] - p[1] > 100000) return null
    if (Math.abs((p[3] - p[1]) / (p[2] - p[0]) - 0.64) > 1e-6) return null
    if (!Number.isSafeInteger(o.labVersion) || (o.labVersion as number) < 1 || !Number.isSafeInteger(o.modelVersion) || (o.modelVersion as number) < 1) return null
    if (typeof o.model !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(o.model) || !validModelParams(o.model, o.params)) return null
    if (!isNum(o.frozenTime) || o.frozenTime < 0 || o.frozenTime > 10000) return null
    if (o.gesture !== undefined && (o.model !== 'flux-studio' || !validMagnetTrace(o.gesture))) return null
    if (o.theme !== 'paper' && o.theme !== 'blueprint') return null
    if (o.angle !== undefined && (!isNum(o.angle) || Math.abs(o.angle) > 1e6)) return null
    const reveal = o.reveal as Record<string, unknown>
    const keys: (keyof LabReveal)[] = ['trajectory', 'vectors', 'graphs', 'energy', 'strobes', 'equations', 'compare']
    if (!reveal || typeof reveal !== 'object' || Array.isArray(reveal) || keys.some(k => typeof reveal[k] !== 'boolean')) return null
    const it: LabItem = { t: 'l', id, c: o.c, w: o.w, p: [...p] as LabItem['p'], ...meta,
      labVersion: o.labVersion as number, model: o.model, modelVersion: o.modelVersion as number,
      params: { ...o.params }, frozenTime: o.frozenTime, theme: o.theme, reveal: Object.fromEntries(keys.map(k => [k, reveal[k]])) as unknown as LabReveal }
    if (o.angle !== undefined) it.angle = o.angle as number
    if (o.gesture !== undefined) it.gesture = (o.gesture as LabItem['gesture'])!.map(p => ({ ...p }))
    if (getModel(it.model) && it.modelVersion === 1 && it.labVersion === 1 && it.frozenTime > labDuration(it) + 1e-8) return null
    return it
  }
  if (o.t === 'b') {
    const p = o.p as number[]
    if (p.length !== 4 || !p.every(isCoord) || p[2] <= p[0] || p[3] <= p[1]) return null
    if (o.angle !== undefined && (!isNum(o.angle) || Math.abs(o.angle) > 1e6)) return null
    if (o.textColor !== undefined && !isColor(o.textColor)) return null
    if (!validTable(o)) return null
    const table: TableItem = { t: 'b', id, c: o.c, w: o.w, p: [p[0], p[1], p[2], p[3]], ...meta, cols: [...(o.cols as number[])], rows: [...(o.rows as number[])], cells: (o.cells as string[][]).map(row => [...row]), fontSize: o.fontSize as number }
    if (o.angle !== undefined) table.angle = o.angle as number
    if (o.textColor !== undefined) table.textColor = o.textColor as string
    if (o.head === true) table.head = true
    return table
  }
  if (o.t === 'n') {
    const p = o.p as number[]
    if (p.length !== 4 || !p.every(isCoord) || p[2] <= p[0] || p[3] <= p[1]) return null
    if (o.angle !== undefined && (!isNum(o.angle) || Math.abs(o.angle) > 1e6)) return null
    if (!validAxis(o.x) || (o.y !== undefined && !validAxis(o.y))) return null
    if (o.points !== undefined && (!Array.isArray(o.points) || o.points.length > MAX_POINTS || !o.points.every(q => Array.isArray(q) && q.length === 2 && q.every(isNum)))) return null
    const scale: ScaleItem = { t: 'n', id, c: o.c, w: o.w, p: [p[0], p[1], p[2], p[3]], ...meta, x: { ...(o.x as ScaleAxis) } }
    if (o.angle !== undefined) scale.angle = o.angle as number
    if (o.y !== undefined) scale.y = { ...(o.y as ScaleAxis) }
    if (o.grid === true) scale.grid = true
    if (o.equal === true) scale.equal = true
    if (o.coords === true) scale.coords = true
    if (o.points !== undefined) scale.points = (o.points as [number, number][]).map(q => [q[0], q[1]])
    return scale
  }
  if (o.t === 'a') {
    const p = o.p as number[]
    if (p.length !== 4 || !p.every(isCoord) || p[2] <= p[0] || p[3] <= p[1] || typeof o.kind !== 'string' || !/^[a-z][a-z0-9-]{0,40}$/.test(o.kind) || !o.params || typeof o.params !== 'object') return null
    const params: Record<string, number> = {}
    const given = Object.entries(o.params as Record<string, unknown>)
    if (given.length > 40) return null
    for (const [key, value] of given) { if (!/^[a-zA-Z]{1,24}$/.test(key) || !isNum(value)) return null; params[key] = value }
    return { t: 'a', id, c: o.c, w: o.w, p: [p[0], p[1], p[2], p[3]], kind: o.kind, params, ...meta, ...(o.angle !== undefined && isNum(o.angle) ? { angle: o.angle } : {}) }
  }
  if (o.t === 'm') {
    const p = o.p as number[]
    if (p.length !== 4 || !p.every(isCoord) || p[2] <= p[0] || p[3] <= p[1] || (o.kind !== 'video' && o.kind !== 'audio')) return null
    if (typeof o.src !== 'string' || o.src.length > MAX_IMAGE_CHARS || !CLIP_SOURCE.test(o.src) || !isNum(o.aspect) || o.aspect <= 0 || o.aspect > 1e4) return null
    const clip: ClipItem = { t: 'm', id, c: o.c, w: o.w, p: [p[0], p[1], p[2], p[3]], kind: o.kind, src: o.src, name: typeof o.name === 'string' ? o.name.slice(0, 200) : '', aspect: o.aspect, ...meta, ...(o.angle !== undefined && isNum(o.angle) ? { angle: o.angle } : {}) }
    if (typeof o.poster === 'string' && o.poster.length < 2_000_000 && /^data:image\/(?:png|jpeg|webp)[;,]/.test(o.poster)) clip.poster = o.poster
    return clip
  }
  if (o.t === 'i' || o.t === 'g') {
    const p = o.p as number[]
    if (p.length !== 4 || !p.every(isCoord) || p[2] <= p[0] || p[3] <= p[1]) return null
    if (o.angle !== undefined && (!isNum(o.angle) || Math.abs(o.angle) > 1e6)) return null
    const box = { id, c: o.c, w: o.w, p: [p[0], p[1], p[2], p[3]] as [number, number, number, number], ...meta, ...(o.angle !== undefined ? { angle: o.angle as number } : {}) }
    if (o.t === 'i') {
      if (typeof o.src !== 'string' || o.src.length > MAX_IMAGE_CHARS || !/^data:image\/(?:png|jpeg|webp|gif|svg\+xml)[;,]/.test(o.src)) return null
      if (!isNum(o.aspect) || o.aspect <= 0 || o.aspect > 1e4) return null
      if (o.latex !== undefined && (!isText(o.latex) || !o.src.startsWith('data:image/svg+xml'))) return null
      const image: ImageItem = { t: 'i', ...box, src: o.src, aspect: o.aspect }
      if (o.latex !== undefined) image.latex = o.latex as string
      if (o.flipX === true) image.flipX = true
      if (o.flipY === true) image.flipY = true
      return image
    }
    const range = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every(n => isNum(n) && Math.abs(n) <= 1e9) && v[0] < v[1]
    if (!Array.isArray(o.fns) || o.fns.length < 1 || o.fns.length > 5 || !o.fns.every(f => typeof f === 'string' && f.length <= 200) || !range(o.xr) || !range(o.yr)) return null
    const graph: GraphItem = { t: 'g', ...box, fns: [...o.fns as string[]], xr: [...o.xr], yr: [...o.yr] }
    return graph
  }
  if (o.t === 's') {
    const p = o.p as number[]
    if (p.length < 3 || p.length > 3_000_000 || p.length % 3 !== 0 || !isFlag(o.m) || !isFlag(o.v)) return null
    for (let i = 0; i < p.length; i += 3) {
      if (!isCoord(p[i]) || !isCoord(p[i + 1]) || !isNum(p[i + 2]) || p[i + 2] < 0 || p[i + 2] > 1) return null
    }
    // A style from a newer version falls back to the plain pen rather than losing the stroke.
    const s: StrokeItem = { t: 's', id, c: o.c, w: o.w, m: !!o.m, v: !!o.v, ...(PEN_STYLES.includes(o.style as PenStyle) ? { style: o.style as PenStyle } : {}), p: [...p], ...meta }
    return s
  }
  if (o.t === 'h' || o.t === 't') {
    const p = o.p as number[]
    if (p.length !== 4 || !p.every(isCoord)) return null
    const style = textStyle(o)
    if (!style) return null
    if (o.angle !== undefined && (!isNum(o.angle) || Math.abs(o.angle) > 1e6)) return null
    if (o.fill !== undefined && !isFill(o.fill)) return null
    const common = { id, c: o.c, w: o.w, p: [p[0], p[1], p[2], p[3]] as [number, number, number, number], ...meta, ...style }
    const extra: { angle?: number; fill?: string } = {}
    if (o.angle !== undefined) extra.angle = o.angle as number
    if (o.fill !== undefined) extra.fill = o.fill as string
    if (o.t === 't') {
      if (!isText(o.text) || !isFontSize(o.fontSize) || typeof o.note !== 'boolean') return null
      if (p[0] === p[2] || p[1] === p[3]) return null
      const text: TextItem = { t: 't', ...common, ...extra, p: [Math.min(p[0], p[2]), Math.min(p[1], p[3]), Math.max(p[0], p[2]), Math.max(p[1], p[3])], text: o.text, fontSize: o.fontSize, note: o.note }
      return text
    }
    const k = o.k
    if (k !== 'line' && k !== 'arrow' && k !== 'rect' && k !== 'ellipse' && k !== 'diamond' && k !== 'triangle') return null
    if (o.dash !== undefined && !['solid', 'dashed', 'dotted'].includes(o.dash as string)) return null
    if (o.radius !== undefined && (!isNum(o.radius) || o.radius < 0 || o.radius > 1e6)) return null
    const s: ShapeItem = { t: 'h', ...common, ...extra, k }
    // A bad attachment only loses the attachment, never the arrow.
    if (k === 'line' || k === 'arrow') {
      const from = anchorOf(o.from), to = anchorOf(o.to)
      if (from) s.from = from
      if (to) s.to = to
      if (o.elbow === 'h' || o.elbow === 'v') s.elbow = o.elbow
      if (o.wire === true) s.wire = true
    }
    if (o.dash !== undefined) s.dash = o.dash as ShapeItem['dash']
    if (o.radius !== undefined) s.radius = o.radius as number
    return s
  }
  return null
}

export function serializeBoard(items: Item[], view?: View): string {
  const file: BoardFile = {
    format: FORMAT,
    version: items.some(it => it.t === 'l') ? LAB_BOARD_VERSION : VERSION,
    view: view ? { x: r2(view.x), y: r2(view.y), zoom: r3(view.zoom) } : undefined,
    items: items.map(itemToJson)
  }
  return JSON.stringify(file)
}

/** A page's ink and where it is looking, plus how it looks (paper, own colour, title). */
export interface PageData extends PageLook { items: Item[]; view?: View; frame?: Frame }

/**
 * What kind of board this is; a canvas also keeps its frames. `color` is the lesson's board
 * colour: every page shows it unless the page sets its own.
 */
export interface BoardMeta { kind: BoardKind; frames: LookFrame[]; color?: string; texture?: Texture }

/**
 * Notebooks, framed canvases, boards with pictures and anything with an appearance of its own
 * (a paper, a colour other than white, a page title) use format 4; only a bare, white, plain canvas
 * keeps the older single-board format. With `inline` the pictures are embedded (portable files);
 * otherwise they are returned separately so autosave writes each picture once.
 */
export function serializePages(pages: PageData[], page: number, inline: boolean, meta: BoardMeta = { kind: 'canvas', frames: [] }): { json: string; assets: Record<string, string> } {
  const plain = meta.kind === 'canvas' && !meta.frames.length && pages.length === 1
  const bare = !hasLook(pages[0]) && (!meta.color || sameColor(meta.color, DEFAULT_BOARD_COLOR)) && (!meta.texture || meta.texture === 'none')
  if (plain && bare && !pages[0].items.some(it => it.t === 'i' || it.t === 'm') && (!pages[0].frame || isDefaultFrame(pages[0].frame))) return { json: serializeBoard(pages[0].items, pages[0].view), assets: {} }
  const assets: Record<string, string> = {}
  // A background picture is stored with the other pictures, under its content key.
  const look = (l: PageLook): Record<string, unknown> => {
    if (!l.art) return lookJson(l)
    const key = assetKey(l.art.src)
    assets[key] = l.art.src
    return { ...lookJson(l), art: artJson(l.art, key) }
  }
  const pageJson = pages.map(pg => ({
    view: pg.view ? { x: r2(pg.view.x), y: r2(pg.view.y), zoom: r3(pg.view.zoom) } : undefined,
    ...look(pg),
    ...(pg.frame ? { frame: { x: r2(pg.frame.x), y: r2(pg.frame.y), extent: pg.frame.extent } } : {}),
    items: pg.items.map(it => {
      if (it.t !== 'i' && it.t !== 'm') return itemToJson(it)
      const key = assetKey(it.src)
      assets[key] = it.src
      const { src: _src, ...rest } = itemToJson(it) as Record<string, unknown>
      return { ...rest, a: key }
    })
  }))
  const frames = meta.kind === 'canvas' && meta.frames.length ? { frames: meta.frames.map(f => ({ x: r2(f.x), y: r2(f.y), extent: f.extent, ...look(f) })) } : {}
  const color = meta.color && isBoardColor(meta.color) ? { color: meta.color } : {}
  const texture = meta.texture && meta.texture !== 'none' ? { texture: meta.texture } : {}
  const file = { format: FORMAT, version: PAGES_VERSION, kind: meta.kind, ...color, ...texture, ...frames, page, pages: pageJson, ...(inline ? { assets } : { assetKeys: Object.keys(assets) }) }
  return { json: JSON.stringify(file), assets }
}

export interface ParsedBoard {
  items: Item[]
  view?: View
  skipped: number
  legacy: boolean
  /** every page (format 4); `items`/`view` describe page `page` */
  pages?: PageData[]
  page?: number
  /** format 4 only; older files are plain canvases */
  kind?: BoardKind
  frames?: LookFrame[]
  /** the lesson's board colour; files from before it was saved have none */
  color?: string
  /** the lesson's board texture ('none' when the file has none) */
  texture?: Texture
}

const isAssetKey = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{16,32}$/.test(v)
const PLACEHOLDER = 'data:image/png;base64,'

/** Format 4. `externalAssets` accepts picture references without their data (save validation). */
function parsePages(f: Record<string, unknown>, externalAssets: boolean): ParsedBoard | null {
  if (!Array.isArray(f.pages) || !f.pages.length || f.pages.length > MAX_PAGES) return null
  const assets = (f.assets && typeof f.assets === 'object' && !Array.isArray(f.assets) ? f.assets : {}) as Record<string, unknown>
  const ids = new Set<string>()
  let skipped = 0, total = 0
  const pages: PageData[] = []
  /** The background picture of a page or frame, with its data looked up (a missing one is dropped). */
  const art = (raw: unknown): { art?: Artwork } => {
    const a = (raw as { art?: { a?: unknown } } | null)?.art
    if (!a || typeof a !== 'object' || !isAssetKey(a.a)) return {}
    const found = validArt(a, externalAssets ? PLACEHOLDER : assets[a.a])
    return found ? { art: found } : {}
  }
  for (const raw of f.pages as unknown[]) {
    const pg = raw as { view?: unknown; items?: unknown; frame?: unknown }
    if (!pg || typeof pg !== 'object' || !Array.isArray(pg.items)) return null
    total += pg.items.length
    if (total > MAX_ITEMS) return null
    const items: Item[] = []
    for (const rawItem of pg.items) {
      let source = rawItem as Record<string, unknown>
      if (source && typeof source === 'object' && (source.t === 'i' || source.t === 'm')) {
        const src = isAssetKey(source.a) ? (externalAssets ? (source.t === 'm' ? 'data:video/mp4;base64,' : source.latex !== undefined ? 'data:image/svg+xml,' : PLACEHOLDER) : assets[source.a]) : undefined
        source = { ...source, src, a: undefined }
      }
      const it = itemFromJson(source)
      if (!it) { skipped++; continue }
      if (ids.has(it.id)) it.id = newId()
      ids.add(it.id)
      items.push(it)
    }
    const wire = (it: Item): boolean => it.t === 'h' && !!it.wire
    pages.push({ items: [...items.filter(it => !wire(it)), ...items.filter(wire)], view: parseView(pg.view, false), ...validLook(raw), ...art(raw), frame: validFrame(pg.frame) })
  }
  if (total && !pages.some(pg => pg.items.length)) return null
  const page = Number.isSafeInteger(f.page) && (f.page as number) >= 0 && (f.page as number) < pages.length ? f.page as number : 0
  // Files from before board kinds: several pages read as a notebook, one page as a canvas.
  const kind: BoardKind = isBoardKind(f.kind) ? f.kind : pages.length > 1 ? 'notebook' : 'canvas'
  const frames = kind === 'canvas' && Array.isArray(f.frames) ? (f.frames as unknown[]).slice(0, MAX_PAGES).map(v => { const fr = validLookFrame(v); return fr && { ...fr, ...art(v) } }).filter((x): x is LookFrame => !!x) : []
  return { items: pages[page].items, view: pages[page].view, skipped, legacy: false, pages, page, kind, frames, color: isBoardColor(f.color) ? f.color : undefined, texture: isTexture(f.texture) ? f.texture : 'none' }
}

function parseView(v: unknown, legacy: boolean): View | undefined {
  const o = v as { x?: unknown; y?: unknown; zoom?: unknown; z?: unknown } | undefined
  const zoom = legacy ? o?.z : o?.zoom
  return o && isCoord(o.x) && isCoord(o.y) && isNum(zoom) ? { x: o.x, y: o.y, zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) } : undefined
}

/** Python v10 stores constant ink as XY pairs and variable ink as XY/width triples. */
function legacyItem(raw: unknown): Item | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.t === 'shape') return itemFromJson({ ...o, t: 'h', k: o.s })
  if (o.t !== 'ink' || !Array.isArray(o.p) || !isNum(o.w) || o.w <= 0 || o.w > 1000 || !isFlag(o.v)) return null
  const stride = o.v ? 3 : 2
  if (!o.p.length || o.p.length % stride || o.p.length > 3_000_000) return null
  const p: number[] = []
  for (let i = 0; i < o.p.length; i += stride) {
    if (!isCoord(o.p[i]) || !isCoord(o.p[i + 1])) return null
    const width = o.v ? o.p[i + 2] : o.w
    if (!isNum(width) || width <= 0 || width > 1000) return null
    p.push(o.p[i], o.p[i + 1], clamp(0.5 + (width / o.w - 1) / 1.2, 0, 1))
  }
  return itemFromJson({ ...o, t: 's', p })
}

export function parseBoard(json: string, opts: { externalAssets?: boolean } = {}): ParsedBoard | null {
  try {
    if (typeof json !== 'string' || json.length > MAX_FILE_CHARS) return null
    const f = JSON.parse(json) as Partial<BoardFile>
    if (f && typeof f === 'object' && f.format === FORMAT && f.version === PAGES_VERSION) return parsePages(f as Record<string, unknown>, !!opts.externalAssets)
    if (!f || typeof f !== 'object' || !Array.isArray(f.items) || f.items.length > MAX_ITEMS) return null
    const legacy = f.format === undefined
    if (!legacy && f.format !== FORMAT) return null
    if (legacy ? f.version !== 1 : f.version !== 1 && f.version !== VERSION && f.version !== LAB_BOARD_VERSION) return null
    if (!legacy && f.version !== LAB_BOARD_VERSION && f.items.some(it => (it as { t?: string } | null)?.t === 'l')) return null
    // Recognise only the actual Python schema, rather than arbitrary JSON with an items array.
    if (legacy && f.items.some((it) => !it || typeof it !== 'object' || !['ink', 'shape'].includes((it as { t: string }).t))) return null
    const items: Item[] = []
    let skipped = 0
    const ids = new Set<string>()
    for (const raw of f.items) {
      const it = legacy ? legacyItem(raw) : itemFromJson(raw)
      if (it) {
        if (ids.has(it.id)) it.id = newId()
        ids.add(it.id)
        items.push(it)
      } else skipped++
    }
    if (f.items.length && !items.length) return null
    const view = parseView(f.view, legacy)
    return { items, view, skipped, legacy }
  } catch {
    return null
  }
}
