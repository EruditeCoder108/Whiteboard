import { board } from '@/engine/instance'
import { imageFromBlob } from '@/engine/media'
import { DEFAULT_FRAME, PAGE_H, PAGE_W } from '@/engine/pages'
import { pictureType, readPresentation, readSlide } from '@/engine/pptx'
import type { ImageItem } from '@/engine/types'
import { readText, readZip } from '@/engine/zip'
import type { ZipEntry } from '@/engine/zip'
import { importPdf, importing } from './insert'
import { showToast } from './store'

export const isSlides = (f: File): boolean => /\.(pptx|ppt)$/i.test(f.name)
export const isOpenBoard = (f: File): boolean => /\.ubz$/i.test(f.name)

/** Exactly as PowerPoint shows them when Office is on this PC; otherwise as text and pictures a teacher can edit. */
export async function importSlides(file: File): Promise<void> {
  if (importing.value) return showToast('Already importing a file')
  importing.value = 'Opening slides…'
  const bytes = await file.arrayBuffer()
  let pdf: ArrayBuffer | null = null
  try { pdf = await window.api.slides.toPdf(bytes, file.name) } catch { pdf = null }
  if (pdf) {
    importing.value = ''
    return importPdf(new File([pdf], file.name.replace(/\.[^.]+$/, '.pdf'), { type: 'application/pdf' }))
  }
  if (/\.ppt$/i.test(file.name)) {
    importing.value = ''
    return showToast('This is an old PowerPoint file. In PowerPoint, save it as .pptx or PDF, then open that.', 7000)
  }
  try {
    const files = readZip(new Uint8Array(bytes))
    const deck = await readPresentation(files)
    if (!deck?.slides.length) throw new Error('No slides')
    const count = Math.min(deck.slides.length, 300)
    let first = board.doc.items.length === 0, skipped = 0
    for (let n = 0; n < count; n++) {
      importing.value = `Importing slide ${n + 1} of ${count}…`
      const slide = await readSlide(files, deck.slides[n], deck.size, deck.theme)
      skipped += slide.skipped
      for (const { item, file: name } of slide.pictures) {
        const entry = files.get(name)
        try {
          if (!entry) throw new Error('missing')
          const { src } = await imageFromBlob(new Blob([await entry.read() as BlobPart], { type: pictureType(name) }))
          ;(item as ImageItem).src = src
        } catch {
          slide.items.splice(slide.items.indexOf(item), 1)
          skipped++
        }
      }
      board.addSheet(slide.items.map(it => board.fitItem(it)), DEFAULT_FRAME, first)
      if (slide.color) board.setSurface({ color: slide.color }, true)
      first = false
    }
    showToast(`${count} slide${count === 1 ? '' : 's'} added as text and pictures you can edit.${skipped ? ` ${skipped} part${skipped === 1 ? '' : 's'} could not be read.` : ''} For an exact copy, save as PDF in PowerPoint.`, 7000)
  } catch {
    showToast(`Could not read ${file.name}. In PowerPoint, save it as PDF and open that instead.`, 7000)
  } finally { importing.value = '' }
}

/** Bring a picture OpenBoard refers to inside the page, so the page can be drawn on its own. */
async function inlineImages(svg: Document, files: Map<string, ZipEntry>): Promise<void> {
  const XLINK = 'http://www.w3.org/1999/xlink'
  for (const image of [...svg.getElementsByTagNameNS('*', 'image')]) {
    const href = image.getAttributeNS(XLINK, 'href') ?? image.getAttribute('href') ?? ''
    if (!href || href.startsWith('data:')) continue
    const entry = files.get(decodeURI(href).replace(/^\.?\//, ''))
    if (!entry) { image.remove(); continue }
    const { src } = await imageFromBlob(new Blob([await entry.read() as BlobPart], { type: pictureType(entry.name) }))
    image.setAttributeNS(XLINK, 'href', src)
  }
  // A page drawn as a picture may not reach anything outside itself.
  for (const name of ['script', 'iframe', 'object', 'embed']) for (const el of [...svg.getElementsByTagNameNS('*', name)]) el.remove()
}

/** Each OpenBoard page becomes a locked picture to write over: a school keeps its old lessons. */
export async function importOpenBoard(file: File): Promise<void> {
  if (importing.value) return showToast('Already importing a file')
  importing.value = 'Opening OpenBoard lesson…'
  try {
    const files = readZip(new Uint8Array(await file.arrayBuffer()))
    const pages = [...files.keys()].filter(n => /^page\d+\.svg$/i.test(n)).sort((a, b) => parseInt(a.slice(4)) - parseInt(b.slice(4))).slice(0, 300)
    if (!pages.length) throw new Error('No pages')
    let first = board.doc.items.length === 0
    for (const [n, name] of pages.entries()) {
      importing.value = `Importing page ${n + 1} of ${pages.length}…`
      const svg = new DOMParser().parseFromString((await readText(files.get(name))) ?? '', 'image/svg+xml')
      const root = svg.documentElement
      if (root.localName !== 'svg') continue
      await inlineImages(svg, files)
      const box = root.getAttribute('viewBox')?.split(/[\s,]+/).map(Number)
      let w = box?.[2] || parseFloat(root.getAttribute('width') ?? '') || 1600, h = box?.[3] || parseFloat(root.getAttribute('height') ?? '') || 900
      if (!root.getAttribute('viewBox')) root.setAttribute('viewBox', `0 0 ${w} ${h}`)
      root.setAttribute('width', String(w)); root.setAttribute('height', String(h))
      const { src } = await imageFromBlob(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }))
      const k = Math.min((PAGE_W - 40) / w, (PAGE_H - 40) / h)
      w *= k; h *= k
      const x = (PAGE_W - w) / 2, y = (PAGE_H - h) / 2
      const item: ImageItem = { t: 'i', id: crypto.randomUUID(), c: '#111827', w: 1, p: [x, y, x + w, y + h], src, aspect: w / h, locked: true }
      board.addSheet([item], DEFAULT_FRAME, first)
      first = false
    }
    showToast(`${pages.length} OpenBoard page${pages.length === 1 ? '' : 's'} added as pictures to write on.`, 5000)
  } catch {
    showToast(`Could not read ${file.name} as an OpenBoard lesson.`, 6000)
  } finally { importing.value = '' }
}
