import { signal } from '@preact/signals'
import type { ShelfItem, ShelfKind } from '@shared/api'
import { board } from '@/engine/instance'
import { preloadImages } from '@/engine/media'
import { parseBoard, serializePages } from '@/engine/serialize'
import type { PageData } from '@/engine/serialize'
import { freshCopies, placeInView, readableOn } from '@/engine/shelf'
import { ask } from './dialog'
import { lessonName, lessonPath } from './lesson'
import { S, showToast } from './store'

/** What is on the shelf (null until first read). */
export const shelfItems = signal<ShelfItem[] | null>(null)

/** Being saved: taken when the teacher tapped Save, so what they saw is what is kept. */
export interface ShelfDraft { kind: ShelfKind; title: string; thumb?: string; count: number; json: string }
export const shelfDraft = signal<ShelfDraft | null>(null)

const nameOf = (id: string): string => shelfItems.value?.find(it => it.id === id)?.title ?? 'this item'

/** "Saved 1 Nov": a name for something the teacher did not stop to name. */
export const defaultTitle = (d = new Date()): string => `Saved ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`

/** A selection keeps the board colour it was drawn on, so its ink can be adapted to other boards. */
const packed = (pg: PageData, color: string): string => serializePages([pg], 0, true, { kind: 'notebook', frames: [], color }).json

function picture(paint: (cv: HTMLCanvasElement) => void): string | undefined {
  try {
    const cv = document.createElement('canvas')
    cv.width = 320; cv.height = 180
    paint(cv)
    return cv.toDataURL('image/webp', .72)
  } catch { return undefined }
}

export const shelf = {
  async refresh(): Promise<void> { shelfItems.value = await window.api.shelf.list() },

  /** Keep these objects: the selection, or what is on screen on a canvas without frames. */
  startSelection(items = board.selection.slice()): void {
    if (!items.length) return showToast('Select what you want to keep first')
    shelfDraft.value = {
      kind: 'selection', title: '', count: items.length,
      thumb: picture(cv => board.paintItemsThumb(items, cv)),
      json: packed({ items }, S.bgColor.value)
    }
    S.popover.value = 'shelf-save'
  },

  /** Keep the whole page (or canvas frame), with its paper, colour and background picture. */
  startPage(): void {
    const pg = board.pageForShelf()
    if (!pg) return shelf.startSelection(board.itemsOnScreen())
    if (!pg.items.length && pg.paper === 'none' && !pg.art) return showToast('This page is empty')
    shelfDraft.value = {
      kind: 'page', title: pg.title ?? '', count: pg.items.length,
      thumb: picture(cv => board.paintCurrentThumb(cv)),
      json: packed(pg, pg.color ?? S.bgColor.value)
    }
    S.popover.value = 'shelf-save'
  },

  async finishSave(title: string, subject: string): Promise<void> {
    const draft = shelfDraft.value
    if (!draft) return
    const name = title.trim() || defaultTitle()
    const r = await window.api.shelf.save({ title: name, subject: subject.trim(), kind: draft.kind, count: draft.count, thumb: draft.thumb, ...(lessonPath.value ? { from: lessonName.value } : {}) }, draft.json)
    if (!r.ok) return showToast(`Could not save it: ${r.error}`, 5000)
    shelfDraft.value = null
    S.popover.value = null
    showToast(`“${name}” is on your shelf`, 3000, { label: 'Open shelf', run: () => { S.popover.value = 'shelf' } })
    await shelf.refresh()
  },

  cancelSave(): void { shelfDraft.value = null; S.popover.value = null },

  /** A fresh, editable copy in this lesson: objects on this page, a saved page as a page of its own. */
  async insert(item: ShelfItem): Promise<void> {
    const json = await window.api.shelf.read(item.id)
    const parsed = json ? parseBoard(json) : null
    const pg = parsed?.pages?.[0]
    if (!pg) { showToast(`“${item.title}” could not be read`, 5000); return void shelf.refresh() }
    await preloadImages(pg.items, pg.art ? [pg.art.src] : [])
    S.popover.value = null
    const copies = freshCopies(pg.items)
    if (item.kind === 'page') {
      if (!board.addSavedPage({ ...pg, items: copies })) return showToast('Finish what you are drawing first')
      showToast(`Added “${item.title}” as a new ${S.kind.value === 'notebook' ? 'page' : 'frame'}`, 3000)
    } else {
      const adapted = readableOn(copies, parsed!.color ?? '#ffffff', S.bgColor.value)
      if (!board.insertSaved(placeInView(adapted, board.visibleRect()))) return showToast('Finish what you are drawing first')
    }
    void shelf.refresh()
  },

  async rename(id: string, title: string): Promise<void> {
    const r = await window.api.shelf.update(id, { title })
    if (!r.ok) showToast(`Could not rename: ${r.error}`, 5000)
    await shelf.refresh()
  },

  async setSubject(id: string, subject: string): Promise<void> {
    const r = await window.api.shelf.update(id, { subject })
    if (!r.ok) showToast(`Could not change the subject: ${r.error}`, 5000)
    await shelf.refresh()
  },

  async remove(id: string): Promise<void> {
    const choice = await ask(`Delete “${nameOf(id)}”?`, 'It leaves your shelf and goes to the Recycle Bin. Lessons that already use it keep their copy.',
      [{ label: 'Delete', value: 'delete', kind: 'danger' }, { label: 'Cancel', value: 'cancel' }])
    if (choice !== 'delete') return
    const r = await window.api.shelf.remove(id)
    if (!r.ok) showToast(`Could not delete: ${r.error}`, 5000)
    await shelf.refresh()
  },

  /** The whole shelf as one file, for another classroom PC. */
  async exportAll(): Promise<void> {
    const r = await window.api.shelf.exportFile()
    if (!r) return
    showToast(r.ok ? `Saved ${r.count} item${r.count === 1 ? '' : 's'} to one file` : `Could not save the file: ${r.error}`, 5000)
  },

  async importFile(): Promise<void> {
    const r = await window.api.shelf.importFile()
    if (!r) return
    await shelf.refresh()
    if (!r.ok) return showToast(`Could not add from that file: ${r.error}`, 5000)
    const parts = [`Added ${r.added} item${r.added === 1 ? '' : 's'}`]
    if (r.same) parts.push(`${r.same} already here`)
    if (r.bad) parts.push(`${r.bad} could not be read`)
    showToast(parts.join(' · '), 5000)
  }
}
