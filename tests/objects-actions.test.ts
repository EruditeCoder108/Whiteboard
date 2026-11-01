import { describe, expect, it } from 'vitest'
import { BRANCH_FILLS, NODE_H, NODE_W, branchSpot, flipItem, mindNode, safeLink } from '@/engine/objects'
import { itemFromJson, itemToJson } from '@/engine/serialize'
import type { ImageItem, Item, Rect, ShapeItem, StrokeItem, TextItem } from '@/engine/types'

const stroke: StrokeItem = { t: 's', id: 's', c: '#000000', w: 4, m: false, v: false, p: [0, 0, .5, 100, 50, .5] }
const picture: ImageItem = { t: 'i', id: 'i', c: '#000000', w: 1, p: [0, 0, 100, 50], src: 'data:image/png;base64,AAAA', aspect: 2 }
const text: TextItem = { t: 't', id: 't', c: '#000000', w: 1, p: [0, 0, 100, 50], text: 'abc', fontSize: 20, note: false }

describe('mirror and flip', () => {
  it('mirrors ink about the point', () => {
    const f = flipItem(stroke, 100, 0, 'h') as StrokeItem
    expect(f.p).toEqual([200, 0, .5, 100, 50, .5])
    const v = flipItem(stroke, 0, 25, 'v') as StrokeItem
    expect(v.p).toEqual([0, 50, .5, 100, 0, .5])
  })

  it('a picture really mirrors, and twice is the original', () => {
    const once = flipItem(picture, 50, 25, 'h') as ImageItem
    expect(once.flipX).toBe(true)
    expect(once.p).toEqual(picture.p)
    expect((flipItem(once, 50, 25, 'h') as ImageItem).flipX).toBeUndefined()
  })

  it('writing moves but never reads backwards', () => {
    const f = flipItem(text, 200, 0, 'h') as TextItem
    expect(f.p).toEqual([300, 0, 400, 50])
    expect(f.text).toBe('abc')
    expect('flipX' in f).toBe(false)
    const eq = flipItem({ ...picture, latex: 'x' }, 50, 25, 'h') as ImageItem
    expect(eq.flipX).toBeUndefined()
  })

  it('a triangle turns upside down', () => {
    const tri: ShapeItem = { t: 'h', id: 'x', c: '#000000', w: 2, k: 'triangle', p: [0, 0, 100, 100] }
    expect((flipItem(tri, 50, 50, 'v') as ShapeItem).angle).toBeCloseTo(Math.PI)
    expect((flipItem(tri, 50, 50, 'h') as ShapeItem).angle ?? 0).toBeCloseTo(0)
  })

  it('the arrow swaps sides with its ends', () => {
    const arrow: ShapeItem = { t: 'h', id: 'a', c: '#000000', w: 2, k: 'arrow', p: [0, 0, 100, 0] }
    expect((flipItem(arrow, 50, 0, 'h') as ShapeItem).p).toEqual([100, 0, 0, 0])
  })

  it('a mirrored picture survives saving', () => {
    const back = itemFromJson(itemToJson({ ...picture, flipX: true })) as ImageItem
    expect(back.flipX).toBe(true)
    expect(back.flipY).toBeUndefined()
  })
})

describe('links', () => {
  it('accepts web addresses and fills in https', () => {
    expect(safeLink('ncert.nic.in')).toBe('https://ncert.nic.in/')
    expect(safeLink(' https://example.org/a?b=1 ')).toBe('https://example.org/a?b=1')
    expect(safeLink('http://example.org')).toBe('http://example.org/')
  })

  it('refuses everything else', () => {
    for (const bad of ['javascript:alert(1)', 'file:///c:/windows/system32', 'ms-settings:', 'hello', '', 'https://', null, 7, 'x'.repeat(2100) + '.org']) expect(safeLink(bad)).toBeNull()
  })

  it('a harmful link in a file is dropped and the object is kept', () => {
    const bad = itemFromJson({ ...(itemToJson(text) as object), link: 'javascript:alert(1)' }) as Item
    expect(bad.link).toBeUndefined()
    expect((bad as TextItem).text).toBe('abc')
    const good = itemFromJson(itemToJson({ ...text, link: 'https://example.org/' })) as Item
    expect(good.link).toBe('https://example.org/')
  })
})

describe('mind maps', () => {
  const screen: Rect = [0, 0, 1600, 900]
  const parent: Rect = [700, 400, 900, 500]

  it('grows sideways first, inside the screen', () => {
    const a = branchSpot(parent, [parent], screen)
    expect(a[0]).toBeGreaterThan(parent[2])
    expect(a[2] - a[0]).toBe(NODE_W)
    expect(a[3] - a[1]).toBe(NODE_H)
  })

  it('never lands on what is already there, however many branches', () => {
    const taken: Rect[] = [parent]
    for (let i = 0; i < 8; i++) {
      const s = branchSpot(parent, taken, screen)
      for (const t of taken) expect(s[0] < t[2] && s[2] > t[0] && s[1] < t[3] && s[3] > t[1]).toBe(false)
      expect(s[0]).toBeGreaterThanOrEqual(0)
      expect(s[3]).toBeLessThanOrEqual(900)
      taken.push(s)
    }
  })

  it('a full screen still gives a place on it', () => {
    const s = branchSpot(parent, [screen], screen)
    expect(s[2]).toBeLessThanOrEqual(1600)
    expect(s[3]).toBeLessThanOrEqual(900)
  })

  it('nodes keep dark text on a soft fill on any board', () => {
    const n = mindNode([0, 0, 100, 50], BRANCH_FILLS[1], '#ffffff')
    expect(n.textColor).toBe('#172033')
    expect(n.fill).toBe(BRANCH_FILLS[1])
    expect(itemFromJson(itemToJson(n))).toMatchObject({ k: 'rect', fill: BRANCH_FILLS[1], radius: 26 })
  })
})
