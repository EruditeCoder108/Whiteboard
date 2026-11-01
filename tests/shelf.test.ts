import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { itemBounds } from '../src/renderer/src/engine/items'
import { parseBoard, serializePages } from '../src/renderer/src/engine/serialize'
import { freshCopies, pageAt, placeInView, readableOn } from '../src/renderer/src/engine/shelf'
import type { Item, Rect, ShapeItem, StrokeItem, TextItem } from '../src/renderer/src/engine/types'
import { Shelf } from '../src/main/shelf'

const stroke = (over: Partial<StrokeItem> = {}): StrokeItem => ({ t: 's', id: 'a', c: '#ffffff', w: 4, m: false, v: false, p: [100, 100, .5, 300, 200, .5], ...over })
const board = (items: Item[] = [stroke()], color = '#1d3b33'): string => serializePages([{ items }], 0, true, { kind: 'notebook', frames: [], color }).json
const info = { title: 'Heart', subject: 'Class 10', kind: 'selection', count: 1, from: 'Ch 4', thumb: 'data:image/webp;base64,AAAA' }

describe('the shelf on disk', () => {
  let dir = '', other = '', shelf: Shelf
  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'fw-shelf-'))
    other = await fs.mkdtemp(join(tmpdir(), 'fw-shelf-other-'))
    shelf = new Shelf(join(dir, 'shelf'))
  })
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
    await fs.rm(other, { recursive: true, force: true })
  })
  const saved = async (over = {}, json = board()): Promise<string> => {
    const r = await shelf.save({ ...info, ...over }, json)
    if (!r.ok) throw new Error(r.error)
    return r.item.id
  }

  it('starts empty, keeps what is saved and reads it back', async () => {
    expect(await shelf.list()).toEqual([])
    const id = await saved()
    const [it] = await shelf.list()
    expect(it).toMatchObject({ id, title: 'Heart', subject: 'Class 10', kind: 'selection', count: 1, from: 'Ch 4' })
    expect(parseBoard((await shelf.read(id))!)?.pages?.[0].items).toHaveLength(1)
  })

  it('refuses something that is not a valid board, or has no name', async () => {
    expect((await shelf.save(info, '{"nope":1}')).ok).toBe(false)
    expect((await shelf.save({ ...info, title: '  ' }, board())).ok).toBe(false)
    expect(await shelf.list()).toEqual([])
  })

  it('renames and refiles; only ever touches its own folders', async () => {
    const id = await saved()
    expect((await shelf.update(id, { title: 'Human heart', subject: 'Biology' })).ok).toBe(true)
    expect((await shelf.list())[0]).toMatchObject({ title: 'Human heart', subject: 'Biology' })
    expect((await shelf.update(id, { title: '' })).ok).toBe(false)
    expect(await shelf.read('../../secret')).toBeNull()
    expect((await shelf.remove('..')).ok).toBe(false)
  })

  it('what was used last comes first', async () => {
    const a = await saved({ title: 'A' })
    await new Promise(r => setTimeout(r, 5))
    await saved({ title: 'B' })
    expect((await shelf.list()).map(it => it.title)).toEqual(['B', 'A'])
    await new Promise(r => setTimeout(r, 5))
    await shelf.read(a)
    expect((await shelf.list()).map(it => it.title)).toEqual(['A', 'B'])
  })

  it('delete goes through the bin, as one folder', async () => {
    const binned: string[] = []
    shelf = new Shelf(join(dir, 'shelf'), async p => { binned.push(p); await fs.rm(p, { recursive: true }) })
    const id = await saved()
    expect((await shelf.remove(id)).ok).toBe(true)
    expect(binned).toEqual([join(dir, 'shelf', id)])
    expect(await shelf.list()).toEqual([])
  })

  it('one damaged item does not lose the rest', async () => {
    const id = await saved({ title: 'Bad' })
    await saved({ title: 'Good' })
    await fs.writeFile(join(dir, 'shelf', id, 'meta.json'), '{ broken')
    expect((await shelf.list()).map(it => it.title)).toEqual(['Good'])
  })

  it('a shelf file carries everything to another PC, and adding it twice does not double it', async () => {
    await saved({ title: 'A' }, board([stroke({ id: 'one' })]))
    await saved({ title: 'B' }, board([stroke({ id: 'two' })]))
    const file = join(other, 'My shelf.wbshelf')
    expect(await shelf.exportTo(file)).toEqual({ ok: true, count: 2 })
    const there = new Shelf(join(other, 'there'))
    expect(await there.importFrom(file)).toEqual({ ok: true, added: 2, same: 0, bad: 0 })
    expect(await there.importFrom(file)).toEqual({ ok: true, added: 0, same: 2, bad: 0 })
    expect((await there.list()).map(it => it.title).sort()).toEqual(['A', 'B'])
  })

  it('an imported file is checked item by item, and its pictures may only be plain images', async () => {
    const file = join(other, 'x.wbshelf')
    await fs.writeFile(file, JSON.stringify({ format: 'floating-whiteboard-shelf', version: 1, items: [
      { title: 'Fine', kind: 'page', board: board(), thumb: 'data:text/html;base64,AAAA' },
      { title: 'Broken', kind: 'page', board: '{}' },
      { kind: 'page', board: board() }
    ] }))
    expect(await shelf.importFrom(file)).toEqual({ ok: true, added: 1, same: 0, bad: 2 })
    expect((await shelf.list())[0].thumb).toBeUndefined()
    await fs.writeFile(file, 'not json')
    expect((await shelf.importFrom(file)).ok).toBe(false)
  })
})

describe('putting a saved item on the board', () => {
  it('gives new ids, unlocks, and keeps groups together but apart from the original', () => {
    const items = [stroke({ id: 'a', group: 'g', locked: true }), stroke({ id: 'b', group: 'g' }), stroke({ id: 'c' })]
    const copy = freshCopies(items), again = freshCopies(items)
    expect(new Set(copy.map(it => it.id)).size).toBe(3)
    expect(copy.some(it => items.some(o => o.id === it.id))).toBe(false)
    expect(copy[0].group).toBe(copy[1].group)
    expect(copy[0].group).not.toBe('g')
    expect(copy[0].group).not.toBe(again[0].group)
    expect(copy[2].group).toBeUndefined()
    expect(copy[0].locked).toBeUndefined()
  })

  const box = (items: Item[]): Rect => items.map(itemBounds).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])])

  it('lands in the middle of what is visible, at its own size when it fits', () => {
    const b = box(placeInView([stroke()], [1000, 2000, 2600, 2900]))
    expect((b[0] + b[2]) / 2).toBeCloseTo(1800)
    expect((b[1] + b[3]) / 2).toBeCloseTo(2450)
    expect(b[2] - b[0]).toBeCloseTo(box([stroke()])[2] - box([stroke()])[0])
  })

  it('shrinks to fit, never grows', () => {
    const big = stroke({ p: [0, 0, .5, 4000, 3000, .5] })
    const b = box(placeInView([big], [0, 0, 1600, 900]))
    expect(b[3] - b[1]).toBeLessThanOrEqual(900)
    expect(b[0]).toBeGreaterThanOrEqual(0)
    expect(placeInView([], [0, 0, 10, 10])).toEqual([])
  })

  it('white chalk becomes dark ink on a white page, and black ink becomes chalk on a blackboard', () => {
    expect((readableOn([stroke()], '#1d3b33', '#ffffff')[0] as StrokeItem).c).toBe('#111827')
    expect((readableOn([stroke({ c: '#111827' })], '#ffffff', '#1d3b33')[0] as StrokeItem).c).toBe('#ffffff')
  })

  it('a colour keeps its hue when it has to change; ink that can be read stays exactly as it is', () => {
    const yellow = (readableOn([stroke({ c: '#f5c518' })], '#1d3b33', '#ffffff')[0] as StrokeItem).c
    expect(yellow).not.toBe('#f5c518')
    expect(yellow).not.toBe('#111827')
    const blue = stroke({ c: '#2f6bff' })
    expect(readableOn([blue], '#1d3b33', '#ffffff')[0]).toBe(blue)
  })

  it('an equation follows the board like ink; an ordinary picture is left as it is', () => {
    const src = 'data:image/svg+xml;charset=utf-8,x'
    const equation = { t: 'i', id: 'e', c: '#ffffff', w: 1, p: [0, 0, 10, 10], src, aspect: 1, latex: 'x^2' } as Item
    expect(readableOn([equation], '#1d3b33', '#ffffff')[0].c).toBe('#111827')
    const picture = { t: 'i', id: 'p', c: '#ffffff', w: 1, p: [0, 0, 10, 10], src: 'data:image/png;base64,AAAA', aspect: 1 } as Item
    expect(readableOn([picture], '#1d3b33', '#ffffff')[0]).toBe(picture)
  })

  it('leaves alone a white mask on a white board, highlighter, and text on its own fill', () => {
    const mask = stroke()
    expect(readableOn([mask], '#ffffff', '#ffffff')[0]).toBe(mask)
    const marker = stroke({ m: true })
    expect(readableOn([marker], '#1d3b33', '#ffffff')[0]).toBe(marker)
    const note: TextItem = { t: 't', id: 'n', c: '#ffffff', w: 1, p: [0, 0, 10, 10], text: 'x', fontSize: 20, note: true, fill: '#333333' }
    expect(readableOn([note], '#1d3b33', '#ffffff')[0]).toBe(note)
    const shape: ShapeItem = { t: 'h', id: 's', c: '#ffffff', w: 2, k: 'rect', p: [0, 0, 10, 10], fill: '#333333', text: 'x' }
    expect(readableOn([shape], '#1d3b33', '#ffffff')[0]).toMatchObject({ c: '#111827', textColor: '#ffffff' })
  })

  it('moves a page with its paper pattern', () => {
    const moved = pageAt({ items: [stroke()], frame: { x: 100, y: 50, extent: 2 }, origin: [120, 60], paper: 'graph' }, 0, 0)
    expect(moved.frame).toEqual({ x: 0, y: 0, extent: 2 })
    expect(moved.origin).toEqual([20, 10])
    expect((moved.items[0] as StrokeItem).p.slice(0, 2)).toEqual([0, 50])
  })

  it('a saved page or selection survives the lesson format, pictures and colour included', () => {
    const picture = { t: 'i', id: 'p', c: '#111827', w: 1, p: [0, 0, 100, 50], src: 'data:image/png;base64,iVBORw0KGgo=', aspect: 2 } as Item
    const parsed = parseBoard(serializePages([{ items: [picture], paper: 'graph', color: '#ffffff', texture: 'none', frame: { x: 0, y: 0, extent: 2 } }], 0, true, { kind: 'notebook', frames: [], color: '#ffffff' }).json)
    expect(parsed?.pages?.[0]).toMatchObject({ paper: 'graph', frame: { x: 0, y: 0, extent: 2 } })
    expect((parsed?.pages?.[0].items[0] as { src: string }).src).toBe('data:image/png;base64,iVBORw0KGgo=')
    expect(parseBoard(board())?.color).toBe('#1d3b33')
  })
})
