import { promises as fs } from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, relative } from 'node:path'
import { parseBoard } from '../renderer/src/engine/serialize'
import type { LessonInfo, LessonLink, LibraryLesson, RecentLesson, SaveResult } from '../shared/api'
import { MAX_FILE_BYTES, saveError } from './storage'

const MAX_RECENT = 8
const EXTENSIONS = ['.wbd', '.json']
const MAX_THUMB = 80_000
const MAX_SUBJECT = 60

/** "Maths ch 4.wbd" → "Maths ch 4" */
export const lessonName = (path: string): string => basename(path, extname(path))

const okPath = (path: unknown): path is string => typeof path === 'string' && isAbsolute(path) && EXTENSIONS.includes(extname(path).toLowerCase())
/** A name that is safe as a Windows file name. */
export const fileSafe = (name: string): string => name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/[. ]+$/, '').trim().slice(0, 100) || 'Lesson'
const cleanSubject = (s: unknown): string => typeof s === 'string' ? s.replace(/[\u0000-\u001f]/g, '').trim().slice(0, MAX_SUBJECT) : ''

/** What the library remembers about a lesson file besides the file itself. */
interface Entry { subject: string; pages: number; kind: 'notebook' | 'canvas'; created: string; thumb?: string }

/**
 * The teacher's lesson files.
 *  - The library folder (Documents\Floating Whiteboard\Lessons) holds the lessons made here; the app
 *    may always read and write inside it.
 *  - Elsewhere, the renderer may only write to or read back a path the teacher chose in a file dialog
 *    (this session), or one in the recent list or the library index, never an arbitrary path.
 *  - `library.json` remembers each lesson's subject, page count and a small picture of its first page,
 *    so the library can be shown without opening every file.
 */
export class Lessons {
  /** paths chosen in a dialog since the app started */
  private chosen = new Set<string>()
  /** Changes to the lists (recent, index, link) happen one at a time, in the order asked, so none is lost. */
  private queue: Promise<unknown> = Promise.resolve()
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn)
    this.queue = run.catch(() => {})
    return run
  }

  constructor(private dir: string, readonly libraryDir: string,
    private bin: (path: string) => Promise<void> = async (p) => { await fs.rm(p) }) {}

  private async write(name: string, text: string): Promise<void> {
    const path = join(this.dir, name)
    await fs.mkdir(this.dir, { recursive: true })
    await fs.writeFile(path + '.tmp', text, 'utf8')
    await fs.rename(path + '.tmp', path)
  }

  private async readList(): Promise<{ path: string; savedAt: string }[]> {
    try {
      const rows = JSON.parse(await fs.readFile(join(this.dir, 'recent.json'), 'utf8')) as unknown
      if (!Array.isArray(rows)) return []
      return rows.filter((r): r is { path: string; savedAt: string } => !!r && okPath(r.path) && typeof r.savedAt === 'string').slice(0, MAX_RECENT)
    } catch { return [] }
  }

  private async readIndex(): Promise<Record<string, Entry>> {
    try {
      const raw = JSON.parse(await fs.readFile(join(this.dir, 'library.json'), 'utf8')) as unknown
      return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, Entry> : {}
    } catch { return {} }
  }

  private async writeIndex(index: Record<string, Entry>): Promise<void> { await this.write('library.json', JSON.stringify(index)) }

  /** Inside the library folder. */
  private inLibrary(path: string): boolean {
    const rel = relative(this.libraryDir, path)
    return !!rel && !rel.startsWith('..') && !isAbsolute(rel)
  }

  /** Recent lessons, newest first, leaving out files that have since gone. */
  async recent(): Promise<RecentLesson[]> {
    const out: RecentLesson[] = []
    for (const row of await this.readList()) {
      try { await fs.access(row.path); out.push({ path: row.path, name: lessonName(row.path), savedAt: row.savedAt }) } catch { /* moved or deleted */ }
    }
    return out
  }

  /** The teacher picked this path in a dialog: it may be written to. */
  allow(path: string): void { if (okPath(path)) this.chosen.add(path) }

  private async mayUse(path: unknown): Promise<boolean> {
    if (!okPath(path)) return false
    if (this.chosen.has(path) || this.inLibrary(path)) return true
    return (await this.readList()).some(r => r.path === path) || path in (await this.readIndex())
  }

  /** Put a lesson at the top of the recent list. */
  async remember(path: string): Promise<void> {
    if (!okPath(path)) return
    const rest = (await this.readList()).filter(r => r.path !== path)
    await this.write('recent.json', JSON.stringify([{ path, savedAt: new Date().toISOString() }, ...rest].slice(0, MAX_RECENT)))
  }

  forget(path: string): Promise<void> { return this.serial(() => this.forgetNow(path)) }

  private async forgetNow(path: string): Promise<void> {
    await this.write('recent.json', JSON.stringify((await this.readList()).filter(r => r.path !== path)))
    const index = await this.readIndex()
    if (path in index) { delete index[path]; await this.writeIndex(index) }
  }

  /** A path for a new lesson called `name` in the library folder, not yet taken by another file. */
  private async freePath(name: string, folder = this.libraryDir): Promise<string> {
    await fs.mkdir(folder, { recursive: true })
    const base = fileSafe(name)
    for (let n = 1; ; n++) {
      const path = join(folder, `${n === 1 ? base : `${base} (${n})`}.wbd`)
      try { await fs.access(path) } catch { return path }
    }
  }

  /** Room for a new lesson in the library: its path, to save to straight away. */
  create(name: unknown, subject: unknown): Promise<string | null> { return this.serial(() => this.createNow(name, subject)) }

  private async createNow(name: unknown, subject: unknown): Promise<string | null> {
    if (typeof name !== 'string' || !name.trim()) return null
    const path = await this.freePath(name.trim())
    const index = await this.readIndex()
    index[path] = { subject: cleanSubject(subject), pages: 1, kind: 'notebook', created: new Date().toISOString() }
    await this.writeIndex(index)
    this.chosen.add(path)
    return path
  }

  /** Write the lesson to its file, whole or not at all, and note what the library shows about it. */
  save(path: unknown, json: unknown, info?: unknown): Promise<SaveResult> { return this.serial(() => this.saveNow(path, json, info)) }

  private async saveNow(path: unknown, json: unknown, info?: unknown): Promise<SaveResult> {
    try {
      if (!okPath(path) || !(await this.mayUse(path))) throw new Error('That file was not chosen by you in this app')
      if (typeof json !== 'string' || Buffer.byteLength(json) > MAX_FILE_BYTES) throw new Error('The lesson is too large to save (maximum 300 MB)')
      if (!parseBoard(json)) throw new Error('The lesson could not be checked, so nothing was written')
      await fs.mkdir(dirname(path), { recursive: true })
      const tmp = path + '.saving'
      await fs.writeFile(tmp, json, 'utf8')
      await fs.rename(tmp, path)
      this.chosen.add(path)
      await this.remember(path)
      if (info && typeof info === 'object') await this.note(path, info as Partial<LessonInfo>)
      return { ok: true }
    } catch (error) { return { ok: false, error: saveError(error) } }
  }

  private async note(path: string, info: Partial<LessonInfo>): Promise<void> {
    const index = await this.readIndex()
    const old = index[path]
    index[path] = {
      subject: info.subject !== undefined ? cleanSubject(info.subject) : old?.subject ?? '',
      pages: Number.isInteger(info.pages) && info.pages! > 0 && info.pages! < 10_000 ? info.pages! : old?.pages ?? 1,
      kind: info.kind === 'canvas' || info.kind === 'notebook' ? info.kind : old?.kind ?? 'notebook',
      created: old?.created ?? new Date().toISOString(),
      ...(typeof info.thumb === 'string' && info.thumb.length <= MAX_THUMB && /^data:image\/(?:webp|png|jpeg);base64,/.test(info.thumb) ? { thumb: info.thumb } : old?.thumb ? { thumb: old.thumb } : {})
    }
    await this.writeIndex(index)
  }

  /** Read back a lesson the teacher chose, opened lately, or keeps in the library. */
  async open(path: unknown): Promise<{ path: string; json: string } | null> {
    if (!okPath(path) || !(await this.mayUse(path))) return null
    try {
      if ((await fs.stat(path)).size > MAX_FILE_BYTES) throw new Error('Lesson file exceeds 300 MB')
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error }
    const json = await fs.readFile(path, 'utf8')
    this.chosen.add(path)
    await this.serial(() => this.remember(path))
    return { path, json }
  }

  /**
   * Every lesson the teacher has: the files in the library folder, plus lessons kept elsewhere that
   * were opened or saved here. Missing files are left out (and dropped from the index).
   */
  async library(): Promise<LibraryLesson[]> {
    const index = await this.readIndex()
    const paths = new Set<string>([...Object.keys(index), ...(await this.readList()).map(r => r.path)])
    try {
      for (const name of await fs.readdir(this.libraryDir)) if (extname(name).toLowerCase() === '.wbd') paths.add(join(this.libraryDir, name))
    } catch { /* no library yet */ }
    const out: LibraryLesson[] = []
    let gone = false
    for (const path of paths) {
      if (!okPath(path)) continue
      try {
        const st = await fs.stat(path)
        const e = index[path]
        out.push({ path, name: lessonName(path), subject: e?.subject ?? '', pages: e?.pages ?? 0, kind: e?.kind ?? 'notebook',
          modified: st.mtime.toISOString(), created: e?.created ?? st.birthtime.toISOString(), thumb: e?.thumb, inLibrary: this.inLibrary(path) })
      } catch { if (path in index) { delete index[path]; gone = true } }
    }
    if (gone) await this.writeIndex(index)
    return out.sort((a, b) => b.modified.localeCompare(a.modified))
  }

  /** Give a lesson a new name: its file is renamed in place. Returns the new path. */
  rename(path: unknown, name: unknown): Promise<{ ok: true; path: string } | { ok: false; error: string }> { return this.serial(() => this.renameNow(path, name)) }

  private async renameNow(path: unknown, name: unknown): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
    try {
      if (!okPath(path) || !(await this.mayUse(path)) || typeof name !== 'string' || !name.trim()) throw new Error('That lesson cannot be renamed')
      if (fileSafe(name) === lessonName(path)) return { ok: true, path }
      const target = await this.freePath(name.trim(), dirname(path))
      await fs.rename(path, target)
      await this.moved(path, target)
      return { ok: true, path: target }
    } catch (error) { return { ok: false, error: saveError(error) } }
  }

  /** A copy of a lesson next to it, named "… (copy)". Returns the copy's path. */
  duplicate(path: unknown): Promise<string | null> { return this.serial(() => this.duplicateNow(path)) }

  private async duplicateNow(path: unknown): Promise<string | null> {
    if (!okPath(path) || !(await this.mayUse(path))) return null
    const target = await this.freePath(`${lessonName(path)} (copy)`, dirname(path))
    await fs.copyFile(path, target)
    const index = await this.readIndex()
    if (index[path]) { index[target] = { ...index[path], created: new Date().toISOString() }; await this.writeIndex(index) }
    this.chosen.add(target)
    return target
  }

  /** Move a lesson to the Recycle Bin (it can be restored from there). */
  remove(path: unknown): Promise<SaveResult> { return this.serial(() => this.removeNow(path)) }

  private async removeNow(path: unknown): Promise<SaveResult> {
    try {
      if (!okPath(path) || !(await this.mayUse(path))) throw new Error('That lesson cannot be deleted from here')
      await this.bin(path)
      await this.forgetNow(path)
      this.chosen.delete(path)
      return { ok: true }
    } catch (error) { return { ok: false, error: saveError(error) } }
  }

  setSubject(path: unknown, subject: unknown): Promise<SaveResult> {
    return this.serial(async () => {
      if (!okPath(path) || !(await this.mayUse(path))) return { ok: false, error: 'Unknown lesson' }
      await this.note(path, { subject: cleanSubject(subject) })
      return { ok: true }
    })
  }

  /** A file was renamed: the recent list, the index and the board's link follow it. */
  private async moved(from: string, to: string): Promise<void> {
    this.chosen.delete(from); this.chosen.add(to)
    await this.write('recent.json', JSON.stringify((await this.readList()).map(r => r.path === from ? { ...r, path: to } : r)))
    const index = await this.readIndex()
    if (index[from]) { index[to] = index[from]; delete index[from]; await this.writeIndex(index) }
    const link = await this.link()
    if (link.path === from) await this.write('lesson.json', JSON.stringify({ ...link, path: to }))
  }

  /** Which file the lesson on the board belongs to, and whether it has changes the file does not. */
  async link(): Promise<LessonLink> {
    try {
      const raw = JSON.parse(await fs.readFile(join(this.dir, 'lesson.json'), 'utf8')) as Partial<LessonLink>
      const path = okPath(raw.path) ? raw.path : null
      if (path) this.chosen.add(path)
      return { path, dirty: raw.dirty !== false }
    } catch { return { path: null, dirty: true } }
  }

  setLink(link: unknown): Promise<SaveResult> { return this.serial(() => this.setLinkNow(link)) }

  private async setLinkNow(link: unknown): Promise<SaveResult> {
    try {
      const l = (link ?? {}) as Partial<LessonLink>
      if (l.path !== null && (!okPath(l.path) || !(await this.mayUse(l.path)))) throw new Error('Unknown lesson file')
      await this.write('lesson.json', JSON.stringify({ path: l.path ?? null, dirty: l.dirty !== false }))
      return { ok: true }
    } catch (error) { return { ok: false, error: saveError(error) } }
  }
}
