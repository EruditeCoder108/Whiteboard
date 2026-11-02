import { computed, effect, signal } from '@preact/signals'
import type { ShapeKind, Item, EditableItem } from '@/engine/types'
import type { SaveResult } from '@shared/api'
import type { SaveStatus } from './autosave'

export type ToolName = 'select' | 'lasso' | 'text' | 'sticky' | 'hand' | 'pen' | 'marker' | 'eraser' | 'laser' | ShapeKind
export type EraserMode = 'stroke' | 'pixel'
import { PAPERS, PRESET, SPACING_RANGE, STRENGTH_RANGE } from '@/engine/grid'
import type { Paper, PaperStyle } from '@/engine/grid'
import type { Artwork } from '@/engine/pages'
import { TEXTURES } from '@/engine/texture'
import type { Texture } from '@/engine/texture'
import { isBoardColor, isDarkColor, luminance } from '@/engine/colour'
import type { PenChoice } from '@/engine/ink'
import { INPUT_ROLES } from '@/engine/roles'
import type { InputRole } from '@/engine/roles'
export { luminance } from '@/engine/colour'
/** the visible page's background paper */
export type GridMode = Paper
export type BarSide = 'left' | 'center' | 'right'
export type { BoardKind } from '@/engine/pages'
export type PopoverName = 'props' | 'shapes' | 'settings' | 'help' | 'recovery' | 'agent' | 'replay' | 'science' | 'equation' | 'graph' | 'maths' | 'board-menu' | 'pages' | 'paper' | 'subjects' | 'lessons' | 'new-lesson' | 'export' | 'shelf' | 'shelf-save' | 'scale' | 'export-preview' | 'periodic' | 'table' | 'inputs' | 'templates' | 'crop' | 'zones' | 'poll' | 'recognize' | 'select-tools' | null

export const SHAPE_TOOLS: ShapeKind[] = ['line', 'arrow', 'rect', 'ellipse', 'diamond', 'triangle']
export const isShapeTool = (t: ToolName): t is ShapeKind => (SHAPE_TOOLS as string[]).includes(t)

export const PALETTE = [
  '#111827', '#6b7280', '#e5484d', '#f28c28', '#f5c518', '#2fa66a',
  '#14b8c4', '#2f6bff', '#8a4fff', '#ec4899', '#ffffff'
]
export const RADIAL_COLORS = [
  '#111827', '#e5484d', '#f28c28', '#f5c518', '#2fa66a', '#2f6bff', '#8a4fff', '#ffffff'
]
/** What the paper picker shows and edits: the page or frame in view, as it is painted. */
export interface Here { paper: GridMode; color: string; texture: Texture; unit: 'page' | 'frame' | null; style: PaperStyle; art: Artwork | null }

/**
 * Ready-made board surfaces: a colour with a texture. The texture only lightens and darkens, so it also
 * works on a colour of the teacher's own.
 */
export const SURFACES: { name: string; color: string; texture: Texture }[] = [
  { name: 'Whiteboard', color: '#ffffff', texture: 'none' },
  { name: 'Chalkboard', color: '#262a2e', texture: 'chalk' },
  { name: 'Green board', color: '#22423a', texture: 'chalk' },
  { name: 'Slate', color: '#353b42', texture: 'slate' },
  { name: 'Navy board', color: '#1f2a3f', texture: 'chalk' },
  { name: 'Paper', color: '#f8f3e6', texture: 'paper' },
  { name: 'Brown paper', color: '#d8c3a0', texture: 'paper' },
  { name: 'Cool grey', color: '#eef1f6', texture: 'none' }
]

/** How the paper of a new lesson is drawn. */
export const defaultStyle = (): PaperStyle => ({ spacing: S.defaultSpacing.value, strength: S.defaultStrength.value, ...(S.defaultLines.value ? { lines: S.defaultLines.value } : {}) })


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
  penStyle: signal<PenChoice>('pen'),
  markerColor: signal('#f5c518'),
  markerSize: signal(20),
  eraserSize: signal(28),
  eraserMode: signal<EraserMode>('stroke'),
  /** Where the colour and paper of a new lesson come from: the teacher's last choice. */
  defaultPaper: signal<GridMode>('none'),
  defaultColor: signal('#ffffff'),
  defaultTexture: signal<Texture>('none'),
  /** …and how its paper is drawn (1 = the preset; '' = the usual line colour) */
  defaultSpacing: signal(1),
  defaultStrength: signal(1),
  defaultLines: signal(''),
  /** the app opens full screen unless it was last left in a window */
  windowed: signal(false),
  smoothing: signal(4),
  pressure: signal(true),
  fingerDraw: signal(true),
  onTop: signal(true),
  radialEnabled: signal(true),
  radialDelay: signal(450),
  barSide: signal<BarSide>('center'),
  /** a touch at least this wide (CSS px) is a palm and erases */
  palmErase: signal(true),
  palmSize: signal(60),
  /** a tool per input (roles.ts): each one's tool and colour, and the contact sizes that tell them apart (0: not measured) */
  tipRole: signal<InputRole>('same'),
  thickRole: signal<InputRole>('same'),
  fingerRole: signal<InputRole>('same'),
  tipInk: signal('#2f6bff'),
  thickInk: signal('#e5484d'),
  fingerInk: signal('#2fa66a'),
  tipMax: signal(0),
  thickMax: signal(0),
  /** the name picker's list and class size stay on this computer */
  pickerNames: signal(''),
  pickerMax: signal(40),

  // ── transient ───────────────────────────────────────────────────────────────
  /** how solid the window is: 100, or next to nothing while writing on the screen */
  bgAlpha: signal(100),
  /** writing over whatever is on the screen: the board has gone and only a small bar remains */
  screenMode: signal(false),
  /** The visible page's paper and board colour. They belong to the lesson (see Board), not to settings. */
  grid: signal<GridMode>('none'),
  bgColor: signal('#ffffff'),
  /** The look of the page or canvas frame in view, and which of the two it is (null: the canvas itself). */
  here: signal<Here>({ paper: 'none', color: '#ffffff', texture: 'none', unit: null, style: { ...PRESET }, art: null }),
  /** Counts every change to the lesson; compared with the count at the last save to tell if it is saved. */
  contentRevision: signal(0),
  /** What the undo for the last page or board change would restore ('' when there is none). */
  undoLabel: signal(''),
  /** set while the pen's eraser end / barrel button is active */
  override: signal<ToolName | null>(null),
  /** the ink colour of the input now writing, when it has its own (see roles.ts) */
  inkOverride: signal<string | null>(null),
  /** the board's kind (it lives in the board file, not in settings) */
  kind: signal<'notebook' | 'canvas'>('canvas'),
  /** canvas frames: how many, and which one is on screen (-1: between frames) */
  frameCount: signal(0),
  frameIndex: signal(-1),
  /** students at the board: how many sides (1 = one shared board; 0 = off), and each side's ink and tool */
  zones: signal(0),
  zoneInks: signal<string[]>([]),
  zoneChoices: signal<string[]>([]),
  zoneTools: signal<('pen' | 'eraser')[]>([]),
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
  /** the app's own look: light, dark, or following the board */
  uiTheme: signal<'auto' | 'light' | 'dark'>('auto'),
  /** which set of icons the app wears */
  iconPack: signal<'pictures' | 'modern' | 'plain'>('pictures'),
  popover: signal<PopoverName>(null),
  /** prepared reveals: hidden objects show faded so they can be arranged (never saved: class mode is the default) */
  preparing: signal(false),
  ready: signal(false),
  closing: signal(false),
  saveStatus: signal<SaveStatus>('saved'),
  saveError: signal(''),
  settingsError: signal(''),
  retrySave: signal<(() => Promise<void>) | null>(null)
}

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
/** Whether the app's toolbars, menus and sheets are dark. On Auto they follow the board, so they never glare on a chalkboard. */
export const darkUi = computed(() => S.uiTheme.value === 'dark' || (S.uiTheme.value === 'auto' && isDarkBg.value))

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
  'tool', 'lastShape', 'penColor', 'penSize', 'penStyle', 'markerColor', 'markerSize', 'eraserSize',
  'eraserMode', 'defaultPaper', 'defaultColor', 'defaultTexture', 'defaultSpacing', 'defaultStrength', 'defaultLines', 'windowed', 'smoothing', 'pressure', 'fingerDraw', 'onTop',
  'radialEnabled', 'radialDelay', 'iconPack', 'barSide', 'palmErase', 'palmSize', 'tipRole', 'thickRole', 'fingerRole', 'tipInk', 'thickInk', 'fingerInk', 'tipMax', 'thickMax', 'pickerNames', 'pickerMax', 'uiTheme'
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
      lastShape: SHAPE_TOOLS, penStyle: ['pen', 'pencil', 'brush', 'chalk', 'felt'], eraserMode: ['stroke', 'pixel'], defaultPaper: PAPERS, defaultTexture: TEXTURES,
      barSide: ['left', 'center', 'right'], uiTheme: ['auto', 'light', 'dark'], iconPack: ['pictures', 'modern', 'plain'],
      tipRole: INPUT_ROLES, thickRole: INPUT_ROLES, fingerRole: INPUT_ROLES
    }
    if (enums[k] && !enums[k]!.includes(value as string)) continue
    if (['penColor', 'markerColor', 'defaultColor', 'tipInk', 'thickInk', 'fingerInk'].includes(k) && !isBoardColor(value)) continue
    if (k === 'defaultLines' && value !== '' && !isBoardColor(value)) continue
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) continue
      // paper settings are fractions, kept within what the paper can draw
      const fractional: Partial<Record<typeof PERSISTED[number], readonly [number, number]>> = { defaultSpacing: SPACING_RANGE, defaultStrength: STRENGTH_RANGE }
      const f = fractional[k]
      if (f) { sig.value = Math.max(f[0], Math.min(f[1], value)); continue }
      const ranges: Partial<Record<typeof PERSISTED[number], readonly [number, number]>> = {
        penSize: SIZE_RANGE.pen, markerSize: SIZE_RANGE.marker, eraserSize: SIZE_RANGE.eraser,
        smoothing: [0, 10], radialDelay: [300, 1500], palmSize: [12, 400], tipMax: [0, 400], thickMax: [0, 400], pickerMax: [2, 200]
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
