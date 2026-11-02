import { signal } from '@preact/signals'
import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { contactLimits } from '@/engine/roles'
import { S, showToast } from '@/state/store'

export const panelCheckOn = signal(false)

interface Touch { type: string; width: number; height: number; pressure: number }

const STEPS: { key: string; title: string; hint: string; times: number }[] = [
  { key: 'tip', title: 'The thin tip of the stylus', hint: 'Touch the box three times, the way you write. Skip this if the board has no stylus.', times: 3 },
  { key: 'thick', title: 'The thick end of the stylus', hint: 'Touch the box three times with the wide end.', times: 3 },
  { key: 'finger', title: 'One finger', hint: 'Touch the box three times with a fingertip.', times: 3 },
  { key: 'palm', title: 'Your palm', hint: 'Press your open palm on the box three times.', times: 3 },
  { key: 'many', title: 'As many fingers as you can', hint: 'Put both hands flat, all fingers down at once. Ask a friend to add theirs. Then lift.', times: 1 },
  { key: 'draw', title: 'Scribble fast', hint: 'Scribble in the box for a few seconds with the stylus or a finger, then lift.', times: 1 }
]

const middle = (list: number[]): number => { const s = [...list].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0 }
const round = (v: number): number => Math.round(v * 10) / 10

/** What the screen and the app can tell about this panel, without anyone touching it. */
export function screenFacts(): Record<string, string | number> {
  return {
    'Screen (as the app sees it)': `${window.screen.width} × ${window.screen.height}`,
    'Window': `${window.innerWidth} × ${window.innerHeight}`,
    'Windows display scale': `${Math.round((window.devicePixelRatio || 1) * 100)}%`,
    'Real pixels': `${Math.round(window.screen.width * (window.devicePixelRatio || 1))} × ${Math.round(window.screen.height * (window.devicePixelRatio || 1))}`,
    'Touch points reported': navigator.maxTouchPoints,
    'Processor threads': navigator.hardwareConcurrency,
    'Memory (GB, at least)': (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 'unknown',
    'System': navigator.userAgent.match(/Windows NT [\d.]+/)?.[0] ?? navigator.platform
  }
}

/** Plain text, so it can be read, mailed and pasted back into a chat. */
export function reportText(facts: Record<string, string | number>, seen: Record<string, Touch[]>, most: number, rate: number, frame: number, notes: string): string {
  const lines = ['Floating Whiteboard panel check', new Date().toString(), '', ...Object.entries(facts).map(([k, v]) => `${k}: ${v}`), '']
  for (const s of STEPS.slice(0, 4)) {
    const t = seen[s.key] ?? []
    lines.push(`${s.title}: ${t.length ? `type ${[...new Set(t.map(x => x.type))].join('/')}, contact ${round(middle(t.map(x => x.width)))} × ${round(middle(t.map(x => x.height)))}, pressure ${round(middle(t.map(x => x.pressure)))} (from ${t.length} touches)` : 'skipped'}`)
  }
  lines.push(`Most fingers at once: ${most}`, `Pen events per second while drawing: ${Math.round(rate)}`, `Screen updates per second while drawing: ${Math.round(frame)}`, '', `Notes: ${notes || 'none'}`)
  return lines.join('\n')
}

/** One day with a real board goes a long way if it leaves numbers behind: everything is written to a file to bring back. */
export function PanelCheck(): JSX.Element | null {
  const [step, setStep] = useState(0)
  const [seen, setSeen] = useState<Record<string, Touch[]>>({})
  const [most, setMost] = useState(0)
  const [rate, setRate] = useState(0)
  const [frame, setFrame] = useState(0)
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState('')
  const active = useRef(new Map<number, Touch>())
  const widest = useRef<Touch | null>(null)
  const draw = useRef({ events: 0, start: 0, frames: 0, running: false })
  useEffect(() => { if (panelCheckOn.value) { setStep(0); setSeen({}); setMost(0); setRate(0); setFrame(0); setSaved(''); setNotes('') } }, [panelCheckOn.value])
  if (!panelCheckOn.value) return null
  const close = (): void => { panelCheckOn.value = false }
  const current = STEPS[step]
  const count = current ? (seen[current.key]?.length ?? 0) : 0
  const next = (): void => { setStep(step + 1) }
  const sample = (e: PointerEvent): Touch => ({ type: e.pointerType, width: e.width, height: e.height, pressure: e.pressure })
  const down = (e: PointerEvent): void => {
    e.preventDefault()
    active.current.set(e.pointerId, sample(e))
    setMost(m => current.key === 'many' ? Math.max(m, active.current.size) : m)
    widest.current = sample(e)
    if (current.key === 'draw' && !draw.current.running) {
      draw.current = { events: 0, start: performance.now(), frames: 0, running: true }
      const tick = (): void => { if (draw.current.running) { draw.current.frames++; requestAnimationFrame(tick) } }
      requestAnimationFrame(tick)
    }
  }
  const move = (e: PointerEvent): void => {
    if (!active.current.has(e.pointerId)) return
    const s = sample(e), w = widest.current
    if (w && s.width * s.height > w.width * w.height) widest.current = s
    if (current.key === 'draw') draw.current.events += (e.getCoalescedEvents?.().length || 1)
  }
  const up = (e: PointerEvent): void => {
    active.current.delete(e.pointerId)
    if (active.current.size) return
    if (current.key === 'draw') {
      const d = draw.current, seconds = Math.max(.05, (performance.now() - d.start) / 1000)
      d.running = false
      setRate(d.events / seconds); setFrame(d.frames / seconds)
      next()
      return
    }
    if (current.key === 'many') return next()
    if (widest.current) {
      const list = [...(seen[current.key] ?? []), widest.current]
      setSeen({ ...seen, [current.key]: list })
      if (list.length >= current.times) next()
    }
  }
  const sizes = (key: string): number => { const t = seen[key] ?? []; return middle(t.map(x => Math.max(x.width, x.height))) }
  const limits = contactLimits(sizes('tip'), sizes('thick'), sizes('finger'))
  const palm = sizes('palm'), finger = sizes('finger')
  const facts = screenFacts()
  const report = reportText(facts, seen, most, rate, frame, notes)
  const save = async (): Promise<void> => {
    const path = await window.api.savePanelReport(report)
    setSaved(path ?? '')
    if (!path) showToast('Could not save the report')
  }
  const apply = (): void => {
    if (limits) { S.tipMax.value = limits.tipMax; S.thickMax.value = limits.thickMax }
    if (finger && palm > finger * 1.5) { S.palmSize.value = Math.round(Math.max(finger * 1.5, Math.sqrt(finger * palm))); S.palmErase.value = true }
    showToast('The board now uses these measurements')
  }
  return (
    <div class="chooser new-lesson ui panel-check" role="dialog" aria-modal="true" aria-labelledby="panel-title" data-popover-keep="">
      <div class="chooser-card panel new-lesson-card panel-check-card">
        <h1 id="panel-title">Panel check</h1>
        {current ? <>
          <p class="inputs-hint"><b>Step {step + 1} of {STEPS.length}: {current.title}.</b> {current.hint}</p>
          <div class="panel-pad nodrag" role="group" aria-label={current.title} onPointerDown={down as never} onPointerMove={move as never} onPointerUp={up as never} onPointerCancel={up as never}>
            {current.times > 1 ? <span>{count} of {current.times}</span> : current.key === 'many' ? <span>{most} at once</span> : <span>Scribble here</span>}
          </div>
          <div class="dialog-choices">
            <button type="button" class="dialog-btn nodrag" onClick={next}>Skip this step</button>
            <button type="button" class="dialog-btn nodrag" onClick={close}>Stop</button>
          </div>
        </> : <>
          <p class="inputs-hint">Done. Save this and bring the file back: it is what tunes the app for this board.</p>
          <pre class="panel-report">{report}</pre>
          <textarea class="read-answer panel-notes nodrag" aria-label="Your notes" placeholder="Anything you noticed: lag, wrong marks, buttons hard to reach…" value={notes} maxLength={4000} onInput={e => setNotes(e.currentTarget.value)} onKeyDown={e => e.stopPropagation()} />
          {saved && <p class="inputs-hint" role="status">Saved to <b>{saved}</b></p>}
          <div class="dialog-choices">
            <button type="button" class="dialog-btn primary nodrag" onClick={() => { void save() }}>Save the report</button>
            <button type="button" class="dialog-btn nodrag" disabled={!limits && !(finger && palm > finger * 1.5)} onClick={apply}>Use these on this board</button>
            <button type="button" class="dialog-btn nodrag" onClick={close}>Close</button>
          </div>
        </>}
      </div>
    </div>
  )
}
