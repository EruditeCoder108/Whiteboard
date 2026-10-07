import { computed, effect, signal } from '@preact/signals'
import type { ShapeKind, Item, EditableItem } from '@/engine/types'
import type { SaveResult } from '@shared/api'
import type { SaveStatus } from './autosave'

export type ToolName = 'select' | 'lasso' | 'text' | 'sticky' | 'hand' | 'pen' | 'marker' | 'eraser' | 'laser' | ShapeKind
export type EraserMode = 'stroke' | 'pixel'
export type GridMode = 'none' | 'dots' | 'lines'
export type PopoverName = 'props' | 'shapes' | 'menu' | 'settings' | 'help' | 'recovery' | 'agent' | 'replay' | null

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
  grid: signal<GridMode>('none'),
  bgColor: signal('#ffffff'),
  /** board opacity, percent */
  bgAlpha: signal(96),
  smoothing: signal(4),
  pressure: signal(true),
  fingerDraw: signal(true),
  onTop: signal(true),
  radialEnabled: signal(true),
  radialDelay: signal(450),

  // ── transient ───────────────────────────────────────────────────────────────
  /** set while the pen's eraser end / barrel button is active */
  override: signal<ToolName | null>(null),
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

export const luminance = (hex: string): number => {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}
export const isDarkBg = computed(() => luminance(S.bgColor.value) < 0.45)

// ── toasts ────────────────────────────────────────────────────────────────────
export const toast = signal<{ id: number; text: string } | null>(null)
let toastId = 0
let toastTimer: number | undefined
export function showToast(text: string, ms = 2200): void {
  toast.value = { id: ++toastId, text }
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toast.value = null), ms)
}

// ── persistence ───────────────────────────────────────────────────────────────
const PERSISTED = [
  'tool', 'lastShape', 'penColor', 'penSize', 'markerColor', 'markerSize', 'eraserSize',
  'eraserMode', 'grid', 'bgColor', 'bgAlpha', 'smoothing', 'pressure', 'fingerDraw', 'onTop',
  'radialEnabled', 'radialDelay'
] as const

export function snapshotSettings(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of PERSISTED) out[k] = S[k].value
  return out
}

export function applySettings(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const o = raw as Record<string, unknown>
  for (const k of PERSISTED) {
    if (!(k in o)) continue
    const sig = S[k] as unknown as { value: unknown }
    const value = o[k]
    if (typeof value !== typeof sig.value) continue
    const enums: Partial<Record<typeof PERSISTED[number], readonly string[]>> = {
      tool: ['select', 'lasso', 'text', 'sticky', 'hand', 'pen', 'marker', 'eraser', 'laser', ...SHAPE_TOOLS],
      lastShape: SHAPE_TOOLS, eraserMode: ['stroke', 'pixel'], grid: ['none', 'dots', 'lines']
    }
    if (enums[k] && !enums[k]!.includes(value as string)) continue
    if (['penColor', 'markerColor', 'bgColor'].includes(k) && !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value as string)) continue
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) continue
      const ranges: Partial<Record<typeof PERSISTED[number], readonly [number, number]>> = {
        penSize: SIZE_RANGE.pen, markerSize: SIZE_RANGE.marker, eraserSize: SIZE_RANGE.eraser,
        bgAlpha: [0, 100], smoothing: [0, 10], radialDelay: [300, 1500]
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
