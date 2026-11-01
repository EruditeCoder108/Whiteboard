import { Check, ChevronRight, EyeOff, RotateCcw } from './icons'
import type { JSX } from 'preact'
import { board } from '@/engine/instance'
import { MAX_STEP, stepLabel, stepsOf } from '@/engine/reveals'
import type { Item } from '@/engine/types'
import { S } from '@/state/store'
import { Switch } from './kit'

const NAMES = ['Question', 'Hint', 'Answer', 'Explanation']

/**
 * The teacher's control while teaching: one large button for the next step of this page. While
 * preparing it says that faded objects stay hidden in class, and how to finish.
 */
export function RevealBar(): JSX.Element | null {
  S.contentRevision.value; S.documentRevision.value; S.page.value; S.frameIndex.value
  if (S.editing.value) return null
  if (S.preparing.value) return (
    <div class="reveal-bar panel ui preparing" data-popover-keep="">
      <EyeOff size={20} />
      <span>Faded objects stay hidden in class until their step.</span>
      <button type="button" class="reveal-next nodrag" onClick={() => board.setPreparing(false)}><Check size={20} /> Done</button>
    </div>
  )
  const steps = board.revealSteps()
  if (!steps.length) return null
  const next = steps.find(s => s.hidden)
  const shown = steps.some(s => !s.hidden)
  return (
    <div class="reveal-bar panel ui" data-popover-keep="">
      {next && <button type="button" class="reveal-next nodrag" onClick={() => board.nextReveal()}>Next: {stepLabel(next)} <ChevronRight size={22} /></button>}
      {next && <small>{steps.filter(s => s.hidden).length} of {steps.length} to go</small>}
      {shown && <button type="button" class="reveal-again nodrag" onClick={() => board.hideReveals()}><RotateCcw size={17} /> Hide again</button>}
    </div>
  )
}

/** In the selection's panel: which step these objects wait for. */
export function RevealOptions({ items }: { items: Item[] }): JSX.Element {
  S.contentRevision.value
  const steps = stepsOf(board.doc.items)
  const here = items[0]?.step?.n
  const current = items.every(it => it.step?.n === here) ? here : undefined
  const fresh = Math.min(MAX_STEP, (steps.at(-1)?.n ?? 0) + 1)
  const covered = items.some(it => it.step?.cover)
  const assign = (n: number, name?: string, cover = covered): void => board.assignReveal(n, name, cover)
  return (
    <div class="reveal-options">
      <div class="style-row-label">Hide until</div>
      <div class="reveal-chips">
        {steps.map(s => <button type="button" key={s.n} class={`chip nodrag ${current === s.n ? 'on' : ''}`} onClick={() => assign(s.n)}>{stepLabel(s)}</button>)}
        {(!current || steps.length > 1 || fresh !== current) && <button type="button" class="chip nodrag" onClick={() => assign(fresh)}>{steps.length ? 'A new step' : 'Step 1'}</button>}
      </div>
      {current !== undefined && <>
        <div class="style-row-label">Call this step</div>
        <div class="reveal-chips">
          {NAMES.map(name => <button type="button" key={name} class={`chip nodrag ${steps.find(s => s.n === current)?.name === name ? 'on' : ''}`} onClick={() => assign(current, name)}>{name}</button>)}
        </div>
        <label class="reveal-cover"><Switch on={covered} onChange={on => assign(current, undefined, on)} /><span>Show a card to tap</span></label>
        <button type="button" class="reveal-remove nodrag" onClick={() => board.clearReveal()}>Do not hide</button>
      </>}
    </div>
  )
}
