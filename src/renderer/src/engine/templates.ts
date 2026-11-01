import { routeConnector } from './connectors'
import { BRANCH_FILLS, mindNode } from './objects'
import type { Anchor, Item, Rect, ShapeItem, TableItem, TextItem } from './types'
import { newId } from './types'

/** Ready lesson structures, built from ordinary objects: everything in them can be moved, typed in or deleted. */
export const TEMPLATES = [
  { id: 'venn2', name: 'Venn diagram' }, { id: 'venn3', name: 'Three circles' }, { id: 'kwl', name: 'KWL chart' }, { id: 'tchart', name: 'Two columns' },
  { id: 'timeline', name: 'Timeline' }, { id: 'flow', name: 'Steps' }, { id: 'cycle', name: 'Cycle' }, { id: 'worksheet', name: 'Worksheet' }
] as const
export type TemplateId = (typeof TEMPLATES)[number]['id']

const SOFT = ['#2f6bff22', '#e5484d22', '#2fa66a22']

export function templateItems(id: TemplateId, dark: boolean): Item[] {
  const ink = dark ? '#ffffff' : '#111827'
  const label = (x: number, y: number, w: number, text: string, fontSize = 30, bold = true): TextItem =>
    ({ t: 't', id: newId(), c: ink, w: 1, p: [x - w / 2, y - fontSize, x + w / 2, y + fontSize * .7], text, fontSize, note: false, fill: 'none', align: 'center', ...(bold ? { bold: true } : {}) })
  const circle = (cx: number, cy: number, r: number, fill: string, group: string): ShapeItem =>
    ({ t: 'h', id: newId(), c: ink, w: 3, k: 'ellipse', p: [cx - r, cy - r, cx + r, cy + r], fill, group })
  const table = (heads: string[], w: number, h: number): TableItem => ({
    t: 'b', id: newId(), c: ink, w: 2.5, p: [0, 0, w, h], cols: heads.map(() => 1 / heads.length), rows: [.14, .86],
    cells: [heads, heads.map(() => '')], fontSize: 28, head: true, textColor: ink
  })
  /** A connector whose ends hold on to two objects. */
  const join = (a: ShapeItem, b: ShapeItem, kind: 'line' | 'arrow'): ShapeItem => {
    const from: Anchor = { id: a.id }, to: Anchor = { id: b.id }
    return routeConnector({ t: 'h', id: newId(), c: ink, w: 3, k: kind, p: [a.p[0], a.p[1], b.p[0], b.p[1]], from, to }, x => x === a.id ? a : x === b.id ? b : undefined)
  }
  const card = (cx: number, cy: number, w: number, h: number, i: number, text: string): ShapeItem => {
    const p: Rect = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]
    return { ...mindNode(p, BRANCH_FILLS[i % BRANCH_FILLS.length], ink), text }
  }

  switch (id) {
    case 'venn2': {
      const g = newId(), r = 280
      return [circle(290, 300, r, SOFT[0], g), circle(630, 300, r, SOFT[1], g), label(170, 300, 200, 'A'), label(750, 300, 200, 'B'), label(460, 300, 150, 'Both', 26)]
    }
    case 'venn3': {
      const g = newId(), r = 230
      return [circle(300, 250, r, SOFT[0], g), circle(580, 250, r, SOFT[1], g), circle(440, 490, r, SOFT[2], g),
        label(210, 200, 170, 'A'), label(670, 200, 170, 'B'), label(440, 610, 170, 'C')]
    }
    case 'kwl': return [table(['What I know', 'What I want to know', 'What I learned'], 1260, 660)]
    case 'tchart': return [table(['For', 'Against'], 1100, 660)]
    case 'timeline': {
      const g = newId(), n = 5, W = 1280, axisY = 300
      const axis: ShapeItem = { t: 'h', id: newId(), c: ink, w: 5, k: 'arrow', p: [0, axisY, W, axisY], group: g }
      const out: Item[] = [axis]
      for (let i = 0; i < n; i++) {
        const x = 110 + i * (W - 200) / (n - 1) * .97, above = i % 2 === 0
        const peg: ShapeItem = { t: 'h', id: newId(), c: ink, w: 3, k: 'ellipse', p: [x - 11, axisY - 11, x + 11, axisY + 11], fill: BRANCH_FILLS[i], group: g }
        const c = card(x, axisY + (above ? -170 : 170), 230, 100, i, `Event ${i + 1}`)
        out.push(peg, join(c, peg, 'line'), c)
      }
      return out
    }
    case 'flow': {
      const cards = [0, 1, 2, 3].map(i => card(135 + i * 340, 100, 250, 120, i, `Step ${i + 1}`))
      return [...cards.slice(0, 3).map((c, i) => join(c, cards[i + 1], 'arrow')), ...cards]
    }
    case 'cycle': {
      const at: [number, number][] = [[400, 70], [720, 290], [400, 510], [80, 290]]
      const cards = at.map(([x, y], i) => card(x, y, 260, 110, i, `Stage ${i + 1}`))
      return [...cards.map((c, i) => join(c, cards[(i + 1) % 4], 'arrow')), ...cards]
    }
    case 'worksheet': {
      const g = newId(), W = 1240
      const rule = (y: number, x0: number, x1: number, w = 2): ShapeItem => ({ t: 'h', id: newId(), c: ink, w, k: 'line', p: [x0, y, x1, y], group: g })
      const left = (x: number, y: number, w: number, text: string, fontSize: number, bold = false): TextItem =>
        ({ t: 't', id: newId(), c: ink, w: 1, p: [x, y - fontSize * 1.1, x + w, y + fontSize * .5], text, fontSize, note: false, fill: 'none', ...(bold ? { bold: true } : {}) })
      const out: Item[] = [left(0, 40, 700, 'Worksheet', 44, true), left(0, 118, 100, 'Name', 24), rule(120, 90, 660), left(700, 118, 90, 'Date', 24), rule(120, 780, W)]
      for (let i = 0; i < 5; i++) {
        const y = 230 + i * 104
        out.push(left(0, y, 56, `${i + 1}.`, 28, true), rule(y, 60, W))
      }
      return out
    }
  }
}
