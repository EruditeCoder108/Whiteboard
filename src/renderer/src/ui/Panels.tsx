import {
  Crosshair, Eraser, Eye, EyeOff, Hand, Highlighter, Menu, Minimize2,
  MousePointer2, MousePointerClick, Pen, Pin, PinOff, Redo2, Scan, SlidersHorizontal, Undo2, X, Minus, Plus,
  Slash, ArrowUpRight, Square, Circle, Maximize2, Diamond, Triangle, Type, StickyNote, Lasso, Sparkles, Clapperboard
} from 'lucide-preact'
import type { JSX } from 'preact'
import { board } from '@/engine/instance'
import { actions } from '@/state/actions'
import { S, activeTool, currentColor, isShapeTool } from '@/state/store'
import type { ToolName } from '@/state/store'
import { Btn, Sep } from './kit'
import { PropsPopover, ShapesPopover } from './Popovers'

const SHAPE_ICON = { line: Slash, arrow: ArrowUpRight, rect: Square, ellipse: Circle, diamond: Diamond, triangle: Triangle }

function toggle(name: 'props' | 'shapes' | 'menu' | 'settings' | 'agent' | 'replay'): void {
  S.popover.value = S.popover.value === name ? null : name
}

export function TopBar(): JSX.Element {
  return (
    <div class="topbar ui drag">
      <Btn icon={Menu} title="Menu" keep onClick={() => toggle('menu')} active={S.popover.value === 'menu'} />
      <div class="grow" />
      <SaveIndicator />
      <Btn icon={Clapperboard} title="Record and replay" keep onClick={() => toggle('replay')} active={S.popover.value === 'replay' || S.replaying.value} />
      <Btn icon={Sparkles} title="Agent tools and assistant" keep onClick={() => toggle('agent')} active={S.popover.value === 'agent'} />
      <Btn icon={EyeOff} title="Hide interface  (Tab)  —  a small button stays to bring it back" onClick={actions.toggleUi} />
      <Btn
        icon={MousePointerClick}
        title="Pass-through: click the apps underneath  (Ctrl+Shift+Space)"
        active={S.passthrough.value}
        onClick={() => actions.setPassthrough(!S.passthrough.value)}
      />
      <Btn icon={SlidersHorizontal} title="Board settings" keep onClick={() => toggle('settings')} active={S.popover.value === 'settings'} />
      <Btn icon={S.onTop.value ? Pin : PinOff} title="Always on top  (Ctrl+T)" active={S.onTop.value} onClick={actions.togglePin} />
      <Btn icon={S.fullscreen.value ? Minimize2 : Maximize2} title="Fullscreen  (F11)" onClick={actions.toggleFullscreen} />
      <Btn icon={Minus} title="Minimise" onClick={() => window.api.win.minimize()} />
      <Btn icon={X} title="Close  (your board is saved automatically)" danger onClick={() => window.api.win.close()} />
    </div>
  )
}

function SaveIndicator(): JSX.Element {
  const error = S.saveError.value || S.settingsError.value
  const status = error ? 'error' : S.saveStatus.value
  const label = { saved: 'Saved', unsaved: 'Unsaved', saving: 'Saving…', error: 'Retry save' }[status]
  return <button type="button" class={`save-status nodrag ${status}`} data-testid="save-status"
    title={error ? error + ' · Click to retry' : 'Board autosave · Click to save now'}
    disabled={status === 'saving' || !S.ready.value} onClick={actions.retrySave}>
    <span role="status" aria-live="polite">{label}</span>
  </button>
}

function ToolBtn({ tool, icon, title }: { tool: ToolName; icon: Parameters<typeof Btn>[0]['icon']; title: string }): JSX.Element {
  return <Btn icon={icon} title={title} active={activeTool.value === tool} onClick={() => actions.setTool(tool)} />
}

export function Dock(): JSX.Element {
  const t = activeTool.value
  const shapeActive = isShapeTool(t)
  const ShapeIcon = SHAPE_ICON[shapeActive ? t : S.lastShape.value]
  const eraser = t === 'eraser'
  return (
    <div class="dock-wrap">
      <div class="dock panel ui">
        <ToolBtn tool="select" icon={MousePointer2} title="Select & move  (V)" />
        <ToolBtn tool="lasso" icon={Lasso} title="Lasso selection  (Q)" />
        <ToolBtn tool="hand" icon={Hand} title="Hand — drag to pan  (H)" />
        <Sep />
        <ToolBtn tool="pen" icon={Pen} title="Pen  (P)" />
        <ToolBtn tool="marker" icon={Highlighter} title="Highlighter  (M)" />
        <ToolBtn tool="eraser" icon={Eraser} title="Eraser  (E)  ·  press E again to switch Stroke ⇄ Pixel" />
        <div class="anchor">
          <Btn
            icon={ShapeIcon}
            title="Shapes  (L · A · R · O)"
            active={shapeActive}
            keep
            onClick={() => {
              if (!shapeActive) board.setTool(S.lastShape.value)
              toggle('shapes')
            }}
          />
          {S.popover.value === 'shapes' && <ShapesPopover />}
        </div>
        <ToolBtn tool="text" icon={Type} title="Text  (T)" />
        <ToolBtn tool="sticky" icon={StickyNote} title="Sticky note  (N)" />
        <ToolBtn tool="laser" icon={Crosshair} title="Laser pointer  (K)" />
        <Sep />
        <div class="anchor">
          <button
            type="button"
            class="colordot nodrag"
            title="Colour & size"
            data-popover-keep=""
            onClick={() => {
              if (['hand', 'laser'].includes(S.tool.value) || (['select', 'lasso'].includes(S.tool.value) && !S.selectionCount.value)) board.setTool('pen')
              toggle('props')
            }}
          >
            {eraser ? <span class="eraser-dot" /> : <span class="dot" style={{ background: ['select', 'lasso'].includes(S.tool.value) && S.selectionCount.value ? S.selectionColor.value ?? 'conic-gradient(#e5484d, #2f6bff, #2fa66a, #e5484d)' : currentColor.value }} />}
          </button>
          {S.popover.value === 'props' && <PropsPopover />}
        </div>
      </div>
    </div>
  )
}

export function HistoryBar(): JSX.Element {
  return (
    <div class="history panel ui">
      <Btn icon={Undo2} title="Undo  (Ctrl+Z)" disabled={!S.canUndo.value} onClick={() => board.undo()} />
      <Btn icon={Redo2} title="Redo  (Ctrl+Y)" disabled={!S.canRedo.value} onClick={() => board.redo()} />
    </div>
  )
}

export function ZoomBar(): JSX.Element {
  return (
    <div class="zoombar panel ui">
      <Btn icon={Minus} title="Zoom out  (Ctrl −)" onClick={() => board.zoomStep(1 / 1.25)} />
      <button type="button" class="zoomval nodrag" title="Reset to 100%  (Ctrl+0)" onClick={() => board.resetZoom()}>
        {Math.round(S.zoom.value * 100)}%
      </button>
      <Btn icon={Plus} title="Zoom in  (Ctrl +)" onClick={() => board.zoomStep(1.25)} />
      <Btn icon={Scan} title="Fit everything  (Ctrl+1)" onClick={() => board.fitContent()} />
    </div>
  )
}

/** What is left when the interface is hidden: a faint pill that firms up on hover. */
export function MiniBar(): JSX.Element {
  return (
    <div class="minibar ui">
      {(S.saveError.value || S.settingsError.value) && <SaveIndicator />}
      <Btn icon={Eye} title="Show interface  (Tab)" size={15} onClick={actions.toggleUi} />
      <Btn
        icon={MousePointerClick}
        title="Pass-through: click the apps underneath"
        active={S.passthrough.value}
        size={15}
        onClick={() => actions.setPassthrough(!S.passthrough.value)}
      />
      <Btn icon={Undo2} title="Undo" size={15} disabled={!S.canUndo.value} onClick={() => board.undo()} />
    </div>
  )
}
