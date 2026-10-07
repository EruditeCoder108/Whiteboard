import {
  AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, Bold, Check,
  Copy, Ellipsis, Group, Italic, List, ListOrdered, LockKeyhole, Palette, Pencil,
  RotateCw, Scan, Trash2, Ungroup, UnlockKeyhole, X
} from 'lucide-preact'
import type { JSX } from 'preact'
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { board } from '@/engine/instance'
import { clamp, unionRect } from '@/engine/geometry'
import { itemBounds } from '@/engine/items'
import { fontOf, textAlign, textColor, textPadding, wrapText } from '@/engine/text'
import { MAX_TEXT_LENGTH } from '@/engine/serialize'
import type { EditableItem, Item } from '@/engine/types'
import { PALETTE, S } from '@/state/store'
import { Btn, MenuItem, Row, Slider, Swatch } from './kit'

const editable = (it: Item): it is EditableItem => it.t === 't' || (it.t === 'h' && it.k !== 'line' && it.k !== 'arrow')
const filled = (it: Item): it is EditableItem => (it.t === 't' && it.note) || (it.t === 'h' && it.k !== 'line' && it.k !== 'arrow')
function common<T>(items: Item[], get: (it: Item) => T): T | null {
  if (!items.length) return null
  const first = get(items[0])
  return items.every(it => get(it) === first) ? first : null
}

/** A real text field keeps IME, selection, clipboard and accessibility native. */
export function Editor(): JSX.Element | null {
  const editing = S.editing.value
  S.viewRevision.value
  const field = useRef<HTMLTextAreaElement>(null)
  const finished = useRef(false)
  const [draft, setDraft] = useState('')
  const id = editing?.item.id
  useLayoutEffect(() => {
    if (!editing || !field.current) return
    finished.current = false
    setDraft(editing.item.text ?? '')
    field.current.value = editing.item.text ?? ''
    field.current.focus({ preventScroll: true })
    if (!editing.isNew) field.current.select()
  }, [id])
  if (!editing) return null
  const it = editing.item, z = board.view.zoom
  const x = Math.min(it.p[0], it.p[2]), y = Math.min(it.p[1], it.p[3])
  const w = Math.abs(it.p[2] - it.p[0]), h = Math.abs(it.p[3] - it.p[1])
  const pad = textPadding(it), size = it.fontSize ?? 24
  const ctx = document.createElement('canvas').getContext('2d')!
  ctx.font = fontOf(it)
  const lines = wrapText(draft, Math.max(1, w - pad * 2), s => ctx.measureText(s).width, it.list)
  const topPadding = it.t === 'h' ? Math.max(pad, (h - lines.length * size * 1.3) / 2) : pad
  const commit = (): void => {
    if (finished.current) return
    finished.current = true
    board.commitText(field.current?.value ?? draft)
  }
  const cancel = (): void => {
    if (finished.current) return
    finished.current = true
    board.cancelText()
  }
  const height = Math.max(h, it.t === 't' ? lines.length * size * 1.3 + pad * 2 : h)
  return <div class="inline-editor ui nodrag" data-testid="inline-editor" style={{
    left: (x - board.view.x) * z, top: (y - board.view.y) * z,
    width: w * z, height: height * z, transform: `rotate(${it.angle ?? 0}rad)`
  }}>
    <textarea ref={field} class="text-editor nodrag" aria-label={it.t === 't' ? it.note ? 'Sticky note text' : 'Text content' : 'Shape label'}
      spellcheck maxLength={MAX_TEXT_LENGTH} value={draft} placeholder={it.t === 'h' ? 'Add a label' : it.note ? 'Your idea…' : 'Type something…'}
      style={{ padding: `${topPadding * z}px ${pad * z}px ${pad * z}px`, fontSize: size * z,
        fontWeight: it.bold ? 600 : 400, fontStyle: it.italic ? 'italic' : 'normal', textAlign: textAlign(it),
        color: textColor(it), lineHeight: '1.3' }}
      onInput={e => { const text = e.currentTarget.value; setDraft(text); board.updateTextDraft(text) }}
      onBlur={commit} onKeyDown={e => {
        e.stopPropagation()
        if (e.isComposing) return
        if (e.key === 'Escape') { e.preventDefault(); cancel() }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commit() }
      }} />
    <div class="editor-hint" onPointerDown={e => e.preventDefault()}>
      <span>Ctrl+Enter to finish · Esc to cancel</span>
      <Btn icon={Check} title="Finish editing" onClick={commit} />
      <Btn icon={X} title="Cancel editing" onClick={cancel} />
    </div>
  </div>
}

function ColourOptions({ label, value, onChange, clear }: { label: string; value: string | null; onChange: (c: string) => void; clear?: boolean }): JSX.Element {
  const color = value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#2f6bff'
  return <div class="style-colours">
    <div class="pop-sub">{label}{value === null && <span class="mixed-value">Mixed</span>}</div>
    <div class="swatches">
      {clear && <button class={`swatch no-fill nodrag ${value === 'none' ? 'sel' : ''}`} title="No fill" aria-label="No fill" onClick={() => onChange('none')} />}
      {(label === 'Fill' ? ['#fff2a8', '#ffd3dc', '#d3e6ff', '#d7f0dd', '#e7d9ff', '#ffffff'] : PALETTE).map(c => <Swatch key={c} color={c} title={`${label} ${c}`} selected={value?.toLowerCase() === c} onClick={() => onChange(c)} />)}
      <label class="swatch custom nodrag" title={`Custom ${label.toLowerCase()}`}><Palette size={14} />
        <input type="color" aria-label={`Custom ${label.toLowerCase()}`} value={color} onInput={e => onChange(e.currentTarget.value)} />
      </label>
    </div>
  </div>
}

function CommitSlider({ label, value, min, max, suffix = '', onCommit }: {
  label: string; value: number | null; min: number; max: number; suffix?: string; onCommit: (n: number) => void
}): JSX.Element {
  const [draft, setDraft] = useState(value ?? min)
  useEffect(() => setDraft(value ?? min), [value, min])
  return <Row label={label}><Slider label={label} min={min} max={max} value={draft} onChange={setDraft} onCommit={onCommit} />
    <span class="val">{value === null && draft === min ? 'Mixed' : Math.round(draft) + suffix}</span></Row>
}

function TextStyles({ items }: { items: EditableItem[] }): JSX.Element {
  const fontSize = common(items, it => (it as EditableItem).fontSize ?? 24)
  const [font, setFont] = useState(fontSize === null ? '' : String(Math.round(fontSize)))
  useEffect(() => setFont(fontSize === null ? '' : String(Math.round(fontSize))), [fontSize])
  const setSize = (): void => {
    const value = Number(font)
    if (font.trim() && Number.isFinite(value)) {
      const bounded = clamp(value, 6, 512)
      setFont(String(bounded))
      board.patchSelection({ fontSize: bounded }, 'text')
    }
    else setFont(fontSize === null ? '' : String(Math.round(fontSize)))
  }
  const bold = common(items, it => !!(it as EditableItem).bold), italic = common(items, it => !!(it as EditableItem).italic)
  const align = common(items, it => textAlign(it as EditableItem)), list = common(items, it => (it as EditableItem).list ?? 'none')
  return <>
    <div class="pop-sub">Text</div>
    <div class="style-text-row">
      <label class="font-size-label"><span class="sr-only">Font size</span><input class="style-number nodrag" type="number" aria-label="Font size" min={6} max={512}
        value={font} placeholder="Mixed" onInput={e => setFont(e.currentTarget.value)} onBlur={setSize}
        onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') { setSize(); e.currentTarget.blur() } }} /><span>px</span></label>
      <Btn icon={Bold} title="Bold" active={bold === true} onClick={() => board.patchSelection({ bold: bold !== true }, 'text')} />
      <Btn icon={Italic} title="Italic" active={italic === true} onClick={() => board.patchSelection({ italic: italic !== true }, 'text')} />
      <div class="style-divider" />
      <Btn icon={AlignLeft} title="Align text left" active={align === 'left'} onClick={() => board.patchSelection({ align: 'left' }, 'text')} />
      <Btn icon={AlignCenter} title="Align text center" active={align === 'center'} onClick={() => board.patchSelection({ align: 'center' }, 'text')} />
      <Btn icon={AlignRight} title="Align text right" active={align === 'right'} onClick={() => board.patchSelection({ align: 'right' }, 'text')} />
    </div>
    <div class="style-text-row">
      <span class="style-row-label">List</span>
      <button type="button" class={`style-choice ${list === 'none' ? 'active' : ''}`} onClick={() => board.patchSelection({ list: 'none' }, 'text')}>None</button>
      <Btn icon={List} title="Bulleted list" active={list === 'bullet'} onClick={() => board.patchSelection({ list: 'bullet' }, 'text')} />
      <Btn icon={ListOrdered} title="Numbered list" active={list === 'number'} onClick={() => board.patchSelection({ list: 'number' }, 'text')} />
    </div>
    <ColourOptions label="Text colour" value={common(items, it => textColor(it as EditableItem))}
      onChange={textColor => board.patchSelection({ textColor }, 'text')} />
  </>
}

function ObjectStyles({ items }: { items: Item[] }): JSX.Element {
  const unlocked = items.filter(it => !it.locked), text = unlocked.filter(editable), fill = unlocked.filter(filled)
  const bordered = unlocked.filter(it => it.t !== 't'), shapes = unlocked.filter(it => it.t === 'h')
  const rounded = shapes.filter(it => it.t === 'h' && it.k === 'rect')
  return <div class="object-style-content">
    {unlocked.length < items.length && <div class="pop-hint">Locked objects keep their style. Unlock them to edit.</div>}
    {text.length > 0 && <TextStyles items={text} />}
    {fill.length > 0 && <ColourOptions label="Fill" clear value={common(fill, it => (it as EditableItem).fill ?? 'none')} onChange={fill => board.patchSelection({ fill }, 'fill')} />}
    {bordered.length > 0 && <>
      <ColourOptions label={shapes.length ? 'Border colour' : 'Stroke colour'} value={common(bordered, it => it.c)} onChange={c => board.patchSelection({ c }, 'stroke')} />
      <CommitSlider label="Thickness" min={1} max={60} value={common(bordered, it => it.w)} onCommit={w => board.patchSelection({ w }, 'stroke')} />
    </>}
    {shapes.length > 0 && <div class="style-text-row"><span class="style-row-label">Border</span>
      {(['solid', 'dashed', 'dotted'] as const).map(dash => <button type="button" key={dash} aria-label={`${dash} border`}
        class={`style-choice ${common(shapes, it => it.t === 'h' ? it.dash ?? 'solid' : '') === dash ? 'active' : ''}`}
        onClick={() => board.patchSelection({ dash }, 'shape')}>{dash[0].toUpperCase() + dash.slice(1)}</button>)}
    </div>}
    {rounded.length > 0 && <CommitSlider label="Corners" min={0} max={80} value={common(rounded, it => it.t === 'h' ? it.radius ?? 0 : 0)} onCommit={radius => board.patchSelection({ radius }, 'rect')} />}
    {unlocked.length > 0 && <CommitSlider label="Opacity" min={0} max={100} suffix="%" value={common(unlocked, it => (it.opacity ?? 1) * 100)} onCommit={opacity => board.patchSelection({ opacity: opacity / 100 })} />}
    <div class="pop-hint">Changes apply to compatible selected objects. Ctrl+Z to undo.</div>
  </div>
}

/** Actions follow the selection, while the longer controls stay one click away. */
export function SelectionToolbar(): JSX.Element | null {
  const items = S.selection.value
  S.viewRevision.value
  const [panel, setPanel] = useState<'style' | 'more' | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const key = items.map(it => it.id).join(',')
  useEffect(() => setPanel(null), [key])
  useEffect(() => {
    const close = (e: PointerEvent): void => { if (!ref.current?.contains(e.target as Node)) setPanel(null) }
    const escape = (e: KeyboardEvent): void => { if (e.key === 'Escape') setPanel(null) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape) }
  }, [])
  if (!items.length || S.editing.value || S.gestureActive.value) return null
  const box = items.reduce((r, it) => unionRect(r, itemBounds(it)), null as ReturnType<typeof itemBounds> | null)!
  const z = board.view.zoom, { w: vw, h: vh } = board.size
  const dockEdge = vh <= 540 ? 88 : 56
  const width = Math.min(328, vw - dockEdge - 12), cx = ((box[0] + box[2]) / 2 - board.view.x) * z
  const above = (box[1] - board.view.y) * z - 86
  const below = (box[3] - board.view.y) * z + 20
  const top = clamp(above >= 38 ? above : below + 46 < vh - 50 ? below : 38, 38, Math.max(38, vh - 98))
  const toolbarTop = panel ? Math.min(top, Math.max(38, vh - 330)) : top
  const left = clamp(cx - width / 2, dockEdge, Math.max(dockEdge, vw - width - 12))
  const locked = items.some(it => it.locked), allLocked = items.every(it => it.locked)
  const single = items.length === 1 && editable(items[0]) ? items[0] : null
  const grouped = items.some(it => it.group)
  const run = (fn: () => void): void => { setPanel(null); fn() }
  return <div class="selection-tools ui nodrag" ref={ref} data-testid="selection-toolbar" data-popover-keep="" style={{ left, top: toolbarTop, width }}>
    <div class="selection-actions panel" role="toolbar" aria-label="Selection actions">
      <span class="selection-caption" title={locked ? 'Selection includes locked objects' : `${items.length} selected`}>{allLocked ? <LockKeyhole size={13} /> : items.length === 1 ? items[0].t === 's' ? 'Stroke' : items[0].t === 't' ? items[0].note ? 'Note' : 'Text' : 'Shape' : `${items.length} selected`}</span>
      <div class="grow" />
      <Btn icon={Palette} title="Object style" active={panel === 'style'} disabled={allLocked} onClick={() => setPanel(panel === 'style' ? null : 'style')} />
      {single && <Btn icon={Pencil} title={single.text ? 'Edit text  (Enter)' : 'Add text  (Enter)'} disabled={locked} onClick={() => board.editText(single)} />}
      {items.length > 1 && <Btn icon={grouped ? Ungroup : Group} title={grouped ? 'Ungroup  (Ctrl+Shift+G)' : 'Group  (Ctrl+G)'} disabled={locked} onClick={() => grouped ? board.ungroupSelection() : board.groupSelection()} />}
      <Btn icon={Copy} title="Duplicate selection  (Ctrl+D)" onClick={() => board.duplicateSelection()} />
      <Btn icon={locked ? UnlockKeyhole : LockKeyhole} title={locked ? 'Unlock selection' : 'Lock selection'} onClick={() => board.toggleLockSelection()} />
      <Btn icon={Trash2} title="Delete selection  (Delete)" disabled={allLocked} danger onClick={() => board.deleteSelection()} />
      <Btn icon={Ellipsis} title="More selection actions" active={panel === 'more'} onClick={() => setPanel(panel === 'more' ? null : 'more')} />
    </div>
    {panel && <div class={`selection-detail panel ${panel}`} style={{ maxHeight: Math.max(80, vh - toolbarTop - 102) }}>
      {panel === 'style' ? <ObjectStyles items={items} /> : <>
        <MenuItem icon={ArrowUpToLine} label="Bring to front" onClick={() => run(() => board.arrangeSelection('front'))} />
        <MenuItem icon={ArrowDownToLine} label="Send to back" onClick={() => run(() => board.arrangeSelection('back'))} />
        {!locked && <MenuItem icon={RotateCw} label="Rotate 90°" onClick={() => run(() => board.rotateSelection(Math.PI / 2))} />}
        <MenuItem icon={Scan} label="Fit selection in view" onClick={() => run(() => board.fitSelection())} />
        <MenuItem icon={UnlockKeyhole} label="Unlock all objects" onClick={() => run(() => board.unlockAll())} />
      </>}
    </div>}
  </div>
}
