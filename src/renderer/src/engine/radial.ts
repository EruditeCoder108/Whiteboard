import { signal } from '@preact/signals'
import { RADIAL_COLORS } from '@/state/store'

/** Geometry of the two-ring radial menu (CSS px, centred on the press point). */
export const RADIAL = { hub: 30, in0: 34, in1: 84, out0: 88, out1: 112 }
export const RADIAL_SIZE = (RADIAL.out1 + 18) * 2

export type RadialKey = 'pen' | 'marker' | 'eraser' | 'select' | 'clear' | 'grid' | 'redo' | 'undo'
/** clockwise from the top */
export const RADIAL_ACTIONS: { key: RadialKey; label: string }[] = [
  { key: 'pen', label: 'Pen' },
  { key: 'marker', label: 'Highlighter' },
  { key: 'eraser', label: 'Eraser' },
  { key: 'select', label: 'Select' },
  { key: 'clear', label: 'Clear board' },
  { key: 'grid', label: 'Grid' },
  { key: 'redo', label: 'Redo' },
  { key: 'undo', label: 'Undo' }
]

export type RadialHover =
  | { kind: 'none' }
  | { kind: 'hub' }
  | { kind: 'action'; index: number }
  | { kind: 'color'; index: number }

export type RadialPick = { kind: 'action'; key: RadialKey } | { kind: 'color'; color: string }

export function hitRadial(dx: number, dy: number): RadialHover {
  const d = Math.hypot(dx, dy)
  // angle 0 = top, clockwise; slices are centred on 0°, 45°, …
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI + 90 + 22.5
  const index = Math.floor((((ang % 360) + 360) % 360) / 45) % 8
  if (d < RADIAL.in0 - 2) return { kind: 'hub' }
  if (d <= RADIAL.in1 + 2) return { kind: 'action', index }
  if (d >= RADIAL.out0 - 2 && d <= RADIAL.out1 + 8) return { kind: 'color', index }
  return { kind: 'none' }
}

export interface RadialState {
  /** menu centre, CSS px in window coordinates */
  cx: number
  cy: number
  hover: RadialHover
  /** the pointer has moved far enough that a release means "pick" */
  armed: boolean
}

export const radialState = signal<RadialState | null>(null)

let press: { x: number; y: number } = { x: 0, y: 0 }

export const radial = {
  get isOpen(): boolean {
    return radialState.peek() !== null
  },

  /** (x, y) = pointer position in window coordinates. Keeps the whole menu on-screen. */
  open(x: number, y: number): void {
    const half = RADIAL_SIZE / 2
    const cx = Math.min(Math.max(x, half), Math.max(half, window.innerWidth - half))
    const cy = Math.min(Math.max(y, half), Math.max(half, window.innerHeight - half))
    press = { x, y }
    radialState.value = { cx, cy, hover: hitRadial(x - cx, y - cy), armed: cx === x && cy === y }
  },

  move(x: number, y: number): void {
    const s = radialState.peek()
    if (!s) return
    const armed = s.armed || Math.hypot(x - press.x, y - press.y) > 12
    radialState.value = { ...s, armed, hover: hitRadial(x - s.cx, y - s.cy) }
  },

  /** close the menu and report what was chosen (null = cancelled) */
  release(): RadialPick | null {
    const s = radialState.peek()
    radialState.value = null
    if (!s || !s.armed) return null
    if (s.hover.kind === 'action') return { kind: 'action', key: RADIAL_ACTIONS[s.hover.index].key }
    if (s.hover.kind === 'color') return { kind: 'color', color: RADIAL_COLORS[s.hover.index] }
    return null
  },

  cancel(): void {
    radialState.value = null
  }
}
