import { FlaskConical, X, Pencil, Scan, Copy, Download } from 'lucide-preact'
import type { JSX } from 'preact'
import type { LabItem } from '@/engine/types'
import { board } from '@/engine/instance'
import { EXPLORE_REVEAL, EXPLAIN_REVEAL, getModel } from '@/engine/science/models'
import { supportedLab } from '@/engine/science/runtime'
import { scienceInspector } from '@/state/science'
import { actions } from '@/state/actions'
import { Btn } from '../kit'
import { Parameter } from './Science'
import { ShowcaseGuide } from './ShowcaseGuide'

export function LearningView({ it }: { it: LabItem }): JSX.Element {
  return <div class="science-learning-view" role="group" aria-label="Explanation depth">{[['Explore', EXPLORE_REVEAL], ['Explain', EXPLAIN_REVEAL]].map(([label, reveal]) => <button aria-pressed={JSON.stringify(it.reveal) === JSON.stringify(reveal)} disabled={it.locked} onClick={() => board.editLab(it, { reveal: { ...(reveal as typeof EXPLORE_REVEAL) } }, `${label} view`)}>{label as string}</button>)}</div>
}
export function ExperimentInspector({ it }: { it: LabItem }): JSX.Element {
  const m = getModel(it.model), supported = supportedLab(it)
  return <aside class="science-inspector panel ui nodrag" data-testid="science-inspector" data-popover-keep="" aria-label={`${m?.title ?? 'Lab'} inspector`}>
    <div class="science-heading"><span><FlaskConical size={17}/>{m?.title ?? 'Saved lab'}</span><Btn icon={X} title="Hide lab inspector" onClick={() => scienceInspector.value = false}/></div>
    <div class="science-inspector-body">{supported && m ? <>
      <LearningView it={it}/><p class="science-question">{m.question}</p>
      <ShowcaseGuide it={it}/>
      {it.locked && <p class="science-note">Locked. Use the selection toolbar to unlock.</p>}
      {Object.keys(m.params).filter(key => (it.model !== 'oscillations' || !(['angle', 'length'].includes(key) && it.params.kind === 1 || ['amplitude', 'stiffness'].includes(key) && it.params.kind === 0)) && (it.model !== 'flux-studio' || !(key === 'period' && it.params.motion === 1 || key === 'position' && (it.params.motion === 0 || !!it.gesture)))).map(name => <Parameter key={name} it={it} name={name}/>)}
      <details><summary>Reveal & explain</summary><div class="science-reveals">{([['vectors', 'Labels & guides'], ...(m.graph ? [['graphs', 'Live graph']] : []), ...(it.model === 'oscillations' ? [['energy', 'Energy bar']] : []), ['equations', 'Equation / pathway']] as [keyof LabItem['reveal'], string][]).map(([key, label]) => <label><input type="checkbox" checked={it.reveal[key]} disabled={it.locked} onChange={e => board.editLab(it, { reveal: { ...it.reveal, [key]: e.currentTarget.checked } }, label)}/>{label}</label>)}</div></details>
      <div class="science-theme-row"><span>Frame</span>{(['paper', 'blueprint'] as const).map(theme => <button class={it.theme === theme ? 'chosen' : ''} disabled={it.locked} onClick={() => board.editLab(it, { theme }, `${theme} lab theme`)}>{theme === 'paper' ? 'Paper' : 'Blueprint'}</button>)}</div>
      <button class="science-primary" disabled={it.locked} onClick={() => board.freezeLab(it, true)}><Pencil size={16}/><span>Freeze & annotate</span></button>
      <p class="science-note">Freeze saves this instant. Playing and scrubbing preview the scene; parameter edits restart it.</p>
      <details class="science-assumptions" open><summary>What this model assumes</summary><p>{m.assumption}</p><p>Offline and editable. Continuous animation is not yet captured by lesson recording; frozen edits and annotations are.</p></details>
    </> : <p role="status">This saved lab uses an unavailable model version. Settings are preserved; calculation and playback are disabled.</p>}
      <div class="science-utility-row"><button onClick={() => { board.setTool('select'); board.setSelection([it]); board.focusLab(it) }}><Scan size={15}/>Focus</button><button onClick={() => { board.setTool('select'); board.setSelection([it]); board.duplicateSelection() }}><Copy size={15}/>Duplicate</button><button onClick={() => void actions.savePng()}><Download size={15}/>Board PNG</button></div>
    </div>
  </aside>
}
