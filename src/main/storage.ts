import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { parseBoard } from '../renderer/src/engine/serialize'
import type { BackupInfo, BoardLoad, SaveResult } from '../shared/api'
import { parseRecording } from '../renderer/src/engine/replay'

const BACKUPS = 5
export const MAX_FILE_BYTES = 50 * 1024 * 1024
export const saveError = (error: unknown): string => error instanceof Error ? error.message : 'Could not save to disk'

function validRecordingLibrary(json: string): boolean {
  try {
    if (typeof json !== 'string' || Buffer.byteLength(json) > MAX_FILE_BYTES) return false
    const rows = JSON.parse(json)
    if (!Array.isArray(rows) || rows.length > 100) return false
    const ids = new Set<string>()
    return rows.every(row => {
      const recording = parseRecording(JSON.stringify(row))
      if (!recording || ids.has(recording.id)) return false
      ids.add(recording.id); return true
    })
  } catch { return false }
}

/** Serialize writes per file so autosave and shutdown cannot race on a temporary file. */
export class DiskStore {
  private queues = new Map<string, Promise<void>>()
  private lastBackup = 0

  constructor(private dir: string, private backupInterval = 60_000) {}

  private async read(name: string): Promise<string | null> {
    const path = join(this.dir, name)
    try {
      if ((await fs.stat(path)).size > MAX_FILE_BYTES) throw new Error('Board file is too large (maximum 50 MB)')
      return await fs.readFile(path, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  private enqueue(name: string, work: () => Promise<void>): Promise<void> {
    const next = (this.queues.get(name) ?? Promise.resolve()).catch(() => {}).then(work)
    this.queues.set(name, next)
    // Keep the original rejection available to the caller, without an unhandled rejection.
    void next.catch(() => {})
    return next
  }

  private async atomic(name: string, text: string): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true })
    const path = join(this.dir, name)
    const tmp = path + '.tmp'
    const handle = await fs.open(tmp, 'w')
    try {
      await handle.writeFile(text, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    await fs.rename(tmp, path)
  }

  async saveText(name: 'settings.json' | 'window.json', text: string): Promise<SaveResult> {
    try {
      await this.enqueue(name, () => this.atomic(name, text))
      return { ok: true }
    } catch (error) {
      return { ok: false, error: saveError(error) }
    }
  }

  async loadRecordings(): Promise<{ json: string | null; error?: string }> {
    try {
      const json = await this.read('recordings.json')
      if (json !== null && !validRecordingLibrary(json)) throw new Error('Your recording library could not be read. The original is preserved; you can still export new recordings.')
      return { json }
    } catch (error) { return { json: null, error: saveError(error) } }
  }

  async saveRecordings(json: string): Promise<SaveResult> {
    try {
      if (!validRecordingLibrary(json)) throw new Error('Recording library is invalid or exceeds 50 MB')
      await this.enqueue('recordings.json', async () => {
        const previous = await this.read('recordings.json')
        if (previous !== null && !validRecordingLibrary(previous)) throw new Error('Damaged recording library preserved; export your recording to a file instead')
        if (previous === json) return
        if (previous) await this.atomic('recordings.backup.json', previous)
        await this.atomic('recordings.json', json)
      })
      return { ok: true }
    } catch (error) { return { ok: false, error: saveError(error) } }
  }

  async saveBoard(json: string): Promise<SaveResult> {
    try {
      if (typeof json !== 'string' || Buffer.byteLength(json) > MAX_FILE_BYTES) throw new Error('Board exceeds the 50 MB save limit')
      const parsed = parseBoard(json)
      if (!parsed || parsed.skipped || parsed.legacy) throw new Error('Board validation failed; the previous save was preserved')
      await this.enqueue('board.json', async () => {
        const previous = await this.read('board.json')
        if (previous === json) return
        if (previous !== null) {
          const valid = parseBoard(previous)
          if (!valid || valid.skipped) {
            // Never replace damaged data without retaining the original for manual recovery.
            await this.atomic(`board-damaged-${Date.now()}.json`, previous)
          } else if (Date.now() - this.lastBackup >= this.backupInterval) {
            // Read all sources before rotating; each individual replacement remains atomic.
            const older = await Promise.all(Array.from({ length: BACKUPS - 1 }, async (_, i) => {
              const name = `board.backup-${i + 1}.json`
              const text = await this.read(name)
              return text === null ? null : { text, time: (await fs.stat(join(this.dir, name))).mtime }
            }))
            for (let i = older.length - 1; i >= 0; i--) {
              const snapshot = older[i]
              if (snapshot) {
                const name = `board.backup-${i + 2}.json`
                await this.atomic(name, snapshot.text)
                await fs.utimes(join(this.dir, name), snapshot.time, snapshot.time)
              }
            }
            const time = (await fs.stat(join(this.dir, 'board.json'))).mtime
            await this.atomic('board.backup-1.json', previous)
            await fs.utimes(join(this.dir, 'board.backup-1.json'), time, time)
            this.lastBackup = Date.now()
          }
        }
        await this.atomic('board.json', json)
      })
      return { ok: true }
    } catch (error) {
      return { ok: false, error: saveError(error) }
    }
  }

  async loadBoard(): Promise<BoardLoad> {
    let current: string | null = null
    let problem: string | undefined
    try {
      current = await this.read('board.json')
      const parsed = current === null ? null : parseBoard(current)
      if (parsed && !parsed.skipped) return { json: current, recovered: false }
      if (current !== null) problem = 'The latest autosave could not be read completely'
    } catch (error) {
      problem = saveError(error)
    }
    for (let i = 1; i <= BACKUPS; i++) {
      try {
        const json = await this.loadBackup(`board.backup-${i}.json`)
        if (json !== null) return { json, recovered: true, message: 'Recovered your board from an automatic backup' }
      } catch { /* try the next snapshot */ }
    }
    const partial = current === null ? null : parseBoard(current)
    if (partial) return { json: current, recovered: true, message: `Recovered readable content; ${partial.skipped} damaged object(s) were skipped. The original will be retained.` }
    return { json: null, recovered: false, message: problem ? `${problem}. Your original file is preserved; you can open another board or draw a new one.` : undefined }
  }

  async loadBackup(id: string): Promise<string | null> {
    if (!/^board\.backup-[1-5]\.json$/.test(id)) return null
    // A rotation must finish before resolving a numbered snapshot.
    await this.queues.get('board.json')?.catch(() => {})
    const json = await this.read(id)
    const parsed = json === null ? null : parseBoard(json)
    return parsed && !parsed.skipped ? json : null
  }

  async listBackups(): Promise<BackupInfo[]> {
    await this.queues.get('board.json')?.catch(() => {})
    const out: BackupInfo[] = []
    for (let i = 1; i <= BACKUPS; i++) {
      const id = `board.backup-${i}.json`
      try {
        const json = await this.read(id)
        const parsed = json === null ? null : parseBoard(json)
        if (!parsed || parsed.skipped) continue
        const stat = await fs.stat(join(this.dir, id))
        out.push({ id, savedAt: stat.mtime.toISOString(), itemCount: parsed.items.length })
      } catch { /* omit unreadable snapshots */ }
    }
    return out
  }

  async flush(): Promise<void> {
    await Promise.all([...this.queues.values()])
  }
}
