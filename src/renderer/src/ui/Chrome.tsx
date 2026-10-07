import type { JSX } from 'preact'
import { useRef } from 'preact/hooks'
import { toast } from '@/state/store'

const MIN_W = 420
const MIN_H = 320
const EDGES = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'] as const
type Edge = (typeof EDGES)[number]

interface DragState {
  edge: Edge
  sx: number
  sy: number
  b: { x: number; y: number; width: number; height: number } | null
}

/**
 * Transparent windows can't be resized natively on Windows, so we ship our own
 * invisible edge handles that drive the window bounds through the main process.
 */
export function ResizeHandles(): JSX.Element {
  const drag = useRef<DragState | null>(null)
  const raf = useRef(0)
  const next = useRef<{ x: number; y: number; width: number; height: number } | null>(null)

  const onDown = (edge: Edge) => (e: PointerEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* pointer already gone */
    }
    const st: DragState = { edge, sx: e.screenX, sy: e.screenY, b: null }
    drag.current = st
    void window.api.win.getBounds().then((b) => {
      if (drag.current === st) st.b = b
    })
  }

  const onMove = (e: PointerEvent): void => {
    const d = drag.current
    if (!d || !d.b) return
    const dx = e.screenX - d.sx
    const dy = e.screenY - d.sy
    let { x, y, width, height } = d.b
    if (d.edge.includes('e')) width = Math.max(MIN_W, d.b.width + dx)
    if (d.edge.includes('s')) height = Math.max(MIN_H, d.b.height + dy)
    if (d.edge.includes('w')) {
      width = Math.max(MIN_W, d.b.width - dx)
      x = d.b.x + (d.b.width - width)
    }
    if (d.edge.includes('n')) {
      height = Math.max(MIN_H, d.b.height - dy)
      y = d.b.y + (d.b.height - height)
    }
    next.current = { x, y, width, height }
    if (!raf.current) {
      raf.current = requestAnimationFrame(() => {
        raf.current = 0
        if (next.current) window.api.win.setBounds(next.current)
      })
    }
  }

  const onUp = (): void => {
    drag.current = null
  }

  return (
    <>
      {EDGES.map((edge) => (
        <div
          key={edge}
          class={`rz rz-${edge}`}
          onPointerDown={onDown(edge) as never}
          onPointerMove={onMove as never}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      ))}
    </>
  )
}

export function Toast(): JSX.Element | null {
  const t = toast.value
  if (!t) return null
  return (
    <div class="toast" key={t.id}>
      {t.text}
    </div>
  )
}
