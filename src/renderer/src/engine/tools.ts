import { clamp, rectsHit, unionRect } from './geometry'
import { hitCircle, hitObject, itemBounds, paintItem, splitErase, translateItem } from './items'
import { expandGroups, transformItem } from './transforms'
import { handleCursor, HANDLE_ORDER, insideSelection, itemInLasso, pickSelectionHandle, resizeSelection, selectionHandles } from './selection'
import type { SelectionHandle } from './selection'
import { Smoother, smoothingToCutoff } from './smoother'
import { newId } from './types'
import type { Item, Rect, ShapeItem, ShapeKind, StrokeItem } from './types'
import type { Ptr, Tool, ToolHost } from './tool-types'
import { S, isDarkBg } from '@/state/store'

// ── cursors ───────────────────────────────────────────────────────────────────
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
  private lastS: [number, number] = [0, 0]
  private pointTimes: number[] = []
  private strokeStart = 0

  constructor(
    private host: ToolHost,
    private marker: boolean,
    readonly name: string
  ) {}

  cursor(): string {
    const size = this.marker ? S.markerSize.value : S.penSize.value
    const color = this.marker ? S.markerColor.value : S.penColor.value
    return brushCursor(size * this.host.view.zoom, color, this.marker)
  }

  underway(): boolean {
    return this.pts.length > 24
  }

  down(p: Ptr): void {
    const variable = !this.marker && S.pressure.value && p.type === 'pen'
    this.live = {
      t: 's',
      id: newId(),
      c: this.marker ? S.markerColor.value : S.penColor.value,
      w: this.marker ? S.markerSize.value : S.penSize.value,
      m: this.marker,
      v: variable
    }
    this.pressure = variable ? clamp(p.pressure, 0.05, 1) : 0.5
    this.smoother.reset()
    this.smoother.feed(p.x, p.y, p.t, smoothingToCutoff(S.smoothing.value))
    this.pts = [p.wx, p.wy, this.pressure]
    this.strokeStart = p.t
    this.pointTimes = [0]
    this.lastS = [p.x, p.y]
    this.host.requestOverlay()
  }

  move(p: Ptr): void {
    if (!this.live) return
    let sx = p.x
    let sy = p.y
    if (S.smoothing.value > 0) [sx, sy] = this.smoother.feed(p.x, p.y, p.t, smoothingToCutoff(S.smoothing.value))
    if (this.live.v) this.pressure = this.pressure * 0.55 + clamp(p.pressure, 0.02, 1) * 0.45
    if (Math.hypot(sx - this.lastS[0], sy - this.lastS[1]) < 0.6) return
    const [wx, wy] = this.host.toWorld(sx, sy)
    this.pts.push(wx, wy, this.pressure)
    this.pointTimes.push(Math.max(this.pointTimes.at(-1) ?? 0, (p.t - this.strokeStart) * 1000))
    this.lastS = [sx, sy]
    this.host.requestOverlay()
  }

  up(p: Ptr): void {
    if (!this.live) return
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
    this.live = null
    this.pts = []
    this.pointTimes = []
    this.host.requestOverlay()
  }

  paintOverlay(ctx: CanvasRenderingContext2D): void {
    if (!this.live) return
    const item: StrokeItem = { ...this.live, p: this.pts }
    this.host.withWorld(ctx, () => paintItem(ctx, item))
  }
}

// ── shapes ────────────────────────────────────────────────────────────────────
export class ShapeTool implements Tool {
  readonly allowsRadial = true
  readonly animating = false
  readonly name: string
  private draft: ShapeItem | null = null

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
    this.host.requestOverlay()
  }

  move(p: Ptr): void {
    const d = this.draft
    if (!d) return
    const [x0, y0] = d.p
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
    this.draft = { ...d, p: [x0, y0, x, y] }
    this.host.requestOverlay()
  }

  up(): void {
    const d = this.draft
    this.draft = null
    if (d && Math.hypot(d.p[2] - d.p[0], d.p[3] - d.p[1]) * this.host.view.zoom >= 3) this.host.commitAdd(d)
    this.host.requestOverlay()
  }

  cancel(): void {
    this.draft = null
    this.host.requestOverlay()
  }

  paintOverlay(ctx: CanvasRenderingContext2D): void {
    const d = this.draft
    if (d) this.host.withWorld(ctx, () => paintItem(ctx, d))
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
    return S.eraserSize.value / 2 / this.host.view.zoom
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
    const pixel = S.eraserMode.value === 'pixel'
    for (const it of doc.items) {
      if (it.locked || it.t === 't' || (pixel && it.t === 'h' && (it.text || (it.fill && it.fill !== 'none')))) continue
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
    const pixel = S.eraserMode.value === 'pixel'
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
export class SelectTool implements Tool {
  readonly allowsRadial = true
  readonly animating = false
  private mode: 'none' | 'move' | 'resize' | 'rotate' | 'marquee' | 'lasso' = 'none'
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
    const sb = this.host.doc.bounds(sel)
    const grip = sb && !sel.some(it => it.locked) ? pickSelectionHandle(sb, this.host.view.zoom, p.wx, p.wy, p.type === 'touch') : null
    if (grip) {
      this.handle = grip
      this.bounds = sb
      this.mode = grip === 'rotate' ? 'rotate' : 'resize'
      this.host.requestOverlay()
      return
    }
    const tol = (p.type === 'touch' ? 12 : 7) / this.host.view.zoom
    const hit = this.hitTop(p.wx, p.wy, tol)
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
    if (this.mode === 'move' || this.mode === 'resize' || this.mode === 'rotate') {
      if (!this.started) {
        if (Math.hypot(p.x - this.originScreen[0], p.y - this.originScreen[1]) < 3) return
        this.started = true
        this.floating = this.host.selection.filter(it => !it.locked)
        this.bounds ??= this.host.doc.bounds(this.floating)
        this.host.setExcluded(this.floating)
        this.host.refresh(this.host.doc.bounds(this.floating))
      }
      const [dx, dy] = [p.wx - this.origin[0], p.wy - this.origin[1]]
      if (this.mode === 'move') {
        const tx = p.shift && Math.abs(dy) > Math.abs(dx) ? 0 : dx
        const ty = p.shift && Math.abs(dx) >= Math.abs(dy) ? 0 : dy
        this.preview = this.floating.map(it => translateItem(it, tx, ty))
      } else if (this.bounds && this.mode === 'resize' && this.handle && this.handle !== 'rotate') {
        const uniform = p.shift || this.floating.length > 1 || this.floating.some(it => it.t !== 's' && !!it.angle)
        const { anchor, sx, sy } = resizeSelection(this.bounds, this.handle, dx, dy, uniform)
        this.preview = this.floating.map(it => this.host.fitItem(transformItem(it, anchor, sx, sy)))
      } else if (this.bounds && this.mode === 'rotate') {
        const center: [number, number] = [(this.bounds[0] + this.bounds[2]) / 2, (this.bounds[1] + this.bounds[3]) / 2]
        let angle = Math.atan2(p.wy - center[1], p.wx - center[0]) - Math.atan2(this.origin[1] - center[1], this.origin[0] - center[0])
        if (p.shift) angle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12)
        this.preview = this.floating.map(it => transformItem(it, center, 1, 1, angle))
      }
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
    const handle = bounds && !sel.some(it => it.locked) ? pickSelectionHandle(bounds, this.host.view.zoom, p.wx, p.wy, p.type === 'touch') : null
    const hit = this.hitTop(p.wx, p.wy, 7 / this.host.view.zoom)
    this.hoverCursor = handle ? handleCursor(handle) : hit ? hit.locked ? 'default' : 'move' : this.name === 'lasso' ? 'crosshair' : 'default'
  }

  leave(): void { this.hoverCursor = this.name === 'lasso' ? 'crosshair' : 'default' }

  up(p: Ptr): void {
    // Include the final pointer position even if the browser coalesced the last move.
    this.move(p)
    const host = this.host
    if (this.started && this.floating.length && this.preview.length) {
      const moving = this.floating
      host.setExcluded([])
      const changed = moving.some((it, i) => {
        const next = this.preview[i]
        return it.w !== next.w || it.p.some((v, j) => Math.abs(v - next.p[j]) > 1e-6) || (it.t !== 's' && next.t !== 's' && (it.angle ?? 0) !== (next.angle ?? 0))
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
        host.refresh(host.doc.bounds(moving))
      }
    } else if (this.mode === 'marquee' && this.marq) {
      const [a, b, c, d] = this.marq
      const box: Rect = [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)]
      const hit = Math.hypot(c - a, d - b) * host.view.zoom < 3 ? [] : host.doc.items.filter((it) => rectsHit(itemBounds(it), box))
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
      this.host.refresh(unionRect(this.host.doc.bounds(this.floating), this.host.doc.bounds(this.preview)))
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
  }

  paintOverlay(ctx: CanvasRenderingContext2D): void {
    const host = this.host
    const z = host.view.zoom
    if (this.preview.length) {
      host.withWorld(ctx, () => {
        for (const it of this.preview) paintItem(ctx, it)
      })
    }
    const sel = host.selection
    if (sel.length) {
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
