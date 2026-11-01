import { signal } from '@preact/signals'
import { GripHorizontal, Minus, Plus, RotateCcw, X } from './icons'
import type { ComponentChildren, JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { PIPS, clockHands, parseNames, pickFrom, rollDice, rollNumbers } from '@/engine/classroom'
import { board } from '@/engine/instance'
import { S } from '@/state/store'
import { Segmented, Switch } from './kit'

export const magnifierOn = signal(false)
export const clockOn = signal(false)
export const pickerOn = signal(false)
export const diceOn = signal(false)
export const scoreOn = signal(false)

/** A panel on the board that can be dragged out of the way and closed, in reach of a finger. */
function Floating({ name, on, start, children, wide }: { name: string; on: { value: boolean }; start: [number, number]; children: ComponentChildren; wide?: boolean }): JSX.Element {
  const [at, setAt] = useState(start)
  const grip = useRef<[number, number] | null>(null)
  return (
    <div class={`class-tool panel ui ${wide ? 'wide' : ''}`} data-popover-keep="" role="group" aria-label={name} style={{ left: `${at[0]}px`, top: `${at[1]}px` }}>
      <div class="class-tool-head">
        <button type="button" class="class-tool-grip nodrag" aria-label={`Move the ${name.toLowerCase()}`} style={{ touchAction: 'none' }}
          onPointerDown={e => { const box = (e.currentTarget.closest('.class-tool') as HTMLElement).getBoundingClientRect(); grip.current = [e.clientX - box.left, e.clientY - box.top]; e.currentTarget.setPointerCapture(e.pointerId) }}
          onPointerMove={e => { if (grip.current) setAt([Math.max(0, Math.min(window.innerWidth - 80, e.clientX - grip.current[0])), Math.max(0, Math.min(window.innerHeight - 60, e.clientY - grip.current[1]))]) }}
          onPointerUp={() => (grip.current = null)} onPointerCancel={() => (grip.current = null)}><GripHorizontal size={20} /><span>{name}</span></button>
        <button type="button" class="class-tool-close nodrag" aria-label={`Close the ${name.toLowerCase()}`} onClick={() => (on.value = false)}><X size={20} /></button>
      </div>
      {children}
    </div>
  )
}

// ── magnifier ─────────────────────────────────────────────────────────────────
const LENS = 340

/** A round lens that shows the board larger, redrawn rather than stretched, so writing stays sharp. */
export function Magnifier(): JSX.Element | null {
  const [at, setAt] = useState<[number, number]>([window.innerWidth / 2 - LENS / 2, 120])
  const [scale, setScale] = useState(2)
  const cv = useRef<HTMLCanvasElement>(null)
  const drag = useRef<[number, number] | null>(null)
  const revision = S.contentRevision.value + S.viewRevision.value + S.documentRevision.value
  useEffect(() => {
    if (!magnifierOn.value || !cv.current) return
    board.paintLens(cv.current, at[0] + LENS / 2, at[1] + LENS / 2, scale)
  }, [at[0], at[1], scale, revision, magnifierOn.value])
  if (!magnifierOn.value) return null
  return (
    <div class="lens ui" data-popover-keep="" style={{ left: `${at[0]}px`, top: `${at[1]}px` }} role="group" aria-label="Magnifier">
      <canvas ref={cv} class="lens-glass nodrag" width={LENS} height={LENS} aria-label="Drag the magnifier" style={{ touchAction: 'none' }}
        onPointerDown={e => { drag.current = [e.clientX - at[0], e.clientY - at[1]]; e.currentTarget.setPointerCapture(e.pointerId) }}
        onPointerMove={e => { if (drag.current) setAt([e.clientX - drag.current[0], e.clientY - drag.current[1]]) }}
        onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)} />
      <div class="lens-controls panel">
        {[2, 3, 4].map(k => <button type="button" key={k} class={`chip nodrag ${scale === k ? 'on' : ''}`} aria-pressed={scale === k} onClick={() => setScale(k)}>{k}×</button>)}
        <button type="button" class="chip nodrag" aria-label="Close the magnifier" onClick={() => (magnifierOn.value = false)}><X size={18} /></button>
      </div>
    </div>
  )
}

// ── clock ─────────────────────────────────────────────────────────────────────
export function ClockWidget(): JSX.Element | null {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!clockOn.value) return
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [clockOn.value])
  if (!clockOn.value) return null
  const { hour, minute, second } = clockHands(now.getHours(), now.getMinutes(), now.getSeconds())
  return (
    <Floating name="Clock" on={clockOn} start={[window.innerWidth - 300, 40]}>
      <svg class="clock-face" viewBox="-100 -100 200 200" role="img" aria-label={now.toLocaleTimeString()}>
        <circle r="96" class="clock-rim" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = i * Math.PI / 6
          return <text key={i} x={78 * Math.sin(a)} y={-78 * Math.cos(a)} class="clock-num" text-anchor="middle" dominant-baseline="central">{i || 12}</text>
        })}
        <line y2="-46" class="clock-hour" transform={`rotate(${hour})`} />
        <line y2="-66" class="clock-minute" transform={`rotate(${minute})`} />
        <line y1="12" y2="-72" class="clock-second" transform={`rotate(${second})`} />
        <circle r="5" class="clock-pin" />
      </svg>
      <div class="clock-digital">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      <div class="clock-date">{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </Floating>
  )
}

// ── name picker ───────────────────────────────────────────────────────────────
export function NamePicker(): JSX.Element | null {
  const [mode, setMode] = useState<'numbers' | 'names'>(S.pickerNames.value ? 'names' : 'numbers')
  const [shown, setShown] = useState<string | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [used, setUsed] = useState<string[]>([])
  const [fresh, setFresh] = useState(true)
  const timer = useRef(0)
  useEffect(() => () => window.clearInterval(timer.current), [])
  if (!pickerOn.value) return null
  const all = mode === 'names' ? parseNames(S.pickerNames.value) : rollNumbers(1, S.pickerMax.value)
  const pick = (): void => {
    if (spinning || !all.length) return
    const { pick: chosen, used: next } = pickFrom(all, used, fresh)
    setSpinning(true)
    let turns = 0
    window.clearInterval(timer.current)
    timer.current = window.setInterval(() => {
      // A quick shuffle first, so the class watches it land.
      if (++turns < 12) { setShown(all[Math.floor(Math.random() * all.length)]); return }
      window.clearInterval(timer.current)
      setShown(chosen); setUsed(next); setSpinning(false)
    }, 60)
  }
  const left = fresh ? Math.max(0, all.length - used.length) : all.length
  return (
    <Floating name="Name picker" on={pickerOn} start={[60, 60]} wide>
      <Segmented options={[{ value: 'numbers', label: 'Roll numbers' }, { value: 'names', label: 'Names' }]} value={mode} onChange={m => { setMode(m); setUsed([]); setShown(null) }} />
      {mode === 'numbers'
        ? <div class="picker-row"><span>Roll numbers 1 to</span>
            <button type="button" class="scale-bump nodrag" aria-label="Fewer" onClick={() => { S.pickerMax.value = Math.max(2, S.pickerMax.value - 1); setUsed([]) }}><Minus size={20} /></button>
            <b>{S.pickerMax.value}</b>
            <button type="button" class="scale-bump nodrag" aria-label="More" onClick={() => { S.pickerMax.value = Math.min(200, S.pickerMax.value + 1); setUsed([]) }}><Plus size={20} /></button></div>
        : <textarea class="picker-names nodrag" aria-label="Names, one on each line" placeholder={'Asha\nRavi\nMeena'} maxLength={20000} value={S.pickerNames.value}
            onInput={e => { S.pickerNames.value = e.currentTarget.value; setUsed([]) }} onKeyDown={e => e.stopPropagation()} />}
      <output class={`picker-result ${spinning ? 'spinning' : ''}`} aria-live="polite">{shown ?? '?'}</output>
      <button type="button" class="dialog-btn primary nodrag" disabled={!all.length || spinning} onClick={pick}>Pick</button>
      <label class="picker-row"><Switch on={fresh} onChange={v => { setFresh(v); setUsed([]) }} /><span>Everyone gets a turn{fresh ? ` · ${left} left` : ''}</span></label>
      {used.length > 0 && <button type="button" class="chip nodrag" onClick={() => { setUsed([]); setShown(null) }}><RotateCcw size={14} /> Start again</button>}
    </Floating>
  )
}

// ── dice ──────────────────────────────────────────────────────────────────────
function Die({ value, rolling }: { value: number; rolling: boolean }): JSX.Element {
  return (
    <svg class={`die ${rolling ? 'rolling' : ''}`} viewBox="0 0 100 100" role="img" aria-label={String(value)}>
      <rect x="4" y="4" width="92" height="92" rx="18" class="die-body" />
      {PIPS[value].map(([r, c]) => <circle key={`${r}${c}`} cx={24 + c * 26} cy={24 + r * 26} r="9.5" class="die-pip" />)}
    </svg>
  )
}

export function DiceWidget(): JSX.Element | null {
  const [count, setCount] = useState(1)
  const [values, setValues] = useState([6])
  const [rolling, setRolling] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => window.clearInterval(timer.current), [])
  if (!diceOn.value) return null
  const roll = (n = count): void => {
    if (rolling) return
    setRolling(true)
    let turns = 0
    window.clearInterval(timer.current)
    timer.current = window.setInterval(() => {
      setValues(rollDice(n))
      if (++turns >= 9) { window.clearInterval(timer.current); setRolling(false) }
    }, 70)
  }
  return (
    <Floating name="Dice" on={diceOn} start={[60, 420]}>
      <div class="dice-row">{values.map((v, i) => <Die key={i} value={v} rolling={rolling} />)}</div>
      {count > 1 && <div class="dice-total">Total {values.reduce((a, b) => a + b, 0)}</div>}
      <Segmented options={[{ value: '1', label: 'One' }, { value: '2', label: 'Two' }, { value: '3', label: 'Three' }]} value={String(count)} onChange={v => { const n = Number(v); setCount(n); setValues(rollDice(n)) }} />
      <button type="button" class="dialog-btn primary nodrag" disabled={rolling} onClick={() => roll()}>Roll</button>
    </Floating>
  )
}

// ── scoreboard ────────────────────────────────────────────────────────────────
const TEAM_COLOURS = ['#2f6bff', '#e5484d', '#2fa66a', '#8a4fff', '#f28c28', '#db2777']

export function Scoreboard(): JSX.Element | null {
  const [teams, setTeams] = useState([{ name: 'Team 1', score: 0 }, { name: 'Team 2', score: 0 }])
  if (!scoreOn.value) return null
  const top = Math.max(...teams.map(t => t.score))
  const change = (i: number, patch: Partial<{ name: string; score: number }>): void => setTeams(teams.map((t, k) => k === i ? { ...t, ...patch } : t))
  return (
    <Floating name="Scoreboard" on={scoreOn} start={[window.innerWidth / 2 - 240, 40]} wide>
      <div class="score-teams">
        {teams.map((t, i) => (
          <div key={i} class={`score-team ${top > 0 && t.score === top ? 'lead' : ''}`} style={{ '--team': TEAM_COLOURS[i] } as never}>
            <input class="score-name nodrag" aria-label={`Team ${i + 1} name`} value={t.name} maxLength={24} onInput={e => change(i, { name: e.currentTarget.value })} onKeyDown={e => e.stopPropagation()} />
            <output class="score-value" aria-live="polite">{t.score}</output>
            <div class="score-buttons">
              <button type="button" class="nodrag" aria-label={`Take a point from ${t.name}`} onClick={() => change(i, { score: Math.max(0, t.score - 1) })}><Minus size={22} /></button>
              <button type="button" class="nodrag plus" aria-label={`Add a point to ${t.name}`} onClick={() => change(i, { score: t.score + 1 })}><Plus size={22} /></button>
            </div>
          </div>
        ))}
      </div>
      <div class="picker-row">
        {teams.length < 6 && <button type="button" class="chip nodrag" onClick={() => setTeams([...teams, { name: `Team ${teams.length + 1}`, score: 0 }])}><Plus size={14} /> Add a team</button>}
        {teams.length > 2 && <button type="button" class="chip nodrag" onClick={() => setTeams(teams.slice(0, -1))}><Minus size={14} /> Remove a team</button>}
        <button type="button" class="chip nodrag" onClick={() => setTeams(teams.map(t => ({ ...t, score: 0 })))}><RotateCcw size={14} /> Reset</button>
      </div>
    </Floating>
  )
}
