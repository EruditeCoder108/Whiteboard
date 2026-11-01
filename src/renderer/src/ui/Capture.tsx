import type { JSX } from 'preact'
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { Check, Maximize, Monitor, RefreshCw, X } from './icons'
import type { CapturedImage, CaptureSource } from '@shared/api'
import { capture, captureBusy, captureError, captureOpen, captureRegion, captureSources, captureStill, cropPixels } from '@/state/capture'
import type { Region } from '@/state/capture'
import { dialog } from '@/state/dialog'
import { Section, Tile } from './kit'

const corners = ['nw', 'ne', 'se', 'sw'] as const
type Corner = typeof corners[number]
const labels = { nw: 'Top left corner', ne: 'Top right corner', se: 'Bottom right corner', sw: 'Bottom left corner' }

/** The picture, not the screen's empty margins, supplies the coordinates for touch selection. */
function RegionView({ image }: { image: CapturedImage }): JSX.Element {
  const stage = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 1, height: 1 })
  const drag = useRef<{ id: number; start: [number, number]; mode: Corner | 'new' | 'move'; before: Region | null } | null>(null)
  useLayoutEffect(() => {
    const el = stage.current!
    const observer = new ResizeObserver(() => {
      const k = Math.max(0, Math.min((el.clientWidth - 64) / image.width, (el.clientHeight - 64) / image.height))
      setSize({ width: image.width * k, height: image.height * k })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [image])
  const point = (e: PointerEvent): [number, number] => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]
  }
  const down = (e: PointerEvent): void => {
    if (captureBusy.value || drag.current || !e.isPrimary || e.button !== 0) return
    e.preventDefault(); e.stopPropagation()
    const target = e.target as Element, corner = target.closest<HTMLElement>('[data-corner]')?.dataset.corner as Corner | undefined
    const start = point(e), before = captureRegion.value
    drag.current = { id: e.pointerId, start, before, mode: corner ?? (target.closest('[data-move]') && before ? 'move' : 'new') }
    if (drag.current.mode === 'new') captureRegion.value = { x0: start[0], y0: start[1], x1: start[0], y1: start[1] }
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* the contact may already have ended */ }
  }
  const move = (e: PointerEvent): void => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    e.preventDefault()
    const [x, y] = point(e), r = d.before
    let next: Region
    if (d.mode === 'move' && r) {
      const dx = Math.max(-r.x0, Math.min(1 - r.x1, x - d.start[0])), dy = Math.max(-r.y0, Math.min(1 - r.y1, y - d.start[1]))
      next = { x0: r.x0 + dx, y0: r.y0 + dy, x1: r.x1 + dx, y1: r.y1 + dy }
    } else if (d.mode !== 'new' && r) {
      const west = d.mode.endsWith('w'), north = d.mode.startsWith('n')
      next = { x0: west ? x : r.x0, x1: west ? r.x1 : x, y0: north ? y : r.y0, y1: north ? r.y1 : y }
    } else next = { x0: d.start[0], y0: d.start[1], x1: x, y1: y }
    captureRegion.value = { x0: Math.min(next.x0, next.x1), y0: Math.min(next.y0, next.y1), x1: Math.max(next.x0, next.x1), y1: Math.max(next.y0, next.y1) }
  }
  const up = (e: PointerEvent): void => {
    if (drag.current?.id !== e.pointerId) return
    if (e.type === 'pointercancel') captureRegion.value = drag.current.before
    const r = captureRegion.value
    if (r && ((r.x1 - r.x0) * size.width < 8 || (r.y1 - r.y0) * size.height < 8)) captureRegion.value = null
    drag.current = null
  }
  const r = captureRegion.value
  return <div class="capture-stage" ref={stage}>
    <div class="capture-picture nodrag" style={size} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <img src={image.src} alt="Captured screen — drag to choose an area" draggable={false} />
      {r && <>
        <i class="capture-dim" style={{ inset: `0 0 ${(1 - r.y0) * 100}% 0` }} />
        <i class="capture-dim" style={{ inset: `${r.y1 * 100}% 0 0 0` }} />
        <i class="capture-dim" style={{ left: 0, top: `${r.y0 * 100}%`, width: `${r.x0 * 100}%`, height: `${(r.y1 - r.y0) * 100}%` }} />
        <i class="capture-dim" style={{ right: 0, top: `${r.y0 * 100}%`, width: `${(1 - r.x1) * 100}%`, height: `${(r.y1 - r.y0) * 100}%` }} />
      </>}
      {r && <div class="capture-selection" data-move="" style={{ left: `${r.x0 * 100}%`, top: `${r.y0 * 100}%`, width: `${(r.x1 - r.x0) * 100}%`, height: `${(r.y1 - r.y0) * 100}%` }}>
        {corners.map(c => <button type="button" key={c} class={`capture-corner ${c}`} data-corner={c} aria-label={labels[c]}><span /></button>)}
      </div>}
    </div>
  </div>
}

function SourceTile({ source }: { source: CaptureSource }): JSX.Element {
  return <button type="button" class="tile capture-source nodrag" disabled={captureBusy.value} onClick={() => { void capture.choose(source) }} data-source-id={source.id} data-source-kind={source.kind}>
    <div class="capture-thumbnail">{source.thumbnail ? <img src={source.thumbnail} alt="" /> : <Monitor size={48} />}</div>
    <span class="capture-source-name">{source.icon && <img class="capture-app-icon" src={source.icon} alt="" />}<span>{source.name}</span></span>
  </button>
}

/** Full-window previews and fixed, large actions keep capture usable from a classroom panel. */
export function CapturePanel(): JSX.Element | null {
  const open = captureOpen.value, still = captureStill.value
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const keys = (e: KeyboardEvent): void => {
      if (!captureOpen.value || dialog.value) return
      e.stopImmediatePropagation()
      if (e.key === 'Escape') { e.preventDefault(); capture.close() }
      if (e.key === 'Tab') {
        const buttons = [...panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []]
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        e.preventDefault(); buttons[(index + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus()
      }
    }
    window.addEventListener('keydown', keys, true)
    const off = window.api.win.onFlush(capture.close)
    return () => { off(); window.removeEventListener('keydown', keys, true); previous?.focus() }
  }, [open])
  if (!open) return null
  const sources = captureSources.value, busy = captureBusy.value
  const crop = still && cropPixels(captureRegion.value, still.width, still.height)
  return <div class="capture-shade ui" role="dialog" aria-modal="true" aria-labelledby="capture-title" data-popover-keep="">
    <div class="capture-panel panel" ref={panel}>
      <header class="capture-head"><div><h1 id="capture-title">{still ? 'Choose an area' : 'Capture to lesson'}</h1>
        <p>{still ? 'Drag an area, then adjust its corners. The picture will be locked so you can write on it.' : 'Choose a screen to capture all or part of it, or tap a window. Nothing is uploaded.'}</p></div>
        <span class="chip capture-local">{still ? 'Still picture' : 'On this PC'}</span>
      </header>
      {captureError.value && <p class="capture-error" role="alert">{captureError.value}</p>}
      {still ? <RegionView image={still} /> : <div class="capture-sources">
        {sources === null && <p class="capture-empty" role="status">Finding screens and windows…</p>}
        {sources?.length === 0 && <p class="capture-empty">No screens or windows are available. Open what you want to show, then tap Refresh.</p>}
        {(['screen', 'window'] as const).map(kind => sources?.some(s => s.kind === kind) && <section key={kind}>
          <h2>{kind === 'screen' ? 'Screens' : 'Windows'}</h2>
          <div class="capture-grid">{sources.filter(s => s.kind === kind).map(source => <SourceTile key={source.id} source={source} />)}</div>
        </section>)}
      </div>}
      <footer class={`capture-footer ${still ? 'has-picture' : ''}`}>
        <div class="capture-status" role="status">{busy ? still ? 'Adding the picture…' : sources ? 'Capturing… the board will return in a moment.' : 'Finding what you can capture…'
          : still ? crop ? `${crop.width} × ${crop.height} pixels selected` : 'Drag on the picture to choose an area, or use the whole screen.' : 'Some protected videos and windows may appear black. Try a whole screen if a window fails.'}</div>
        <Section title={still ? 'Add to the lesson' : 'Choose what to capture'} cols={still ? 3 : 2}>
          {still ? <><Tile icon={Maximize} label="Use whole screen" disabled={busy} onClick={() => { void capture.use(false) }} />
            <Tile icon={Check} label="Use this area" disabled={busy || !crop} onClick={() => { void capture.use(true) }} /></>
            : <Tile icon={RefreshCw} label="Refresh" disabled={busy} onClick={() => { void capture.refresh() }} />}
          <Tile icon={X} label="Cancel" onClick={capture.close} />
        </Section>
      </footer>
    </div>
  </div>
}
