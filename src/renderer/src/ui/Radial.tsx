import {
  Eraser, Grid3x3, Highlighter, MousePointer2, Pen, Redo2, Trash2, Undo2
} from 'lucide-preact'
import type { JSX } from 'preact'
import { RADIAL, RADIAL_ACTIONS, RADIAL_SIZE, radialState } from '@/engine/radial'
import { RADIAL_COLORS, S, activeTool, currentColor, luminance } from '@/state/store'

const ICONS = { pen: Pen, marker: Highlighter, eraser: Eraser, select: MousePointer2, clear: Trash2, grid: Grid3x3, redo: Redo2, undo: Undo2 }

/** point on a circle; angle in degrees, 0 = top, clockwise */
const pt = (r: number, a: number): [number, number] => {
  const rad = (a * Math.PI) / 180
  return [r * Math.sin(rad), -r * Math.cos(rad)]
}

function sector(r0: number, r1: number, a0: number, a1: number): string {
  const [x0, y0] = pt(r1, a0)
  const [x1, y1] = pt(r1, a1)
  const [x2, y2] = pt(r0, a1)
  const [x3, y3] = pt(r0, a0)
  return `M${x0} ${y0} A${r1} ${r1} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`
}

/** Press-and-hold menu: inner ring = tools & actions, outer ring = quick colours. */
export function Radial(): JSX.Element | null {
  const st = radialState.value
  if (!st) return null
  const gap = 1.6
  const hv = st.hover
  const tool = activeTool.value
  const cur = currentColor.value.toLowerCase()
  const showColor = !['eraser', 'select', 'hand', 'laser'].includes(tool)
  const label =
    hv.kind === 'action' ? RADIAL_ACTIONS[hv.index].label : hv.kind === 'color' ? 'Colour' : ''
  const half = RADIAL_SIZE / 2

  return (
    <svg class="radial ui" width={RADIAL_SIZE} height={RADIAL_SIZE} viewBox={`${-half} ${-half} ${RADIAL_SIZE} ${RADIAL_SIZE}`}
         style={{ left: st.cx - half + 'px', top: st.cy - half + 'px' }}>
      <defs>
        <filter id="rshadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="7" flood-color="#0f172a" flood-opacity="0.28" />
        </filter>
      </defs>
      <g class="radial-in" filter="url(#rshadow)">
        <circle r={RADIAL.in1 + 2.5} fill="rgba(255,255,255,0.94)" />
        {RADIAL_ACTIONS.map((a, i) => {
          const a0 = i * 45 - 22.5 + gap
          const a1 = a0 + 45 - 2 * gap
          const hov = hv.kind === 'action' && hv.index === i
          const active = a.key === tool || (a.key === 'grid' && S.grid.value !== 'none')
          const [ix, iy] = pt((RADIAL.in0 + RADIAL.in1) / 2, i * 45)
          const Icon = ICONS[a.key]
          return (
            <g key={a.key}>
              <path d={sector(RADIAL.in0, RADIAL.in1, a0, a1)} class={`rs ${hov ? 'hov' : ''} ${active ? 'act' : ''}`} />
              <Icon x={ix - 11} y={iy - 11} size={22} strokeWidth={1.8} class={`ri ${hov ? 'hov' : ''} ${active ? 'act' : ''}`} />
            </g>
          )
        })}
        {RADIAL_COLORS.map((c, i) => {
          const a0 = i * 45 - 22.5 + gap
          const a1 = a0 + 45 - 2 * gap
          const hov = hv.kind === 'color' && hv.index === i
          const r1 = RADIAL.out1 + (hov ? 5 : 0)
          const [dx, dy] = pt((RADIAL.out0 + RADIAL.out1) / 2, i * 45)
          const selected = showColor && c.toLowerCase() === cur
          return (
            <g key={c}>
              <path d={sector(RADIAL.out0, r1, a0, a1)} fill={c} stroke={luminance(c) > 0.85 ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.08)'} stroke-width="1" />
              {selected && <circle cx={dx} cy={dy} r="3.4" fill={luminance(c) < 0.7 ? '#fff' : '#1b2030'} />}
            </g>
          )
        })}
        <circle r={RADIAL.hub} fill="#fff" stroke="rgba(20,26,50,0.12)" />
        {label ? (
          <text class="rlabel" text-anchor="middle" dominant-baseline="central">{label}</text>
        ) : showColor ? (
          <>
            <circle r="9" fill={currentColor.value} stroke="rgba(20,26,50,0.25)" />
            <circle r="13" fill="none" stroke="rgba(20,26,50,0.2)" stroke-width="1.3" />
          </>
        ) : (
          <circle r="3" fill="rgba(20,26,50,0.35)" />
        )}
      </g>
    </svg>
  )
}
