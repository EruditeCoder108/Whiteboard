import { ArtPencil, Chalk, ChevronRight, FeltMarker, Paintbrush, Pen } from './icons'
import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { board } from '@/engine/instance'
import { PEN_CHOICES, inkWidth } from '@/engine/ink'
import type { PenChoice } from '@/engine/ink'
import { paintItem } from '@/engine/items'
import type { StrokeItem } from '@/engine/types'
import { S, currentColor, currentSize, styleKey } from '@/state/store'
import { Tile } from './kit'

type Icon = typeof Pen

export const PEN_ICON: Record<PenChoice, Icon> = { pen: Pen, pencil: ArtPencil, brush: Paintbrush, chalk: Chalk, felt: FeltMarker }
export const penLabel = (style: PenChoice): string => PEN_CHOICES.find(c => c.id === style)?.label ?? 'Pen'

export function PenStylePicker(): JSX.Element {
  return (
    <div class="pen-styles" role="group" aria-label="Pen style">
      {PEN_CHOICES.map(c => <Tile key={c.id} icon={PEN_ICON[c.id]} label={c.label} on={S.penStyle.value === c.id} onClick={() => { S.penStyle.value = c.id; board.syncCursor() }} />)}
    </div>
  )
}

const WAVE: [number, number][] = [[14, 25], [36, 15], [60, 9], [84, 14], [108, 22], [132, 24], [158, 16], [186, 8]]

/** The real ink on the real board colour, so what is shown here is what the pen will write. */
export function InkPreview(): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)
  const style = S.penStyle.value, color = currentColor.value, size = currentSize.value, marker = styleKey.value === 'marker', paper = S.bgColor.value
  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = cv.clientWidth || 200, h = cv.clientHeight || 34
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = paper
    ctx.fillRect(0, 0, w, h)
    ctx.scale(w / 200, h / 34)
    const p: number[] = []
    for (let i = 0; i + 1 < WAVE.length; i++) {
      const [ax, ay] = WAVE[i], [bx, by] = WAVE[i + 1]
      for (let k = 0; k < 6; k++) p.push(ax + (bx - ax) * k / 6, ay + (by - ay) * k / 6, .5 + .3 * Math.sin((i * 6 + k) * .22))
    }
    const stroke: StrokeItem = { t: 's', id: 'preview', c: color, w: Math.min(marker ? size : inkWidth(size, style), 24), m: marker, v: !marker && style !== 'chalk' && style !== 'felt', ...(marker || style === 'pen' ? {} : { style }), p }
    paintItem(ctx, stroke)
  }, [style, color, size, marker, paper])
  return <canvas ref={ref} class="preview ink-preview" aria-hidden="true" />
}

const CLEAR_AT = .88

/** A real slide, so the page can never be wiped by an accidental tap in front of a class. */
export function SlideToClear(): JSX.Element {
  const track = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)
  const [sliding, setSliding] = useState(false)
  const follow = (e: PointerEvent): void => {
    const r = track.current?.getBoundingClientRect()
    if (!r) return
    const thumb = r.height
    setAt(Math.max(0, Math.min(1, (e.clientX - r.left - thumb / 2) / (r.width - thumb))))
  }
  const release = (): void => {
    setSliding(false)
    if (at >= CLEAR_AT) { S.popover.value = null; board.clearBoard() }
    setAt(0)
  }
  return (
    <div class={`slide-clear ${sliding ? 'sliding' : ''}`} ref={track} style={{ '--at': at } as never}>
      <span>Slide to clear this page</span>
      <button type="button" class="slide-thumb nodrag" aria-label="Clear this page" style={{ touchAction: 'none' }}
        onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setSliding(true) }}
        onPointerMove={e => { if (sliding) follow(e as unknown as PointerEvent) }}
        onPointerUp={release} onPointerCancel={() => { setSliding(false); setAt(0) }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); S.popover.value = null; board.clearBoard() } }}>
        <ChevronRight size={22} />
      </button>
    </div>
  )
}

