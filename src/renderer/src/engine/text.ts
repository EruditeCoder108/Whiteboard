import type { EditableItem } from './types'

export const fontOf = (it: EditableItem): string => `${it.italic ? 'italic ' : ''}${it.bold ? '600 ' : ''}${it.fontSize ?? 24}px "Segoe UI", sans-serif`
export const textPadding = (it: EditableItem): number => it.t === 't' ? (it.note ? 18 : 4) : Math.min(14, Math.abs(it.p[3] - it.p[1]) / 6, Math.abs(it.p[2] - it.p[0]) / 8)
export const textAlign = (it: EditableItem): 'left' | 'center' | 'right' => it.align ?? (it.t === 'h' ? 'center' : 'left')
export const textColor = (it: EditableItem): string => it.textColor ?? it.c

/** Shared wrapping for canvas and export. Long words are split without losing Unicode code points. */
export function wrapText(text: string, width: number, measure: (s: string) => number, list = 'none'): string[] {
  const lines: string[] = []
  text.split('\n').forEach((paragraph, index) => {
    const prefix = list === 'bullet' ? '• ' : list === 'number' ? `${index + 1}. ` : ''
    const continuation = ' '.repeat(prefix.length)
    let line = prefix
    let hasContent = false
    const flush = (): void => { lines.push(line.trimEnd()); line = continuation; hasContent = false }
    for (const word of paragraph.split(/(\s+)/)) {
      if (!word) continue
      if (measure(line + word) <= width) { line += word; hasContent ||= word.trim().length > 0; continue }
      if (hasContent) flush()
      for (const char of Array.from(word.trimStart())) {
        if (hasContent && measure(line + char) > width) flush()
        line += char
        hasContent = true
      }
    }
    lines.push(line.trimEnd())
  })
  return lines
}

export function paintText(ctx: CanvasRenderingContext2D, it: EditableItem): void {
  if (!it.text) return
  const x = Math.min(it.p[0], it.p[2]), y = Math.min(it.p[1], it.p[3])
  const w = Math.abs(it.p[2] - it.p[0]), h = Math.abs(it.p[3] - it.p[1])
  const pad = textPadding(it)
  let size = it.fontSize ?? 24
  ctx.save()
  ctx.beginPath(); ctx.rect(x + pad, y + pad, Math.max(1, w - pad * 2), Math.max(1, h - pad * 2)); ctx.clip()
  ctx.font = fontOf(it)
  ctx.fillStyle = textColor(it)
  ctx.textAlign = textAlign(it)
  ctx.textBaseline = 'top'
  let lines = wrapText(it.text, Math.max(1, w - pad * 2), (s) => ctx.measureText(s).width, it.list)
  // A compact labelled shape must not crop its last line. Keep its geometry,
  // reducing the rendered font only when the requested label cannot fit.
  if (it.t === 'h') for (let attempt = 0; attempt < 12 && lines.length * size * 1.3 > h - 2 * pad && size > 1; attempt++) {
    size = Math.max(1, size * Math.min(0.9, (h - 2 * pad) / (lines.length * size * 1.3)))
    ctx.font = fontOf({ ...it, fontSize: size })
    lines = wrapText(it.text, Math.max(1, w - pad * 2), s => ctx.measureText(s).width, it.list)
  }
  const lineH = size * 1.3
  const tx = ctx.textAlign === 'center' ? x + w / 2 : ctx.textAlign === 'right' ? x + w - pad : x + pad
  const ty = it.t === 'h' ? y + Math.max(pad, (h - lines.length * lineH) / 2) : y + pad
  lines.forEach((line, i) => ctx.fillText(line, tx, ty + i * lineH))
  ctx.restore()
}

/** Grow text and notes to keep content visible; shapes keep their deliberate size. */
export function fitTextHeight(it: EditableItem, ctx: CanvasRenderingContext2D): EditableItem {
  if (it.t !== 't') return it
  ctx.save(); ctx.font = fontOf(it)
  const pad = textPadding(it)
  const x = Math.min(it.p[0], it.p[2]), y = Math.min(it.p[1], it.p[3])
  const width = Math.abs(it.p[2] - it.p[0]), previousHeight = Math.abs(it.p[3] - it.p[1])
  const lines = wrapText(it.text, Math.max(1, width - pad * 2), s => ctx.measureText(s).width, it.list)
  ctx.restore()
  const height = Math.max(previousHeight, lines.length * it.fontSize * 1.3 + pad * 2)
  return { ...it, p: [x, y, x + width, y + height] }
}
