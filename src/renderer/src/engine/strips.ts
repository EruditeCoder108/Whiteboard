import type { ShapeItem } from './types'
import { newId } from './types'

/**
 * A short writing exercise needs a band of lines, not a whole page of them: the same lines as the
 * four-line and Hindi papers, as a group of objects that can be moved, sized and copied.
 */
const WIDTH = 1200

export function writingStrip(kind: 'fourline' | 'hindi', dark: boolean): ShapeItem[] {
  const blue = dark ? '#6cb6ff' : '#2f6bff', red = dark ? '#ff8a8a' : '#e5484d'
  const lines = kind === 'fourline'
    ? [{ at: 0, c: blue, w: 2 }, { at: 40, c: blue, w: 2 }, { at: 80, c: red, w: 2.5 }, { at: 120, c: blue, w: 2 }]
    : [{ at: 0, c: red, w: 4 }, { at: 90, c: blue, w: 2, dash: 'dashed' as const }]
  const group = newId()
  return lines.map(({ at, ...style }) => ({ t: 'h' as const, id: newId(), k: 'line' as const, p: [0, at, WIDTH, at] as ShapeItem['p'], group, ...style }))
}
