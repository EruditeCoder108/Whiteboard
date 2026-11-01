import { afterEach, describe, expect, it, vi } from 'vitest'
import { Capture, BLACK_CAPTURE, displayPixels, isBlackImage, visibleSources } from '../src/main/capture'
import type { CaptureDependencies, DesktopSource } from '../src/main/capture'
import type { ImageItem } from '@/engine/types'

const board = vi.hoisted(() => ({ doc: { items: [] as unknown[] }, addSheet: vi.fn(), setTool: vi.fn(), commitText: vi.fn() }))
vi.mock('@/engine/instance', () => ({ board }))
vi.mock('@/state/store', () => ({ S: { popover: { value: null } }, showToast: vi.fn() }))
import { capturePlacement, cropPixels, placeCapture } from '@/state/capture'

const png = Buffer.alloc(24)
png.writeUInt32BE(2560, 16); png.writeUInt32BE(1440, 20)
const image = (black = false) => ({ isEmpty: () => false, getScaleFactors: () => [1], toPNG: () => png, toDataURL: () => 'data:image/png;base64,picture', toBitmap: () => new Uint8Array([black ? 0 : 1, 0, 0, 255]) })
const source = (id: string, name = id, display_id = ''): DesktopSource => ({ id, name, display_id, thumbnail: image() })
const own = { ids: ['window:100:0', 'window:101:0'], titles: ['Floating Whiteboard', 'Back to drawing'] }
const screen = source('screen:1:0', 'Entire screen', '1')
function setup(sources = [screen, source('window:200:0', 'A slide')]): { capture: Capture; deps: CaptureDependencies } {
  const deps: CaptureDependencies = {
    sources: vi.fn(async () => sources),
    displays: () => [{ id: 1, size: { width: 1920, height: 1080 }, scaleFactor: 1.5 }],
    ownWindows: () => own,
    withoutBoard: vi.fn(async grab => grab())
  }
  return { capture: new Capture(deps), deps }
}
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); board.doc.items = [] })

describe('desktop capture', () => {
  it('leaves our main and control windows out by handle or title', () => {
    const rows = [screen, source('window:100:1', 'A renamed board'), source('window:101:0'), source('window:300:0', 'Floating Whiteboard'), source('window:301:0', 'Back to drawing'), source('window:200:0', 'A slide')]
    expect(visibleSources(rows, own).map(s => s.id)).toEqual(['screen:1:0', 'window:200:0'])
  })
  it.each([1, 1.25, 1.5, 2])('requests real display pixels at scale %s', scaleFactor => {
    expect(displayPixels({ size: { width: 1920, height: 1080 }, scaleFactor })).toEqual({ width: 1920 * scaleFactor, height: 1080 * scaleFactor })
  })
  it('labels screens by display order and includes window thumbnails and icons', async () => {
    const window = { ...source('window:200:0', 'Slides'), appIcon: image() }
    const { capture, deps } = setup([screen, window, source('window:100:0')])
    const rows = await capture.list()
    expect(rows.map(s => s.name)).toEqual(['Screen 1', 'Slides'])
    expect(rows[1].thumbnail).toContain('data:image/png')
    expect(rows[1].icon).toContain('data:image/png')
    expect(deps.sources).toHaveBeenCalledWith({ types: ['screen', 'window'], thumbnailSize: { width: 480, height: 270 }, fetchWindowIcons: true })
  })
  it('grabs a selected screen at its full resolution while the board is hidden', async () => {
    const { capture, deps } = setup()
    const result = await capture.grab(screen.id)
    expect(deps.sources).toHaveBeenLastCalledWith({ types: ['screen'], thumbnailSize: { width: 2880, height: 1620 }, fetchWindowIcons: false })
    expect(deps.withoutBoard).toHaveBeenCalledOnce()
    expect(result).toMatchObject({ width: 2560, height: 1440, src: `data:image/png;base64,${png.toString('base64')}` })
  })
  it('keeps the highest native scale instead of encoding a smaller representation', async () => {
    const native = { ...image(), getScaleFactors: () => [1, 2], toPNG: vi.fn(() => png), toBitmap: vi.fn(() => new Uint8Array([1, 0, 0, 255])) }
    const { capture } = setup([{ ...screen, thumbnail: native }])
    await capture.grab(screen.id)
    expect(native.toPNG).toHaveBeenCalledWith({ scaleFactor: 2 })
    expect(native.toBitmap).toHaveBeenCalledWith({ scaleFactor: 2 })
  })
  it('uses the largest display dimensions for windows without hiding the board', async () => {
    const { capture, deps } = setup()
    await capture.grab('window:200:0')
    expect(deps.sources).toHaveBeenLastCalledWith({ types: ['window'], thumbnailSize: { width: 2880, height: 1620 }, fetchWindowIcons: false })
    expect(deps.withoutBoard).not.toHaveBeenCalled()
  })
  it('refuses our own windows and sources that have disappeared', async () => {
    const { capture, deps } = setup([screen, source('window:100:0')])
    await expect(capture.grab('window:100:0')).rejects.toThrow('no longer available')
    await expect(capture.grab('window:missing')).rejects.toThrow('no longer available')
    expect(deps.withoutBoard).not.toHaveBeenCalled()
  })
  it('reports black captures honestly and still exits the hidden-board operation', async () => {
    const { capture, deps } = setup([{ ...screen, thumbnail: image(true) }])
    let restored = false
    deps.withoutBoard = async grab => { try { return await grab() } finally { restored = true } }
    await expect(capture.grab(screen.id)).rejects.toThrow(BLACK_CAPTURE)
    expect(restored).toBe(true)
  })
  it('recognises fully black RGB pixels without mistaking alpha or a dark picture', () => {
    expect(isBlackImage([0, 0, 0, 255, 0, 0, 0, 255])).toBe(true)
    expect(isBlackImage([0, 0, 0, 0])).toBe(true)
    expect(isBlackImage([0, 1, 0, 255])).toBe(false)
    expect(isBlackImage([])).toBe(false)
  })
})

describe('capture on the lesson', () => {
  it('maps reversed drags to source pixels, independent of preview size', () => {
    expect(cropPixels({ x0: .75, y0: .8, x1: .1, y1: .2 }, 1920, 1080)).toEqual({ x: 192, y: 216, width: 1248, height: 648 })
  })
  it('clamps to the picture, rounds outwards and refuses empty regions', () => {
    expect(cropPixels({ x0: -1, y0: -1, x1: 2, y1: 2 }, 100, 80)).toEqual({ x: 0, y: 0, width: 100, height: 80 })
    expect(cropPixels({ x0: .12345, y0: .1, x1: .2468, y1: .5 }, 100, 80)).toEqual({ x: 12, y: 8, width: 13, height: 32 })
    expect(cropPixels({ x0: .12345, y0: 0, x1: .12345, y1: 1 }, 100, 80)).toBeNull()
    expect(cropPixels(null, 100, 80)).toBeNull()
    expect(cropPixels({ x0: NaN, y0: 0, x1: 1, y1: 1 }, 100, 80)).toBeNull()
  })
  it.each([[1600, 900], [900, 1600], [3840, 1080]])('fits a %s × %s picture on a 1600 × 900 sheet with a margin', (width, height) => {
    const [x0, y0, x1, y1] = capturePlacement(width, height)
    expect(x0).toBeGreaterThanOrEqual(32); expect(y0).toBeGreaterThanOrEqual(32)
    expect(x1).toBeLessThanOrEqual(1568); expect(y1).toBeLessThanOrEqual(868)
    expect((x1 - x0) / (y1 - y0)).toBeCloseTo(width / height)
    expect(x0 + x1).toBe(1600); expect(y0 + y1).toBe(900)
  })
  it('inserts a locked image through addSheet, reusing only an empty page and returning to the pen', () => {
    const capture = { src: 'data:image/webp;base64,picture', width: 1600, height: 900 }
    placeCapture(capture)
    const [items, frame, reuse] = board.addSheet.mock.calls[0] as [ImageItem[], unknown, boolean]
    expect(items[0]).toMatchObject({ t: 'i', locked: true, src: capture.src, aspect: 1600 / 900 })
    expect(items[0].p).toEqual(capturePlacement(1600, 900))
    expect(frame).toEqual({ x: 0, y: 0, extent: 1 }); expect(reuse).toBe(true)
    expect(board.setTool).toHaveBeenCalledWith('pen')
    board.doc.items = [{ t: 's' }]
    placeCapture(capture)
    expect(board.addSheet.mock.calls[1][2]).toBe(false)
  })
})
