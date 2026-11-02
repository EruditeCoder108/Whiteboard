import type { Doc } from '../doc'
import { itemBounds, rotatePoint } from '../items'
import type { Ptr, Tool, ToolHost } from '../tool-types'
import type { ApparatusItem, Item, Rect, ShapeItem } from '../types'
import { newId } from '../types'
import { phOf, pour } from './chem'
import type { Liquid } from './chem'
import { newMemory, solveCircuit } from './circuit'
import type { CircuitPart, Memory } from './circuit'
import { WHITE, traceRays } from './optics'
import type { Optic, Ray, RaySegment } from './optics'
import { partOf, post } from './parts'
import type { C, Live, Part } from './parts'
import { NOZZLE } from './parts-chem'
import './parts-electric'
import './parts-physics'
import './parts-bio'
import './parts-chem'

export const isPart = (it: Item): it is ApparatusItem => it.t === 'a'
export const isWire = (it: Item): it is ShapeItem => it.t === 'h' && !!it.wire

/** What the world needs from the app. Given by the board, because the main process reads lesson files with this code too. */
export const appHooks = { dark: (): boolean => false, toast: (_text: string): void => {} }

const STEP = 1 / 30
const SHORT_AMPS = 8
const empty = (time: number, dark: boolean): Live => ({ volts: 0, amps: 0, time, dark })

/** From a point on the board to a part's own units, and back. Parts turn and resize like any object. */
export function toPart(it: ApparatusItem, part: Part, wx: number, wy: number): [number, number] {
  const cx = (it.p[0] + it.p[2]) / 2, cy = (it.p[1] + it.p[3]) / 2
  const [x, y] = it.angle ? rotatePoint(wx, wy, cx, cy, -it.angle) : [wx, wy]
  return [(x - it.p[0]) / (it.p[2] - it.p[0]) * part.w, (y - it.p[1]) / (it.p[3] - it.p[1]) * part.h]
}
export function fromPart(it: ApparatusItem, part: Part, x: number, y: number): [number, number] {
  const wx = it.p[0] + x / part.w * (it.p[2] - it.p[0]), wy = it.p[1] + y / part.h * (it.p[3] - it.p[1])
  return it.angle ? rotatePoint(wx, wy, (it.p[0] + it.p[2]) / 2, (it.p[1] + it.p[3]) / 2, it.angle) : [wx, wy]
}

/** Which terminal a wire's end holds: the one nearest the spot it is pinned to. */
export function terminalOf(part: Part, at: [number, number] | undefined): number {
  if (!at || !part.terminals) return -1
  let best = -1, bestD = Infinity
  part.terminals.forEach(([x, y], i) => { const d = Math.hypot(x / part.w - at[0], y / part.h - at[1]); if (d < bestD) { bestD = d; best = i } })
  return best
}

/** The circuit a page's parts and wires make. Pure, so it is tested without a board. */
export function buildCircuit(items: Item[], time: number): { parts: CircuitPart[]; joins: [string, string][] } {
  const parts: CircuitPart[] = [], joins: [string, string][] = []
  const known = new Map<string, Part>()
  for (const it of items) if (isPart(it)) {
    const part = partOf(it.kind)
    if (part?.circuit && part.terminals) {
      parts.push(part.circuit(it.id, `${it.id}:0`, `${it.id}:1`, it.params, time))
      known.set(it.id, part)
    }
  }
  for (const it of items) if (isWire(it) && it.from && it.to) {
    const a = known.get(it.from.id), b = known.get(it.to.id)
    if (!a || !b) continue
    const ta = terminalOf(a, it.from.at), tb = terminalOf(b, it.to.at)
    if (ta >= 0 && tb >= 0) joins.push([`${it.from.id}:${ta}`, `${it.to.id}:${tb}`])
  }
  return { parts, joins }
}

const inside = (b: Rect, x: number, y: number): boolean => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]
const isVessel = (it: ApparatusItem): boolean => 'ml' in it.params && it.kind !== 'burette' && it.kind !== 'reagent-bottle'
/** Glass with its liquid, in grams, for the balance: typical school glassware, with liquids as dense as water. */
const GLASS_GRAMS: Record<string, number> = { beaker: 90, 'conical-flask': 110, 'round-flask': 130, 'test-tube': 20, 'measuring-cylinder': 140, 'evaporating-dish': 120, burette: 120 }
const massOf = (it: ApparatusItem): number => isVessel(it) || it.kind === 'burette' ? (GLASS_GRAMS[it.kind] ?? 90) + it.params.ml : 0

/**
 * Everything on a page that depends on something else on the page: currents, the beam through a lens, a compass
 * near a magnet, a thermometer in a flask. Results live here, not on the items, so nothing here is saved or undone.
 * The few values that build up over time (a burette running) change `params` in place, on purpose: the item is the
 * same object and only its contents have moved on, so history stays intact.
 */
export class ApparatusWorld {
  private live = new Map<string, Live>()
  private memory: Memory = newMemory()
  private lastVersion = -1
  private lastDark = false
  private clock = 0
  private lastTick = 0
  private segments: RaySegment[] = []
  private ranDownAt = 0
  private rays = false
  /** the parts now moving, and those whose reading changed: what must be repainted */
  repaint: Item[] = []
  moving = false
  /** something built up (a burette ran) and needs saving */
  dirty = false

  readingOf(it: ApparatusItem): Live {
    return this.live.get(it.id) ?? empty(this.clock, appHooks.dark())
  }

  get time(): number { return this.clock }

  /** Called once a frame. Returns true when anything needs painting again. */
  update(doc: Doc, now: number): boolean {
    const dark = appHooks.dark()
    const items = doc.items
    const parts = items.filter(isPart)
    if (!parts.length) {
      if (this.live.size || this.segments.length) { this.live.clear(); this.segments = []; this.rays = false; this.memory = newMemory(); this.lastVersion = doc.version; return true }
      this.moving = false
      this.lastVersion = doc.version
      return false
    }
    const changed = doc.version !== this.lastVersion || dark !== this.lastDark
    const dt = this.lastTick ? Math.min(.1, (now - this.lastTick) / 1000) : STEP
    if (!changed && !this.moving) { this.lastTick = now; return false }
    if (!changed && dt < STEP * .8) return this.moving
    this.lastTick = now
    this.lastVersion = doc.version; this.lastDark = dark
    this.clock += dt

    const before = new Map([...this.live].map(([k, v]) => [k, `${v.amps.toFixed(4)}|${v.volts.toFixed(3)}|${v.value ?? ''}|${v.warn ?? ''}`]))
    const next = new Map<string, Live>()
    const { parts: circuit, joins } = buildCircuit(items, this.clock)
    const dynamic = circuit.some(p => p.kind === 'capacitor' || p.kind === 'inductor')
    const solved = solveCircuit(circuit, joins, this.memory, dynamic ? dt : null)
    let moving = false
    for (const it of parts) {
      const state = solved.get(it.id)
      const l: Live = { volts: state?.volts ?? 0, amps: state?.amps ?? 0, time: this.clock, dark }
      const part = partOf(it.kind)
      const q = it.params
      if (state && it.kind === 'bulb' && !q.burnt && Math.abs(state.volts * state.amps) > 12) { q.burnt = 1; this.dirty = true; this.lastVersion = -1 }
      if (state && it.kind === 'fuse' && !q.blown && Math.abs(state.amps) > q.a) { q.blown = 1; this.dirty = true; this.lastVersion = -1 }
      if (state && (it.kind === 'battery' || it.kind === 'cell') && Math.abs(state.amps) > SHORT_AMPS) l.warn = 'Short circuit!'
      next.set(it.id, l)
      if (part?.moving?.(q, l)) moving = true
    }
    this.live = next
    if (this.neighbours(parts, dt)) moving = true
    this.traceBeams(parts)
    this.moving = moving
    this.repaint = parts.filter(it => {
      const part = partOf(it.kind), l = next.get(it.id)!
      const was = before.get(it.id), now2 = `${l.amps.toFixed(4)}|${l.volts.toFixed(3)}|${l.value ?? ''}|${l.warn ?? ''}`
      return changed || was !== now2 || !!part?.moving?.(it.params, l)
    })
    return this.repaint.length > 0 || this.rays
  }

  /** Parts that read or act on what is around them. Returns true while any of it keeps going. */
  private neighbours(parts: ApparatusItem[], dt: number): boolean {
    const dark = appHooks.dark()
    let moving = false
    const vessels = parts.filter(isVessel)
    /** The vessel whose mouth is under this point. A bottle can also fill another bottle or a burette. */
    const under = (x: number, y: number, from?: ApparatusItem): ApparatusItem | undefined => [...vessels, ...(from ? parts.filter(v => v !== from && (v.kind === 'reagent-bottle' || v.kind === 'burette')) : [])].find(v => { const b = itemBounds(v); return x >= b[0] && x <= b[2] && y <= b[1] + (b[3] - b[1]) * .55 && y >= b[1] - 260 })
    for (const it of parts) {
      const q = it.params, part = partOf(it.kind)
      if (!part) continue
      const l = this.live.get(it.id) ?? empty(this.clock, dark)
      if (it.kind === 'burette' && q.open && q.ml > 0) {
        const [nx, ny] = fromPart(it, part, ...NOZZLE.burette)
        const target = under(nx, ny)
        const flow = Math.min(q.ml, dt * 1.5)
        if (target) pour(q as unknown as Liquid, target.params as unknown as Liquid, flow)
        else { const share = flow / q.ml; q.acid *= 1 - share; q.base *= 1 - share; q.ml -= flow }
        this.dirty = true
        moving = true
        this.repaint.push(it)
        if (target) this.lastVersion = -1
      }
      if (it.kind === 'reagent-bottle' && q.pour > 0) {
        const b = itemBounds(it)
        const target = under((b[0] + b[2]) / 2, b[3], it)
        if (target) pour(q as unknown as Liquid, target.params as unknown as Liquid, 10 * q.pour)
        else appHooks.toast('Move the bottle right above a beaker, flask, tube or another bottle, then tap its cap')
        q.pour = 0
        this.dirty = true
        this.lastVersion = -1
      }
      if ((it.kind === 'bunsen' || it.kind === 'spirit-lamp') && q.on) {
        const b = itemBounds(it), cx = (b[0] + b[2]) / 2
        for (const v of vessels) {
          const vb = itemBounds(v)
          if (cx > vb[0] && cx < vb[2] && vb[3] > b[1] - 170 && vb[3] < b[1] + (b[3] - b[1]) * .5 && v.params.ml > 0 && v.params.temp < 100) {
            v.params.temp = Math.min(100, v.params.temp + dt * (it.kind === 'bunsen' ? 700 : 350) / Math.max(40, v.params.ml + 40))
            this.dirty = true
            this.lastVersion = -1
          }
        }
        moving = true
      }
      if (it.kind === 'thermometer' || it.kind === 'ph-strip') {
        const [x, y] = fromPart(it, part, it.kind === 'thermometer' ? 35 : 25, part.h - 12)
        const host = vessels.find(v => inside(itemBounds(v), x, y) && v.params.ml > 0)
        if (host) l.value = it.kind === 'thermometer' ? host.params.temp : phOf(host.params.acid, host.params.base, host.params.ml)
      }
      if (it.kind === 'balance') {
        const b = itemBounds(it)
        let grams = 0
        for (const v of parts) {
          if (v === it) continue
          const vb = itemBounds(v), cx = (vb[0] + vb[2]) / 2
          if (cx > b[0] && cx < b[2] && Math.abs(vb[3] - b[1]) < 46) grams += massOf(v)
        }
        l.value = grams
      }
      if (it.kind === 'compass') {
        // Each pole of every magnet pulls by the inverse square; with none near, the needle points to Earth's north.
        const [cx, cy] = fromPart(it, part, part.w / 2, part.h / 2)
        let fx = 0, fy = -2e-6
        for (const m of parts) if (m.kind === 'bar-magnet') {
          const mp = partOf('bar-magnet')!
          for (const [x, sign] of [[20, 1], [240, -1]] as [number, number][]) {
            const [px, py] = fromPart(m, mp, x, 35)
            const dx = px - cx, dy = py - cy, r2 = Math.max(100, dx * dx + dy * dy), k = sign / (r2 * Math.sqrt(r2)) * 8
            // A north pole repels the needle's north end, a south pole attracts it.
            fx -= dx * k; fy -= dy * k
          }
        }
        l.value = Math.atan2(fx, -fy)
      }
      if (it.kind === 'osmosis' && q.on && q.t < 1) { q.t = Math.min(1, q.t + dt / 12); this.dirty = true }
      this.live.set(it.id, l)
    }
    this.ranDownAt = moving ? this.clock : this.ranDownAt
    return moving
  }

  private traceBeams(parts: ApparatusItem[]): void {
    const boxes = parts.filter(p => p.kind === 'ray-box')
    this.rays = boxes.length > 0
    if (!this.rays) { this.segments = []; return }
    const rays: Ray[] = []
    for (const it of boxes) {
      const part = partOf('ray-box')!, n = it.params.beams, a = it.angle ?? 0
      for (let i = 0; i < n; i++) {
        const y = 50 + (n > 1 ? (i - (n - 1) / 2) * (40 / Math.max(1, n - 1)) * 1.1 : 0)
        rays.push({ from: fromPart(it, part, 162, y), dir: [Math.cos(a), Math.sin(a)], color: WHITE })
      }
    }
    const optics: Optic[] = []
    for (const it of parts) {
      const part = partOf(it.kind)
      if (!part) continue
      const a = it.angle ?? 0, b = itemBounds(it)
      const at: [number, number] = [(it.p[0] + it.p[2]) / 2, (it.p[1] + it.p[3]) / 2]
      if (it.kind === 'convex-lens' || it.kind === 'concave-lens') {
        const k = (it.p[3] - it.p[1]) / part.h
        optics.push({ kind: 'lens', at, angle: a, half: (it.p[3] - it.p[1]) / 2 * .94, focal: it.params.f * k })
      } else if (it.kind === 'mirror') optics.push({ kind: 'mirror', at, angle: a, half: (it.p[3] - it.p[1]) / 2 * .93 })
      else if (it.kind === 'prism') optics.push({ kind: 'prism', points: [fromPart(it, part, 120, 10), fromPart(it, part, 232, 210), fromPart(it, part, 8, 210)] })
      void b
    }
    this.segments = traceRays(rays, optics)
  }

  /** The beam, above the page's objects. */
  paintOverlay(c: C): void {
    if (!this.segments.length) return
    c.save()
    c.lineCap = 'round'
    for (const s of this.segments) {
      c.beginPath(); c.moveTo(s.a[0], s.a[1]); c.lineTo(s.b[0], s.b[1])
      c.strokeStyle = s.color === WHITE ? (appHooks.dark() ? '#fff4c0' : '#e0a400') : s.color
      c.lineWidth = 3; c.stroke()
    }
    c.restore()
  }

  get hasBeams(): boolean { return this.segments.length > 0 }
  get needsSaving(): boolean { return this.dirty }
  saved(): void { this.dirty = false }

  /** A press on a live spot of a part: a terminal starts a wire; a switch or a slider does what it does. */
  intercept(p: Ptr, host: PartHost): Tool | null {
    const items = host.doc.items, zoom = host.view.zoom
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i]
      if (!isPart(it) || it.locked) continue
      const part = partOf(it.kind)
      if (!part) continue
      const scale = (it.p[2] - it.p[0]) / part.w
      const [x, y] = toPart(it, part, p.wx, p.wy)
      if (x < -40 || y < -40 || x > part.w + 40 || y > part.h + 40) continue
      if (part.terminals) {
        const reach = Math.max(20, 22 / zoom / scale)
        const t = part.terminals.findIndex(([tx, ty]) => Math.hypot(x - tx, y - ty) <= reach)
        if (t >= 0) return new WireTool(host, it, part, t, this)
      }
      for (const control of part.controls ?? []) {
        const [cx, cy] = control.at(it.params)
        if (Math.hypot(x - cx, y - cy) <= Math.max(control.reach ?? 26, 18 / zoom / scale)) return new ControlTool(host, it, part, control)
      }
    }
    return null
  }
}

export type PartHost = Pick<ToolHost, 'doc' | 'view' | 'commit' | 'refresh' | 'requestOverlay' | 'setSelection' | 'selection' | 'pruneSelection' | 'withWorld'>

/** Dragging a slider or a level, or tapping a switch: live while it moves, and one undo step when it ends. */
class ControlTool implements Tool {
  readonly name = 'part-control'
  readonly allowsRadial = false
  readonly animating = false
  private before: Item[]
  private live: ApparatusItem
  private start: Ptr | null = null
  private moved = false
  constructor(private host: PartHost, it: ApparatusItem, private part: Part, private control: Part['controls'] extends (infer T)[] | undefined ? T : never) {
    this.before = host.doc.snapshot()
    this.live = { ...it, params: { ...it.params } }
    host.doc.replaceAll(this.before.map(o => o === it ? this.live : o))
    if (host.selection.includes(it)) host.setSelection(host.selection.map(o => o === it ? this.live : o))
  }
  cursor(): string { return 'grabbing' }
  underway(): boolean { return true }
  down(p: Ptr): void { this.start = p }
  move(p: Ptr): void {
    if (!this.start || !this.control.drag) return
    if (!this.moved && Math.hypot(p.x - this.start.x, p.y - this.start.y) < 3) return
    this.moved = true
    const [x, y] = toPart(this.live, this.part, p.wx, p.wy)
    this.control.drag(this.live.params, x, y)
    this.host.refresh(itemBounds(this.live))
    this.host.doc.version++
    this.host.requestOverlay()
  }
  up(p: Ptr): void {
    if (!this.moved && this.control.tap) this.control.tap(this.live.params)
    else if (!this.moved && this.control.drag) {
      const [x, y] = toPart(this.live, this.part, p.wx, p.wy)
      this.control.drag(this.live.params, x, y)
    }
    this.host.commit(this.host.doc.diff(this.before))
    this.host.refresh(itemBounds(this.live))
  }
  cancel(): void {
    this.host.doc.replaceAll(this.before)
    this.host.pruneSelection()
    this.host.refresh(null)
  }
}

/** A wire from one terminal to another. Anywhere else, it comes back to nothing. */
class WireTool implements Tool {
  readonly name = 'wire'
  readonly allowsRadial = false
  readonly animating = false
  private end: [number, number]
  private from: [number, number]
  private target: { it: ApparatusItem; t: number; part: Part } | null = null
  private done = false
  constructor(private host: PartHost, private it: ApparatusItem, private part: Part, private t: number, private world: ApparatusWorld) {
    this.from = fromPart(it, part, ...part.terminals![t])
    this.end = this.from
  }
  cursor(): string { return 'crosshair' }
  underway(): boolean { return true }
  down(): void { this.host.requestOverlay() }
  move(p: Ptr): void {
    this.end = [p.wx, p.wy]
    this.target = null
    const items = this.host.doc.items, zoom = this.host.view.zoom
    for (let i = items.length - 1; i >= 0 && !this.target; i--) {
      const o = items[i]
      if (!isPart(o) || o.locked) continue
      const part = partOf(o.kind)
      if (!part?.terminals) continue
      const scale = (o.p[2] - o.p[0]) / part.w
      const [x, y] = toPart(o, part, p.wx, p.wy)
      const t = part.terminals.findIndex(([tx, ty]) => Math.hypot(x - tx, y - ty) <= Math.max(26, 30 / zoom / scale))
      if (t >= 0 && !(o.id === this.it.id && t === this.t)) { this.target = { it: o, t, part }; this.end = fromPart(o, part, ...part.terminals[t]) }
    }
    this.host.requestOverlay()
  }
  up(p: Ptr): void {
    this.move(p)
    const target = this.target
    this.done = true
    this.host.requestOverlay()
    if (!target) return
    const f = this.part.terminals![this.t], g = target.part.terminals![target.t]
    const polarFrom = this.part.polar && this.t === 0
    const wire: ShapeItem = {
      t: 'h', id: newId(), c: polarFrom ? '#c23a2e' : '#5b6875', w: 5, k: 'line', wire: true, p: [this.from[0], this.from[1], this.end[0], this.end[1]],
      from: { id: this.it.id, at: [f[0] / this.part.w, f[1] / this.part.h] }, to: { id: target.it.id, at: [g[0] / target.part.w, g[1] / target.part.h] }
    }
    const before = this.host.doc.snapshot()
    // Wires go over the parts, so each can be seen reaching its post.
    this.host.doc.replaceAll([...before, wire])
    this.host.commit(this.host.doc.diff(before))
    this.host.refresh(null)
    void this.world
  }
  cancel(): void { this.done = true; this.host.requestOverlay() }
  paintOverlay(c: C): void {
    if (this.done) return
    this.host.withWorld(c, () => {
      c.beginPath(); c.moveTo(this.from[0], this.from[1]); c.lineTo(this.end[0], this.end[1])
      c.strokeStyle = '#4262ff'; c.lineWidth = 5; c.lineCap = 'round'; c.setLineDash([12, 8]); c.stroke(); c.setLineDash([])
      if (this.target) { c.beginPath(); c.arc(this.end[0], this.end[1], 20, 0, Math.PI * 2); c.strokeStyle = '#2fa66a'; c.lineWidth = 4; c.stroke() }
    })
  }
}

export const world = new ApparatusWorld()

/** A part on the page, drawn in its own units. Painting asks the world what it reads. */
export function paintPart(c: C, it: ApparatusItem): void {
  const part = partOf(it.kind)
  const w = it.p[2] - it.p[0], h = it.p[3] - it.p[1]
  c.save()
  c.translate(it.p[0], it.p[1])
  if (!part) {
    // A part from a newer version: shown as a plain box rather than lost.
    c.strokeStyle = '#888'; c.strokeRect(0, 0, w, h)
    c.restore()
    return
  }
  c.scale(w / part.w, h / part.h)
  const live = world.readingOf(it)
  part.paint(c, it.params, live, it)
  part.terminals?.forEach(([x, y], i) => post(c, x, y, part.polar ? i === 0 ? 'plus' : 'minus' : 'plain'))
  c.restore()
}

export const newPart = (part: Part, cx: number, cy: number, scale = 1, overrides: Record<string, number> = {}): ApparatusItem => {
  const w = part.w * scale, h = part.h * scale
  return { t: 'a', id: newId(), c: '#111827', w: 1, p: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], kind: part.kind, params: { ...part.params, ...overrides } }
}
