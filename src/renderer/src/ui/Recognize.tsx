import { signal } from '@preact/signals'
import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { board } from '@/engine/instance'
import { loadTypesetter, svgDataUrl } from '@/state/insert'
import { S } from '@/state/store'

export type ReadKind = 'text' | 'maths'
const reading = signal<{ kind: ReadKind; picture: string } | null>(null)

/** Asks what the selected writing says. Nothing changes on the board until the teacher has read the answer. */
export function readHandwriting(kind: ReadKind): void {
  const picture = board.selectionPicture()
  if (!picture) return
  reading.value = { kind, picture }
  S.popover.value = 'recognize'
}

export function RecognizeSheet(): JSX.Element | null {
  const job = reading.value
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [setup, setSetup] = useState(false)
  const [equation, setEquation] = useState<{ src: string; width: number; height: number } | null>(null)
  const asked = useRef('')
  const close = (): void => { window.api.agent.cancel(); S.popover.value = null; reading.value = null }
  useEffect(() => {
    if (!job || asked.current === job.picture) return
    asked.current = job.picture
    setBusy(true); setError(''); setAnswer(''); setSetup(false)
    void window.api.agent.config().then(config => {
      if (!config.model) { setSetup(true); setBusy(false); return }
      return window.api.agent.recognize(job.picture, job.kind).then(result => {
        setBusy(false)
        if (result.ok) setAnswer(result.text)
        else setError(result.error)
      })
    }).catch(() => { setBusy(false); setError('Could not reach the model. Check the connection and try again.') })
  }, [job?.picture])
  useEffect(() => {
    if (job?.kind !== 'maths' || !answer.trim()) { setEquation(null); return }
    let live = true
    void loadTypesetter().then(render => {
      if (!live) return
      try { const r = render(answer); setEquation({ src: svgDataUrl(r.svg), width: r.width, height: r.height }) } catch { setEquation(null) }
    })
    return () => { live = false }
  }, [answer, job?.kind])
  if (!job) return null
  const replace = (): void => {
    if (job.kind === 'maths') {
      if (equation) board.replaceInkWithEquation(equation.src, answer.trim(), equation.width, equation.height)
    } else board.replaceInkWithText(answer.trim())
    close()
  }
  const ready = job.kind === 'maths' ? !!equation : !!answer.trim()
  return (
    <div class="chooser new-lesson ui" role="dialog" aria-modal="true" aria-labelledby="read-title" data-popover-keep="" onKeyDown={e => { if (e.key === 'Escape') close() }}>
      <div class="chooser-card panel new-lesson-card read-card">
        <h1 id="read-title">{job.kind === 'maths' ? 'Handwriting to equation' : 'Handwriting to text'}</h1>
        <img class="read-picture" src={job.picture} alt="The selected writing" />
        {setup && <>
          <p class="inputs-hint">This needs an AI model, and it is optional. Connect one in Assistant, under Connection settings. The picture of this writing is sent to that model, and to nothing else.</p>
          <div class="dialog-choices">
            <button type="button" class="dialog-btn primary nodrag" onClick={() => { reading.value = null; S.popover.value = 'agent' }}>Open Assistant</button>
            <button type="button" class="dialog-btn nodrag" onClick={close}>Cancel</button>
          </div>
        </>}
        {!setup && <>
          {busy && <p class="inputs-hint" role="status">Reading the writing…</p>}
          {error && <p class="inputs-hint link-wrong" role="alert">{error}</p>}
          {!busy && !error && <>
            <p class="inputs-hint">Check it and correct anything wrong. It replaces the writing only when you say so.</p>
            <textarea class="read-answer nodrag" aria-label="What the writing says" value={answer} spellcheck={false} onInput={e => setAnswer(e.currentTarget.value)} onKeyDown={e => e.stopPropagation()} />
            {job.kind === 'maths' && (equation ? <img class="read-equation" src={equation.src} alt="The equation" /> : <p class="inputs-hint link-wrong">Correct the equation above: it cannot be drawn yet.</p>)}
          </>}
          <div class="dialog-choices">
            <button type="button" class="dialog-btn primary nodrag" disabled={busy || !ready} onClick={replace}>Replace the writing</button>
            <button type="button" class="dialog-btn nodrag" onClick={close}>Keep the writing</button>
          </div>
        </>}
      </div>
    </div>
  )
}
