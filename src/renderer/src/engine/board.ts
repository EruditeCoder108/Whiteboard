import { getModel, labDuration, EXPLORE_REVEAL } from './science/models'
import { isShowcase } from './science/showcase-models'
import { effect } from '@preact/signals'
import { Doc, History, opBounds, restyleItems } from './doc'
import type { EditOp, HistoryState } from './doc'
import { clamp, inflate, lerp, rectsHit, unionRect } from './geometry'
import { playSpot } from './clip'
import { keepInZone, zoneAt, zoneInks } from './classroom'
import { BRANCH_FILLS, NODE_H, NODE_W, branchSpot, croppedBox, flipItem, mindNode } from './objects'
import { cloneItem, concealed, isHidden, itemBounds, paintItem, hitObject, setHiddenMode, translateItem } from './items'
import { fitTextHeight, textAlign, textColor } from './text'
import { transformItem } from './transforms'
import { parseBoard, serializePages, MAX_TEXT_LENGTH, itemFromJson } from './serialize'
import type { BoardMeta, PageData, ParsedBoard } from './serialize'
import { EraserTool, HandTool, LaserTool, PenTool, SelectTool, ShapeTool, TextTool } from './tools'
import type { Ptr, Tool, ToolHost } from './tool-types'
import { newId } from './types'
import type { ClipItem, Item, Rect, View, EditableItem, TextItem, TextStyle, ShapeItem, LabItem, ImageItem, GraphItem, ScaleItem, TableItem } from './types'
import { MAX_COLS, MAX_ROWS, addCol, addRow, cellAt, fitTable, newTable, removeCol, removeRow, setCell, tableFont } from './table'
import { onImageReady, preloadImages } from './media'
import { Instruments } from './instruments'
import { MAX_ZOOM, MIN_ZOOM, fitRect, panBy as panView, toWorld, zoomAboutCentre, zoomAt } from './view'
import { S, SHAPE_TOOLS, activeTool, isDarkBg, keepInkReadable, showToast } from '@/state/store'
import type { Here, ToolName } from '@/state/store'
import { defaultStyle } from '@/state/store'
import type { InkTiming } from './replay'
import { DEFAULT_BOARD_COLOR, sameColor, isDarkColor } from './colour'
import type { Paper, PaperStyle } from './grid'
import { backdropOf, paintBackdrop, styleOf } from './scene'
import type { Backdrop } from './scene'
import type { Texture } from './texture'
import { ART_DEFAULTS, DEFAULT_FRAME, MAX_EXTENT, MAX_TITLE, PAGE_H, PAGE_W, STYLE_KEYS, clampToFrame, fitZoom, frameForContent, frameRect, frameView, scrollOf } from './pages'
import type { Artwork, BoardKind, Frame, LookFrame, PageLook } from './pages'
import { canvasToNotebook, nextFrameSlot, notebookToCanvas } from './convert'
import { pageAt, readableOn } from './shelf'
import { followConnectors, isConnector, remapAnchors, routeConnector, withNewIds } from './connectors'
import { assignStep, clearStep, hideAgain, showStep, stepsOf } from './reveals'
import type { StepInfo } from './reveals'
import { LabRuntime, supportedLab } from './science/runtime'
import { activeLabId, scienceInspector } from '@/state/science'

/** A page that is not on screen: its ink, camera, undo history and look. */
interface PageRec extends PageLook { items: Item[]; view: View; history: HistoryState; frame?: Frame }

/** A snapshot of the lesson's structure, to put back after a page or board-level change. */
interface Structure { pages: PageRec[]; pageIndex: number; kind: BoardKind; frames: LookFrame[]; color: string; texture: Texture }

/** A paper style as look fields: only what differs from the preset. */
function styleLook(s: PaperStyle): PageLook {
  return { ...(s.spacing !== 1 ? { spacing: s.spacing } : {}), ...(s.strength !== 1 ? { strength: s.strength } : {}), ...(s.lines ? { lines: s.lines } : {}) }
}

/** `o` without the given look settings (they fall back to the lesson's). */
function without<T extends PageLook>(o: T, ...keys: (keyof PageLook)[]): T {
  const out = { ...o }
  for (const k of keys) delete out[k]
  return out
}

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
  readonly instruments: Instruments = new Instruments(this, () => this.viewCentre())
  private labDraft = new Map<string, LabItem>()
  view: View = { x: -80, y: -80, zoom: 1 }
  selection: Item[] = []

  /** called after every committed document change (autosave hook) */
  onChange: (() => void) | null = null
  onViewChange: (() => void) | null = null
  onEdit: ((label: string, timing?: InkTiming) => void) | null = null
  /** before the visible page is replaced (recording cannot span pages) */
  onPageChange: (() => void) | null = null

  /** Pages other than the visible one keep their items, camera, undo history and look here. */
  private pages: PageRec[] = [{ items: [], view: this.view, history: { undo: [], redo: [] }, paper: 'none' }]
  /** the visible page's sheet (page mode keeps the view on it) */
  private sheet: Frame = { ...DEFAULT_FRAME }
  /** the visible page's look: paper, a colour of its own, title. A canvas's is the canvas surface. */
  private look: PageLook = { paper: 'none' }
  /** the board colour every page shows unless it sets its own */
  private lessonColor = DEFAULT_BOARD_COLOR
  /** the surface texture every page shows unless it sets its own */
  private lessonTexture: Texture = 'none'
  /** notebook: pages of fixed sheets; canvas: one endless page, optionally with frames */
  private boardKind: BoardKind = 'canvas'
  /** canvas only: sheet-sized frames, stepped through like slides; each may set its own look */
  private frames: LookFrame[] = []
  private framesRev = 0
  /** counts changes to the visible page's look, so the background is repainted */
  private lookRev = 0
  private pageIndex = 0
  /** Counts every change to the lesson itself (not scrolling or turning pages); "saved" compares it. */
  private contentRev = 0
  /** The one page/board-structure change that can still be undone (see `remember`). */
  private undoSlot: { label: string; rev: number; snap: Structure; restore: () => void } | null = null

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

    // A picture finished decoding: it may be ink or a page background.
    onImageReady(() => { this.gridKey = ''; this.refresh(null) })
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
      S.bgAlpha.value // the texture fades with a see-through board
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
    // A notebook page fills the new screen at the same scroll position.
    const scroll = scrollOf(this.view, this.sheet, this.h)
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
    if (this.paged) this.setView(frameView(this.sheet, this.w, this.h, scroll))
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
    items = items.map(it => this.currentOf(it))
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

  /** Connectors that an edit moved: a selection taken before the edit still finds them. */
  private rerouted = new WeakMap<Item, Item>()

  /** The live version of a connector; Undo can bring back an older one, which is then the live one again. */
  private currentOf(it: Item): Item {
    while (this.rerouted.has(it) && !this.doc.items.includes(it)) it = this.rerouted.get(it)!
    return it
  }

  /** Connectors follow the objects an edit changed, as part of the same undo step. */
  private withConnectors(op: EditOp): EditOp {
    const touched = new Set([...op.removed, ...op.added].map(e => e.it.id))
    const next = followConnectors(this.doc.items, touched, (from, to) => this.rerouted.set(from, to))
    if (next === this.doc.items) return op
    const was = new Doc()
    was.items = this.doc.items.slice()
    was.undo(op)
    this.doc.replaceAll(next)
    const merged = this.doc.diff(was.items) ?? op
    this.refresh(opBounds(merged))
    if (this.selection.some(it => this.rerouted.has(it))) this.setSelection(this.selection)
    return merged
  }

  commit(op: EditOp | null, label = 'Edit objects'): void {
    if (!op) return
    this.history.push(this.withConnectors(op))
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
    this.afterEdit(it.t === 's' ? (it.m ? 'Draw highlighter' : 'Draw pen stroke') : it.t === 'i' ? (it.latex ? 'Insert equation' : 'Insert picture') : it.t === 'g' ? 'Insert graph' : 'Draw shape', timing)
  }

  private afterEdit(label = 'Edit objects', timing?: InkTiming): void {
    const drafts = [...this.labDraft.values()]
    this.labDraft.clear()
    for (const it of drafts) this.refresh(itemBounds(it))
    S.canUndo.value = this.history.canUndo
    S.canRedo.value = this.history.canRedo
    this.changed()
    this.onEdit?.(label, timing)
    this.requestOverlay()
  }

  // ── view ────────────────────────────────────────────────────────────────────
  setView(v: View): void {
    if (this.paged && this.w > 0) v = clampToFrame(v, this.sheet, this.w, this.h)
    const changed = v.x !== this.view.x || v.y !== this.view.y || v.zoom !== this.view.zoom
    this.view = v
    S.zoom.value = v.zoom
    S.viewRevision.value++
    this.dirtyBlit = true
    this.schedule()
    this.requestOverlay()
    if (this.frames.length) this.syncFrame()
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
    if (this.paged) return this.animateTo(frameView(this.sheet, this.w, this.h, scrollOf(this.view, this.sheet, this.h)))
    this.animateTo(zoomAboutCentre(this.view, 1, this.w, this.h))
  }

  fitContent(): void {
    if (this.paged) return this.resetZoom()
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
    const f = this.sheet
    const gridKey = `${this.view.x},${this.view.y},${this.view.zoom},${S.bgColor.value},${S.bgAlpha.value},${this.lookRev},${this.boardKind},${f.x},${f.y},${f.extent},${this.framesRev}`
    if (gridKey !== this.gridKey) {
      // The texture, picture and paper of this page (or of the canvas) over the board colour, which the
      // window supplies. A see-through board fades its texture along with its colour.
      const back = { ...(this.paged ? this.pageBackdrop(this.look, this.sheet) : { ...this.surfaceBackdrop(), adapt: true }), textureAlpha: S.bgAlpha.value / 100 }
      paintBackdrop(this.gctx, this.view, this.w, this.h, this.dpr, back, false)
      if (this.paged) this.paintDesk()
      else if (this.frames.length) this.paintFrames()
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
    for (const w of this.writers.values()) w.tool.paintOverlay?.(ctx)
    const laser = this.tools.laser
    if (laser !== this.currentTool() && laser.animating) laser.paintOverlay?.(ctx)
    if (this.instruments.active) this.withWorld(ctx, () => this.instruments.paint(ctx))
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
    // A page or board change still on offer was the latest thing done, so it comes first.
    if (this.undoStructure()) return
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
    // Clearing takes the ink only: a worksheet picture and the paper stay for the next class.
    const kept = this.look.art ? 'the picture and paper stay' : (this.look.paper ?? 'none') !== 'none' ? 'the paper stays' : ''
    showToast(kept ? `Ink cleared · ${kept}` : 'Board cleared', 6000, { label: 'Undo', run: () => this.undo() })
  }

  selectAll(): void {
    if (!this.doc.items.length) return
    this.setTool('select')
    this.setSelection(this.doc.items.filter(it => !concealed(it)))
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
    const groups = new Map<string, string>(), ids = new Map<string, string>()
    const copies = remapAnchors(this.selection.map((it) => {
      if (it.group && !groups.has(it.group)) groups.set(it.group, newId())
      const copy = cloneItem(it, 28, 28)
      ids.set(it.id, copy.id)
      return { ...copy, locked: false, group: it.group ? groups.get(it.group) : undefined }
    }), ids)
    this.doc.replaceAll([...this.doc.items, ...copies])
    this.commit(this.doc.diff(before))
    this.setSelection(copies)
    this.refresh(this.doc.bounds(copies))
  }

  /** Selected arrows and lines: a straight run or square corners. */
  setElbow(on: boolean): void {
    this.editSelection(it => {
      if (!isConnector(it)) return it
      const { elbow: _elbow, ...rest } = it
      return on ? { ...rest, elbow: Math.abs(it.p[2] - it.p[0]) >= Math.abs(it.p[3] - it.p[1]) ? 'h' : 'v' } : rest
    })
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

  // ── students at the board ────────────────────────────────────────────────
  /** Each hand writing now, with its own tool: several can be under way at once. */
  private writers = new Map<number, { tool: Tool; zone: number }>()
  /** What each side wrote, newest last: a student's undo only ever touches their own work. */
  private zoneWork: string[][] = []

  startZones(count: number): void {
    this.commitText()
    this.setTool('pen')
    this.setSelection([])
    const inks = zoneInks(isDarkBg.value)
    S.zoneChoices.value = inks
    S.zoneInks.value = count === 1 ? [S.penColor.value] : inks.slice(0, count)
    S.zoneTools.value = Array.from({ length: count }, () => 'pen')
    this.zoneWork = Array.from({ length: count }, () => [])
    S.zones.value = count
    this.requestOverlay()
  }

  endZones(): void {
    for (const w of this.writers.values()) w.tool.cancel()
    this.writers.clear()
    S.zones.value = 0
    this.requestOverlay()
  }

  setZoneTool(i: number, tool: 'pen' | 'eraser'): void { S.zoneTools.value = S.zoneTools.value.map((t, k) => k === i ? tool : t) }
  setZoneInk(i: number, ink: string): void { S.zoneInks.value = S.zoneInks.value.map((c, k) => k === i ? ink : c); this.setZoneTool(i, 'pen') }

  undoZone(i: number): void {
    const work = this.zoneWork[i]
    while (work?.length) {
      const id = work.pop()!
      const it = this.doc.items.find(o => o.id === id)
      if (!it) continue
      const before = this.doc.snapshot()
      this.doc.replaceAll(before.filter(o => o !== it))
      this.commit(this.doc.diff(before), 'Undo a stroke')
      this.refresh(itemBounds(it))
      return
    }
  }

  /** A hand landing on the board: it writes on its own side, in its side's colour, alongside any others. */
  zoneDown(id: number, p: Ptr, width: number): void {
    const count = S.zones.value
    const zone = zoneAt(p.x, width, count)
    const tool: Tool = S.zoneTools.value[zone] === 'eraser' ? new EraserTool(this) : new PenTool(this, false, 'pen')
    this.writers.set(id, { tool, zone })
    S.inkOverride.value = S.zoneInks.value[zone] ?? null
    tool.down(this.keptInZone(p, zone, width, count))
    S.inkOverride.value = null
  }

  zoneMove(id: number, p: Ptr, width: number): boolean {
    const w = this.writers.get(id)
    if (!w) return false
    w.tool.move(this.keptInZone(p, w.zone, width, S.zones.value))
    return true
  }

  zoneUp(id: number, p: Ptr | null, width: number): boolean {
    const w = this.writers.get(id)
    if (!w) return false
    this.writers.delete(id)
    if (!p) { w.tool.cancel(); return true }
    const before = this.doc.items.length
    w.tool.up(this.keptInZone(p, w.zone, width, S.zones.value))
    if (w.tool.name === 'pen' && this.doc.items.length > before) this.zoneWork[w.zone]?.push(this.doc.items[this.doc.items.length - 1].id)
    return true
  }

  private keptInZone(p: Ptr, zone: number, width: number, count: number): Ptr {
    if (count < 2) return p
    const x = keepInZone(p.x, zone, width, count)
    return x === p.x ? p : { ...p, x, wx: this.toWorld(x, p.y)[0] }
  }

  /** The board under a magnifier: drawn again at a larger scale, so writing stays sharp. */
  paintLens(cv: HTMLCanvasElement, sx: number, sy: number, scale: number): void {
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const [wx, wy] = this.toWorld(sx, sy)
    const zoom = this.view.zoom * scale * (cv.width / cv.clientWidth || 1)
    const view = { x: wx - cv.width / 2 / zoom, y: wy - cv.height / 2 / zoom, zoom }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, cv.width, cv.height)
    paintBackdrop(ctx, view, cv.width, cv.height, 1, this.paged ? this.pageBackdrop(this.look, this.sheet) : { ...this.surfaceBackdrop(), adapt: true }, true)
    ctx.setTransform(zoom, 0, 0, zoom, -view.x * zoom, -view.y * zoom)
    for (const it of this.doc.items) paintItem(ctx, it, 1, it.t === 'l' ? this.labs.time(it) : undefined)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }

  /** The clip whose play button is here, if any. */
  clipAt(wx: number, wy: number): ClipItem | null {
    for (let i = this.doc.items.length - 1; i >= 0; i--) {
      const it = this.doc.items[i]
      if (it.t !== 'm' || concealed(it)) continue
      const { x, y, r } = playSpot(it.p)
      if (Math.hypot(wx - x, wy - y) <= r) return it
    }
    return null
  }
  onPlayClip?: (it: ClipItem) => void
  /** A tap on a play button plays the clip, with whatever tool is in hand. */
  playClipAt(wx: number, wy: number): boolean {
    const it = this.clipAt(wx, wy)
    if (!it || !this.onPlayClip || S.tool.value === 'select' || S.tool.value === 'lasso') return false
    this.onPlayClip(it)
    return true
  }

  /** Replace a picture by its cropped part, shown where that part was. Undo brings the whole picture back. */
  cropPicture(it: ImageItem, src: string, crop: [number, number, number, number], aspect: number): void {
    const before = this.doc.snapshot()
    const current = before.find(o => o.id === it.id)
    if (!current || current.t !== 'i' || current.locked) return
    const next: ImageItem = { ...current, src, aspect, p: croppedBox(current, crop) }
    this.doc.replaceAll(before.map(o => o === current ? next : o))
    this.commit(this.doc.diff(before), 'Crop picture')
    this.setSelection([next])
    this.refresh(null)
  }

  /** Mirror the selection left to right, or turn it upside down. */
  flipSelection(axis: 'h' | 'v'): void {
    const b = this.doc.bounds(this.selection)
    if (b) this.editSelection(it => flipItem(it, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2, axis))
  }

  /** The web address of the one selected object; empty removes it. */
  setLink(link: string | null): void {
    this.editSelection(it => {
      const { link: _old, ...rest } = it
      return (link ? { ...rest, link } : rest) as Item
    })
  }

  /** The middle of a new mind map, ready to type in. */
  startMindMap(): void {
    const r = this.visibleRect(), cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2
    const node = mindNode([cx - NODE_W * .6, cy - NODE_H * .6, cx + NODE_W * .6, cy + NODE_H * .6], BRANCH_FILLS[0], S.penColor.value, true)
    this.addMindNode(node)
    showToast('Type the main idea. Tap Branch to grow the map.', 4000)
  }

  /** A new idea beside this one, tied to it by a line that follows either of them. */
  addBranch(parent: ShapeItem): void {
    const taken = this.doc.items.filter(it => !isConnector(it) && !concealed(it)).map(itemBounds)
    const spot = branchSpot(itemBounds(parent), taken, this.visibleRect())
    const children = this.doc.items.filter(it => isConnector(it) && it.from?.id === parent.id).length
    const root = !this.doc.items.some(it => isConnector(it) && it.to?.id === parent.id)
    const fill = root ? BRANCH_FILLS[(children + 1) % BRANCH_FILLS.length] : parent.fill ?? BRANCH_FILLS[0]
    const node = mindNode(spot, fill, parent.c)
    const line: ShapeItem = { t: 'h', id: newId(), c: parent.c, w: 3, k: 'line', p: [spot[0], spot[1], spot[2], spot[3]], from: { id: parent.id }, to: { id: node.id } }
    this.addMindNode(node, routeConnector(line, id => id === parent.id ? parent : id === node.id ? node : undefined))
  }

  private addMindNode(node: ShapeItem, line?: ShapeItem): void {
    const before = this.doc.snapshot()
    this.doc.replaceAll(line ? [...before, line, node] : [...before, node])
    this.commit(this.doc.diff(before), 'Add to mind map')
    this.refresh(null)
    this.editText(node)
  }

  rotateSelection(angle: number): void {
    const b = this.doc.bounds(this.selection)
    if (b) this.editSelection(it => transformItem(it, [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], 1, 1, angle))
  }

  private copied: Item[] = []
  get hasCopy(): boolean { return this.copied.length > 0 }
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

  fitItem(it: Item): Item {
    if (it.t === 't') return fitTextHeight(it, this.cctx)
    if (it.t !== 'b') return it
    const ctx = this.cctx
    return fitTable(it, (text, head) => { ctx.save(); ctx.font = tableFont(it, head); const width = ctx.measureText(text).width; ctx.restore(); return width })
  }

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
    else if (it && !it.locked && ((it.t === 'i' && it.latex !== undefined) || it.t === 'g' || it.t === 'n')) this.onEditMedia?.(it)
  }
  /** opens the equation or graph editor (wired by the UI) */
  onEditMedia: ((it: ImageItem | GraphItem | ScaleItem) => void) | null = null

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

  // ── pages ────────────────────────────────────────────────────────────────────
  get page(): number { return this.pageIndex }
  get pageCount(): number { return this.pages.length }

  private syncPages(): void { S.page.value = this.pageIndex; S.pageCount.value = this.pages.length }

  // ── what changed, and the one structural change that can be undone ──────────
  /** Count of changes to the lesson itself; scrolling and turning pages do not count. */
  get revision(): number { return this.contentRev }

  /** The lesson changed: bump the revision and save. `undo` makes this change undoable until the next one. */
  private changed(undo?: { label: string; snap: Structure }): void {
    this.contentRev++
    if (undo) { const { label, snap } = undo; this.undoSlot = { label, rev: this.contentRev, snap, restore: () => this.restoreStructure(snap) } }
    S.contentRevision.value = this.contentRev
    S.undoLabel.value = this.structureUndoLabel ?? ''
    S.canUndo.value = this.history.canUndo || !!this.structureUndoLabel
    this.onChange?.()
  }

  /** What `undoStructure` would put back, e.g. "Deleted page 3"; null once anything else has changed. */
  get structureUndoLabel(): string | null { return this.undoSlot && this.undoSlot.rev === this.contentRev ? this.undoSlot.label : null }

  undoStructure(): boolean {
    if (!this.structureUndoLabel || this.currentTool().underway()) return false
    this.undoSlot!.restore()
    return true
  }

  /**
   * Everything an undo has to bring back: pages (items are immutable, so they are shared, not copied),
   * frames, board kind and colour. Taken before a change; valid to restore only while nothing else
   * has changed since, which is what makes plain snapshots safe.
   */
  private structure(): Structure {
    const live: PageRec = { items: this.doc.items, view: this.view, history: this.history.peek(), ...this.look, frame: this.sheet }
    return { pages: this.pages.map((pg, i) => i === this.pageIndex ? live : pg), pageIndex: this.pageIndex, kind: this.boardKind, frames: this.frames.map(f => ({ ...f })), color: this.lessonColor, texture: this.lessonTexture }
  }

  private restoreStructure(s: Structure): void {
    this.commitText()
    this.onPageChange?.()
    this.history.take()
    this.pages = s.pages.slice()
    this.frames = s.frames.map(f => ({ ...f }))
    this.lessonColor = s.color
    this.lessonTexture = s.texture
    this.setKind(s.kind)
    this.showPage(Math.min(s.pageIndex, this.pages.length - 1))
    this.changed()
  }

  // ── a page's look: board colour, paper, title ───────────────────────────────
  /** Keep the signals the interface reads in step with the visible page. */
  private syncLook(forceInk = false): void {
    const dark = isDarkBg.value
    this.lookRev++
    S.bgColor.value = this.look.color ?? this.lessonColor
    S.grid.value = this.look.paper ?? 'none'
    // A change between light and dark boards swaps an unreadable pen colour (white on white).
    if (forceInk || isDarkBg.value !== dark) keepInkReadable()
    this.dirtyBlit = true
    this.schedule()
    this.syncHere()
  }

  /** The look of the page, or canvas frame, the teacher is looking at (what the picker edits). */
  private syncHere(): void {
    const f = !this.paged ? this.frames[S.frameIndex.value] : undefined
    const b = f ? this.frameBackdrop(f) : this.paged ? this.pageBackdrop(this.look, this.sheet) : this.surfaceBackdrop()
    const next: Here = { paper: b.paper, color: b.color, texture: b.texture ?? 'none', unit: f ? 'frame' : this.paged ? 'page' : null, style: b.style, art: b.art ?? null }
    const cur = S.here.value
    if (cur.paper !== next.paper || cur.color !== next.color || cur.texture !== next.texture || cur.unit !== next.unit || cur.art !== next.art ||
      cur.style.spacing !== next.style.spacing || cur.style.strength !== next.style.strength || cur.style.lines !== next.style.lines) S.here.value = next
  }

  /** Board colour. By default for the whole lesson; `onlyHere` sets just this page or frame. */
  setColor(color: string, onlyHere = false): void { this.setSurface({ color }, onlyHere) }

  /**
   * The board surface: its colour and texture (a chalkboard is a dark colour with chalk texture). By
   * default for the whole lesson; `onlyHere` sets just this page or frame. A page that matches the
   * lesson again drops its own setting, so it follows later lesson-wide changes.
   */
  setSurface(patch: { color?: string; texture?: Texture }, onlyHere = false): void {
    const snap = this.structure()
    const f = !this.paged ? S.frameIndex.value : -1
    const own = <T extends PageLook>(o: T): T => {
      let out = o
      if (patch.color !== undefined) out = sameColor(patch.color, this.lessonColor) ? without(out, 'color') : { ...out, color: patch.color }
      if (patch.texture !== undefined) out = patch.texture === this.lessonTexture ? without(out, 'texture') : { ...out, texture: patch.texture }
      return out
    }
    if (onlyHere && this.paged) this.look = own(this.look)
    else if (onlyHere && f >= 0) this.frames[f] = own(this.frames[f])
    else {
      const keys: (keyof PageLook)[] = []
      if (patch.color !== undefined) { this.lessonColor = patch.color; keys.push('color') }
      if (patch.texture !== undefined) { this.lessonTexture = patch.texture; keys.push('texture') }
      this.look = without(this.look, ...keys)
      this.pages = this.pages.map(pg => without(pg, ...keys))
      this.frames = this.frames.map(fr => without(fr, ...keys))
    }
    const label = patch.texture === undefined ? onlyHere ? 'Changed the colour of one page' : 'Changed the board colour'
      : onlyHere ? 'Changed the board of one page' : 'Changed the board'
    this.lookChanged(label, snap)
  }

  /**
   * Paper. By default for this page (or frame); `everywhere` sets every page and the canvas itself.
   * The paper keeps the spacing, strength and line colour it is shown with now; with `everywhere`
   * every page takes them too, so all pages match.
   */
  setPaper(paper: Paper, everywhere = false): void {
    const snap = this.structure()
    const f = !this.paged ? S.frameIndex.value : -1
    const style = styleLook(S.here.value.style)
    if (!everywhere && f >= 0) this.frames[f] = { ...without(this.frames[f], ...STYLE_KEYS), ...style, paper, origin: [this.frames[f].x, this.frames[f].y] }
    else {
      this.look = { ...without(this.look, 'origin', ...STYLE_KEYS), ...style, paper }
      if (everywhere) {
        this.pages = this.pages.map(pg => ({ ...without(pg, 'origin', ...STYLE_KEYS), ...style, paper }))
        this.frames = this.frames.map(fr => without(fr, 'paper', 'origin', ...STYLE_KEYS))
      }
    }
    this.lookChanged(everywhere ? 'Changed the paper of every page' : 'Changed the paper', snap)
  }

  /**
   * Spacing (1 = the preset), strength (1 = the preset) and line colour of the paper; `null` puts a
   * setting back to the preset. A canvas frame that shows the canvas paper takes it over first, in
   * place, so only that frame changes. Repeated adjustments are one change to undo.
   */
  setPaperStyle(patch: { spacing?: number | null; strength?: number | null; lines?: string | null }, everywhere = false, label = 'Adjusted the paper'): void {
    const snap = this.structure()
    const apply = <T extends PageLook>(o: T): T => {
      const out: T = { ...o }
      for (const [k, v] of Object.entries(patch) as [keyof typeof patch, number | string | null | undefined][]) {
        if (v === undefined) continue
        if (v === null || v === 1 || v === '') delete out[k]
        else (out as Record<string, unknown>)[k] = v
      }
      return out
    }
    const f = !this.paged ? S.frameIndex.value : -1
    if (!everywhere && f >= 0) {
      const fr = this.frames[f]
      const own = fr.paper ? fr : { ...fr, paper: this.look.paper ?? 'none', ...styleLook(styleOf(this.look)), ...(this.look.origin ? { origin: this.look.origin } : {}) }
      this.frames[f] = apply(own)
    } else {
      this.look = apply(this.look)
      if (everywhere) {
        this.pages = this.pages.map(apply)
        this.frames = this.frames.map(fr => fr.paper ? apply(fr) : fr)
      }
    }
    this.lookChanged(everywhere ? `${label} of every page` : label, snap)
  }

  /**
   * A picture on the page (an imported worksheet, say) becomes its background: it leaves the drawing
   * and is shown whole behind the ink. Undo puts it back as it was, in two steps.
   */
  pictureToBackground(it: ImageItem, everywhere = false): boolean {
    if (it.t !== 'i' || it.latex !== undefined || !this.doc.items.includes(it)) return false
    const before = this.doc.snapshot()
    this.doc.replaceAll(this.doc.items.filter(x => x !== it))
    this.setSelection([])
    this.commit(this.doc.diff(before))
    this.refresh(null)
    this.setArt({ src: it.src, ...ART_DEFAULTS }, everywhere)
    return true
  }

  /** The paper as it was designed: preset spacing, strength and colour. The drawing is not touched. */
  resetPaper(everywhere = false): void {
    this.setPaperStyle({ spacing: null, strength: null, lines: null }, everywhere, 'Restored the paper')
  }

  /**
   * A picture behind this page (or frame, or the canvas), or none (`null`). `everywhere` puts it on
   * every page. Adjusting the same picture (fit, opacity, position) is one change to undo.
   */
  setArt(art: Artwork | null, everywhere = false): void {
    const snap = this.structure()
    const before = S.here.value.art
    const put = <T extends PageLook>(o: T): T => art ? { ...o, art } : without(o, 'art')
    const f = !this.paged ? S.frameIndex.value : -1
    if (!everywhere && f >= 0) this.frames[f] = put(this.frames[f])
    else {
      this.look = put(this.look)
      if (everywhere) {
        this.pages = this.pages.map(put)
        this.frames = this.frames.map(put)
      }
    }
    const label = !art ? 'Removed the background picture' : before?.src === art.src ? 'Adjusted the background picture' : 'Set a background picture'
    this.lookChanged(everywhere ? `${label} of every page` : label, snap)
    if (!art && before) showToast('Background picture removed · your writing stays', 7000, { label: 'Undo', run: () => this.undoStructure() })
  }

  private lookChanged(label: string, snap: Structure): void {
    // Picking colours one after another is one change to undo, back to how it was before the first.
    const first = this.structureUndoLabel === label ? this.undoSlot!.snap : snap
    this.syncLook()
    this.framesChanged()
    this.changed({ label, snap: first })
  }

  /** Name a notebook page or canvas frame (empty clears the name). */
  setTitle(i: number, title: string): void {
    const t = title.trim().slice(0, MAX_TITLE)
    const named = <T extends PageLook>(o: T): T => t ? { ...o, title: t } : without(o, 'title')
    if (this.paged) {
      if (i === this.pageIndex) this.look = named(this.look)
      else if (this.pages[i]) this.pages[i] = named(this.pages[i])
      else return
    } else if (this.frames[i]) this.frames[i] = named(this.frames[i])
    else return
    this.framesChanged()
    this.changed()
  }

  /** Start a section of the lesson at page (or frame) `i`, under `name`; an empty name ends it there. */
  setSection(i: number, name: string): void {
    const t = name.trim().slice(0, MAX_TITLE)
    const mark = <T extends PageLook>(o: T): T => t ? { ...o, section: t } : without(o, 'section')
    if (this.paged) {
      if (i === this.pageIndex) this.look = mark(this.look)
      else if (this.pages[i]) this.pages[i] = mark(this.pages[i])
      else return
    } else if (this.frames[i]) this.frames[i] = mark(this.frames[i])
    else return
    this.framesChanged()
    this.changed()
  }

  /** The heading of the section that starts at page (or frame) `i`, if one does. */
  sectionAt(i: number): string {
    return (this.paged ? i === this.pageIndex ? this.look.section : this.pages[i]?.section : this.frames[i]?.section) ?? ''
  }

  /** The name of notebook page `i` or canvas frame `i`. */
  titleOf(i: number): string {
    return (this.paged ? i === this.pageIndex ? this.look.title : this.pages[i]?.title : this.frames[i]?.title) ?? ''
  }

  private stashPage(): void {
    this.pages[this.pageIndex] = { items: this.doc.items, view: this.view, history: this.history.take(), ...this.look, frame: this.sheet }
  }

  private showPage(i: number): void {
    const pg = this.pages[i]
    this.pageIndex = i
    const { items: _i, view: _v, history: _h, frame: _f, ...look } = pg
    this.look = { ...look, paper: look.paper ?? 'none' }
    this.labs.clear(); this.labDraft.clear(); activeLabId.value = null
    this.doc.replaceAll(pg.items)
    this.sheet = pg.frame ?? frameForContent(this.doc.bounds())
    this.history.restore(pg.history)
    this.setSelection([])
    this.syncLook()
    this.setView(pg.view)
    S.canUndo.value = this.history.canUndo || !!this.structureUndoLabel; S.canRedo.value = this.history.canRedo
    this.refresh(null)
    this.syncPages()
  }

  /** False while a gesture is in progress; pages change only between gestures. */
  private leavePage(): boolean {
    if (this.currentTool().underway()) return false
    this.commitText()
    this.onPageChange?.()
    this.stashPage()
    return true
  }

  goToPage(i: number): boolean {
    if (i === this.pageIndex || i < 0 || i >= this.pages.length || !this.leavePage()) return false
    // Turning to another page ends the offer to undo what was done on this one.
    this.undoSlot = null
    S.undoLabel.value = ''
    this.showPage(i)
    this.onChange?.()
    return true
  }

  /**
   * A new page takes the paper (with its spacing, strength and colour) and board colour of the one
   * before it, but not its background picture: a new page after a worksheet is for working.
   */
  private inherited(): PageLook { return { paper: this.look.paper ?? 'none', ...styleLook(styleOf(this.look)), ...(this.look.color ? { color: this.look.color } : {}) } }

  addPage(items: Item[] = [], view?: View, at = this.pageIndex + 1, frame: Frame = { ...DEFAULT_FRAME }): void {
    if (!this.paged && !items.length) return this.addFrame() // a canvas has no pages: the next frame instead
    const snap = this.structure()
    if (!this.leavePage()) return
    const start = view ?? (this.paged ? frameView(frame, this.w, this.h) : { x: -80, y: -80, zoom: 1 })
    this.pages.splice(at, 0, { items, view: start, history: { undo: [], redo: [] }, ...this.inherited(), frame })
    this.showPage(at)
    this.changed({ label: 'Added a page', snap })
  }

  deletePage(): void {
    if (this.pages.length === 1) return this.clearBoard()
    const snap = this.structure(), n = this.pageIndex + 1
    if (!this.leavePage()) return
    this.pages.splice(this.pageIndex, 1)
    this.showPage(Math.min(this.pageIndex, this.pages.length - 1))
    this.changed({ label: `Deleted page ${n}`, snap })
    showToast(`Page ${n} deleted`, 7000, { label: 'Undo', run: () => this.undoStructure() })
  }

  /** Copy a page (items are immutable, so sharing them is safe) and show the copy after it. */
  duplicatePage(i = this.pageIndex): void {
    const snap = this.structure()
    if (!this.leavePage()) return
    const pg = this.pages[i]
    if (!pg) return
    const { items, view, history: _h, frame, ...look } = pg
    // The copy belongs to the same section: it does not start another one.
    this.pages.splice(i + 1, 0, { ...without(look, 'section'), items: withNewIds(items), view: { ...view }, history: { undo: [], redo: [] }, frame: frame && { ...frame } })
    this.showPage(i + 1)
    this.changed({ label: `Copied page ${i + 1}`, snap })
  }

  /** Reorder pages; the visible page stays visible. */
  movePage(from: number, to: number): void {
    if (from === to || from < 0 || to < 0 || from >= this.pages.length || to >= this.pages.length) return
    const snap = this.structure()
    if (!this.leavePage()) return
    const [pg] = this.pages.splice(from, 1)
    this.pages.splice(to, 0, pg)
    const shown = this.pageIndex === from ? to : this.pageIndex > from && this.pageIndex <= to ? this.pageIndex - 1 : this.pageIndex < from && this.pageIndex >= to ? this.pageIndex + 1 : this.pageIndex
    this.showPage(shown)
    this.changed({ label: `Moved page ${from + 1}`, snap })
  }

  // ── board kind ───────────────────────────────────────────────────────────────
  get kind(): BoardKind { return this.boardKind }
  /** Nothing drawn on any page. */
  get isEmpty(): boolean { return this.doc.items.length === 0 && this.pages.every((pg, i) => i === this.pageIndex || !pg.items.length) }
  /** A notebook: the view is fixed to the page's sheet. */
  get paged(): boolean { return this.boardKind === 'notebook' }

  private setKind(kind: BoardKind): void {
    this.boardKind = kind
    S.kind.value = kind
    this.framesChanged()
  }

  /**
   * Turn the board into the other kind without losing anything: a notebook's sheets are laid out
   * side by side on the canvas as frames; a canvas's frames become pages, and drawing outside
   * every frame gets pages of its own.
   */
  convertTo(kind: BoardKind): boolean {
    if (kind === this.boardKind) return false
    const snap = this.structure()
    if (!this.leavePage()) return false
    // The paper of the page being left becomes the canvas paper (and the other way round).
    const surface = this.look.paper ?? 'none'
    const surfaceLook: PageLook = { paper: surface, ...styleLook(styleOf(this.look)) }
    const same = (pg: PageLook): boolean => (pg.paper ?? 'none') === surface && STYLE_KEYS.every(k => pg[k] === this.look[k])
    const blank = !this.pages.some(pg => pg.items.length) && this.pages.every(pg => !pg.title && !pg.color && !pg.art && same(pg))
    const fresh = (): HistoryState => ({ undo: [], redo: [] })
    if (blank) {
      this.pages = [{ items: [], view: this.view, history: fresh(), ...surfaceLook }]
      this.frames = []
    } else if (kind === 'canvas') {
      const { items, frames } = notebookToCanvas(this.pages)
      this.pages = [{ items, view: this.view, history: fresh(), ...surfaceLook }]
      this.frames = frames
    } else {
      this.pages = canvasToNotebook(this.pages.flatMap(pg => pg.items), this.frames, this.look)
        .map(s => ({ ...s, view: this.view, history: fresh() }))
      this.frames = []
    }
    this.setKind(kind)
    this.showPage(0)
    if (kind === 'canvas') {
      if (this.frames.length) this.goToFrame(0, false)
      else this.setView({ x: -80, y: -80, zoom: 1 })
    }
    this.changed({ label: kind === 'notebook' ? 'Turned into a notebook' : 'Turned into a canvas', snap })
    return true
  }

  /** A blank lesson: one empty page of the given kind, with the board colour and paper chosen last. */
  newLesson(kind: BoardKind): void {
    if (S.editing.value) this.cancelText()
    this.onPageChange?.()
    this.labs.clear(); this.labDraft.clear(); activeLabId.value = null
    this.lessonColor = S.defaultColor.value
    this.lessonTexture = S.defaultTexture.value
    this.frames = []
    this.pages = [{ items: [], view: { x: -80, y: -80, zoom: 1 }, history: { undo: [], redo: [] }, paper: S.defaultPaper.value, ...styleLook(defaultStyle()) }]
    this.undoSlot = null
    this.setKind(kind)
    this.history.take()
    this.showPage(0)
    this.changed()
  }

  // ── canvas frames ──────────────────────────────────────────────────────────
  get frameList(): readonly Frame[] { return this.frames }

  private framesChanged(): void {
    this.framesRev++
    this.gridKey = ''
    S.frameCount.value = this.frames.length
    this.syncFrame()
    this.dirtyBlit = true
    this.schedule()
  }

  /** The frame under the middle of the screen (-1 between frames). */
  private syncFrame(): void {
    const [cx, cy] = this.viewCentre()
    const i = this.frames.findIndex(f => { const r = frameRect(f); return cx >= r[0] && cx <= r[2] && cy >= r[1] && cy <= r[3] })
    if (S.frameIndex.value !== i) S.frameIndex.value = i
    this.syncHere()
  }

  /** The first screen of a frame, filling the view. */
  private frameFit(f: Frame): View {
    return fitRect([f.x, f.y, f.x + PAGE_W, f.y + PAGE_H], this.w, this.h, 12, MAX_ZOOM)
  }

  goToFrame(i: number, animate = true): boolean {
    const f = this.frames[i]
    if (!f) return false
    if (animate) this.animateTo(this.frameFit(f), 360)
    else this.setView(this.frameFit(f))
    return true
  }

  turnFrame(dir: 1 | -1): boolean {
    if (!this.frames.length) return false
    const cur = S.frameIndex.value
    return this.goToFrame(cur < 0 ? (dir > 0 ? 0 : this.frames.length - 1) : cur + dir)
  }

  /** A new frame: after the last one (like a new page), or around what is on screen now. */
  addFrame(where: 'next' | 'here' = 'next'): void {
    if (this.paged) return
    // Framing what is already framed would only stack identical frames.
    if (where === 'here' && S.frameIndex.value >= 0) return showToast(`This is already frame ${S.frameIndex.value + 1}. Move to another part of the board to add one.`, 4000)
    const [cx, cy] = this.viewCentre()
    const slot = where === 'here' ? { x: Math.round(cx - PAGE_W / 2), y: Math.round(cy - PAGE_H / 2) } : nextFrameSlot(this.frames, this.doc.items)
    const snap = this.structure()
    this.frames.push({ ...slot, extent: 1 })
    this.framesChanged()
    this.goToFrame(this.frames.length - 1)
    this.changed({ label: 'Added a frame', snap })
    showToast(`Frame ${this.frames.length} added · ‹ › step through frames like slides`, 3500)
  }

  /** Remove every frame at this spot of the board at once: stacked ones cannot be told apart. Your drawing stays. */
  removeFramesHere(): void {
    const [cx, cy] = this.viewCentre()
    const here = (f: Frame): boolean => { const r = frameRect(f); return cx >= r[0] && cx <= r[2] && cy >= r[1] && cy <= r[3] }
    const gone = this.frames.filter(here).length
    if (!gone) return
    const snap = this.structure()
    this.frames = this.frames.filter(f => !here(f))
    this.framesChanged()
    this.changed({ label: gone === 1 ? 'Removed a frame' : `Removed ${gone} frames`, snap })
    showToast(`${gone === 1 ? 'Frame' : `${gone} frames`} removed · your drawing stays`, 7000, { label: 'Undo', run: () => this.undoStructure() })
  }

  /** Remove a frame; what is drawn inside it stays on the canvas. */
  deleteFrame(i: number): void {
    if (!this.frames[i]) return
    const snap = this.structure()
    this.frames.splice(i, 1)
    this.framesChanged()
    this.changed({ label: `Removed frame ${i + 1}`, snap })
    showToast(`Frame ${i + 1} removed · your drawing stays`, 7000, { label: 'Undo', run: () => this.undoStructure() })
  }

  moveFrame(from: number, to: number): void {
    if (from === to || !this.frames[from] || !this.frames[to]) return
    const snap = this.structure()
    const [f] = this.frames.splice(from, 1)
    this.frames.splice(to, 0, f)
    this.framesChanged()
    this.changed({ label: `Moved frame ${from + 1}`, snap })
  }

  /** A sheet of content (a PDF page, say): its own page in a notebook, the next frame on a canvas. */
  addSheet(items: Item[], frame: Frame, reuseEmptyPage: boolean): void {
    if (this.paged) {
      if (reuseEmptyPage && !this.doc.items.length) { this.addPageContent(items); this.setPageFrame(frame) }
      else this.addPage(items, undefined, undefined, frame)
      return
    }
    const slot = nextFrameSlot(this.frames, this.doc.items)
    this.addPageContent(items.map(it => translateItem(it, slot.x - frame.x, slot.y - frame.y)))
    this.frames.push({ x: slot.x, y: slot.y, extent: frame.extent })
    this.framesChanged()
    this.goToFrame(this.frames.length - 1, false)
    this.changed()
  }

  /**
   * Backdrops: of a notebook page on its sheet, of the canvas itself, and of a canvas frame (its own
   * look, else the canvas paper, still anchored where the canvas paper is).
   */
  private pageBackdrop(look: PageLook, sheet: Frame = DEFAULT_FRAME): Backdrop { return backdropOf({ color: this.lessonColor, texture: this.lessonTexture, paper: 'none' }, look, frameRect(sheet)) }
  private surfaceBackdrop(): Backdrop { return backdropOf({ color: this.lessonColor, texture: this.lessonTexture, paper: 'none' }, { ...this.look, paper: this.look.paper ?? 'none' }) }
  private frameBackdrop(f: LookFrame): Backdrop { return backdropOf({ ...without(this.look, 'art', 'color', 'texture'), color: this.lessonColor, texture: this.lessonTexture, paper: this.look.paper ?? 'none' }, f, frameRect(f)) }

  /** Canvas: frame outlines with their numbers, quiet enough to draw over. */
  private paintFrames(): void {
    const ctx = this.gctx, { view, dpr } = this
    const dark = isDarkBg.value
    const screenRect = (f: Frame): number[] => {
      const [x0, y0, x1, y1] = frameRect(f)
      return [(x0 - view.x) * view.zoom, (y0 - view.y) * view.zoom, (x1 - view.x) * view.zoom, (y1 - view.y) * view.zoom]
    }
    // A frame that sets its own paper, colour or picture is painted over the canvas, inside its edges.
    this.frames.forEach(f => {
      if (!f.paper && !f.color && !f.art) return
      const r = screenRect(f)
      if (r[2] < 0 || r[3] < 0 || r[0] > this.w || r[1] > this.h) return
      ctx.save()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.beginPath(); ctx.rect(r[0], r[1], r[2] - r[0], r[3] - r[1]); ctx.clip()
      paintBackdrop(ctx, view, this.w, this.h, dpr, this.frameBackdrop(f), true)
      ctx.restore()
    })
    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.font = '600 12px "Segoe UI", system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    this.frames.forEach((f, i) => {
      const r = screenRect(f)
      if (r[2] < 0 || r[3] < 0 || r[0] > this.w || r[1] > this.h) return
      const current = i === S.frameIndex.value
      ctx.strokeStyle = dark ? `rgba(160,185,255,${current ? .6 : .32})` : `rgba(47,107,255,${current ? .55 : .28})`
      ctx.lineWidth = current ? 2 : 1.25
      ctx.setLineDash(current ? [] : [8, 6])
      ctx.strokeRect(r[0], r[1], r[2] - r[0], r[3] - r[1])
      ctx.setLineDash([])
      const label = f.title ? `${i + 1} · ${f.title}` : String(i + 1), w = ctx.measureText(label).width + 14
      ctx.fillStyle = dark ? 'rgba(160,185,255,.85)' : 'rgba(47,107,255,.85)'
      ctx.beginPath(); ctx.roundRect(r[0], r[1] - 22, w, 18, 5); ctx.fill()
      ctx.fillStyle = dark ? '#10131c' : '#fff'
      ctx.fillText(label, r[0] + 7, r[1] - 13)
    })
    ctx.restore()
  }

  // ── notebook pages ─────────────────────────────────────────────────────────
  get pageFrame(): Frame { return this.sheet }
  /** True when the whole width of the sheet is on screen (not zoomed in). */
  get atFit(): boolean { return this.view.zoom <= fitZoom(this.w, this.h) * 1.002 }

  /** Scroll the visible page (page mode), 0 = top, 1 = bottom. */
  scrollPage(t: number, animate = false): void {
    const room = PAGE_H * this.sheet.extent - this.h / this.view.zoom
    const v = clampToFrame({ x: this.view.x, y: this.sheet.y + Math.max(0, room) * clamp(t, 0, 1), zoom: this.view.zoom }, this.sheet, this.w, this.h)
    if (animate) this.animateTo(v)
    else this.setView(v)
  }

  /** One more screen of space below this page. */
  extendPage(): boolean {
    if (!this.paged || this.sheet.extent >= MAX_EXTENT) return false
    this.sheet = { ...this.sheet, extent: this.sheet.extent + 1 }
    this.gridKey = ''
    this.scrollPage(1, true)
    this.changed()
    return true
  }

  /** The bottom screen of the page can go when nothing is drawn on it. */
  canShrinkPage(): boolean {
    if (!this.paged || this.sheet.extent <= 1) return false
    const cut = this.sheet.y + PAGE_H * (this.sheet.extent - 1)
    const b = this.doc.bounds()
    return !b || b[3] <= cut
  }

  shrinkPage(): boolean {
    if (!this.canShrinkPage()) return false
    this.sheet = { ...this.sheet, extent: this.sheet.extent - 1 }
    this.gridKey = ''
    this.setView(this.view)
    this.changed()
    return true
  }

  /**
   * Next or previous page with a short slide, the way a notebook page turns. The old page is
   * frozen into one picture that slides off while the new page is already live underneath.
   */
  turnPage(dir: 1 | -1): boolean {
    if (!this.paged) return this.turnFrame(dir)
    const target = this.pageIndex + dir
    if (target < 0 || target >= this.pages.length) return false
    const snap = !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? this.snapshot() : null
    if (!this.goToPage(target)) return false
    if (snap) {
      this.stage.append(snap)
      const anim = snap.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${-dir * 40}%)`, opacity: 0 }],
        { duration: 240, easing: 'cubic-bezier(.3,.7,.3,1)' })
      anim.onfinish = anim.oncancel = () => snap.remove()
    }
    return true
  }

  /** The visible board (background, paper and ink) as one canvas element. */
  private snapshot(): HTMLCanvasElement {
    const cv = document.createElement('canvas')
    cv.width = this.boardCv.width; cv.height = this.boardCv.height
    cv.className = 'cv page-turn'
    cv.style.width = this.w + 'px'; cv.style.height = this.h + 'px'
    const ctx = cv.getContext('2d')!
    ctx.fillStyle = S.bgColor.value
    ctx.fillRect(0, 0, cv.width, cv.height)
    ctx.drawImage(this.gridCv, 0, 0)
    ctx.drawImage(this.boardCv, 0, 0)
    return cv
  }

  /** Page mode: shade what lies beyond the sheet (letterbox on screens that are not 16:9). */
  private paintDesk(): void {
    const ctx = this.gctx, { view, dpr } = this
    const [x0, y0, x1, y1] = frameRect(this.sheet)
    const sx = (x: number): number => (x - view.x) * view.zoom, sy = (y: number): number => (y - view.y) * view.zoom
    const r = [sx(x0), sy(y0), sx(x1), sy(y1)]
    if (r[0] <= 0.5 && r[1] <= 0.5 && r[2] >= this.w - 0.5 && r[3] >= this.h - 0.5) return
    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.beginPath()
    ctx.rect(0, 0, this.w, this.h)
    ctx.rect(r[0], r[1], r[2] - r[0], r[3] - r[1])
    ctx.fillStyle = isDarkBg.value ? 'rgba(0,0,0,.32)' : 'rgba(15,23,42,.07)'
    ctx.fill('evenodd')
    ctx.strokeStyle = isDarkBg.value ? 'rgba(255,255,255,.14)' : 'rgba(15,23,42,.14)'
    ctx.strokeRect(r[0] - .5, r[1] - .5, r[2] - r[0] + 1, r[3] - r[1] + 1)
    ctx.restore()
  }

  /** Picture of notebook page i, or of canvas frame i; paper included. */
  paintPageThumb(i: number, cv: HTMLCanvasElement): void {
    const pages = this.pageData()
    const pg = this.paged ? pages[i] : pages[0]
    const ctx = cv.getContext('2d')
    const f = this.paged ? pg?.frame ?? DEFAULT_FRAME : this.frames[i]
    if (!pg || !ctx || !f) return
    const back = this.paged ? this.pageBackdrop(pg, f) : this.frameBackdrop(this.frames[i])
    const view = { x: f.x, y: f.y, zoom: cv.width / PAGE_W }
    paintBackdrop(ctx, view, cv.width, cv.height, 1, back, true)
    ctx.setTransform(view.zoom, 0, 0, view.zoom, -view.x * view.zoom, -view.y * view.zoom)
    for (const it of pg.items) paintItem(ctx, it, 1, it.t === 'l' ? this.labs.time(it) : undefined)
  }

  // ── prepared reveals ────────────────────────────────────────────────────────
  /** Preparing: hidden objects show faded so they can be arranged. Otherwise they are hidden as in class. */
  setPreparing(on: boolean): void {
    if (S.preparing.value === on) return
    S.preparing.value = on
    setHiddenMode(on ? 'ghost' : 'hide')
    if (!on) this.setSelection(this.selection.filter(it => !concealed(it)))
    this.refresh(null)
    this.requestOverlay()
  }

  /** What the steps apply to: this page, or on a canvas the frame in view (else the whole canvas). */
  private revealScope(): Item[] {
    const f = this.paged ? null : this.frames[S.frameIndex.value]
    if (!f) return this.doc.items
    const r = frameRect(f)
    return this.doc.items.filter(it => { const b = itemBounds(it), x = (b[0] + b[2]) / 2, y = (b[1] + b[3]) / 2; return x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3] })
  }

  revealSteps(): StepInfo[] { return stepsOf(this.revealScope()) }

  /** Replace objects as one undoable edit. */
  private editItems(change: (items: Item[]) => Item[], label: string): boolean {
    const before = this.doc.snapshot()
    this.doc.replaceAll(change(this.doc.items))
    const op = this.doc.diff(before)
    if (!op) return false
    this.commit(op, label)
    this.refresh(null)
    return true
  }

  private showSteps(n: number): boolean {
    const scope = new Set(this.revealScope().map(it => it.id))
    return this.editItems(items => {
      const shown = showStep(items.filter(it => scope.has(it.id)), n)
      const byId = new Map(shown.map(it => [it.id, it]))
      return items.map(it => byId.get(it.id) ?? it)
    }, 'Show the next step')
  }

  /** The next hidden step of what is on screen; false when there is none (a clicker then turns the page). */
  nextReveal(): boolean {
    const next = this.revealSteps().find(s => s.hidden)
    return !!next && this.showSteps(next.n)
  }

  /** A tap on a card standing in for a hidden object shows its step. */
  revealAt(wx: number, wy: number): boolean {
    if (S.preparing.value || S.replaying.value) return false
    for (let i = this.doc.items.length - 1; i >= 0; i--) {
      const it = this.doc.items[i]
      if (!isHidden(it) || !it.step!.cover) continue
      const b = itemBounds(it)
      if (wx >= b[0] && wx <= b[2] && wy >= b[1] && wy <= b[3]) return this.showSteps(it.step!.n)
    }
    return false
  }

  hideReveals(): void {
    const scope = new Set(this.revealScope().map(it => it.id))
    this.editItems(items => {
      const hidden = hideAgain(items.filter(it => scope.has(it.id)))
      const byId = new Map(hidden.map(it => [it.id, it]))
      return items.map(it => byId.get(it.id) ?? it)
    }, 'Hide the steps again')
    this.setSelection(this.selection.filter(it => !concealed(it)))
  }

  /** The selection waits for step `n`. The teacher keeps seeing it, faded, until they finish preparing. */
  assignReveal(n: number, name: string | undefined, cover: boolean): void {
    this.setPreparing(true)
    const chosen = new Set(this.selection)
    const ids = this.selection.map(it => it.id)
    this.editItems(items => assignStep(items, chosen, n, name, cover), 'Hide for class')
    this.setSelection(this.doc.items.filter(it => ids.includes(it.id)))
  }

  clearReveal(): void {
    const chosen = new Set(this.selection)
    const ids = this.selection.map(it => it.id)
    this.editItems(items => clearStep(items, chosen), 'Do not hide')
    this.setSelection(this.doc.items.filter(it => ids.includes(it.id)))
  }

  // ── my shelf ────────────────────────────────────────────────────────────────
  /** The part of the board the teacher can see (on a page, never beyond its edges). */
  visibleRect(): Rect {
    const r: Rect = [this.view.x, this.view.y, this.view.x + this.w / this.view.zoom, this.view.y + this.h / this.view.zoom]
    if (!this.paged) return r
    const f = frameRect(this.sheet)
    return [Math.max(r[0], f[0]), Math.max(r[1], f[1]), Math.min(r[2], f[2]), Math.min(r[3], f[3])]
  }

  /** What is on screen, for a canvas without frames, where there is no page to save. */
  itemsOnScreen(): Item[] {
    const r = this.visibleRect()
    return this.doc.items.filter(it => rectsHit(itemBounds(it), r))
  }

  /**
   * The page, or the canvas frame in view, as it looks now, ready to keep: it spells out the lesson's
   * colour and texture, so it looks the same in any other lesson. null: a canvas with no frame in view.
   */
  pageForShelf(): PageData | null {
    const f = this.paged ? this.sheet : this.frames[S.frameIndex.value]
    if (!f) return null
    const back = this.paged ? this.pageBackdrop(this.look, this.sheet) : this.frameBackdrop(f as LookFrame)
    const title = this.paged ? this.look.title : (f as LookFrame).title
    const items = this.paged ? this.doc.items : this.doc.items.filter(it => rectsHit(itemBounds(it), frameRect(f)))
    const moved = pageAt({ items, frame: { x: f.x, y: f.y, extent: f.extent }, origin: back.origin }, 0, 0)
    return { ...moved, paper: back.paper, color: back.color, texture: back.texture ?? 'none', ...styleLook(back.style), ...(back.art ? { art: back.art } : {}), ...(title ? { title } : {}) }
  }

  /** A saved page in this lesson: a page after this one (taking the place of a blank one), or the next frame. False if a gesture is under way. */
  addSavedPage(pg: PageData): boolean {
    if (this.currentTool().underway()) return false
    const snap = this.structure()
    if (this.paged) {
      if (!this.leavePage()) return false
      const placed = pageAt(pg, 0, 0)
      const here = this.pages[this.pageIndex]
      const blank = !here.items.length && !here.art && !here.title && !here.section && (here.paper ?? 'none') === 'none'
      const at = blank ? this.pageIndex : this.pageIndex + 1
      this.pages.splice(at, blank ? 1 : 0, { ...placed, view: frameView(placed.frame!, this.w, this.h), history: { undo: [], redo: [] } } as PageRec)
      this.showPage(at)
      this.changed({ label: 'Added a saved page', snap })
      return true
    }
    this.commitText()
    const slot = nextFrameSlot(this.frames, this.doc.items)
    const { items, view: _view, frame, ...look } = pageAt(pg, slot.x, slot.y)
    // Not a separate step in the object history: Undo takes the frame and its objects away together.
    this.doc.replaceAll([...this.doc.items, ...items])
    this.frames.push({ ...frame!, ...look })
    this.framesChanged()
    this.goToFrame(this.frames.length - 1, false)
    this.refresh(null)
    this.changed({ label: 'Added a saved frame', snap })
    return true
  }

  /** Saved objects on this page as one undoable edit, selected so they can be moved straight away. False if a gesture is under way. */
  insertSaved(items: Item[]): boolean {
    if (this.currentTool().underway()) return false
    this.commitText()
    this.setTool('select')
    this.addPageContent(items)
    this.setSelection(items)
    return true
  }

  /** Objects, whole and centred, on the board's colour: the picture on a saved item's tile. */
  paintItemsThumb(items: Item[], cv: HTMLCanvasElement): void {
    const ctx = cv.getContext('2d'), b = this.doc.bounds(items)
    if (!ctx || !b) return
    ctx.fillStyle = S.bgColor.value
    ctx.fillRect(0, 0, cv.width, cv.height)
    const k = Math.min(cv.width * .88 / Math.max(1, b[2] - b[0]), cv.height * .88 / Math.max(1, b[3] - b[1]), 1.5)
    ctx.setTransform(k, 0, 0, k, cv.width / 2 - (b[0] + b[2]) / 2 * k, cv.height / 2 - (b[1] + b[3]) / 2 * k)
    for (const it of items) paintItem(ctx, it, 1, it.t === 'l' ? this.labs.time(it) : undefined)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }

  /** The picture of the page or frame in view. */
  paintCurrentThumb(cv: HTMLCanvasElement): void { this.paintPageThumb(this.paged ? this.pageIndex : S.frameIndex.value, cv) }

  /** Add items to the visible page as one undoable edit. */
  addPageContent(items: Item[]): void {
    const before = this.doc.snapshot()
    this.doc.replaceAll([...this.doc.items, ...items])
    this.commit(this.doc.diff(before), 'Insert content')
    this.refresh(null)
  }

  /** Replace the visible page's sheet (page mode) and show its top. */
  setPageFrame(f: Frame): void {
    this.sheet = { ...f }
    this.gridKey = ''
    if (this.paged) this.setView(frameView(this.sheet, this.w, this.h))
    this.changed()
  }

  /** Fit the page's content to the window width (reading a document page). */
  fitPage(): void {
    if (this.paged) return this.setView(frameView(this.sheet, this.w, this.h))
    const b = this.doc.bounds()
    if (!b) return
    const zoom = clamp((this.w - 80) / (b[2] - b[0]), MIN_ZOOM, MAX_ZOOM)
    this.setView({ x: b[0] - (this.w / zoom - (b[2] - b[0])) / 2, y: b[1] - 40 / zoom, zoom })
  }

  /** Every page, with the visible one (and any open text edit) taken live. */
  pageData(): PageData[] {
    const draft = S.editing.value
    const items = draft ? (draft.isNew ? [...this.doc.items, draft.item] : this.doc.items.map(it => it.id === draft.item.id ? draft.item : it)) : this.doc.items
    return this.pages.map((pg, i) => {
      if (i === this.pageIndex) return { ...this.look, items, view: this.view, frame: this.sheet }
      const { history: _h, ...data } = pg
      return data
    })
  }

  private meta(): BoardMeta { return { kind: this.boardKind, frames: this.frames, color: this.lessonColor, texture: this.lessonTexture } }

  /** Portable JSON with pictures embedded. */
  serialize(): string { return serializePages(this.pageData(), this.pageIndex, true, this.meta()).json }

  /** Autosave JSON; pictures are returned separately so each is written to disk once. */
  serializeForStore(): { json: string; assets: Record<string, string> } { return serializePages(this.pageData(), this.pageIndex, false, this.meta()) }

  /**
   * Replace the board with a saved one. A file from before appearance was saved (no colour, no
   * papers) keeps the colour and paper the board has now (`undoable`: opening it on top of this
   * board) or the teacher's last choices (the first load at start-up). With `undoable` the replaced
   * board can be brought back with `undoStructure`.
   */
  load(json: string, opts: { undoable: boolean }): ParsedBoard | null {
    const parsed = parseBoard(json)
    if (!parsed) return null
    if (S.editing.value) this.cancelText()
    const snap = opts.undoable ? this.structure() : null
    this.onPageChange?.()
    this.labs.clear(); this.labDraft.clear(); activeLabId.value = null
    const kind = parsed.kind ?? 'canvas'
    const portable = !!parsed.pages // format 4 carries its own appearance
    const fallbackPaper: Paper = opts.undoable ? this.look.paper ?? 'none' : S.defaultPaper.value
    const fallback = parsed.view ?? this.view
    this.lessonColor = parsed.color ?? (portable || !opts.undoable ? S.defaultColor.value : this.lessonColor)
    // A page-format file says what texture it has ('none' when it has none); older files keep what is here.
    this.lessonTexture = parsed.texture ?? (opts.undoable ? this.lessonTexture : S.defaultTexture.value)
    this.pages = (parsed.pages ?? [{ items: parsed.items, view: parsed.view }]).map((pg: PageData) => ({
      ...pg, paper: pg.paper ?? (portable ? 'none' : fallbackPaper), view: pg.view ?? fallback, history: { undo: [], redo: [] }
    }))
    this.frames = kind === 'canvas' ? (parsed.frames ?? []).map(f => ({ ...f })) : []
    // Decode the background pictures now, so page thumbnails and turning pages show them at once.
    void preloadImages([], [...this.pages, ...this.frames].flatMap(pg => pg.art ? [pg.art.src] : []))
    this.undoSlot = null
    this.setKind(kind)
    this.history.take()
    this.showPage(parsed.page ?? 0)
    this.syncLook(true)
    this.changed(snap ? { label: 'Opened a board', snap } : undefined)
    return parsed
  }

  // ── pictures, equations and graphs ──────────────────────────────────────────
  /** World-space centre of the visible board. */
  viewCentre(): [number, number] { return [this.view.x + this.w / 2 / this.view.zoom, this.view.y + this.h / 2 / this.view.zoom] }

  insertImage(src: string, width: number, height: number, opts: { at?: [number, number]; latex?: string; color?: string; scale?: number } = {}): ImageItem {
    this.commitText()
    const zoom = this.view.zoom
    // Fit within most of the visible board, never enlarging beyond the source size.
    const k = Math.min(opts.scale ?? 1, this.w * .7 / zoom / width, this.h * .7 / zoom / height)
    const w = width * k, h = height * k
    const [cx, cy] = opts.at ?? this.viewCentre()
    const it: ImageItem = { t: 'i', id: newId(), c: opts.color ?? '#111827', w: 1, p: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], src, aspect: width / height }
    if (opts.latex !== undefined) it.latex = opts.latex
    this.setTool('select')
    this.commitAdd(it)
    this.setSelection([it])
    return it
  }

  /** Replace an equation in place, keeping its height and position. */
  replaceEquation(it: ImageItem, src: string, latex: string, width: number, height: number): void {
    const current = this.doc.items.find(x => x.id === it.id)
    if (!current || current.t !== 'i') return
    const h = current.p[3] - current.p[1], w = h * width / height
    this.editSelectionItems([current], () => ({ ...current, src, latex, aspect: width / height, p: [current.p[0], current.p[1], current.p[0] + w, current.p[3]] }), 'Edit equation')
  }

  insertGraph(fns: string[], xr: [number, number] = [-10, 10], yr: [number, number] = [-6, 6]): GraphItem {
    this.commitText()
    const [cx, cy] = this.viewCentre(), w = 560, h = 400
    const it: GraphItem = { t: 'g', id: newId(), c: '#111827', w: 1, p: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], fns, xr, yr }
    this.setTool('select')
    this.commitAdd(it)
    this.setSelection([it])
    return it
  }

  /** A line of typed writing in the middle of the board, selected: an answer from the calculator, say. */
  insertWriting(text: string): void {
    this.commitText()
    const [cx, cy] = this.viewCentre(), size = 44, w = Math.max(160, text.length * size * .58 + 24)
    const it = this.fitItem({ t: 't', id: newId(), c: S.penColor.value, w: 1, p: [cx - w / 2, cy - size, cx + w / 2, cy + size * .6], text, fontSize: size, note: false, fill: 'none' })
    this.setTool('select')
    this.commitAdd(it)
    this.setSelection([it])
  }

  // ── tables ──────────────────────────────────────────────────────────────────
  /** The cell the table's commands act on, the one last tapped; otherwise they act at the end. */
  lastCell: { id: string; r: number; c: number } | null = null
  /** opens the text field on a cell (wired by the UI) */
  onEditCell: ((cell: { id: string; r: number; c: number }) => void) | null = null

  insertTable(rows: number, cols: number, head: boolean): TableItem {
    this.commitText()
    const r = this.visibleRect()
    const it: TableItem = { t: 'b', id: newId(), c: S.penColor.value, w: 2.5, ...newTable(rows, cols, (r[0] + r[2]) / 2, (r[1] + r[3]) / 2 - (r[3] - r[1]) * .04, (r[2] - r[0]) * .86, (r[3] - r[1]) * .76), ...(head ? { head: true } : {}) }
    this.lastCell = null
    this.setTool('select')
    this.commitAdd(it)
    this.setSelection([it])
    return it
  }

  editTableCell(it: TableItem, wx: number, wy: number): void {
    const cell = cellAt(it, wx, wy)
    if (cell) this.openCell(it, cell.r, cell.c)
  }

  openCell(it: TableItem, r: number, c: number): void {
    this.lastCell = { id: it.id, r, c }
    this.onEditCell?.(this.lastCell)
  }

  /** A finished cell: one undo step, and its row grows if the text needs it. */
  setTableCell(id: string, r: number, c: number, text: string): void {
    this.lastCell = { id, r, c }
    this.changeTable(id, it => setCell(it, r, c, text), 'Type in a table')
  }

  private changeTable(id: string, change: (it: TableItem) => TableItem, label: string): void {
    const current = this.doc.items.find(x => x.id === id)
    if (!current || current.t !== 'b') return
    const next = change(current)
    if (next === current) return
    this.editSelectionItems([current], () => this.fitItem(next), label)
  }

  /** Add or remove a row or column of the selected table, at the cell last tapped; a heading row on or off. */
  shapeTable(what: 'add-row' | 'add-col' | 'remove-row' | 'remove-col' | 'head'): void {
    const it = this.selection[0]
    if (this.selection.length !== 1 || !it || it.t !== 'b' || it.locked) return
    const at = this.lastCell?.id === it.id ? this.lastCell : null
    this.changeTable(it.id, t => {
      switch (what) {
        case 'add-row': return t.rows.length < MAX_ROWS ? addRow(t, at?.r) : t
        case 'add-col': return t.cols.length < MAX_COLS ? addCol(t, at?.c) : t
        case 'remove-row': return removeRow(t, at?.r)
        case 'remove-col': return removeCol(t, at?.c)
        case 'head': { const { head, ...rest } = t; return head ? rest : { ...rest, head: true } }
      }
    }, 'Change a table')
    if (at && (what === 'remove-row' || what === 'remove-col')) this.lastCell = null
  }

  /** A number line or axes on this page, selected and ready to move. */
  insertScale(fields: Omit<ScaleItem, 't' | 'id' | 'w'>): ScaleItem {
    this.commitText()
    const it: ScaleItem = { t: 'n', id: newId(), w: 2.5, ...fields }
    this.setTool('select')
    this.commitAdd(it)
    this.setSelection([it])
    return it
  }

  updateScale(it: ScaleItem, patch: Partial<Omit<ScaleItem, 't' | 'id'>>): void {
    const current = this.doc.items.find(x => x.id === it.id)
    if (!current || current.t !== 'n') return
    this.editSelectionItems([current], () => {
      const next = { ...current, ...patch }
      // A setting taken away leaves nothing behind in the file.
      for (const key of ['y', 'equal', 'grid', 'points'] as const) if (next[key] === undefined) delete next[key]
      return next
    }, 'Edit scale')
  }

  updateGraph(it: GraphItem, patch: Partial<Pick<GraphItem, 'fns' | 'xr' | 'yr'>>): void {
    const current = this.doc.items.find(x => x.id === it.id)
    if (!current || current.t !== 'g') return
    this.editSelectionItems([current], () => ({ ...current, ...patch }), 'Edit graph')
  }

  private editSelectionItems(targets: Item[], edit: (it: Item) => Item, label: string): void {
    const before = this.doc.snapshot()
    const set = new Set(targets)
    const map = new Map<Item, Item>()
    this.doc.replaceAll(this.doc.items.map(it => { if (!set.has(it)) return it; const next = edit(it); map.set(it, next); return next }))
    this.setSelection(this.selection.map(it => map.get(it) ?? it))
    const change = this.doc.diff(before)
    if (!change) return
    const op = this.withConnectors(change)
    this.history.push(op)
    this.refresh(opBounds(op))
    this.afterEdit(label)
  }

  // ── output ──────────────────────────────────────────────────────────────────
  /** Whether the export being made shows hidden objects. */
  private exportHidden: 'keep' | 'show' = 'keep'

  /** What "this page" means when saving a picture: a notebook's page, a canvas's whole drawing. */
  get defaultScope(): PictureScope { return this.paged ? 'page' : 'content' }

  /**
   * One PNG per sheet of paper for a PDF. A page lengthened with "more space below" is split into one
   * picture per screen (`split`, the default), so each fills a sheet and stays readable; trailing
   * screens with nothing on them are left out. `split: false` keeps a long page whole.
   * Blank pages are kept, and a notebook whose pages only have paper still prints that paper.
   */
  async exportPages(opts: { split?: boolean; hidden?: 'keep' | 'show'; print?: boolean; scale?: number; cancelled?: () => boolean; onSheet?: (png: ArrayBuffer) => Promise<void> | void } = {}): Promise<ArrayBuffer[]> {
    const split = opts.split ?? true
    const scale = opts.scale ?? 1.5
    const out: ArrayBuffer[] = []
    const pages = this.pageData()
    const render = async (items: Item[], rect: Rect, at: number, back: Backdrop): Promise<void> => {
      if (opts.cancelled?.()) return
      this.exportHidden = opts.hidden ?? 'keep'
      const png = await this.renderRect(items, rect, at, back)
      if (!png) return
      out.push(png)
      await opts.onSheet?.(png)
    }
    const sheet = async (shown: Item[], f: Frame, seen: Backdrop): Promise<void> => {
      const { items, back } = opts.print ? this.printable(shown, seen) : { items: shown, back: seen }
      await preloadImages(items, back.art ? [back.art.src] : [])
      const screens = split ? this.usedScreens(items, f) : 1
      for (let k = 0; k < screens; k++) {
        const rect: Rect = split ? [f.x, f.y + k * PAGE_H, f.x + PAGE_W, f.y + (k + 1) * PAGE_H] : frameRect(f)
        await render(items, rect, scale, back)
      }
    }
    if (!this.paged && this.frames.length) {
      // A framed canvas exports one sheet per frame, in frame order.
      const items = pages[0].items
      if (!items.length && !this.frames.some(f => { const b = this.frameBackdrop(f); return b.paper !== 'none' || b.art })) return out
      for (const f of this.frames) await sheet(items, f, this.frameBackdrop(f))
      return out
    }
    if (this.paged) {
      if (!pages.some(pg => pg.items.length || (pg.paper ?? 'none') !== 'none' || pg.art)) return out
      for (const pg of pages) await sheet(pg.items, pg.frame ?? DEFAULT_FRAME, this.pageBackdrop(pg, pg.frame))
      return out
    }
    const items = pages[0].items
    const b = this.doc.bounds(items)
    if (!b) return out
    const open = opts.print ? this.printable(items, this.surfaceBackdrop()) : { items, back: this.surfaceBackdrop() }
    await preloadImages(open.items, open.back.art ? [open.back.art.src] : [])
    await render(open.items, padRect(b, 48), opts.scale ?? 2, open.back)
    return out
  }

  /**
   * A dark board on white paper, to save toner: the board turns white and ink turns readable on it.
   * The lesson itself is not touched. Light boards print as they are.
   */
  private printable(items: Item[], back: Backdrop): { items: Item[]; back: Backdrop } {
    if (!isDarkColor(back.color)) return { items, back }
    const { texture: _texture, textureAlpha: _alpha, ...plain } = back
    const { lines: _lines, ...style } = back.style // chalk-coloured lines would vanish; the paper's own lines suit white
    return { items: readableOn(items, back.color, '#ffffff', 3), back: { ...plain, color: '#ffffff', style } }
  }

  /** Whether any sheet of this lesson has a dark board, so print-friendly would change something. */
  hasDarkSheets(): boolean {
    if (!this.paged) return this.frames.length ? this.frames.some(f => isDarkColor(this.frameBackdrop(f).color)) : isDarkColor(this.surfaceBackdrop().color)
    return this.pageData().some(pg => isDarkColor(this.pageBackdrop(pg, pg.frame).color))
  }

  /** How many screens of a sheet to print: down to the last one that has something on it. */
  private usedScreens(items: Item[], f: Frame): number {
    let bottom = f.y
    for (const it of items) if (rectsHit(itemBounds(it), frameRect(f))) bottom = Math.max(bottom, itemBounds(it)[3])
    return clamp(Math.ceil((bottom - f.y) / PAGE_H), 1, f.extent)
  }

  /**
   * A picture of the board as a PNG, painted exactly as on screen (paper included; `paper: false`
   * gives ink on a transparent background).
   *  - page: a notebook's page; on a canvas the frame in view, or what is on screen
   *  - content: everything drawn, cropped to it
   *  - selection: the selected objects, cropped to them
   */
  async exportPng(opts: { scope?: PictureScope; paper?: boolean; maxScale?: number; hidden?: 'keep' | 'show' } = {}): Promise<ArrayBuffer | null> {
    const scope = opts.scope ?? this.defaultScope
    this.exportHidden = opts.hidden ?? 'keep'
    const items = scope === 'selection' ? this.selection : this.doc.items
    let rect: Rect, back: Backdrop
    if (scope === 'page') {
      const frame = !this.paged ? this.frames[S.frameIndex.value] : undefined
      if (this.paged) { rect = frameRect(this.sheet); back = this.pageBackdrop(this.look, this.sheet) }
      else if (frame) { rect = frameRect(frame); back = this.frameBackdrop(frame) }
      else { rect = [this.view.x, this.view.y, this.view.x + this.w / this.view.zoom, this.view.y + this.h / this.view.zoom]; back = this.surfaceBackdrop() }
      // an empty page is worth saving only when it has paper or a picture (a printable practice sheet)
      if (!items.length && back.paper === 'none' && !back.art && sameColor(back.color, DEFAULT_BOARD_COLOR)) return null
    } else {
      const b = this.doc.bounds(items)
      if (!b) return null
      rect = padRect(b, 48)
      back = this.paged ? this.pageBackdrop(this.look, this.sheet) : this.surfaceBackdrop()
    }
    await preloadImages(items, back.art && opts.paper !== false ? [back.art.src] : [])
    const longest = Math.max(rect[2] - rect[0], rect[3] - rect[1])
    return this.renderRect(items, rect, Math.min(opts.maxScale ?? 2, 9000 / longest), opts.paper === false ? null : back)
  }

  /** One rectangle of the world as a PNG: its backdrop (null: none), then the objects that touch it. */
  private async renderRect(items: Item[], r: Rect, scale: number, back: Backdrop | null): Promise<ArrayBuffer | null> {
    const cv = document.createElement('canvas')
    cv.width = Math.max(1, Math.round((r[2] - r[0]) * scale)); cv.height = Math.max(1, Math.round((r[3] - r[1]) * scale))
    const ctx = cv.getContext('2d')!
    if (back) paintBackdrop(ctx, { x: r[0], y: r[1], zoom: scale }, cv.width, cv.height, 1, back, true)
    ctx.setTransform(scale, 0, 0, scale, -r[0] * scale, -r[1] * scale)
    // Only for this one synchronous paint, so the classroom screen can never flash a hidden answer.
    setHiddenMode(this.exportHidden === 'show' ? 'show' : 'hide')
    for (const it of items) if (rectsHit(itemBounds(it), r)) paintItem(ctx, it, 1, it.t === 'l' ? this.labs.time(it) : undefined)
    setHiddenMode(S.preparing.value ? 'ghost' : 'hide')
    const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/png'))
    return blob ? await blob.arrayBuffer() : null
  }
}

export type PictureScope = 'page' | 'content' | 'selection'

const padRect = (b: Rect, pad: number): Rect => [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad]
