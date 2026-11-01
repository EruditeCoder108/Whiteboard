import { promises as fs } from 'node:fs'
import { basename, extname, isAbsolute, join } from 'node:path'
import { parseBoard } from '../renderer/src/engine/serialize'
import type { LessonLink, RecentLesson, SaveResult } from '../shared/api'
import { MAX_FILE_BYTES, saveError } from './storage'

const MAX_RECENT = 8
const EXTENSIONS = ['.wbd', '.json']

/** "Maths ch 4.wbd" → "Maths ch 4" */
export const lessonName = (path: string): string => basename(path, extname(path))

const okPath = (path: unknown): path is string => typeof path === 'string' && isAbsolute(path) && EXTENSIONS.includes(extname(path).toLowerCase())

/**
 * The teacher's lesson files: which ones were opened or saved lately, and which file the lesson on
 * the board belongs to. The renderer may only write to, or read back, a path the teacher chose in a
 * file dialog (this session) or that is in the recent list, never an arbitrary one.
 */
export class Lessons {
  /** paths chosen in a dialog since the app started */
  private chosen = new Set<string>()

  constructor(private dir: string) {}

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
    return okPath(path) && (this.chosen.has(path) || (await this.readList()).some(r => r.path === path))
  }

  /** Put a lesson at the top of the recent list. */
  async remember(path: string): Promise<void> {
    if (!okPath(path)) return
    const rest = (await this.readList()).filter(r => r.path !== path)
    await this.write('recent.json', JSON.stringify([{ path, savedAt: new Date().toISOString() }, ...rest].slice(0, MAX_RECENT)))
  }

  async forget(path: string): Promise<void> {
    await this.write('recent.json', JSON.stringify((await this.readList()).filter(r => r.path !== path)))
  }

  /** Write the lesson to its file, whole or not at all. */
  async save(path: unknown, json: unknown): Promise<SaveResult> {
    try {
      if (!okPath(path) || !(await this.mayUse(path))) throw new Error('That file was not chosen by you in this app')
      if (typeof json !== 'string' || Buffer.byteLength(json) > MAX_FILE_BYTES) throw new Error('The lesson is too large to save (maximum 300 MB)')
      if (!parseBoard(json)) throw new Error('The lesson could not be checked, so nothing was written')
      const tmp = path + '.saving'
      await fs.writeFile(tmp, json, 'utf8')
      await fs.rename(tmp, path)
      this.chosen.add(path)
      await this.remember(path)
      return { ok: true }
    } catch (error) { return { ok: false, error: saveError(error) } }
  }

  /** Read back a lesson the teacher chose or opened lately. */
  async open(path: unknown): Promise<{ path: string; json: string } | null> {
    if (!okPath(path) || !(await this.mayUse(path))) return null
    if ((await fs.stat(path)).size > MAX_FILE_BYTES) throw new Error('Lesson file exceeds 300 MB')
    const json = await fs.readFile(path, 'utf8')
    this.chosen.add(path)
    await this.remember(path)
    return { path, json }
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

  async setLink(link: unknown): Promise<SaveResult> {
    try {
      const l = (link ?? {}) as Partial<LessonLink>
      if (l.path !== null && (!okPath(l.path) || !(await this.mayUse(l.path)))) throw new Error('Unknown lesson file')
      await this.write('lesson.json', JSON.stringify({ path: l.path ?? null, dirty: l.dirty !== false }))
      return { ok: true }
    } catch (error) { return { ok: false, error: saveError(error) } }
  }
}
