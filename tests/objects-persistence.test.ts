import { describe, expect, it } from 'vitest'
import { FORMAT, MAX_TEXT_LENGTH, VERSION, itemFromJson, parseBoard, serializeBoard } from '@/engine/serialize'
import type { Item, ShapeItem, StrokeItem, TextItem } from '@/engine/types'

const ink: StrokeItem = {
  t: 's', id: 'ink-1', c: '#173654', w: 4, m: false, v: true,
  p: [10, 20, 0.2, 30, 40, 0.8], group: 'lesson-group', locked: true, opacity: 0.65
}
const shape: ShapeItem = {
  t: 'h', id: 'shape-1', c: '#205060', w: 3, k: 'diamond', p: [40, 50, 400, 250],
  angle: Math.PI / 6, fill: '#ffeeaa', dash: 'dashed', radius: 24,
  text: 'Choose a path\nTry again →', fontSize: 28, bold: true, italic: false,
  align: 'center', list: 'bullet', textColor: '#173654',
  group: 'lesson-group', locked: false, opacity: 0.8
}
const note: TextItem = {
  t: 't', id: 'note-1', c: '#173654', w: 2, p: [-100, -20, 180, 200],
  text: 'Ideas\nहिन्दी, 日本語, 🧑🏽‍🏫', fontSize: 24, note: true, fill: '#ffe7a1',
  angle: -Math.PI / 8, bold: false, italic: true, align: 'left', list: 'number',
  textColor: '#102030', locked: true, opacity: 0.95
}
const board = (items: unknown[], version = VERSION, format: string | undefined = FORMAT) => JSON.stringify({ format, version, items })

describe('editable object persistence', () => {
  it('round-trips a mixed lesson with every editable style and shared group intact', () => {
    const text: TextItem = { ...note, id: 'text-1', note: false, fill: 'none', text: '', list: 'none', opacity: 0 }
    const triangle: ShapeItem = { ...shape, id: 'triangle-1', k: 'triangle', dash: 'dotted', radius: 0, fill: '#ff00ff88' }
    const items: Item[] = [ink, shape, note, text, triangle]
    const json = serializeBoard(items, { x: 35, y: -20, zoom: 1.5 })
    expect(JSON.parse(json).version).toBe(2)
    const parsed = parseBoard(json)!
    expect(parsed.items).toEqual(items)
    expect(parsed).toMatchObject({ view: { x: 35, y: -20, zoom: 1.5 }, skipped: 0, legacy: false })
  })

  it('keeps default-free older object styles absent after migration', () => {
    const old = { t: 'h', id: 'old-rect', c: '#000', w: 2, k: 'rect', p: [0, 0, 100, 50] }
    const parsed = parseBoard(board([old], 1))!
    expect(parsed.items).toEqual([old])
    const saved = JSON.parse(serializeBoard(parsed.items))
    expect(saved.version).toBe(2)
    expect(saved.items).toEqual([old])
  })

  it('migrates Python constant/pressure ink and shapes to version 2', () => {
    const legacy = JSON.stringify({ version: 1, view: { x: 20, y: 30, z: 2 }, items: [
      { t: 'ink', c: '#000', w: 4, p: [0, 0, 40, 40] },
      { t: 'ink', c: '#345', w: 10, v: 1, p: [0, 0, 4, 40, 40, 16] },
      { t: 'shape', c: '#456', w: 2, s: 'ellipse', p: [10, 10, 200, 100] }
    ] })
    const parsed = parseBoard(legacy)!
    expect(parsed.legacy).toBe(true)
    expect(parsed.skipped).toBe(0)
    expect(parsed.items[0].p).toEqual([0, 0, 0.5, 40, 40, 0.5])
    expect(parsed.items[1].p).toEqual([0, 0, 0, 40, 40, 1])
    expect(parsed.view).toEqual({ x: 20, y: 30, zoom: 2 })
    expect(new Set(parsed.items.map(item => item.id)).size).toBe(3)
    const migrated = parseBoard(serializeBoard(parsed.items, parsed.view))!
    expect(migrated.items).toEqual(parsed.items)
    expect(migrated.legacy).toBe(false)
  })

  it('repairs duplicate IDs without separating members of a saved group', () => {
    const parsed = parseBoard(board([shape, { ...shape, p: [500, 50, 800, 250] }]))!
    expect(parsed.items).toHaveLength(2)
    expect(new Set(parsed.items.map(item => item.id)).size).toBe(2)
    expect(parsed.items.map(item => item.group)).toEqual(['lesson-group', 'lesson-group'])
  })

  it('does not retain caller-owned point arrays when importing', () => {
    const raw = { ...ink, p: [...ink.p] }
    const parsed = itemFromJson(raw)!
    raw.p[0] = 999
    expect(parsed.p[0]).toBe(10)
  })

  it('preserves tiny but valid brush widths instead of rounding them to zero', () => {
    const parsed = parseBoard(serializeBoard([{ ...ink, w: 0.001 }]))!
    expect(parsed.items[0].w).toBe(0.001)
  })
})

describe('editable object validation', () => {
  it('normalizes reversed text rectangles and rejects invisible zero-sized text boxes', () => {
    expect(itemFromJson({ ...note, p: [180, 200, -100, -20] })?.p).toEqual(note.p)
    expect(itemFromJson({ ...note, p: [0, 0, 0, 100] })).toBeNull()
    expect(itemFromJson({ ...note, p: [0, 0, 100, 0] })).toBeNull()
  })
  it.each([
    ['text number', { text: 42 }], ['oversized text', { text: 'x'.repeat(MAX_TEXT_LENGTH + 1) }],
    ['zero font size', { fontSize: 0 }], ['oversized font', { fontSize: 1001 }], ['non-finite font', { fontSize: Infinity }],
    ['bold number', { bold: 1 }], ['italic string', { italic: 'false' }],
    ['unknown alignment', { align: 'justify' }], ['unknown list', { list: 'todo' }],
    ['text color', { textColor: 'red' }], ['invalid fill', { fill: 'url(https://example.test/image)' }],
    ['angle', { angle: NaN }], ['oversized angle', { angle: 1e7 }],
    ['negative radius', { radius: -1 }], ['non-finite radius', { radius: Infinity }], ['oversized radius', { radius: 1e7 }],
    ['unknown dash', { dash: 'zigzag' }], ['unknown shape', { k: 'future-shape' }]
  ])('rejects an invalid %s rather than dropping the field', (_label, patch) => {
    expect(itemFromJson({ ...shape, ...patch })).toBeNull()
  })

  it.each([
    ['empty ID', { id: '' }], ['blank ID', { id: '   ' }], ['numeric ID', { id: 3 }],
    ['control in ID', { id: 'a\nb' }], ['long ID', { id: 'x'.repeat(129) }],
    ['empty group', { group: '' }], ['numeric group', { group: 1 }], ['long group', { group: 'x'.repeat(129) }],
    ['control in group', { group: 'a\u0000b' }], ['non-boolean lock', { locked: 1 }],
    ['negative opacity', { opacity: -0.01 }], ['large opacity', { opacity: 1.01 }], ['non-finite opacity', { opacity: NaN }]
  ])('rejects %s on every object type', (_label, patch) => {
    for (const item of [ink, shape, note]) expect(itemFromJson({ ...item, ...patch })).toBeNull()
  })

  it.each([
    ['text', { text: undefined }], ['fontSize', { fontSize: undefined }], ['note', { note: undefined }],
    ['invalid note', { note: 1 }], ['short bounds', { p: [0, 0, 100] }],
    ['non-finite bounds', { p: [0, 0, Infinity, 100] }], ['oversized bounds', { p: [0, 0, 1e10, 100] }]
  ])('rejects missing or invalid text-object %s', (_label, patch) => {
    expect(itemFromJson({ ...note, ...patch })).toBeNull()
  })

  it('preserves surviving objects and reports damaged objects to the caller', () => {
    const parsed = parseBoard(board([note, { ...shape, radius: -1 }, { ...ink, opacity: 'opaque' }]))!
    expect(parsed.items).toEqual([note])
    expect(parsed.skipped).toBe(2)
    expect(parseBoard(board([{ ...note, text: null }]))).toBeNull()
  })

  it('enforces document count and format/version limits', () => {
    expect(parseBoard(board(new Array(100_001).fill(null)))).toBeNull()
    expect(parseBoard(board([], 3))).toBeNull()
    expect(parseBoard(board([], 0))).toBeNull()
    expect(parseBoard(board([], 2, 'another-app'))).toBeNull()
    expect(parseBoard(JSON.stringify({ version: 2, items: [] }))).toBeNull()
    expect(parseBoard(board([]))).toMatchObject({ items: [], skipped: 0, legacy: false })
  })

  it('accepts safe boundary values without changing editable data', () => {
    const boundary: ShapeItem = {
      ...shape, id: 'i'.repeat(128), group: 'g'.repeat(128), text: 'x'.repeat(MAX_TEXT_LENGTH),
      fontSize: 1000, angle: -1e6, radius: 1e6, opacity: 0, fill: 'none', p: [-1e9, -1e9, 1e9, 1e9]
    }
    expect(parseBoard(serializeBoard([boundary]))!.items).toEqual([boundary])
  })
})
