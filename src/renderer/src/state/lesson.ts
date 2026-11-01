import { computed, effect, signal } from '@preact/signals'
import type { LessonInfo, LibraryLesson, RecentLesson } from '@shared/api'
import { board } from '@/engine/instance'
import type { BoardKind } from '@/engine/pages'
import { ask } from './dialog'
import { S, showToast } from './store'

/**
 * The lesson on the board and its file. Every lesson has a file: a new lesson gets one in the library
 * folder as soon as it is made (or, for a board that never had one, as soon as something is drawn), and
 * the file saves itself a moment after each change. Ctrl+S just saves at once.
 */
export const lessonPath = signal<string | null>(null)
/** the lesson's subject, class or course, as the library groups it */
export const lessonSubject = signal('')
export const recentLessons = signal<RecentLesson[]>([])
export const library = signal<LibraryLesson[] | null>(null)
/** what the lesson file is doing: shown quietly next to the lesson name */
export const fileState = signal<'saved' | 'saving' | 'failed'>('saved')
/** the board's revision at the last save, open or new */
const savedRevision = signal(0)

/** How long after the last change the file is written. */
const AUTOSAVE_MS = 1500

const fileName = (path: string): string => path.split(/[\\/]/).pop() ?? path
const nameOf = (path: string): string => fileName(path).replace(/\.[^.]+$/, '')
const safe = (name: string): string => name.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 100) || 'lesson'

export const lessonName = computed(() => lessonPath.value ? nameOf(lessonPath.value) : 'Untitled lesson')
/** The lesson has changes that are not in its file yet. */
export const lessonDirty = computed(() => S.contentRevision.value !== savedRevision.value)

/** A file name for a picture or PDF of this lesson. */
export function exportName(extension: string): string {
  return lessonPath.value ? `${safe(nameOf(lessonPath.value))}.${extension}` : `lesson_${new Date().toISOString().slice(0, 10)}.${extension}`
}

/** "Lesson · 1 Nov" — the name a lesson gets before the teacher names it. */
export function dateName(d = new Date()): string {
  return `Lesson · ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
}

const markSaved = (): void => { savedRevision.value = board.revision }

/** A small picture of the first page, for the library. */
function thumbnail(): string | undefined {
  try {
    const cv = document.createElement('canvas')
    cv.width = 320; cv.height = 180
    board.paintPageThumb(0, cv)
    return cv.toDataURL('image/webp', .72)
  } catch { return undefined }
}

const info = (): LessonInfo => ({ subject: lessonSubject.value, pages: Math.max(1, board.kind === 'notebook' ? S.pageCount.value : S.frameCount.value || 1), kind: board.kind, thumb: thumbnail() })

/** Counts lesson switches (new, open): a save that finishes after one belongs to the lesson before. */
let generation = 0

/** Write the lesson to `path`. Quiet saves (autosave) only speak up when they fail. */
async function writeTo(path: string, quiet: boolean): Promise<boolean> {
  try {
    board.commitText()
    const revision = board.revision, gen = generation
    fileState.value = 'saving'
    const r = await window.api.lessons.save(path, board.serialize(), info())
    if (gen !== generation) return r.ok // the board holds another lesson now: leave its state alone
    if (!r.ok) {
      fileState.value = 'failed'
      showToast(`Could not save “${nameOf(path)}”: ${r.error}`, 6000, { label: 'Save a copy…', run: () => { void lesson.saveAs() } })
      return false
    }
    if (lessonPath.value === path || lessonPath.value === null) lessonPath.value = path
    savedRevision.value = revision
    fileState.value = 'saved'
    if (!quiet) showToast(`Saved “${nameOf(path)}”`)
    void lesson.refreshRecent()
    return true
  } catch {
    fileState.value = 'failed'
    showToast('Could not save the lesson. Please try another place.', 5000, { label: 'Save a copy…', run: () => { void lesson.saveAs() } })
    return false
  }
}

let timer: number | undefined
let pending: Promise<boolean> | null = null
let creating: Promise<string | null> | null = null

/** A lesson that has no file yet gets one in the library, named after today's date. */
async function ensureFile(): Promise<string | null> {
  if (lessonPath.value) return lessonPath.value
  const gen = generation
  creating ??= window.api.lessons.create(dateName(), lessonSubject.value).finally(() => { creating = null })
  const path = await creating
  if (gen !== generation) return null
  if (path && !lessonPath.value) lessonPath.value = path
  return lessonPath.value
}

/** Before a lesson is replaced: its file is brought up to date. True when it is fine to go on. */
async function guard(): Promise<boolean> {
  if (await lesson.flush() || board.isEmpty) return true
  const choice = await ask(`“${lessonName.value}” could not be saved`,
    'Its latest changes are only inside the app. Save a copy somewhere else, or go on without them.',
    [{ label: 'Save a copy…', value: 'save', kind: 'primary' }, { label: 'Go on without them', value: 'discard', kind: 'danger' }, { label: 'Cancel', value: 'cancel' }])
  return choice === 'save' ? lesson.saveAs() : choice === 'discard'
}

/** Put an opened file on the board. A board from the old Python app has no lesson file of its own. */
async function adopt(file: { path: string; json: string }): Promise<boolean> {
  await window.api.store.archiveBoard().catch(() => {})
  const parsed = board.load(file.json, { undoable: false })
  if (!parsed) {
    showToast('Unsupported or damaged lesson file. Your current lesson is unchanged.', 5000)
    return false
  }
  generation++
  S.popover.value = null
  board.fitContent()
  lessonPath.value = parsed.legacy ? null : file.path
  lessonSubject.value = library.value?.find(l => l.path === file.path)?.subject ?? ''
  markSaved()
  fileState.value = 'saved'
  const skipped = parsed.skipped ? ` · ${parsed.skipped} invalid object(s) skipped` : ''
  showToast(parsed.legacy ? `Python board imported${skipped}` : `Opened “${nameOf(file.path)}”${skipped}`, parsed.skipped ? 6000 : 3000)
  void lesson.refreshRecent()
  return true
}

export const lesson = {
  /** After the board has loaded: pick up which file it belongs to, then keep that file saved. */
  async init(): Promise<void> {
    try {
      const link = await window.api.lessons.getLink()
      lessonPath.value = link.path
      savedRevision.value = link.dirty ? -1 : board.revision
    } catch { savedRevision.value = -1 }
    effect(() => {
      const path = lessonPath.value, dirty = lessonDirty.value
      if (S.ready.value) void window.api.lessons.setLink({ path, dirty }).catch(() => {})
    })
    // Autosave: a moment after the last change, the lesson's file is written (and made, if it has none).
    effect(() => {
      S.contentRevision.value
      if (!S.ready.value || !lessonDirty.value) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => { void lesson.flush() }, AUTOSAVE_MS)
    })
    await lesson.refreshLibrary()
    lessonSubject.value = library.value?.find(l => l.path === lessonPath.value)?.subject ?? ''
    void lesson.refreshRecent()
  },

  /** Save now if there is anything unsaved. False when the lesson still has changes its file lacks. */
  async flush(): Promise<boolean> {
    window.clearTimeout(timer)
    if (pending) await pending
    if (!lessonDirty.value) return true
    if (board.isEmpty && !lessonPath.value) return true // nothing worth a file yet
    pending = (async () => {
      const path = await ensureFile()
      return path ? writeTo(path, true) : false
    })().finally(() => { pending = null })
    return pending
  },

  async refreshRecent(): Promise<void> {
    try { recentLessons.value = await window.api.lessons.recent() } catch { /* the list is a convenience */ }
  },

  async refreshLibrary(): Promise<void> {
    try { library.value = await window.api.lessons.library() } catch { library.value = library.value ?? [] }
  },

  /**
   * A fresh lesson with a name (and a subject to file it under). Notebook on a smart board, canvas on
   * a laptop, unless asked. Its file is made in the library straight away.
   */
  async newLesson(opts: { name?: string; subject?: string; kind?: BoardKind } = {}): Promise<boolean> {
    if (!(await guard())) return false
    await window.api.store.archiveBoard().catch(() => {})
    board.newLesson(opts.kind ?? (S.layout.value === 'board' ? 'notebook' : 'canvas'))
    generation++
    lessonPath.value = null
    lessonSubject.value = (opts.subject ?? '').trim()
    markSaved()
    S.popover.value = null
    const path = await window.api.lessons.create(opts.name?.trim() || dateName(), lessonSubject.value).catch(() => null)
    if (path) { lessonPath.value = path; await writeTo(path, true) }
    showToast(`New lesson “${lessonName.value}”`)
    void lesson.refreshLibrary()
    return true
  },

  /** Save at once (Ctrl+S); a lesson without a file gets one in the library. */
  async save(): Promise<boolean> {
    window.clearTimeout(timer)
    const path = await ensureFile()
    return path ? writeTo(path, false) : lesson.saveAs()
  },

  /** Save under a new name or in a new place; the lesson then belongs to that file. */
  async saveAs(): Promise<boolean> {
    try {
      const path = await window.api.lessons.pickSavePath(`${safe(lessonName.value)}.wbd`)
      if (!path) return false
      lessonPath.value = path
      return writeTo(path, false)
    } catch {
      showToast('Could not save the lesson. Please try another place.', 5000)
      return false
    }
  },

  async open(): Promise<boolean> {
    try {
      if (!(await guard())) return false
      const file = await window.api.lessons.pickOpen()
      return file ? adopt(file) : false
    } catch {
      showToast('Could not read that file. Your current lesson is unchanged.', 5000)
      return false
    }
  },

  /** A lesson from the library or the recent list. */
  async openRecent(path: string): Promise<boolean> {
    if (path === lessonPath.value) { S.popover.value = null; return true }
    try {
      if (!(await guard())) return false
      const file = await window.api.lessons.open(path)
      if (!file) {
        await window.api.lessons.forget(path)
        void lesson.refreshRecent(); void lesson.refreshLibrary()
        showToast('That lesson is not there any more.', 4000)
        return false
      }
      return adopt(file)
    } catch {
      showToast('Could not read that file. Your current lesson is unchanged.', 5000)
      return false
    }
  },

  /** Rename a lesson's file (the open lesson too: it keeps saving under the new name). */
  async rename(path: string, name: string): Promise<boolean> {
    if (path === lessonPath.value) await lesson.flush()
    const r = await window.api.lessons.rename(path, name)
    if (!r.ok) { showToast(`Could not rename: ${r.error}`, 5000); return false }
    if (path === lessonPath.value) lessonPath.value = r.path
    await lesson.refreshLibrary()
    return true
  },

  async setSubject(path: string, subject: string): Promise<void> {
    await window.api.lessons.setSubject(path, subject)
    if (path === lessonPath.value) lessonSubject.value = subject.trim()
    await lesson.refreshLibrary()
  },

  async duplicate(path: string): Promise<void> {
    if (path === lessonPath.value) await lesson.flush()
    const copy = await window.api.lessons.duplicate(path)
    if (copy) showToast(`Copied as “${nameOf(copy)}”`)
    await lesson.refreshLibrary()
  },

  /** To the Recycle Bin, after asking. The open lesson cannot be deleted while it is open. */
  async remove(path: string): Promise<void> {
    if (path === lessonPath.value) return showToast('This lesson is open. Open or start another lesson first.', 4000)
    const choice = await ask(`Delete “${nameOf(path)}”?`, 'It goes to the Recycle Bin, so it can still be restored from there.',
      [{ label: 'Delete', value: 'delete', kind: 'danger' }, { label: 'Cancel', value: 'cancel' }])
    if (choice !== 'delete') return
    const r = await window.api.lessons.remove(path)
    if (!r.ok) showToast(`Could not delete: ${r.error}`, 5000)
    await lesson.refreshLibrary()
    void lesson.refreshRecent()
  }
}
