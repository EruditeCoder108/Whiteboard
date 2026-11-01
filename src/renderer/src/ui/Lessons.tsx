import { ArtPicture } from './icons'
import { BookOpen, Copy, FileDown, FolderOpen, FolderSearch, Image as ImageIcon, Infinity as InfinityIcon, MoreHorizontal, RenameArt, Plus, QrCode, Search, Tag, Trash2, X } from './icons'
import type { JSX } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import type { LibraryLesson } from '@shared/api'
import { board } from '@/engine/instance'
import type { PictureScope } from '@/engine/board'
import type { BoardKind } from '@/engine/pages'
import { actions } from '@/state/actions'
import { dateName, lesson, lessonPath, lessonSubject, library } from '@/state/lesson'
import { S } from '@/state/store'
import { sharing } from '@/state/share'
import { Row, Segmented, Switch, Tile } from './kit'

/** "Today 11:40", "Yesterday 09:05", "3 Nov 2026" */
function when(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const day = (x: Date): string => x.toDateString()
  const now = new Date(), yesterday = new Date(now.getTime() - 86_400_000)
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (day(d) === day(now)) return `Today ${time}`
  if (day(d) === day(yesterday)) return `Yesterday ${time}`
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Subjects already in use, most recently used first. */
export function subjectsOf(list: { subject: string }[]): string[] {
  const seen: string[] = []
  for (const l of list) if (l.subject && !seen.some(s => s.toLowerCase() === l.subject.toLowerCase())) seen.push(l.subject)
  return seen
}

/**
 * A new lesson: a name (a chapter, a topic), a subject or class to file it under, and the kind of board.
 * Its file is made in the library at once and saves itself from then on.
 */
export function NewLessonSheet(): JSX.Element {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState(lessonSubject.value)
  const [kind, setKind] = useState<BoardKind>(S.layout.value === 'board' ? 'notebook' : 'canvas')
  useEffect(() => { if (!library.value) void lesson.refreshLibrary() }, [])
  const subjects = subjectsOf(library.value ?? []).slice(0, 8)
  const start = (): void => { void lesson.newLesson({ name, subject, kind }) }
  const cancel = (): void => { S.popover.value = null }
  return (
    <div class="chooser new-lesson ui" role="dialog" aria-modal="true" aria-labelledby="new-lesson-title" data-popover-keep="">
      <form class="chooser-card panel new-lesson-card" onSubmit={e => { e.preventDefault(); start() }}>
        <h1 id="new-lesson-title">New lesson</h1>
        <label class="field">
          <span>Name</span>
          <input class="nodrag" type="text" maxLength={100} value={name} placeholder={dateName()} ref={el => el?.focus()}
            onInput={e => setName((e.target as HTMLInputElement).value)} onKeyDown={e => { if (e.key === 'Escape') cancel(); e.stopPropagation() }} />
          <small>For example “Ch 4 · Carbon compounds” or “Fractions, day 2”.</small>
        </label>
        <label class="field">
          <span>Subject or class <i>(optional)</i></span>
          <input class="nodrag" type="text" maxLength={60} value={subject} placeholder="For example “Class 10 Science”"
            onInput={e => setSubject((e.target as HTMLInputElement).value)} onKeyDown={e => { if (e.key === 'Escape') cancel(); e.stopPropagation() }} />
        </label>
        {subjects.length > 0 && <div class="chip-row">{subjects.map(s => (
          <button type="button" key={s} class={`chip nodrag ${s === subject ? 'on' : ''}`} onClick={() => setSubject(s)}>{s}</button>
        ))}</div>}
        <div class="field"><span>Board</span>
          <div class="kind-choice">
            <button type="button" class={`kind-option nodrag ${kind === 'notebook' ? 'on' : ''}`} aria-pressed={kind === 'notebook'} onClick={() => setKind('notebook')}>
              <BookOpen size={26} /><b>Notebook</b><small>Pages, one after another</small>
            </button>
            <button type="button" class={`kind-option nodrag ${kind === 'canvas' ? 'on' : ''}`} aria-pressed={kind === 'canvas'} onClick={() => setKind('canvas')}>
              <InfinityIcon size={26} /><b>Canvas</b><small>One endless board</small>
            </button>
          </div>
        </div>
        <div class="dialog-choices">
          <button type="submit" class="dialog-btn primary nodrag">Start the lesson</button>
          <button type="button" class="dialog-btn nodrag" onClick={cancel}>Cancel</button>
        </div>
        <p class="pop-hint">It saves itself as you teach, in Documents › Floating Whiteboard › Lessons.</p>
      </form>
    </div>
  )
}

/** One lesson in the library: its first page, name, date and size, with its actions behind “⋯”. */
function LessonCard({ l, subjects }: { l: LibraryLesson; subjects: string[] }): JSX.Element {
  const [menu, setMenu] = useState(false)
  const [editing, setEditing] = useState<'name' | 'subject' | null>(null)
  const current = l.path === lessonPath.value
  const done = (value: string): void => {
    const field = editing
    setEditing(null)
    if (field === 'name' && value.trim() && value.trim() !== l.name) void lesson.rename(l.path, value)
    if (field === 'subject' && value.trim() !== l.subject) void lesson.setSubject(l.path, value)
  }
  const input = (value: string, label: string, max: number, list?: string): JSX.Element => (
    <input class="card-input nodrag" type="text" maxLength={max} defaultValue={value} aria-label={label} list={list} ref={el => el?.focus()}
      onBlur={e => done((e.target as HTMLInputElement).value)}
      onKeyDown={e => { if (e.key === 'Enter') done((e.target as HTMLInputElement).value); else if (e.key === 'Escape') setEditing(null); e.stopPropagation() }} />
  )
  const size = l.pages ? ` · ${l.pages} ${l.kind === 'canvas' ? (l.pages === 1 ? 'board' : 'frames') : l.pages === 1 ? 'page' : 'pages'}` : ''
  return (
    <div class={`lesson-card ${current ? 'current' : ''}`}>
      <button type="button" class="lesson-open nodrag" title={l.path} aria-label={`Open ${l.name}`} onClick={() => { void lesson.openRecent(l.path) }}>
        {l.thumb ? <img src={l.thumb} alt="" /> : <span class="lesson-blank">{l.kind === 'canvas' ? <InfinityIcon size={28} /> : <BookOpen size={28} />}</span>}
        {current && <em>Open now</em>}
      </button>
      <div class="lesson-meta">
        <div class="lesson-text">
          {editing === 'name' ? input(l.name, 'Lesson name', 100) : <b title={l.name}>{l.name}</b>}
          {editing === 'subject' ? input(l.subject, 'Subject or class', 60, 'lesson-subjects')
            : <small>{when(l.modified)}{size}{l.inLibrary ? '' : ' · elsewhere on this PC'}</small>}
        </div>
        <button type="button" class="lesson-more nodrag" aria-label={`More for ${l.name}`} aria-expanded={menu} onClick={() => setMenu(!menu)}><MoreHorizontal size={20} /></button>
      </div>
      {menu && <div class="lesson-actions">
        <button type="button" class="nodrag" onClick={() => { setMenu(false); setEditing('name') }}><RenameArt size={15} /> Rename</button>
        <button type="button" class="nodrag" onClick={() => { setMenu(false); setEditing('subject') }}><Tag size={15} /> Subject</button>
        <button type="button" class="nodrag" onClick={() => { setMenu(false); void lesson.duplicate(l.path) }}><Copy size={15} /> Make a copy</button>
        <button type="button" class="nodrag" onClick={() => { setMenu(false); void window.api.lessons.reveal(l.path) }}><FolderSearch size={15} /> Show in folder</button>
        {!current && <button type="button" class="nodrag danger" onClick={() => { setMenu(false); void lesson.remove(l.path) }}><Trash2 size={15} /> Delete</button>}
      </div>}
      {subjects.length > 0 && editing === 'subject' && <datalist id="lesson-subjects">{subjects.map(s => <option key={s} value={s} />)}</datalist>}
    </div>
  )
}

/** Every lesson, grouped by subject, newest first: open, rename, file, copy or delete them. */
export function LessonLibrary(): JSX.Element {
  const [query, setQuery] = useState('')
  useEffect(() => { void lesson.flush().then(() => lesson.refreshLibrary()) }, [])
  const all = library.value
  const subjects = useMemo(() => subjectsOf(all ?? []), [all])
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const shown = (all ?? []).filter(l => !q || l.name.toLowerCase().includes(q) || l.subject.toLowerCase().includes(q))
    const map = new Map<string, LibraryLesson[]>()
    for (const l of shown) {
      const key = subjects.find(s => s.toLowerCase() === l.subject.toLowerCase()) ?? ''
      map.set(key, [...(map.get(key) ?? []), l])
    }
    // Subjects in the order they were last used; lessons without one at the end.
    return [...map.entries()].sort(([a], [b]) => (a ? subjects.indexOf(a) : 1e9) - (b ? subjects.indexOf(b) : 1e9))
  }, [all, query, subjects])
  const close = (): void => { S.popover.value = null }
  return (
    <div class="library ui" role="dialog" aria-modal="true" aria-labelledby="library-title" data-popover-keep=""
      onKeyDown={e => { if (e.key === 'Escape') close() }}>
      <div class="library-card panel">
        <header class="library-head">
          <h1 id="library-title">My lessons</h1>
          <label class="library-search"><Search size={18} />
            <input class="nodrag" type="search" placeholder="Search by name or subject" value={query}
              onInput={e => setQuery((e.target as HTMLInputElement).value)} onKeyDown={e => e.stopPropagation()} />
          </label>
          <button type="button" class="dialog-btn primary nodrag" onClick={() => (S.popover.value = 'new-lesson')}><Plus size={18} /> New lesson</button>
          <button type="button" class="dialog-btn nodrag" onClick={() => { close(); void lesson.open() }}><FolderOpen size={18} /> Open a file…</button>
          <button type="button" class="library-close nodrag" aria-label="Close" onClick={close}><X size={24} /></button>
        </header>
        <div class="library-body">
          {all === null ? <p class="pop-hint">Loading your lessons…</p>
            : !all.length ? <p class="library-empty"><ArtPicture name="empty-lessons" />No lessons yet. Start one with <b>New lesson</b>; it saves itself as you teach.</p>
            : !groups.length ? <p class="library-empty">No lesson matches “{query}”.</p>
            : groups.map(([subject, list]) => (
              <section key={subject || '-'} class="library-group">
                <h2>{subject || (subjects.length ? 'Other lessons' : 'Lessons')} <small>{list.length}</small></h2>
                <div class="lesson-grid">{list.map(l => <LessonCard key={l.path} l={l} subjects={subjects} />)}</div>
              </section>
            ))}
        </div>
      </div>
    </div>
  )
}

/** Pictures and PDF of the lesson, with the choices that matter in plain words. */
export function ExportSheet(): JSX.Element {
  const notebook = S.kind.value === 'notebook'
  const [scope, setScope] = useState<PictureScope>(board.defaultScope)
  const [paper, setPaper] = useState(true)
  const [answers, setAnswers] = useState(false)
  const hidden = answers ? 'show' as const : 'keep' as const
  const anyHidden = board.pageData().some(pg => pg.items.some(it => it.step && !it.step.shown))
  const selection = S.selectionCount.value > 0
  const pageLabel = notebook ? 'This page' : S.frameIndex.value >= 0 ? 'This frame' : 'On screen'
  const picture = { scope: scope === 'selection' && !selection ? 'page' as const : scope, paper, hidden }
  const close = (fn: () => unknown) => (): void => { S.popover.value = null; void fn() }
  return (
    <div class="popover panel ui board-sheet lesson-sheet export-sheet" data-popover-keep="">
      {anyHidden && <Row label="Include hidden answers" hint="Off: the picture shows only what the class has seen"><span class="grow" /><Switch on={answers} onChange={setAnswers} /></Row>}
      <div class="sheet-head">Picture (PNG)</div>
      <Segmented<PictureScope>
        options={[{ value: 'page', label: pageLabel }, { value: 'content', label: 'Everything' }, ...(selection ? [{ value: 'selection' as const, label: 'Selection' }] : [])]}
        value={picture.scope} onChange={setScope} />
      <Row label="With board colour and paper" hint="Off: ink only, on a see-through background"><span class="grow" /><Switch on={paper} onChange={setPaper} /></Row>
      <div class="tiles two">
        <Tile icon={ImageIcon} label="Save picture" onClick={close(() => actions.savePng(picture))} />
        <Tile icon={Copy} label="Copy picture" onClick={close(() => actions.copyImage(picture))} />
      </div>
      <div class="sheet-head">PDF of the whole lesson</div>
      <div class="tiles two">
        <Tile icon={FileDown} label="Save PDF" onClick={() => (S.popover.value = 'export-preview')} />
        <Tile icon={QrCode} label="Share to phones" onClick={close(sharing.open)} />
      </div>
    </div>
  )
}
