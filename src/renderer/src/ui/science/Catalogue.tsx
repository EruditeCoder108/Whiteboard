import { FlaskConical, X, Search, Plus, ArrowUpRight, ChevronDown, CircleCheck } from 'lucide-preact'
import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { board } from '@/engine/instance'
import { CONCEPTS, SUBJECTS, findConcepts } from '@/engine/science/catalogue'
import type { ScienceSubject } from '@/engine/science/catalogue'
import { getModel } from '@/engine/science/models'
import { isShowcase } from '@/engine/science/showcase-models'
import { supportedLab } from '@/engine/science/runtime'
import type { LabItem } from '@/engine/types'
import { S } from '@/state/store'
import { scienceInspector } from '@/state/science'
import { Btn } from '../kit'
import { ConceptPreview } from './Preview'

export function Catalogue(): JSX.Element {
  S.documentRevision.value
  const [query, setQuery] = useState(''), [subject, setSubject] = useState<ScienceSubject | 'all'>('all'), [topic, setTopic] = useState('all'), [tab, setTab] = useState<'showcase' | 'browse' | 'board'>('showcase')
  const search = useRef<HTMLInputElement>(null), labs = board.doc.items.filter((it): it is LabItem => it.t === 'l')
  const matches = findConcepts(query, subject, topic).filter(m => tab !== 'showcase' || isShowcase(m.id)), topics = [...new Set(CONCEPTS.filter(it => subject === 'all' || it.subject === subject).map(it => it.topic))]
  useEffect(() => { search.current?.focus({ preventScroll: true }) }, [])
  const close = (): void => { S.popover.value = null; document.querySelector<HTMLButtonElement>('button[aria-label="Science labs"]')?.focus() }
  const chooseSubject = (next: ScienceSubject | 'all'): void => { setSubject(next); setTopic('all'); setTab('browse') }
  return <section class={`science-catalog panel ui nodrag ${tab === 'showcase' ? 'science-showcases' : ''}`} data-popover-keep="" role="dialog" aria-labelledby="science-library-title" data-testid="science-library"
    onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (query) setQuery(''); else close() } if (e.key === 'Tab') e.stopPropagation() }}>
    <header class="science-heading"><div><span id="science-library-title"><FlaskConical size={18}/> Animation library</span><p>Little experiments. Big discoveries.</p></div><Btn icon={X} title="Close science catalogue" onClick={close}/></header>
    <div class="science-library-filters">
      <label class="science-search"><Search size={15}/><input ref={search} type="search" aria-label="Search animations" placeholder="Search a concept or question…" value={query} onInput={e => { setQuery(e.currentTarget.value); setTab('browse') }}/>{query && <Btn icon={X} size={13} title="Clear animation search" onClick={() => { setQuery(''); search.current?.focus() }}/>}</label>
      <select class="science-subject-select" aria-label="Animation subject" value={subject} onChange={e => chooseSubject(e.currentTarget.value as ScienceSubject | 'all')}><option value="all">All subjects</option>{SUBJECTS.map(s => <option value={s.id}>{s.title}</option>)}</select>
      <nav class="science-subjects" aria-label="Animation subjects"><button aria-pressed={subject === 'all'} onClick={() => chooseSubject('all')}>All <small>{CONCEPTS.length}</small></button>{SUBJECTS.map(s => <button aria-pressed={subject === s.id} onClick={() => chooseSubject(s.id)}>{s.title}<small>{CONCEPTS.filter(c => c.subject === s.id).length}</small></button>)}</nav>
    </div>
    <div class="science-library-tabs"><div><button aria-pressed={tab === 'showcase'} onClick={() => { setTab('showcase'); setSubject('all'); setTopic('all'); setQuery('') }}>Showcases <small>3</small></button><button aria-pressed={tab === 'browse'} onClick={() => setTab('browse')}>Browse all</button><button aria-pressed={tab === 'board'} onClick={() => setTab('board')}>On this board <small>{labs.length}</small></button></div>
      {tab === 'browse' && <label class="science-topic"><span class="sr-only">Animation topic</span><select aria-label="Animation topic" value={topic} onChange={e => setTopic(e.currentTarget.value)}><option value="all">All topics</option>{topics.map(t => <option>{t}</option>)}</select><ChevronDown size={12}/></label>}
    </div>
    <div class="science-library-content">
      {tab !== 'board' ? <>
        {tab === 'showcase' && <p class="science-showcase-intro">Three deeper discoveries. Move the magnet, follow a reaction, and look inside a heartbeat.</p>}
        <p class="science-result-count" role="status">{matches.length ? `${matches.length} experiment${matches.length === 1 ? '' : 's'} to explore` : 'No matching experiments'}</p>
        <div class="science-card-list">{matches.map(entry => <article class="science-card" data-concept={entry.id} key={entry.id}>
          <div class="science-card-art"><ConceptPreview id={entry.id}/><span>{entry.subject}</span></div>
          <div class="science-card-content"><span class="science-card-topic">{entry.topic}</span><h2>{entry.title}</h2><p class="science-card-description">{entry.question}</p>
            <button class="science-primary" aria-label={entry.id === 'projectile' ? 'Insert projectile lab' : `Insert ${entry.title} lab`} onClick={() => { board.insertLab(entry.id); S.popover.value = null }}><Plus size={15}/><span>Add to board</span></button>
            <details class="science-card-details"><summary>About this experiment</summary><p>{entry.description}</p><p>{entry.assumption}</p></details>
          </div>
        </article>)}</div>
        {!matches.length && <div class="science-library-empty"><FlaskConical size={28}/><h2>{subject === 'maths' && !query ? 'Maths is on the roadmap.' : 'Try another discovery.'}</h2><p>{subject === 'maths' && !query ? 'Explore the physics, chemistry and biology experiments available now.' : 'Search “gravity”, “bulb”, “colour” or “heart”, or clear your filters.'}</p><button onClick={() => { setQuery(''); chooseSubject('all') }}>Show all experiments</button></div>}
      </> : <>
        <p class="science-result-count" role="status">{labs.length} editable lab{labs.length === 1 ? '' : 's'} on this board</p>
        {labs.map((it, i) => <button class="science-board-lab" aria-label={`Focus ${getModel(it.model)?.title ?? it.model} ${i + 1}`} key={it.id} onClick={() => { board.setTool('select'); board.setSelection([it]); scienceInspector.value = window.innerWidth >= 880; board.focusLab(it); S.popover.value = null }}>
          <span class="science-board-number">{i + 1}</span><span><strong>{getModel(it.model)?.title ?? 'Unavailable model'}</strong><small>{supportedLab(it) ? `Saved at ${it.frozenTime.toFixed(2)} s · ${it.theme}${it.locked ? ' · Locked' : ''}` : 'Compatibility warning'}</small></span><ArrowUpRight size={17}/>
        </button>)}
        {!labs.length && <div class="science-library-empty"><FlaskConical size={28}/><h2>Your next discovery starts here.</h2><p>Add an experiment, then find it here whenever you want to continue.</p><button onClick={() => setTab('browse')}>Browse experiments</button></div>}
      </>}
    </div>
    <footer class="science-library-footer"><span><CircleCheck size={13}/> {CONCEPTS.length} offline experiments</span><span>Play · Freeze · Draw</span></footer>
  </section>
}
