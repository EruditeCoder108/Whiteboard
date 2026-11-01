import { signal } from '@preact/signals'
import type { Ptr, Tool, ToolHost } from './tool-types'
import type { StrokeItem } from './types'
import { newId } from './types'
import { inkWidth } from './ink'
import { S } from '@/state/store'

/** Geometry instruments that float above the board, OpenBoard-style. Not saved with the board. */
export type InstrumentKind = 'ruler' | 'setsquare' | 'protractor' | 'compass'

/** One centimetre in world units (≈ a real centimetre at 100 % on a 96 dpi screen). */
export const CM = 37.8

interface Placed { kind: InstrumentKind; x: number; y: number; angle: number; /** compass radius */ r: number }
interface Edge { ax: number; ay: number; bx: number; by: number }

export const instrumentsShown = signal<InstrumentKind[]>([])

const rot = (x: number, y: number, a: number): [number, number] => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]
const deg = (a: number): number => ((Math.round(a * 180 / Math.PI) % 360) + 360) % 360

export class Instruments {
  private list: Placed[] = []

  constructor(private host: Pick<ToolHost, 'view' | 'requestOverlay' | 'toWorld' | 'commitAdd'>, private centre: () => [number, number]) {}

  toggle(kind: InstrumentKind): void {
    const i = this.list.findIndex(it => it.kind === kind)
    if (i >= 0) this.list.splice(i, 1)
    else {
      const [x, y] = this.centre()
      this.list.push({ kind, x, y, angle: 0, r: 4 * CM })
    }
    instrumentsShown.value = this.list.map(it => it.kind)
    this.host.requestOverlay()
  }

  get active(): boolean { return this.list.length > 0 }

  /** Local (unrotated) outline of each straight instrument, centred on its origin. */
  private shape(it: Placed): [number, number][] {
    if (it.kind === 'ruler') { const L = 16 * CM, W = 2.4 * CM; return [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]] }
    if (it.kind === 'setsquare') { const S_ = 12 * CM; return [[0, 0], [S_, 0], [0, -S_]] }
    // Protractor: the straight baseline plus a semicircle above it.
    const R = 8 * CM, pts: [number, number][] = []
    for (let k = 0; k <= 48; k++) pts.push([R * Math.cos(Math.PI * k / 48), -R * Math.sin(Math.PI * k / 48)])
    return pts
  }

  private world(it: Placed, x: number, y: number): [number, number] { const [rx, ry] = rot(x, y, it.angle); return [it.x + rx, it.y + ry] }
  private local(it: Placed, x: number, y: number): [number, number] { return rot(x - it.x, y - it.y, -it.angle) }

  private edges(it: Placed): Edge[] {
    if (it.kind === 'compass') return []
    const pts = this.shape(it).map(([x, y]) => this.world(it, x, y))
    if (it.kind === 'protractor') { const [a, b] = [pts[0], pts.at(-1)!]; return [{ ax: a[0], ay: a[1], bx: b[0], by: b[1] }] }
    return pts.map((a, i) => { const b = pts[(i + 1) % pts.length]; return { ax: a[0], ay: a[1], bx: b[0], by: b[1] } })
  }

  private rotateHandle(it: Placed): [number, number] {
    if (it.kind === 'ruler') return this.world(it, 8 * CM - .7 * CM, 0)
    if (it.kind === 'setsquare') return this.world(it, 12 * CM - 1.4 * CM, -.5 * CM)
    return this.world(it, 8 * CM - .6 * CM, -.6 * CM)
  }

  private compassPoints(it: Placed): { pin: [number, number]; pencil: [number, number]; hinge: [number, number] } {
    const pin: [number, number] = [it.x, it.y]
    const pencil = this.world(it, it.r, 0)
    const [hx, hy] = this.world(it, it.r / 2, -Math.max(2.5 * CM, it.r * .6))
    return { pin, pencil, hinge: [hx, hy] }
  }

  private inside(it: Placed, x: number, y: number): boolean {
    const [lx, ly] = this.local(it, x, y)
    if (it.kind === 'ruler') return Math.abs(lx) <= 8 * CM && Math.abs(ly) <= 1.2 * CM
    if (it.kind === 'setsquare') return lx >= 0 && ly <= 0 && lx - ly <= 12 * CM
    if (it.kind === 'protractor') return ly <= 0 && Math.hypot(lx, ly) <= 8 * CM
    return false
  }

  /** A gesture that starts on an instrument moves, rotates or (compass) draws with it. */
  intercept(p: Ptr): Tool | null {
    const tol = 16 / this.host.view.zoom
    for (let i = this.list.length - 1; i >= 0; i--) {
      const it = this.list[i]
      if (it.kind === 'compass') {
        const { pin, pencil, hinge } = this.compassPoints(it)
        const near = (q: [number, number]): boolean => Math.hypot(q[0] - p.wx, q[1] - p.wy) <= tol * 1.4
        if (near(pencil)) return (this.arc = new CompassArc(this, it, p))
        if (near(hinge)) return new Gesture(this, p, (q) => { const [lx] = this.local(it, q.wx, q.wy); it.r = Math.max(.5 * CM, Math.min(30 * CM, lx)) }, 'Drag to set the radius')
        if (near(pin) || this.nearSegment(p, pin, hinge, tol) || this.nearSegment(p, hinge, pencil, tol)) return this.mover(it, p)
        continue
      }
      const [hx, hy] = this.rotateHandle(it)
      if (Math.hypot(hx - p.wx, hy - p.wy) <= tol * 1.4) return this.rotator(it, p)
      // The band along an edge belongs to the pen, so drawing along the ruler works.
      if (this.inside(it, p.wx, p.wy) && !this.edgeAt(p.wx, p.wy, tol)) return this.mover(it, p)
    }
    return null
  }

  private nearSegment(p: Ptr, a: [number, number], b: [number, number], tol: number): boolean {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1
    const t = Math.max(0, Math.min(1, ((p.wx - a[0]) * dx + (p.wy - a[1]) * dy) / L))
    return Math.hypot(a[0] + dx * t - p.wx, a[1] + dy * t - p.wy) <= tol
  }

  private mover(it: Placed, p: Ptr): Tool {
    const dx = it.x - p.wx, dy = it.y - p.wy
    return new Gesture(this, p, q => { it.x = q.wx + dx; it.y = q.wy + dy })
  }

  private rotator(it: Placed, p: Ptr): Tool {
    const start = Math.atan2(p.wy - it.y, p.wx - it.x) - it.angle
    return new Gesture(this, p, q => {
      let a = Math.atan2(q.wy - it.y, q.wx - it.x) - start
      // Holding Shift, or landing within 2°, snaps to 15° steps.
      const step = Math.PI / 12, snapped = Math.round(a / step) * step
      if (q.shift || Math.abs(a - snapped) < Math.PI / 90) a = snapped
      it.angle = a
    }, () => `${deg(it.angle)}°`)
  }

  /** The instrument edge under a pen landing, if any (screen tolerance). */
  edgeAt(x: number, y: number, tol = 14 / this.host.view.zoom): Edge | null {
    let best: Edge | null = null, bestD = tol
    for (const it of this.list) for (const e of this.edges(it)) {
      const dx = e.bx - e.ax, dy = e.by - e.ay, L = Math.hypot(dx, dy)
      const t = ((x - e.ax) * dx + (y - e.ay) * dy) / (L * L)
      if (t < -.02 || t > 1.02) continue
      const d = Math.abs((x - e.ax) * dy - (y - e.ay) * dx) / L
      if (d < bestD) { bestD = d; best = e }
    }
    return best
  }

  /** Pen and highlighter strokes that start on an edge follow it exactly. */
  snapTool(tool: Tool, p: Ptr): Tool {
    if (!this.active || (tool.name !== 'pen' && tool.name !== 'marker')) return tool
    const e = this.edgeAt(p.wx, p.wy)
    return e ? new EdgeSnap(tool, e, this.host) : tool
  }

  hint = ''
  /** the arc being drawn, painted with the instruments */
  arc: { paintOverlay(ctx: CanvasRenderingContext2D): void } | null = null
  changed(): void { this.host.requestOverlay() }

  commitArc(points: number[]): void {
    if (points.length < 9) return
    const style = S.penStyle.value
    const stroke: StrokeItem = { t: 's', id: newId(), c: S.penColor.value, w: inkWidth(S.penSize.value, style), m: false, v: false, ...(style === 'pen' ? {} : { style }), p: points }
    this.host.commitAdd(stroke)
  }

  paint(ctx: CanvasRenderingContext2D): void {
    const z = this.host.view.zoom
    for (const it of this.list) {
      ctx.save()
      if (it.kind === 'compass') { this.paintCompass(ctx, it, z); ctx.restore(); continue }
      ctx.translate(it.x, it.y); ctx.rotate(it.angle)
      const pts = this.shape(it)
      ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath()
      ctx.fillStyle = 'rgba(232, 240, 255, .62)'; ctx.fill()
      ctx.strokeStyle = 'rgba(47, 84, 160, .85)'; ctx.lineWidth = 1.2 / z; ctx.stroke()
      ctx.strokeStyle = '#26324a'; ctx.fillStyle = '#26324a'; ctx.lineWidth = 1 / z
      ctx.font = `${Math.max(7, .32 * CM)}px "Segoe UI", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      if (it.kind === 'ruler') {
        const L = 16 * CM, W = 2.4 * CM
        ctx.beginPath()
        for (let mm = 0; mm <= 150; mm++) {
          const x = -7.5 * CM + mm * CM / 10, h = mm % 10 === 0 ? .55 * CM : mm % 5 === 0 ? .38 * CM : .22 * CM
          ctx.moveTo(x, -W / 2); ctx.lineTo(x, -W / 2 + h)
          if (mm % 10 === 0) ctx.fillText(String(mm / 10), x, -W / 2 + .62 * CM)
        }
        ctx.stroke()
        ctx.textAlign = 'left'; ctx.fillText('cm', -L / 2 + .25 * CM, W / 2 - .55 * CM)
      } else if (it.kind === 'setsquare') {
        ctx.beginPath()
        for (let mm = 0; mm <= 100; mm++) {
          const x = .5 * CM + mm * CM / 10, h = mm % 10 === 0 ? .45 * CM : mm % 5 === 0 ? .3 * CM : .18 * CM
          ctx.moveTo(x, 0); ctx.lineTo(x, -h)
          if (mm % 10 === 0 && mm) { ctx.textBaseline = 'bottom'; ctx.fillText(String(mm / 10), x, -.5 * CM) }
        }
        ctx.stroke()
        ctx.beginPath(); ctx.rect(0, -.6 * CM, .6 * CM, .6 * CM); ctx.stroke() // right-angle mark
      } else {
        const R = 8 * CM
        ctx.beginPath()
        for (let d = 0; d <= 180; d++) {
          const a = Math.PI * d / 180, len = d % 10 === 0 ? .55 * CM : d % 5 === 0 ? .38 * CM : .2 * CM
          ctx.moveTo(R * Math.cos(a), -R * Math.sin(a)); ctx.lineTo((R - len) * Math.cos(a), -(R - len) * Math.sin(a))
        }
        ctx.stroke()
        ctx.textBaseline = 'middle'
        for (let d = 0; d <= 180; d += 10) {
          const a = Math.PI * d / 180
          ctx.fillText(String(d), (R - .95 * CM) * Math.cos(a), -(R - .95 * CM) * Math.sin(a))
          ctx.fillStyle = '#8a4fff'; ctx.fillText(String(180 - d), (R - 1.6 * CM) * Math.cos(a), -(R - 1.6 * CM) * Math.sin(a)); ctx.fillStyle = '#26324a'
        }
        ctx.beginPath(); ctx.moveTo(-.4 * CM, 0); ctx.lineTo(.4 * CM, 0); ctx.moveTo(0, 0); ctx.lineTo(0, -.4 * CM); ctx.stroke() // centre mark
      }
      ctx.restore()
      const [hx, hy] = this.rotateHandle(it)
      ctx.beginPath(); ctx.arc(hx, hy, 9 / z, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#4262ff'; ctx.lineWidth = 1.5 / z; ctx.stroke()
      ctx.beginPath(); ctx.arc(hx, hy, 4.5 / z, -2.4, 1.4); ctx.stroke()
    }
    this.arc?.paintOverlay(ctx)
    if (this.hint) {
      const dpr = window.devicePixelRatio || 1
      ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = '600 15px "Segoe UI", sans-serif'; ctx.fillStyle = 'rgba(27,32,48,.85)'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
      ctx.fillText(this.hint, 64, ctx.canvas.height / dpr - 64)
      ctx.restore()
    }
  }

  private paintCompass(ctx: CanvasRenderingContext2D, it: Placed, z: number): void {
    const { pin, pencil, hinge } = this.compassPoints(it)
    ctx.lineCap = 'round'
    ctx.strokeStyle = 'rgba(70, 80, 100, .9)'; ctx.lineWidth = 5 / z
    ctx.beginPath(); ctx.moveTo(...pin); ctx.lineTo(...hinge); ctx.lineTo(...pencil); ctx.stroke()
    ctx.strokeStyle = 'rgba(140, 150, 170, .9)'; ctx.lineWidth = 2.5 / z
    ctx.beginPath(); ctx.moveTo(...pin); ctx.lineTo(...hinge); ctx.lineTo(...pencil); ctx.stroke()
    // Dashed radius with its length, the pin and the pencil tip.
    ctx.setLineDash([4 / z, 4 / z]); ctx.strokeStyle = 'rgba(66, 98, 255, .6)'; ctx.lineWidth = 1 / z
    ctx.beginPath(); ctx.moveTo(...pin); ctx.lineTo(...pencil); ctx.stroke(); ctx.setLineDash([])
    const dot = (q: [number, number], r: number, fill: string): void => { ctx.beginPath(); ctx.arc(q[0], q[1], r / z, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill() }
    dot(pin, 5, '#26324a'); dot(hinge, 7, '#4262ff'); dot(pencil, 7, S.penColor.value); dot(pencil, 3, '#ffffff')
    ctx.font = `600 ${13 / z}px "Segoe UI", sans-serif`; ctx.fillStyle = '#26324a'; ctx.textAlign = 'center'
    ctx.fillText(`r = ${(it.r / CM).toFixed(1)} cm`, (pin[0] + pencil[0]) / 2, (pin[1] + pencil[1]) / 2 + 18 / z)
  }
}

/** Drag gesture on an instrument; `label` shows live feedback (an angle or a hint). */
class Gesture implements Tool {
  readonly name = 'instrument'
  readonly allowsRadial = false
  readonly animating = false
  constructor(private owner: Instruments, start: Ptr, private apply: (p: Ptr) => void, private label?: string | (() => string)) { void start }
  cursor(): string { return 'grabbing' }
  underway(): boolean { return true }
  down(): void {}
  move(p: Ptr): void { this.apply(p); this.owner.hint = typeof this.label === 'function' ? this.label() : this.label ?? ''; this.owner.changed() }
  up(p: Ptr): void { this.apply(p); this.owner.hint = ''; this.owner.changed() }
  cancel(): void { this.owner.hint = ''; this.owner.changed() }
}

/** Drawing an arc: the pencil sweeps around the pin at a fixed radius. */
class CompassArc implements Tool {
  readonly name = 'compass'
  readonly allowsRadial = false
  readonly animating = false
  private turned = 0
  private last: number
  private points: number[] = []
  constructor(private owner: Instruments, private it: { x: number; y: number; angle: number; r: number }, p: Ptr) {
    this.last = Math.atan2(p.wy - it.y, p.wx - it.x)
    this.it.angle = this.last
    this.push()
  }
  private push(): void { this.points.push(this.it.x + this.it.r * Math.cos(this.it.angle), this.it.y + this.it.r * Math.sin(this.it.angle), .5) }
  cursor(): string { return 'crosshair' }
  underway(): boolean { return true }
  down(): void {}
  move(p: Ptr): void {
    const a = Math.atan2(p.wy - this.it.y, p.wx - this.it.x)
    let d = a - this.last
    if (d > Math.PI) d -= Math.PI * 2
    if (d < -Math.PI) d += Math.PI * 2
    // Sample every ~3 world units along the arc, capped at one full turn.
    const step = Math.max(.004, 3 / this.it.r)
    const n = Math.ceil(Math.abs(d) / step)
    for (let k = 1; k <= n && Math.abs(this.turned) < Math.PI * 2; k++) {
      this.it.angle += d / n; this.turned += d / n
      this.push()
    }
    this.last = a
    this.owner.hint = `${Math.min(360, Math.round(Math.abs(this.turned) * 180 / Math.PI))}°`
    this.owner.changed()
  }
  up(p: Ptr): void { this.move(p); this.owner.hint = ''; this.owner.arc = null; this.owner.commitArc(this.points); this.owner.changed() }
  cancel(): void { this.owner.hint = ''; this.owner.arc = null; this.owner.changed() }
  paintOverlay(ctx: CanvasRenderingContext2D): void {
    if (this.points.length < 6) return
    ctx.save(); ctx.strokeStyle = S.penColor.value; ctx.lineWidth = S.penSize.value; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath()
    for (let i = 0; i < this.points.length; i += 3) i ? ctx.lineTo(this.points[i], this.points[i + 1]) : ctx.moveTo(this.points[i], this.points[i + 1])
    ctx.stroke(); ctx.restore()
  }
}

/** Projects every sample of a pen stroke onto an instrument edge. */
class EdgeSnap implements Tool {
  readonly allowsRadial = false
  readonly animating = false
  constructor(private inner: Tool, private e: Edge, private host: Pick<ToolHost, 'view'>) {}
  get name(): string { return this.inner.name }
  private snap(p: Ptr): Ptr {
    const { ax, ay, bx, by } = this.e
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy
    const t = ((p.wx - ax) * dx + (p.wy - ay) * dy) / L
    const wx = ax + dx * t, wy = ay + dy * t
    const v = this.host.view
    return { ...p, wx, wy, x: (wx - v.x) * v.zoom, y: (wy - v.y) * v.zoom }
  }
  cursor(): string { return this.inner.cursor() }
  underway(): boolean { return this.inner.underway() }
  down(p: Ptr): void { this.inner.down(this.snap(p)) }
  move(p: Ptr): void { this.inner.move(this.snap(p)) }
  up(p: Ptr): void { this.inner.up(this.snap(p)) }
  cancel(): void { this.inner.cancel() }
  paintOverlay(ctx: CanvasRenderingContext2D): void { this.inner.paintOverlay?.(ctx) }
}
