import { ArtPicture } from './icons'
import { Archive, BookOpen, Download, FileInput, MoreHorizontal, RenameArt, Search, Tag, Trash2, X } from './icons'
import type { JSX } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import type { ShelfItem } from '@shared/api'
import { library, lesson, lessonSubject } from '@/state/lesson'
import { defaultTitle, shelf, shelfDraft, shelfItems } from '@/state/shelf'
import { S } from '@/state/store'
import { subjectsOf } from './Lessons'

/** Name the thing being kept, and say where to file it. The picture shows what will be saved. */
export function ShelfSaveSheet(): JSX.Element | null {
  const draft = shelfDraft.value
  const [title, setTitle] = useState(draft?.title ?? '')
  const [subject, setSubject] = useState(lessonSubject.value)
  useEffect(() => { if (!shelfItems.value) void shelf.refresh(); if (!library.value) void lesson.refreshLibrary() }, [])
  if (!draft) return null
  const subjects = subjectsOf([...(shelfItems.value ?? []), ...(library.value ?? [])]).slice(0, 8)
  const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') shelf.cancelSave(); e.stopPropagation() }
  return (
    <div class="chooser new-lesson ui" role="dialog" aria-modal="true" aria-labelledby="shelf-save-title" data-popover-keep="">
      <form class="chooser-card panel new-lesson-card" onSubmit={e => { e.preventDefault(); void shelf.finishSave(title, subject) }}>
        <h1 id="shelf-save-title">{draft.kind === 'page' ? 'Save this page to My shelf' : 'Save to My shelf'}</h1>
        {draft.thumb && <img class="shelf-preview" src={draft.thumb} alt="" />}
        <label class="field">
          <span>Name</span>
          <input class="nodrag" type="text" maxLength={100} value={title} placeholder={defaultTitle()} ref={el => el?.focus()}
            onInput={e => setTitle((e.target as HTMLInputElement).value)} onKeyDown={key as never} />
          <small>A name you will search for: “Human heart”, “Free-body diagram”.</small>
        </label>
        <label class="field">
          <span>Subject or class <i>(optional)</i></span>
          <input class="nodrag" type="text" maxLength={60} value={subject} placeholder="For example “Class 10 Science”"
            onInput={e => setSubject((e.target as HTMLInputElement).value)} onKeyDown={key as never} />
        </label>
        {subjects.length > 0 && <div class="chip-row">{subjects.map(s => (
          <button type="button" key={s} class={`chip nodrag ${s === subject ? 'on' : ''}`} onClick={() => setSubject(s)}>{s}</button>
        ))}</div>}
        <div class="dialog-choices">
          <button type="submit" class="dialog-btn primary nodrag">Save to shelf</button>
          <button type="button" class="dialog-btn nodrag" onClick={shelf.cancelSave}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

/** One saved item: tap the picture to use it; its name and the rest behind “⋯”. */
function ShelfCard({ it }: { it: ShelfItem }): JSX.Element {
  const [menu, setMenu] = useState(false)
  const [editing, setEditing] = useState<'title' | 'subject' | null>(null)
  const done = (value: string): void => {
    const field = editing
    setEditing(null)
    if (field === 'title' && value.trim() && value.trim() !== it.title) void shelf.rename(it.id, value)
    if (field === 'subject' && value.trim() !== it.subject) void shelf.setSubject(it.id, value)
  }
  const input = (value: string, label: string, max: number): JSX.Element => (
    <input class="card-input nodrag" type="text" maxLength={max} defaultValue={value} aria-label={label} ref={el => el?.focus()}
      onBlur={e => done((e.target as HTMLInputElement).value)}
      onKeyDown={e => { if (e.key === 'Enter') done((e.target as HTMLInputElement).value); else if (e.key === 'Escape') setEditing(null); e.stopPropagation() }} />
  )
  return (
    <div class="lesson-card shelf-card">
      <button type="button" class="lesson-open nodrag" title={it.from ? `From “${it.from}”` : it.title} aria-label={`Use ${it.title}`} onClick={() => { void shelf.insert(it) }}>
        {it.thumb ? <img src={it.thumb} alt="" /> : <span class="lesson-blank"><Archive size={28} /></span>}
        {it.kind === 'page' && <em>Whole page</em>}
      </button>
      <div class="lesson-meta">
        <div class="lesson-text">
          {editing === 'title' ? input(it.title, 'Name', 100) : <b title={it.title}>{it.title}</b>}
          {editing === 'subject' ? input(it.subject, 'Subject or class', 60) : it.from && <small>From {it.from}</small>}
        </div>
        <button type="button" class="lesson-more nodrag" aria-label={`More for ${it.title}`} aria-expanded={menu} onClick={() => setMenu(!menu)}><MoreHorizontal size={20} /></button>
      </div>
      {menu && <div class="lesson-actions">
        <button type="button" class="nodrag" onClick={() => { setMenu(false); setEditing('title') }}><RenameArt size={15} /> Rename</button>
        <button type="button" class="nodrag" onClick={() => { setMenu(false); setEditing('subject') }}><Tag size={15} /> Subject</button>
        <button type="button" class="nodrag danger" onClick={() => { setMenu(false); void shelf.remove(it.id) }}><Trash2 size={15} /> Delete</button>
      </div>}
    </div>
  )
}

/** The teacher's own saved diagrams and pages, by subject: tap one to put a fresh copy in the lesson. */
export function ShelfSheet(): JSX.Element {
  const [query, setQuery] = useState('')
  useEffect(() => { void shelf.refresh() }, [])
  const all = shelfItems.value
  const subjects = useMemo(() => subjectsOf(all ?? []), [all])
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const shown = (all ?? []).filter(it => !q || it.title.toLowerCase().includes(q) || it.subject.toLowerCase().includes(q) || it.from?.toLowerCase().includes(q))
    const map = new Map<string, ShelfItem[]>()
    for (const it of shown) {
      const key = subjects.find(s => s.toLowerCase() === it.subject.toLowerCase()) ?? ''
      map.set(key, [...(map.get(key) ?? []), it])
    }
    return [...map.entries()].sort(([a], [b]) => (a ? subjects.indexOf(a) : 1e9) - (b ? subjects.indexOf(b) : 1e9))
  }, [all, query, subjects])
  const close = (): void => { S.popover.value = null }
  const selected = S.selectionCount.value
  const pageLabel = S.kind.value === 'notebook' ? 'Save this page' : S.frameIndex.value >= 0 ? 'Save this frame' : 'Save what’s on screen'
  return (
    <div class="library ui" role="dialog" aria-modal="true" aria-labelledby="shelf-title" data-popover-keep=""
      onKeyDown={e => { if (e.key === 'Escape') close() }}>
      <div class="library-card panel">
        <header class="library-head">
          <h1 id="shelf-title">My shelf</h1>
          <label class="library-search"><Search size={18} />
            <input class="nodrag" type="search" placeholder="Search your shelf" value={query}
              onInput={e => setQuery((e.target as HTMLInputElement).value)} onKeyDown={e => e.stopPropagation()} />
          </label>
          {selected > 0 && <button type="button" class="dialog-btn primary nodrag" onClick={() => shelf.startSelection()}><Archive size={18} /> Save selection</button>}
          <button type="button" class={`dialog-btn nodrag ${selected ? '' : 'primary'}`} onClick={shelf.startPage}><BookOpen size={18} /> {pageLabel}</button>
          <button type="button" class="library-close nodrag" aria-label="Close" onClick={close}><X size={24} /></button>
        </header>
        <div class="library-body">
          {all === null ? <p class="pop-hint">Opening your shelf…</p>
            : !all.length ? <div class="library-empty shelf-empty">
              <ArtPicture name="empty-shelf" />
              <p><b>Draw it once, use it in every lesson.</b></p>
              <p>Select a diagram on the board and tap the <Archive size={15} /> button, or save a whole page from here. Then tap it here to put a fresh copy in any lesson.</p>
            </div>
            : !groups.length ? <p class="library-empty">Nothing on your shelf matches “{query}”.</p>
            : groups.map(([subject, list]) => (
              <section key={subject || '-'} class="library-group">
                <h2>{subject || (subjects.length ? 'Other' : 'Saved by you')} <small>{list.length}</small></h2>
                <div class="lesson-grid">{list.map(it => <ShelfCard key={it.id} it={it} />)}</div>
              </section>
            ))}
        </div>
        <footer class="shelf-foot">
          <span>Moving to another classroom PC? Take your whole shelf with you as one file.</span>
          <button type="button" class="dialog-btn nodrag" disabled={!all?.length} onClick={() => { void shelf.exportAll() }}><Download size={17} /> Save shelf to a file…</button>
          <button type="button" class="dialog-btn nodrag" onClick={() => { void shelf.importFile() }}><FileInput size={17} /> Add from a file…</button>
        </footer>
      </div>
    </div>
  )
}
