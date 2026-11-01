import { createHash, randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { parseBoard } from '../renderer/src/engine/serialize'
import type { SaveResult, ShelfImport, ShelfItem, ShelfKind, ShelfNew } from '../shared/api'
import { cleanSubject } from './lessons'
import { MAX_FILE_BYTES, saveError } from './storage'

const MAX_TITLE = 100
const MAX_THUMB = 80_000
const MAX_FROM = 100
/** A shelf file brought from another classroom PC: every saved item, with its pictures inside. */
const COLLECTION = 'floating-whiteboard-shelf'

const okId = (id: unknown): id is string => typeof id === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)
const cleanTitle = (v: unknown): string => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, MAX_TITLE) : ''
const okKind = (v: unknown): v is ShelfKind => v === 'selection' || v === 'page'
const okDate = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))
const okThumb = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_THUMB && /^data:image\/(?:webp|png|jpeg);base64,/.test(v)
const hashOf = (json: string): string => createHash('sha256').update(json).digest('hex').slice(0, 32)

/** What is kept about an item, from anything read back from disk or from an imported file. */
function cleanMeta(raw: unknown): Omit<ShelfItem, 'id' | 'hash'> | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Record<string, unknown>
  const title = cleanTitle(m.title)
  if (!title || !okKind(m.kind)) return null
  return {
    title, subject: cleanSubject(m.subject), kind: m.kind,
    created: okDate(m.created) ? m.created : new Date().toISOString(),
    ...(okDate(m.used) ? { used: m.used } : {}),
    count: Number.isInteger(m.count) && (m.count as number) >= 0 ? m.count as number : 0,
    ...(typeof m.from === 'string' && m.from ? { from: m.from.slice(0, MAX_FROM) } : {}),
    ...(okThumb(m.thumb) ? { thumb: m.thumb } : {})
  }
}

/** The board file of an item is checked exactly like a lesson; it must hold one page. */
const validBoard = (json: unknown): json is string => typeof json === 'string' && Buffer.byteLength(json) <= MAX_FILE_BYTES && !!parseBoard(json)?.pages?.length

/**
 * The teacher's own saved diagrams and pages, kept in the app's data folder, one folder per item:
 * `meta.json` (name, subject, a small picture) and `board.json` (the objects, with their pictures
 * inside, in the lesson file format). An item appears whole or not at all, and no shared index can
 * lose the rest of the shelf if one item goes bad.
 */
export class Shelf {
  private queue: Promise<unknown> = Promise.resolve()
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn)
    this.queue = run.catch(() => {})
    return run
  }

  constructor(private dir: string, private bin: (path: string) => Promise<void> = (p) => fs.rm(p, { recursive: true })) {}

  private async readItem(id: string): Promise<ShelfItem | null> {
    try {
      const raw = JSON.parse(await fs.readFile(join(this.dir, id, 'meta.json'), 'utf8')) as Record<string, unknown>
      const meta = cleanMeta(raw)
      return meta && { ...meta, id, hash: typeof raw.hash === 'string' ? raw.hash : '' }
    } catch { return null }
  }

  /** Everything on the shelf, what was used or saved last first. Damaged items are left out. */
  async list(): Promise<ShelfItem[]> {
    let names: string[] = []
    try { names = await fs.readdir(this.dir) } catch { return [] }
    const items = await Promise.all(names.filter(okId).map(id => this.readItem(id)))
    return items.filter((it): it is ShelfItem => !!it).sort((a, b) => (b.used ?? b.created).localeCompare(a.used ?? a.created))
  }

  private async add(meta: Omit<ShelfItem, 'id' | 'hash'>, json: string): Promise<ShelfItem> {
    const id = randomUUID(), hash = hashOf(json)
    const tmp = join(this.dir, `${id}.saving`)
    await fs.mkdir(tmp, { recursive: true })
    try {
      await fs.writeFile(join(tmp, 'board.json'), json, 'utf8')
      await fs.writeFile(join(tmp, 'meta.json'), JSON.stringify({ ...meta, hash }), 'utf8')
      await fs.rename(tmp, join(this.dir, id))
    } catch (error) {
      await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
      throw error
    }
    return { ...meta, id, hash }
  }

  save(info: unknown, json: unknown): Promise<{ ok: true; item: ShelfItem } | { ok: false; error: string }> {
    return this.serial(async () => {
      try {
        const meta = cleanMeta({ ...(info as ShelfNew), created: new Date().toISOString() })
        if (!meta) throw new Error('It needs a name')
        if (!validBoard(json)) throw new Error('It could not be checked, so nothing was saved')
        return { ok: true as const, item: await this.add(meta, json) }
      } catch (error) { return { ok: false as const, error: saveError(error) } }
    })
  }

  /** The item's board file, ready to be placed; it moves to the front of the shelf. */
  read(id: unknown): Promise<string | null> {
    return this.serial(async () => {
      if (!okId(id)) return null
      try {
        const json = await fs.readFile(join(this.dir, id, 'board.json'), 'utf8')
        await this.patch(id, { used: new Date().toISOString() }).catch(() => {})
        return json
      } catch { return null }
    })
  }

  private async patch(id: string, change: Partial<ShelfItem>): Promise<void> {
    const old = await this.readItem(id)
    if (!old) throw new Error('That item is no longer on the shelf')
    const path = join(this.dir, id, 'meta.json')
    const { id: _id, ...rest } = { ...old, ...change }
    await fs.writeFile(path + '.tmp', JSON.stringify(rest), 'utf8')
    await fs.rename(path + '.tmp', path)
  }

  /** A new name or subject. */
  update(id: unknown, change: unknown): Promise<SaveResult> {
    return this.serial(async () => {
      try {
        if (!okId(id)) throw new Error('That item is no longer on the shelf')
        const c = (change ?? {}) as { title?: unknown; subject?: unknown }
        const title = c.title !== undefined ? cleanTitle(c.title) : undefined
        if (title === '') throw new Error('It needs a name')
        await this.patch(id, { ...(title ? { title } : {}), ...(c.subject !== undefined ? { subject: cleanSubject(c.subject) } : {}) })
        return { ok: true }
      } catch (error) { return { ok: false, error: saveError(error) } }
    })
  }

  /** To the Recycle Bin, as one folder, so it can still be restored from there. */
  remove(id: unknown): Promise<SaveResult> {
    return this.serial(async () => {
      try {
        if (!okId(id) || !(await this.readItem(id))) throw new Error('That item is no longer on the shelf')
        await this.bin(join(this.dir, id))
        return { ok: true }
      } catch (error) { return { ok: false, error: saveError(error) } }
    })
  }

  /** The whole shelf as one file, to carry to another classroom PC. */
  exportTo(path: string): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
    return this.serial(async () => {
      try {
        const out: unknown[] = []
        for (const it of await this.list()) {
          const { id, hash: _hash, used: _used, ...meta } = it
          out.push({ ...meta, board: await fs.readFile(join(this.dir, id, 'board.json'), 'utf8') })
        }
        const text = JSON.stringify({ format: COLLECTION, version: 1, items: out })
        if (Buffer.byteLength(text) > MAX_FILE_BYTES) throw new Error('The shelf is too large for one file (maximum 300 MB)')
        await fs.writeFile(path + '.saving', text, 'utf8')
        await fs.rename(path + '.saving', path)
        return { ok: true as const, count: out.length }
      } catch (error) { return { ok: false as const, error: saveError(error) } }
    })
  }

  /** Items from a shelf file. Each is checked like a lesson; what is already here is not added twice. */
  importFrom(path: string): Promise<ShelfImport> {
    return this.serial(async () => {
      try {
        if ((await fs.stat(path)).size > MAX_FILE_BYTES) throw new Error('That file is too large (maximum 300 MB)')
        const file = JSON.parse(await fs.readFile(path, 'utf8')) as { format?: unknown; version?: unknown; items?: unknown }
        if (file?.format !== COLLECTION || file.version !== 1 || !Array.isArray(file.items)) throw new Error('That is not a shelf file')
        const have = new Set((await this.list()).map(it => it.hash))
        const result = { ok: true as const, added: 0, same: 0, bad: 0 }
        for (const raw of file.items as Record<string, unknown>[]) {
          const meta = cleanMeta(raw)
          if (!meta || !validBoard(raw?.board)) { result.bad++; continue }
          const hash = hashOf(raw.board)
          if (have.has(hash)) { result.same++; continue }
          const { used: _used, ...kept } = meta
          await this.add(kept, raw.board)
          have.add(hash)
          result.added++
        }
        return result
      } catch (error) {
        return { ok: false as const, error: error instanceof SyntaxError ? 'That is not a shelf file' : saveError(error) }
      }
    })
  }
}
