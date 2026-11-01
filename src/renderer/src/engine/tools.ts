import { clamp, rectsHit, unionRect } from './geometry'
import { anchorFor, attachAt, followersOf, isConnector, letGo, routeConnector } from './connectors'
import { concealed, hitCircle, hitObject, itemBounds, paintItem, rotatePoint, splitErase, translateItem } from './items'
import { expandGroups, transformItem } from './transforms'
import { handleCursor, HANDLE_ORDER, insideSelection, itemInLasso, pickSelectionHandle, resizeSelection, selectionHandles } from './selection'
import type { SelectionHandle } from './selection'
import { Smoother, smoothingToCutoff } from './smoother'
import { dividerAt, moveDivider } from './table'
import type { Divider } from './table'
import { isBox, newId } from './types'
import type { Item, Rect, ShapeItem, ShapeKind, StrokeItem, LabItem, TableItem } from './types'
import type { Ptr, Tool, ToolHost } from './tool-types'
import { recognize } from './recognize'
import { inkFollowsSpeed, inkVaries, inkWidth } from './ink'
import type { PenChoice } from './ink'
import { S, isDarkBg, showToast } from '@/state/store'
import { launchHandle, labToWorld, worldToLab } from './science/scene'
import { supportedLab } from './science/runtime'
import { labState } from './science/models'
import { magnetCenter, magnetPosition } from './science/showcase-models'

// ── cursors ───────────────────────────────────────────────────────────────────
/** Soft pen: slow strokes sit at this pressure, fast ones thin towards 0.3 (by ~2500 px/s). */
const SOFT_REST = 0.72
export const softPressure = (speed: number): number => SOFT_REST - 0.42 * Math.min(1, speed / 2500)

const cursorCache = new Map<string, string>()

/** A crisp ring cursor sized to the real brush (1× and 2× variants). */
function brushCursor(diameter: number, color: string, marker: boolean): string {
  const d = Math.round(clamp(diameter, 6, 80))
  const key = `${d}|${color}|${marker}`
  const hit = cursorCache.get(key)
  if (hit) return hit
  const make = (scale: number): string => {
    const side = d + 6
    const c = document.createElement('canvas')
    c.width = c.height = Math.ceil(side * scale)
    const g = c.getContext('2d')!
    g.scale(scale, scale)
    const m = side / 2
    g.lineWidth = 2.4
    g.strokeStyle = 'rgba(255,255,255,0.92)'
    g.beginPath(); g.arc(m, m, d / 2, 0, Math.PI * 2); g.stroke()
    g.lineWidth = 1
    g.strokeStyle = 'rgba(20,24,40,0.85)'
    g.beginPath(); g.arc(m, m, d / 2, 0, Math.PI * 2); g.stroke()
    g.fillStyle = 'rgba(255,255,255,0.95)'
    g.beginPath(); g.arc(m, m, 2.3, 0, Math.PI * 2); g.fill()
    g.fillStyle = marker ? 'rgba(20,24,40,0.9)' : color
    g.beginPath(); g.arc(m, m, 1.3, 0, Math.PI * 2); g.fill()
    return c.toDataURL()
  }
  const hot = Math.round((d + 6) / 2)
  const css = `-webkit-image-set(url(${make(1)}) 1x, url(${make(2)}) 2x) ${hot} ${hot}, crosshair`
  if (cursorCache.size > 120) cursorCache.clear()
  cursorCache.set(key, css)
  return css
}

// ── pen & highlighter ─────────────────────────────────────────────────────────
export class PenTool implements Tool {
  readonly allowsRadial = true
  readonly animating = false
  private pts: number[] = []
  private live: Omit<StrokeItem, 'p'> | null = null
  private smoother = new Smoother()
  private pressure = 0.5
  private soft = false
  private lastRaw: [number, number, number] = [0, 0, 0]
  private lastS: [number, number] = [0, 0]
  private pointTimes: number[] = []
  private strokeStart = 0
  /** Hold still before lifting and a rough shape snaps clean. */
  private holdTimer = 0
  private snapped: Item | null = null
  private heldAt: [number, number] = [0, 0]
  private ahead: number[] = []

  constructor(
    private host: ToolHost,
    private marker: boolean,
    readonly name: string
  ) {}

  cursor(): string {
    const size = this.marker ? S.markerSize.value : inkWidth(S.penSize.value, S.penStyle.value)
    const color = this.marker ? S.markerColor.value : S.penColor.value
    return brushCursor(size * this.host.view.zoom, color, this.marker)
  }

  underway(): boolean {
    return this.pts.length > 24
  }

  down(p: Ptr): void {
    const style: PenChoice = this.marker ? 'pen' : S.penStyle.value
    // Touch panels (most classroom boards are IR) send no pressure: width follows speed instead.
    this.soft = !this.marker && inkVaries(style) && ((S.pressure.value && p.type === 'touch') || (inkFollowsSpeed(style) && p.type !== 'pen'))
    const variable = !this.marker && inkVaries(style) && ((S.pressure.value && p.type === 'pen') || this.soft)
    this.lastRaw = [p.x, p.y, p.t]
    this.live = {
      t: 's',
      id: newId(),
      c: S.inkOverride.value ?? (this.marker ? S.markerColor.value : S.penColor.value),
      w: this.marker ? S.markerSize.value : inkWidth(S.penSize.value, style),
      m: this.marker,
      v: variable,
      ...(style === 'pen' ? {} : { style })
    }
    this.pressure = this.soft ? SOFT_REST : variable ? clamp(p.pressure, 0.05, 1) : 0.5
    this.smoother.reset()
    this.smoother.feed(p.x, p.y, p.t, smoothingToCutoff(S.smoothing.value))
    this.pts = [p.wx, p.wy, this.pressure]
    this.strokeStart = p.t
    this.pointTimes = [0]
    this.lastS = [p.x, p.y]
    this.armHold(p)
    this.host.requestOverlay()
  }

  predict(pts: Ptr[]): void {
    // At most ~30 ms ahead, only roughly along the current direction of travel and never further
    // than the last real step or two: a wild guess flickering ahead of the pen looks worse than lag.
    this.ahead = []
    if (!this.live || this.snapped || !pts.length || this.pts.length < 6) return
    const guess = pts.filter(p => p.t - pts[0].t < .03).at(-1)!
    const n = this.pts.length, lx = this.pts[n - 3], ly = this.pts[n - 2], px = this.pts[n - 6], py = this.pts[n - 5]
    const step = Math.hypot(lx - px, ly - py)
    let dx = guess.wx - lx, dy = guess.wy - ly
    const len = Math.hypot(dx, dy)
    if (!len || !step || (dx * (lx - px) + dy * (ly - py)) < .5 * len * step) return
    const cap = Math.min(len, step * 2, 24 / this.host.view.zoom)
    dx *= cap / len; dy *= cap / len
    this.ahead.push(lx + dx, ly + dy, this.pressure)
  }

  private armHold(p: Ptr): void {
    window.clearTimeout(this.holdTimer)
    if (this.marker) return
    this.heldAt = [p.x, p.y]
    this.holdTimer = window.setTimeout(() => {
      if (!this.live || this.pts.length < 18) return
      this.snapped = recognize({ ...this.live, p: this.pts })
      if (this.snapped) this.host.requestOverlay()
    }, 600)
  }

  move(p: Ptr): void {
    if (!this.live) return
    // Small tremor while holding keeps the hold; a real move resumes freehand drawing.
    if (Math.hypot(p.x - this.heldAt[0], p.y - this.heldAt[1]) > 5) { this.snapped = null; this.armHold(p) }
    if (this.snapped) return
    let sx = p.x
    let sy = p.y
    if (S.smoothing.value > 0) [sx, sy] = this.smoother.feed(p.x, p.y, p.t, smoothingToCutoff(S.smoothing.value))
    if (this.soft) {
      const dt = p.t - this.lastRaw[2]
      if (dt > 0) {
        const speed = Math.hypot(p.x - this.lastRaw[0], p.y - this.lastRaw[1]) / dt // px/s
        this.pressure = this.pressure * 0.8 + softPressure(speed) * 0.2
      }
      this.lastRaw = [p.x, p.y, p.t]
    } else if (this.live.v) this.pressure = this.pressure * 0.55 + clamp(p.pressure, 0.02, 1) * 0.45
    if (Math.hypot(sx - this.lastS[0], sy - this.lastS[1]) < 0.6) return
    const [wx, wy] = this.host.toWorld(sx, sy)
    this.pts.push(wx, wy, this.pressure)
    this.pointTimes.push(Math.max(this.pointTimes.at(-1) ?? 0, (p.t - this.strokeStart) * 1000))
    this.lastS = [sx, sy]
    this.host.requestOverlay()
  }

  up(p: Ptr): void {
    if (!this.live) return
    window.clearTimeout(this.holdTimer)
    this.ahead = []
    if (this.snapped) {
      const shape = this.snapped
      this.snapped = null; this.live = null; this.pts = []; this.pointTimes = []
      this.host.commitAdd(shape)
      this.host.requestOverlay()
      return
    }
    // finish exactly where the pen lifted, so smoothing never shortens a stroke
    if (this.pts.length > 3 && Math.hypot(p.x - this.lastS[0], p.y - this.lastS[1]) > 0.6) {
      this.pts.push(p.wx, p.wy, this.pressure)
      this.pointTimes.push(Math.max(this.pointTimes.at(-1) ?? 0, (p.t - this.strokeStart) * 1000))
    }
    const item: StrokeItem = { ...this.live, p: this.pts.slice() }
    this.live = null
    this.pts = []
    this.host.commitAdd(item, { duration: Math.max(this.pointTimes.at(-1) ?? 0, (p.t - this.strokeStart) * 1000), times: this.pointTimes.slice() })
    this.pointTimes = []
    this.host.requestOverlay()
  }

  cancel(): void {
    window.clearTimeout(this.holdTimer)
    this.snapped = null
    this.ahead = []
    this.live = null
    this.pts = []
    this.pointTimes = []
    this.host.requestOverlay()
  }

  paintOverlay(ctx: CanvasRenderingContext2D): void {
    if (!this.live) return
    if (this.snapped) { const shape = this.snapped; this.host.withWorld(ctx, () => paintItem(ctx, shape)); return }
    const item: StrokeItem = { ...this.live, p: this.ahead.length ? [...this.pts, ...this.ahead] : this.pts }
    this.host.withWorld(ctx, () => paintItem(ctx, item))
  }
}

// ── shapes ────────────────────────────────────────────────────────────────────
let toldAttached = false

/** How near an end must land to attach: more forgiving for a finger. */
const attachReach = (p: Ptr, zoom: number): number => (p.type === 'touch' ? 16 : 9) / zoom

/** The object an end would attach to, outlined so the teacher sees it before letting go. */
function paintAttachHint(ctx: CanvasRenderingContext2D, host: ToolHost, target: Item | null): void {
  if (!target) return
  const b = itemBounds(target), z = host.view.zoom
  ctx.save()
  ctx.strokeStyle = '#4262ff'
  ctx.fillStyle = 'rgba(66,98,255,0.10)'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.roundRect((b[0] - host.view.x) * z - 6, (b[1] - host.view.y) * z - 6, (b[2] - b[0]) * z + 12, (b[3] - b[1]) * z + 12, 8)
  ctx.fill(); ctx.stroke()
  ctx.restore()
}

export class ShapeTool implements Tool {
  readonly allowsRadial = true
  readonly animating = false
  readonly name: string
  private draft: ShapeItem | null = null
  /** arrows and lines: where the pointer pressed, and what each end would attach to */
  private pressed: [number, number] = [0, 0]
  private startOn: Item | null = null
  private endOn: Item | null = null

  constructor(
    private host: ToolHost,
    private kind: ShapeKind
  ) {
    this.name = kind
  }

  cursor(): string {
    return 'crosshair'
  }
  underway(): boolean {
    return this.draft !== null
  }

  down(p: Ptr): void {
    this.draft = { t: 'h', id: newId(), c: S.penColor.value, w: S.penSize.value, k: this.kind, p: [p.wx, p.wy, p.wx, p.wy] }
    this.pressed = [p.wx, p.wy]
    this.startOn = this.endOn = null
    if (this.joins) this.startOn = attachAt(this.host.doc.items, p.wx, p.wy, attachReach(p, this.host.view.zoom))
    this.host.requestOverlay()
  }

  move(p: Ptr): void {
    const d = this.draft
    if (!d) return
    const [x0, y0] = this.pressed
    let x = p.wx
    let y = p.wy
    if (p.shift) {
      const dx = x - x0
      const dy = y - y0
      if (this.kind === 'line' || this.kind === 'arrow') {
        const L = Math.hypot(dx, dy)
        const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12)
        x = x0 + L * Math.cos(a)
        y = y0 + L * Math.sin(a)
      } else {
        const m = Math.max(Math.abs(dx), Math.abs(dy))
        x = x0 + Math.sign(dx || 1) * m
        y = y0 + Math.sign(dy || 1) * m
      }
    }
    this.draft = this.joins ? this.joined(d, x, y, p) : { ...d, p: [x0, y0, x, y] }
    this.host.requestOverlay()
  }

  private get joins(): boolean { return this.kind === 'line' || this.kind === 'arrow' }

  /** The connector as it would be dropped here. Both ends inside one object is a line drawn on it: nothing attaches. */
  private joined(d: ShapeItem, x: number, y: number, p: Ptr): ShapeItem {
    const items = this.host.doc.items
    const hit = attachAt(items, p.wx, p.wy, attachReach(p, this.host.view.zoom))
    const same = !!hit && hit === this.startOn
    this.endOn = same ? null : hit
    const { from: _from, to: _to, ...plain } = d
    const c: ShapeItem = {
      ...plain, p: [this.pressed[0], this.pressed[1], x, y],
      ...(this.startOn && !same ? { from: anchorFor(this.startOn, this.pressed[0], this.pressed[1]) } : {}),
      ...(this.endOn ? { to: anchorFor(this.endOn, p.wx, p.wy) } : {})
    }
    return routeConnector(c, id => id === this.startOn?.id ? this.startOn : id === this.endOn?.id ? this.endOn : undefined)
  }

  up(): void {
    const d = this.draft
    this.draft = null
    this.startOn = this.endOn = null
    if (d && Math.hypot(d.p[2] - d.p[0], d.p[3] - d.p[1]) * this.host.view.zoom >= 3) {
      this.host.commitAdd(d)
      if ((d.from || d.to) && !toldAttached) {
        toldAttached = true
        showToast('Attached: it follows when the object moves. Select it and drag an end to change that.', 4500)
      }
    }
    this.host.requestOverlay()
  }

  cancel(): void {
    this.draft = null
    this.startOn = this.endOn = null
    this.host.requestOverlay()
  }

  paintOverlay(ctx: CanvasRenderingContext2D): void {
    const d = this.draft
    if (!d) return
    paintAttachHint(ctx, this.host, this.startOn)
    paintAttachHint(ctx, this.host, this.endOn)
    this.host.withWorld(ctx, () => paintItem(ctx, d))
  }
}

/** Text editing itself is a DOM overlay owned by Board, so IME and paste work normally. */
export class TextTool implements Tool {
  readonly allowsRadial = false
  readonly animating = false
  readonly name: string
  private pressed = false
  constructor(private host: ToolHost, private note = false) { this.name = note ? 'sticky' : 'text' }
  cursor(): string { return this.note ? 'crosshair' : 'text' }
  underway(): boolean { return this.pressed }
  down(): void { this.pressed = true }
  move(): void {}
  up(p: Ptr): void {
    if (!this.pressed) return
    this.pressed = false
    this.host.createText(p.wx, p.wy, this.note)
  }
  cancel(): void { this.pressed = false }
}

// ── eraser ────────────────────────────────────────────────────────────────────
export class EraserTool implements Tool {
  readonly name = 'eraser'
  readonly allowsRadial = true
  readonly animating = false
  private before: Item[] | null = null
  private last: [number, number] = [0, 0]
  private at: [number, number] | null = null

  constructor(private host: ToolHost) {}

  cursor(): string {
    return 'none' // the ring is drawn in the overlay, sized to the real eraser
  }
  underway(): boolean {
    return this.before !== null
  }

  /** eraser radius in world units (the eraser keeps a constant on-screen size) */
  private radius(): number {
    return Math.max(S.eraserSize.value, S.palm.value) / 2 / this.host.view.zoom
  }

  down(p: Ptr): void {
    this.before = this.host.doc.snapshot()
    this.last = [p.wx, p.wy]
    this.at = [p.x, p.y]
    this.sweep(p.wx, p.wy, p.wx, p.wy)
    this.host.requestOverlay()
  }

  move(p: Ptr): void {
    if (!this.before) return
    this.sweep(this.last[0], this.last[1], p.wx, p.wy)
    this.last = [p.wx, p.wy]
    this.at = [p.x, p.y]
    this.host.requestOverlay()
  }

  hover(p: Ptr): void {
    this.at = [p.x, p.y]
    this.host.requestOverlay()
  }

  leave(): void {
    this.at = null
    this.host.requestOverlay()
  }

  up(): void {
    const before = this.before
    this.before = null
    if (before) this.host.commit(this.host.doc.diff(before))
    this.host.requestOverlay()
  }

  cancel(): void {
    if (this.before) {
      this.host.doc.replaceAll(this.before)
      this.before = null
      this.host.pruneSelection()
      this.host.refresh(null)
    }
    this.host.requestOverlay()
  }

  /** Erase along the segment, sampling often enough that a fast drag never skips. */
  private sweep(x0: number, y0: number, x1: number, y1: number): void {
    const doc = this.host.doc
    const r = this.radius()
    const box: Rect = [Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r]
    const cands: Item[] = []
    const pixel = S.eraserMode.value === 'pixel' || S.palm.value > 0 // a palm wipes like a real duster
    for (const it of doc.items) {
      if (it.locked || isBox(it) || (pixel && it.t === 'h' && (it.text || (it.fill && it.fill !== 'none')))) continue
      if (rectsHit(itemBounds(it), box)) cands.push(it)
    }
    if (!cands.length) return

    const d = Math.hypot(x1 - x0, y1 - y0)
    const n = d > 0 ? Math.max(1, Math.ceil(d / Math.max(r * 0.6, 0.5))) : 1
    const cur = new Map<Item, Item[]>(cands.map((c) => [c, [c]]))
    let dirty: Rect | null = null

    for (let k = 0; k <= n; k++) {
      const cx = x0 + ((x1 - x0) * k) / n
      const cy = y0 + ((y1 - y0) * k) / n
      const cb: Rect = [cx - r, cy - r, cx + r, cy + r]
      for (const [key, list] of cur) {
        if (!list.length) continue
        let changed = false
        const next: Item[] = []
        for (const it of list) {
          const b = itemBounds(it)
          if (!rectsHit(b, cb) || !hitCircle(it, cx, cy, r)) {
            next.push(it)
            continue
          }
          changed = true
          dirty = unionRect(dirty, b)
          if (pixel) next.push(...splitErase(it, cx, cy, r))
        }
        if (changed) cur.set(key, next)
      }
    }
    if (!dirty) return
    const out: Item[] = []
    for (const it of doc.items) {
      const rep = cur.get(it)
      if (rep) out.push(...rep)
      else out.push(it)
    }
    doc.replaceAll(out)
    this.host.pruneSelection()
    this.host.refresh(dirty)
  }

  paintOverlay(ctx: CanvasRenderingContext2D): void {
    if (!this.at) return
    const rad = S.eraserSize.value / 2
    const pixel = S.eraserMode.value === 'pixel' || S.palm.value > 0 // a palm wipes like a real duster
    const dark = isDarkBg.value
    const edge = dark ? 'rgba(255,255,255,0.85)' : 'rgba(30,34,50,0.8)'
    ctx.save()
    ctx.beginPath()
    ctx.arc(this.at[0], this.at[1], rad, 0, Math.PI * 2)
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.06)'
    ctx.fill()
    ctx.lineWidth = 1.3
    ctx.strokeStyle = edge
    ctx.setLineDash(pixel ? [] : [3, 2.5])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.arc(this.at[0], this.at[1], 1.5, 0, Math.PI * 2)
    ctx.fillStyle = edge
    ctx.fill()
    ctx.restore()
  }
}

// ── select / move ─────────────────────────────────────────────────────────────
/** One arrow or line on its own, free to edit: it gets end handles instead of a box. */
const soloConnector = (sel: Item[]): ShapeItem | null => {
  const it = sel.length === 1 ? sel[0] : null
  return it && isConnector(it) && !it.locked ? it : null
}

export class SelectTool implements Tool {
  readonly allowsRadial = true
  readonly animating = false
  private mode: 'none' | 'move' | 'resize' | 'rotate' | 'marquee' | 'lasso' | 'launch' | 'magnet' | 'end' | 'divider' = 'none'
  /** the line of a selected table being dragged; and a table whose cell this press may turn out to tap */
  private divider: Divider | null = null
  private tappedTable: TableItem | null = null
  /** a selected arrow's end being dragged, and the object it would attach to */
  private end: 0 | 1 = 0
  private endOn: Item | null = null
  /** arrows attached to what is being dragged: they follow on screen, and the edit itself moves them for good */
  private followers: ShapeItem[] = []
  private following: ShapeItem[] = []
  private known = new Map<string, Item>()
  private launch: LabItem | null = null
  private magnetStart = 0
  private magnetOffset = 0
  private magnetTrace: { t: number; x: number }[] = []
  private origin: [number, number] = [0, 0]
  private originScreen: [number, number] = [0, 0]
  private started = false
  private floating: Item[] = []
  private preview: Item[] = []
  private baseSelection: Item[] = []
  private bounds: Rect | null = null
  private handle: SelectionHandle | null = null
  private hoverCursor = 'default'
  private marq: Rect | null = null
  private polygon: [number, number][] = []
  private additive = false

  constructor(private host: ToolHost, readonly name: 'select' | 'lasso' = 'select') {}

  cursor(): string {
    if (this.mode === 'magnet') return 'grabbing'
    if (this.mode === 'move' && this.started) return 'grabbing'
    if (this.mode === 'rotate' && this.started) return 'grabbing'
    if (this.handle) return handleCursor(this.handle)
    return this.hoverCursor
  }
  underway(): boolean {
    return this.mode !== 'none'
  }

  private hitTop(wx: number, wy: number, tol: number): Item | null {
    const items = this.host.doc.items
    const box: Rect = [wx - tol, wy - tol, wx + tol, wy + tol]
    for (let i = items.length - 1; i >= 0; i--) {
      if (rectsHit(itemBounds(items[i]), box) && hitObject(items[i], wx, wy, tol)) return items[i]
    }
    return null
  }

  down(p: Ptr): void {
    this.cancel()
    this.baseSelection = this.host.selection.slice()
    this.origin = [p.wx, p.wy]
    this.originScreen = [p.x, p.y]
    this.additive = p.shift
    const sel = this.host.selection
    const candidate = this.hitTop(p.wx, p.wy, 0)
    if (candidate?.t === 'l' && candidate.model === 'flux-studio' && !candidate.locked && supportedLab(candidate) && !p.shift) {
      const [x, y] = worldToLab(candidate, p.wx, p.wy), state = labState(candidate, this.host.labTime?.(candidate) ?? candidate.frozenTime)
      const center = magnetCenter(state.x)
      if (Math.abs(x - center) <= 66 && Math.abs(y - 270) <= 32) {
        this.host.setSelection([candidate]); this.host.pauseLab?.(candidate)
        this.launch = candidate; this.mode = 'magnet'; this.magnetStart = performance.now(); this.magnetOffset = x - center
        this.magnetTrace = [{ t: 0, x: state.x }]; this.host.requestOverlay(); return
      }
    }
    const lab = sel.length === 1 && sel[0].t === 'l' && sel[0].model === 'projectile' && !sel[0].locked && supportedLab(sel[0]) ? sel[0] : null
    if (lab) {
      const tip = labToWorld(lab, launchHandle(lab).tip)
      if (Math.hypot(p.wx - tip[0], p.wy - tip[1]) * this.host.view.zoom <= (p.type === 'touch' ? 19 : 13)) {
        this.host.pauseLab?.(lab); this.launch = lab; this.mode = 'launch'; this.host.requestOverlay(); return
      }
    }
    const solo = soloConnector(sel)
    if (solo) {
      const reach = (p.type === 'touch' ? 26 : 14) / this.host.view.zoom
      const d0 = Math.hypot(p.wx - solo.p[0], p.wy - solo.p[1]), d1 = Math.hypot(p.wx - solo.p[2], p.wy - solo.p[3])
      if (Math.min(d0, d1) <= reach) { this.end = d0 <= d1 ? 0 : 1; this.mode = 'end'; this.host.requestOverlay(); return }
    }
    const sb = this.host.doc.bounds(sel)
    const grip = sb && !solo && !sel.some(it => it.locked) ? pickSelectionHandle(sb, this.host.view.zoom, p.wx, p.wy, p.type === 'touch') : null
    if (grip) {
      this.handle = grip
      this.bounds = sb
      this.mode = grip === 'rotate' ? 'rotate' : 'resize'
      this.host.requestOverlay()
      return
    }
    const soloTable = sel.length === 1 && sel[0].t === 'b' && !sel[0].locked ? sel[0] : null
    if (soloTable) {
      // A generous grab zone: a finger on the line, not beside it.
      const line = dividerAt(soloTable, p.wx, p.wy, (p.type === 'touch' ? 22 : 7) / this.host.view.zoom)
      if (line) { this.divider = line; this.mode = 'divider'; this.host.requestOverlay(); return }
    }
    const tol = (p.type === 'touch' ? 12 : 7) / this.host.view.zoom
    const hit = this.hitTop(p.wx, p.wy, tol)
    this.tappedTable = soloTable && hit === soloTable && !p.shift ? soloTable : null
    if (hit && p.shift) {
      const group = expandGroups(this.host.doc.items, [hit])
      this.host.setSelection(sel.includes(hit) ? sel.filter(it => !group.includes(it)) : expandGroups(this.host.doc.items, [...sel, hit]))
      return
    }
    if (hit || (this.name === 'select' && insideSelection(sb, p.wx, p.wy))) {
      if (hit && !sel.includes(hit)) this.host.setSelection(expandGroups(this.host.doc.items, [hit]))
      if (this.host.selection.some(it => !it.locked)) this.mode = 'move'
    } else {
      if (!p.shift) this.host.setSelection([])
      this.mode = this.name === 'lasso' ? 'lasso' : 'marquee'
      if (this.mode === 'marquee') this.marq = [p.wx, p.wy, p.wx, p.wy]
      else this.polygon = [[p.wx, p.wy]]
    }
    this.host.requestOverlay()
  }

  move(p: Ptr): void {
    if (this.mode === 'magnet' && this.launch) {
      if (!this.started && Math.hypot(p.x - this.originScreen[0], p.y - this.originScreen[1]) < 3) return
      if (!this.started) { this.started = true; this.floating = [this.launch]; this.host.setExcluded(this.floating); this.host.refresh(itemBounds(this.launch)) }
      const [x] = worldToLab(this.launch, p.wx, p.wy), t = Math.min(29.9, (performance.now() - this.magnetStart) / 1000)
      const last = this.magnetTrace[this.magnetTrace.length - 1]
      if (t > last.t + 0.004) {
        if (this.magnetTrace.length >= 799) this.magnetTrace.pop()
        this.magnetTrace.push({ t, x: magnetPosition(x - this.magnetOffset) })
      }
      this.preview = [{ ...this.launch, params: { ...this.launch.params, motion: 1 }, gesture: this.magnetTrace.map(p => ({ ...p })), frozenTime: this.magnetTrace[this.magnetTrace.length - 1].t }]
      this.host.requestOverlay(); return
    }
    if (this.mode === 'launch' && this.launch) {
      if (!this.started && Math.hypot(p.x - this.originScreen[0], p.y - this.originScreen[1]) < 3) return
      if (!this.started) { this.started = true; this.floating = [this.launch]; this.host.setExcluded(this.floating); this.host.refresh(itemBounds(this.launch)) }
      const lab = this.launch, h = launchHandle(lab), [x, y] = worldToLab(lab, p.wx, p.wy)
      const vx = Math.max(0, (x - h.origin[0]) / h.gain), vy = Math.max(0, (h.origin[1] - y) / h.gain)
      const speed = Math.round(clamp(Math.hypot(vx, vy), 0, 100) * 10) / 10
      let angle = Math.atan2(vy, vx) * 180 / Math.PI
      angle = Math.round(angle / (p.shift ? 5 : 0.1)) * (p.shift ? 5 : 0.1)
      this.preview = [{ ...lab, params: { ...lab.params, speed, angle }, frozenTime: 0 }]
      this.host.requestOverlay(); return
    }
    if (this.mode === 'divider') {
      if (!this.started) {
        if (Math.hypot(p.x - this.originScreen[0], p.y - this.originScreen[1]) < 3) return
        this.started = true
        this.floating = this.host.selection.slice()
        this.host.setExcluded(this.floating)
        this.host.refresh(this.host.doc.bounds(this.floating))
      }
      const d = this.divider!, t = this.floating[0] as TableItem
      const along = rotatePoint(p.wx - this.origin[0], p.wy - this.origin[1], 0, 0, -(t.angle ?? 0))
      this.preview = [this.host.fitItem(moveDivider(t, d, d.axis === 'col' ? along[0] : along[1]))]
      this.host.requestOverlay()
    } else if (this.mode === 'end') {
      if (!this.started) {
        if (Math.hypot(p.x - this.originScreen[0], p.y - this.originScreen[1]) < 3) return
        this.started = true
        this.floating = this.host.selection.slice()
        this.host.setExcluded(this.floating)
        this.host.refresh(this.host.doc.bounds(this.floating))
      }
      const c = this.floating[0] as ShapeItem, other = this.end === 0 ? c.to : c.from
      const hit = attachAt(this.host.doc.items, p.wx, p.wy, attachReach(p, this.host.view.zoom), c.id)
      this.endOn = hit && hit.id !== other?.id ? hit : null
      const { from, to, ...plain } = c
      const anchor = this.endOn ? anchorFor(this.endOn, p.wx, p.wy) : undefined
      const moved: ShapeItem = {
        ...plain, p: this.end === 0 ? [p.wx, p.wy, c.p[2], c.p[3]] : [c.p[0], c.p[1], p.wx, p.wy],
        ...(this.end === 0 ? { ...(anchor ? { from: anchor } : {}), ...(to ? { to } : {}) } : { ...(from ? { from } : {}), ...(anchor ? { to: anchor } : {}) })
      }
      const items = this.host.doc.items
      this.preview = [routeConnector(moved, id => items.find(it => it.id === id))]
      this.host.requestOverlay()
    } else if (this.mode === 'move' || this.mode === 'resize' || this.mode === 'rotate') {
      if (!this.started) {
        if (Math.hypot(p.x - this.originScreen[0], p.y - this.originScreen[1]) < 3) return
        this.started = true
        this.floating = this.host.selection.filter(it => !it.locked)
        for (const it of this.floating) if (it.t === 'l') this.host.pauseLab?.(it)
        this.bounds ??= this.host.doc.bounds(this.floating)
        this.followers = followersOf(this.host.doc.items, this.floating)
        this.known = new Map(this.host.doc.items.map(it => [it.id, it]))
        this.host.setExcluded([...this.floating, ...this.followers])
        this.host.refresh(this.host.doc.bounds([...this.floating, ...this.followers]))
      }
      const [dx, dy] = [p.wx - this.origin[0], p.wy - this.origin[1]]
      if (this.mode === 'move') {
        const tx = p.shift && Math.abs(dy) > Math.abs(dx) ? 0 : dx
        const ty = p.shift && Math.abs(dx) >= Math.abs(dy) ? 0 : dy
        this.preview = this.floating.map(it => translateItem(it, tx, ty))
      } else if (this.bounds && this.mode === 'resize' && this.handle && this.handle !== 'rotate') {
        const uniform = p.shift || this.floating.length > 1 || this.floating.some(it => it.t === 'l' || (it.t !== 's' && !!it.angle))
        const { anchor, sx, sy } = resizeSelection(this.bounds, this.handle, dx, dy, uniform)
        this.preview = this.floating.map(it => this.host.fitItem(transformItem(it, anchor, sx, sy)))
      } else if (this.bounds && this.mode === 'rotate') {
        const center: [number, number] = [(this.bounds[0] + this.bounds[2]) / 2, (this.bounds[1] + this.bounds[3]) / 2]
        let angle = Math.atan2(p.wy - center[1], p.wx - center[0]) - Math.atan2(this.origin[1] - center[1], this.origin[0] - center[0])
        if (p.shift) angle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12)
        this.preview = this.floating.map(it => transformItem(it, center, 1, 1, angle))
      }
      const moving = new Set(this.floating.map(it => it.id))
      this.preview = this.preview.map(it => letGo(it, moving))
      const now = new Map(this.preview.map(it => [it.id, it]))
      this.following = this.followers.map(c => routeConnector(c, id => now.get(id) ?? this.known.get(id)))
      this.host.requestOverlay()
    } else if (this.mode === 'marquee' && this.marq) {
      this.marq = [this.marq[0], this.marq[1], p.wx, p.wy]
      this.host.requestOverlay()
    } else if (this.mode === 'lasso') {
      const last = this.polygon[this.polygon.length - 1]
      if (!last || Math.hypot(p.wx - last[0], p.wy - last[1]) * this.host.view.zoom >= 2) this.polygon.push([p.wx, p.wy])
      this.host.requestOverlay()
    }
  }

  hover(p: Ptr): void {
    const sel = this.host.selection, bounds = this.host.doc.bounds(sel)
    const handle = bounds && !soloConnector(sel) && !sel.some(it => it.locked) ? pickSelectionHandle(bounds, this.host.view.zoom, p.wx, p.wy, p.type === 'touch') : null
    const hit = this.hitTop(p.wx, p.wy, 7 / this.host.view.zoom)
    this.hoverCursor = handle ? handleCursor(handle) : hit ? hit.locked ? 'default' : 'move' : this.name === 'lasso' ? 'crosshair' : 'default'
    if (hit?.t === 'l' && hit.model === 'flux-studio' && !hit.locked && supportedLab(hit)) {
      const [x, y] = worldToLab(hit, p.wx, p.wy), s = labState(hit, this.host.labTime?.(hit) ?? hit.frozenTime)
      if (Math.abs(x - magnetCenter(s.x)) <= 66 && Math.abs(y - 270) <= 32) this.hoverCursor = 'grab'
    }
  }

  leave(): void { this.hoverCursor = this.name === 'lasso' ? 'crosshair' : 'default' }

  up(p: Ptr): void {
    // Include the final pointer position even if the browser coalesced the last move.
    this.move(p)
    if (this.tappedTable && !this.started) this.host.editTableCell?.(this.tappedTable, p.wx, p.wy)
    if (this.mode === 'magnet' && this.started && this.preview[0]?.t === 'l') {
      const it = this.preview[0], [x] = worldToLab(it, p.wx, p.wy), finalX = magnetPosition(x - this.magnetOffset)
      let last = this.magnetTrace[this.magnetTrace.length - 1]
      // A coalesced pointer-up must retain its final position even inside the
      // sampling interval. Bound the trace before adding the stationary tail.
      if (Math.abs(last.x - finalX) > 1e-9) {
        if (this.magnetTrace.length >= 799) this.magnetTrace.pop()
        last = { t: Math.max(last.t + 0.005, Math.min(29.95, (performance.now() - this.magnetStart) / 1000)), x: finalX }
        this.magnetTrace.push(last)
      }
      it.gesture = [...this.magnetTrace, { t: last.t + 0.05, x: last.x }]; it.frozenTime = last.t + 0.05
    }
    const host = this.host
    if (this.started && this.floating.length && this.preview.length) {
      const moving = this.floating
      const others = [...this.followers, ...this.following]
      host.setExcluded([])
      const changed = moving.some((it, i) => {
        const next = this.preview[i]
        return (it.t === 'b' && next.t === 'b' && (it.cols !== next.cols || it.rows !== next.rows)) || (it.t === 'h' && next.t === 'h' && (it.from?.id !== next.from?.id || it.to?.id !== next.to?.id)) || it.w !== next.w || it.p.some((v, j) => Math.abs(v - next.p[j]) > 1e-6) || (it.t !== 's' && next.t !== 's' && (it.angle ?? 0) !== (next.angle ?? 0)) || (it.t === 'l' && next.t === 'l' && (JSON.stringify(it.params) !== JSON.stringify(next.params) || JSON.stringify(it.gesture) !== JSON.stringify(next.gesture) || it.frozenTime !== next.frozenTime))
      })
      if (changed) {
        const before = host.doc.snapshot()
        const oldBounds = host.doc.bounds(moving)
        const map = new Map<Item, Item>(moving.map((it, i) => [it, this.preview[i]]))
        host.doc.replaceAll(host.doc.items.map((it) => map.get(it) ?? it))
        const moved = host.selection.map(it => map.get(it) ?? it)
        host.commit(host.doc.diff(before))
        host.setSelection(moved)
        host.refresh(unionRect(oldBounds, host.doc.bounds(moved)))
      } else {
        host.refresh(host.doc.bounds([...moving, ...others]))
      }
    } else if (this.mode === 'marquee' && this.marq) {
      const [a, b, c, d] = this.marq
      const box: Rect = [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)]
      const hit = Math.hypot(c - a, d - b) * host.view.zoom < 3 ? [] : host.doc.items.filter((it) => !concealed(it) && rectsHit(itemBounds(it), box))
      host.setSelection(expandGroups(host.doc.items, this.additive ? [...this.baseSelection, ...hit] : hit))
    } else if (this.mode === 'lasso') {
      const hit = host.doc.items.filter(it => itemInLasso(it, this.polygon))
      host.setSelection(expandGroups(host.doc.items, this.additive ? [...this.baseSelection, ...hit] : hit))
    }
    this.reset()
    host.requestOverlay()
  }

  cancel(): void {
    if (this.started) {
      this.host.setExcluded([])
      this.host.refresh(unionRect(this.host.doc.bounds([...this.floating, ...this.followers]), this.host.doc.bounds([...this.preview, ...this.following])))
    }
    if (this.mode !== 'none') this.host.setSelection(this.baseSelection.filter(it => this.host.doc.items.includes(it)))
    this.reset()
    this.host.requestOverlay()
  }

  private reset(): void {
    this.mode = 'none'
    this.started = false
    this.marq = null
    this.polygon = []
    this.handle = null
    this.bounds = null
    this.floating = []
    this.preview = []
    this.launch = null
    this.magnetTrace = []
    this.divider = null
    this.tappedTable = null
    this.endOn = null
    this.followers = []
    this.following = []
    this.known = new Map()
  }

  paintOverlay(ctx: CanvasRenderingContext2D): void {
    const host = this.host
    const z = host.view.zoom
    if (this.mode === 'end') paintAttachHint(ctx, host, this.endOn)
    if (this.preview.length) {
      host.withWorld(ctx, () => {
        for (const it of this.following) paintItem(ctx, it)
        for (const it of this.preview) {
          const original = this.floating.find(x => x.id === it.id)
          const time = this.mode === 'launch' ? 0 : this.mode === 'magnet' && it.t === 'l' ? it.frozenTime : original?.t === 'l' ? this.host.labTime?.(original) : undefined
          paintItem(ctx, it, 1, time)
        }
      })
    }
    const sel = host.selection
    const shownLab = this.preview.find((it): it is LabItem => it.t === 'l') ?? (sel.length === 1 && sel[0].t === 'l' ? sel[0] : null)
    if (shownLab && shownLab.model === 'projectile' && !shownLab.locked && supportedLab(shownLab)) {
      const [wx, wy] = labToWorld(shownLab, launchHandle(shownLab).tip), x = (wx - host.view.x) * z, y = (wy - host.view.y) * z
      ctx.save(); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#007c88'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.stroke(); ctx.restore()
    }
    const solo = soloConnector(sel)
    if (solo) {
      // An arrow is held by its two ends: filled where attached, hollow where free.
      const c = (this.preview[0] as ShapeItem | undefined) ?? solo
      ctx.save()
      ctx.strokeStyle = '#4262ff'
      ctx.lineWidth = 2
      for (const [x, y, held] of [[c.p[0], c.p[1], !!c.from], [c.p[2], c.p[3], !!c.to]] as [number, number, boolean][]) {
        ctx.fillStyle = held ? '#4262ff' : '#ffffff'
        ctx.beginPath(); ctx.arc((x - host.view.x) * z, (y - host.view.y) * z, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      }
      ctx.restore()
    } else if (sel.length) {
      const map = new Map(this.floating.map((it, i) => [it, this.preview[i]]))
      const b = host.doc.bounds(sel.map(it => map.get(it) ?? it))
      if (b) {
        const x = (b[0] - host.view.x) * z, y = (b[1] - host.view.y) * z
        const w = (b[2] - b[0]) * z, h = (b[3] - b[1]) * z
        const locked = sel.some(it => it.locked)
        ctx.save()
        ctx.strokeStyle = locked ? '#8591a7' : '#4262ff'
        ctx.lineWidth = 1.3
        ctx.setLineDash(locked ? [4, 3] : [])
        ctx.strokeRect(x, y, w, h)
        ctx.setLineDash([])
        if (!locked) {
          const handles = selectionHandles(b, z)
          const sx = (wx: number): number => (wx - host.view.x) * z
          const sy = (wy: number): number => (wy - host.view.y) * z
          ctx.beginPath(); ctx.moveTo(sx(handles.n[0]), sy(handles.n[1])); ctx.lineTo(sx(handles.rotate[0]), sy(handles.rotate[1])); ctx.stroke()
          ctx.fillStyle = '#ffffff'
          for (const handle of HANDLE_ORDER) {
            const [hx, hy] = handles[handle]
            ctx.beginPath(); ctx.rect(sx(hx) - 3.5, sy(hy) - 3.5, 7, 7); ctx.fill(); ctx.stroke()
          }
          ctx.beginPath(); ctx.arc(sx(handles.rotate[0]), sy(handles.rotate[1]), 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
        }
        ctx.restore()
      }
    }
    if (this.marq) {
      const [a, b, c, d] = this.marq
      const x0 = (Math.min(a, c) - host.view.x) * z
      const y0 = (Math.min(b, d) - host.view.y) * z
      ctx.save()
      ctx.fillStyle = 'rgba(66,98,255,0.10)'
      ctx.strokeStyle = '#4262ff'
      ctx.lineWidth = 1
      ctx.fillRect(x0, y0, Math.abs(c - a) * z, Math.abs(d - b) * z)
      ctx.strokeRect(x0 + 0.5, y0 + 0.5, Math.abs(c - a) * z, Math.abs(d - b) * z)
      ctx.restore()
    }
    if (this.polygon.length) {
      ctx.save()
      ctx.fillStyle = 'rgba(66,98,255,0.08)'
      ctx.strokeStyle = '#4262ff'
      ctx.lineWidth = 1.3
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      this.polygon.forEach(([x, y], i) => i ? ctx.lineTo((x - host.view.x) * z, (y - host.view.y) * z) : ctx.moveTo((x - host.view.x) * z, (y - host.view.y) * z))
      ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore()
    }
  }
}

// ── hand ──────────────────────────────────────────────────────────────────────
export class HandTool implements Tool {
  readonly name = 'hand'
  readonly allowsRadial = true
  readonly animating = false
  private last: [number, number] | null = null
  constructor(private host: ToolHost) {}
  cursor(): string {
    return this.last ? 'grabbing' : 'grab'
  }
  underway(): boolean {
    return this.last !== null
  }
  down(p: Ptr): void {
    this.last = [p.x, p.y]
  }
  move(p: Ptr): void {
    if (!this.last) return
    this.host.panBy(p.x - this.last[0], p.y - this.last[1])
    this.last = [p.x, p.y]
  }
  up(): void {
    this.last = null
  }
  cancel(): void {
    this.last = null
  }
}

export { LaserTool } from './laser'
