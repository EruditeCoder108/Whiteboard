import { beforeEach, describe, expect, it } from 'vitest'
import { Doc, History, type EditOp } from '@/engine/doc'
import { EraserTool, SelectTool, TextTool } from '@/engine/tools'
import { itemInLasso, pickSelectionHandle, resizeSelection, selectionHandles } from '@/engine/selection'
import { S } from '@/state/store'
import type { Ptr, ToolHost } from '@/engine/tool-types'
import type { Item, Rect, ShapeItem, StrokeItem, TextItem } from '@/engine/types'

const shape = (id = 'shape', p: Rect = [0, 0, 100, 100], extra: Partial<ShapeItem> = {}): ShapeItem => ({ t: 'h', id, p, c: '#111827', w: 2, k: 'rect', ...extra })
const text = (id = 'text', extra: Partial<TextItem> = {}): TextItem => ({ t: 't', id, p: [0, 0, 100, 100], c: '#111827', w: 1, text: 'Lesson', fontSize: 24, note: false, ...extra })
const stroke = (id = 'stroke', extra: Partial<StrokeItem> = {}): StrokeItem => ({ t: 's', id, p: [0, 0, 0.5, 100, 100, 0.5], c: '#111827', w: 2, m: false, v: false, ...extra })
const pointer = (wx: number, wy: number, extra: Partial<Ptr> = {}): Ptr => ({ id: 1, type: 'mouse', x: wx, y: wy, wx, wy, pressure: 0.5, buttons: 1, shift: false, alt: false, ctrl: false, t: 0, ...extra })

class Host implements ToolHost {
  doc = new Doc()
  history = new History(this.doc)
  view = { x: 0, y: 0, zoom: 1 }
  selection: Item[] = []
  excluded: Item[] = []
  commits: EditOp[] = []
  created: [number, number, boolean][] = []
  constructor(items: Item[]) { this.doc.replaceAll(items) }
  setSelection(items: Item[]): void { this.selection = items }
  commit(op: EditOp | null): void { if (op) { this.commits.push(op); this.history.push(op) } }
  commitAdd(item: Item): void { this.commit(this.doc.push(item)) }
  refresh(): void {}
  requestOverlay(): void {}
  setExcluded(items: Iterable<Item>): void { this.excluded = [...items] }
  panBy(): void {}
  toWorld(x: number, y: number): [number, number] { return [x / this.view.zoom, y / this.view.zoom] }
  withWorld(_ctx: CanvasRenderingContext2D, fn: () => void): void { fn() }
  pruneSelection(): void { this.selection = this.selection.filter(it => this.doc.items.includes(it)) }
  createText(x: number, y: number, note = false): void { this.created.push([x, y, note]) }
  fitItem(it: Item): Item { return it }
}

describe('selection gestures', () => {
  it('selects an unfilled shape by its interior and moves its entire group in one undo step', () => {
    const a = shape('a', [0, 0, 100, 100], { group: 'group' }), b = text('b', { p: [200, 0, 300, 100], group: 'group' })
    const host = new Host([a, b]), tool = new SelectTool(host)
    tool.down(pointer(50, 50))
    expect(host.selection).toEqual([a, b])
    tool.move(pointer(80, 90)); tool.move(pointer(100, 100))
    expect(host.doc.items).toEqual([a, b])
    expect(host.excluded).toEqual([a, b])
    tool.up(pointer(110, 105))
    expect(host.doc.items[0].p).toEqual([60, 55, 160, 155])
    expect(host.doc.items[1].p).toEqual([260, 55, 360, 155])
    expect(host.commits).toHaveLength(1)
    host.history.undo(); expect(host.doc.items).toEqual([a, b])
    host.history.redo(); expect(host.doc.items[0].p[0]).toBe(60)
  })

  it('Escape cancels a transform without changing the document or undo history', () => {
    const item = shape(), host = new Host([item]), tool = new SelectTool(host)
    host.selection = [item]
    tool.down(pointer(50, 50)); tool.move(pointer(90, 100)); tool.cancel()
    expect(host.doc.items[0]).toBe(item)
    expect(host.selection).toEqual([item])
    expect(host.excluded).toEqual([])
    expect(host.commits).toHaveLength(0)
    expect(tool.underway()).toBe(false)
  })

  it('does not record a drag that returns to its original position', () => {
    const item = shape(), host = new Host([item]), tool = new SelectTool(host)
    tool.down(pointer(50, 50)); tool.move(pointer(90, 90)); tool.up(pointer(50, 50))
    expect(host.doc.items[0]).toBe(item)
    expect(host.commits).toHaveLength(0)
    expect(host.excluded).toEqual([])
  })

  it('toggles all members of a group with Shift click', () => {
    const a = shape('a', [0, 0, 100, 100], { group: 'g' }), b = shape('b', [200, 0, 300, 100], { group: 'g' })
    const host = new Host([a, b]), tool = new SelectTool(host)
    tool.down(pointer(50, 50, { shift: true })); tool.up(pointer(50, 50, { shift: true }))
    expect(host.selection).toEqual([a, b])
    tool.down(pointer(50, 50, { shift: true })); tool.up(pointer(50, 50, { shift: true }))
    expect(host.selection).toEqual([])
  })

  it('selects locked objects but prevents their movement and transformation', () => {
    const item = shape('locked', [0, 0, 100, 100], { locked: true }), host = new Host([item]), tool = new SelectTool(host)
    tool.down(pointer(50, 50)); tool.move(pointer(70, 80)); tool.up(pointer(70, 80))
    expect(host.selection).toEqual([item])
    expect(host.doc.items[0]).toBe(item)
    expect(host.commits).toHaveLength(0)
  })

  it('keeps locked objects stationary while moving unlocked members of a selection', () => {
    const a = shape('locked', [0, 0, 100, 100], { locked: true }), b = shape('free', [200, 0, 300, 100])
    const host = new Host([a, b]), tool = new SelectTool(host)
    host.selection = [a, b]
    tool.down(pointer(250, 50)); tool.up(pointer(290, 90))
    expect(host.doc.items[0]).toBe(a)
    expect(host.doc.items[1].p).toEqual([240, 40, 340, 140])
    expect(host.selection[0]).toBe(a)
  })

  it('resizes from the opposite corner and records a single undo step', () => {
    const item = text(), host = new Host([item]), tool = new SelectTool(host)
    host.selection = [item]
    tool.down(pointer(100, 100)); tool.move(pointer(125, 110)); tool.up(pointer(200, 150))
    expect(host.doc.items[0].p).toEqual([0, 0, 200, 150])
    expect(host.commits).toHaveLength(1)
    host.history.undo(); expect(host.doc.items[0]).toBe(item)
  })

  it('scales rotated objects uniformly so resizing cannot shear them', () => {
    const item = text('rotated', { p: [0, 0, 160, 80], angle: Math.PI / 4 }), host = new Host([item]), tool = new SelectTool(host)
    host.selection = [item]
    const b = host.doc.bounds()!, [x, y] = selectionHandles(b, 1).se
    tool.down(pointer(x, y)); tool.up(pointer(x + 100, y + 10))
    const result = host.doc.items[0] as TextItem
    expect((result.p[2] - result.p[0]) / (result.p[3] - result.p[1])).toBeCloseTo(2)
    expect(result.angle).toBeCloseTo(Math.PI / 4)
  })

  it('rotates around selection center and Shift snaps to fifteen degrees', () => {
    const item = text(), host = new Host([item]), tool = new SelectTool(host)
    host.selection = [item]
    tool.down(pointer(50, -28)); tool.up(pointer(130, 45, { shift: true }))
    const result = host.doc.items[0] as TextItem
    expect(result.angle).toBeCloseTo(Math.PI / 2)
    expect(result.p).toEqual(item.p)
    expect(host.commits).toHaveLength(1)
  })

  it('restores the original selection when a marquee is cancelled', () => {
    const item = shape(), host = new Host([item]), tool = new SelectTool(host)
    host.selection = [item]
    tool.down(pointer(400, 400)); tool.move(pointer(600, 600))
    expect(host.selection).toEqual([])
    tool.cancel(); expect(host.selection).toEqual([item])
  })

  it('marquee and lasso expand groups without creating duplicate selections', () => {
    const a = shape('a', [0, 0, 100, 100], { group: 'g' }), b = shape('b', [200, 0, 300, 100], { group: 'g' })
    const host = new Host([a, b]), tool = new SelectTool(host, 'lasso')
    tool.down(pointer(-20, -20)); tool.move(pointer(120, -20)); tool.move(pointer(120, 120)); tool.move(pointer(-20, 120)); tool.up(pointer(-20, -20))
    expect(host.selection).toEqual([a, b])
  })
})

describe('selection geometry', () => {
  it('keeps handle hit targets at nine screen pixels, or fourteen for touch', () => {
    const b: Rect = [0, 0, 100, 100]
    expect(pickSelectionHandle(b, 2, 104, 100)).toBe('se')
    expect(pickSelectionHandle(b, 2, 106, 100)).toBeNull()
    expect(pickSelectionHandle(b, 2, 106, 100, true)).toBe('se')
    expect(selectionHandles(b, 2).rotate).toEqual([50, -14])
  })
  it('preserves aspect ratio for uniform resizing and prevents inversion', () => {
    const result = resizeSelection([0, 0, 100, 50], 'se', 100, 5, true)
    expect(result.sx).toBe(result.sy)
    expect(result.anchor).toEqual([0, 0])
    const inverted = resizeSelection([0, 0, 100, 50], 'nw', 1000, 1000, false)
    expect(inverted.sx).toBeGreaterThan(0)
    expect(inverted.sy).toBeGreaterThan(0)
  })
  it('lasso avoids empty space in a diagonal stroke bounding box', () => {
    const polygon: [number, number][] = [[0, 80], [20, 80], [20, 100], [0, 100]]
    expect(itemInLasso(stroke(), polygon)).toBe(false)
    expect(itemInLasso(stroke(), [[40, 40], [60, 40], [60, 60], [40, 60]])).toBe(true)
  })
  it('lasso detects crossings even when both segment endpoints are outside', () => {
    expect(itemInLasso(stroke('s', { p: [-100, 50, 0.5, 200, 50, 0.5] }), [[0, 0], [100, 0], [100, 100], [0, 100]])).toBe(true)
  })
})

describe('eraser protects editable objects', () => {
  beforeEach(() => { S.eraserSize.value = 28; S.eraserMode.value = 'pixel' })
  it('pixel erasing preserves text, stickies, filled and labelled shapes, and locked ink', () => {
    const items = [text(), text('note', { note: true }), shape('fill', [0, 0, 100, 100], { fill: '#ffcc00' }), shape('label', [0, 0, 100, 100], { text: 'Start' }), stroke('locked', { locked: true })]
    const host = new Host(items), tool = new EraserTool(host)
    tool.down(pointer(0, 0)); tool.up()
    expect(host.doc.items).toEqual(items)
    expect(host.commits).toHaveLength(0)
  })
  it('stroke erasing removes unlocked outlines while preserving text and locked items', () => {
    S.eraserMode.value = 'stroke'
    const note = text(), locked = shape('locked', [0, 0, 100, 100], { locked: true }), removable = shape('outline')
    const host = new Host([note, locked, removable]), tool = new EraserTool(host)
    tool.down(pointer(0, 0)); tool.up()
    expect(host.doc.items).toEqual([note, locked])
    host.history.undo(); expect(host.doc.items).toEqual([note, locked, removable])
  })
  it('cancelling a pixel erase restores the original immutable objects', () => {
    const item = stroke(), host = new Host([item]), tool = new EraserTool(host)
    tool.down(pointer(50, 50)); expect(host.doc.items).not.toEqual([item])
    tool.cancel(); expect(host.doc.items[0]).toBe(item)
    expect(host.commits).toHaveLength(0)
  })
})

describe('text placement', () => {
  it('creates at pointer-up once, and cancellation never creates an object', () => {
    const host = new Host([]), tool = new TextTool(host, true)
    tool.down(); tool.up(pointer(12, 30)); tool.up(pointer(12, 30))
    expect(host.created).toEqual([[12, 30, true]])
    tool.down(); tool.cancel(); tool.up(pointer(80, 80))
    expect(host.created).toHaveLength(1)
  })
})
