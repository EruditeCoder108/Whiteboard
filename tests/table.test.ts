import { describe, expect, it } from 'vitest'
import { withNewIds } from '../src/renderer/src/engine/connectors'
import { itemBounds, hitObject } from '../src/renderer/src/engine/items'
import { itemFromJson, itemToJson } from '../src/renderer/src/engine/serialize'
import { readableOn } from '../src/renderer/src/engine/shelf'
import { addCol, addRow, cellAt, cellRect, dividerAt, edgesOf, fitTable, moveDivider, newTable, nextCell, removeCol, removeRow, setCell } from '../src/renderer/src/engine/table'
import { transformItem } from '../src/renderer/src/engine/transforms'
import type { TableItem } from '../src/renderer/src/engine/types'

const table = (rows = 2, cols = 3): TableItem => ({ t: 'b', id: 't', c: '#111827', w: 2, ...newTable(rows, cols, 500, 300, 1600, 900) })
const sums = (it: TableItem): void => {
  expect(it.cols.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  expect(it.rows.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  expect(it.cells).toHaveLength(it.rows.length)
  for (const row of it.cells) expect(row).toHaveLength(it.cols.length)
}
/** Every character as wide as half the font, for sums that are easy to check. */
const measure = (s: string): number => s.length * 15

describe('shape of a table', () => {
  it('starts empty, centred and within the room', () => {
    const t = table()
    sums(t)
    expect((t.p[0] + t.p[2]) / 2).toBeCloseTo(500)
    expect(t.cells.flat().every(c => c === '')).toBe(true)
    const huge = newTable(20, 12, 0, 0, 800, 400)
    expect(huge.p[2] - huge.p[0]).toBeLessThanOrEqual(800)
    expect(huge.p[3] - huge.p[1]).toBeLessThanOrEqual(400)
  })

  it('adds and removes rows and columns, keeping the text in its place', () => {
    let t = setCell(table(), 1, 2, 'x')
    t = addRow(t, 0); sums(t)
    expect(t.cells[2][2]).toBe('x')
    t = addCol(t, 0); sums(t)
    expect(t.cells[2][3]).toBe('x')
    t = removeRow(t, 1); sums(t)
    expect(t.cells[1][3]).toBe('x')
    t = removeCol(t, 1); sums(t)
    expect(t.cells[1][2]).toBe('x')
    expect(t.rows).toHaveLength(2)
    expect(t.cols).toHaveLength(3)
  })

  it('a new row adds height and leaves other rows their size; the last one cannot be removed', () => {
    const t = table(), h = t.p[3] - t.p[1], next = addRow(t)
    expect(next.p[3] - next.p[1]).toBeGreaterThan(h)
    expect(next.rows[0] * (next.p[3] - next.p[1])).toBeCloseTo(t.rows[0] * h)
    const one = table(1, 1)
    expect(removeRow(one)).toBe(one)
    expect(removeCol(one)).toBe(one)
  })
})

describe('touching a table', () => {
  it('finds the cell under a place, even when turned', () => {
    const t = table()
    const [x0, y0, x1, y1] = cellRect(t, 1, 2)
    expect(cellAt(t, (x0 + x1) / 2, (y0 + y1) / 2)).toEqual({ r: 1, c: 2 })
    expect(cellAt(t, -999, -999)).toBeNull()
    const turned: TableItem = { ...t, angle: Math.PI / 2 }
    const cx = (t.p[0] + t.p[2]) / 2, cy = (t.p[1] + t.p[3]) / 2
    expect(cellAt(turned, cx, cy)).not.toBeNull()
  })

  it('finds a line between cells, not the outer edge', () => {
    const t = table(), { xs, ys } = edgesOf(t)
    expect(dividerAt(t, xs[1] + 3, ys[1] - 20, 10)).toEqual({ axis: 'col', i: 0 })
    expect(dividerAt(t, xs[1] + 40, ys[1] + 2, 10)).toEqual({ axis: 'row', i: 0 })
    expect(dividerAt(t, xs[0], ys[1] - 20, 10)).toBeNull()
    expect(dividerAt(t, xs[1] + 40, ys[1] - 30, 10)).toBeNull()
  })

  it('dragging a line changes just the two either side, never to nothing', () => {
    const t = table(), wide = t.p[2] - t.p[0]
    const moved = moveDivider(t, { axis: 'col', i: 0 }, 60)
    expect(moved.cols[0] * wide).toBeCloseTo(t.cols[0] * wide + 60)
    expect(moved.cols[1] * wide).toBeCloseTo(t.cols[1] * wide - 60)
    expect(moved.cols[2]).toBe(t.cols[2])
    sums(moved)
    const far = moveDivider(t, { axis: 'col', i: 0 }, 9999)
    expect(far.cols[1] * wide).toBeGreaterThanOrEqual(43)
    sums(far)
  })

  it('Tab goes along the rows and round', () => {
    const t = table(2, 2)
    expect(nextCell(t, 0, 0)).toEqual({ r: 0, c: 1 })
    expect(nextCell(t, 0, 1)).toEqual({ r: 1, c: 0 })
    expect(nextCell(t, 1, 1)).toEqual({ r: 0, c: 0 })
    expect(nextCell(t, 0, 0, true)).toEqual({ r: 1, c: 1 })
  })
})

describe('text', () => {
  it('a row grows for its text, and the table with it', () => {
    const t = setCell(table(), 0, 0, 'word '.repeat(40))
    const fit = fitTable(t, measure)
    expect(fit.p[3] - fit.p[1]).toBeGreaterThan(t.p[3] - t.p[1])
    expect(fit.rows[0]).toBeGreaterThan(fit.rows[1])
    expect(fit.rows[1] * (fit.p[3] - fit.p[1])).toBeCloseTo(t.rows[1] * (t.p[3] - t.p[1]))
    sums(fit)
  })

  it('leaves alone what already fits', () => {
    const t = setCell(table(), 0, 0, 'ok')
    expect(fitTable(t, measure)).toBe(t)
  })

  it('setting the same text changes nothing; Hindi stays whole', () => {
    const t = setCell(table(), 0, 0, 'क्षेत्रफल')
    expect(t.cells[0][0]).toBe('क्षेत्रफल')
    expect(setCell(t, 0, 0, 'क्षेत्रफल')).toBe(t)
    expect(setCell(t, 9, 9, 'x')).toBe(t)
  })
})

describe('as an object', () => {
  it('survives the lesson file; a bad table is refused', () => {
    const t: TableItem = { ...setCell(table(), 0, 1, 'विद्यार्थी'), head: true, textColor: '#ff0000', angle: .5, group: 'g' }
    const back = itemFromJson(JSON.parse(JSON.stringify(itemToJson(t)))) as TableItem
    expect(back.cells).toEqual(t.cells)
    expect(back).toMatchObject({ t: 'b', head: true, textColor: '#ff0000', group: 'g', fontSize: t.fontSize })
    sums(back)
    const json = JSON.parse(JSON.stringify(itemToJson(t)))
    expect(itemFromJson({ ...json, cells: [['a']] })).toBeNull()
    expect(itemFromJson({ ...json, cols: [.5, .9, .3] })).toBeNull()
    expect(itemFromJson({ ...json, rows: Array(30).fill(1 / 30), cells: Array(30).fill(['', '', '']) })).toBeNull()
    expect(itemFromJson({ ...json, cols: [] })).toBeNull()
    expect(itemFromJson({ ...json, fontSize: 'big' })).toBeNull()
  })

  it('moves, scales and copies like any other object', () => {
    const t = table()
    expect(itemBounds(t)).toEqual([t.p[0], t.p[1], t.p[2], t.p[3]])
    expect(hitObject(t, 500, 300, 2)).toBe(true)
    const big = transformItem(t, [0, 0], 2, 2) as TableItem
    expect(big.fontSize).toBeCloseTo(t.fontSize * 2)
    expect(big.cols).toEqual(t.cols)
    const side = transformItem(t, [0, 0], 2, 1) as TableItem
    expect(side.fontSize).toBe(t.fontSize)
    expect(withNewIds([t])[0].id).not.toBe('t')
  })

  it('its lines and writing follow the board', () => {
    const t: TableItem = { ...table(), c: '#ffffff', textColor: '#ffffff' }
    const out = readableOn([t], '#1d3b33', '#ffffff')[0] as TableItem
    expect(out.c).toBe('#111827')
    expect(out.textColor).toBe('#111827')
  })
})
