import { afterEach, describe, expect, it, vi } from 'vitest'
import { S, applySettings, snapshotSettings, startPersisting } from '@/state/store'

const original = snapshotSettings()
afterEach(() => {
  applySettings(original)
  S.settingsError.value = ''
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('settings persistence', () => {
  it('rejects invalid tools, colours and non-finite values, and bounds numeric settings', () => {
    applySettings({ tool: 'unknown', grid: 'invalid', penColor: '#12345', penSize: NaN, markerSize: 999, bgAlpha: -10, smoothing: Infinity, pressure: 'false', radialDelay: 50 })
    expect(S.tool.value).toBe(original.tool)
    expect(S.grid.value).toBe(original.grid)
    expect(S.penColor.value).toBe(original.penColor)
    expect(S.penSize.value).toBe(original.penSize)
    expect(S.markerSize.value).toBe(60)
    expect(S.bgAlpha.value).toBe(0)
    expect(S.smoothing.value).toBe(original.smoothing)
    expect(S.pressure.value).toBe(true)
    expect(S.radialDelay.value).toBe(300)
  })

  it('flushes the latest settings before the debounce fires and exposes write failures', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { setTimeout, clearTimeout })
    const save = vi.fn().mockResolvedValueOnce({ ok: false, error: 'Disk full' }).mockResolvedValue({ ok: true })
    const persistence = startPersisting(save)
    S.penSize.value = 9
    expect(await persistence.flush()).toBe(false)
    expect(save.mock.calls[0][0].penSize).toBe(9)
    expect(S.settingsError.value).toBe('Disk full')
    expect(await persistence.flush()).toBe(true)
    expect(S.settingsError.value).toBe('')
    persistence.dispose()
    await vi.runAllTimersAsync()
    expect(save).toHaveBeenCalledTimes(2)
  })
})
