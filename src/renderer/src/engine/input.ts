import type { Board } from './board'
import { radial } from './radial'
import type { RadialPick } from './radial'
import type { Ptr, Tool } from './tool-types'
import { S, activeTool } from '@/state/store'

const LONG_PRESS_SLOP = 9
const PEN_PALM_MS = 700

type Mode = 'idle' | 'tool' | 'pan' | 'pinch' | 'radial' | 'window'

/**
 * Turns raw Pointer Events (mouse, pen, touch) into tool gestures.
 *
 *  - pen:    tip draws · barrel button / eraser end = eraser · side button = pan
 *  - touch:  one finger draws (or pans, if finger-drawing is off) · two fingers pan + pinch
 *  - mouse:  left draws · middle/right pans · wheel pans · Ctrl+wheel zooms
 *  - press-and-hold (any device) opens the radial menu
 *  - touch is ignored while a pen is near (palm rejection)
 */
export class InputRouter {
  private mode: Mode = 'idle'
  private primary: number | null = null
  private tool: Tool | null = null
  private touches = new Map<number, { x: number; y: number }>()
  private penUntil = 0
  private space = false
  private lastPan: [number, number] = [0, 0]
  private pinch: { cx: number; cy: number; d: number } | null = null
  private longTimer = 0
  private pressAt = { x: 0, y: 0, cx: 0, cy: 0, t: 0 }
  private winDrag: { sx: number; sy: number; b: { x: number; y: number } | null } | null = null
  private cleanup: (() => void)[] = []

  constructor(
    private el: HTMLElement,
    private board: Board,
    private onRadialPick: (pick: RadialPick) => void
  ) {}

  attach(): void {
    const on = <K extends keyof HTMLElementEventMap>(
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
      opts?: AddEventListenerOptions
    ): void => {
      this.el.addEventListener(type, fn, opts)
      this.cleanup.push(() => this.el.removeEventListener(type, fn))
    }
    on('pointerdown', (e) => this.onDown(e))
    on('pointermove', (e) => this.onMove(e))
    on('pointerup', (e) => this.onUp(e))
    on('pointercancel', (e) => this.onCancel(e))
    on('pointerleave', (e) => {
      if (this.mode === 'idle' && e.pointerType !== 'touch') this.board.currentTool().leave?.()
    })
    on('wheel', (e) => this.onWheel(e), { passive: false })
    on('contextmenu', (e) => e.preventDefault())
    on('dblclick', (e) => {
      if (S.replaying.value) return
      if (S.tool.value !== 'select' && S.tool.value !== 'lasso') return
      const r = this.el.getBoundingClientRect()
      this.board.editTextAt(...this.board.toWorld(e.clientX - r.left, e.clientY - r.top))
    })
    on('dragstart', (e) => e.preventDefault())
    const win = (type: string, fn: (e: Event) => void): void => {
      window.addEventListener(type, fn)
      this.cleanup.push(() => window.removeEventListener(type, fn))
    }
    win('blur', () => this.abortAll())
    win('keydown', (e) => {
      const k = e as KeyboardEvent
      if (k.code === 'Space' && !k.repeat && !isTyping(k)) this.setSpace(true)
    })
    win('keyup', (e) => {
      if ((e as KeyboardEvent).code === 'Space') this.setSpace(false)
    })
  }

  detach(): void {
    this.abortAll()
    this.cleanup.forEach((f) => f())
    this.cleanup = []
  }

  setSpace(on: boolean): void {
    this.space = on
    this.el.style.cursor = on ? 'grab' : this.board.currentTool().cursor()
  }

  // ── helpers ─────────────────────────────────────────────────────────────────
  private toPtr(e: PointerEvent): Ptr {
    const r = this.el.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const [wx, wy] = this.board.toWorld(x, y)
    return {
      id: e.pointerId,
      type: e.pointerType === 'pen' ? 'pen' : e.pointerType === 'touch' ? 'touch' : 'mouse',
      x,
      y,
      wx,
      wy,
      pressure: e.pointerType === 'mouse' ? 0.5 : e.pressure,
      buttons: e.buttons,
      shift: e.shiftKey,
      alt: e.altKey,
      ctrl: e.ctrlKey || e.metaKey,
      t: e.timeStamp / 1000
    }
  }

  private penRecent(): boolean {
    return performance.now() < this.penUntil
  }

  /** Pen contact: tip (1) or eraser end (32). Barrel button alone is only a hover. */
  private static penContact(e: PointerEvent): boolean {
    return (e.buttons & (1 | 32)) !== 0
  }

  private static penWantsEraser(e: PointerEvent): boolean {
    return (e.buttons & (2 | 32)) !== 0 || e.button === 5
  }

  private updateOverride(e: PointerEvent): void {
    if (e.pointerType !== 'pen' || this.mode !== 'idle') return
    const next = InputRouter.penWantsEraser(e) ? 'eraser' : null
    if (S.override.value !== next) S.override.value = next
  }

  // ── gestures ────────────────────────────────────────────────────────────────
  private beginTool(e: PointerEvent): void {
    const p = this.toPtr(e)
    this.primary = e.pointerId
    try {
      this.el.setPointerCapture(e.pointerId)
    } catch {
      /* pointer already gone */
    }
    if (this.space || activeTool.value === 'hand') {
      this.beginPan(e)
      return
    }
    this.tool = this.board.currentTool()
    this.mode = 'tool'
    this.tool.down(p)
    if (this.tool.allowsRadial) this.armLongPress(e, p)
  }

  private beginPan(e: PointerEvent): void {
    const p = this.toPtr(e)
    this.primary = e.pointerId
    this.mode = 'pan'
    this.lastPan = [p.x, p.y]
    this.el.style.cursor = 'grabbing'
    try {
      this.el.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  private armLongPress(e: PointerEvent, p: Ptr): void {
    window.clearTimeout(this.longTimer)
    if (!S.radialEnabled.value) return
    this.pressAt = { x: p.x, y: p.y, cx: e.clientX, cy: e.clientY, t: performance.now() }
    this.longTimer = window.setTimeout(() => this.fireLongPress(), S.radialDelay.value)
  }

  private fireLongPress(): void {
    if (this.mode !== 'tool' || !this.tool) return
    if (performance.now() - this.pressAt.t > S.radialDelay.value * 2.2) return // loop stalled – don't guess
    this.tool.cancel()
    this.tool = null
    this.mode = 'radial'
    radial.open(this.pressAt.cx, this.pressAt.cy)
  }

  private endGesture(p: Ptr | null): void {
    window.clearTimeout(this.longTimer)
    const mode = this.mode
    this.mode = 'idle'
    this.primary = null
    if (mode === 'tool' && this.tool) {
      if (p) this.tool.up(p)
      else this.tool.cancel()
    } else if (mode === 'radial') {
      const pick = radial.release()
      if (pick) this.onRadialPick(pick)
    } else if (mode === 'window') {
      this.winDrag = null
    }
    this.tool = null
    this.el.style.cursor = this.space ? 'grab' : this.board.currentTool().cursor()
  }

  /** Throw away whatever is in progress (focus loss, 2nd finger, Esc …). */
  abortAll(): void {
    window.clearTimeout(this.longTimer)
    this.space = false
    if (this.mode === 'tool') this.tool?.cancel()
    if (this.mode === 'radial') radial.cancel()
    this.mode = 'idle'
    this.primary = null
    this.tool = null
    this.pinch = null
    this.touches.clear()
    S.override.value = null
    this.board.currentTool().leave?.()
    this.el.style.cursor = this.board.currentTool().cursor()
  }

  cancelRadial(): void {
    if (this.mode === 'radial') {
      radial.cancel()
      this.mode = 'idle'
      this.primary = null
    }
  }

  // ── pointer events ──────────────────────────────────────────────────────────
  private onDown(e: PointerEvent): void {
    if (S.replaying.value) return
    e.preventDefault()
    if (S.editing.value) this.board.commitText()
    S.popover.value = null

    if (e.pointerType === 'touch') {
      if (this.penRecent()) return // palm
      const r = this.el.getBoundingClientRect()
      this.touches.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top })
      if (this.touches.size === 1 && this.mode === 'idle') {
        if (S.fingerDraw.value || activeTool.value === 'laser') this.beginTool(e)
        else this.beginPan(e)
      } else if (this.touches.size >= 2) {
        const busy = this.mode === 'tool' && this.tool?.underway()
        if (busy) return // keep following the first finger
        window.clearTimeout(this.longTimer)
        if (this.mode === 'tool') this.tool?.cancel()
        if (this.mode === 'radial') radial.cancel()
        this.tool = null
        this.mode = 'pinch'
        this.primary = null
        this.startPinch()
      }
      return
    }

    if (e.pointerType === 'pen') {
      this.penUntil = performance.now() + PEN_PALM_MS
      // a pen landing cancels any finger gesture that was drawing
      if (this.touches.size) this.abortAll()
      this.updateOverride(e)
      if (this.mode === 'idle' && InputRouter.penContact(e)) {
        if (e.button === 1) this.beginPan(e)
        else this.beginTool(e)
      }
      return
    }

    // mouse
    if (this.mode !== 'idle') return
    if (e.button === 0 && e.altKey) return this.beginWindowDrag(e)
    if (e.button === 1 || e.button === 2) this.beginPan(e)
    else if (e.button === 0) this.beginTool(e)
  }

  private onMove(e: PointerEvent): void {
    const events = e.getCoalescedEvents?.() ?? []
    const list = events.length ? events : [e]

    if (e.pointerType === 'pen') {
      this.penUntil = performance.now() + PEN_PALM_MS
      this.updateOverride(e)
      const contact = InputRouter.penContact(e)
      // Chrome reports tip contact while the barrel button is held as a *move*, not a down
      if (this.mode === 'idle' && contact) {
        this.beginTool(e)
        return
      }
      if ((this.mode === 'tool' || this.mode === 'pan') && this.primary === e.pointerId && !contact) {
        this.endGesture(this.toPtr(e))
        this.updateOverride(e)
        return
      }
    }

    if (e.pointerType === 'touch') {
      const r = this.el.getBoundingClientRect()
      if (this.touches.has(e.pointerId)) this.touches.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top })
      if (this.mode === 'pinch') return this.updatePinch()
    }

    switch (this.mode) {
      case 'idle':
        if (e.pointerType !== 'touch') {
          const tool = this.board.currentTool()
          if (tool.name === 'laser') for (const sample of list) tool.hover?.(this.toPtr(sample as PointerEvent))
          else tool.hover?.(this.toPtr(e))
        }
        if (!this.space) this.el.style.cursor = this.board.currentTool().cursor()
        break
      case 'radial':
        if (e.pointerId === this.primary) radial.move(e.clientX, e.clientY)
        break
      case 'window':
        this.moveWindow(e)
        break
      case 'pan':
        if (e.pointerId === this.primary) {
          const p = this.toPtr(e)
          this.board.panBy(p.x - this.lastPan[0], p.y - this.lastPan[1])
          this.lastPan = [p.x, p.y]
        }
        break
      case 'tool':
        if (e.pointerId !== this.primary || !this.tool) break
        for (const ce of list) {
          const p = this.toPtr(ce as PointerEvent)
          this.tool.move(p)
        }
        if (this.longTimer) {
          const p = this.toPtr(e)
          if (Math.hypot(p.x - this.pressAt.x, p.y - this.pressAt.y) > LONG_PRESS_SLOP) {
            window.clearTimeout(this.longTimer)
            this.longTimer = 0
          }
        }
        break
    }
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerType === 'touch') {
      this.touches.delete(e.pointerId)
      if (this.mode === 'pinch') {
        if (this.touches.size === 0) {
          this.mode = 'idle'
          this.pinch = null
        }
        return
      }
    }
    if (this.mode === 'radial' && e.pointerId === this.primary) return this.endGesture(null)
    if (this.mode === 'window') return this.endGesture(null)
    if (this.mode === 'idle' || e.pointerId !== this.primary) return
    if (e.pointerType === 'pen') {
      this.endGesture(this.toPtr(e))
      this.updateOverride(e)
      return
    }
    this.endGesture(this.toPtr(e))
  }

  private onCancel(e: PointerEvent): void {
    if (e.pointerType === 'touch') this.touches.delete(e.pointerId)
    if (this.mode === 'pinch') {
      if (this.touches.size === 0) {
        this.mode = 'idle'
        this.pinch = null
      }
      return
    }
    if (e.pointerId === this.primary && this.mode !== 'idle') {
      if (this.mode === 'radial') radial.cancel()
      this.endGesture(null)
    }
  }

  // ── pinch ───────────────────────────────────────────────────────────────────
  private startPinch(): void {
    const pts = [...this.touches.values()].slice(0, 2)
    if (pts.length < 2) return
    this.pinch = {
      cx: (pts[0].x + pts[1].x) / 2,
      cy: (pts[0].y + pts[1].y) / 2,
      d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
    }
  }

  private updatePinch(): void {
    const pts = [...this.touches.values()].slice(0, 2)
    if (pts.length < 2 || !this.pinch) return
    const cx = (pts[0].x + pts[1].x) / 2
    const cy = (pts[0].y + pts[1].y) / 2
    const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
    if (this.pinch.d > 12 && d > 12) this.board.zoomAt(d / this.pinch.d, this.pinch.cx, this.pinch.cy)
    this.board.panBy(cx - this.pinch.cx, cy - this.pinch.cy)
    this.pinch = { cx, cy, d }
  }

  // ── wheel ───────────────────────────────────────────────────────────────────
  private onWheel(e: WheelEvent): void {
    if (S.replaying.value) return
    e.preventDefault()
    const r = this.el.getBoundingClientRect()
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
    if (e.ctrlKey || e.metaKey) {
      // trackpad pinch arrives as ctrl+wheel with small deltas; mouse wheel as ±100
      this.board.zoomAt(Math.exp((-e.deltaY * unit) * 0.0022), e.clientX - r.left, e.clientY - r.top)
      return
    }
    let dx = -e.deltaX * unit
    let dy = -e.deltaY * unit
    if (e.shiftKey && dx === 0) [dx, dy] = [dy, 0]
    this.board.panBy(dx, dy)
  }

  // ── Alt+drag moves the window from anywhere ─────────────────────────────────
  private beginWindowDrag(e: PointerEvent): void {
    this.mode = 'window'
    this.primary = e.pointerId
    this.winDrag = { sx: e.screenX, sy: e.screenY, b: null }
    this.el.setPointerCapture(e.pointerId)
    void window.api.win.getBounds().then((b) => {
      if (this.winDrag) this.winDrag.b = { x: b.x, y: b.y }
    })
  }

  private moveWindow(e: PointerEvent): void {
    const d = this.winDrag
    if (!d || !d.b) return
    window.api.win.setBounds({ x: d.b.x + (e.screenX - d.sx), y: d.b.y + (e.screenY - d.sy) })
  }

}

export function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
}
