import { getModel, labDuration, EXPLORE_REVEAL } from './science/models'
import { isShowcase } from './science/showcase-models'
import { effect } from '@preact/signals'
import { Doc, History, opBounds, restyleItems } from './doc'
import type { EditOp } from './doc'
import { clamp, inflate, lerp, rectsHit, unionRect } from './geometry'
import { cloneItem, itemBounds, paintItem, hitObject, translateItem } from './items'
import { fitTextHeight, textAlign, textColor } from './text'
import { transformItem } from './transforms'
import { parseBoard, serializeBoard, MAX_TEXT_LENGTH, itemFromJson } from './serialize'
import type { ParsedBoard } from './serialize'
import { EraserTool, HandTool, LaserTool, PenTool, SelectTool, ShapeTool, TextTool } from './tools'
import type { Tool, ToolHost } from './tool-types'
import { newId } from './types'
import type { Item, Rect, View, EditableItem, TextItem, TextStyle, ShapeItem, LabItem } from './types'
import { MAX_ZOOM, MIN_ZOOM, fitRect, panBy as panView, toWorld, zoomAboutCentre, zoomAt } from './view'
import { S, SHAPE_TOOLS, activeTool, isDarkBg, showToast } from '@/state/store'
import type { ToolName } from '@/state/store'
import type { InkTiming } from './replay'
import { paintGrid } from './grid'
import { LabRuntime, supportedLab } from './science/runtime'
import { activeLabId, scienceInspector } from '@/state/science'

/**
 * Owns the document, the viewport canvases and the render loop.
 *
 *   background   – crisp camera-driven grid, independent of cached ink
 *   board canvas – committed items (redrawn only when something changed)
 *   live  canvas – whatever is being drawn right now, selection, cursors
 */
export class Board implements ToolHost {
  readonly doc = new Doc()
  readonly history = new History(this.doc)
  readonly labs = new LabRuntime()
  private labDraft = new Map<string, LabItem>()
  view: View = { x: -80, y: -80, zoom: 1 }
  selection: Item[] = []

  /** called after every committed document change (autosave hook) */
  onChange: (() => void) | null = null
  onViewChange: (() => void) | null = null
  onEdit: ((label: string, timing?: InkTiming) => void) | null = null

  private stage!: HTMLElement
  private boardCv!: HTMLCanvasElement
  private liveCv!: HTMLCanvasElement
  private gridCv!: HTMLCanvasElement
  private gctx!: CanvasRenderingContext2D
  private gridKey = ''
  private bctx!: CanvasRenderingContext2D
  private lctx!: CanvasRenderingContext2D
  private w = 0
  private h = 0
  private dpr = 1

  private excluded = new Set<Item>()
  private dirtyAll = true
  private dirtyRegion: Rect | null = null
  private dirtyBlit = true
  private dirtyLive = true

  /**
   * Committed items are rendered into an offscreen cache that is larger than the
   * viewport.  Panning just blits it at an offset; it is rebuilt only when the
   * viewport leaves it, and zooming shows a scaled preview until it settles.
   */
  private cache = document.createElement('canvas')
  private cctx = this.cache.getContext('2d')!
  /** the view the cache was rendered at */
  private cv0: View | null = null
  private cw = 0
  private ch = 0
  private rebuildMs = 0
  private zoomTimer = 0
  private raf = 0
  private anim: { raf: number } | null = null

  readonly tools: Record<string, Tool>

  constructor() {
    const t: Record<string, Tool> = {
      pen: new PenTool(this, false, 'pen'),
      marker: new PenTool(this, true, 'marker'),
      eraser: new EraserTool(this),
      select: new SelectTool(this),
      lasso: new SelectTool(this, 'lasso'),
      text: new TextTool(this, false),
      sticky: new TextTool(this, true),
      hand: new HandTool(this),
      laser: new LaserTool(this)
    }
    for (const k of SHAPE_TOOLS) t[k] = new ShapeTool(this, k)
    this.tools = t
  }

  // ── mounting ────────────────────────────────────────────────────────────────
  mount(stage: HTMLElement, board: HTMLCanvasElement, live: HTMLCanvasElement, grid: HTMLCanvasElement): () => void {
    this.stage = stage
    this.boardCv = board
    this.liveCv = live
    this.gridCv = grid
    this.gctx = grid.getContext('2d', { alpha: true })!
    this.bctx = board.getContext('2d', { alpha: true })!
    // NOTE: deliberately NOT `desynchronized`: that path uses a hardware overlay which screen-capture
    // APIs (Zoom, Teams, OBS, Windows capture) cannot see, so the board would appear black when shared.
    this.lctx = live.getContext('2d', { alpha: true })!

    const ro = new ResizeObserver(() => this.resize())
    ro.observe(stage)
    this.resize()

    // A move between displays can change DPR without changing the CSS size.
    // Re-arm the query after each change so every canvas gets a fresh backing
    // bitmap even when ResizeObserver has no geometry change to report.
    let resolution: MediaQueryList
    const watchResolution = (): void => {
      resolution?.removeEventListener('change', onResolution)
      resolution = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`)
      resolution.addEventListener('change', onResolution)
    }
    const onResolution = (): void => { this.resize(); watchResolution() }
    watchResolution()

    const stop = effect(() => {
      // re-evaluate cursor and repaint whenever style or tool changes
      activeTool.value
      S.penSize.value; S.penColor.value; S.markerSize.value; S.markerColor.value
      S.eraserSize.value; S.eraserMode.value; S.zoom.value
      this.syncCursor()
      this.requestOverlay()
    })
    const stopGrid = effect(() => {
      S.grid.value
      isDarkBg.value
      this.dirtyBlit = true
      this.schedule()
    })
    return () => {
      ro.disconnect()
      resolution.removeEventListener('change', onResolution)
      stop()
      stopGrid()
      cancelAnimationFrame(this.raf)
      this.labs.clear()
      if (this.anim) cancelAnimationFrame(this.anim.raf)
      window.clearTimeout(this.zoomTimer)
    }
  }

  private resize(): void {
    const r = this.stage.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    if (Math.abs(r.width - this.w) < 0.5 && Math.abs(r.height - this.h) < 0.5 && dpr === this.dpr) return
    this.w = r.width
    this.h = r.height
    this.dpr = dpr
    for (const cv of [this.gridCv, this.boardCv, this.liveCv]) {
      cv.width = Math.max(1, Math.round(this.w * dpr))
      cv.height = Math.max(1, Math.round(this.h * dpr))
      cv.style.width = this.w + 'px'
      cv.style.height = this.h + 'px'
    }
    this.cv0 = null
    this.gridKey = ''
    S.viewRevision.value++
    this.refresh(null)
    this.requestOverlay()
  }

  get size(): { w: number; h: number } {
    return { w: this.w, h: this.h }
  }

  // ── tools ───────────────────────────────────────────────────────────────────
  currentTool(): Tool {
    return this.tools[activeTool.value] ?? this.tools.pen
  }

  syncCursor(): void {
    if (this.stage) this.stage.style.cursor = this.currentTool().cursor()
  }

  setTool(t: ToolName): void {
    if (S.editing.value) this.commitText()
    const prev = S.tool.value
    if (prev !== t) this.currentTool().cancel()
    S.tool.value = t
    if (t !== 'select' && t !== 'lasso' && this.selection.length) this.setSelection([])
    if (SHAPE_TOOLS.includes(t as never)) S.lastShape.value = t as never
    if (prev !== t) this.requestOverlay()
  }

  // ── ToolHost ────────────────────────────────────────────────────────────────
  toWorld(sx: number, sy: number): [number, number] {
    return toWorld(this.view, sx, sy)
  }

  withWorld(ctx: CanvasRenderingContext2D, fn: () => void): void {
    ctx.save()
    ctx.translate(-this.view.x * this.view.zoom, -this.view.y * this.view.zoom)
    ctx.scale(this.view.zoom, this.view.zoom)
    fn()
    ctx.restore()
  }

  setSelection(items: Item[]): void {
    if (items.length === 1 && items[0].t === 'l') { activeLabId.value = items[0].id; scienceInspector.value = true }
    this.selection = items
    S.selection.value = items
    S.selectionCount.value = items.length
    S.selectionColor.value = items.length && items.every((it) => it.c === items[0].c) ? items[0].c : null
    S.selectionWidth.value = items.length && items.every((it) => it.w === items[0].w) ? items[0].w : null
    this.requestOverlay()
  }

  pruneSelection(): void {
    if (!this.selection.length) return
    const have = new Set(this.doc.items)
    const next = this.selection.filter((it) => have.has(it))
    if (next.length !== this.selection.length) this.setSelection(next)
  }

  setExcluded(items: Iterable<Item>): void {
    this.excluded = new Set(items)
    S.gestureActive.value = this.excluded.size > 0 && !S.editing.value
  }

  panBy(dsx: number, dsy: number): void {
    this.setView(panView(this.view, dsx, dsy))
  }

  commit(op: EditOp | null, label = 'Edit objects'): void {
    if (!op) return
    this.history.push(op)
    this.afterEdit(label)
  }

  commitAdd(it: Item, timing?: InkTiming): void {
    const op = this.doc.push(it)
    this.history.push(op)
    // paint straight onto the cache instead of redrawing everything
    const cv0 = this.cv0
    if (cv0 && !this.dirtyAll && !this.dirtyRegion && this.view.zoom === cv0.zoom) {
      const ctx = this.cctx
      const z = cv0.zoom * this.dpr
      ctx.save()
      ctx.setTransform(z, 0, 0, z, -cv0.x * z, -cv0.y * z)
      paintItem(ctx, it)
      ctx.restore()
      this.dirtyBlit = true
      this.schedule()
    } else {
      this.refresh(itemBounds(it))
    }
    this.afterEdit(it.t === 's' ? (it.m ? 'Draw highlighter' : 'Draw pen stroke') : 'Draw shape', timing)
  }

  private afterEdit(label = 'Edit objects', timing?: InkTiming): void {
    const drafts = [...this.labDraft.values()]
    this.labDraft.clear()
    for (const it of drafts) this.refresh(itemBounds(it))
    S.canUndo.value = this.history.canUndo
    S.canRedo.value = this.history.canRedo
    this.onChange?.()
    this.onEdit?.(label, timing)
    this.requestOverlay()
  }

  // ── view ────────────────────────────────────────────────────────────────────
  setView(v: View): void {
    const changed = v.x !== this.view.x || v.y !== this.view.y || v.zoom !== this.view.zoom
    this.view = v
    S.zoom.value = v.zoom
    S.viewRevision.value++
    this.dirtyBlit = true
    this.schedule()
    this.requestOverlay()
    if (changed) this.onViewChange?.()
  }

  zoomAt(factor: number, sx: number, sy: number): void {
    this.setView(zoomAt(this.view, factor, sx, sy))
  }

  animateTo(target: View, ms = 240): void {
    if (this.anim) cancelAnimationFrame(this.anim.raf)
    const from = this.view
    const c0 = [from.x + this.w / 2 / from.zoom, from.y + this.h / 2 / from.zoom]
    const c1 = [target.x + this.w / 2 / target.zoom, target.y + this.h / 2 / target.zoom]
    const t0 = performance.now()
    const state = { raf: 0 }
    this.anim = state
    const step = (now: number): void => {
      const k = clamp((now - t0) / ms, 0, 1)
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
      const z = Math.exp(lerp(Math.log(from.zoom), Math.log(target.zoom), e))
      const cx = lerp(c0[0], c1[0], e)
      const cy = lerp(c0[1], c1[1], e)
      this.setView({ x: cx - this.w / 2 / z, y: cy - this.h / 2 / z, zoom: z })
      if (k < 1) state.raf = requestAnimationFrame(step)
      else this.anim = null
    }
    state.raf = requestAnimationFrame(step)
  }

  zoomStep(factor: number): void {
    this.animateTo(zoomAboutCentre(this.view, clamp(this.view.zoom * factor, MIN_ZOOM, MAX_ZOOM), this.w, this.h))
  }

  resetZoom(): void {
    this.animateTo(zoomAboutCentre(this.view, 1, this.w, this.h))
  }

  fitContent(): void {
    const b = this.doc.bounds()
    if (!b) return this.resetZoom()
    this.animateTo(fitRect(b, this.w, this.h, 90))
  }

  fitSelection(): void {
    const b = this.doc.bounds(this.selection)
    if (b) this.animateTo(fitRect(b, this.w, this.h, 100))
  }

  // ── rendering ───────────────────────────────────────────────────────────────
  /** Invalidate committed content: everything (null) or one world-space region. */
  refresh(region: Rect | null): void {
    if (region === null) {
      this.dirtyAll = true
      this.dirtyRegion = null
    } else if (!this.dirtyAll) {
      this.dirtyRegion = unionRect(this.dirtyRegion, region)
    }
    this.dirtyBlit = true
    this.schedule()
  }

  requestOverlay(): void {
    this.dirtyLive = true
    this.schedule()
  }

  private schedule(): void {
    if (!this.raf) this.raf = requestAnimationFrame(() => this.frame())
  }

  private frame(): void {
    this.raf = 0
    if (!this.boardCv) return
    const labs = this.doc.items.filter((it): it is LabItem => it.t === 'l')
    const visible: Rect = [this.view.x, this.view.y, this.view.x + this.w / this.view.zoom, this.view.y + this.h / this.view.zoom]
    for (const it of labs) if (this.labs.playing(it) && (S.replaying.value || S.passthrough.value || !rectsHit(itemBounds(it), visible))) this.labs.pause(it)
    const changed = this.labs.tick(labs)
    for (const it of changed) this.refresh(itemBounds(it))
    if (this.dirtyBlit || this.dirtyAll || this.dirtyRegion) this.renderCommitted()
    const tool = this.currentTool()
    const animating = tool.animating || this.tools.laser.animating
    if (this.dirtyLive || animating) this.renderLive()
    this.dirtyLive = false
    if (animating || labs.some(it => this.labs.playing(it))) this.schedule()
  }

  /** Bring the cache up to date, then blit it to the visible canvas. */
  private renderCommitted(): void {
    const z = this.view.zoom
    let preview = false
    let rebuild = this.dirtyAll || !this.cv0
    if (!rebuild && this.cv0 && z !== this.cv0.zoom) {
      if (this.rebuildMs < 10) rebuild = true // cheap enough to stay crisp while zooming
      else {
        preview = true
        window.clearTimeout(this.zoomTimer)
        this.zoomTimer = window.setTimeout(() => {
          this.dirtyAll = true
          this.dirtyBlit = true
          this.schedule()
        }, 90)
      }
    } else if (!rebuild && !this.viewportInCache()) {
      rebuild = true
    }
    if (rebuild) {
      this.rebuildCache()
      this.dirtyAll = false
      this.dirtyRegion = null
    } else if (this.dirtyRegion && !preview) {
      this.paintRegion(this.dirtyRegion)
      this.dirtyRegion = null
    }
    this.dirtyBlit = false
    this.blit(preview)
  }

  private viewportInCache(): boolean {
    const c = this.cv0!
    const z = this.view.zoom
    const e = 1e-6
    return (
      this.view.x >= c.x - e &&
      this.view.y >= c.y - e &&
      this.view.x + this.w / z <= c.x + this.cw / z + e &&
      this.view.y + this.h / z <= c.y + this.ch / z + e
    )
  }

  private rebuildCache(): void {
    const t0 = performance.now()
    const { dpr, view } = this
    // margin around the viewport, bounded by a pixel budget (big 4K screens)
    const base = this.w * dpr * this.h * dpr
    const f = clamp((Math.sqrt(40e6 / Math.max(base, 1)) - 1) / 2, 0, 0.5)
    const mx = this.w * f
    const my = this.h * f
    const pw = Math.max(1, Math.round((this.w + 2 * mx) * dpr))
    const ph = Math.max(1, Math.round((this.h + 2 * my) * dpr))
    if (this.cache.width !== pw || this.cache.height !== ph) {
      this.cache.width = pw
      this.cache.height = ph
    }
    this.cw = pw / dpr
    this.ch = ph / dpr
    this.cv0 = { x: view.x - mx / view.zoom, y: view.y - my / view.zoom, zoom: view.zoom }
    this.paintCache(null)
    this.rebuildMs = performance.now() - t0
  }

  private paintRegion(region: Rect): void {
    const c = this.cv0!
    const { dpr } = this
    const z = c.zoom
    const pad = 3
    const x0 = Math.max(0, Math.floor((region[0] - c.x) * z * dpr) - pad)
    const y0 = Math.max(0, Math.floor((region[1] - c.y) * z * dpr) - pad)
    const x1 = Math.min(this.cache.width, Math.ceil((region[2] - c.x) * z * dpr) + pad)
    const y1 = Math.min(this.cache.height, Math.ceil((region[3] - c.y) * z * dpr) + pad)
    if (x1 > x0 && y1 > y0) this.paintCache([x0, y0, x1, y1])
  }

  /** Draw items into the cache, optionally limited to a device-pixel rectangle. */
  private paintCache(clip: [number, number, number, number] | null): void {
    const ctx = this.cctx
    const c = this.cv0!
    const { dpr } = this
    const z = c.zoom
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    let vis: Rect
    if (clip) {
      ctx.beginPath()
      ctx.rect(clip[0], clip[1], clip[2] - clip[0], clip[3] - clip[1])
      ctx.clip()
      ctx.clearRect(clip[0], clip[1], clip[2] - clip[0], clip[3] - clip[1])
      vis = [c.x + clip[0] / dpr / z, c.y + clip[1] / dpr / z, c.x + clip[2] / dpr / z, c.y + clip[3] / dpr / z]
    } else {
      ctx.clearRect(0, 0, this.cache.width, this.cache.height)
      vis = [c.x, c.y, c.x + this.cw / z, c.y + this.ch / z]
    }
    ctx.setTransform(z * dpr, 0, 0, z * dpr, -c.x * z * dpr, -c.y * z * dpr)
    const cull = inflate(vis, 2)
    const tiny = 0.6 / z // skip things smaller than ~half a pixel
    for (const it of this.doc.items) {
      if (this.excluded.has(it)) continue
      const b = itemBounds(it)
      if (!rectsHit(b, cull)) continue
      if (b[2] - b[0] < tiny && b[3] - b[1] < tiny) continue
      const draft = this.labDraft.get(it.id)
      paintItem(ctx, draft ?? it, 1, it.t === 'l' ? draft ? draft.frozenTime : this.labs.time(it) : undefined)
    }
    ctx.restore()
  }

  private blit(preview: boolean): void {
    const gridKey = `${this.view.x},${this.view.y},${this.view.zoom},${S.grid.value},${isDarkBg.value}`
    if (gridKey !== this.gridKey) {
      paintGrid(this.gctx, this.view, this.w, this.h, this.dpr, S.grid.value, isDarkBg.value)
      this.gridKey = gridKey
    }
    const ctx = this.bctx
    const c = this.cv0!
    const { dpr, view } = this
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.boardCv.width, this.boardCv.height)
    const dx = (c.x - view.x) * view.zoom * dpr
    const dy = (c.y - view.y) * view.zoom * dpr
    if (!preview) {
      ctx.drawImage(this.cache, Math.round(dx), Math.round(dy))
    } else {
      const k = view.zoom / c.zoom
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(this.cache, dx, dy, this.cache.width * k, this.cache.height * k)
    }
  }

  private renderLive(): void {
    const ctx = this.lctx
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.liveCv.width, this.liveCv.height)
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    const editing = S.editing.value
    if (editing) this.withWorld(ctx, () => paintItem(ctx, { ...editing.item, text: '' }))
    this.currentTool().paintOverlay?.(ctx)
    const laser = this.tools.laser
    if (laser !== this.currentTool() && laser.animating) laser.paintOverlay?.(ctx)
  }

  // ── commands ────────────────────────────────────────────────────────────────
  private applyHistory(op: EditOp | null, dir: 'undo' | 'redo'): void {
    if (!op) return
    // Undoing/redoing a move (or recolour) swaps items for look-alikes; keep the
    // selection on whatever now stands in for what was selected.
    const gone = dir === 'undo' ? op.added : op.removed
    const back = dir === 'undo' ? op.removed : op.added
    if (this.selection.length) {
      const removed = new Set(gone.map((e) => e.it))
      const restored = new Map(back.map((e) => [e.it.id, e.it]))
      this.setSelection(this.selection.map((s) => removed.has(s) ? restored.get(s.id) ?? s : s))
    }
    this.pruneSelection()
    const many = op.removed.length + op.added.length > 80
    this.refresh(many ? null : opBounds(op))
    this.afterEdit(dir === 'undo' ? 'Undo' : 'Redo')
  }

  undo(): void {
    if (this.currentTool().underway()) return
    this.applyHistory(this.history.undo(), 'undo')
  }

  redo(): void {
    if (this.currentTool().underway()) return
    this.applyHistory(this.history.redo(), 'redo')
  }

  clearBoard(): void {
    if (!this.doc.items.length) return showToast('The board is already empty')
    const before = this.doc.snapshot()
    this.doc.replaceAll([])
    this.setSelection([])
    this.commit(this.doc.diff(before))
    this.refresh(null)
    showToast('Board cleared  ·  Ctrl+Z brings it back')
  }

  selectAll(): void {
    if (!this.doc.items.length) return
    this.setTool('select')
    this.setSelection(this.doc.items.slice())
  }

  deleteSelection(): void {
    if (!this.selection.length) return
    const before = this.doc.snapshot()
    const gone = new Set(this.selection.filter(it => !it.locked))
    if (!gone.size) return showToast('Unlock the selection before deleting it')
    const bounds = this.doc.bounds(this.selection)
    this.doc.replaceAll(this.doc.items.filter((it) => !gone.has(it)))
    this.setSelection([])
    this.commit(this.doc.diff(before))
    this.refresh(bounds)
  }

  duplicateSelection(): void {
    if (!this.selection.length) return
    const before = this.doc.snapshot()
    const groups = new Map<string, string>()
    const copies = this.selection.map((it) => {
      if (it.group && !groups.has(it.group)) groups.set(it.group, newId())
      return { ...cloneItem(it, 28, 28), locked: false, group: it.group ? groups.get(it.group) : undefined }
    })
    this.doc.replaceAll([...this.doc.items, ...copies])
    this.commit(this.doc.diff(before))
    this.setSelection(copies)
    this.refresh(this.doc.bounds(copies))
  }

  /** Recolour the selection (used when a colour is picked while items are selected). */
  recolorSelection(color: string): boolean {
    return this.restyleSelection({ c: color })
  }

  resizeSelection(width: number): boolean {
    return this.restyleSelection({ w: width })
  }

  private restyleSelection(style: { c?: string; w?: number }): boolean {
    if (!this.selection.length) return false
    const edited = restyleItems(this.doc.items, this.selection.filter(it => !it.locked), style)
    if (!edited.changed) return true
    const before = this.doc.snapshot()
    const previousBounds = this.doc.bounds(this.selection)
    this.doc.replaceAll(edited.items)
    this.commit(this.doc.diff(before))
    const byId = new Map(edited.items.map(it => [it.id, it]))
    this.setSelection(this.selection.map(it => byId.get(it.id) ?? it))
    this.refresh(unionRect(previousBounds, this.doc.bounds(edited.selection)))
    return true
  }

  /** Replace selected objects as one undoable edit, retaining IDs and selection. */
  private editSelection(edit: (it: Item) => Item, includeLocked = false): void {
    if (this.currentTool().underway()) return
    const before = this.doc.snapshot(), selected = new Set(this.selection)
    const replacements = new Map<Item, Item>()
    this.doc.replaceAll(before.map(it => {
      if (!selected.has(it) || (it.locked && !includeLocked)) return it
      const next = edit(it)
      replacements.set(it, next)
      return next
    }))
    this.commit(this.doc.diff(before))
    this.setSelection(this.selection.map(it => replacements.get(it) ?? it))
    this.refresh(null)
  }

  patchSelection(style: Partial<TextStyle & Pick<ShapeItem, 'c' | 'w' | 'fill' | 'dash' | 'radius' | 'opacity' | 'angle'>>, scope: 'all' | 'text' | 'fill' | 'stroke' | 'shape' | 'rect' = 'all'): void {
    this.editSelection(it => {
      const editable = it.t === 't' || (it.t === 'h' && it.k !== 'line' && it.k !== 'arrow')
      if (scope === 'text' && !editable) return it
      if (scope === 'fill' && !(it.t === 't' && it.note) && !(it.t === 'h' && editable)) return it
      if (scope === 'stroke' && it.t === 't') return it
      if (scope === 'shape' && it.t !== 'h') return it
      if (scope === 'rect' && !(it.t === 'h' && it.k === 'rect')) return it
      const next = { ...it }
      let changed = false
      for (const [key, value] of Object.entries(style)) {
        if (it.t === 's' && !['c', 'w', 'opacity'].includes(key)) continue
        if (it.t === 't' && ['dash', 'radius', 'w'].includes(key)) continue
        if (['fontSize', 'bold', 'italic', 'align', 'list', 'textColor'].includes(key) && !editable) continue
        if (key === 'fill' && !(it.t === 't' && it.note) && !(it.t === 'h' && editable)) continue
        if (key === 'radius' && !(it.t === 'h' && it.k === 'rect')) continue
        if (typeof value === 'number' && !Number.isFinite(value)) continue
        if ((it as unknown as Record<string, unknown>)[key] === value) continue
        ;(next as unknown as Record<string, unknown>)[key] = value
        changed = true
      }
      if (!changed) return it
      return next.t === 't' ? fitTextHeight(next, this.cctx) : next
    })
  }

  groupSelection(): void {
    if (this.selection.length < 2 || this.selection.some(it => it.locked)) return
    const group = newId()
    this.editSelection(it => ({ ...it, group }))
  }

  ungroupSelection(): void {
    this.editSelection(it => { const next = { ...it }; delete next.group; return next })
  }

  toggleLockSelection(): void {
    const locked = !this.selection.some(it => it.locked)
    this.editSelection(it => ({ ...it, locked }), true)
  }

  unlockAll(): void {
    const before = this.doc.snapshot()
    this.doc.replaceAll(before.map(it => it.locked ? { ...it, locked: false } : it))
    this.commit(this.doc.diff(before)); this.setSelection([]); this.refresh(null)
    showToast('All objects unlocked')
  }

  arrangeSelection(where: 'front' | 'back'): void {
    if (!this.selection.length || this.selection.some(it => it.locked)) return
    const before = this.doc.snapshot(), ids = new Set(this.selection.map(it => it.id))
    const selected = before.filter(it => ids.has(it.id)), other = before.filter(it => !ids.has(it.id))
    const ordered = where === 'front' ? [...other, ...selected] : [...selected, ...other]
    if (ordered.every((it, i) => it === before[i])) return
    // Reordered items need new identities so the existing diff also records their indexes.
    const moved = new Map(selected.map(it => [it, { ...it } as Item]))
    this.doc.replaceAll(ordered.map(it => moved.get(it) ?? it))
    this.commit(this.doc.diff(before)); this.setSelection(selected.map(it => moved.get(it)!)); this.refresh(null)
  }

  nudgeSelection(dx: number, dy: number): void { this.editSelection(it => translateItem(it, dx, dy)) }

  rotateSelection(angle: number): void {
    const b = this.doc.bounds(this.selection)
    if (b) this.editSelection(it => transformItem(it, [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], 1, 1, angle))
  }

  private copied: Item[] = []
  private copiedStyle: Partial<TextStyle & Pick<ShapeItem, 'c' | 'w' | 'fill' | 'dash' | 'radius' | 'opacity'>> | null = null

  copySelection(): void {
    this.copied = this.selection.slice()
    if (this.copied.length) showToast(`${this.copied.length} object${this.copied.length === 1 ? '' : 's'} copied`)
  }

  pasteSelection(): void {
    if (!this.copied.length) return
    this.setTool('select'); this.setSelection(this.copied); this.duplicateSelection()
    this.copied = this.selection.slice()
  }

  copyStyle(): void {
    const it = this.selection[0]
    if (!it) return
    this.copiedStyle = { c: it.c, w: it.w, opacity: it.opacity ?? 1 }
    if ((it.t === 't' || it.t === 'h') && !(it.t === 'h' && ['line', 'arrow'].includes(it.k))) {
      Object.assign(this.copiedStyle, { fill: it.fill ?? 'none', fontSize: it.fontSize ?? 24,
        bold: it.bold ?? false, italic: it.italic ?? false, align: textAlign(it),
        list: it.list ?? 'none', textColor: textColor(it) })
    }
    if (it.t === 'h') Object.assign(this.copiedStyle, { dash: it.dash ?? 'solid', radius: it.radius ?? 0 })
    showToast('Style copied')
  }

  pasteStyle(): void { if (this.copiedStyle) this.patchSelection(this.copiedStyle) }

  fitItem(it: Item): Item { return it.t === 't' ? fitTextHeight(it, this.cctx) : it }

  createText(wx: number, wy: number, note = false): void {
    const item: TextItem = { t: 't', id: newId(), c: note ? '#172033' : S.penColor.value, w: 1, p: [wx, wy, wx + (note ? 230 : 300), wy + (note ? 230 : 62)], text: '', fontSize: note ? 24 : 28, note, fill: note ? '#fff2a8' : 'none' }
    this.editText(item, true)
  }

  editText(it: EditableItem, isNew = false): void {
    if (it.locked || (it.t === 'h' && ['line', 'arrow'].includes(it.k))) return
    if (S.editing.value) this.commitText()
    this.setTool('select'); this.setSelection([])
    S.editing.value = { item: it, isNew }
    this.setExcluded(isNew ? [] : [it]); this.refresh(null); this.requestOverlay()
  }

  editTextAt(wx: number, wy: number): void {
    const it = [...this.doc.items].reverse().find(it => hitObject(it, wx, wy, 6 / this.view.zoom))
    if (it && (it.t === 't' || it.t === 'h')) this.editText(it)
  }

  updateTextDraft(text: string): void {
    const draft = S.editing.value
    if (!draft) return
    const item = fitTextHeight({ ...draft.item, text: text.slice(0, MAX_TEXT_LENGTH) }, this.cctx)
    S.editing.value = { ...draft, item }
    this.onChange?.(); this.requestOverlay()
  }

  commitText(text?: string): void {
    const draft = S.editing.value
    if (!draft) return
    const item = fitTextHeight({ ...draft.item, text: (text ?? draft.item.text ?? '').slice(0, MAX_TEXT_LENGTH) }, this.cctx)
    S.editing.value = null; this.setExcluded([])
    if (draft.isNew && !item.text?.trim() && !(item.t === 't' && item.note)) { this.refresh(null); this.onChange?.(); return }
    const before = this.doc.snapshot()
    const existing = this.doc.items.find(it => it.id === item.id)
    if (draft.isNew) this.doc.replaceAll([...before, item])
    else if (existing && JSON.stringify(existing) !== JSON.stringify(item)) this.doc.replaceAll(before.map(it => it.id === item.id ? item : it))
    this.commit(this.doc.diff(before)); this.setSelection([this.doc.items.find(it => it.id === item.id) ?? item]); this.refresh(null)
  }

  cancelText(): void {
    const draft = S.editing.value
    S.editing.value = null; this.setExcluded([])
    this.setSelection(draft && !draft.isNew ? this.doc.items.filter(it => it.id === draft.item.id) : [])
    this.refresh(null); this.onChange?.()
  }

  // ── persistence / export ────────────────────────────────────────────────────
  insertProjectile(): LabItem { return this.insertLab('projectile')! }

  insertLab(model: string): LabItem | null {
    const definition = getModel(model)
    if (!definition) return null
    this.commitText(); this.setTool('select')
    const width = 1000, height = 640, x = this.view.x + 90 / this.view.zoom, y = this.view.y + 120 / this.view.zoom
    const it: LabItem = { t: 'l', id: newId(), c: '#007c88', w: 1, p: [x, y, x + width, y + height],
      labVersion: 1, model, modelVersion: 1, params: { ...definition.defaults }, frozenTime: 0, theme: 'blueprint',
      reveal: { ...EXPLORE_REVEAL, ...(isShowcase(model) ? { graphs: true, vectors: true } : {}) } }
    this.commitAdd(it); this.setSelection([it]); scienceInspector.value = this.w >= 880
    this.focusLab(it)
    return it
  }

  focusLab(it: LabItem): void {
    const available = Math.max(210, this.w - (this.w >= 880 && scienceInspector.value ? 310 : 0))
    const v = fitRect(itemBounds(it), available, Math.max(200, this.h - 106), 65, 1.4)
    this.setView({ ...v, y: v.y - 50 / v.zoom })
  }

  /** A gesture preview lives outside Doc/history/autosave. */
  previewLab(it: LabItem, patch: Partial<Pick<LabItem, 'params' | 'reveal' | 'theme' | 'frozenTime' | 'gesture'>> | null): void {
    if (it.locked || !supportedLab(it)) return
    if (patch) {
      const next = itemFromJson({ ...it, ...patch })
      if (!next || next.t !== 'l') return
      this.labDraft.set(it.id, next)
    } else this.labDraft.delete(it.id)
    this.refresh(itemBounds(it))
  }

  editLab(it: LabItem, patch: Partial<Pick<LabItem, 'params' | 'reveal' | 'theme' | 'frozenTime' | 'gesture'>>, label = 'Edit science lab'): LabItem | null {
    this.labDraft.delete(it.id)
    const current = this.doc.items.find(x => x.id === it.id)
    if (!current || current.t !== 'l' || current.locked || !supportedLab(current) || this.currentTool().underway()) { this.refresh(itemBounds(it)); return null }
    const next = itemFromJson({ ...current, ...patch })
    if (!next || next.t !== 'l') { this.refresh(itemBounds(current)); return null }
    if (JSON.stringify(next) === JSON.stringify(current)) { this.refresh(itemBounds(current)); return current }
    const before = this.doc.snapshot()
    this.doc.replaceAll(before.map(x => x === current ? next : x)); this.commit(this.doc.diff(before), label)
    this.setSelection(this.selection.map(x => x.id === next.id ? next : x)); this.refresh(itemBounds(next))
    return next
  }

  playLab(it: LabItem): void {
    if (it.locked || !supportedLab(it)) return
    for (const other of this.doc.items) if (other.t === 'l' && other.id !== it.id && this.labs.playing(other)) this.pauseLab(other)
    this.labs.play(it); this.refresh(itemBounds(it))
  }
  pauseLab(it: LabItem): void { this.labs.pause(it); this.refresh(itemBounds(it)) }
  labTime(it: LabItem): number { return this.labs.time(it) }
  seekLab(it: LabItem, time: number): void {
    if (it.locked || !supportedLab(it)) return
    this.labs.seek(it, time); this.refresh(itemBounds(it))
  }
  stepLab(it: LabItem, direction = 1): void { this.seekLab(it, this.labs.time(it) + direction / 30) }
  freezeLab(it: LabItem, annotate = false): void {
    if (it.locked || !supportedLab(it)) return
    this.pauseLab(it)
    const time = Math.min(labDuration(it), this.labs.time(it))
    this.editLab(it, { frozenTime: time }, 'Freeze science frame')
    if (annotate) { this.setTool('pen'); scienceInspector.value = false; showToast('Frame frozen · draw your explanation · select the lab to continue') }
  }

  serialize(): string {
    const draft = S.editing.value
    const items = draft ? (draft.isNew ? [...this.doc.items, draft.item] : this.doc.items.map(it => it.id === draft.item.id ? draft.item : it)) : this.doc.items
    return serializeBoard(items, this.view)
  }

  load(json: string, opts: { undoable: boolean }): ParsedBoard | null {
    const parsed = parseBoard(json)
    if (!parsed) return null
    if (S.editing.value) this.cancelText()
    this.labs.clear(); this.labDraft.clear(); activeLabId.value = null
    const before = this.doc.snapshot()
    this.doc.replaceAll(parsed.items)
    this.setSelection([])
    if (opts.undoable) {
      this.commit(this.doc.diff(before))
    } else {
      this.history.clear()
      if (parsed.view) this.setView(parsed.view)
      S.canUndo.value = S.canRedo.value = false
    }
    this.refresh(null)
    return parsed
  }

  /** Render everything (cropped to its bounds) to a PNG. */
  async exportPng(bg: string, bgOpaque: boolean, maxScale = 2): Promise<ArrayBuffer | null> {
    const b = this.doc.bounds()
    if (!b) return null
    const pad = 48
    const w = b[2] - b[0] + pad * 2
    const h = b[3] - b[1] + pad * 2
    const scale = Math.min(maxScale, 9000 / Math.max(w, h))
    const cv = document.createElement('canvas')
    cv.width = Math.max(1, Math.round(w * scale))
    cv.height = Math.max(1, Math.round(h * scale))
    const ctx = cv.getContext('2d')!
    if (bgOpaque) {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, cv.width, cv.height)
    }
    ctx.scale(scale, scale)
    ctx.translate(-b[0] + pad, -b[1] + pad)
    for (const it of this.doc.items) paintItem(ctx, it, 1, it.t === 'l' ? this.labs.time(it) : undefined)
    const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/png'))
    return blob ? await blob.arrayBuffer() : null
  }
}
