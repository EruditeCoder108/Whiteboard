import {
  Blinds, ChevronLeft, ChevronRight, Clapperboard, Copy, Crosshair, Eraser, Eye, FileDown, FileText, FlaskConical, GripVertical,
  Highlighter, Image as ImageIcon, Laptop, LayoutGrid, LineChart, LogOut, Minus, MousePointer2, MousePointerClick, Pen, Plus,
  Presentation, Redo2, Ruler, Shapes, SlidersHorizontal, Sigma, Sparkles, Spotlight, Timer, Trash2, Type, Undo2, MonitorUp, Layers
} from 'lucide-preact'
import type { ComponentChildren, JSX } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { board } from '@/engine/instance'
import { instrumentsShown } from '@/engine/instruments'
import { OVERLAY_ALPHA, actions } from '@/state/actions'
import { S, activeTool, currentColor, currentSize, isDarkBg, isShapeTool, styleKey } from '@/state/store'
import type { BarSide, ToolName } from '@/state/store'
import { editEquation, editGraph, exportPdf, insertFiles, pickFiles } from '@/state/insert'
import { ShapesPopover, PropsPopover } from './Popovers'
import { MathsPopover, curtainOn, spotlightOn, timerOn } from './Present'

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
  return <BBtn icon={icon} label={label} active={activeTool.value === tool} onClick={() => { S.popover.value = null; actions.setTool(tool) }} />
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
      <div class="boardbar panel ui" role="toolbar" aria-label="Board tools">
        <button type="button" class="bb-grip nodrag" aria-label="Move the toolbar left or right" title="Drag to move the toolbar"
          onPointerDown={onGrip as never} onPointerMove={onGripMove as never} onPointerUp={() => (drag.current = false)} onPointerCancel={() => (drag.current = false)}>
          <GripVertical size={18} />
        </button>
        <ToolBtn tool="select" icon={MousePointer2} label="Select" />
        <ToolBtn tool="pen" icon={Pen} label="Pen" />
        <ToolBtn tool="marker" icon={Highlighter} label="Highlight" />
        <ToolBtn tool="eraser" icon={Eraser} label="Eraser" />
        <BBtn icon={Shapes} label="Shapes" keep active={isShapeTool(t) || p === 'shapes'} onClick={() => {
          if (!isShapeTool(t)) board.setTool(S.lastShape.value)
          toggle('shapes')
        }} />
        <ToolBtn tool="text" icon={Type} label="Text" />
        <ToolBtn tool="laser" icon={Crosshair} label="Laser" />
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
        <BBtn icon={ChevronLeft} label="Back" disabled={S.page.value === 0} onClick={() => board.goToPage(S.page.value - 1)} />
        <button type="button" class={`bb-page nodrag ${p === 'pages' ? 'active' : ''}`} data-popover-keep="" aria-label="All pages" onClick={() => toggle('pages')}>
          <b>{S.page.value + 1}<small> / {S.pageCount.value}</small></b><span>Pages</span>
        </button>
        {S.page.value < S.pageCount.value - 1
          ? <BBtn icon={ChevronRight} label="Next" onClick={() => board.goToPage(S.page.value + 1)} />
          : <BBtn icon={Plus} label="New page" onClick={() => board.addPage()} />}
        <div class="bb-sep" />
        <BBtn icon={LayoutGrid} label="More" keep active={p === 'board-menu'} onClick={() => toggle('board-menu')} />
      </div>
    </div>
  )
}

function Tile({ icon: I, label, on, onClick, danger }: { icon: Icon; label: string; on?: boolean; onClick: () => void; danger?: boolean }): JSX.Element {
  return (
    <button type="button" class={`tile nodrag ${on ? 'on' : ''} ${danger ? 'danger' : ''}`} aria-pressed={on} onClick={onClick}>
      <I size={24} strokeWidth={1.8} /><span>{label}</span>
    </button>
  )
}

function Section({ title, children }: { title: string; children: ComponentChildren }): JSX.Element {
  return <><div class="sheet-head">{title}</div><div class="tiles">{children}</div></>
}

/** Everything that is not a drawing tool, in large tiles grouped by what a teacher wants to do. */
function BoardMenu(): JSX.Element {
  const close = (fn: () => unknown) => () => { S.popover.value = null; void fn() }
  const overlay = S.bgAlpha.value < OVERLAY_ALPHA
  return (
    <div class="popover panel ui board-sheet" data-popover-keep="">
      <Section title="Add to the page">
        <Tile icon={ImageIcon} label="Picture" onClick={close(() => pickFiles('image/*').then(files => insertFiles(files)))} />
        <Tile icon={FileText} label="PDF / worksheet" onClick={close(() => pickFiles('application/pdf,.pdf', false).then(files => insertFiles(files)))} />
        <Tile icon={Sigma} label="Equation" onClick={() => editEquation(null)} />
        <Tile icon={LineChart} label="Graph" onClick={() => editGraph(null)} />
        <Tile icon={Ruler} label="Ruler & compass" on={instrumentsShown.value.length > 0} onClick={() => (S.popover.value = 'maths')} />
        <Tile icon={FlaskConical} label="Science labs" onClick={() => (S.popover.value = 'science')} />
      </Section>
      <Section title="Teach">
        <Tile icon={Spotlight} label="Spotlight" on={spotlightOn.value} onClick={close(() => (spotlightOn.value = !spotlightOn.value))} />
        <Tile icon={Blinds} label="Screen cover" on={curtainOn.value} onClick={close(() => (curtainOn.value = !curtainOn.value))} />
        <Tile icon={Timer} label="Timer" on={timerOn.value} onClick={close(() => (timerOn.value = !timerOn.value))} />
        <Tile icon={Clapperboard} label="Record & replay" onClick={() => (S.popover.value = 'replay')} />
        <Tile icon={MonitorUp} label={overlay ? 'Back to board' : 'Write over screen'} on={overlay} onClick={actions.toggleOverlay} />
        {overlay && <Tile icon={MousePointerClick} label="Use apps below" onClick={() => actions.setPassthrough(true)} />}
        <Tile icon={Sparkles} label="Assistant" onClick={() => (S.popover.value = 'agent')} />
      </Section>
      <Section title="Board">
        <Tile icon={Layers} label="Background" onClick={() => (S.popover.value = 'settings')} />
        <Tile icon={FileDown} label="Save as PDF" onClick={close(exportPdf)} />
        <Tile icon={SlidersHorizontal} label="Settings" onClick={() => (S.popover.value = 'settings')} />
        <Tile icon={Eye} label="Hide toolbar" onClick={actions.toggleUi} />
        <Tile icon={Laptop} label="Laptop layout" onClick={() => actions.chooseLayout('laptop')} />
        <Tile icon={Minus} label="Minimise" onClick={close(() => window.api.win.minimize())} />
        <Tile icon={LogOut} label="Exit" danger onClick={() => window.api.win.close()} />
      </Section>
    </div>
  )
}

const THUMB_W = 176

function Thumb({ i }: { i: number }): JSX.Element {
  const cv = useRef<HTMLCanvasElement>(null)
  const { w, h } = board.size
  const th = Math.round(THUMB_W * (h || 9) / (w || 16))
  useEffect(() => {
    const c = cv.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = Math.round(THUMB_W * dpr); c.height = Math.round(th * dpr)
    board.paintPageThumb(i, c, S.bgColor.value)
  }, [i, S.documentRevision.value, S.pageCount.value, S.bgColor.value])
  const current = i === S.page.value
  return (
    <div class={`thumb ${current ? 'current' : ''}`}>
      <button type="button" class="thumb-face nodrag" aria-label={`Go to page ${i + 1}`} onClick={() => { board.goToPage(i); S.popover.value = null }}>
        <canvas ref={cv} style={{ width: `${THUMB_W}px`, height: `${th}px` }} />
        <b>{i + 1}</b>
      </button>
      <div class="thumb-tools">
        <button type="button" class="nodrag" aria-label={`Move page ${i + 1} earlier`} disabled={i === 0} onClick={() => board.movePage(i, i - 1)}><ChevronLeft size={16} /></button>
        <button type="button" class="nodrag" aria-label={`Duplicate page ${i + 1}`} onClick={() => board.duplicatePage(i)}><Copy size={15} /></button>
        <button type="button" class="nodrag" aria-label={`Delete page ${i + 1}`} onClick={() => {
          if (!confirm(`Delete page ${i + 1}? This cannot be undone.`)) return
          if (board.page === i || board.goToPage(i)) board.deletePage()
        }}><Trash2 size={15} /></button>
        <button type="button" class="nodrag" aria-label={`Move page ${i + 1} later`} disabled={i === S.pageCount.value - 1} onClick={() => board.movePage(i, i + 1)}><ChevronRight size={16} /></button>
      </div>
    </div>
  )
}

/** Thumbnails of every page: go to, reorder, duplicate, delete, add. */
function PageSorter(): JSX.Element {
  return (
    <div class="popover panel ui page-sorter" data-popover-keep="">
      <div class="sheet-head">Pages</div>
      <div class="thumbs">
        {Array.from({ length: S.pageCount.value }, (_, i) => <Thumb key={i} i={i} />)}
        <button type="button" class="thumb-add nodrag" onClick={() => { board.addPage(undefined, undefined, S.pageCount.value); S.popover.value = null }}>
          <Plus size={26} /><span>New page</span>
        </button>
      </div>
    </div>
  )
}

/** Tabs on the left and right edges: wherever the teacher stands, the toolbar and menu come to them. */
export function EdgeTabs(): JSX.Element {
  const open = (side: BarSide) => (): void => { S.barSide.value = side; S.popover.value = 'board-menu' }
  return (
    <>
      <button type="button" class="edge-tab left ui nodrag" data-popover-keep="" aria-label="Open the menu on this side" onClick={open('left')}><LayoutGrid size={20} /></button>
      <button type="button" class="edge-tab right ui nodrag" data-popover-keep="" aria-label="Open the menu on this side" onClick={open('right')}><LayoutGrid size={20} /></button>
    </>
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
