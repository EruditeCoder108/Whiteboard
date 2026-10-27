import type { JSX } from 'preact'
import type { LabItem } from '@/engine/types'
import { board } from '@/engine/instance'
import { HEART_STAGES, isShowcase } from '@/engine/science/showcase-models'

export function ShowcaseGuide({ it }: { it: LabItem }): JSX.Element | null {
  if (!isShowcase(it.model)) return null
  const chemistry = it.model === 'indicator-studio', heart = it.model === 'heart-studio'
  const stops: [string, number][] = chemistry ? [['Start', 0], ['Acid added', 5.6], ['Reaction', 8.8], ['Result', 14]] : heart ? HEART_STAGES.map((label, i) => [label, [0.3, 0.5, 0.73, 0.95][i] * 60 / it.params.bpm]) : [['Approach', 0.6], ['In the coil', 1], ['Reverse', 2.6]]
  return <div class="science-showcase-guide">
    <span class="science-eyebrow">{it.model === 'flux-studio' ? 'TRY IT WITH YOUR HAND' : 'GUIDED LESSON STOPS'}</span>
    {it.model === 'flux-studio' ? <>
      <p>Grab the coloured magnet inside the frame. Move it through the coil, stop, then reverse. Your movement is saved as one undo step.</p>
      <p class="science-note">{it.gesture ? `${it.gesture.length} samples · ${it.gesture[it.gesture.length - 1].t.toFixed(2)} s recorded. Play replays your trace.` : 'An automatic sweep is ready to play. Dragging switches to your own movement.'}</p>
      {it.gesture && <button class="science-guide-reset" disabled={it.locked} onClick={() => board.editLab(it, { gesture: undefined, params: { ...it.params, motion: 0 }, frozenTime: 0 }, 'Return to automatic magnet sweep')}>Return to automatic sweep</button>}
    </> : <p>{chemistry ? 'Compare the acidic colour, the CO₂ bubbles and the final mixture. Change the amounts to leave acid or base in excess.' : 'Pause each stage. Follow the valve leaflets and the arrows; use Flow focus to isolate either circuit.'}</p>}
    {(it.model !== 'flux-studio' || it.params.motion === 0) && <div class="science-lesson-stops" aria-label="Lesson stops">{stops.map(([label, time]) => <button disabled={it.locked} onClick={() => board.seekLab(it, time)}>{label}</button>)}</div>}
    {heart && <p class="science-note">Right inlet: tricuspid. Left inlet: mitral. Outflow: pulmonary and aortic valves. The thick wall belongs to the left ventricle.</p>}
  </div>
}
