import { wrapText } from './text'
import type { Rect, TableItem } from './types'

/**
 * A table of typed text: `cols` and `rows` are shares of its width and height, each adding up to 1,
 * so resizing keeps its proportions. Text never clips: a row grows when its text needs the room.
 */
export const MAX_ROWS = 20
export const MAX_COLS = 12
export const MAX_CELL = 2000
const MIN_COL = 44
const MIN_ROW = 28
const LINE = 1.3

export const cellPad = (fontSize: number): number => Math.max(4, fontSize * .32)
export const tableFont = (it: Pick<TableItem, 'fontSize'>, head = false): string => `${head ? '600 ' : ''}${it.fontSize}px "Segoe UI", "Nirmala UI", sans-serif`

const width = (it: TableItem): number => Math.abs(it.p[2] - it.p[0])
const height = (it: TableItem): number => Math.abs(it.p[3] - it.p[1])
const share = (sizes: number[]): number[] => { const total = sizes.reduce((a, b) => a + b, 0); return sizes.map(v => v / total) }

export function newTable(rows: number, cols: number, x: number, y: number, roomW: number, roomH: number): Pick<TableItem, 'p' | 'cols' | 'rows' | 'cells' | 'fontSize'> {
  const w = Math.min(roomW, cols * 240), h = Math.min(roomH, rows * 76), fontSize = Math.max(14, Math.min(32, h / rows * .42))
  return {
    p: [x - w / 2, y - h / 2, x + w / 2, y + h / 2],
    cols: Array.from({ length: cols }, () => 1 / cols), rows: Array.from({ length: rows }, () => 1 / rows),
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')), fontSize
  }
}

export function validTable(o: Record<string, unknown>): boolean {
  const { cols, rows, cells, fontSize } = o
  const shares = (a: unknown, max: number): a is number[] => Array.isArray(a) && a.length >= 1 && a.length <= max && a.every(v => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 1) && Math.abs(a.reduce((s: number, v: number) => s + v, 0) - 1) < .02
  if (!shares(cols, MAX_COLS) || !shares(rows, MAX_ROWS)) return false
  if (typeof fontSize !== 'number' || !Number.isFinite(fontSize) || fontSize < 1 || fontSize > 1000) return false
  return Array.isArray(cells) && cells.length === rows.length && cells.every(r => Array.isArray(r) && r.length === cols.length && r.every(c => typeof c === 'string' && c.length <= MAX_CELL))
}

/** The edges of the columns and rows, on the board (before any rotation). */
export function edgesOf(it: TableItem): { xs: number[]; ys: number[] } {
  const x0 = Math.min(it.p[0], it.p[2]), y0 = Math.min(it.p[1], it.p[3]), w = width(it), h = height(it)
  const run = (start: number, size: number, parts: number[]): number[] => {
    const out = [start]
    let at = start
    for (const part of parts) { at += part * size; out.push(at) }
    out[out.length - 1] = start + size
    return out
  }
  return { xs: run(x0, w, it.cols), ys: run(y0, h, it.rows) }
}

const local = (it: TableItem, wx: number, wy: number): [number, number] => {
  if (!it.angle) return [wx, wy]
  const cx = (it.p[0] + it.p[2]) / 2, cy = (it.p[1] + it.p[3]) / 2, c = Math.cos(-it.angle), s = Math.sin(-it.angle)
  return [cx + (wx - cx) * c - (wy - cy) * s, cy + (wx - cx) * s + (wy - cy) * c]
}

export function cellAt(it: TableItem, wx: number, wy: number): { r: number; c: number } | null {
  const [x, y] = local(it, wx, wy), { xs, ys } = edgesOf(it)
  const find = (v: number, edges: number[]): number => { for (let i = 0; i + 1 < edges.length; i++) if (v >= edges[i] && v <= edges[i + 1]) return i; return -1 }
  const c = find(x, xs), r = find(y, ys)
  return c < 0 || r < 0 ? null : { r, c }
}

export function cellRect(it: TableItem, r: number, c: number): Rect {
  const { xs, ys } = edgesOf(it)
  return [xs[c], ys[r], xs[c + 1], ys[r + 1]]
}

export interface Divider { axis: 'col' | 'row'; i: number }

/** The inner line nearest this place, within `reach`: dragging it changes just the two either side. */
export function dividerAt(it: TableItem, wx: number, wy: number, reach: number): Divider | null {
  const [x, y] = local(it, wx, wy), { xs, ys } = edgesOf(it)
  if (x < xs[0] - reach || x > xs[xs.length - 1] + reach || y < ys[0] - reach || y > ys[ys.length - 1] + reach) return null
  let best: Divider | null = null, near = reach
  for (let i = 1; i + 1 < xs.length; i++) { const d = Math.abs(x - xs[i]); if (d <= near) { near = d; best = { axis: 'col', i: i - 1 } } }
  for (let i = 1; i + 1 < ys.length; i++) { const d = Math.abs(y - ys[i]); if (d < near) { near = d; best = { axis: 'row', i: i - 1 } } }
  return best
}

export function moveDivider(it: TableItem, d: Divider, by: number): TableItem {
  const key = d.axis === 'col' ? 'cols' : 'rows', size = d.axis === 'col' ? width(it) : height(it), least = (d.axis === 'col' ? MIN_COL : MIN_ROW) / size
  const parts = [...it[key]], a = parts[d.i], b = parts[d.i + 1]
  const move = Math.max(Math.min(least, a) - a, Math.min(b - Math.min(least, b), by / size))
  parts[d.i] = a + move
  parts[d.i + 1] = b - move
  return { ...it, [key]: parts }
}

/** Rows grown to fit their text, the table growing with them. Rows never shrink by themselves. */
export function fitTable(it: TableItem, measure: (text: string, head: boolean) => number): TableItem {
  const w = width(it), h = height(it), pad = cellPad(it.fontSize), line = it.fontSize * LINE
  const sizes = it.rows.map(part => part * h)
  let grew = false
  it.cells.forEach((row, r) => {
    const head = !!it.head && r === 0
    const lines = Math.max(1, ...row.map((text, c) => text ? wrapText(text, Math.max(1, it.cols[c] * w - pad * 2), s => measure(s, head)).length : 1))
    const need = Math.max(MIN_ROW, lines * line + pad * 2)
    if (sizes[r] < need - .01) { sizes[r] = need; grew = true }
  })
  if (!grew) return it
  const total = sizes.reduce((a, b) => a + b, 0)
  return { ...it, rows: sizes.map(v => v / total), p: [it.p[0], it.p[1], it.p[2], Math.min(it.p[1], it.p[3]) + total] }
}

/** A new row or column: after place `at`, or at the end. A row adds to the height; a column shares the width. */
export function addRow(it: TableItem, at = it.rows.length - 1): TableItem {
  const h = height(it), sizes = it.rows.map(part => part * h), add = Math.min(sizes[at], h / it.rows.length * 1.2)
  sizes.splice(at + 1, 0, add)
  const cells = it.cells.map(row => [...row])
  cells.splice(at + 1, 0, it.cols.map(() => ''))
  return { ...it, rows: share(sizes), cells, p: [it.p[0], it.p[1], it.p[2], it.p[3] + add] }
}

export function addCol(it: TableItem, at = it.cols.length - 1): TableItem {
  const cols = [...it.cols]
  cols.splice(at + 1, 0, 1 / it.cols.length)
  return { ...it, cols: share(cols), cells: it.cells.map(row => { const next = [...row]; next.splice(at + 1, 0, ''); return next }) }
}

export function removeRow(it: TableItem, at = it.rows.length - 1): TableItem {
  if (it.rows.length < 2) return it
  const h = height(it), gone = it.rows[at] * h
  return { ...it, rows: share(it.rows.filter((_, i) => i !== at)), cells: it.cells.filter((_, i) => i !== at), p: [it.p[0], it.p[1], it.p[2], it.p[3] - gone] }
}

export function removeCol(it: TableItem, at = it.cols.length - 1): TableItem {
  if (it.cols.length < 2) return it
  return { ...it, cols: share(it.cols.filter((_, i) => i !== at)), cells: it.cells.map(row => row.filter((_, i) => i !== at)) }
}

export function setCell(it: TableItem, r: number, c: number, text: string): TableItem {
  if (it.cells[r]?.[c] === undefined || it.cells[r][c] === text) return it
  return { ...it, cells: it.cells.map((row, i) => i === r ? row.map((v, j) => j === c ? text.slice(0, MAX_CELL) : v) : row) }
}

/** Tab order: along the row, then the next row; going round at either end. */
export function nextCell(it: TableItem, r: number, c: number, back = false): { r: number; c: number } {
  const n = it.cols.length, total = n * it.rows.length, at = (r * n + c + (back ? -1 : 1) + total) % total
  return { r: Math.floor(at / n), c: at % n }
}

export function paintTable(ctx: CanvasRenderingContext2D, it: TableItem): void {
  const { xs, ys } = edgesOf(it), x0 = xs[0], x1 = xs[xs.length - 1], y0 = ys[0], y1 = ys[ys.length - 1]
  const pad = cellPad(it.fontSize), line = it.fontSize * LINE
  ctx.save()
  if (it.head) {
    ctx.save()
    ctx.globalAlpha *= .14
    ctx.fillStyle = it.c
    ctx.fillRect(x0, y0, x1 - x0, ys[1] - y0)
    ctx.restore()
  }
  ctx.fillStyle = it.textColor ?? it.c
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  it.cells.forEach((row, r) => {
    const head = !!it.head && r === 0
    ctx.font = tableFont(it, head)
    row.forEach((text, c) => {
      if (!text) return
      const lines = wrapText(text, Math.max(1, xs[c + 1] - xs[c] - pad * 2), s => ctx.measureText(s).width)
      const top = (ys[r] + ys[r + 1]) / 2 - (lines.length - 1) * line / 2
      lines.forEach((l, i) => ctx.fillText(l, xs[c] + pad, top + i * line))
    })
  })
  ctx.strokeStyle = it.c
  ctx.lineWidth = it.w
  ctx.lineCap = 'square'
  ctx.beginPath()
  for (const x of xs) { ctx.moveTo(x, y0); ctx.lineTo(x, y1) }
  for (const y of ys) { ctx.moveTo(x0, y); ctx.lineTo(x1, y) }
  ctx.stroke()
  ctx.restore()
}
