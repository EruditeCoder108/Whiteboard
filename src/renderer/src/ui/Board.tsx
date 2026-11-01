import {
  Film, Clock, Columns2, Dices, Search, Trophy, UserRoundCheck, Vote, LayoutTemplate, Network, Archive, Atom, Axis3d, Blinds, Calculator, EyeOff, Table2, Bookmark, X, ChevronLeft, ChevronRight, Clapperboard, Copy, Crosshair, Eraser, Eye, FileText, FlaskConical, GripVertical, FilePlus2, Library, Pencil, SaveAll, Share2,
  Highlighter, MoveHorizontal, Image as ImageIcon, Laptop, LayoutGrid, LineChart, LogOut, Minus, MousePointer2, MousePointerClick, Pen, Plus,
  Presentation, GraduationCap, Redo2, ArrowDownToLine, ArrowUpToLine, Infinity as InfinityIcon, BookOpen, Frame, Focus, Ruler, Shapes, SlidersHorizontal, Sigma, Sparkles, Spotlight, Timer, Trash2, Type, Undo2, MonitorUp, Layers
} from 'lucide-preact'
import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { signal } from '@preact/signals'
import { board } from '@/engine/instance'
import { MAX_EXTENT, PAGE_H, PAGE_W, scrollOf } from '@/engine/pages'
import { instrumentsShown } from '@/engine/instruments'
import { OVERLAY_ALPHA, actions } from '@/state/actions'
import { S, activeTool, currentColor, currentSize, isDarkBg, isShapeTool, styleKey } from '@/state/store'
import type { BarSide, ToolName } from '@/state/store'
import { editEquation, editGraph, editScale, insertFiles, pickFiles } from '@/state/insert'
import { fileState, lessonDirty, lessonName, lessonPath, lessonSubject, lesson } from '@/state/lesson'
import { ExportSheet } from './Lessons'
import { capture } from '@/state/capture'
import { Section, Tile } from './kit'
import { calculatorOn } from './Tools'
import { ShapesPopover, PropsPopover } from './Popovers'
import { MathsPopover, curtainOn, spotlightOn, timerOn } from './Present'
import { PaperPopover } from './Paper'
import { SubjectsPopover } from './Subjects'
import { PEN_ICON, penLabel } from './PenStyles'
import { clockOn, diceOn, magnifierOn, pickerOn, scoreOn } from './ClassTools'

type Icon = typeof Pen

/** High-contrast ink for the back row: dark inks on light boards, chalk colours on dark boards. */
const LIGHT_INK = ['#111827', '#2f6bff', '#e5484d', '#2fa66a', '#f28c28', '#8a4fff']
const DARK_INK = ['#ffffff', '#f5c518', '#6cb6ff', '#ff7ab6', '#5ad07a', '#ffa24a']
/** Three one-tap sizes per tool (world px). */
const SIZES = { pen: [3, 6, 12], marker: [16, 28, 44], eraser: [16, 40, 80] } as const

const toggle = (name: NonNullable<typeof S.popover.value>): void => { S.popover.value = S.popover.value === name ? null : name }

/** A board button: big touch target, icon with its name underneath (there is no hover on a touch panel). */
function BBtn({ icon: I, label, active, disabled, onClick, keep, danger }: {
  icon: Icon; label: string; active?: boolean; disabled?: boolean; onClick: () => void; keep?: boolean; danger?: boolean
}): JSX.Element {
  return (
    <button type="button" class={`bbtn nodrag ${active ? 'active' : ''} ${danger ? 'danger' : ''}`} aria-label={label} aria-pressed={active}
      disabled={disabled} data-popover-keep={keep ? '' : undefined} onClick={onClick}>
      <I size={22} strokeWidth={1.9} />
      <span>{label}</span>
    </button>
  )
}

function ToolBtn({ tool, icon, label }: { tool: ToolName; icon: Icon; label: string }): JSX.Element {
  // Tapping the pen or eraser already in hand opens its choices, right where the hand is.
  const choices = tool === 'pen' || tool === 'eraser' || tool === 'marker'
  return <BBtn icon={icon} label={label} keep={choices} active={activeTool.value === tool} onClick={() => {
    if (choices && S.tool.value === tool) return toggle('props')
    S.popover.value = null
    actions.setTool(tool)
  }} />
}

/** The board toolbar: tools, ink colours and sizes, undo, pages and the main menu, all one tap away. */
export function BoardBar(): JSX.Element {
  const side = S.barSide.value
  const t = activeTool.value
  const key = styleKey.value
  const inks = isDarkBg.value ? DARK_INK : LIGHT_INK
  const showInk = !['eraser', 'laser', 'hand'].includes(t)
  const drag = useRef(false)
  const p = S.popover.value
  const onGrip = (e: PointerEvent): void => {
    drag.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onGripMove = (e: PointerEvent): void => {
    if (!drag.current) return
    const f = e.clientX / window.innerWidth
    const next: BarSide = f < 0.36 ? 'left' : f > 0.64 ? 'right' : 'center'
    if (next !== S.barSide.value) S.barSide.value = next
  }
  return (
    <div class={`boardbar-wrap side-${side}`}>
      {p === 'board-menu' && <BoardMenu />}
      {p === 'pages' && <PageSorter />}
      {p === 'shapes' && <ShapesPopover />}
      {p === 'maths' && <MathsPopover />}
      {p === 'props' && <PropsPopover />}
      {p === 'paper' && <PaperPopover />}
      {p === 'subjects' && <SubjectsPopover />}
      {p === 'export' && <ExportSheet />}
      <div class="boardbar panel ui" role="toolbar" aria-label="Board tools">
        <button type="button" class="bb-grip nodrag" aria-label="Move the toolbar left or right" title="Drag to move the toolbar"
          onPointerDown={onGrip as never} onPointerMove={onGripMove as never} onPointerUp={() => (drag.current = false)} onPointerCancel={() => (drag.current = false)}>
          <GripVertical size={18} />
        </button>
        <ToolBtn tool="select" icon={MousePointer2} label="Select" />
        <ToolBtn tool="pen" icon={PEN_ICON[S.penStyle.value]} label={penLabel(S.penStyle.value)} />
        <ToolBtn tool="marker" icon={Highlighter} label="Highlight" />
        <ToolBtn tool="eraser" icon={Eraser} label="Eraser" />
        <BBtn icon={Shapes} label="Shapes" keep active={isShapeTool(t) || p === 'shapes'} onClick={() => {
          if (!isShapeTool(t)) board.setTool(S.lastShape.value)
          toggle('shapes')
        }} />
        <ToolBtn tool="text" icon={Type} label="Text" />
        <ToolBtn tool="laser" icon={Crosshair} label="Laser" />
        <BBtn icon={GraduationCap} label="Subjects" keep active={p === 'subjects'} onClick={() => toggle('subjects')} />
        <div class="bb-sep" />
        <div class={`bb-inks ${showInk ? '' : 'muted'}`}>
          {inks.map(c => (
            <button type="button" key={c} class={`bb-ink nodrag ${showInk && currentColor.value.toLowerCase() === c ? 'sel' : ''}`} style={{ '--c': c } as never}
              aria-label={`Ink ${c}`} aria-pressed={currentColor.value.toLowerCase() === c} onClick={() => actions.setColor(c)} />
          ))}
          <button type="button" class="bb-ink more nodrag" aria-label="More colours and sizes" data-popover-keep="" onClick={() => {
            if (['select', 'lasso', 'hand', 'laser'].includes(S.tool.value) && !S.selectionCount.value) board.setTool('pen')
            toggle('props')
          }}><Plus size={16} /></button>
        </div>
        <div class="bb-sizes">
          {SIZES[key].map((w, i) => (
            <button type="button" key={w} class={`bb-size nodrag ${currentSize.value === w ? 'sel' : ''}`} aria-label={['Thin', 'Medium', 'Thick'][i]} aria-pressed={currentSize.value === w}
              onClick={() => { if (['select', 'lasso', 'hand', 'laser'].includes(S.tool.value)) board.setTool('pen'); actions.setSize(SIZES[styleKey.value][i]) }}>
              <i style={{ width: `${6 + i * 5}px`, height: `${6 + i * 5}px`, background: key === 'eraser' ? 'transparent' : currentColor.value }} class={key === 'eraser' ? 'ring' : ''} />
            </button>
          ))}
        </div>
        <div class="bb-sep" />
        <BBtn icon={Undo2} label="Undo" disabled={!S.canUndo.value} onClick={() => board.undo()} />
        <BBtn icon={Redo2} label="Redo" disabled={!S.canRedo.value} onClick={() => board.redo()} />
        <div class="bb-sep" />
        {S.kind.value === 'notebook' ? <>
          <BBtn icon={ChevronLeft} label="Back" disabled={S.page.value === 0} onClick={() => board.turnPage(-1)} />
          <button type="button" class={`bb-page nodrag ${p === 'pages' ? 'active' : ''}`} data-popover-keep="" aria-label="All pages" onClick={() => toggle('pages')}>
            <b>{S.page.value + 1}<small> / {S.pageCount.value}</small></b><span>Pages</span>
          </button>
          {S.page.value < S.pageCount.value - 1
            ? <BBtn icon={ChevronRight} label="Next" onClick={() => board.turnPage(1)} />
            : <BBtn icon={Plus} label="New page" onClick={() => board.addPage()} />}
        </> : S.frameCount.value ? <>
          <BBtn icon={ChevronLeft} label="Back" disabled={S.frameIndex.value === 0} onClick={() => board.turnFrame(-1)} />
          <button type="button" class={`bb-page nodrag ${p === 'pages' ? 'active' : ''}`} data-popover-keep="" aria-label="All frames" onClick={() => toggle('pages')}>
            <b>{S.frameIndex.value < 0 ? '–' : S.frameIndex.value + 1}<small> / {S.frameCount.value}</small></b><span>Frames</span>
          </button>
          {S.frameIndex.value < S.frameCount.value - 1
            ? <BBtn icon={ChevronRight} label="Next" onClick={() => board.turnFrame(1)} />
            : <BBtn icon={Frame} label="New frame" onClick={() => board.addFrame()} />}
        </> : <BBtn icon={Frame} label="Add frame" onClick={() => board.addFrame('here')} />}
        <div class="bb-sep" />
        <BBtn icon={LayoutGrid} label="More" keep active={p === 'board-menu'} onClick={() => toggle('board-menu')} />
      </div>
    </div>
  )
}

/** Whether the lesson's file is up to date: it saves itself, so this only reassures (or warns). */
export function FileStatus(): JSX.Element | null {
  if (board.isEmpty && !lessonPath.value) return null
  const state = fileState.value === 'failed' ? 'failed' : lessonDirty.value || fileState.value === 'saving' ? 'saving' : 'saved'
  return <i class={`file-status ${state}`}>{state === 'failed' ? 'Not saved' : state === 'saving' ? 'Saving…' : 'Saved'}</i>
}

/** Everything that is not a drawing tool, in large tiles grouped by what a teacher wants to do. */
function BoardMenu(): JSX.Element {
  const close = (fn: () => unknown) => () => { S.popover.value = null; void fn() }
  const overlay = S.bgAlpha.value < OVERLAY_ALPHA
  return (
    <div class="popover panel ui board-sheet" data-popover-keep="">
      <div class="sheet-head lesson-line">Lesson · <b>{lessonName.value}</b>{lessonSubject.value && <span class="lesson-subject">{lessonSubject.value}</span>}<FileStatus /></div>
      <div class="tiles">
        <Tile icon={FilePlus2} label="New lesson" onClick={() => (S.popover.value = 'new-lesson')} />
        <Tile icon={Library} label="My lessons" onClick={() => (S.popover.value = 'lessons')} />
        <Tile icon={SaveAll} label="Save a copy…" onClick={close(lesson.saveAs)} />
        <Tile icon={Share2} label="Export" onClick={() => (S.popover.value = 'export')} />
        <Tile icon={Layers} label="Background" onClick={() => (S.popover.value = 'paper')} />
        <Tile icon={SlidersHorizontal} label="Settings" onClick={() => (S.popover.value = 'settings')} />
      </div>
      <Section title="Add to the page">
        <Tile icon={ImageIcon} label="Picture" onClick={close(() => pickFiles('image/*').then(files => insertFiles(files)))} />
        <Tile icon={Archive} label="My shelf" onClick={() => (S.popover.value = 'shelf')} />
        <Tile icon={MonitorUp} label="Capture" onClick={() => { void capture.open() }} />
        <Tile icon={FileText} label="PDF / worksheet" onClick={close(() => pickFiles('application/pdf,.pdf', false).then(files => insertFiles(files)))} />
        <Tile icon={Presentation} label="PowerPoint" onClick={close(() => pickFiles('.pptx,.ppt,.ubz', false).then(files => insertFiles(files)))} />
        <Tile icon={Film} label="Video / audio" onClick={close(() => pickFiles('video/*,audio/*,.mp4,.webm,.mp3,.m4a,.wav,.ogg,.aac', false).then(files => insertFiles(files)))} />
        <Tile icon={Table2} label="Table" onClick={() => (S.popover.value = 'table')} />
        <Tile icon={Network} label="Mind map" onClick={close(() => board.startMindMap())} />
        <Tile icon={LayoutTemplate} label="Templates" onClick={() => (S.popover.value = 'templates')} />
        <Tile icon={Sigma} label="Equation" onClick={() => editEquation(null)} />
        <Tile icon={LineChart} label="Graph" onClick={() => editGraph(null)} />
        <Tile icon={MoveHorizontal} label="Number line" onClick={() => editScale(null, 'line')} />
        <Tile icon={Axis3d} label="Axes" onClick={() => editScale(null, 'axes')} />
        <Tile icon={Atom} label="Periodic table" onClick={() => (S.popover.value = 'periodic')} />
        <Tile icon={Ruler} label="Ruler & compass" on={instrumentsShown.value.length > 0} onClick={() => (S.popover.value = 'maths')} />
        <Tile icon={FlaskConical} label="Science labs" onClick={() => (S.popover.value = 'science')} />
      </Section>
      <Section title="Teach">
        <Tile icon={Spotlight} label="Spotlight" on={spotlightOn.value} onClick={close(() => (spotlightOn.value = !spotlightOn.value))} />
        <Tile icon={EyeOff} label="Prepare reveals" on={S.preparing.value} onClick={close(() => board.setPreparing(!S.preparing.value))} />
        <Tile icon={Blinds} label="Screen cover" on={curtainOn.value} onClick={close(() => (curtainOn.value = !curtainOn.value))} />
        <Tile icon={Calculator} label="Calculator" on={calculatorOn.value} onClick={close(() => (calculatorOn.value = !calculatorOn.value))} />
        <Tile icon={Timer} label="Timer" on={timerOn.value} onClick={close(() => (timerOn.value = !timerOn.value))} />
        <Tile icon={Clock} label="Clock" on={clockOn.value} onClick={close(() => (clockOn.value = !clockOn.value))} />
        <Tile icon={Search} label="Magnifier" on={magnifierOn.value} onClick={close(() => (magnifierOn.value = !magnifierOn.value))} />
        <Tile icon={UserRoundCheck} label="Name picker" on={pickerOn.value} onClick={close(() => (pickerOn.value = !pickerOn.value))} />
        <Tile icon={Dices} label="Dice" on={diceOn.value} onClick={close(() => (diceOn.value = !diceOn.value))} />
        <Tile icon={Trophy} label="Scoreboard" on={scoreOn.value} onClick={close(() => (scoreOn.value = !scoreOn.value))} />
        <Tile icon={Columns2} label="Students at board" onClick={() => (S.popover.value = 'zones')} />
        <Tile icon={Vote} label="Ask the class" onClick={() => (S.popover.value = 'poll')} />
        <Tile icon={Clapperboard} label="Record & replay" onClick={() => (S.popover.value = 'replay')} />
        <Tile icon={MonitorUp} label={overlay ? 'Back to board' : 'Write over screen'} on={overlay} onClick={actions.toggleOverlay} />
        {overlay && <Tile icon={MousePointerClick} label="Use apps below" onClick={() => actions.setPassthrough(true)} />}
        <Tile icon={Sparkles} label="Assistant" onClick={() => (S.popover.value = 'agent')} />
      </Section>
      <Section title="Board">
        {S.kind.value === 'notebook'
          ? <Tile icon={InfinityIcon} label="Turn into canvas" onClick={() => actions.convertBoard('canvas')} />
          : <Tile icon={BookOpen} label="Turn into notebook" onClick={() => actions.convertBoard('notebook')} />}
        <Tile icon={Eye} label="Hide toolbar" onClick={actions.toggleUi} />
        <Tile icon={Laptop} label="Laptop layout" onClick={() => actions.chooseLayout('laptop')} />
        <Tile icon={Minus} label="Minimise" onClick={close(() => window.api.win.minimize())} />
        <Tile icon={LogOut} label="Exit" danger onClick={() => window.api.win.close()} />
      </Section>
    </div>
  )
}

/** The name of a page or frame under its picture; tap to rename. */
function ThumbTitle({ i, fallback }: { i: number; fallback: string }): JSX.Element {
  const [editing, setEditing] = useState(false)
  S.contentRevision.value // a rename elsewhere shows up here too
  const title = board.titleOf(i)
  const done = (text: string): void => { setEditing(false); if (text.trim() !== title) board.setTitle(i, text) }
  if (editing) return (
    <input class="thumb-input nodrag" type="text" maxLength={120} defaultValue={title} placeholder={fallback} aria-label="Name"
      ref={el => el?.focus()} onBlur={e => done((e.target as HTMLInputElement).value)}
      onKeyDown={e => { if (e.key === 'Enter') done((e.target as HTMLInputElement).value); else if (e.key === 'Escape') setEditing(false); e.stopPropagation() }} />
  )
  return <button type="button" class={`thumb-title nodrag ${title ? '' : 'plain'}`} aria-label={`Rename ${title || fallback}`} onClick={() => setEditing(true)}><span>{title || fallback}</span><Pencil size={12} /></button>
}

const THUMB_W = 176

const TH = Math.round(THUMB_W * PAGE_H / PAGE_W)

function Thumb({ i, sectioned }: { i: number; sectioned: boolean }): JSX.Element {
  const cv = useRef<HTMLCanvasElement>(null)
  const notebook = S.kind.value === 'notebook'
  const startSection = (): void => { board.setSection(i, 'New section'); editingSection.value = i }
  const sectionBtn = !sectioned && (
    <button type="button" class="nodrag" aria-label={`Start a section at ${notebook ? 'page' : 'frame'} ${i + 1}`} title="Start a section here" onClick={startSection}><Bookmark size={15} /></button>
  )
  useEffect(() => {
    const c = cv.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = Math.round(THUMB_W * dpr); c.height = Math.round(TH * dpr)
    board.paintPageThumb(i, c)
  }, [i, S.documentRevision.value, S.contentRevision.value, S.pageCount.value, S.frameCount.value, S.kind.value])
  const current = notebook ? i === S.page.value : i === S.frameIndex.value
  if (!notebook) return (
    <div class={`thumb ${current ? 'current' : ''}`}>
      <button type="button" class="thumb-face nodrag" aria-label={`Go to frame ${i + 1}`} onClick={() => { board.goToFrame(i); S.popover.value = null }}>
        <canvas ref={cv} style={{ width: `${THUMB_W}px`, height: `${TH}px` }} />
        <b>{i + 1}</b>
      </button>
      <ThumbTitle i={i} fallback={`Frame ${i + 1}`} />
      <div class="thumb-tools">
        <button type="button" class="nodrag" aria-label={`Move frame ${i + 1} earlier`} disabled={i === 0} onClick={() => board.moveFrame(i, i - 1)}><ChevronLeft size={16} /></button>
        {sectionBtn}
        <button type="button" class="nodrag" aria-label={`Remove frame ${i + 1}`} title="Remove the frame (the drawing stays)" onClick={() => board.deleteFrame(i)}><Trash2 size={15} /></button>
        <button type="button" class="nodrag" aria-label={`Move frame ${i + 1} later`} disabled={i === S.frameCount.value - 1} onClick={() => board.moveFrame(i, i + 1)}><ChevronRight size={16} /></button>
      </div>
    </div>
  )
  return (
    <div class={`thumb ${current ? 'current' : ''}`}>
      <button type="button" class="thumb-face nodrag" aria-label={`Go to page ${i + 1}`} onClick={() => { board.goToPage(i); S.popover.value = null }}>
        <canvas ref={cv} style={{ width: `${THUMB_W}px`, height: `${TH}px` }} />
        <b>{i + 1}</b>
      </button>
      <ThumbTitle i={i} fallback={`Page ${i + 1}`} />
      <div class="thumb-tools">
        <button type="button" class="nodrag" aria-label={`Move page ${i + 1} earlier`} disabled={i === 0} onClick={() => board.movePage(i, i - 1)}><ChevronLeft size={16} /></button>
        <button type="button" class="nodrag" aria-label={`Duplicate page ${i + 1}`} onClick={() => board.duplicatePage(i)}><Copy size={15} /></button>
        {sectionBtn}
        <button type="button" class="nodrag" aria-label={`Delete page ${i + 1}`} title="Delete the page (Undo brings it back)" onClick={() => {
          if (board.page === i || board.goToPage(i)) board.deletePage()
        }}><Trash2 size={15} /></button>
        <button type="button" class="nodrag" aria-label={`Move page ${i + 1} later`} disabled={i === S.pageCount.value - 1} onClick={() => board.movePage(i, i + 1)}><ChevronRight size={16} /></button>
      </div>
    </div>
  )
}

/** The section heading being renamed (just made, or tapped). */
const editingSection = signal(-1)

/** A section heading across the page sorter: its name (tap to rename), how many pages, and remove. */
function SectionHead({ i, count }: { i: number; count: number }): JSX.Element {
  S.contentRevision.value
  const name = board.sectionAt(i)
  const unit = S.kind.value === 'notebook' ? 'page' : 'frame'
  const done = (text: string): void => { editingSection.value = -1; if (text.trim() && text.trim() !== name) board.setSection(i, text) }
  return (
    <div class="section-head">
      {editingSection.value === i
        ? <input class="thumb-input nodrag" type="text" maxLength={120} defaultValue={name} aria-label="Section name" ref={el => { el?.focus(); el?.select() }}
          onBlur={e => done((e.target as HTMLInputElement).value)}
          onKeyDown={e => { if (e.key === 'Enter') done((e.target as HTMLInputElement).value); else if (e.key === 'Escape') editingSection.value = -1; e.stopPropagation() }} />
        : <button type="button" class="section-name nodrag" aria-label={`Rename section ${name}`} onClick={() => (editingSection.value = i)}><b>{name}</b><Pencil size={13} /></button>}
      <small>{count} {count === 1 ? unit : `${unit}s`}</small>
      <button type="button" class="section-remove nodrag" aria-label={`Remove the section heading ${name}`} title="Remove the heading (the pages stay)" onClick={() => board.setSection(i, '')}><X size={15} /></button>
    </div>
  )
}

/** Thumbnails of every notebook page (go to, reorder, duplicate, delete, add) or canvas frame, under their section headings. */
function PageSorter(): JSX.Element {
  const notebook = S.kind.value === 'notebook'
  const add = (fn: () => void) => (): void => { fn(); S.popover.value = null }
  S.contentRevision.value // section changes redraw the headings
  const n = notebook ? S.pageCount.value : S.frameCount.value
  const starts = Array.from({ length: n }, (_, i) => !!board.sectionAt(i))
  const sizeFrom = (i: number): number => { let k = i + 1; while (k < n && !starts[k]) k++; return k - i }
  return (
    <div class="popover panel ui page-sorter" data-popover-keep="">
      <div class="sheet-head sorter-head">
        <span>{notebook ? 'Pages' : 'Frames'}</span>
        {S.undoLabel.value && <button type="button" class="chip nodrag" onClick={() => board.undoStructure()}><Undo2 size={14} /> Undo: {S.undoLabel.value}</button>}
      </div>
      <div class="thumbs">
        {Array.from({ length: n }, (_, i) => [
          starts[i] && <SectionHead key={`s${i}`} i={i} count={sizeFrom(i)} />,
          <Thumb key={i} i={i} sectioned={starts[i]} />
        ])}
        {notebook
          ? <button type="button" class="thumb-add nodrag" onClick={add(() => board.addPage(undefined, undefined, S.pageCount.value))}><Plus size={26} /><span>New page</span></button>
          : <>
            <button type="button" class="thumb-add nodrag" onClick={add(() => board.addFrame('here'))}><Focus size={26} /><span>Frame what's on screen</span></button>
            <button type="button" class="thumb-add nodrag" onClick={add(() => board.addFrame())}><Plus size={26} /><span>New frame after the last</span></button>
          </>}
      </div>
    </div>
  )
}

/** Tabs on the left and right edges: wherever the teacher stands, the toolbar and menu come to them. */
export function EdgeTabs(): JSX.Element {
  const open = (side: BarSide) => (): void => { S.barSide.value = side; S.popover.value = 'board-menu' }
  const paged = S.kind.value === 'notebook'
  return (
    <>
      <button type="button" class="edge-tab left ui nodrag" data-popover-keep="" aria-label="Open the menu on this side" onClick={open('left')}><LayoutGrid size={20} /></button>
      {paged
        ? <PageRail onMenu={open('right')} />
        : <button type="button" class="edge-tab right ui nodrag" data-popover-keep="" aria-label="Open the menu on this side" onClick={open('right')}><LayoutGrid size={20} /></button>}
    </>
  )
}

const MAP_W = 64

/**
 * Page mode, right edge: the menu, a map of a long page (drag to scroll) and buttons that add or
 * remove a screen of space at the bottom.
 */
function PageRail({ onMenu }: { onMenu: () => void }): JSX.Element {
  S.viewRevision.value; S.documentRevision.value // repaint on scroll and edits
  const f = board.pageFrame
  const map = useRef<HTMLCanvasElement>(null)
  const total = PAGE_H * f.extent
  const mapH = Math.min(MAP_W * total / PAGE_W, window.innerHeight * .4)
  const mapW = mapH * PAGE_W / total
  const v = board.view, { w, h } = board.size
  const box = { top: (v.y - f.y) / total * mapH, height: Math.min(1, h / v.zoom / total) * mapH, left: (v.x - f.x) / PAGE_W * mapW, width: Math.min(1, w / v.zoom / PAGE_W) * mapW }
  useEffect(() => {
    const c = map.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = Math.round(mapW * dpr); c.height = Math.round(mapH * dpr)
    board.paintPageThumb(S.page.value, c)
  }, [S.documentRevision.value, S.contentRevision.value, S.page.value, f.extent, mapW, mapH, S.bgColor.value, S.grid.value])
  const scrollTo = (e: PointerEvent): void => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    board.scrollPage(Math.max(0, Math.min(1, (e.clientY - r.top - box.height / 2) / Math.max(1, mapH - box.height))))
  }
  return (
    <div class="page-rail ui" data-popover-keep="">
      <button type="button" class="rail-btn nodrag" aria-label="Open the menu on this side" onClick={onMenu}><LayoutGrid size={20} /></button>
      {f.extent > 1 && (
        <div class="rail-map nodrag" style={{ width: `${mapW}px`, height: `${mapH}px` }} role="scrollbar" aria-label="Page map" aria-orientation="vertical"
          aria-valuenow={Math.round(scrollOf(v, f, h) * 100)}
          onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); scrollTo(e as unknown as PointerEvent) }}
          onPointerMove={(e) => { if (e.buttons) scrollTo(e as unknown as PointerEvent) }}>
          <canvas ref={map} style={{ width: `${mapW}px`, height: `${mapH}px` }} />
          <i class="rail-view" style={{ top: `${box.top}px`, height: `${box.height}px`, left: `${box.left}px`, width: `${box.width}px` }} />
        </div>
      )}
      <button type="button" class="rail-btn nodrag" aria-label="More space below" title="More space below" disabled={f.extent >= MAX_EXTENT}
        onClick={() => board.extendPage()}><ArrowDownToLine size={20} /></button>
      {board.canShrinkPage() && <button type="button" class="rail-btn nodrag" aria-label="Remove the empty space at the bottom" title="Remove the empty space at the bottom"
        onClick={() => board.shrinkPage()}><ArrowUpToLine size={20} /></button>}
    </div>
  )
}

/** Only when something is wrong: autosave is silent when it works. */
export function BoardSaveChip(): JSX.Element | null {
  const error = S.saveError.value || S.settingsError.value
  if (!error) return null
  return <button type="button" class="board-save-chip ui nodrag" title={error} onClick={actions.retrySave}>Not saved · tap to retry</button>
}

/** First launch: one question decides the whole layout. */
export function LayoutChooser(): JSX.Element {
  return (
    <div class="chooser ui" role="dialog" aria-modal="true" aria-labelledby="chooser-title">
      <div class="chooser-card panel">
        <h1 id="chooser-title">Where are you teaching?</h1>
        <p>This sets up the board for your screen. You can change it later in Settings.</p>
        <div class="chooser-options">
          <button type="button" class="chooser-option nodrag" onClick={() => actions.chooseLayout('board')}>
            <Presentation size={44} strokeWidth={1.5} />
            <b>Smart board</b>
            <span>A big classroom touch screen. Full screen, large buttons, toolbar at the bottom.</span>
          </button>
          <button type="button" class="chooser-option nodrag" onClick={() => actions.chooseLayout('laptop')}>
            <Laptop size={44} strokeWidth={1.5} />
            <b>Laptop or PC</b>
            <span>A floating window that can sit over other apps. Mouse, touch or pen tablet.</span>
          </button>
        </div>
      </div>
    </div>
  )
}
