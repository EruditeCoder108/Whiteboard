import type { Item, ObjectMeta, ShapeItem, StrokeItem, TextItem, TextStyle, View } from './types'
import { newId } from './types'
import { MAX_ZOOM, MIN_ZOOM } from './view'
import { clamp } from './geometry'

export const FORMAT = 'floating-whiteboard'
export const VERSION = 2

export const MAX_TEXT_LENGTH = 100_000
const MAX_ID_LENGTH = 128
const MAX_ITEMS = 100_000
const MAX_FILE_CHARS = 50 * 1024 * 1024

const r2 = (v: number): number => Math.round(v * 100) / 100
const r3 = (v: number): number => Math.round(v * 1000) / 1000

export interface BoardFile {
  format: typeof FORMAT
  version: number
  view?: View
  items: unknown[]
}

export function itemToJson(it: Item): unknown {
  const meta: ObjectMeta = { group: it.group, locked: it.locked, opacity: it.opacity }
  if (it.t === 's') {
    const p: number[] = new Array(it.p.length)
    for (let i = 0; i + 2 < it.p.length; i += 3) {
      p[i] = r2(it.p[i])
      p[i + 1] = r2(it.p[i + 1])
      p[i + 2] = r3(it.p[i + 2])
    }
    return { t: 's', id: it.id, c: it.c, w: r2(it.w) || it.w, m: it.m ? 1 : 0, v: it.v ? 1 : 0, p, ...meta }
  }
  const text: TextStyle = {
    text: it.text, fontSize: it.fontSize, bold: it.bold, italic: it.italic,
    align: it.align, list: it.list, textColor: it.textColor
  }
  const common = { id: it.id, c: it.c, w: r2(it.w) || it.w, p: it.p.map(r2), angle: it.angle, fill: it.fill, ...meta, ...text }
  if (it.t === 't') return { t: 't', ...common, note: it.note }
  return { t: 'h', ...common, k: it.k, dash: it.dash, radius: it.radius }
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

/** Defensive parse: bad items are skipped, never thrown on. */
export function itemFromJson(raw: unknown): Item | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!isColor(o.c) || !isNum(o.w) || o.w <= 0 || o.w > 1000 || !Array.isArray(o.p)) return null
  if (o.id !== undefined && !isId(o.id)) return null
  const id = typeof o.id === 'string' ? o.id : newId()
  const meta = objectMeta(o)
  if (!meta) return null
  if (o.t === 's') {
    const p = o.p as number[]
    if (p.length < 3 || p.length > 3_000_000 || p.length % 3 !== 0 || !isFlag(o.m) || !isFlag(o.v)) return null
    for (let i = 0; i < p.length; i += 3) {
      if (!isCoord(p[i]) || !isCoord(p[i + 1]) || !isNum(p[i + 2]) || p[i + 2] < 0 || p[i + 2] > 1) return null
    }
    const s: StrokeItem = { t: 's', id, c: o.c, w: o.w, m: !!o.m, v: !!o.v, p: [...p], ...meta }
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
    if (o.dash !== undefined) s.dash = o.dash as ShapeItem['dash']
    if (o.radius !== undefined) s.radius = o.radius as number
    return s
  }
  return null
}

export function serializeBoard(items: Item[], view?: View): string {
  const file: BoardFile = {
    format: FORMAT,
    version: VERSION,
    view: view ? { x: r2(view.x), y: r2(view.y), zoom: r3(view.zoom) } : undefined,
    items: items.map(itemToJson)
  }
  return JSON.stringify(file)
}

export interface ParsedBoard {
  items: Item[]
  view?: View
  skipped: number
  legacy: boolean
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

export function parseBoard(json: string): ParsedBoard | null {
  try {
    if (typeof json !== 'string' || json.length > MAX_FILE_CHARS) return null
    const f = JSON.parse(json) as Partial<BoardFile>
    if (!f || typeof f !== 'object' || !Array.isArray(f.items) || f.items.length > MAX_ITEMS) return null
    const legacy = f.format === undefined
    if (!legacy && f.format !== FORMAT) return null
    if (legacy ? f.version !== 1 : f.version !== 1 && f.version !== VERSION) return null
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
    const v = f.view
    const view =
      v && isCoord(v.x) && isCoord(v.y) && isNum(legacy ? (v as unknown as { z: number }).z : v.zoom)
        ? { x: v.x, y: v.y, zoom: clamp(legacy ? (v as unknown as { z: number }).z : v.zoom, MIN_ZOOM, MAX_ZOOM) }
        : undefined
    return { items, view, skipped, legacy }
  } catch {
    return null
  }
}
