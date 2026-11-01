import { signal } from '@preact/signals'
import { Minus, Plus } from 'lucide-preact'
import type { JSX } from 'preact'
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { board } from '@/engine/instance'
import { MAX_CELL, MAX_COLS, MAX_ROWS, cellPad, cellRect, nextCell, tableFont } from '@/engine/table'
import type { TableItem } from '@/engine/types'
import { S } from '@/state/store'
import { Switch } from './kit'

function Count({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }): JSX.Element {
  return (
    <div class="table-count">
      <span>{label}</span>
      <button type="button" class="scale-bump nodrag" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= 1} onClick={() => onChange(value - 1)}><Minus size={22} /></button>
      <b aria-live="polite">{value}</b>
      <button type="button" class="scale-bump nodrag" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}><Plus size={22} /></button>
    </div>
  )
}

/** How big a table to start with; rows and columns can still change later. */
export function TableChooser(): JSX.Element {
  const [rows, setRows] = useState(3)
  const [cols, setCols] = useState(3)
  const [head, setHead] = useState(true)
  const close = (): void => { S.popover.value = null }
  const insert = (): void => { close(); board.insertTable(rows, cols, head) }
  return (
    <div class="chooser new-lesson ui" role="dialog" aria-modal="true" aria-labelledby="table-title" data-popover-keep="" onKeyDown={e => { if (e.key === 'Escape') close() }}>
      <div class="chooser-card panel new-lesson-card table-card">
        <h1 id="table-title">Table</h1>
        <div class="table-preview" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} aria-hidden="true">
          {Array.from({ length: rows * cols }, (_, i) => <i key={i} class={head && i < cols ? 'head' : ''} />)}
        </div>
        <Count label="Rows" value={rows} max={MAX_ROWS} onChange={setRows} />
        <Count label="Columns" value={cols} max={MAX_COLS} onChange={setCols} />
        <label class="table-head-choice"><Switch on={head} onChange={setHead} /><span>Heading row</span></label>
        <div class="dialog-choices">
          <button type="button" class="dialog-btn primary nodrag" onClick={insert}>Put on the board</button>
          <button type="button" class="dialog-btn nodrag" onClick={close}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

/** The cell being typed in. */
export const editingCell = signal<{ id: string; r: number; c: number } | null>(null)

/**
 * Typing in a cell: a real text field over it, so IME and Hindi typing work. Enter is a new line in the
 * cell; Tab and Shift+Tab move to the next and previous cell; Esc or a tap elsewhere finishes.
 * Each finished cell is one Undo step.
 */
export function TableCellEditor(): JSX.Element | null {
  const at = editingCell.value
  S.viewRevision.value; S.contentRevision.value
  const field = useRef<HTMLTextAreaElement>(null)
  const it = at ? board.doc.items.find((x): x is TableItem => x.id === at.id && x.t === 'b') : undefined
  const save = (): void => { if (at && field.current) board.setTableCell(at.id, at.r, at.c, field.current.value) }
  const finish = (): void => { save(); editingCell.value = null }
  const key = at ? `${at.id}:${at.r}:${at.c}` : ''
  useLayoutEffect(() => {
    if (!field.current || !at || !it) return
    field.current.value = it.cells[at.r]?.[at.c] ?? ''
    field.current.focus({ preventScroll: true })
    field.current.select()
  }, [key])
  useEffect(() => {
    if (!key) return
    // A tap elsewhere finishes the cell; the board's own pointer handling does not take the focus away.
    const away = (e: PointerEvent): void => { if (e.target !== field.current) finish() }
    document.addEventListener('pointerdown', away, true)
    return () => document.removeEventListener('pointerdown', away, true)
  }, [key])
  useEffect(() => { if (at && !it) editingCell.value = null }, [at, it])
  if (!at || !it || !it.cells[at.r]) return null
  const [x0, y0, x1, y1] = cellRect(it, at.r, at.c), v = board.view, z = v.zoom
  const size = it.fontSize * z, pad = cellPad(it.fontSize) * z, head = !!it.head && at.r === 0
  // The field stands exactly on its cell, turned about the table's own centre.
  const cx = ((it.p[0] + it.p[2]) / 2 - x0) * z, cy = ((it.p[1] + it.p[3]) / 2 - y0) * z
  return (
    <div class="table-cell-editor ui nodrag" style={{
      left: `${(x0 - v.x) * z}px`, top: `${(y0 - v.y) * z}px`, width: `${(x1 - x0) * z}px`, minHeight: `${(y1 - y0) * z}px`,
      transform: it.angle ? `rotate(${it.angle}rad)` : undefined, transformOrigin: `${cx}px ${cy}px`, background: S.bgColor.value
    }}>
      <textarea ref={field} class="nodrag" aria-label={`Row ${at.r + 1}, column ${at.c + 1}`} maxLength={MAX_CELL} spellcheck
        style={{ font: tableFont({ fontSize: size }, head), lineHeight: 1.3, padding: `${pad}px`, color: it.textColor ?? it.c, minHeight: `${(y1 - y0) * z}px` }}
        onKeyDown={e => {
          e.stopPropagation()
          if (e.key === 'Escape') { e.preventDefault(); finish() }
          else if (e.key === 'Tab') {
            e.preventDefault()
            save()
            const live = board.doc.items.find((x): x is TableItem => x.id === at.id && x.t === 'b')
            if (live) editingCell.value = { id: at.id, ...nextCell(live, at.r, at.c, e.shiftKey) }
          }
        }} />
    </div>
  )
}
