import { Minus, Plus } from 'lucide-preact'
import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { board } from '@/engine/instance'
import { MAX_NAME, paintScale, parseAxis, parseStep, scaleBox, snapAt, togglePoint } from '@/engine/scale'
import type { AxisDraft } from '@/engine/scale'
import type { ScaleAxis, ScaleItem } from '@/engine/types'
import { scaleKind, scaleTarget } from '@/state/insert'
import { S, currentColor } from '@/state/store'
import { Segmented, Switch } from './kit'

type Kind = 'line' | 'axes'
const text = (a: ScaleAxis): AxisDraft => ({
  min: String(a.min), max: String(a.max), step: a.den && Math.abs(a.step * a.den - Math.round(a.step * a.den)) < 1e-9 ? `${Math.round(a.step * a.den)}/${a.den}` : String(a.step), name: a.name ?? ''
})

const number = (s: string): number => Number(s.replace('\u2212', '-').trim() || NaN)

const axis = (min: number, max: number, step: number, more: Partial<ScaleAxis> = {}): ScaleAxis => ({ min, max, step, ...more })
const PRESETS: Record<Kind, { label: string; x: ScaleAxis; y?: ScaleAxis; equal?: boolean; grid?: boolean }[]> = {
  line: [
    { label: '0 to 10', x: axis(0, 10, 1) },
    { label: '−10 to 10', x: axis(-10, 10, 1) },
    { label: '0 to 100 by 10', x: axis(0, 100, 10) },
    { label: 'Quarters, 0 to 2', x: axis(0, 2, .25, { den: 4 }) },
    { label: 'Tenths, 0 to 1', x: axis(0, 1, .1) }
  ],
  axes: [
    { label: '−10 to 10', x: axis(-10, 10, 1), y: axis(-10, 10, 1), equal: true, grid: true },
    { label: '−5 to 5', x: axis(-5, 5, 1), y: axis(-5, 5, 1), equal: true, grid: true },
    { label: 'First quadrant', x: axis(0, 10, 1), y: axis(0, 10, 1), equal: true, grid: true },
    { label: 'Time and distance', x: axis(0, 60, 10, { name: 'Time (s)' }), y: axis(0, 100, 20, { name: 'Distance (m)' }), equal: false, grid: true }
  ]
}

function Bound({ label, value, step, onChange }: { label: string; value: string; step: number; onChange: (v: string) => void }): JSX.Element {
  const bump = (by: number): void => { const n = number(value); if (Number.isFinite(n)) onChange(String(Number((n + by).toFixed(6)))) }
  return (
    <div class="scale-bound">
      <span>{label}</span>
      <button type="button" class="scale-bump nodrag" aria-label={`${label}: less`} onClick={() => bump(-step)}><Minus size={20} /></button>
      <input class="nodrag" type="text" inputMode="decimal" aria-label={label} value={value} onInput={e => onChange((e.target as HTMLInputElement).value)} onKeyDown={e => e.stopPropagation()} />
      <button type="button" class="scale-bump nodrag" aria-label={`${label}: more`} onClick={() => bump(step)}><Plus size={20} /></button>
    </div>
  )
}

const STEPS = ['1', '2', '5', '10', '1/2', '1/4', '0.1']

function AxisFields({ title, value, onChange, nameHint }: { title?: string; value: AxisDraft; onChange: (a: AxisDraft) => void; nameHint: string }): JSX.Element {
  const step = parseStep(value.step)?.step ?? 1
  const set = (patch: Partial<AxisDraft>): void => onChange({ ...value, ...patch })
  return (
    <fieldset class="scale-axis">
      {title && <legend>{title}</legend>}
      <div class="scale-bounds">
        <Bound label="From" value={value.min} step={step} onChange={min => set({ min })} />
        <Bound label="To" value={value.max} step={step} onChange={max => set({ max })} />
      </div>
      <div class="scale-steps">
        <span>Step</span>
        {STEPS.map(s => <button type="button" key={s} class={`chip nodrag ${value.step.trim() === s ? 'on' : ''}`} onClick={() => set({ step: s })}>{s}</button>)}
        <input class="nodrag" type="text" aria-label={`${title ?? ''} step`.trim()} value={value.step} onInput={e => set({ step: (e.target as HTMLInputElement).value })} onKeyDown={e => e.stopPropagation()} />
      </div>
      <input class="nodrag scale-name" type="text" maxLength={MAX_NAME} placeholder={nameHint} aria-label={`${title ?? 'Line'} name and unit`} value={value.name}
        onInput={e => set({ name: (e.target as HTMLInputElement).value })} onKeyDown={e => e.stopPropagation()} />
    </fieldset>
  )
}

const PREVIEW_W = 520, PREVIEW_H = 330

/** Choose a range, a step and a name; tap the picture to mark points exactly on the scale. */
export function ScaleEditor(): JSX.Element {
  const target = scaleTarget.value
  const [kind, setKind] = useState<Kind>(target ? target.y ? 'axes' : 'line' : scaleKind.value)
  const first = PRESETS[kind][0]
  const [x, setX] = useState<AxisDraft>(text(target?.x ?? first.x))
  const [y, setY] = useState<AxisDraft>(text(target?.y ?? PRESETS.axes[0].y!))
  const [equal, setEqual] = useState(target ? !!target.equal : true)
  const [grid, setGrid] = useState(target ? !!target.grid : true)
  const [coords, setCoords] = useState(!!target?.coords)
  const [points, setPoints] = useState<[number, number][]>(target?.points ?? [])
  const cv = useRef<HTMLCanvasElement>(null)

  const px = parseAxis(x), py = kind === 'axes' ? parseAxis(y) : null
  const problem = 'problem' in px ? px.problem : py && 'problem' in py ? py.problem : ''
  const inRange = (a: ScaleAxis, v: number): boolean => v >= a.min - 1e-9 && v <= a.max + 1e-9
  const xAxis = 'axis' in px ? px.axis : null, yAxis = py && 'axis' in py ? py.axis : undefined
  /** Marks outside a new range are not shown or kept, and come back if the range does before saving. */
  const kept = xAxis && !problem ? points.filter(p => inRange(xAxis, p[0]) && (kind === 'line' ? p[1] === 0 : !!yAxis && inRange(yAxis, p[1]))) : []
  const fields = xAxis && !problem ? { x: xAxis, ...(yAxis ? { y: yAxis, equal, grid } : {}), coords, ...(kept.length ? { points: kept } : {}) } : null
  const color = target?.c ?? currentColor.value
  const draft: ScaleItem | null = fields && {
    t: 'n', id: 'preview', c: color, w: 2,
    p: yAxis ? [16, 16, PREVIEW_W - 16, PREVIEW_H - 16] : [16, PREVIEW_H / 2 - 70, PREVIEW_W - 16, PREVIEW_H / 2 + 70], ...fields
  }

  useEffect(() => {
    const c = cv.current, ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const dpr = window.devicePixelRatio || 1
    c.width = PREVIEW_W * dpr; c.height = PREVIEW_H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = S.bgColor.value
    ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H)
    if (draft) paintScale(ctx, draft)
  })

  const tap = (e: PointerEvent): void => {
    if (!draft) return
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPoints(togglePoint(kept, snapAt(draft, (e.clientX - r.left) * PREVIEW_W / r.width, (e.clientY - r.top) * PREVIEW_H / r.height)))
  }
  const preset = (i: number): void => {
    const pr = PRESETS[kind][i]
    setX(text(pr.x))
    if (pr.y) setY(text(pr.y))
    setEqual(pr.equal ?? true); setGrid(pr.grid ?? true); setPoints([])
  }
  const changeKind = (k: Kind): void => {
    setKind(k)
    if (!target) { const pr = PRESETS[k][0]; setX(text(pr.x)); if (pr.y) setY(text(pr.y)); setPoints([]) }
  }
  const close = (): void => { S.popover.value = null }
  const apply = (): void => {
    if (!fields) return
    const r = board.visibleRect()
    if (target) {
      // The object keeps its middle; its shape follows the new ranges when one unit must stay true.
      const [cx, cy] = [(target.p[0] + target.p[2]) / 2, (target.p[1] + target.p[3]) / 2]
      // Marking a point or changing a name leaves the size the teacher gave it alone.
      const sameRange = (a?: ScaleAxis, b?: ScaleAxis): boolean => a?.min === b?.min && a?.max === b?.max
      const unchanged = sameRange(target.x, fields.x) && sameRange(target.y, yAxis) && !!target.equal === (!!yAxis && equal)
      const p = unchanged || (!!target.y === !!yAxis && !(yAxis && equal)) ? target.p : scaleBox(fields.x, yAxis, equal, cx, cy, r[2] - r[0], r[3] - r[1])
      board.updateScale(target, { ...fields, y: yAxis, equal: yAxis ? equal : undefined, grid: yAxis ? grid : undefined, points: kept.length ? kept : undefined, p })
    } else {
      board.insertScale({ c: color, p: scaleBox(fields.x, yAxis, equal, (r[0] + r[2]) / 2, (r[1] + r[3]) / 2 - (r[3] - r[1]) * .04, r[2] - r[0], r[3] - r[1]), ...fields }) // a little high: the toolbar sits below
    }
    close()
  }
  return (
    <div class="chooser ui scale-sheet" role="dialog" aria-modal="true" aria-labelledby="scale-title" data-popover-keep="" onKeyDown={e => { if (e.key === 'Escape') close() }}>
      <div class="chooser-card panel scale-card">
        <h1 id="scale-title">{target ? 'Change the scale' : kind === 'axes' ? 'Coordinate axes' : 'Number line'}</h1>
        <div class="scale-body">
          <div class="scale-left">
            <canvas ref={cv} class="scale-preview nodrag" role="img" aria-label="Preview. Tap to mark a point; tap it again to remove it." onPointerUp={tap as never} />
            <small>Tap the picture to mark a point. Tap it again to take it away.</small>
            <div class="scale-switches">
              <label><Switch on={coords} onChange={setCoords} /><span>{kind === 'axes' ? 'Show coordinates' : 'Show values'}</span></label>
              {kind === 'axes' && <label><Switch on={grid} onChange={setGrid} /><span>Grid</span></label>}
              {kind === 'axes' && <label><Switch on={equal} onChange={setEqual} /><span>Same scale both ways</span></label>}
            </div>
          </div>
          <div class="scale-right">
            <Segmented<Kind> options={[{ value: 'line', label: 'Number line' }, { value: 'axes', label: 'Axes' }]} value={kind} onChange={changeKind} />
            <div class="chip-row scale-presets">{PRESETS[kind].map((pr, i) => <button type="button" key={pr.label} class="chip nodrag" onClick={() => preset(i)}>{pr.label}</button>)}</div>
            <AxisFields title={kind === 'axes' ? 'x axis' : undefined} value={x} onChange={setX} nameHint={kind === 'axes' ? 'Name and unit, like “Time (s)”' : 'Name or unit (optional)'} />
            {kind === 'axes' && <AxisFields title="y axis" value={y} onChange={setY} nameHint="Name and unit, like “Distance (m)”" />}
            {problem && <p class="scale-problem" role="alert">{problem}</p>}
          </div>
        </div>
        <div class="dialog-choices scale-actions">
          <button type="button" class="dialog-btn primary nodrag" disabled={!fields} onClick={apply}>{target ? 'Update' : 'Put on the board'}</button>
          <button type="button" class="dialog-btn nodrag" onClick={close}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
