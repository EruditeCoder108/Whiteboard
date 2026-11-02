import { Eraser, Eye, Highlighter, Maximize2, Minimize2, Minus, MousePointerClick, Pen, Plus, Scan, Trash2, Undo2, X } from './icons'
import type { JSX } from 'preact'
import { useRef, useState } from 'preact/hooks'
import { board } from '@/engine/instance'
import { actions } from '@/state/actions'
import { S, activeTool, isDarkBg } from '@/state/store'
import { Btn } from './kit'

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

/** Only outside full screen: the strip that moves the window, as any window has. */
export function WindowBar(): JSX.Element {
  return (
    <div class="window-bar ui drag">
      <SaveIndicator />
      <div class="grow" />
      <Btn icon={Minus} title="Minimise" onClick={() => window.api.win.minimize()} />
      <Btn icon={S.fullscreen.value ? Minimize2 : Maximize2} title="Full screen  (F11)" onClick={actions.toggleFullscreen} />
      <Btn icon={X} title="Close  (your board is saved automatically)" danger onClick={() => window.api.win.close()} />
    </div>
  )
}

/** A canvas can be zoomed; a notebook page always fits, so this only shows on a canvas. */
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
    </div>
  )
}

const SCREEN_INKS = ['#e5484d', '#2f6bff', '#2fa66a', '#111827', '#ffffff']

/** Writing over whatever is on the screen: the board is gone, and only this small bar remains. It can be dragged out of the way. */
export function ScreenBar(): JSX.Element {
  const [at, setAt] = useState<[number, number] | null>(null)
  const grip = useRef<[number, number] | null>(null)
  const tool = activeTool.value
  const ink = S.penColor.value.toLowerCase()
  void isDarkBg.value
  return (
    <div class="screen-bar panel ui" role="toolbar" aria-label="Writing on the screen" data-popover-keep="" style={at ? { left: `${at[0]}px`, top: `${at[1]}px`, bottom: 'auto', transform: 'none' } : undefined}>
      <button type="button" class="bb-grip nodrag" aria-label="Move this bar" style={{ touchAction: 'none' }}
        onPointerDown={e => { const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect(); grip.current = [e.clientX - r.left, e.clientY - r.top]; e.currentTarget.setPointerCapture(e.pointerId) }}
        onPointerMove={e => { if (grip.current) setAt([Math.max(0, e.clientX - grip.current[0]), Math.max(0, e.clientY - grip.current[1])]) }}
        onPointerUp={() => (grip.current = null)} onPointerCancel={() => (grip.current = null)}><i class="screen-grip" /></button>
      <button type="button" class={`screen-tool nodrag ${tool === 'pen' ? 'active' : ''}`} title="Pen" aria-label="Pen" aria-pressed={tool === 'pen'} onClick={() => actions.setTool('pen')}><Pen size={26} /></button>
      <button type="button" class={`screen-tool nodrag ${tool === 'marker' ? 'active' : ''}`} title="Highlight" aria-label="Highlight" aria-pressed={tool === 'marker'} onClick={() => actions.setTool('marker')}><Highlighter size={26} /></button>
      <button type="button" class={`screen-tool nodrag ${tool === 'eraser' ? 'active' : ''}`} title="Eraser" aria-label="Eraser" aria-pressed={tool === 'eraser'} onClick={() => actions.setTool('eraser')}><Eraser size={26} /></button>
      <div class="bb-sep" />
      <div class="bb-inks">
        {SCREEN_INKS.map(c => <button type="button" key={c} class={`bb-ink nodrag ${tool !== 'eraser' && ink === c ? 'sel' : ''}`} style={{ '--c': c } as never} aria-label={`Ink ${c}`} aria-pressed={ink === c} onClick={() => actions.setColor(c)} />)}
      </div>
      <div class="bb-sep" />
      <button type="button" class="screen-tool nodrag" title="Undo" aria-label="Undo" disabled={!S.canUndo.value} onClick={() => board.undo()}><Undo2 size={22} {...({ plain: true } as object)} /></button>
      <button type="button" class="screen-tool nodrag" title="Clear the writing" aria-label="Clear the writing" onClick={() => board.clearBoard()}><Trash2 size={22} {...({ plain: true } as object)} /></button>
      <button type="button" class="screen-tool nodrag" title="Use the apps underneath" aria-label="Use the apps underneath" onClick={() => actions.setPassthrough(true)}><MousePointerClick size={22} {...({ plain: true } as object)} /></button>
      <div class="bb-sep" />
      <button type="button" class="screen-back nodrag" onClick={actions.exitScreen}>Back to board</button>
    </div>
  )
}
