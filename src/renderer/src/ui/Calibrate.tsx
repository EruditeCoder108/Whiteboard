import { signal } from '@preact/signals'
import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import { contactSize } from '@/engine/input'
import { S, showToast } from '@/state/store'

export const calibrating = signal(false)

type Step = 'finger' | 'palm' | 'done' | 'unsupported' | 'same'

/** Two touches teach the board how big a finger and a palm look on this panel. */
export function PalmCalibration(): JSX.Element | null {
  const [step, setStep] = useState<Step>('finger')
  const [finger, setFinger] = useState(0)
  const [biggest, setBiggest] = useState(0)
  if (!calibrating.value) return null
  const close = (): void => { calibrating.value = false; setStep('finger'); setFinger(0); setBiggest(0) }
  const measure = (e: PointerEvent): void => { if (e.pointerType === 'touch') setBiggest(b => Math.max(b, contactSize(e))) }
  const lift = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') return
    const size = Math.max(biggest, contactSize(e))
    setBiggest(0)
    if (step === 'finger') {
      if (!size) return setStep('unsupported')
      setFinger(size); setStep('palm')
    } else if (step === 'palm') {
      if (size < finger * 1.5) return setStep('same')
      S.palmSize.value = Math.round(Math.max(finger * 1.5, Math.sqrt(finger * size)))
      S.palmErase.value = true
      setStep('done')
    }
  }
  const text: Record<Step, [string, string]> = {
    finger: ['Touch the circle with one finger', 'Hold it for a moment, then lift.'],
    palm: ['Now press your palm flat on the board', 'Anywhere is fine. Lift when done.'],
    done: ['Palm erase is ready', `Wipe with your palm to erase. A touch wider than ${S.palmSize.value}px counts as a palm.`],
    unsupported: ['This screen does not report touch size', 'Palm erase cannot tell a palm from a finger here. Use the Eraser button instead.'],
    same: ['Palm and finger looked the same size', 'Try again with your whole palm flat on the board.']
  }
  const [title, hint] = text[step]
  const finished = step === 'done' || step === 'unsupported'
  return (
    <div class="calibrate ui" role="dialog" aria-modal="true" aria-label="Palm erase calibration"
      onPointerDown={measure as never} onPointerMove={measure as never} onPointerUp={lift as never}>
      <div class="calibrate-card panel">
        <h2>{title}</h2>
        <p>{hint}</p>
        <div class="row-end">
          <button type="button" class="nodrag" onClick={close}>{finished ? 'Close' : 'Cancel'}</button>
          {step === 'same' && <button type="button" class="primary-btn nodrag" onClick={() => setStep('palm')}>Try again</button>}
          {finished && <button type="button" class="primary-btn nodrag" onClick={() => { close(); if (step === 'done') showToast('Palm erase calibrated') }}>Done</button>}
        </div>
      </div>
      {step === 'finger' && <div class="calibrate-target" aria-hidden="true" />}
    </div>
  )
}
