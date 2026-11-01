import { describe, expect, it } from 'vitest'
import { anchorFor, attachAt, followConnectors, followersOf, letGo, remapAnchors, routeConnector, withNewIds } from '../src/renderer/src/engine/connectors'
import { shapePolylines } from '../src/renderer/src/engine/items'
import { itemFromJson, itemToJson } from '../src/renderer/src/engine/serialize'
import { freshCopies } from '../src/renderer/src/engine/shelf'
import type { ImageItem, Item, ShapeItem, StrokeItem } from '../src/renderer/src/engine/types'

const rect = (id: string, x: number, y: number, over: Partial<ShapeItem> = {}): ShapeItem => ({ t: 'h', id, c: '#111827', w: 2, k: 'rect', p: [x, y, x + 100, y + 60], ...over })
const arrow = (over: Partial<ShapeItem> = {}): ShapeItem => ({ t: 'h', id: 'c', c: '#111827', w: 2, k: 'arrow', p: [0, 0, 10, 10], ...over })
const picture: ImageItem = { t: 'i', id: 'pic', c: '#111827', w: 1, p: [0, 0, 400, 200], src: 'data:image/png;base64,AAAA', aspect: 2 }
const find = (...items: Item[]) => (id: string): Item | undefined => items.find(it => it.id === id)

describe('where an attached end goes', () => {
  it('stops just outside each box, on the side facing the other', () => {
    const a = rect('a', 0, 0), b = rect('b', 300, 0)
    const c = routeConnector(arrow({ from: { id: 'a' }, to: { id: 'b' } }), find(a, b))
    expect(c.p[0]).toBeGreaterThan(100)
    expect(c.p[0]).toBeLessThan(110)
    expect(c.p[1]).toBeCloseTo(30)
    expect(c.p[2]).toBeLessThan(300)
    expect(c.p[2]).toBeGreaterThan(290)
    expect(c.p[3]).toBeCloseTo(30)
  })

  it('follows the true outline of an ellipse and a rotated box', () => {
    const e = rect('e', 0, 0, { k: 'ellipse', p: [0, 0, 100, 100] })
    const free = routeConnector(arrow({ from: { id: 'e' }, p: [0, 0, 300, 300] }), find(e))
    expect(Math.hypot(free.p[0] - 50, free.p[1] - 50)).toBeLessThan(60) // on the curve, not the corner of its box
    const turned = rect('r', 0, 0, { p: [0, 0, 100, 100], angle: Math.PI / 4 })
    const c = routeConnector(arrow({ from: { id: 'r' }, p: [0, 0, 300, 50] }), find(turned))
    expect(c.p[0]).toBeGreaterThan(50 + 50 * Math.SQRT2)
  })

  it('stays put when nothing moved, and on a picture keeps to its spot', () => {
    const a = rect('a', 0, 0), b = rect('b', 300, 0)
    const c = routeConnector(arrow({ from: { id: 'a' }, to: { id: 'b' } }), find(a, b))
    expect(routeConnector(c, find(a, b))).toBe(c)
    const anchor = anchorFor(picture, 100, 50)
    expect(anchor).toEqual({ id: 'pic', at: [.25, .25] })
    const moved = { ...picture, p: [1000, 1000, 1800, 1400] as ImageItem['p'] }
    const pinned = routeConnector(arrow({ to: anchor, p: [0, 0, 100, 50] }), find(moved))
    expect(pinned.p.slice(2)).toEqual([1200, 1100])
  })

  it('an equation counts as a label, not a picture to pin on', () => {
    expect(anchorFor({ ...picture, latex: 'x' }, 100, 50)).toEqual({ id: 'pic' })
  })

  it('an elbow leaves straight out of the side facing the other end, its head along the last stretch', () => {
    const a = rect('a', 0, 0), b = rect('b', 300, 200)
    const c = routeConnector(arrow({ from: { id: 'a' }, to: { id: 'b' }, elbow: 'v' }), find(a, b))
    expect(c.elbow).toBe('h')
    expect(c.p[1]).toBeCloseTo(30)
    expect(c.p[3]).toBeCloseTo(230)
    const [run, head] = shapePolylines(c)
    expect(run).toHaveLength(8)
    expect(run[1]).toBe(run[3])
    expect(run[5]).toBe(run[7])
    expect(head[0]).toBeLessThan(c.p[2])
  })
})

describe('what an end can attach to', () => {
  const ink: StrokeItem = { t: 's', id: 's', c: '#000000', w: 4, m: false, v: false, p: [0, 0, .5, 100, 100, .5] }
  it('the top object, never ink, another arrow, or something locked', () => {
    const under = rect('under', 0, 0), over = rect('over', 20, 10)
    expect(attachAt([under, over], 50, 30, 5)?.id).toBe('over')
    expect(attachAt([under, over], 5, 5, 5)?.id).toBe('under')
    expect(attachAt([ink], 50, 50, 5)).toBeNull()
    expect(attachAt([arrow({ p: [0, 0, 100, 100] })], 50, 50, 5)).toBeNull()
    expect(attachAt([rect('l', 0, 0, { locked: true })], 50, 30, 5)).toBeNull()
    expect(attachAt([under], 50, 30, 5, 'under')).toBeNull()
    expect(attachAt([under], 500, 500, 5)).toBeNull()
  })
})

describe('after an edit', () => {
  const a = rect('a', 0, 0), b = rect('b', 300, 0)
  const c = routeConnector(arrow({ from: { id: 'a' }, to: { id: 'b' } }), find(a, b))

  it('follows a moved object and reports what it replaced', () => {
    const moved = rect('b', 300, 400)
    const seen: Item[] = []
    const out = followConnectors([a, moved, c], new Set(['b']), (_from, to) => seen.push(to))
    expect(out[2]).not.toBe(c)
    expect(seen).toEqual([out[2]])
    expect((out[2] as ShapeItem).p[3]).toBeGreaterThan(300)
  })

  it('changes nothing when what moved is not attached', () => {
    const items = [a, b, c, rect('other', 900, 900)]
    expect(followConnectors(items, new Set(['other']))).toBe(items)
  })

  it('an end whose object has gone stays where it is, free', () => {
    const out = followConnectors([a, c], new Set(['b']))[1] as ShapeItem
    expect(out.to).toBeUndefined()
    expect(out.from).toEqual({ id: 'a' })
    expect(out.p.slice(2)).toEqual(c.p.slice(2))
  })

  it('knows who follows a drag, and an arrow dragged away lets go of what stays behind', () => {
    expect(followersOf([a, b, c], [a])).toEqual([c])
    expect(followersOf([a, b, c], [a, c])).toEqual([])
    expect(letGo(c, new Set(['c', 'a']))).toMatchObject({ from: { id: 'a' } })
    expect((letGo(c, new Set(['c', 'a'])) as ShapeItem).to).toBeUndefined()
    expect(letGo(a, new Set())).toBe(a)
  })
})

describe('copies', () => {
  const a = rect('a', 0, 0), b = rect('b', 300, 0), c = arrow({ from: { id: 'a' }, to: { id: 'b' } })
  it('hold on to the copy, or let go of what was not copied', () => {
    const [ca, cb, cc] = withNewIds([a, b, c]) as [ShapeItem, ShapeItem, ShapeItem]
    expect(ca.id).not.toBe('a')
    expect(cc.from?.id).toBe(ca.id)
    expect(cc.to?.id).toBe(cb.id)
    const alone = remapAnchors([c], new Map([['a', 'x']]))[0] as ShapeItem
    expect(alone.from?.id).toBe('x')
    expect(alone.to).toBeUndefined()
  })

  it('from My shelf are attached to each other too', () => {
    const [ca, , cc] = freshCopies([a, b, c]) as ShapeItem[]
    expect(cc.from?.id).toBe(ca.id)
    expect(freshCopies([c])[0]).not.toHaveProperty('from')
  })
})

describe('in the lesson file', () => {
  it('attachments and elbows survive; a bad attachment only loses the attachment', () => {
    const c = arrow({ from: { id: 'a' }, to: { id: 'pic', at: [.25, .5] }, elbow: 'v' })
    expect(itemFromJson(JSON.parse(JSON.stringify(itemToJson(c))))).toMatchObject({ from: { id: 'a' }, to: { id: 'pic', at: [.25, .5] }, elbow: 'v' })
    const bad = itemFromJson({ ...JSON.parse(JSON.stringify(itemToJson(c))), from: { id: 7 }, to: { id: 'pic', at: [5, 5] } }) as ShapeItem
    expect(bad.from).toBeUndefined()
    expect(bad.to).toEqual({ id: 'pic' })
    expect(itemFromJson(JSON.parse(JSON.stringify(itemToJson(rect('r', 0, 0)))))).not.toHaveProperty('from')
  })
})
