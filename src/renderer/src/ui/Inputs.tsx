import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import { contactSize } from '@/engine/input'
import { contactLimits } from '@/engine/roles'
import type { InputKind, InputRole } from '@/engine/roles'
import { PALETTE, S, showToast } from '@/state/store'
import { Segmented, Swatch } from './kit'

const ROLE_OPTIONS: { value: InputRole; label: string }[] = [
  { value: 'same', label: 'Toolbar' }, { value: 'pen', label: 'Pen' }, { value: 'marker', label: 'Highlight' }, { value: 'eraser', label: 'Eraser' }, { value: 'move', label: 'Move' }
]

const INPUTS: { kind: InputKind; name: string; hint: string }[] = [
  { kind: 'tip', name: 'Thin tip', hint: 'The fine end of the stylus' },
  { kind: 'thick', name: 'Thick end', hint: 'The wide end of the stylus' },
  { kind: 'finger', name: 'Finger', hint: 'Your fingertip' }
]

const role = { tip: S.tipRole, thick: S.thickRole, finger: S.fingerRole }
const ink = { tip: S.tipInk, thick: S.thickInk, finger: S.fingerInk }

/** Touch each end in turn; the board learns how big they look on this panel. */
function Measure({ onDone }: { onDone: () => void }): JSX.Element {
  const [sizes, setSizes] = useState<number[]>([])
  const [widest, setWidest] = useState(0)
  const [error, setError] = useState('')
  const measure = (e: PointerEvent): void => { if (e.pointerType === 'touch') setWidest(w => Math.max(w, contactSize(e))) }
  const lift = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') return setError('This was not a touch: a real stylus is told apart by itself and needs no measuring.')
    const size = Math.max(widest, contactSize(e))
    setWidest(0)
    if (!size) return setError('This screen does not report how big a touch is, so the two ends of a stylus cannot be told apart here.')
    const next = [...sizes, size]
    if (next.length < 3) { setError(''); setSizes(next); return }
    const limits = contactLimits(next[0], next[1], next[2])
    if (!limits) { setSizes([]); setError('Those looked too alike. Try again, pressing each one the way you write with it.'); return }
    S.tipMax.value = limits.tipMax
    S.thickMax.value = limits.thickMax
    showToast('The board now knows your stylus')
    onDone()
  }
  return (
    <div class="input-measure" role="group" aria-label="Measure the stylus" onPointerDown={measure as never} onPointerMove={measure as never} onPointerUp={lift as never}>
      <b>{`Touch here with the ${INPUTS[sizes.length].name.toLowerCase()}`}</b>
      <span>{error || `Step ${sizes.length + 1} of 3: ${INPUTS[sizes.length].hint.toLowerCase()}. Hold it for a moment, then lift.`}</span>
    </div>
  )
}

/** Which tool and colour each input writes with. */
export function InputsSheet(): JSX.Element {
  const [measuring, setMeasuring] = useState(false)
  const close = (): void => { S.popover.value = null }
  const known = S.tipMax.value > 0
  return (
    <div class="chooser new-lesson ui" role="dialog" aria-modal="true" aria-labelledby="inputs-title" data-popover-keep="" onKeyDown={e => { if (e.key === 'Escape') close() }}>
      <div class="chooser-card panel new-lesson-card inputs-card">
        <h1 id="inputs-title">Pen and finger</h1>
        <p class="inputs-hint">Give each one its own tool and colour, so turning the stylus around changes colour. This applies while the pen, highlighter or eraser is in use. <b>Toolbar</b> means it follows the toolbar.</p>
        {INPUTS.map(({ kind, name, hint }) => {
          const r = role[kind].value
          const off = kind !== 'finger' && kind !== 'tip' && !known
          return (
            <div class={`input-row ${off ? 'off' : ''}`} key={kind}>
              <div class="input-name"><b>{name}</b><span>{hint}</span></div>
              <Segmented options={ROLE_OPTIONS} value={r} onChange={v => { role[kind].value = v }} />
              {(r === 'pen' || r === 'marker') && (
                <div class="swatches" role="group" aria-label={`${name} colour`}>
                  {PALETTE.map(c => <Swatch key={c} color={c} selected={ink[kind].value.toLowerCase() === c} onClick={() => { ink[kind].value = c }} />)}
                </div>
              )}
            </div>
          )
        })}
        {measuring
          ? <Measure onDone={() => setMeasuring(false)} />
          : <p class="inputs-hint">{known ? 'The board has measured your stylus.' : 'On most smart boards a stylus looks like a touch. To tell its two ends from a finger, the board has to measure them once.'}</p>}
        <div class="dialog-choices">
          {!measuring && <button type="button" class="dialog-btn nodrag" onClick={() => setMeasuring(true)}>{known ? 'Measure again' : 'Measure my stylus'}</button>}
          {measuring && <button type="button" class="dialog-btn nodrag" onClick={() => setMeasuring(false)}>Stop measuring</button>}
          <button type="button" class="dialog-btn primary nodrag" onClick={close}>Done</button>
        </div>
      </div>
    </div>
  )
}
