import { paintItem, itemBounds } from './items'
import { unionRect } from './geometry'
import { fitRect } from './view'
import { ReplayTimeline } from './replay'
import type { Recording } from './replay'
import type { Rect } from './types'

export function replayBounds(recording: Recording): Rect | null {
  let bounds: Rect | null = null
  for (const it of [...recording.initial, ...recording.steps.flatMap(step => step.added.map(e => e.it))]) bounds = unionRect(bounds, itemBounds(it))
  return bounds
}

export function paintReplay(ctx: CanvasRenderingContext2D, timeline: ReplayTimeline, time: number, width: number, height: number,
  bounds: Rect | null, followCamera = false, margin = 64): void {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = timeline.recording.background; ctx.fillRect(0, 0, width, height)
  const frame = timeline.frame(time)
  if (followCamera) {
    const viewport = timeline.recording.viewport
    const scale = Math.min(width / viewport.w, height / viewport.h)
    ctx.translate((width - viewport.w * scale) / 2, (height - viewport.h * scale) / 2)
    ctx.scale(scale, scale)
    ctx.scale(frame.view.zoom, frame.view.zoom); ctx.translate(-frame.view.x, -frame.view.y)
  } else {
    const view = bounds ? fitRect(bounds, width, height, margin) : timeline.recording.view
    ctx.scale(view.zoom, view.zoom); ctx.translate(-view.x, -view.y)
  }
  for (const it of frame.items) paintItem(ctx, it)
  ctx.restore()
}

/** Encode explicit frames, independent of compositor visibility and real-time capture. */
export async function replayVideo(recording: Recording, speed: number, followCamera: boolean, signal: AbortSignal,
  progress: (fraction: number) => void): Promise<ArrayBuffer> {
  const { Output, BufferTarget, CanvasSource, Quality, WebMOutputFormat, getFirstEncodableVideoCodec } = await import('mediabunny')
  if (signal.aborted) throw new Error('Video export cancelled')
  const codec = await getFirstEncodableVideoCodec(['vp9', 'vp8'], { width: 1280, height: 720 })
  if (!codec) throw new Error('Video encoding is unavailable on this device. You can still save the reusable steps.')
  const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720
  const ctx = canvas.getContext('2d', { alpha: false })!, timeline = new ReplayTimeline(recording), bounds = replayBounds(recording)
  const target = new BufferTarget(), output = new Output({ target, format: new WebMOutputFormat() })
  const source = new CanvasSource(canvas, { codec, quality: new Quality({ bitrate: 4_000_000 }), latencyMode: 'quality', keyFrameInterval: 2 })
  output.addVideoTrack(source, { frameRate: 30 })
  let tooLarge = false
  const stopWatching = target.on('write', ({ end }) => { if (end > 256 * 1024 * 1024) tooLarge = true })
  const check = (): void => {
    if (signal.aborted) throw new Error('Video export cancelled')
    if (tooLarge) throw new Error('Video reached the 256 MB export limit. Use a faster playback speed.')
  }
  const abort = (): void => { void output.cancel().catch(() => {}) }
  signal.addEventListener('abort', abort, { once: true })
  try {
    check(); await output.start()
    const duration = recording.duration / speed / 1000 + 1, frames = Math.ceil(duration * 30)
    for (let i = 0; i < frames; i++) {
      check()
      const timestamp = i / 30
      paintReplay(ctx, timeline, Math.max(0, Math.min(recording.duration, (timestamp * 1000 - 300) * speed)), canvas.width, canvas.height, bounds, followCamera)
      await source.add(timestamp, Math.min(1 / 30, duration - timestamp))
      progress((i + 1) / frames)
      // Yield so progress paints and cancellation stays responsive, even with software encoding.
      if (i % 6 === 0) await new Promise<void>(resolve => window.setTimeout(resolve, 0))
    }
    check(); await output.finalize(); check()
    if (!target.buffer?.byteLength) throw new Error('Video encoder produced an empty recording')
    return target.buffer
  } catch (error) {
    if (signal.aborted) throw new Error('Video export cancelled')
    throw error
  } finally {
    signal.removeEventListener('abort', abort); stopWatching()
    if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => {})
  }
}
