import { Blinds, EyeOff, DraftingCompass, Gauge, LineChart, Pause, Play, RotateCcw, Ruler, Sigma, Spotlight, Timer, TriangleRight, X } from 'lucide-preact'
import { signal } from '@preact/signals'
import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { board } from '@/engine/instance'
import { instrumentsShown, type InstrumentKind } from '@/engine/instruments'
import { S } from '@/state/store'
import { editEquation, editGraph } from '@/state/insert'
import { Btn } from './kit'

export const spotlightOn = signal(false)
export const curtainOn = signal(false)
export const timerOn = signal(false)

function ToggleRow({ icon: Icon, label, hint, on, onClick }: { icon: typeof Ruler; label: string; hint?: string; on: boolean; onClick: () => void }): JSX.Element {
  return (
    <button type="button" class={`menu-item nodrag ${on ? 'on' : ''}`} aria-pressed={on} onClick={onClick}>
      <Icon size={15} strokeWidth={1.8} /><span>{label}</span>{hint && <em>{hint}</em>}
    </button>
  )
}

export function MathsPopover(): JSX.Element {
  const shown = instrumentsShown.value
  const row = (kind: InstrumentKind, icon: typeof Ruler, label: string, hint: string): JSX.Element =>
    <ToggleRow icon={icon} label={label} hint={hint} on={shown.includes(kind)} onClick={() => board.instruments.toggle(kind)} />
  return (
    <div class="popover panel ui maths" data-popover-keep="">
      <div class="pop-sub">Instruments</div>
      {row('ruler', Ruler, 'Ruler', 'draw along an edge')}
      {row('setsquare', TriangleRight, 'Set square', '90° and 45°')}
      {row('protractor', Gauge, 'Protractor', '0–180°')}
      {row('compass', DraftingCompass, 'Compass', 'drag the pencil')}
      <div class="pop-hint">Drag an instrument to move it and its round handle to rotate (Shift: 15° steps). Start a pen stroke on an edge to draw a straight line.</div>
      <div class="pop-sub">Insert</div>
      <ToggleRow icon={Sigma} label="Equation…" on={false} onClick={() => editEquation(null)} />
      <ToggleRow icon={LineChart} label="Graph of a function…" on={false} onClick={() => editGraph(null)} />
      <div class="pop-hint">Shape snapping: hold the pen still at the end of a stroke and a rough line, circle, rectangle or triangle becomes a clean one.</div>
    </div>
  )
}

export function PresentPopover(): JSX.Element {
  return (
    <div class="popover panel ui present" data-popover-keep="">
      <ToggleRow icon={Spotlight} label="Spotlight" hint="dims all but the pointer" on={spotlightOn.value} onClick={() => { spotlightOn.value = !spotlightOn.value; S.popover.value = null }} />
      <ToggleRow icon={EyeOff} label="Prepare reveals" hint="hide answers" on={S.preparing.value} onClick={() => { board.setPreparing(!S.preparing.value); S.popover.value = null }} />
      <ToggleRow icon={Blinds} label="Curtain" hint="drag to reveal" on={curtainOn.value} onClick={() => { curtainOn.value = !curtainOn.value; S.popover.value = null }} />
      <ToggleRow icon={Timer} label="Timer" on={timerOn.value} onClick={() => { timerOn.value = !timerOn.value; S.popover.value = null }} />
      <div class="pop-hint">Esc closes the spotlight and curtain. PgUp/PgDn (or a presentation clicker) turns pages.</div>
    </div>
  )
}

/** Dims everything except a circle around the pointer; drawing continues underneath. */
export function SpotlightLayer(): JSX.Element | null {
  const [at, setAt] = useState<[number, number]>([window.innerWidth / 2, window.innerHeight / 2])
  const [radius, setRadius] = useState(150)
  useEffect(() => {
    if (!spotlightOn.value) return
    const move = (e: PointerEvent): void => setAt([e.clientX, e.clientY])
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') spotlightOn.value = false }
    const wheel = (e: WheelEvent): void => { if (e.shiftKey) { e.preventDefault(); setRadius(r => Math.max(60, Math.min(500, r - Math.sign(e.deltaY) * 20))) } }
    window.addEventListener('pointermove', move, true); window.addEventListener('keydown', key); window.addEventListener('wheel', wheel, { passive: false, capture: true })
    return () => { window.removeEventListener('pointermove', move, true); window.removeEventListener('keydown', key); window.removeEventListener('wheel', wheel, true) }
  }, [spotlightOn.value])
  if (!spotlightOn.value) return null
  return <>
    <div class="spotlight" style={{ background: `radial-gradient(circle ${radius}px at ${at[0]}px ${at[1]}px, transparent 0, transparent 96%, rgba(8, 10, 18, .86) 100%)` }} />
    <div class="overlay-chip ui"><span>Spotlight · Shift+wheel to resize</span><Btn icon={X} title="Close spotlight (Esc)" size={14} onClick={() => (spotlightOn.value = false)} /></div>
  </>
}

/** A screen shade covering the board from the top; drag its edge to reveal step by step. */
export function CurtainLayer(): JSX.Element | null {
  const [cover, setCover] = useState(.85)
  const drag = useRef<number | null>(null)
  useEffect(() => {
    if (!curtainOn.value) return
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') curtainOn.value = false }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [curtainOn.value])
  if (!curtainOn.value) return null
  const onDown = (e: PointerEvent): void => { e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = e.clientY }
  const onMove = (e: PointerEvent): void => { if (drag.current !== null) setCover(Math.max(.04, Math.min(1, e.clientY / window.innerHeight))) }
  const onUp = (): void => { drag.current = null }
  return (
    <div class="curtain" style={{ height: `${cover * 100}%` }}>
      <div class="curtain-handle ui" onPointerDown={onDown as never} onPointerMove={onMove as never} onPointerUp={onUp} onPointerCancel={onUp}>
        <span>Drag to reveal</span>
        <Btn icon={X} title="Remove curtain (Esc)" size={14} onClick={() => (curtainOn.value = false)} />
      </div>
    </div>
  )
}

const PRESETS = [1, 2, 5, 10, 15]
let audio: AudioContext | null = null
function chime(): void {
  try {
    audio ??= new AudioContext()
    const now = audio.currentTime
    for (const [i, f] of [880, 1175, 1568].entries()) {
      const o = audio.createOscillator(), g = audio.createGain()
      o.frequency.value = f; o.connect(g); g.connect(audio.destination)
      g.gain.setValueAtTime(0, now + i * .18); g.gain.linearRampToValueAtTime(.18, now + i * .18 + .02); g.gain.exponentialRampToValueAtTime(.001, now + i * .18 + .5)
      o.start(now + i * .18); o.stop(now + i * .18 + .55)
    }
  } catch { /* audio unavailable */ }
}

/** Countdown (presets) or stopwatch; chimes and flashes when a countdown ends. */
export function TimerWidget(): JSX.Element | null {
  const [length, setLength] = useState(0) // seconds; 0 = stopwatch
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const started = useRef(0)
  useEffect(() => {
    if (!running) return
    started.current = performance.now() - elapsed * 1000
    const id = window.setInterval(() => {
      const e = (performance.now() - started.current) / 1000
      if (length && e >= length) { setElapsed(length); setRunning(false); chime(); return }
      setElapsed(e)
    }, 200)
    return () => window.clearInterval(id)
  }, [running, length])
  if (!timerOn.value) return null
  const shown = length ? Math.max(0, length - elapsed) : elapsed
  const done = length > 0 && elapsed >= length
  const text = `${Math.floor(shown / 60)}:${String(Math.floor(shown % 60)).padStart(2, '0')}`
  return (
    <div class={`timer panel ui ${done ? 'done' : ''}`} data-popover-keep="">
      <div class="timer-face" aria-live="polite">{text}</div>
      <div class="timer-row">
        <Btn icon={running ? Pause : Play} title={running ? 'Pause' : 'Start'} onClick={() => { if (done) setElapsed(0); setRunning(!running) }} />
        <Btn icon={RotateCcw} title="Reset" onClick={() => { setRunning(false); setElapsed(0) }} />
        <Btn icon={X} title="Close timer" onClick={() => { setRunning(false); timerOn.value = false }} />
      </div>
      <div class="timer-row presets">
        <button type="button" class={length === 0 ? 'on' : ''} onClick={() => { setRunning(false); setLength(0); setElapsed(0) }}>⏱</button>
        {PRESETS.map(m => <button type="button" key={m} class={length === m * 60 ? 'on' : ''} onClick={() => { setRunning(false); setLength(m * 60); setElapsed(0) }}>{m}m</button>)}
      </div>
    </div>
  )
}
