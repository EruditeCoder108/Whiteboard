import type { JSX } from 'preact'
import { PEN_CHOICES } from '@/engine/ink'
import { RADIAL, RADIAL_ACTIONS, RADIAL_SIZE, STYLE_ANGLES, colorAngle, radialState } from '@/engine/radial'
import { RADIAL_COLORS, S, activeTool, currentColor, isShapeTool, luminance } from '@/state/store'
import { Eraser, Highlighter, MousePointer2, Paintbrush, Pen, Pencil, PenTool, Redo2, Shapes, SquarePen, Type, Undo2, artUrl } from './icons'

/** Which picture stands for each tool and pen style. */
const PICTURE: Record<string, string> = { pen: 'pen', marker: 'highlighter', eraser: 'eraser', select: 'select', shape: 'shapes', text: 'text' }
const STYLE_PICTURE: Record<string, string> = { pen: 'pen', pencil: 'pencil', brush: 'paintbrush', chalk: 'chalk', felt: 'felt-marker' }

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

/** The same tools for a pack without pictures. The x and y props keep each one drawn in the ring's own coordinates. */
const MARKS: Record<string, typeof Pen> = { pen: Pen, highlighter: Highlighter, eraser: Eraser, select: MousePointer2, shapes: Shapes, text: Type, pencil: Pencil, paintbrush: Paintbrush, chalk: SquarePen, 'felt-marker': PenTool }

function Picture({ name, x, y, size }: { name: string; x: number; y: number; size: number }): JSX.Element | null {
  const href = artUrl(name)
  if (href) return <image href={href} x={x - size / 2} y={y - size / 2} width={size} height={size} />
  const Mark = MARKS[name]
  return Mark ? <Mark x={x - size * .35} y={y - size * .35} size={size * .7} /> : null
}

/**
 * Press and hold anywhere: tools in the middle ring, pen styles above them, colours below.
 * Everything stays in the same place each time, so the hand soon learns it. Nothing here can lose work:
 * clearing the board is not a flick away.
 */
export function Radial(): JSX.Element | null {
  const st = radialState.value
  if (!st) return null
  const hv = st.hover
  const tool = activeTool.value
  const cur = currentColor.value.toLowerCase()
  const half = RADIAL_SIZE / 2
  const gap = 1.4
  const dot = (RADIAL.out0 + RADIAL.out1) / 2
  const label = hv.kind === 'action' ? RADIAL_ACTIONS[hv.index].label : hv.kind === 'style' ? PEN_CHOICES[hv.index].label : hv.kind === 'color' ? 'Colour' : ''
  const inHand = (key: string): boolean => key === tool || (key === 'shape' && isShapeTool(tool))
  const hub = tool === 'pen' ? STYLE_PICTURE[S.penStyle.value] : PICTURE[isShapeTool(tool) ? 'shape' : tool] ?? ''
  return (
    <svg class="radial ui" width={RADIAL_SIZE} height={RADIAL_SIZE} viewBox={`${-half} ${-half} ${RADIAL_SIZE} ${RADIAL_SIZE}`}
      style={{ left: st.cx - half + 'px', top: st.cy - half + 'px' }}>
      <defs>
        <filter id="rshadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="4" stdDeviation="9" flood-color="#0f172a" flood-opacity="0.3" />
        </filter>
      </defs>
      <g class="radial-in">
        <circle class="rdisc" r={RADIAL.out1 + 4} filter="url(#rshadow)" />
        {RADIAL_ACTIONS.map((a, i) => {
          const a0 = i * 45 - 22.5 + gap, a1 = a0 + 45 - 2 * gap
          const [ix, iy] = pt((RADIAL.in0 + RADIAL.in1) / 2, i * 45)
          const hov = hv.kind === 'action' && hv.index === i
          const Mark = a.key === 'undo' ? Undo2 : a.key === 'redo' ? Redo2 : null
          return (
            <g key={a.key}>
              <path d={sector(RADIAL.in0, RADIAL.in1, a0, a1)} class={`rs ${hov ? 'hov' : ''} ${inHand(a.key) ? 'act' : ''}`} />
              {Mark
                ? <Mark x={ix - 12} y={iy - 12} size={24} strokeWidth={2} class={`ri ${(a.key === 'undo' ? S.canUndo.value : S.canRedo.value) ? '' : 'off'}`} />
                : <Picture name={PICTURE[a.key]} x={ix} y={iy} size={hov ? 40 : 36} />}
            </g>
          )
        })}
        {PEN_CHOICES.map((c, i) => {
          const [x, y] = pt(dot, STYLE_ANGLES[i])
          const hov = hv.kind === 'style' && hv.index === i
          const on = S.penStyle.value === c.id
          return (
            <g key={c.id}>
              <circle cx={x} cy={y} r={hov ? 20 : 17} class={`rstyle ${on ? 'act' : ''} ${hov ? 'hov' : ''}`} />
              <Picture name={STYLE_PICTURE[c.id]} x={x} y={y} size={hov ? 32 : 26} />
            </g>
          )
        })}
        {RADIAL_COLORS.map((c, i) => {
          const [x, y] = pt(dot, colorAngle(i))
          const hov = hv.kind === 'color' && hv.index === i
          const on = c.toLowerCase() === cur
          return (
            <g key={c}>
              {on && <circle cx={x} cy={y} r={17} class="rcolor-on" />}
              <circle cx={x} cy={y} r={hov ? 15 : 12} fill={c} stroke={luminance(c) > .85 ? 'rgba(0,0,0,.35)' : 'rgba(0,0,0,.12)'} stroke-width="1.2" />
            </g>
          )
        })}
        <circle class="rhub" r={RADIAL.hub} />
        {label
          ? <text class="rlabel" text-anchor="middle" dominant-baseline="central">{label}</text>
          : hub ? <Picture name={hub} x={0} y={0} size={34} /> : <circle r="9" fill={currentColor.value} />}
      </g>
    </svg>
  )
}
