import { describe, expect, it } from 'vitest'
import { hitObject, itemBounds, rotatePoint, splitErase } from '@/engine/items'
import { transformItem, expandGroups, pointInPolygon } from '@/engine/transforms'
import { wrapText } from '@/engine/text'
import { Doc, History } from '@/engine/doc'
import type { ShapeItem, StrokeItem, TextItem } from '@/engine/types'

const shape: ShapeItem = { t: 'h', id: 'shape', c: '#111827', w: 2, k: 'rect', p: [0, 0, 100, 40] }
const text: TextItem = { t: 't', id: 'text', c: '#111827', w: 1, text: 'Hello', fontSize: 24, note: false, p: [0, 0, 100, 40] }

describe('editable object geometry', () => {
  it('rotates a shape about its centre without changing its source geometry', () => {
    const rotated = transformItem(shape, [50, 20], 1, 1, Math.PI / 2) as ShapeItem
    expect(rotated.p).toEqual(shape.p)
    expect(rotated.angle).toBeCloseTo(Math.PI / 2)
    expect(shape.angle).toBeUndefined()
    const b = itemBounds(rotated)
    expect(b[2] - b[0]).toBeCloseTo(45.2)
    expect(b[3] - b[1]).toBeCloseTo(105.2)
    expect(hitObject(rotated, 50, -20, 0)).toBe(true)
    expect(hitObject(rotated, 5, 20, 0)).toBe(false)
  })
  it('does not enlarge tiny objects when rotating them', () => {
    const tiny = { ...shape, p: [0, 0, 4, 2] as [number, number, number, number] }
    expect((transformItem(tiny, [2, 1], 1, 1, Math.PI / 2) as ShapeItem).p).toEqual(tiny.p)
  })
  it('rotation preserves imported small widths and large lettering', () => {
    const imported = { ...text, w: .001, fontSize: 900 }
    const rotated = transformItem(imported, [50, 20], 1, 1, Math.PI / 2) as TextItem
    expect(rotated.w).toBe(.001); expect(rotated.fontSize).toBe(900)
  })
  it('side resizing reflows text without changing its font size', () => {
    const resized = transformItem(text, [0, 0], .5, 1) as TextItem
    expect(resized.fontSize).toBe(text.fontSize)
    expect(resized.p[2]).toBe(50)
  })
  it('scales ink and its pressure samples consistently', () => {
    const ink: StrokeItem = { t: 's', id: 'ink', c: '#111827', w: 3, m: false, v: true, p: [0, 0, .2, 20, 10, .9] }
    const result = transformItem(ink, [0, 0], 2, 2, Math.PI / 2) as StrokeItem
    expect(result.p[0]).toBeCloseTo(0); expect(result.p[3]).toBeCloseTo(-20)
    expect(result.p[4]).toBeCloseTo(40); expect(result.p[5]).toBe(.9)
    expect(result.w).toBe(6); expect(ink.w).toBe(3)
  })
  it('hit-tests rotated text in local space', () => {
    const rotated = { ...text, angle: Math.PI / 2 }
    expect(hitObject(rotated, 50, -20, 0)).toBe(true)
    expect(hitObject(rotated, 10, 20, 0)).toBe(false)
  })
  it('selects empty shape interiors and respects polygon boundaries', () => {
    expect(hitObject(shape, 50, 20, 0)).toBe(true)
    expect(hitObject({ ...shape, k: 'diamond' }, 1, 1, 0)).toBe(false)
    expect(hitObject({ ...shape, k: 'diamond' }, 50, 20, 0)).toBe(true)
    expect(hitObject({ ...shape, k: 'triangle' }, 1, 1, 0)).toBe(false)
    expect(hitObject({ ...shape, k: 'triangle' }, 50, 20, 0)).toBe(true)
  })
  it('rotates pixel-erase fragments back into world space', () => {
    const rotated = { ...shape, k: 'line' as const, p: [0, 0, 100, 0] as [number, number, number, number], angle: Math.PI / 2 }
    const fragments = splitErase(rotated, 50, 0, 10)
    expect(fragments.length).toBe(2)
    expect(fragments.every(f => f.p.filter((_, i) => i % 3 === 0).every(x => Math.abs(x - 50) < .001))).toBe(true)
  })
  it('pixel erasing preserves group membership and opacity in surviving fragments', () => {
    const original: StrokeItem = { t: 's', id: 'ink', c: '#111827', w: 2, m: false, v: false, p: [0, 0, .5, 100, 0, .5], group: 'g', opacity: .3 }
    const fragments = splitErase(original, 50, 0, 10)
    expect(fragments.length).toBe(2)
    expect(fragments.every(f => f.group === 'g' && f.opacity === .3)).toBe(true)
    const outlines = splitErase({ ...shape, group: 'g', opacity: .4 }, 50, 0, 10)
    expect(outlines.length).toBeGreaterThan(0)
    expect(outlines.every(f => f.group === 'g' && f.opacity === .4)).toBe(true)
  })
  it('expands selected groups without swallowing unrelated objects', () => {
    const a = { ...shape, group: 'g' }, b = { ...text, group: 'g' }, c = { ...shape, id: 'other' }
    expect(expandGroups([a, b, c], [a])).toEqual([a, b])
    expect(pointInPolygon(10, 10, [[0, 0], [20, 0], [20, 20], [0, 20]])).toBe(true)
    expect(pointInPolygon(40, 10, [[0, 0], [20, 0], [20, 20], [0, 20]])).toBe(false)
  })
  it('undoes and redoes a reordered selection without changing other objects', () => {
    const doc = new Doc(), history = new History(doc)
    const a = shape, b = text, c = { ...shape, id: 'c' }
    doc.replaceAll([a, b, c]); const before = doc.snapshot()
    doc.replaceAll([b, c, { ...a }]); history.push(doc.diff(before)!)
    history.undo(); expect(doc.items).toEqual([a, b, c])
    history.redo(); expect(doc.items.map(i => i.id)).toEqual(['text', 'c', 'shape'])
  })
  it('rotates coordinates reversibly', () => {
    const p = rotatePoint(14, 9, 5, 5, .7)
    const q = rotatePoint(...p, 5, 5, -.7)
    expect(q[0]).toBeCloseTo(14); expect(q[1]).toBeCloseTo(9)
  })
})

describe('shared text wrapping', () => {
  const measure = (s: string) => Array.from(s).length * 10
  it('wraps at word boundaries and preserves explicit empty lines', () => {
    expect(wrapText('one two\n\nthree', 40, measure)).toEqual(['one', 'two', '', 'thre', 'e'])
  })
  it('does not split a Unicode code point when breaking a long word', () => {
    expect(wrapText('🟨🟦🟩', 10, measure)).toEqual(['🟨', '🟦', '🟩'])
  })
  it('creates one bullet or number per paragraph', () => {
    expect(wrapText('First\nSecond', 100, measure, 'bullet')).toEqual(['• First', '• Second'])
    expect(wrapText('First\nSecond', 100, measure, 'number')).toEqual(['1. First', '2. Second'])
  })
  it('indents wrapped list lines and keeps the first word with its bullet', () => {
    expect(wrapText('First word', 70, measure, 'bullet')).toEqual(['• First', '  word'])
    expect(wrapText('abcdefgh', 50, measure, 'bullet')).toEqual(['• abc', '  def', '  gh'])
  })
})
