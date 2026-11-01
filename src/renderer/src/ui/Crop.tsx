import { signal } from '@preact/signals'
import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { board } from '@/engine/instance'
import { cropImage } from '@/engine/media'
import { dragCrop, FULL_CROP, cropInSource, isWholeCrop } from '@/engine/objects'
import type { CropCorner, CropRect } from '@/engine/objects'
import type { ImageItem } from '@/engine/types'
import { S, showToast } from '@/state/store'

/** What is being cropped: a picture on the page, or the background picture (null). */
export const cropTarget = signal<ImageItem | null>(null)

export function openCrop(target: ImageItem | null): void {
  cropTarget.value = target
  S.popover.value = 'crop'
}

const CORNERS: CropCorner[] = ['nw', 'ne', 'sw', 'se']

/** Drag the corners, or the middle to move the frame. It is cut when it is applied, and Undo brings the whole picture back. */
export function CropSheet(): JSX.Element | null {
  const item = cropTarget.value
  const art = S.here.value.art
  const src = item?.src ?? art?.src
  const [crop, setCrop] = useState<CropRect>(FULL_CROP)
  const stage = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const drag = useRef<{ mode: CropCorner | 'move'; from: [number, number]; start: CropRect } | null>(null)
  const close = (): void => { S.popover.value = null; cropTarget.value = null }
  useEffect(() => setCrop(FULL_CROP), [src])
  if (!src) return null
  const flipX = !!item?.flipX, flipY = !!item?.flipY
  const at = (e: PointerEvent): [number, number] => {
    const r = stage.current!.getBoundingClientRect()
    return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]
  }
  const down = (e: PointerEvent, mode: CropCorner | 'move'): void => {
    e.preventDefault(); e.stopPropagation()
    drag.current = { mode, from: at(e), start: crop }
    try { stage.current!.setPointerCapture(e.pointerId) } catch { /* the contact may already have ended */ }
  }
  const move = (e: PointerEvent): void => {
    const d = drag.current
    if (d) setCrop(dragCrop(d.start, d.mode, at(e), d.from))
  }
  const apply = (): void => {
    const image = img.current
    if (!image?.naturalWidth) return
    if (isWholeCrop(crop)) return close()
    const cut = cropImage(image, cropInSource(crop, flipX, flipY))
    if (item) board.cropPicture(item, cut.src, crop, cut.aspect)
    else if (art) board.setArt({ ...art, src: cut.src })
    close()
    showToast('Cropped', 2000)
  }
  return (
    <div class="chooser new-lesson ui" role="dialog" aria-modal="true" aria-labelledby="crop-title" data-popover-keep="" onKeyDown={e => { if (e.key === 'Escape') close() }}>
      <div class="chooser-card panel new-lesson-card crop-card">
        <h1 id="crop-title">Crop the picture</h1>
        <div class="crop-stage nodrag" ref={stage} onPointerMove={move as never} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
          <img ref={img} src={src} alt="The picture being cropped" draggable={false} style={{ transform: `scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})` }} />
          <i class="capture-dim" style={{ inset: `0 0 ${(1 - crop[1]) * 100}% 0` }} />
          <i class="capture-dim" style={{ inset: `${crop[3] * 100}% 0 0 0` }} />
          <i class="capture-dim" style={{ left: 0, top: `${crop[1] * 100}%`, width: `${crop[0] * 100}%`, height: `${(crop[3] - crop[1]) * 100}%` }} />
          <i class="capture-dim" style={{ right: 0, top: `${crop[1] * 100}%`, width: `${(1 - crop[2]) * 100}%`, height: `${(crop[3] - crop[1]) * 100}%` }} />
          <div class="capture-selection crop-frame" onPointerDown={e => down(e as unknown as PointerEvent, 'move')}
            style={{ left: `${crop[0] * 100}%`, top: `${crop[1] * 100}%`, width: `${(crop[2] - crop[0]) * 100}%`, height: `${(crop[3] - crop[1]) * 100}%` }}>
            {CORNERS.map(c => <button type="button" key={c} class={`capture-corner ${c}`} aria-label={`Move the ${c === 'nw' ? 'top left' : c === 'ne' ? 'top right' : c === 'sw' ? 'bottom left' : 'bottom right'} corner`}
              onPointerDown={e => down(e as unknown as PointerEvent, c)}><span /></button>)}
          </div>
        </div>
        <div class="dialog-choices">
          <button type="button" class="dialog-btn primary nodrag" onClick={apply}>Crop</button>
          <button type="button" class="dialog-btn nodrag" onClick={() => setCrop(FULL_CROP)}>Whole picture</button>
          <button type="button" class="dialog-btn nodrag" onClick={close}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
