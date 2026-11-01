import { signal } from '@preact/signals'
import { board } from '@/engine/instance'
import { imageFromBlob, rasterize } from '@/engine/media'
import { MAX_EXTENT, PAGE_H, PAGE_W } from '@/engine/pages'
import type { Frame } from '@/engine/pages'
import type { GraphItem, ScaleItem, ImageItem } from '@/engine/types'
import { S, showToast } from './store'
import { exportName } from './lesson'

/** Equation or graph currently open in its editor (null: inserting a new one). */
export const equationTarget = signal<ImageItem | null>(null)
export const graphTarget = signal<GraphItem | null>(null)
export const scaleTarget = signal<ScaleItem | null>(null)
export const scaleKind = signal<'line' | 'axes'>('line')
export const importing = signal('')

export function editEquation(it: ImageItem | null): void { equationTarget.value = it; S.popover.value = 'equation' }
export function editGraph(it: GraphItem | null): void { graphTarget.value = it; S.popover.value = 'graph' }
export function editScale(it: ScaleItem | null, kind: 'line' | 'axes' = 'line'): void { scaleTarget.value = it; scaleKind.value = kind; S.popover.value = 'scale' }

/** Native file picker without a main-process round trip. */
export function pickFiles(accept: string, multiple = true): Promise<File[]> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = accept; input.multiple = multiple
    input.onchange = () => resolve([...input.files ?? []])
    input.oncancel = () => resolve([])
    input.click()
  })
}

const isPdf = (f: File): boolean => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
const isImage = (f: File | Blob): boolean => f.type.startsWith('image/')

/** Pictures land side by side around the drop point; PDFs become pages. */
export async function insertFiles(files: File[], at?: [number, number]): Promise<void> {
  const pictures = files.filter(isImage), pdfs = files.filter(isPdf)
  if (!pictures.length && !pdfs.length) return showToast('Drop pictures (PNG, JPEG, WebP, SVG) or a PDF')
  let [x, y] = at ?? board.viewCentre()
  for (const file of pictures) {
    try {
      const { src, width, height } = await imageFromBlob(file)
      const it = board.insertImage(src, width, height, { at: [x, y] })
      x += (it.p[2] - it.p[0]) / 2 + 24 / board.view.zoom
      if (pictures.length > 1) x += (it.p[2] - it.p[0]) / 2
    } catch { showToast(`Could not read ${file.name}`) }
  }
  for (const file of pdfs) await importPdf(file)
}

/** Each PDF page becomes a board page holding the locked page picture, ready to write on. */
export async function importPdf(file: File): Promise<void> {
  if (importing.value) return showToast('Already importing a PDF')
  importing.value = 'Opening PDF…'
  try {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise
    const count = Math.min(pdf.numPages, 300)
    // Reuse the current page when it is empty, otherwise insert after it.
    let first = board.doc.items.length === 0
    for (let n = 1; n <= count; n++) {
      importing.value = `Importing page ${n} of ${count}…`
      const page = await pdf.getPage(n)
      const base = page.getViewport({ scale: 1 })
      // About 2000 px on the long side: sharp on a projector, light on memory.
      const viewport = page.getViewport({ scale: Math.min(4, 2000 / Math.max(base.width, base.height)) })
      const cv = document.createElement('canvas')
      cv.width = Math.round(viewport.width); cv.height = Math.round(viewport.height)
      const ctx = cv.getContext('2d')!
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height)
      await page.render({ canvasContext: ctx, viewport }).promise
      page.cleanup()
      const src = rasterize(cv, cv.width, cv.height, .85)
      // World size: PDF points × 1.5, so an A4 page is about 900 units wide.
      // On a sheet: slides fill it; portrait worksheets sit centred at a readable width and the sheet
      // grows down to hold them, with room either side for working. A notebook gets a page per PDF
      // page, a canvas a frame per PDF page, laid out side by side.
      let w = base.width * 1.5, h = base.height * 1.5
      const k = w >= h ? Math.min((PAGE_W - 40) / w, (PAGE_H - 40) / h) : 1100 / w
      w *= k; h *= k
      const x = (PAGE_W - w) / 2, y = w >= h ? (PAGE_H - h) / 2 : 30
      const frame: Frame = { x: 0, y: 0, extent: Math.min(MAX_EXTENT, Math.ceil((y + h + 30) / PAGE_H)) }
      const item: ImageItem = { t: 'i', id: crypto.randomUUID(), c: '#111827', w: 1, p: [x, y, x + w, y + h], src, aspect: w / h, locked: true }
      board.addSheet([item], frame, first)
      first = false
    }
    await pdf.destroy()
    showToast(`${file.name}: ${count} page${count === 1 ? '' : 's'} added · the PDF is locked, write on it freely${pdf.numPages > count ? ' · first 300 pages only' : ''}`, 5000)
  } catch (error) {
    showToast(`Could not import ${file.name}${error instanceof Error && /password/i.test(error.message) ? ': it is password protected' : ''}`, 5000)
  } finally { importing.value = '' }
}

/**
 * Whether the system clipboard holds a picture, refreshed when the window regains focus (the
 * usual way a screenshot or copied image arrives). Copying board objects clears it, so Ctrl+V can
 * choose between the two without waiting on the clipboard.
 */
export const clipboardImage = signal(false)
export async function refreshClipboardImage(): Promise<void> {
  try { clipboardImage.value = (await navigator.clipboard.read()).some(entry => entry.types.some(t => t.startsWith('image/'))) }
  catch { clipboardImage.value = false }
}

/** Pictures from the system clipboard; the board's own copy/paste handles objects. */
export async function pasteClipboardImage(): Promise<boolean> {
  try {
    for (const entry of await navigator.clipboard.read()) {
      const type = entry.types.find(t => t.startsWith('image/'))
      if (!type) continue
      const { src, width, height } = await imageFromBlob(await entry.getType(type))
      board.insertImage(src, width, height)
      return true
    }
  } catch { /* clipboard unavailable or empty */ }
  return false
}

/** PDF of the whole lesson. A page lengthened with "more space below" gets one sheet per screen unless `split` is false. */
export async function exportPdf(opts: { split?: boolean } = {}): Promise<void> {
  try {
    importing.value = 'Preparing PDF…'
    const pages = await board.exportPages(opts)
    importing.value = ''
    if (!pages.length) return showToast('Nothing to export yet — the lesson is empty')
    const path = await window.api.files.savePdf(pages, exportName('pdf'))
    if (path) showToast('PDF saved  ' + path.split(/[\\/]/).pop())
  } catch {
    showToast('Could not export the PDF. Please try another location.', 5000)
  } finally { importing.value = '' }
}

// ── equations ───────────────────────────────────────────────────────────────────
type Typeset = (latex: string) => { svg: string; width: number; height: number }
let typeset: Promise<Typeset> | null = null

/** MathJax (with mhchem for chemistry) loads on first use. Output is pure SVG paths, no fonts. */
export function loadTypesetter(): Promise<Typeset> {
  typeset ??= (async () => {
    const [{ mathjax }, { TeX }, { SVG }, { liteAdaptor }, { RegisterHTMLHandler }, { AllPackages }] = await Promise.all([
      import('mathjax-full/js/mathjax.js'), import('mathjax-full/js/input/tex.js'), import('mathjax-full/js/output/svg.js'),
      import('mathjax-full/js/adaptors/liteAdaptor.js'), import('mathjax-full/js/handlers/html.js'), import('mathjax-full/js/input/tex/AllPackages.js')
    ])
    const adaptor = liteAdaptor()
    RegisterHTMLHandler(adaptor)
    const tex = new TeX({ packages: AllPackages.filter((p: string) => !['bussproofs', 'require', 'autoload'].includes(p)), formatError: (_jax: unknown, error: Error) => { throw error } })
    const doc = mathjax.document('', { InputJax: tex, OutputJax: new SVG({ fontCache: 'none' }) })
    // 1ex ≈ 18 world units: equations arrive at a comfortable board writing size.
    const EX = 18
    return (latex: string) => {
      const node = doc.convert(latex, { display: true })
      const raw = adaptor.innerHTML(node)
      const ex = (name: string): number => Number(new RegExp(`${name}="([\\d.]+)ex"`).exec(raw)?.[1] ?? 0)
      const width = Math.max(1, ex('width') * EX), height = Math.max(1, ex('height') * EX)
      const svg = raw.replace(/width="[\d.]+ex"/, `width="${width}"`).replace(/height="[\d.]+ex"/, `height="${height}"`)
      return { svg: svg.includes('xmlns="http://www.w3.org/2000/svg"') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'), width, height }
    }
  })()
  return typeset
}

export const svgDataUrl = (svg: string): string => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
