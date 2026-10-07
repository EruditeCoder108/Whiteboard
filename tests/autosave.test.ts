import { afterEach, describe, expect, it, vi } from 'vitest'
import { Autosave } from '@/state/autosave'
import type { SaveStatus } from '@/state/autosave'
import type { SaveResult } from '../src/shared/api'

afterEach(() => vi.useRealTimers())

describe('autosave acknowledgements', () => {
  it('waits for disk completion and saves edits made while an older write is in flight', async () => {
    let content = 'first'
    let finish!: (result: SaveResult) => void
    const states: SaveStatus[] = []
    const write = vi.fn().mockImplementationOnce(() => new Promise<SaveResult>((resolve) => { finish = resolve })).mockResolvedValue({ ok: true })
    const save = new Autosave(() => content, write, (state) => states.push(state))
    save.markDirty()
    const flushing = save.flush()
    expect(states.at(-1)).toBe('saving')
    content = 'second'
    save.markDirty()
    finish({ ok: true })
    expect(await flushing).toBe(true)
    expect(write.mock.calls.map((call) => call[0])).toEqual(['first', 'second'])
    expect(states.at(-1)).toBe('saved')
    save.dispose()
  })

  it('keeps a failed revision dirty so manual retry can save it', async () => {
    const states: SaveStatus[] = []
    const write = vi.fn().mockResolvedValueOnce({ ok: false, error: 'Disk full' }).mockResolvedValue({ ok: true })
    const save = new Autosave(() => 'board', write, (state) => states.push(state))
    save.markDirty()
    expect(await save.flush()).toBe(false)
    expect(states.at(-1)).toBe('error')
    expect(await save.flush()).toBe(true)
    expect(write).toHaveBeenCalledTimes(2)
    expect(states.at(-1)).toBe('saved')
    save.dispose()
  })

  it('handles a disconnected IPC bridge and coalesces debounced edits', async () => {
    vi.useFakeTimers()
    const status = vi.fn()
    const write = vi.fn().mockRejectedValueOnce(new Error('Disconnected')).mockResolvedValue({ ok: true })
    const save = new Autosave(() => 'board', write, status, 1000)
    save.markDirty()
    await vi.advanceTimersByTimeAsync(600)
    save.markDirty()
    await vi.advanceTimersByTimeAsync(600)
    expect(write).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(400)
    expect(status).toHaveBeenLastCalledWith('error', 'Disconnected')
    expect(await save.flush()).toBe(true)
    save.dispose()
  })
})
