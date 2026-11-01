import { computed, effect, signal } from '@preact/signals'
import type { RecentLesson } from '@shared/api'
import { board } from '@/engine/instance'
import type { BoardKind } from '@/engine/pages'
import { ask } from './dialog'
import { S, showToast } from './store'

/** The lesson file on the board: which file it belongs to, whether it has changes the file lacks, and the lessons used lately. */
export const lessonPath = signal<string | null>(null)
export const recentLessons = signal<RecentLesson[]>([])
/** the board's revision at the last save, open or new */
const savedRevision = signal(0)

const fileName = (path: string): string => path.split(/[\\/]/).pop() ?? path
const nameOf = (path: string): string => fileName(path).replace(/\.[^.]+$/, '')
const safe = (name: string): string => name.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 100) || 'lesson'

export const lessonName = computed(() => lessonPath.value ? nameOf(lessonPath.value) : 'Untitled lesson')
/** The lesson has changes that are not in its file (a lesson never saved to a file always counts, once it has anything on it). */
export const lessonDirty = computed(() => S.contentRevision.value !== savedRevision.value)

/** A file name for a picture or PDF of this lesson. */
export function exportName(extension: string): string {
  return lessonPath.value ? `${safe(nameOf(lessonPath.value))}.${extension}` : `lesson_${new Date().toISOString().slice(0, 10)}.${extension}`
}

const markSaved = (): void => { savedRevision.value = board.revision }

/** Before a lesson is replaced: unsaved work gets a say. True when it is fine to go on. */
async function guard(): Promise<boolean> {
  if (!lessonDirty.value || board.isEmpty) return true
  const named = lessonPath.value !== null
  const choice = await ask(
    named ? `Save changes to “${lessonName.value}”?` : 'Save this lesson first?',
    named ? 'This lesson has changes that are not in its file yet.' : 'It is only kept inside the app so far. Save it as a file to open it again later, here or on another computer.',
    [{ label: 'Save lesson', value: 'save', kind: 'primary' }, { label: 'Don’t save', value: 'discard', kind: 'danger' }, { label: 'Cancel', value: 'cancel' }])
  return choice === 'save' ? lesson.save() : choice === 'discard'
}

async function writeTo(path: string): Promise<boolean> {
  try {
    board.commitText()
    const revision = board.revision
    const r = await window.api.lessons.save(path, board.serialize())
    if (!r.ok) {
      showToast(`Could not save “${nameOf(path)}”: ${r.error}`, 6000, { label: 'Save as…', run: () => { void lesson.saveAs() } })
      return false
    }
    lessonPath.value = path
    savedRevision.value = revision
    showToast(`Saved “${nameOf(path)}”`)
    void lesson.refreshRecent()
    return true
  } catch {
    showToast('Could not save the lesson. Please try another place.', 5000, { label: 'Save as…', run: () => { void lesson.saveAs() } })
    return false
  }
}

/** Put an opened file on the board. A board from the old Python app has no lesson file of its own. */
async function adopt(file: { path: string; json: string }): Promise<boolean> {
  await window.api.store.archiveBoard().catch(() => {})
  const parsed = board.load(file.json, { undoable: false })
  if (!parsed) {
    showToast('Unsupported or damaged lesson file. Your current lesson is unchanged.', 5000)
    return false
  }
  S.popover.value = null
  board.fitContent()
  lessonPath.value = parsed.legacy ? null : file.path
  markSaved()
  const skipped = parsed.skipped ? ` · ${parsed.skipped} invalid object(s) skipped` : ''
  showToast(parsed.legacy ? `Python board imported${skipped}` : `Opened “${nameOf(file.path)}”${skipped}`, parsed.skipped ? 6000 : 3000)
  void lesson.refreshRecent()
  return true
}

export const lesson = {
  /** After the board has loaded: pick up which file it belongs to and whether it has unsaved changes. */
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
    void lesson.refreshRecent()
  },

  async refreshRecent(): Promise<void> {
    try { recentLessons.value = await window.api.lessons.recent() } catch { /* the list is a convenience */ }
  },

  /** A fresh lesson. Notebook on a smart board, canvas on a laptop, unless asked. */
  async newLesson(kind: BoardKind = S.layout.value === 'board' ? 'notebook' : 'canvas'): Promise<void> {
    if (!(await guard())) return
    await window.api.store.archiveBoard().catch(() => {})
    board.newLesson(kind)
    lessonPath.value = null
    markSaved()
    S.popover.value = null
    showToast('New lesson')
  },

  /** Save to the lesson's own file; the first time, ask where. */
  async save(): Promise<boolean> {
    const path = lessonPath.value
    return path ? writeTo(path) : lesson.saveAs()
  },

  /** Save under a new name or in a new place; the lesson then belongs to that file. */
  async saveAs(): Promise<boolean> {
    try {
      const path = await window.api.lessons.pickSavePath(`${safe(lessonName.value)}.wbd`)
      return path ? writeTo(path) : false
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

  async openRecent(path: string): Promise<boolean> {
    try {
      if (!(await guard())) return false
      const file = await window.api.lessons.open(path)
      if (!file) {
        await window.api.lessons.forget(path)
        void lesson.refreshRecent()
        showToast('That lesson is not there any more.', 4000)
        return false
      }
      return adopt(file)
    } catch {
      showToast('Could not read that file. Your current lesson is unchanged.', 5000)
      return false
    }
  }
}
