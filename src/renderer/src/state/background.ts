import { board } from '@/engine/instance'
import { imageFromBlob } from '@/engine/media'
import { ART_DEFAULTS } from '@/engine/pages'
import type { Artwork } from '@/engine/pages'
import type { ImageItem } from '@/engine/types'
import { pickFiles } from './insert'
import { S, showToast } from './store'

/**
 * The background picture of the page in view: a worksheet, a diagram or a school template behind the
 * ink. It is copied into the lesson when chosen, so the USB stick it came from can be taken away.
 */
export const background = {
  /** A picture file from the computer (PNG, JPEG, WebP; an SVG is turned into a picture). */
  async choose(everywhere = false): Promise<void> {
    const [file] = await pickFiles('image/png,image/jpeg,image/webp,image/gif,image/svg+xml', false)
    if (!file) return
    try {
      const { src } = await imageFromBlob(file)
      const keep = S.here.value.art
      board.setArt({ ...ART_DEFAULTS, ...(keep ? { fit: keep.fit, opacity: keep.opacity, align: keep.align, span: keep.span } : {}), src }, everywhere)
    } catch { showToast(`Could not read ${file.name} as a picture`, 4000) }
  },

  /** The one selected picture (an imported PDF page, say), moved behind the ink. */
  fromSelection(everywhere = false): void {
    const it = selectedPicture()
    if (!it) return showToast('Select one picture on the page first', 3000)
    board.pictureToBackground(it, everywhere)
  },

  /** Change how the picture is shown; it stays the same picture. */
  adjust(patch: Partial<Omit<Artwork, 'src'>>, everywhere = false): void {
    const art = S.here.value.art
    if (art) board.setArt({ ...art, ...patch }, everywhere)
  },

  remove(everywhere = false): void { board.setArt(null, everywhere) }
}

/** The selected picture that could become the background (not an equation). */
export function selectedPicture(): ImageItem | null {
  const sel = S.selection.value
  return sel.length === 1 && sel[0].t === 'i' && sel[0].latex === undefined ? sel[0] : null
}
