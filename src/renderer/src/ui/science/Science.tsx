import { Catalogue } from './Catalogue'
import { ExperimentInspector, LearningView } from './Inspector'
import { getModel, labDuration } from '@/engine/science/models'
import { FlaskConical, Play, Pause, RotateCcw, StepForward, StepBack, Snowflake, Pencil, X, SlidersHorizontal, Download, Scan, Copy } from 'lucide-preact'
import type { JSX } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { board } from '@/engine/instance'
import type { LabItem, LabReveal } from '@/engine/types'
import { flight } from '@/engine/science/projectile'
import { fmt } from '@/engine/science/scene'
import { supportedLab } from '@/engine/science/runtime'
import { activeLabId, scienceInspector } from '@/state/science'
import { S } from '@/state/store'
import { actions } from '@/state/actions'
import { Btn } from '../kit'

export function Parameter({ it, name }: { it: LabItem; name: string }): JSX.Element {
  const spec = getModel(it.model)!.params[name], value = it.params[name]
  const [draft, setDraft] = useState(String(value)), [error, setError] = useState('')
  useEffect(() => { setDraft(String(value)); setError('') }, [it.id, value])
  const commit = (raw: string): void => {
    const n = Number(raw)
    if (!raw.trim() || !Number.isFinite(n) || n < spec.min || n > spec.max) { setError(`Use ${spec.min}–${spec.max} ${spec.unit}`); board.previewLab(it, null); return }
    if ((spec.choices || spec.step === 1) && !Number.isInteger(n)) { setError('Use a whole number'); board.previewLab(it, null); return }
    board.editLab(it, { params: { ...it.params, [name]: n }, frozenTime: 0 }, `Change ${spec.label.toLowerCase()}`); setError('')
  }
  if (spec.choices) return <label class="science-choice"><span>{spec.label}</span><select aria-label={spec.label} value={value} disabled={it.locked} onChange={e => commit(e.currentTarget.value)}>{spec.choices.map(c => <option value={c.value}>{c.label}</option>)}</select></label>
  return <div class="science-parameter">
    <label class="science-param-row"><span>{spec.label}</span><span class="science-number"><input type="number" aria-label={spec.label} min={spec.min} max={spec.max} step={spec.step}
      value={draft} disabled={it.locked} aria-invalid={!!error} onInput={e => { setDraft(e.currentTarget.value); setError('') }} onBlur={e => commit(e.currentTarget.value)}
      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(String(value)); setError(''); board.previewLab(it, null) } }} /><span>{spec.unit}</span></span></label>
    <input type="range" class="science-range" aria-label={`${spec.label} slider`} min={spec.min} max={spec.max} step={spec.step} disabled={it.locked}
      value={Number(draft) || 0} onPointerDown={() => board.pauseLab(it)}
      onInput={e => { const raw = e.currentTarget.value; setDraft(raw); board.previewLab(it, { params: { ...it.params, [name]: Number(raw) }, frozenTime: 0 }) }}
      onChange={e => commit(e.currentTarget.value)} onPointerCancel={() => { board.previewLab(it, null); setDraft(String(value)) }}
      onBlur={() => board.previewLab(it, null)} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); board.previewLab(it, null); setDraft(String(value)) } }} />
    {error && <span class="science-error" role="alert">{error}</span>}
  </div>
}

const reveals: [keyof LabReveal, string][] = [['trajectory', 'Full trajectory'], ['vectors', 'Velocity vectors'], ['graphs', 'Live graphs'], ['strobes', 'Equal-time trail dots'], ['energy', 'Energy readout'], ['equations', 'Equations'], ['compare', 'Complementary angle']]

function Inspector({ it }: { it: LabItem }): JSX.Element {
  if (it.model !== 'projectile') return <ExperimentInspector it={it}/>
  const supported = supportedLab(it)
  return <aside class="science-inspector panel ui nodrag" data-testid="science-inspector" data-popover-keep="" aria-label="Projectile inspector">
    <div class="science-heading"><span><FlaskConical size={17} /> Projectile</span><Btn icon={X} title="Hide lab inspector" onClick={() => scienceInspector.value = false} /></div>
    <div class="science-inspector-body">
      {!supported ? <p role="status">This saved lab uses an unavailable model version. Its settings are preserved; calculation and playback are disabled.</p> : <>
        <LearningView it={it}/><span class="science-eyebrow">LAUNCH CONTROLS</span>
        {it.locked && <p class="science-note">Locked. Unlock the frame with the selection toolbar to edit.</p>}
        <Parameter it={it} name="speed"/><Parameter it={it} name="angle"/>
        {flight(it.params).duration === 0 && <p class="science-note" role="status">Already on the ground. Add upward speed or initial height to create a flight.</p>}
        <div class="science-preset-row" aria-label="Launch angle presets">
          {[30, 45, 60, 90].map(angle => <button disabled={it.locked} class={it.params.angle === angle ? 'chosen' : ''} onClick={() => board.editLab(it, { params: { ...it.params, angle }, frozenTime: 0 }, `Launch at ${angle} degrees`)}>{angle}°</button>)}
        </div>
        <details><summary>Height, gravity & mass</summary>
          <Parameter it={it} name="height"/><Parameter it={it} name="gravity"/><Parameter it={it} name="mass"/>
          <div class="science-preset-row" aria-label="Gravity presets">{[['Earth', 9.81], ['Moon', 1.62], ['Mars', 3.71]].map(([name, gravity]) => <button disabled={it.locked} class={it.params.gravity === gravity ? 'chosen' : ''}
            onClick={() => board.editLab(it, { params: { ...it.params, gravity: gravity as number }, frozenTime: 0 }, `${name} gravity preset`)}>{name}</button>)}</div>
        </details>
        <details open><summary>Reveal & explain</summary><div class="science-reveals">{reveals.map(([key, label]) => <label><input type="checkbox" checked={it.reveal[key]} disabled={it.locked}
          onChange={e => board.editLab(it, { reveal: { ...it.reveal, [key]: e.currentTarget.checked } }, `${label} reveal`)} />{label}</label>)}</div></details>
        <div class="science-theme-row"><span>Frame</span>{(['paper', 'blueprint'] as const).map(theme => <button class={it.theme === theme ? 'chosen' : ''} disabled={it.locked}
          onClick={() => board.editLab(it, { theme }, `${theme} lab theme`)}>{theme === 'paper' ? 'Paper' : 'Blueprint'}</button>)}</div>
        <button class="science-primary" disabled={it.locked} onClick={() => board.freezeLab(it, true)}><Pencil size={16}/> Freeze & annotate</button>
        <p class="science-note">Freeze saves this instant for reopening. Play and scrub preview the motion. Parameter edits restart at t = 0. Erase ink freely; select the frame and Delete to remove it.</p>
      </>}
      <div class="science-utility-row"><button onClick={() => { board.setTool('select'); board.setSelection([it]); board.focusLab(it) }}><Scan size={15}/> Focus</button>
        <button onClick={() => { board.setTool('select'); board.setSelection([it]); board.duplicateSelection() }}><Copy size={15}/> Duplicate</button>
        <button onClick={() => void actions.savePng()}><Download size={15}/> Board PNG</button></div>
      <details class="science-assumptions"><summary>Model & units</summary><p>x right, y upward. Point mass, constant downward gravity, no air resistance and a level landing plane at y = 0. At landing, velocity is immediately before impact. The marker size is illustrative.</p>
        <p>Allowed: speed 0–100 m/s, angle 0–90°, height 0–100 m, gravity 0.1–30 m/s², mass 0.01–100 kg. Time is in seconds, energy in joules. Earth/Moon/Mars are approximate constant-gravity presets.</p>
        <p>Frame resizing changes presentation. Labelled axes share equal metre scales; velocity arrows have their own visual scale. Dashed rose compares θ with 90° − θ. Equal ranges apply only when initial height is zero.</p>
        <p>Continuous scientific animation is not captured by lesson recording. Frozen edits and annotations are.</p></details>
    </div>
  </aside>
}

function Transport({ it }: { it: LabItem }): JSX.Element {
  board.labs.revision.value
  const supported = supportedLab(it), f = supported && it.model === 'projectile' ? flight(it.params) : null, playing = board.labs.playing(it), time = board.labs.time(it), duration = supported ? labDuration(it) : 0
  const disabled = !!it.locked || !supported
  const toggle = (): void => playing ? board.pauseLab(it) : board.playLab(it)
  return <section class={`science-transport panel ui nodrag ${scienceInspector.value ? 'with-inspector' : ''}`} aria-label="Lab playback" data-testid="science-transport"
    onKeyDown={e => { if (e.code === 'Space' && !['INPUT', 'SELECT'].includes((e.target as HTMLElement).tagName)) { e.preventDefault(); e.stopPropagation(); if (!e.repeat && !disabled) toggle() } }}>
    <div class="science-transport-buttons">
      <span class="science-transport-name">{getModel(it.model)?.title ?? it.model}</span>
      <Btn icon={playing ? Pause : Play} title={playing ? 'Pause lab' : 'Play lab'} disabled={disabled} active={playing} onClick={toggle}/>
      <Btn icon={RotateCcw} title="Reset lab to launch" disabled={disabled} onClick={() => board.seekLab(it, 0)}/>
      <Btn icon={StepBack} title="Step lab backward 1/30 s" disabled={disabled} onClick={() => board.stepLab(it, -1)}/>
      <Btn icon={StepForward} title="Step lab forward 1/30 s" disabled={disabled} onClick={() => board.stepLab(it)}/>
      <select aria-label="Lab playback speed" disabled={disabled} value={board.labs.speed(it)} onChange={e => { board.labs.setSpeed(it, Number(e.currentTarget.value)); board.refresh(it.p) }}>
        {[0.25, 0.5, 1, 2].map(speed => <option value={speed}>{speed}×</option>)}</select>
      <span class="science-time">{fmt(time)} / {fmt(duration)} s</span>
      <div class="grow"/>
      <Btn icon={Snowflake} title="Save this frozen starting frame" disabled={disabled} onClick={() => board.freezeLab(it)}/>
      <Btn icon={SlidersHorizontal} title="Show lab inspector" active={scienceInspector.value} onClick={() => scienceInspector.value = !scienceInspector.value}/>
      <Btn icon={X} title="Dismiss lab controls" onClick={() => { board.pauseLab(it); activeLabId.value = null }}/>
    </div>
    <div class="science-scrub-row"><input type="range" class="science-range" aria-label="Lab time" min={0} max={duration || 0.001} step={0.001} value={time} disabled={disabled}
      onInput={e => board.seekLab(it, Number(e.currentTarget.value))} />
      <button disabled={disabled} onClick={() => board.seekLab(it, f?.apexTime ?? duration / 2)}>{f ? 'Apex' : 'Middle'}</button><button disabled={disabled} onClick={() => board.seekLab(it, duration)}>{f ? 'Impact' : 'End'}</button></div>
  </section>
}

export function ScienceUI(): JSX.Element | null {
  S.documentRevision.value
  const selected = S.selection.value
  const id = activeLabId.value
  const it = board.doc.items.find((x): x is LabItem => x.t === 'l' && x.id === id)
  if (S.replaying.value) return null
  if (S.popover.value === 'science') return <Catalogue/>
  return <>
    {it && <>{scienceInspector.value && <Inspector key={it.id} it={it}/>}<Transport it={it}/></>}
    {!it && selected.length === 1 && selected[0].t === 'l' && <button class="science-reopen panel ui" onClick={() => { activeLabId.value = selected[0].id; scienceInspector.value = true }}>Open lab controls</button>}
  </>
}
