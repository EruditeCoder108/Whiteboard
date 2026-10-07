import { afterEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { DiskStore } from '../src/main/storage'
import { serializeBoard } from '@/engine/serialize'
import { ReplayRecorder, serializeRecording } from '@/engine/replay'

const folders: string[] = []
async function fixture(interval = 0) {
  const dir = await fs.mkdtemp(join(tmpdir(), 'fw-storage-test-'))
  folders.push(dir)
  return { dir, store: new DiskStore(dir, interval) }
}
const board = (n: number) => serializeBoard([{ t: 's', id: 's', c: '#111111', w: 3, m: false, v: false, p: [n, 0, 0.5] }])

afterEach(async () => {
  for (const dir of folders.splice(0)) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep) || !dir.includes('fw-storage-test-')) throw new Error('Unsafe test cleanup')
    await fs.rm(dir, { recursive: true, force: true })
  }
})

describe('confirmed disk saves and recovery', () => {
  const library = (title: string) => `[${serializeRecording(new ReplayRecorder([], { x: 0, y: 0, zoom: 1 }, { w: 900, h: 600 }, '#ffffff', title).snapshot())}]`
  it('saves overlapping recording-library writes atomically and retains a backup', async () => {
    const { dir, store } = await fixture(), first = library('First'), second = library('Second')
    expect(await Promise.all([store.saveRecordings(first), store.saveRecordings(second)])).toEqual([{ ok: true }, { ok: true }])
    expect((await store.loadRecordings()).json).toBe(second)
    expect(await fs.readFile(join(dir, 'recordings.backup.json'), 'utf8')).toBe(first)
  })
  it('rejects damaged recording steps without replacing the saved library', async () => {
    const { store } = await fixture(), good = library('Lesson')
    await store.saveRecordings(good)
    const bad = JSON.parse(good); bad[0].initial = [{ t: 's', id: 'bad' }]
    expect((await store.saveRecordings(JSON.stringify(bad))).ok).toBe(false)
    expect((await store.loadRecordings()).json).toBe(good)
  })
  it('preserves a damaged recording library and reports the failure', async () => {
    const { dir, store } = await fixture()
    await fs.writeFile(join(dir, 'recordings.json'), 'damaged')
    expect((await store.loadRecordings()).error).toContain('original is preserved')
    expect((await store.saveRecordings(library('New'))).ok).toBe(false)
    expect(await fs.readFile(join(dir, 'recordings.json'), 'utf8')).toBe('damaged')
  })
  it('serializes overlapping autosaves and retains the newest board', async () => {
    const { store, dir } = await fixture()
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => store.saveBoard(board(i))))
    expect(results).toEqual(Array.from({ length: 8 }, () => ({ ok: true })))
    await store.flush()
    expect(await fs.readFile(join(dir, 'board.json'), 'utf8')).toBe(board(7))
    expect((await store.listBackups()).length).toBe(5)
    expect(await store.loadBackup('board.backup-1.json')).toBe(board(6))
    expect(await store.loadBackup('board.backup-5.json')).toBe(board(2))
  })

  it('reports an atomic write failure without damaging the previous save; retry succeeds', async () => {
    const { store, dir } = await fixture()
    await store.saveBoard(board(1))
    const obstacle = join(dir, 'board.json.tmp')
    await fs.mkdir(obstacle)
    const result = await store.saveBoard(board(2))
    expect(result.ok).toBe(false)
    expect(await fs.readFile(join(dir, 'board.json'), 'utf8')).toBe(board(1))
    await fs.rmdir(obstacle)
    expect((await store.saveBoard(board(2))).ok).toBe(true)
    expect((await store.loadBoard()).json).toBe(board(2))
  })

  it('recovers a damaged primary from a valid backup and preserves the damaged original on save', async () => {
    const { store, dir } = await fixture()
    await store.saveBoard(board(1))
    await store.saveBoard(board(2))
    await fs.writeFile(join(dir, 'board.json'), '{broken')
    expect(await store.loadBoard()).toMatchObject({ json: board(1), recovered: true })
    expect((await store.saveBoard(board(3))).ok).toBe(true)
    const damaged = (await fs.readdir(dir)).find((name) => name.startsWith('board-damaged-'))!
    expect(await fs.readFile(join(dir, damaged), 'utf8')).toBe('{broken')
  })

  it('tries older snapshots when the newest backup is damaged', async () => {
    const { store, dir } = await fixture()
    for (let i = 1; i <= 3; i++) await store.saveBoard(board(i))
    await fs.writeFile(join(dir, 'board.json'), 'bad')
    await fs.writeFile(join(dir, 'board.backup-1.json'), 'bad')
    expect(await store.loadBoard()).toMatchObject({ json: board(1), recovered: true })
  })

  it('keeps snapshots across frequent saves instead of rotating every stroke', async () => {
    const { store } = await fixture(60_000)
    for (let i = 1; i <= 4; i++) await store.saveBoard(board(i))
    expect((await store.listBackups()).length).toBe(1)
    expect(await store.loadBackup('board.backup-1.json')).toBe(board(1))
  })

  it('retains snapshot timestamps when rotating and does not snapshot identical saves', async () => {
    const { store, dir } = await fixture()
    await store.saveBoard(board(1))
    const earlier = new Date('2025-01-02T03:04:05Z')
    await fs.utimes(join(dir, 'board.json'), earlier, earlier)
    await store.saveBoard(board(2))
    await store.saveBoard(board(3))
    await store.saveBoard(board(3))
    const list = await store.listBackups()
    expect(list.length).toBe(2)
    expect(list[1].savedAt).toBe(earlier.toISOString())
  })

  it('rejects invalid new data and backup paths without replacing the current board', async () => {
    const { store } = await fixture()
    await store.saveBoard(board(1))
    expect((await store.saveBoard('{"format":"floating-whiteboard","version":3,"items":[]}')).ok).toBe(false)
    expect((await store.loadBoard()).json).toBe(board(1))
    expect(await store.loadBackup('../board.json')).toBeNull()
  })

  it('does not mistake a missing first-run board for corruption', async () => {
    const { store } = await fixture()
    expect(await store.loadBoard()).toEqual({ json: null, recovered: false, message: undefined })
  })
})
