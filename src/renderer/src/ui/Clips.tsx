import { signal } from '@preact/signals'
import { X } from 'lucide-preact'
import type { JSX } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { clipBlob } from '@/engine/clip'
import { board } from '@/engine/instance'
import type { ClipItem } from '@/engine/types'
import { S } from '@/state/store'

export const playing = signal<ClipItem | null>(null)

/** A real player over the clip while it plays; on the page the clip is only ever a picture with a play button. */
export function ClipPlayer(): JSX.Element | null {
  const it = playing.value
  S.viewRevision.value
  const [url, setUrl] = useState('')
  const page = S.page.value
  useEffect(() => {
    if (!it) { setUrl(''); return }
    const next = URL.createObjectURL(clipBlob(it.src))
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [it?.id])
  // Turning the page stops the sound: a clip belongs to its page.
  useEffect(() => { playing.value = null }, [page])
  if (!it || !url) return null
  const z = board.view.zoom
  const left = (Math.min(it.p[0], it.p[2]) - board.view.x) * z, top = (Math.min(it.p[1], it.p[3]) - board.view.y) * z
  const width = Math.abs(it.p[2] - it.p[0]) * z, height = Math.abs(it.p[3] - it.p[1]) * z
  const close = (): void => { playing.value = null }
  return (
    <div class={`clip-player ui ${it.kind}`} data-popover-keep="" style={{ left, top, width, height }}>
      {it.kind === 'video'
        ? <video src={url} controls autoPlay aria-label={it.name || 'Video'} />
        : <audio src={url} controls autoPlay aria-label={it.name || 'Audio'} />}
      <button type="button" class="clip-close nodrag" aria-label="Stop the clip" onClick={close}><X size={22} /></button>
    </div>
  )
}
