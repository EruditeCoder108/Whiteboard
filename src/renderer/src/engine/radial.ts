import { signal } from '@preact/signals'
import { RADIAL_COLORS } from '@/state/store'
import { PEN_CHOICES } from './ink'
import type { PenChoice } from './ink'

/** Geometry of the two-ring radial menu (CSS px, centred on the press point). */
export const RADIAL = { hub: 27, in0: 30, in1: 80, out0: 86, out1: 122 }
/** Pen styles sit above the pen, colours below: fixed places the hand can learn. */
export const STYLE_ANGLES = [-60, -30, 0, 30, 60]
const COLOR_FROM = 96, COLOR_STEP = 24
export const colorAngle = (i: number): number => COLOR_FROM + i * COLOR_STEP
export const RADIAL_SIZE = (RADIAL.out1 + 18) * 2

export type RadialKey = 'pen' | 'marker' | 'eraser' | 'select' | 'shape' | 'text' | 'redo' | 'undo'
/** clockwise from the top */
export const RADIAL_ACTIONS: { key: RadialKey; label: string }[] = [
  { key: 'pen', label: 'Pen' },
  { key: 'marker', label: 'Highlighter' },
  { key: 'eraser', label: 'Eraser' },
  { key: 'select', label: 'Select' },
  { key: 'shape', label: 'Shapes' },
  { key: 'text', label: 'Text' },
  { key: 'redo', label: 'Redo' },
  { key: 'undo', label: 'Undo' }
]

export type RadialHover =
  | { kind: 'none' }
  | { kind: 'hub' }
  | { kind: 'action'; index: number }
  | { kind: 'color'; index: number }
  | { kind: 'style'; index: number }

export type RadialPick = { kind: 'action'; key: RadialKey } | { kind: 'color'; color: string } | { kind: 'style'; style: PenChoice }

export function hitRadial(dx: number, dy: number): RadialHover {
  const d = Math.hypot(dx, dy)
  // angle 0 = top, clockwise; slices are centred on 0°, 45°, …
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI + 90 + 22.5
  const index = Math.floor((((ang % 360) + 360) % 360) / 45) % 8
  if (d < RADIAL.in0 - 2) return { kind: 'hub' }
  if (d <= RADIAL.in1 + 2) return { kind: 'action', index }
  if (d < RADIAL.out0 - 4 || d > RADIAL.out1 + 14) return { kind: 'none' }
  // angle from the top, -180 to 180, clockwise positive
  const from = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 540) % 360 - 180
  if (Math.abs(from) <= 76) return { kind: 'style', index: Math.max(0, Math.min(4, Math.round((from + 60) / 30))) }
  const around = (from + 360) % 360
  if (around >= COLOR_FROM - 14 && around <= colorAngle(7) + 14) return { kind: 'color', index: Math.max(0, Math.min(7, Math.round((around - COLOR_FROM) / COLOR_STEP))) }
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
    if (s.hover.kind === 'style') return { kind: 'style', style: PEN_CHOICES[s.hover.index].id }
    return null
  },

  cancel(): void {
    radialState.value = null
  }
}
