import { computed, effect, signal } from '@preact/signals'
import type { ShapeKind, Item, EditableItem } from '@/engine/types'
import type { SaveResult } from '@shared/api'
import type { SaveStatus } from './autosave'

export type ToolName = 'select' | 'lasso' | 'text' | 'sticky' | 'hand' | 'pen' | 'marker' | 'eraser' | 'laser' | ShapeKind
export type EraserMode = 'stroke' | 'pixel'
import { PAPERS } from '@/engine/grid'
import type { Paper } from '@/engine/grid'
import { isBoardColor, isDarkColor, luminance } from '@/engine/colour'
export { luminance } from '@/engine/colour'
/** the visible page's background paper */
export type GridMode = Paper
/** board: big classroom touch panel (bottom toolbar, pages); laptop: compact side dock */
export type Layout = 'board' | 'laptop'
export type BarSide = 'left' | 'center' | 'right'
export type { BoardKind } from '@/engine/pages'
export type PopoverName = 'props' | 'shapes' | 'menu' | 'settings' | 'help' | 'recovery' | 'agent' | 'replay' | 'science' | 'insert' | 'equation' | 'graph' | 'maths' | 'present' | 'board-menu' | 'pages' | 'paper' | 'subjects' | 'lessons' | 'export' | null

export const SHAPE_TOOLS: ShapeKind[] = ['line', 'arrow', 'rect', 'ellipse', 'diamond', 'triangle']
export const isShapeTool = (t: ToolName): t is ShapeKind => (SHAPE_TOOLS as string[]).includes(t)

export const PALETTE = [
  '#111827', '#6b7280', '#e5484d', '#f28c28', '#f5c518', '#2fa66a',
  '#14b8c4', '#2f6bff', '#8a4fff', '#ec4899', '#ffffff'
]
export const RADIAL_COLORS = [
  '#111827', '#e5484d', '#f28c28', '#f5c518', '#2fa66a', '#2f6bff', '#8a4fff', '#ffffff'
]
export const BACKGROUNDS: { color: string; name: string }[] = [
  { color: '#ffffff', name: 'White' },
  { color: '#fbf6e9', name: 'Paper' },
  { color: '#eef1f6', name: 'Cool gray' },
  { color: '#1f232b', name: 'Blackboard' },
  { color: '#1d3b33', name: 'Green board' }
]

export const SIZE_RANGE = {
  pen: [1, 30],
  marker: [6, 60],
  eraser: [6, 100]
} as const

// ── persisted settings ────────────────────────────────────────────────────────
export const S = {
  tool: signal<ToolName>('pen'),
  lastShape: signal<ShapeKind>('line'),
  penColor: signal('#111827'),
  penSize: signal(3),
  markerColor: signal('#f5c518'),
  markerSize: signal(20),
  eraserSize: signal(28),
  eraserMode: signal<EraserMode>('stroke'),
  /** Where the colour and paper of a new lesson come from: the teacher's last choice. */
  defaultPaper: signal<GridMode>('none'),
  defaultColor: signal('#ffffff'),
  /** board opacity, percent */
  bgAlpha: signal(96),
  smoothing: signal(4),
  pressure: signal(true),
  fingerDraw: signal(true),
  onTop: signal(true),
  radialEnabled: signal(true),
  radialDelay: signal(450),
  layout: signal<Layout>('board'),
  /** false until the first-launch "smart board or laptop?" question is answered */
  layoutChosen: signal(false),
  barSide: signal<BarSide>('center'),
  /** a touch at least this wide (CSS px) is a palm and erases */
  palmErase: signal(true),
  palmSize: signal(60),

  // ── transient ───────────────────────────────────────────────────────────────
  /** The visible page's paper and board colour. They belong to the lesson (see Board), not to settings. */
  grid: signal<GridMode>('none'),
  bgColor: signal('#ffffff'),
  /** The paper and colour of the page or canvas frame in view, and which of the two it is (null: the canvas itself). */
  here: signal<{ paper: GridMode; color: string; unit: 'page' | 'frame' | null }>({ paper: 'none', color: '#ffffff', unit: null }),
  /** Counts every change to the lesson; compared with the count at the last save to tell if it is saved. */
  contentRevision: signal(0),
  /** What the undo for the last page or board change would restore ('' when there is none). */
  undoLabel: signal(''),
  /** set while the pen's eraser end / barrel button is active */
  override: signal<ToolName | null>(null),
  /** the board's kind (it lives in the board file, not in settings) */
  kind: signal<'notebook' | 'canvas'>('canvas'),
  /** canvas frames: how many, and which one is on screen (-1: between frames) */
  frameCount: signal(0),
  frameIndex: signal(-1),
  /** contact width (px) of the palm currently erasing; 0 when none */
  palm: signal(0),
  uiHidden: signal(false),
  passthrough: signal(false),
  fullscreen: signal(false),
  zoomed: signal(false),
  zoom: signal(1),
  canUndo: signal(false),
  canRedo: signal(false),
  selectionCount: signal(0),
  selection: signal<Item[]>([]),
  editing: signal<{ item: EditableItem; isNew: boolean } | null>(null),
  viewRevision: signal(0),
  page: signal(0),
  pageCount: signal(1),
  documentRevision: signal(0),
  gestureActive: signal(false),
  replaying: signal(false),
  selectionColor: signal<string | null>(null),
  selectionWidth: signal<number | null>(null),
  popover: signal<PopoverName>(null),
  ready: signal(false),
  closing: signal(false),
  saveStatus: signal<SaveStatus>('saved'),
  saveError: signal(''),
  settingsError: signal(''),
  retrySave: signal<(() => Promise<void>) | null>(null)
}

export const boardMode = computed(() => S.layout.value === 'board')

export const activeTool = computed<ToolName>(() => S.override.value ?? S.tool.value)

/** which colour/size family the active tool edits */
export type StyleKey = 'pen' | 'marker' | 'eraser'
export const styleKey = computed<StyleKey>(() => {
  const t = activeTool.value
  return t === 'marker' ? 'marker' : t === 'eraser' ? 'eraser' : 'pen'
})

export const currentColor = computed(() =>
  styleKey.value === 'marker' ? S.markerColor.value : S.penColor.value
)
export const currentSize = computed(() =>
  styleKey.value === 'marker' ? S.markerSize.value : styleKey.value === 'eraser' ? S.eraserSize.value : S.penSize.value
)

export const isDarkBg = computed(() => isDarkColor(S.bgColor.value))

/** New ink must stay readable on the board: white chalk on a dark board, dark ink on a light one. */
export function keepInkReadable(): void {
  const L = luminance(S.penColor.value)
  if (isDarkBg.value && L < 0.2) S.penColor.value = '#ffffff'
  else if (!isDarkBg.value && L > 0.85) S.penColor.value = '#111827'
}

// ── toasts ────────────────────────────────────────────────────────────────────
export interface ToastAction { label: string; run: () => void }
export const toast = signal<{ id: number; text: string; action?: ToastAction } | null>(null)
let toastId = 0
let toastTimer: number | undefined
/** A short message; with `action` it carries one button (Undo) that stays tappable as long as the message is up. */
export function showToast(text: string, ms = 2200, action?: ToastAction): void {
  toast.value = { id: ++toastId, text, action }
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toast.value = null), ms)
}

// ── persistence ───────────────────────────────────────────────────────────────
const PERSISTED = [
  'tool', 'lastShape', 'penColor', 'penSize', 'markerColor', 'markerSize', 'eraserSize',
  'eraserMode', 'defaultPaper', 'defaultColor', 'bgAlpha', 'smoothing', 'pressure', 'fingerDraw', 'onTop',
  'radialEnabled', 'radialDelay', 'layout', 'layoutChosen', 'barSide', 'palmErase', 'palmSize'
] as const

export function snapshotSettings(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of PERSISTED) out[k] = S[k].value
  return out
}

export function applySettings(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const o = { ...(raw as Record<string, unknown>) }
  // Settings from before lessons kept their own look: the old board colour and paper become the defaults.
  if (!('defaultColor' in o) && 'bgColor' in o) o.defaultColor = o.bgColor
  if (!('defaultPaper' in o) && 'grid' in o) o.defaultPaper = o.grid
  for (const k of PERSISTED) {
    if (!(k in o)) continue
    const sig = S[k] as unknown as { value: unknown }
    const value = o[k]
    if (typeof value !== typeof sig.value) continue
    const enums: Partial<Record<typeof PERSISTED[number], readonly string[]>> = {
      tool: ['select', 'lasso', 'text', 'sticky', 'hand', 'pen', 'marker', 'eraser', 'laser', ...SHAPE_TOOLS],
      lastShape: SHAPE_TOOLS, eraserMode: ['stroke', 'pixel'], defaultPaper: PAPERS,
      layout: ['board', 'laptop'], barSide: ['left', 'center', 'right']
    }
    if (enums[k] && !enums[k]!.includes(value as string)) continue
    if (['penColor', 'markerColor', 'defaultColor'].includes(k) && !isBoardColor(value)) continue
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) continue
      const ranges: Partial<Record<typeof PERSISTED[number], readonly [number, number]>> = {
        penSize: SIZE_RANGE.pen, markerSize: SIZE_RANGE.marker, eraserSize: SIZE_RANGE.eraser,
        bgAlpha: [0, 100], smoothing: [0, 10], radialDelay: [300, 1500], palmSize: [12, 400]
      }
      const range = ranges[k]
      sig.value = range ? Math.max(range[0], Math.min(range[1], Math.round(value))) : value
    } else sig.value = value
  }
}

export function startPersisting(save: (data: unknown) => Promise<SaveResult>): { flush: () => Promise<boolean>; dispose: () => void } {
  let timer: number | undefined
  let revision = 0
  const write = async (): Promise<boolean> => {
    const sent = revision
    try {
      const result = await save(snapshotSettings())
      if (sent === revision) S.settingsError.value = result.ok ? '' : result.error
      return result.ok
    } catch (error) {
      if (sent === revision) S.settingsError.value = error instanceof Error ? error.message : 'Could not save settings'
      return false
    }
  }
  const stop = effect(() => {
    snapshotSettings() // subscribes to every persisted signal
    revision++
    window.clearTimeout(timer)
    timer = window.setTimeout(() => { void write() }, 500)
  })
  return {
    flush: () => { window.clearTimeout(timer); return write() },
    dispose: () => { window.clearTimeout(timer); stop() }
  }
}
