import type { CaptureSource, CapturedImage } from '../shared/api'

interface Size { width: number; height: number }
interface Display { id: number; size: Size; scaleFactor: number }
interface Image {
  isEmpty(): boolean
  getScaleFactors(): number[]
  toPNG(options?: { scaleFactor?: number }): Uint8Array
  toDataURL(options?: { scaleFactor?: number }): string
  toBitmap(options?: { scaleFactor?: number }): Uint8Array
}
export interface DesktopSource { id: string; name: string; display_id: string; thumbnail: Image; appIcon?: Image | null }
export interface CaptureDependencies {
  sources(options: { types: ('screen' | 'window')[]; thumbnailSize: Size; fetchWindowIcons: boolean }): Promise<DesktopSource[]>
  displays(): Display[]
  ownWindows(): { ids: string[]; titles: string[] }
  withoutBoard<T>(grab: () => Promise<T>): Promise<T>
}
export const BLACK_CAPTURE = 'That window could not be captured (it may be protected). Try capturing the whole screen instead.'
export class CaptureError extends Error {}

/** Windows reports display sizes in logical pixels; screenshots need the real pixels. */
export function displayPixels(display: Pick<Display, 'size' | 'scaleFactor'>): Size {
  return { width: Math.max(1, Math.round(display.size.width * display.scaleFactor)), height: Math.max(1, Math.round(display.size.height * display.scaleFactor)) }
}

/** Native bitmaps may be BGRA or RGBA. Black has zero in all three colour channels in either. */
export function isBlackImage(pixels: ArrayLike<number>): boolean {
  if (!pixels.length || pixels.length % 4) return false
  for (let i = 0; i < pixels.length; i += 4) if (pixels[i] || pixels[i + 1] || pixels[i + 2]) return false
  return true
}

/** The last component can vary between enumerations; the window handle identifies our window. */
export function visibleSources(sources: DesktopSource[], own: { ids: string[]; titles: string[] }): DesktopSource[] {
  const handle = (id: string): string => id.split(':').slice(0, 2).join(':')
  return sources.filter(s => s.id.startsWith('screen:') || s.id.startsWith('window:') &&
    !own.ids.some(id => handle(id) === handle(s.id)) && !own.titles.includes(s.name))
}

/** Electron lives behind these small functions so filtering, sizing and restoration can be tested. */
export class Capture {
  constructor(private deps: CaptureDependencies) {}

  async list(): Promise<CaptureSource[]> {
    const sources = visibleSources(await this.deps.sources({ types: ['screen', 'window'], thumbnailSize: { width: 480, height: 270 }, fetchWindowIcons: true }), this.deps.ownWindows())
    const displays = this.deps.displays()
    return sources.map(s => {
      const kind = s.id.startsWith('screen:') ? 'screen' : 'window'
      const index = displays.findIndex(d => String(d.id) === s.display_id)
      return {
        id: s.id, kind, name: kind === 'screen' ? `Screen ${index >= 0 ? index + 1 : sources.filter(x => x.id.startsWith('screen:')).indexOf(s) + 1}` : s.name || 'Untitled window',
        thumbnail: s.thumbnail.isEmpty() ? '' : s.thumbnail.toDataURL(),
        icon: s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : undefined
      }
    })
  }

  async grab(id: string): Promise<CapturedImage> {
    const sources = visibleSources(await this.deps.sources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false }), this.deps.ownWindows())
    const source = sources.find(s => s.id === id)
    if (!source) throw new CaptureError('That screen or window is no longer available. Refresh and choose again.')
    const screen = source.id.startsWith('screen:')
    const displays = this.deps.displays()
    const display = displays.find(d => String(d.id) === source.display_id)
    if (screen && !display) throw new CaptureError('That screen is no longer available. Refresh and choose again.')
    const sizes = displays.map(displayPixels)
    const thumbnailSize = screen ? displayPixels(display!) : {
      width: Math.max(1, ...sizes.map(s => s.width)), height: Math.max(1, ...sizes.map(s => s.height))
    }
    const grab = async (): Promise<CapturedImage> => {
      const fresh = visibleSources(await this.deps.sources({ types: [screen ? 'screen' : 'window'], thumbnailSize, fetchWindowIcons: false }), this.deps.ownWindows()).find(s => s.id === id)
      if (!fresh || fresh.thumbnail.isEmpty()) throw new CaptureError('That screen or window could not be captured. Refresh and try again.')
      const image = fresh.thumbnail, scaleFactor = Math.max(1, ...image.getScaleFactors())
      if (isBlackImage(image.toBitmap({ scaleFactor }))) throw new CaptureError(BLACK_CAPTURE)
      const png = Buffer.from(image.toPNG({ scaleFactor }))
      // PNG dimensions are real pixels even when Electron holds a scaled image.
      return { src: `data:image/png;base64,${png.toString('base64')}`, width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
    }
    return screen ? this.deps.withoutBoard(grab) : grab()
  }
}
