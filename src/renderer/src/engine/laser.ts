import { clamp } from './geometry'
import type { Ptr, Tool, ToolHost } from './tool-types'

interface TrailPoint { x: number; y: number; t: number; stroke: number }

/** Screen-space presentation pointer. Contacts are separate, transient paths. */
export class LaserTool implements Tool {
  readonly name = 'laser'
  readonly allowsRadial = true
  private trail: TrailPoint[] = []
  private head: [number, number] | null = null
  private headLive = false
  private headGone = 0
  private source: string | null = null
  private stroke = 0
  private contact = false
  private static LIFE = 2.4
  private static HEAD_FADE = .65
  private static MAX_POINTS = 8192

  constructor(private host: Pick<ToolHost, 'requestOverlay'>, private clock = () => performance.now() / 1000) {}

  get animating(): boolean { return this.trail.length > 0 || (this.head !== null && !this.headLive) }
  cursor(): string { return 'none' }
  underway(): boolean { return false }

  private prune(now: number): void {
    // Retain a boundary sample for interpolation instead of popping the tail by a segment.
    const cutoff = now - LaserTool.LIFE
    let first = 0
    while (first + 1 < this.trail.length && this.trail[first + 1].t <= cutoff) first++
    if (first) this.trail.splice(0, first)
    if (this.trail.length === 1 && this.trail[0].t <= cutoff) this.trail = []
  }

  private add(p: Ptr): void {
    const now = this.clock()
    this.prune(now)
    const source = `${p.type}:${p.id}`
    const last = this.trail.at(-1)
    // Late coalesced samples must not move the pointer backwards.
    if (this.source === source && last && p.t < last.t) return
    if (this.source !== source) { this.stroke++; this.source = source }
    this.head = [p.x, p.y]
    this.headLive = true
    if (!last || last.stroke !== this.stroke || Math.hypot(last.x - p.x, last.y - p.y) >= .5) {
      this.trail.push({ x: p.x, y: p.y, t: Math.min(p.t, now), stroke: this.stroke })
      // A safety bound, far beyond normal coalesced input. Never discard an 80-point batch.
      if (this.trail.length > LaserTool.MAX_POINTS) this.trail.shift()
    }
    this.host.requestOverlay()
  }

  down(p: Ptr): void {
    this.source = null // a new touch/pen contact never bridges a previous contact
    this.contact = true
    this.add(p)
  }
  move(p: Ptr): void { if (this.contact) this.add(p) }
  hover(p: Ptr): void { if (p.type !== 'touch') this.add(p) }
  up(p: Ptr): void {
    if (this.contact) this.add(p) // keep the final endpoint even when moves were coalesced
    this.contact = false
    if (p.type !== 'mouse') this.leave()
  }
  cancel(): void { this.contact = false; this.leave() }
  leave(): void {
    this.source = null
    this.headLive = false
    this.headGone = this.clock()
    this.host.requestOverlay()
  }

  paintOverlay(ctx: CanvasRenderingContext2D): void {
    const now = this.clock()
    this.prune(now)
    ctx.save()
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    const cutoff = now - LaserTool.LIFE
    for (let first = 0; first < this.trail.length;) {
      let end = first + 1
      while (end < this.trail.length && this.trail[end].stroke === this.trail[first].stroke) end++
      const points = this.trail.slice(first, end)
      first = end
      if (points.length < 2 || points.at(-1)!.t <= cutoff) continue
      if (points[0].t < cutoff) {
        const a = points[0], b = points[1]
        const u = clamp((cutoff - a.t) / Math.max(1e-6, b.t - a.t), 0, 1)
        points[0] = { ...a, x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, t: cutoff }
      }
      const a = points[0], b = points.at(-1)!
      const fade = (t: number): number => 1 - Math.pow(clamp((now - t) / LaserTool.LIFE, 0, 1), 3)
      // One smoothed path per contact avoids dark beads at overlapping segment caps.
      ctx.beginPath(); ctx.moveTo(a.x, a.y)
      for (let i = 1; i < points.length; i++) {
        const previous = points[i - 1], point = points[i]
        ctx.quadraticCurveTo(previous.x, previous.y, (previous.x + point.x) / 2, (previous.y + point.y) / 2)
      }
      ctx.lineTo(b.x, b.y) // no lag behind the actual pointer/lift endpoint
      const colour = (rgb: string): string | CanvasGradient => {
        if (Math.hypot(b.x - a.x, b.y - a.y) < 1) return `rgba(${rgb},${fade(b.t)})`
        const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
        gradient.addColorStop(0, `rgba(${rgb},${fade(a.t)})`)
        gradient.addColorStop(1, `rgba(${rgb},${fade(b.t)})`)
        return gradient
      }
      ctx.strokeStyle = colour('255,48,48'); ctx.lineWidth = 4; ctx.globalAlpha = .12; ctx.stroke()
      ctx.strokeStyle = colour('255,36,36'); ctx.lineWidth = 1.8; ctx.globalAlpha = .95; ctx.stroke()
    }
    if (this.head) {
      const fade = this.headLive ? 1 : clamp(1 - (now - this.headGone) / LaserTool.HEAD_FADE, 0, 1)
      if (fade <= 0) this.head = null
      else {
        const [x, y] = this.head
        ctx.globalAlpha = .16 * fade; ctx.fillStyle = '#ff3030'
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = fade; ctx.fillStyle = '#ff2424'
        ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#fff4ed'
        ctx.beginPath(); ctx.arc(x, y, .9, 0, Math.PI * 2); ctx.fill()
      }
    }
    ctx.restore()
  }
}
