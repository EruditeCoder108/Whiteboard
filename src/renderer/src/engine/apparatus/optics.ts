/** Rays through thin lenses, flat mirrors and a glass prism, in board units. Pure, so it can be checked against the lens formula. */
export type Pt = [number, number]
export interface Ray { from: Pt; dir: Pt; color: string; index?: number }
export type Optic =
  | { kind: 'lens'; at: Pt; angle: number; half: number; focal: number }
  | { kind: 'mirror'; at: Pt; angle: number; half: number }
  | { kind: 'prism'; points: [Pt, Pt, Pt] }
export interface RaySegment { a: Pt; b: Pt; color: string }

const FAR = 5000
const MAX_BOUNCES = 12
/** White light in order of how strongly glass bends it. The spread is larger than real glass so a class can see it. */
export const SPECTRUM: { color: string; index: number }[] = [
  { color: '#ff3b30', index: 1.47 }, { color: '#ff9500', index: 1.485 }, { color: '#ffd60a', index: 1.5 }, { color: '#30d158', index: 1.515 },
  { color: '#40c8e0', index: 1.53 }, { color: '#3a5bff', index: 1.545 }, { color: '#a855f7', index: 1.56 }
]
export const WHITE = '#fff7d6'
const GLASS = 1.5

const unit = (v: Pt): Pt => { const L = Math.hypot(v[0], v[1]) || 1; return [v[0] / L, v[1] / L] }
const dot = (a: Pt, b: Pt): number => a[0] * b[0] + a[1] * b[1]

/** Where a ray from `o` along `d` first crosses the segment a–b: distance along the ray and across the segment (0–1). */
function crossing(o: Pt, d: Pt, a: Pt, b: Pt): { t: number; u: number } | null {
  const ex = b[0] - a[0], ey = b[1] - a[1], denom = d[0] * ey - d[1] * ex
  if (Math.abs(denom) < 1e-9) return null
  const t = ((a[0] - o[0]) * ey - (a[1] - o[1]) * ex) / denom
  const u = ((a[0] - o[0]) * d[1] - (a[1] - o[1]) * d[0]) / denom
  return t > 1e-6 && u >= 0 && u <= 1 ? { t, u } : null
}

/** A thin lens: the ray keeps its height and its slope changes by height over focal length. */
export function throughLens(d: Pt, height: number, focal: number, axis: Pt): Pt {
  const along = dot(d, axis), side: Pt = [-axis[1], axis[0]], across = dot(d, side)
  const sign = along >= 0 ? 1 : -1
  const slope = across / Math.abs(along || 1e-9) - height / focal
  return unit([axis[0] * sign + side[0] * slope, axis[1] * sign + side[1] * slope])
}

/** Snell's law; null when the ray is totally reflected. `normal` faces the incoming ray. */
export function refract(d: Pt, normal: Pt, ratio: number): Pt | null {
  const c = -dot(d, normal), k = 1 - ratio * ratio * (1 - c * c)
  if (k < 0) return null
  const m = ratio * c - Math.sqrt(k)
  return unit([ratio * d[0] + m * normal[0], ratio * d[1] + m * normal[1]])
}
const reflect = (d: Pt, n: Pt): Pt => { const k = 2 * dot(d, n); return [d[0] - k * n[0], d[1] - k * n[1]] }

const opticEnds = (o: Extract<Optic, { at: Pt }>): [Pt, Pt] => {
  const c = Math.cos(o.angle), s = Math.sin(o.angle)
  return [[o.at[0] - s * o.half * -1, o.at[1] - c * o.half], [o.at[0] + s * o.half * -1, o.at[1] + c * o.half]]
}

export function traceRays(rays: Ray[], optics: Optic[]): RaySegment[] {
  const segments: RaySegment[] = []
  const queue = rays.map(r => ({ ...r, bounces: 0, inside: false }))
  while (queue.length && segments.length < 2000) {
    const ray = queue.pop()!
    let best: { t: number; act: () => void } | null = null
    const d = unit(ray.dir)
    for (const o of optics) {
      if (o.kind === 'lens' || o.kind === 'mirror') {
        const [a, b] = opticEnds(o)
        const hit = crossing(ray.from, d, a, b)
        if (!hit || (best && hit.t >= best.t)) continue
        const at: Pt = [ray.from[0] + d[0] * hit.t, ray.from[1] + d[1] * hit.t]
        best = { t: hit.t, act: () => {
          const axis: Pt = [Math.cos(o.angle), Math.sin(o.angle)]
          if (o.kind === 'mirror') queue.push({ ...ray, from: at, dir: reflect(d, axis), bounces: ray.bounces + 1 })
          else {
            const side: Pt = [-axis[1], axis[0]]
            const height = (at[0] - o.at[0]) * side[0] + (at[1] - o.at[1]) * side[1]
            queue.push({ ...ray, from: at, dir: throughLens(d, height, o.focal, axis), bounces: ray.bounces + 1 })
          }
        } }
      } else {
        for (let i = 0; i < 3; i++) {
          const a = o.points[i], b = o.points[(i + 1) % 3]
          const hit = crossing(ray.from, d, a, b)
          if (!hit || (best && hit.t >= best.t)) continue
          const at: Pt = [ray.from[0] + d[0] * hit.t, ray.from[1] + d[1] * hit.t]
          best = { t: hit.t, act: () => {
            let n: Pt = unit([-(b[1] - a[1]), b[0] - a[0]])
            if (dot(n, d) > 0) n = [-n[0], -n[1]]
            const emit = (color: string, index: number): void => {
              const ratio = ray.inside ? index : 1 / index
              const out = refract(d, n, ratio)
              if (out) queue.push({ ...ray, from: at, dir: out, color, index, inside: !ray.inside, bounces: ray.bounces + 1 })
              else queue.push({ ...ray, from: at, dir: reflect(d, n), color, index, bounces: ray.bounces + 1 })
            }
            // White light entering glass splits into its colours.
            if (!ray.inside && ray.index === undefined) for (const s of SPECTRUM) emit(s.color, s.index)
            else emit(ray.color, ray.index ?? GLASS)
          } }
        }
      }
    }
    const length = best ? best.t : FAR
    segments.push({ a: ray.from, b: [ray.from[0] + d[0] * length, ray.from[1] + d[1] * length], color: ray.color })
    if (best && ray.bounces < MAX_BOUNCES) best.act()
  }
  return segments
}
