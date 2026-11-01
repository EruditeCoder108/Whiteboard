import { isDarkColor } from './colour'
import { PAGE_H, PAGE_W } from './pages'
import type { Item, Rect, ShapeItem, ShapeKind, TableItem, TextItem, TextStyle } from './types'
import { newId } from './types'
import { readText } from './zip'
import type { ZipEntry } from './zip'

/**
 * Reads a PowerPoint file with no Office installed, into ordinary objects a teacher can move and retype.
 * Slide text, pictures, tables and basic shapes come across; animations and master decorations do not.
 * With Office on the PC the slides are converted exactly instead (see main/slides.ts).
 */
export interface SlideImage { name: string; bytes: Uint8Array; mime: string }
export interface Slide { items: Item[]; pictures: { item: Item; file: string }[]; color?: string; skipped: number }

type Xfrm = { x: number; y: number; w: number; h: number; angle: number }
const PICTURE_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' }
const ALIASES: Record<string, string> = { tx1: 'dk1', tx2: 'dk2', bg1: 'lt1', bg2: 'lt2' }
const SHAPE_KINDS: Record<string, ShapeKind> = { rect: 'rect', roundRect: 'rect', ellipse: 'ellipse', diamond: 'diamond', triangle: 'triangle', rtTriangle: 'triangle', line: 'line', straightConnector1: 'arrow' }

const parse = (xml: string): Document => new DOMParser().parseFromString(xml, 'application/xml')
const kids = (el: Element | null | undefined, name: string): Element[] => el ? [...el.children].filter(c => c.localName === name) : []
const kid = (el: Element | null | undefined, ...path: string[]): Element | null => {
  let at: Element | null | undefined = el
  for (const name of path) at = at ? [...at.children].find(c => c.localName === name) : null
  return at ?? null
}
const below = (el: Element | Document, name: string): Element[] => [...el.getElementsByTagNameNS('*', name)]
const num = (el: Element | null, attr: string, fallback = 0): number => { const v = Number(el?.getAttribute(attr)); return Number.isFinite(v) && el?.hasAttribute(attr) ? v : fallback }
const relAttr = (el: Element | null, name: string): string | null => {
  if (!el) return null
  // A slide entry has both id and r:id: only the one in the relationships namespace points at a part.
  for (const a of el.attributes) if (a.localName === name && a.namespaceURI?.includes('relationships')) return a.value
  return null
}
const joined = (base: string, target: string): string => {
  if (target.startsWith('/')) return target.slice(1)
  const parts = base.split('/').slice(0, -1)
  for (const seg of target.split('/')) { if (seg === '..') parts.pop(); else if (seg !== '.') parts.push(seg) }
  return parts.join('/')
}
const relsOf = (part: string): string => { const i = part.lastIndexOf('/'); return `${part.slice(0, i)}/_rels/${part.slice(i + 1)}.rels` }

async function rels(files: Map<string, ZipEntry>, part: string): Promise<Map<string, { type: string; target: string }>> {
  const out = new Map<string, { type: string; target: string }>()
  const xml = await readText(files.get(relsOf(part)))
  if (!xml) return out
  for (const r of below(parse(xml), 'Relationship')) {
    const id = r.getAttribute('Id'), target = r.getAttribute('Target')
    if (id && target) out.set(id, { type: r.getAttribute('Type') ?? '', target: joined(part, target) })
  }
  return out
}

function xfrmOf(sp: Element): Xfrm | null {
  const x = kid(sp, 'spPr', 'xfrm') ?? kid(sp, 'xfrm') ?? kid(sp, 'grpSpPr', 'xfrm')
  const off = kid(x, 'off'), ext = kid(x, 'ext')
  if (!off || !ext) return null
  return { x: num(off, 'x'), y: num(off, 'y'), w: num(ext, 'cx'), h: num(ext, 'cy'), angle: num(x, 'rot') / 60000 * Math.PI / 180 }
}

/** The colours a theme names, so "accent 1" comes out as the colour the teacher saw. */
function themeColors(xml: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!xml) return out
  const scheme = below(parse(xml), 'clrScheme')[0]
  for (const c of scheme ? [...scheme.children] : []) {
    const v = kid(c, 'srgbClr')?.getAttribute('val') ?? kid(c, 'sysClr')?.getAttribute('lastClr')
    if (v) out[c.localName] = `#${v.toLowerCase()}`
  }
  return out
}

function colorIn(el: Element | null, theme: Record<string, string>): string | null {
  const fill = kid(el, 'solidFill')
  if (!fill) return null
  const rgb = kid(fill, 'srgbClr')?.getAttribute('val')
  if (rgb && /^[0-9a-f]{6}$/i.test(rgb)) return `#${rgb.toLowerCase()}`
  const scheme = kid(fill, 'schemeClr')?.getAttribute('val')
  return scheme ? theme[ALIASES[scheme] ?? scheme] ?? null : null
}

interface Placeholder { type: string; idx: string }
const placeholderOf = (sp: Element): Placeholder | null => {
  const ph = kid(sp, 'nvSpPr', 'nvPr', 'ph')
  return ph ? { type: ph.getAttribute('type') ?? 'body', idx: ph.getAttribute('idx') ?? '' } : null
}

/** Where a layout puts its placeholders: a slide often leaves its own title and body to inherit this. */
function layoutSpots(xml: string | null): { byIdx: Map<string, Xfrm>; byType: Map<string, Xfrm> } {
  const byIdx = new Map<string, Xfrm>(), byType = new Map<string, Xfrm>()
  if (!xml) return { byIdx, byType }
  for (const sp of below(parse(xml), 'sp')) {
    const ph = placeholderOf(sp), x = xfrmOf(sp)
    if (!ph || !x) continue
    if (ph.idx) byIdx.set(ph.idx, x)
    if (!byType.has(ph.type)) byType.set(ph.type, x)
  }
  return { byIdx, byType }
}

function runsOf(body: Element | null, theme: Record<string, string>): { text: string; style: TextStyle; bullet: boolean } {
  const paragraphs = kids(body, 'p')
  const lines: string[] = []
  let size = 0, color: string | null = null, bold = false, italic = false, align: TextStyle['align'], bullet = false
  for (const p of paragraphs) {
    const pPr = kid(p, 'pPr')
    const algn = pPr?.getAttribute('algn')
    if (!align && algn) align = algn === 'ctr' ? 'center' : algn === 'r' ? 'right' : 'left'
    if (kid(pPr, 'buChar') || kid(pPr, 'buAutoNum')) bullet = true
    let line = ''
    for (const part of [...p.children]) {
      if (part.localName === 'br') { line += '\n'; continue }
      if (part.localName !== 'r' && part.localName !== 'fld') continue
      line += kid(part, 't')?.textContent ?? ''
      const rPr = kid(part, 'rPr')
      if (!size) size = num(rPr, 'sz') / 100
      if (rPr?.getAttribute('b') === '1') bold = true
      if (rPr?.getAttribute('i') === '1') italic = true
      color ??= colorIn(rPr, theme)
    }
    lines.push(line)
  }
  const scale = num(kid(kid(body, 'bodyPr'), 'normAutofit'), 'fontScale', 100000) / 100000
  return { text: lines.join('\n').trim(), bullet, style: { ...(size ? { fontSize: size * scale } : {}), ...(color ? { textColor: color } : {}), ...(bold ? { bold } : {}), ...(italic ? { italic } : {}), ...(align ? { align } : {}) } }
}

const PLACEHOLDER_SIZE: Record<string, number> = { title: 44, ctrTitle: 54, subTitle: 28, body: 26 }

/** One slide as objects on a 1600 × 900 sheet, in the order they were stacked. */
export async function readSlide(files: Map<string, ZipEntry>, path: string, size: [number, number], theme: Record<string, string>): Promise<Slide> {
  const xml = await readText(files.get(path))
  const slide: Slide = { items: [], pictures: [], skipped: 0 }
  if (!xml) return slide
  const doc = parse(xml)
  if (below(doc, 'parsererror').length) return slide
  const own = await rels(files, path)
  const layoutPath = [...own.values()].find(r => r.type.endsWith('/slideLayout'))?.target
  const spots = layoutSpots(layoutPath ? await readText(files.get(layoutPath)) : null)
  const k = Math.min(PAGE_W / size[0], PAGE_H / size[1])
  const ox = (PAGE_W - size[0] * k) / 2, oy = (PAGE_H - size[1] * k) / 2
  slide.color = colorIn(kid(doc.documentElement, 'cSld', 'bg', 'bgPr'), theme) ?? undefined
  // Text that names no colour must still be readable on the slide's own background.
  const ink = slide.color && isDarkColor(slide.color) ? theme.lt1 ?? '#ffffff' : theme.dk1 ?? '#111827'

  const box = (x: Xfrm, map: (v: number, axis: 'x' | 'y') => number, scale: [number, number]): Rect => {
    const x0 = map(x.x, 'x'), y0 = map(x.y, 'y')
    return [ox + x0 * k, oy + y0 * k, ox + (x0 + x.w * scale[0]) * k, oy + (y0 + x.h * scale[1]) * k]
  }
  const walk = (parent: Element, map: (v: number, axis: 'x' | 'y') => number, scale: [number, number]): void => {
    for (const el of [...parent.children]) {
      if (el.localName === 'grpSp') {
        const x = xfrmOf(el), inner = kid(el, 'grpSpPr', 'xfrm')
        const chOff = kid(inner, 'chOff'), chExt = kid(inner, 'chExt')
        if (!x || !chExt || !chOff) { walk(el, map, scale); continue }
        const sx = x.w / (num(chExt, 'cx') || 1), sy = x.h / (num(chExt, 'cy') || 1)
        const cx = num(chOff, 'x'), cy = num(chOff, 'y'), outerX = map(x.x, 'x'), outerY = map(x.y, 'y')
        walk(el, (v, axis) => axis === 'x' ? outerX + (v - cx) * sx * scale[0] : outerY + (v - cy) * sy * scale[1], [sx * scale[0], sy * scale[1]])
      } else if (el.localName === 'pic') {
        const x = xfrmOf(el), embed = relAttr(kid(el, 'blipFill', 'blip'), 'embed'), target = embed ? own.get(embed)?.target : undefined
        const ext = target?.split('.').pop()?.toLowerCase() ?? ''
        if (!x || !target || !PICTURE_TYPES[ext]) { slide.skipped++; continue }
        const p = box(x, map, scale)
        const item: Item = { t: 'i', id: newId(), c: ink, w: 1, p, src: 'data:image/png;base64,', aspect: Math.max(.01, (p[2] - p[0]) / Math.max(1, p[3] - p[1])), ...(x.angle ? { angle: x.angle } : {}) }
        slide.items.push(item)
        slide.pictures.push({ item, file: target })
      } else if (el.localName === 'graphicFrame') {
        const x = xfrmOf(el), table = below(el, 'tbl')[0]
        if (!x || !table) { slide.skipped++; continue }
        const widths = kids(kid(table, 'tblGrid'), 'gridCol').map(c => num(c, 'w', 1)), rows = kids(table, 'tr')
        if (!widths.length || !rows.length) continue
        const W = widths.reduce((a, b) => a + b, 0), hs = rows.map(r => num(r, 'h', 1)), H = hs.reduce((a, b) => a + b, 0) || 1
        const cells = rows.map(r => {
          const cols = kids(r, 'tc').map(c => runsOf(kid(c, 'txBody'), theme).text)
          return widths.map((_, i) => cols[i] ?? '')
        })
        const it: TableItem = {
          t: 'b', id: newId(), c: ink, w: 2, p: box(x, map, scale), cols: widths.map(v => v / W), rows: hs.map(v => v / H), cells, fontSize: 18 * 12700 * k * 1,
          textColor: ink, ...(kid(table, 'tblPr')?.getAttribute('firstRow') === '1' ? { head: true } : {})
        }
        slide.items.push(it)
      } else if (el.localName === 'cxnSp') {
        const x = xfrmOf(el)
        if (!x) continue
        const p = box(x, map, scale), line = kid(el, 'spPr', 'ln')
        const flipH = kid(el, 'spPr', 'xfrm')?.getAttribute('flipH') === '1', flipV = kid(el, 'spPr', 'xfrm')?.getAttribute('flipV') === '1'
        const arrow = !!kid(line, 'tailEnd') || !!kid(line, 'headEnd')
        const s: ShapeItem = { t: 'h', id: newId(), c: colorIn(line, theme) ?? ink, w: Math.max(1.5, num(line, 'w', 12700) * k), k: arrow ? 'arrow' : 'line', p: [flipH ? p[2] : p[0], flipV ? p[3] : p[1], flipH ? p[0] : p[2], flipV ? p[1] : p[3]] }
        slide.items.push(s)
      } else if (el.localName === 'sp') {
        const ph = placeholderOf(el)
        const x = xfrmOf(el) ?? (ph && (spots.byIdx.get(ph.idx) ?? spots.byType.get(ph.type))) ?? null
        const body = kid(el, 'txBody')
        const { text, style, bullet } = runsOf(body, theme)
        const fill = colorIn(kid(el, 'spPr'), theme), line = kid(el, 'spPr', 'ln')
        const geom = kid(el, 'spPr', 'prstGeom')?.getAttribute('prst') ?? ''
        const drawn = !!fill || !!colorIn(line, theme)
        // Empty placeholders are prompts for the author ("Click to add title"), not content.
        if (!x || (!text && (!drawn || ph))) continue
        const p = box(x, map, scale)
        const points = style.fontSize ?? PLACEHOLDER_SIZE[ph?.type ?? ''] ?? 18
        const fontSize = Math.max(8, points * 12700 * k)
        const textBits: TextStyle = { ...style, fontSize, text, ...(!ph || ph.type === 'body' ? (bullet || ph?.type === 'body' ? { list: 'bullet' as const } : {}) : {}) }
        if (drawn && SHAPE_KINDS[geom]) {
          slide.items.push({ t: 'h', id: newId(), c: colorIn(line, theme) ?? fill ?? ink, w: Math.max(1.5, num(line, 'w', 12700) * k), k: SHAPE_KINDS[geom], p, ...(fill ? { fill } : {}), ...(geom === 'roundRect' ? { radius: 18 } : {}), ...(x.angle ? { angle: x.angle } : {}), ...textBits, ...(text ? {} : { text: undefined }) })
        } else if (text) {
          const it: TextItem = { t: 't', id: newId(), c: style.textColor ?? ink, w: 1, p, fill: fill ?? 'none', note: false, ...(x.angle ? { angle: x.angle } : {}), ...textBits, text, fontSize }
          slide.items.push(it)
        } else slide.skipped++
      }
    }
  }
  const tree = kid(doc.documentElement, 'cSld', 'spTree')
  if (tree) walk(tree, v => v, [1, 1])
  return slide
}

/** The slide files of a presentation, in showing order, and its size. */
export async function readPresentation(files: Map<string, ZipEntry>): Promise<{ slides: string[]; size: [number, number]; theme: Record<string, string> } | null> {
  const xml = await readText(files.get('ppt/presentation.xml'))
  if (!xml) return null
  const doc = parse(xml)
  const sz = below(doc, 'sldSz')[0], order = below(doc, 'sldId')
  const own = await rels(files, 'ppt/presentation.xml')
  const slides = order.map(s => own.get(relAttr(s, 'id') ?? '')?.target).filter((t): t is string => !!t && files.has(t))
  const themePath = [...own.values()].find(r => r.type.endsWith('/theme'))?.target ?? 'ppt/theme/theme1.xml'
  return { slides, size: [num(sz, 'cx', 12192000), num(sz, 'cy', 6858000)], theme: themeColors(await readText(files.get(themePath))) }
}

export const pictureType = (file: string): string => PICTURE_TYPES[file.split('.').pop()?.toLowerCase() ?? ''] ?? 'image/png'
