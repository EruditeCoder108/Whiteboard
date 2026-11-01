import { contrastRatio, isDarkColor } from './colour'
import { remapAnchors } from './connectors'
import { moved } from './convert'
import { unionRect } from './geometry'
import { itemBounds, translateItem } from './items'
import type { PageData } from './serialize'
import { transformItem } from './transforms'
import type { Item, Rect } from './types'
import { newId } from './types'

/**
 * A fresh, editable copy of saved objects: new ids, and groups that hold together but belong to this
 * copy alone, so inserting the same diagram twice gives two diagrams that do not move together.
 */
export function freshCopies(items: Item[]): Item[] {
  const groups = new Map<string, string>(), ids = new Map<string, string>()
  return remapAnchors(items.map(it => {
    const { locked: _locked, group, ...rest } = it
    if (group && !groups.has(group)) groups.set(group, newId())
    const id = newId()
    ids.set(it.id, id)
    return { ...rest, id, ...(group ? { group: groups.get(group) } : {}) } as Item
  }), ids)
}

/** Centred in the part of the board that is visible, made smaller only if it would not fit (never larger). */
export function placeInView(items: Item[], view: Rect, room = .8): Item[] {
  let b: Rect | null = null
  for (const it of items) b = unionRect(b, itemBounds(it))
  if (!b) return items
  const w = Math.max(1, b[2] - b[0]), h = Math.max(1, b[3] - b[1])
  const k = Math.min(1, (view[2] - view[0]) * room / w, (view[3] - view[1]) * room / h)
  const anchor: [number, number] = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]
  const dx = (view[0] + view[2]) / 2 - anchor[0], dy = (view[1] + view[3]) / 2 - anchor[1]
  return items.map(it => k === 1 ? translateItem(it, dx, dy) : transformItem(it, anchor, k, k, 0, dx, dy))
}

/** Below this contrast, ink cannot be read from the classroom. */
const VANISHES = 2
const READABLE = 2.6

const rgbOf = (hex: string): number[] => {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16))
}

/** Nearest readable version of a colour on `bg`: black and white swap, colours keep their hue and go darker or lighter. */
function readableVersion(color: string, bg: string): string {
  const ink = isDarkColor(bg) ? '#ffffff' : '#111827'
  const from = rgbOf(color), to = rgbOf(ink)
  if (Math.max(...from) - Math.min(...from) >= 40) {
    for (const t of [.25, .4, .55, .7, .85]) {
      const mixed = '#' + from.map((v, i) => Math.round(v + (to[i] - v) * t).toString(16).padStart(2, '0')).join('')
      if (contrastRatio(mixed, bg) >= READABLE) return mixed
    }
  }
  return ink
}

/**
 * White chalk saved from a blackboard would vanish on a white page, and black ink on a blackboard.
 * Ink that could be read where it was saved but cannot be read here changes to a colour that can.
 * Ink that was already invisible there stays as it is (a teacher's white mask on a white board),
 * highlighter is see-through by design, and text on a filled note or shape is read against that fill.
 */
export function readableOn(items: Item[], from: string, bg: string): Item[] {
  const fix = (c: string): string => contrastRatio(c, bg) < VANISHES && contrastRatio(c, from) >= VANISHES ? readableVersion(c, bg) : c
  return items.map(it => {
    if (it.t === 's') return it.m || fix(it.c) === it.c ? it : { ...it, c: fix(it.c) }
    if (it.t === 'i' && it.latex !== undefined) return fix(it.c) === it.c ? it : { ...it, c: fix(it.c) } // an equation is drawn in its object's colour
    if (it.t !== 'h' && it.t !== 't') return it
    const filled = !!it.fill && it.fill !== 'none'
    if (it.t === 't' && (filled || it.note)) return it
    const c = fix(it.c)
    if (filled) return c === it.c ? it : { ...it, c, ...(it.text ? { textColor: it.textColor ?? it.c } : {}) } // the writing stays as it was on its fill
    const textColor = it.textColor ? fix(it.textColor) : undefined
    return c === it.c && textColor === it.textColor ? it : { ...it, c, ...(textColor ? { textColor } : {}) }
  })
}

/** A page moved to start at (x, y), its paper pattern moving with its ink. */
export function pageAt(pg: PageData, x: number, y: number): PageData {
  const f = pg.frame ?? { x: 0, y: 0, extent: 1 }
  const dx = x - f.x, dy = y - f.y
  const { origin: _origin, ...rest } = pg
  const origin = moved(pg.origin, dx, dy)
  return { ...rest, items: pg.items.map(it => translateItem(it, dx, dy)), frame: { x, y, extent: f.extent }, ...(origin ? { origin } : {}) }
}
