import { rotatePoint } from './items'
import type { Item, Rect, ShapeItem } from './types'
import { newId } from './types'

/** Mirror an object about a point. Writing, graphs, tables and scales keep reading the right way round: only their place changes. */
export function flipItem(it: Item, cx: number, cy: number, axis: 'h' | 'v'): Item {
  const mx = (x: number): number => axis === 'h' ? 2 * cx - x : x
  const my = (y: number): number => axis === 'v' ? 2 * cy - y : y
  if (it.t === 's') {
    const p = it.p.slice()
    for (let i = 0; i + 2 < p.length; i += 3) { p[i] = mx(p[i]); p[i + 1] = my(p[i + 1]) }
    return { ...it, p }
  }
  if (it.t === 'h' && (it.k === 'line' || it.k === 'arrow')) {
    const ox = (it.p[0] + it.p[2]) / 2, oy = (it.p[1] + it.p[3]) / 2
    const a = rotatePoint(it.p[0], it.p[1], ox, oy, it.angle ?? 0), b = rotatePoint(it.p[2], it.p[3], ox, oy, it.angle ?? 0)
    return { ...it, p: [mx(a[0]), my(a[1]), mx(b[0]), my(b[1])], angle: 0 }
  }
  const nx = mx((it.p[0] + it.p[2]) / 2), ny = my((it.p[1] + it.p[3]) / 2)
  const hw = Math.abs(it.p[2] - it.p[0]) / 2, hh = Math.abs(it.p[3] - it.p[1]) / 2
  const p: Rect = [nx - hw, ny - hh, nx + hw, ny + hh]
  const angle = -(it.angle ?? 0)
  if (it.t === 'i' && it.latex === undefined) {
    const { flipX, flipY, ...rest } = it
    const x = axis === 'h' ? !flipX : !!flipX, y = axis === 'v' ? !flipY : !!flipY
    return { ...rest, p, angle, ...(x ? { flipX: true } : {}), ...(y ? { flipY: true } : {}) }
  }
  // A triangle is only drawn point-up, so upside down is a half turn of its mirror image.
  if (it.t === 'h' && it.k === 'triangle' && axis === 'v') return { ...it, p, angle: angle + Math.PI }
  return { ...it, p, angle }
}

/** Links open in the teacher's browser, so only ordinary web addresses count. */
export function safeLink(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const text = raw.trim()
  if (!text || text.length > 2000) return null
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`)
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname.includes('.')) return null
    return url.href
  } catch { return null }
}

// ── mind maps ─────────────────────────────────────────────────────────────────
export const NODE_W = 250
export const NODE_H = 86
const GAP = 110
/** Soft fills that dark text reads well on, on any board colour. */
export const BRANCH_FILLS = ['#d3e6ff', '#d7f0dd', '#fff2a8', '#ffd3dc', '#e7d9ff', '#ffe2c4']

/** Tried in this order: a map grows out sideways first, the way people draw one. */
const DIRECTIONS: [number, number][] = [[1, 0], [-1, 0], [1, -.8], [-1, -.8], [1, .8], [-1, .8], [0, -1], [0, 1]]

const clash = (a: Rect, b: Rect, pad: number): boolean => a[0] < b[2] + pad && a[2] + pad > b[0] && a[1] < b[3] + pad && a[3] + pad > b[1]

/** The nearest clear place for a new branch; further out if everything near is taken. */
export function branchSpot(parent: Rect, taken: Rect[], within: Rect): Rect {
  const px = (parent[0] + parent[2]) / 2, py = (parent[1] + parent[3]) / 2
  const reachX = (parent[2] - parent[0]) / 2 + GAP + NODE_W / 2, reachY = (parent[3] - parent[1]) / 2 + GAP * .7 + NODE_H / 2
  for (let ring = 1; ring <= 4; ring++) for (const [dx, dy] of DIRECTIONS) {
    const cx = px + dx * reachX * ring, cy = py + dy * reachY * ring
    const spot: Rect = [cx - NODE_W / 2, cy - NODE_H / 2, cx + NODE_W / 2, cy + NODE_H / 2]
    if (spot[0] < within[0] || spot[1] < within[1] || spot[2] > within[2] || spot[3] > within[3]) continue
    if (!taken.some(t => clash(spot, t, 18))) return spot
  }
  // Nowhere clear on screen: overlap beats losing the new idea off the board.
  const cx = Math.min(within[2] - NODE_W / 2, px + reachX), cy = Math.min(within[3] - NODE_H / 2, py + reachY)
  return [cx - NODE_W / 2, cy - NODE_H / 2, cx + NODE_W / 2, cy + NODE_H / 2]
}

export function mindNode(p: Rect, fill: string, line: string, big = false): ShapeItem {
  return { t: 'h', id: newId(), c: line, w: 3, k: 'rect', p, radius: 26, fill, text: '', fontSize: big ? 30 : 25, bold: big, align: 'center', textColor: '#172033' }
}
