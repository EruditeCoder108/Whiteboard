import { hitObject, rotatePoint, shapePolylines } from './items'
import type { Anchor, Item, ShapeItem } from './types'
import { newId } from './types'

/**
 * Arrows and lines that stay attached. A connector's ends may each hold on to another object, by id:
 *  - to a box, a shape, text or an equation it points at the edge facing the other end, wherever the
 *    objects go (mind maps, flowcharts);
 *  - to a picture, a graph or a lab it stays on one spot of it (`at`), the way a label points at part
 *    of a diagram.
 * `p` always holds the real position, so everything else (painting, export, replay) just draws a line.
 */
type Pt = [number, number]
type Find = (id: string) => Item | undefined

export const isConnector = (it: Item): it is ShapeItem => it.t === 'h' && (it.k === 'line' || it.k === 'arrow')
const attachedTo = (c: ShapeItem, ids: Set<string>): boolean => (!!c.from && ids.has(c.from.id)) || (!!c.to && ids.has(c.to.id))

/** Ink is left out: one stroke of a hand-drawn word is not the thing being pointed at. */
const attachable = (it: Item): boolean => !it.locked && it.t !== 's' && !isConnector(it)
const pinned = (it: Item): boolean => (it.t === 'i' && it.latex === undefined) || it.t === 'g' || it.t === 'l'

const centreOf = (it: Exclude<Item, { t: 's' }>): Pt => [(it.p[0] + it.p[2]) / 2, (it.p[1] + it.p[3]) / 2]
const angleOf = (it: Exclude<Item, { t: 's' }>): number => it.angle ?? 0

/** The topmost object an end dropped here would attach to. */
export function attachAt(items: Item[], x: number, y: number, tolerance: number, except?: string): Item | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]
    if (it.id !== except && attachable(it) && hitObject(it, x, y, tolerance)) return it
  }
  return null
}

/** How an end dropped at (x, y) holds on to `target`. */
export function anchorFor(target: Item, x: number, y: number): Anchor {
  if (target.t === 's' || !pinned(target)) return { id: target.id }
  const [cx, cy] = centreOf(target)
  const [lx, ly] = rotatePoint(x, y, cx, cy, -angleOf(target))
  const w = Math.max(1e-6, Math.abs(target.p[2] - target.p[0])), h = Math.max(1e-6, Math.abs(target.p[3] - target.p[1]))
  const fraction = (v: number): number => Math.max(0, Math.min(1, v))
  return { id: target.id, at: [fraction((lx - Math.min(target.p[0], target.p[2])) / w), fraction((ly - Math.min(target.p[1], target.p[3])) / h)] }
}

function pinPoint(it: Exclude<Item, { t: 's' }>, at: Pt): Pt {
  const x = Math.min(it.p[0], it.p[2]) + Math.abs(it.p[2] - it.p[0]) * at[0]
  const y = Math.min(it.p[1], it.p[3]) + Math.abs(it.p[3] - it.p[1]) * at[1]
  return rotatePoint(x, y, ...centreOf(it), angleOf(it))
}

/** Where a ray from the object's centre towards `toward` leaves its outline, plus `gap`; null when `toward` is the centre. */
function edgePoint(it: Exclude<Item, { t: 's' }>, toward: Pt, gap: number): Pt | null {
  const [cx, cy] = centreOf(it), angle = angleOf(it)
  const [tx, ty] = rotatePoint(toward[0], toward[1], cx, cy, -angle)
  const dx = tx - cx, dy = ty - cy, length = Math.hypot(dx, dy)
  if (length < 1e-6) return null
  const [x0, y0, x1, y1] = it.p
  const outline = it.t === 'h' ? shapePolylines(it)[0] : [x0, y0, x1, y0, x1, y1, x0, y1]
  let far = 0
  for (let i = 0; i < outline.length; i += 2) {
    const ax = outline[i], ay = outline[i + 1], j = (i + 2) % outline.length
    const ex = outline[j] - ax, ey = outline[j + 1] - ay
    const denom = dx * ey - dy * ex
    if (Math.abs(denom) < 1e-9) continue
    const u = ((ax - cx) * ey - (ay - cy) * ex) / denom, v = ((ax - cx) * dy - (ay - cy) * dx) / denom
    if (u > far && v >= -1e-9 && v <= 1 + 1e-9) far = u
  }
  const out = far * length + gap
  return rotatePoint(cx + dx / length * out, cy + dy / length * out, cx, cy, angle)
}

/** The connector with its ends where its anchors now put them; the same object when nothing moved. */
export function routeConnector(c: ShapeItem, find: Find): ShapeItem {
  const hold = (a: Anchor | undefined): Exclude<Item, { t: 's' }> | null => {
    const it = a ? find(a.id) : undefined
    return it && it.t !== 's' ? it : null
  }
  const a = hold(c.from), b = hold(c.to)
  if (!a && !b) return c
  const start: Pt = [c.p[0], c.p[1]], end: Pt = [c.p[2], c.p[3]]
  const aimA = a ? c.from!.at ? pinPoint(a, c.from!.at) : centreOf(a) : start
  const aimB = b ? c.to!.at ? pinPoint(b, c.to!.at) : centreOf(b) : end
  const dx = aimB[0] - aimA[0], dy = aimB[1] - aimA[1]
  const sideways = Math.abs(dx) >= Math.abs(dy)
  // An elbow leaves straight out of the side that faces the other end.
  const towards = (from: Pt, sign: number, other: Pt): Pt => !c.elbow ? other
    : sideways ? [from[0] + sign * Math.sign(dx || 1), from[1]] : [from[0], from[1] + sign * Math.sign(dy || 1)]
  const gap = 5 + c.w / 2
  const pa = a && !c.from!.at ? edgePoint(a, towards(aimA, 1, aimB), gap) ?? start : aimA
  const pb = b && !c.to!.at ? edgePoint(b, towards(aimB, -1, aimA), gap) ?? end : aimB
  const p: ShapeItem['p'] = [pa[0], pa[1], pb[0], pb[1]]
  const elbow = c.elbow ? sideways ? 'h' as const : 'v' as const : undefined
  if (!c.angle && elbow === c.elbow && p.every((v, i) => Math.abs(v - c.p[i]) < 1e-3)) return c
  return { ...c, p, angle: 0, ...(elbow ? { elbow } : {}) }
}

/**
 * After an edit to the objects in `touched`: connectors holding on to them follow, and an end whose
 * object has gone stays where it is, free. The same array when nothing changed.
 */
export function followConnectors(items: Item[], touched: Set<string>, onMove?: (from: Item, to: Item) => void): Item[] {
  let byId: Map<string, Item> | null = null
  let out: Item[] | null = null
  items.forEach((it, i) => {
    if (!isConnector(it) || (!it.from && !it.to) || (!touched.has(it.id) && !attachedTo(it, touched))) return
    byId ??= new Map(items.map(x => [x.id, x]))
    const known = byId
    let c = it
    if (c.from && !known.has(c.from.id)) { const { from: _gone, ...rest } = c; c = rest }
    if (c.to && !known.has(c.to.id)) { const { to: _gone, ...rest } = c; c = rest }
    const next = routeConnector(c, id => known.get(id))
    if (next === it) return
    ;(out ??= items.slice())[i] = next
    onMove?.(it, next)
  })
  return out ?? items
}

/** The connectors that must follow while these objects are dragged (not those being dragged with them). */
export function followersOf(items: Item[], moving: Item[]): ShapeItem[] {
  const ids = new Set(moving.map(it => it.id))
  return items.filter((it): it is ShapeItem => isConnector(it) && !ids.has(it.id) && attachedTo(it, ids))
}

/** A connector dragged away lets go of whatever is not coming with it. */
export function letGo(it: Item, moving: Set<string>): Item {
  if (!isConnector(it) || (!it.from && !it.to)) return it
  const { from, to, ...rest } = it
  return { ...rest, ...(from && moving.has(from.id) ? { from } : {}), ...(to && moving.has(to.id) ? { to } : {}) }
}

/** Copied objects: a connector holds on to the copy of its object, or lets go if that was not copied. */
export function remapAnchors(items: Item[], ids: Map<string, string>): Item[] {
  const moved = (a: Anchor): Anchor | null => { const id = ids.get(a.id); return id ? { ...a, id } : null }
  return items.map(it => {
    if (!isConnector(it) || (!it.from && !it.to)) return it
    const { from, to, ...rest } = it
    const f = from && moved(from), t = to && moved(to)
    return { ...rest, ...(f ? { from: f } : {}), ...(t ? { to: t } : {}) }
  })
}

/** The same objects with new ids, still attached to one another. */
export function withNewIds(items: Item[]): Item[] {
  const ids = new Map<string, string>()
  const copies = items.map(it => { const id = newId(); ids.set(it.id, id); return { ...it, id } })
  return remapAnchors(copies, ids)
}
