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
    applySettings({ tool: 'unknown', defaultPaper: 'invalid', defaultColor: 'red', penColor: '#12345', penSize: NaN, markerSize: 999, smoothing: Infinity, pressure: 'false', radialDelay: 50 })
    expect(S.tool.value).toBe(original.tool)
    expect(S.defaultPaper.value).toBe(original.defaultPaper)
    expect(S.defaultColor.value).toBe(original.defaultColor)
    expect(S.penColor.value).toBe(original.penColor)
    expect(S.penSize.value).toBe(original.penSize)
    expect(S.markerSize.value).toBe(60)
    expect(S.smoothing.value).toBe(original.smoothing)
    expect(S.pressure.value).toBe(true)
    expect(S.radialDelay.value).toBe(300)
  })

  it('reads the board colour and paper that older versions kept in settings as the defaults for new lessons', () => {
    applySettings({ bgColor: '#1d3b33', grid: 'graph' })
    expect(S.defaultColor.value).toBe('#1d3b33')
    expect(S.defaultPaper.value).toBe('graph')
    applySettings({ bgColor: '#000000', grid: 'dots', defaultColor: '#fbf6e9', defaultPaper: 'ruled' })
    expect(S.defaultColor.value).toBe('#fbf6e9')
    expect(S.defaultPaper.value).toBe('ruled')
    expect(Object.keys(snapshotSettings())).not.toContain('bgColor')
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
