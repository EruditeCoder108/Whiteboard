import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { parseBoard } from '../renderer/src/engine/serialize'
import type { BackupInfo, BoardLoad, SaveResult } from '../shared/api'
import { parseRecording } from '../renderer/src/engine/replay'

const BACKUPS = 5
export const MAX_FILE_BYTES = 300 * 1024 * 1024
const ASSET_KEY = /^[0-9a-f]{16,32}$/
const MAX_ASSET_CHARS = 40 * 1024 * 1024
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
      if ((await fs.stat(path)).size > MAX_FILE_BYTES) throw new Error('Board file is too large (maximum 300 MB)')
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

  /** Pictures are content-addressed files, written once and shared by the board and its backups. */
  private async writeAssets(assets: unknown): Promise<void> {
    if (assets === undefined) return
    if (!assets || typeof assets !== 'object' || Array.isArray(assets)) throw new Error('Invalid pictures')
    for (const [key, data] of Object.entries(assets as Record<string, unknown>)) {
      if (!ASSET_KEY.test(key) || typeof data !== 'string' || data.length > MAX_ASSET_CHARS || !/^data:image\/(?:png|jpeg|webp|gif|svg\+xml)[;,]/.test(data)) throw new Error('Invalid picture data')
      const name = join('assets', key + '.txt')
      try { await fs.access(join(this.dir, name)) } catch { await fs.mkdir(join(this.dir, 'assets'), { recursive: true }); await this.atomic(name, data) }
    }
  }

  /** Embed the referenced pictures, so the renderer receives a self-contained board. */
  private async withAssets(json: string): Promise<string> {
    const head = json.slice(0, 200)
    if (!head.includes('"version":4')) return json
    const file = JSON.parse(json) as { assetKeys?: unknown; assets?: unknown }
    if (file.assets || !Array.isArray(file.assetKeys)) return json
    const assets: Record<string, string> = {}
    for (const key of file.assetKeys) {
      if (typeof key !== 'string' || !ASSET_KEY.test(key)) continue
      try { assets[key] = await fs.readFile(join(this.dir, 'assets', key + '.txt'), 'utf8') } catch { /* a missing picture is skipped on load */ }
    }
    return json.slice(0, json.lastIndexOf('}')) + ',"assets":' + JSON.stringify(assets) + '}'
  }

  /** Delete pictures that neither the board nor any backup references any more. */
  async collectAssets(): Promise<void> {
    await this.queues.get('board.json')?.catch(() => {})
    let files: string[]
    try { files = await fs.readdir(join(this.dir, 'assets')) } catch { return }
    const used = new Set<string>()
    for (const name of ['board.json', ...Array.from({ length: BACKUPS }, (_, i) => `board.backup-${i + 1}.json`)]) {
      const json = await this.read(name).catch(() => null)
      if (json === null) continue
      if (!json.slice(0, 200).includes('"version":4')) continue
      try { for (const key of (JSON.parse(json).assetKeys ?? []) as unknown[]) if (typeof key === 'string') used.add(key) } catch { return } // never delete while a file is unreadable
    }
    const day = Date.now() - 24 * 3600 * 1000
    for (const file of files) {
      const key = file.replace(/\.txt$/, '')
      if (!ASSET_KEY.test(key) || used.has(key)) continue
      const path = join(this.dir, 'assets', file)
      if ((await fs.stat(path)).mtimeMs < day) await fs.unlink(path).catch(() => {})
    }
  }

  async saveBoard(json: string, assets?: unknown): Promise<SaveResult> {
    try {
      if (typeof json !== 'string' || Buffer.byteLength(json) > MAX_FILE_BYTES) throw new Error('Board exceeds the 300 MB save limit')
      await this.writeAssets(assets)
      const parsed = parseBoard(json, { externalAssets: true })
      if (!parsed || parsed.skipped || parsed.legacy) throw new Error('Board validation failed; the previous save was preserved')
      await this.enqueue('board.json', async () => {
        const previous = await this.read('board.json')
        if (previous === json) return
        if (previous !== null) {
          const valid = parseBoard(previous, { externalAssets: true })
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
      if (current !== null) current = await this.withAssets(current)
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
    const raw = await this.read(id)
    const json = raw === null ? null : await this.withAssets(raw)
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
        const parsed = json === null ? null : parseBoard(json, { externalAssets: true })
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
