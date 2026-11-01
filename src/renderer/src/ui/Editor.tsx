import {
  AArrowDown, AArrowUp, AlignCenter, AlignLeft, AlignRight, Archive, ArrowDownToLine, ArrowUpToLine, Bold, Check,
  Columns3, Copy, Crop, Ellipsis, ExternalLink, EyeOff, FlipHorizontal2, FlipVertical2, GitBranchPlus, Group, Heading, Link2, Minus, Play, ScanText, Sigma, SlidersHorizontal, Rows3, Italic, List, ListOrdered, LockKeyhole, Palette, Pencil,
  RotateCw, Scan, Trash2, Ungroup, UnlockKeyhole, X
} from 'lucide-preact'
import type { JSX } from 'preact'
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { board } from '@/engine/instance'
import { clamp, unionRect } from '@/engine/geometry'
import { isConnector } from '@/engine/connectors'
import { itemBounds } from '@/engine/items'
import { fontOf, textAlign, textColor, textPadding, wrapText } from '@/engine/text'
import { MAX_TEXT_LENGTH } from '@/engine/serialize'
import type { EditableItem, Item } from '@/engine/types'
import { isBox } from '@/engine/types'
import { safeLink } from '@/engine/objects'
import { openCrop } from './Crop'
import { playing } from './Clips'
import { readHandwriting } from './Recognize'
import { PartOptions } from './Apparatus'
import { partOf } from '@/engine/apparatus/parts'
import { PALETTE, S, boardMode, showToast } from '@/state/store'
import { shelf } from '@/state/shelf'
import { RevealOptions } from './Reveal'
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
  const bordered = unlocked.filter(it => !isBox(it) || it.t === 'n' || it.t === 'b'), shapes = unlocked.filter(it => it.t === 'h')
  const rounded = shapes.filter(it => it.t === 'h' && it.k === 'rect')
  const connectors = unlocked.filter(isConnector)
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
    {connectors.length > 0 && <div class="style-text-row"><span class="style-row-label">Path</span>
      {([['Straight', false], ['Elbow', true]] as const).map(([label, elbow]) => <button type="button" key={label} aria-label={`${label} path`}
        class={`style-choice ${common(connectors, it => it.t === 'h' && !!it.elbow) === elbow ? 'active' : ''}`}
        onClick={() => board.setElbow(elbow)}>{label}</button>)}
    </div>}
    {rounded.length > 0 && <CommitSlider label="Corners" min={0} max={80} value={common(rounded, it => it.t === 'h' ? it.radius ?? 0 : 0)} onCommit={radius => board.patchSelection({ radius }, 'rect')} />}
    {unlocked.length > 0 && <CommitSlider label="Opacity" min={0} max={100} suffix="%" value={common(unlocked, it => (it.opacity ?? 1) * 100)} onCommit={opacity => board.patchSelection({ opacity: opacity / 100 })} />}
    <div class="pop-hint">Changes apply to compatible selected objects. Ctrl+Z to undo.</div>
  </div>
}

type ActProps = Parameters<typeof Btn>[0] & { label: string }

/** On the board a selected object's actions are big and named, right beside it; on a laptop they stay compact. */
function Act({ label, icon: Icon, ...rest }: ActProps): JSX.Element {
  if (!boardMode.value) return <Btn icon={Icon} {...rest} />
  const { title, active, danger, disabled, onClick } = rest
  return (
    <button type="button" class={`sel-act nodrag ${active ? 'active' : ''} ${danger ? 'danger' : ''}`} title={title} aria-label={title} aria-pressed={active === undefined ? undefined : active} disabled={disabled} onClick={onClick as never}>
      <Icon size={22} strokeWidth={1.9} /><span>{label}</span>
    </button>
  )
}

function LinkOptions({ link, onDone }: { link?: string; onDone: () => void }): JSX.Element {
  const [text, setText] = useState(link ?? '')
  const [wrong, setWrong] = useState(false)
  const save = (): void => {
    const url = safeLink(text)
    if (!url) return setWrong(true)
    board.setLink(url)
    onDone()
  }
  return <div class="link-options">
    <div class="pop-sub">Web address</div>
    <input class="link-field nodrag" type="url" aria-label="Web address" placeholder="ncert.nic.in" value={text} maxLength={2000} ref={el => el?.focus()}
      onInput={e => { setText(e.currentTarget.value); setWrong(false) }}
      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') save() }} />
    {wrong && <div class="pop-hint link-wrong">That is not a web address.</div>}
    <div class="style-text-row">
      <button type="button" class="style-choice active" onClick={save}>Save link</button>
      {link && <button type="button" class="style-choice" onClick={() => { board.setLink(null); onDone() }}>Remove</button>}
    </div>
  </div>
}

/** Actions follow the selection, while the longer controls stay one click away. */
export function SelectionToolbar(): JSX.Element | null {
  const items = S.selection.value
  S.viewRevision.value
  const [panel, setPanel] = useState<'style' | 'more' | 'reveal' | 'link' | 'part' | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const [barHeight, setBarHeight] = useState(70)
  useLayoutEffect(() => {
    const h = ref.current?.querySelector('.selection-actions')?.getBoundingClientRect().height
    if (h && Math.abs(h - barHeight) > 1) setBarHeight(h)
  })
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
  const big = boardMode.value
  const width = Math.min(big ? 900 : 360, vw - (big ? 24 : dockEdge + 12)), cx = ((box[0] + box[2]) / 2 - board.view.x) * z
  const above = (box[1] - board.view.y) * z - (big ? barHeight + 26 : 86)
  const below = (box[3] - board.view.y) * z + 26
  // On the board the bar must stay clear of the toolbar along the bottom, or its buttons cannot be reached.
  const reserve = big ? barHeight + 112 : 50
  const top = clamp(above >= 38 ? above : below + (big ? 0 : 46) < vh - reserve ? below : 38, 38, Math.max(38, vh - (big ? reserve : 98)))
  const toolbarTop = panel ? Math.min(top, Math.max(38, vh - (big ? 420 : 330))) : top
  const left = clamp(cx - width / 2, big ? 12 : dockEdge, Math.max(big ? 12 : dockEdge, vw - width - 12))
  const locked = items.some(it => it.locked), allLocked = items.every(it => it.locked)
  const single = items.length === 1 && editable(items[0]) ? items[0] : null
  const grouped = items.some(it => it.group)
  const only = items.length === 1 ? items[0] : null
  const media = only && (only.t === 'n' || only.t === 'g' || (only.t === 'i' && only.latex !== undefined)) ? only : null
  const run = (fn: () => void): void => { setPanel(null); fn() }
  const shape = only?.t === 'h' && !isConnector(only) ? only : null
  const textSize = single && !locked ? (single.fontSize ?? 24) : 0
  const openLink = (url: string): void => { void window.api.openLink(url).then(ok => { if (!ok) showToast('That link could not be opened') }) }
  return <div class={`selection-tools ui nodrag ${big ? 'big' : ''}`} ref={ref} data-testid="selection-toolbar" data-popover-keep="" style={{ left, top: toolbarTop, width }}>
    <div class="selection-actions panel" role="toolbar" aria-label="Selection actions">
      <span class="selection-caption" title={locked ? 'Selection includes locked objects' : `${items.length} selected`}>{allLocked ? <LockKeyhole size={13} /> : items.length === 1 ? items[0].t === 'l' ? 'Lab' : items[0].t === 's' ? 'Stroke' : items[0].t === 't' ? items[0].note ? 'Note' : 'Text' : items[0].t === 'i' ? items[0].latex !== undefined ? 'Equation' : 'Picture' : items[0].t === 'g' ? 'Graph' : items[0].t === 'a' ? partOf(items[0].kind)?.name ?? 'Apparatus' : items[0].t === 'm' ? items[0].kind === 'audio' ? 'Audio' : 'Video' : items[0].t === 'b' ? 'Table' : items[0].t === 'n' ? items[0].y ? 'Axes' : 'Number line' : isConnector(items[0]) ? items[0].k === 'arrow' ? 'Arrow' : 'Line' : 'Shape' : `${items.length} selected`}</span>
      <div class="grow" />
      {only?.link && <Act icon={ExternalLink} label="Open link" title={`Open ${only.link}`} onClick={() => openLink(only.link!)} />}
      <Act icon={Palette} label="Style" title="Object style" active={panel === 'style'} disabled={allLocked} onClick={() => setPanel(panel === 'style' ? null : 'style')} />
      {single && <Act icon={Pencil} label={single.text ? 'Edit' : 'Type'} title={single.text ? 'Edit text  (Enter)' : 'Add text  (Enter)'} disabled={locked} onClick={() => board.editText(single)} />}
      {big && textSize > 0 && <>
        <Act icon={AArrowUp} label="Bigger" title="Bigger text" onClick={() => board.patchSelection({ fontSize: Math.min(512, Math.round(textSize * 1.2)) }, 'text')} />
        <Act icon={AArrowDown} label="Smaller" title="Smaller text" onClick={() => board.patchSelection({ fontSize: Math.max(6, Math.round(textSize / 1.2)) }, 'text')} />
        <Act icon={Bold} label="Bold" title="Bold text" active={!!single?.bold} onClick={() => board.patchSelection({ bold: !single?.bold }, 'text')} />
      </>}
      {items.every(it => it.t === 's' && !it.m) && !locked && <>
        <Act icon={ScanText} label="To text" title="Handwriting to text" onClick={() => readHandwriting('text')} />
        <Act icon={Sigma} label="To maths" title="Handwriting to equation" onClick={() => readHandwriting('maths')} />
      </>}
      {only?.t === 'a' && partOf(only.kind)?.settings && <Act icon={SlidersHorizontal} label="Set" title="Change its settings" active={panel === 'part'} onClick={() => setPanel(panel === 'part' ? null : 'part')} />}
      {only?.t === 'm' && <Act icon={Play} label="Play" title="Play the clip" onClick={() => { playing.value = only }} />}
      {only?.t === 'i' && only.latex === undefined && <Act icon={Crop} label="Crop" title="Crop the picture" disabled={locked} onClick={() => openCrop(only)} />}
      {shape && <Act icon={GitBranchPlus} label="Branch" title="Add a branch" disabled={locked} onClick={() => board.addBranch(shape)} />}
      {only?.t === 'b' && <Act icon={Pencil} label="Type" title="Type in the table" disabled={locked} onClick={() => board.openCell(only, board.lastCell?.id === only.id ? board.lastCell.r : 0, board.lastCell?.id === only.id ? board.lastCell.c : 0)} />}
      {media && <Act icon={Pencil} label="Edit" title={media.t === 'n' ? 'Change the scale' : media.t === 'g' ? 'Edit graph' : 'Edit equation'} disabled={locked} onClick={() => board.onEditMedia?.(media)} />}
      {items.length > 1 && <Btn icon={grouped ? Ungroup : Group} title={grouped ? 'Ungroup  (Ctrl+Shift+G)' : 'Group  (Ctrl+G)'} disabled={locked} onClick={() => grouped ? board.ungroupSelection() : board.groupSelection()} />}
      <Act icon={Copy} label="Copy" title="Duplicate selection  (Ctrl+D)" onClick={() => board.duplicateSelection()} />
      {big && <>
        <Act icon={FlipVertical2} label="Mirror" title="Mirror left to right" disabled={locked} onClick={() => board.flipSelection('h')} />
        <Act icon={FlipHorizontal2} label="Flip" title="Flip upside down" disabled={locked} onClick={() => board.flipSelection('v')} />
      </>}
      <Act icon={Archive} label="Shelf" title="Save to My shelf" onClick={() => shelf.startSelection()} />
      <Act icon={EyeOff} label="Hide" title="Hide for class" active={panel === 'reveal'} disabled={allLocked} onClick={() => setPanel(panel === 'reveal' ? null : 'reveal')} />
      <Act icon={locked ? UnlockKeyhole : LockKeyhole} label={locked ? 'Unlock' : 'Lock'} title={locked ? 'Unlock selection' : 'Lock selection'} onClick={() => board.toggleLockSelection()} />
      <Act icon={Trash2} label="Delete" title="Delete selection  (Delete)" disabled={allLocked} danger onClick={() => board.deleteSelection()} />
      <Act icon={Ellipsis} label="More" title="More selection actions" active={panel === 'more'} onClick={() => setPanel(panel === 'more' ? null : 'more')} />
    </div>
    {panel && <div class={`selection-detail panel ${panel}`} style={{ maxHeight: Math.max(80, vh - toolbarTop - 102) }}>
      {panel === 'style' ? <ObjectStyles items={items} /> : panel === 'reveal' ? <RevealOptions items={items} /> : panel === 'link' ? <LinkOptions link={only?.link} onDone={() => setPanel(null)} /> : panel === 'part' && only?.t === 'a' ? <PartOptions it={only} /> : <>
        {only?.t === 'b' && !locked && <>
          <MenuItem icon={Rows3} label="Add row" onClick={() => board.shapeTable('add-row')} />
          <MenuItem icon={Columns3} label="Add column" onClick={() => board.shapeTable('add-col')} />
          {only.rows.length > 1 && <MenuItem icon={Minus} label="Remove row" onClick={() => board.shapeTable('remove-row')} />}
          {only.cols.length > 1 && <MenuItem icon={Minus} label="Remove column" onClick={() => board.shapeTable('remove-col')} />}
          <MenuItem icon={Heading} label="Heading row" hint={only.head ? 'on' : 'off'} onClick={() => board.shapeTable('head')} />
        </>}
        <MenuItem icon={EyeOff} label="Hide for class" onClick={() => setPanel('reveal')} />
        <MenuItem icon={Archive} label="Save to My shelf" onClick={() => run(() => shelf.startSelection())} />
        {only && !locked && <MenuItem icon={Link2} label={only.link ? 'Change link' : 'Add a link'} onClick={() => setPanel('link')} />}
        {!locked && <MenuItem icon={FlipVertical2} label="Mirror left to right" onClick={() => run(() => board.flipSelection('h'))} />}
        {!locked && <MenuItem icon={FlipHorizontal2} label="Flip upside down" onClick={() => run(() => board.flipSelection('v'))} />}
        <MenuItem icon={ArrowUpToLine} label="Bring to front" onClick={() => run(() => board.arrangeSelection('front'))} />
        <MenuItem icon={ArrowDownToLine} label="Send to back" onClick={() => run(() => board.arrangeSelection('back'))} />
        {!locked && <MenuItem icon={RotateCw} label="Rotate 90°" onClick={() => run(() => board.rotateSelection(Math.PI / 2))} />}
        <MenuItem icon={Scan} label="Fit selection in view" onClick={() => run(() => board.fitSelection())} />
        <MenuItem icon={UnlockKeyhole} label="Unlock all objects" onClick={() => run(() => board.unlockAll())} />
      </>}
    </div>}
  </div>
}
