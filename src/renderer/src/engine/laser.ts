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
  private layer: CanvasRenderingContext2D | null = null
  private static LIFE = 2.4
  private static HEAD_FADE = .65
  private static MAX_POINTS = 8192
  private static SLICE = .05
  /** Colour, width, peak opacity and mask channel (0 red, 1 green) of the core and halo. */
  private static PASSES = [['#ff3030', 4, .12, 1], ['#ff2424', 1.8, .95, 0]] as const
  private static filters = new Set<number>()
  private static filter(channel: number): string {
    const id = `fw-laser-mask-${channel}`
    if (!LaserTool.filters.has(channel) && typeof document !== 'undefined') {
      const [r, g, b] = channel === 0 ? [1, .141, .141] : [1, .188, .188]
      const alpha = channel === 0 ? '1 0 0 0 0' : '0 1 0 0 0'
      const holder = document.createElement('div')
      holder.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  ${alpha}"/></filter></svg>`
      document.body.appendChild(holder.firstElementChild!)
      LaserTool.filters.add(channel)
    }
    return id
  }

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

  /** Offscreen trail layer, so erasing slice joins never touches other live-canvas content. */
  private layerFor(ctx: CanvasRenderingContext2D): CanvasRenderingContext2D {
    const target = ctx.canvas
    if (!target || typeof document === 'undefined') return ctx // canvas-less test contexts
    if (!this.layer) this.layer = document.createElement('canvas').getContext('2d')
    const layer = this.layer
    if (!layer) return ctx
    if (layer.canvas.width !== target.width || layer.canvas.height !== target.height) {
      layer.canvas.width = target.width; layer.canvas.height = target.height
    }
    return layer
  }
  paintOverlay(ctx: CanvasRenderingContext2D): void {
    const now = this.clock()
    this.prune(now)
    const cutoff = now - LaserTool.LIFE
    const fade = (t: number): number => 1 - Math.pow(clamp((now - t) / LaserTool.LIFE, 0, 1), 3)
    // The smoothed path runs through sample midpoints. It is painted in short time slices, each at
    // its own age. A single gradient between the oldest and newest points cannot follow a path that
    // doubles back, so parts of a scribble would vanish and reappear as the head moved.
    const slices: { trace: (g: CanvasRenderingContext2D) => void; alpha: number }[] = []
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
      const n = points.length
      const mid = (k: number): [number, number] => [(points[k - 1].x + points[k].x) / 2, (points[k - 1].y + points[k].y) / 2]
      for (let s = 1; s < n;) {
        let e = s
        while (e < n - 1 && points[e].t - points[s - 1].t < LaserTool.SLICE) e++
        const from = s, to = e
        slices.push({ alpha: fade((points[from - 1].t + points[to].t) / 2), trace: g => {
          const [x0, y0] = from === 1 ? [points[0].x, points[0].y] : mid(from - 1)
          g.beginPath(); g.moveTo(x0, y0)
          for (let k = from; k <= to; k++) { const [x, y] = mid(k); g.quadraticCurveTo(points[k - 1].x, points[k - 1].y, x, y) }
          if (to === n - 1) g.lineTo(points[n - 1].x, points[n - 1].y) // no lag behind the actual pointer/lift endpoint
        } })
        s = e + 1
      }
    }
    const g = this.layerFor(ctx), transform = ctx.getTransform?.()
    if (g === ctx || !transform) {
      // Canvas-less contexts (unit tests) get plain strokes with the same geometry and opacity.
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      for (const [colour, width, opacity] of LaserTool.PASSES) for (const slice of slices) {
        slice.trace(ctx); ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.globalAlpha = opacity * slice.alpha; ctx.stroke()
      }
      ctx.restore()
    } else if (slices.length) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const p of this.trail) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y) }
      const a = transform.transformPoint({ x: minX - 4, y: minY - 4 }), b = transform.transformPoint({ x: maxX + 4, y: maxY + 4 })
      const x = Math.max(0, Math.floor(Math.min(a.x, b.x))), y = Math.max(0, Math.floor(Math.min(a.y, b.y)))
      const w = Math.min(g.canvas.width, Math.ceil(Math.max(a.x, b.x))) - x, h = Math.min(g.canvas.height, Math.ceil(Math.max(a.y, b.y))) - y
      if (w > 0 && h > 0) {
        // Opacity is painted as brightness on opaque black (core in red, halo in green) with `lighten`,
        // i.e. a per-pixel maximum. Newer slices are always more opaque, so they win at joins and
        // crossings without the dark beads of stacked translucency or the rings of erase-and-redraw.
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(x, y, w, h)
        g.setTransform(transform); g.save()
        g.lineCap = 'round'; g.lineJoin = 'round'; g.globalCompositeOperation = 'lighten'
        for (const [, width, opacity, channel] of LaserTool.PASSES) for (const slice of slices) {
          const v = Math.round(255 * opacity * slice.alpha)
          slice.trace(g); g.lineWidth = width; g.strokeStyle = channel === 0 ? `rgb(${v},0,0)` : `rgb(0,${v},0)`; g.stroke()
        }
        g.restore()
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0)
        // Halo first, then core: each SVG colour matrix turns one channel into alpha of the laser red.
        for (const id of [LaserTool.filter(1), LaserTool.filter(0)]) { ctx.filter = `url(#${id})`; ctx.drawImage(g.canvas, x, y, w, h, x, y, w, h) }
        ctx.restore()
      }
    }
    ctx.save()
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
