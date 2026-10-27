import type { LabItem } from '../types'
import { getModel, labDuration, labState } from './models'
const graphs = new WeakMap<LabItem, Map<string, number[]>>()

export class Studio {
  readonly dark: boolean
  readonly ink: string
  readonly muted: string
  readonly line: string
  readonly accent: string
  readonly panel: string
  constructor(readonly c: CanvasRenderingContext2D, readonly it: LabItem, readonly time: number) {
    this.dark = it.theme === 'blueprint'; this.ink = this.dark ? '#edf6f5' : '#193947'; this.muted = this.dark ? '#a5bfca' : '#56717b'
    this.line = this.dark ? '#294955' : '#ccdeda'; this.accent = this.dark ? '#70e8d6' : '#007f77'; this.panel = this.dark ? '#132f3a' : '#ffffff'
    const scale = (it.p[2] - it.p[0]) / 1000
    c.save(); c.translate(it.p[0], it.p[1]); c.scale(scale, scale); c.beginPath(); c.roundRect(0, 0, 1000, 640, 22); c.clip()
    const bg = c.createLinearGradient(0, 0, 1000, 640); bg.addColorStop(0, this.dark ? '#102733' : '#f5f8f3'); bg.addColorStop(1, this.dark ? '#081d28' : '#eaf2ef')
    c.fillStyle = bg; c.fillRect(0, 0, 1000, 640)
    this.linePath('M30 99H970M30 599H970', this.line, 1)
    const m = getModel(it.model)!
    this.text(`DISCOVERY STUDIO   /   ${m.subject.toUpperCase()}`, 34, 27, 11, this.accent, true)
    this.text(m.title, 34, 65, 30, this.ink, true)
    this.pill('OFFLINE  ·  EDITABLE', 780, 24, 184, this.accent)
    this.text(m.question, 35, 619, 15, this.muted)
    this.text(`${time.toFixed(2)} s`, 965, 619, 14, this.accent, false, 'right')
  }
  finish(): void { this.c.restore() }
  text(s: string, x: number, y: number, size = 15, color = this.ink, bold = false, align: CanvasTextAlign = 'left'): void {
    const c = this.c; c.font = `${bold ? '600 ' : ''}${size}px "Segoe UI", sans-serif`; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, x, y)
  }
  box(x: number, y: number, w: number, h: number, fill = this.panel, r = 14, stroke = this.line): void {
    const c = this.c; c.fillStyle = fill; c.strokeStyle = stroke; c.lineWidth = 1; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); if (stroke) c.stroke()
  }
  path(d: string, fill: string | CanvasGradient, stroke = '', width = 1): void {
    const c = this.c, p = new Path2D(d); c.fillStyle = fill; c.fill(p); if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(p) }
  }
  linePath(d: string, color = this.line, width = 1): void { const c = this.c; c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(new Path2D(d)) }
  dot(x: number, y: number, r: number, fill: string, stroke = ''): void { const c = this.c; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke() } }
  pill(label: string, x: number, y: number, width: number, color = this.accent): void { this.box(x, y, width, 24, this.dark ? '#1c3943' : '#dfede7', 12, ''); this.text(label, x + width / 2, y + 12, 10, color, true, 'center') }
  shadow(x: number, y: number, rx: number, ry: number): void {
    const c = this.c; c.save(); c.scale(1, ry / rx); const g = c.createRadialGradient(x, y * rx / ry, 0, x, y * rx / ry, rx); g.addColorStop(0, this.dark ? '#020d17aa' : '#527b6940'); g.addColorStop(1, '#00000000'); c.fillStyle = g; c.beginPath(); c.arc(x, y * rx / ry, rx, 0, Math.PI * 2); c.fill(); c.restore()
  }
  arrow(x: number, y: number, dx: number, dy: number, color = this.accent, width = 2): void {
    if (Math.hypot(dx, dy) < 0.1) return
    const a = Math.atan2(dy, dx); this.linePath(`M${x} ${y}l${dx} ${dy}`, color, width)
    this.path(`M${x + dx} ${y + dy}l${-9 * Math.cos(a - 0.5)} ${-9 * Math.sin(a - 0.5)}l${9 * Math.cos(a - 0.5) - 9 * Math.cos(a + 0.5)} ${9 * Math.sin(a - 0.5) - 9 * Math.sin(a + 0.5)}Z`, color)
  }
  metric(label: string, value: string, unit: string, x: number, y: number, width = 180, color = this.accent): void {
    this.text(label.toUpperCase(), x, y, 10, this.muted, true); this.text(value, x, y + 29, 27, color, true); this.text(unit, x + width, y + 31, 12, this.muted, false, 'right')
  }
  graph(key: string, title: string, unit: string, color = this.accent): void {
    if (!this.it.reveal.graphs) {
      this.text('WHAT TO NOTICE', 709, 424, 11, this.accent, true)
      this.text('Pause at a lesson stop.', 709, 455, 14)
      this.text('Compare the changing scene.', 709, 480, 12, this.muted)
      this.text('Choose Explain to reveal its graph.', 709, 518, 11, this.muted)
      return
    }
    const x = 713, y = 421, w = 225, h = 111, duration = labDuration(this.it)
    this.text(title, 707, 394, 13, this.ink, true); this.text(unit, 948, 394, 11, this.muted, false, 'right')
    let cache = graphs.get(this.it)
    if (!cache) { cache = new Map(); graphs.set(this.it, cache) }
    let values = cache.get(key)
    if (!values) { values = Array.from({ length: 161 }, (_, i) => labState(this.it, duration * i / 160)[key]); cache.set(key, values) }
    const min = key === 'ph' || key === 'fill' ? 0 : Math.min(0, ...values), max = key === 'ph' ? 14 : key === 'fill' ? 1 : Math.max(0, ...values)
    const span = Math.max(0.001, max - min), py = (v: number): number => y + h - (v - min) / span * h
    for (let i = 0; i <= 4; i++) this.linePath(`M${x} ${y + h * i / 4}h${w}`, this.line)
    this.linePath(`M${x} ${py(0)}h${w}`, this.muted)
    this.text(max.toFixed(key === 'ph' ? 0 : 2), x - 6, y, 9, this.muted, false, 'right'); this.text(min.toFixed(key === 'ph' ? 0 : 2), x - 6, y + h, 9, this.muted, false, 'right')
    this.c.save(); this.c.beginPath(); this.c.rect(x, y - 3, w, h + 6); this.c.clip()
    this.c.globalAlpha *= 0.22; this.linePath(values.map((v, i) => `${i ? 'L' : 'M'}${x + w * i / 160} ${py(v)}`).join(' '), color, 2)
    this.c.globalAlpha /= 0.22
    const n = Math.floor(this.time / duration * 160), partial = values.slice(0, n + 1)
    const tx = x + w * Math.min(1, this.time / duration), current = labState(this.it, this.time)[key]
    this.linePath(`${partial.map((v, i) => `${i ? 'L' : 'M'}${x + w * i / 160} ${py(v)}`).join(' ')} L${tx} ${py(current)}`, color, 2.5)
    this.linePath(`M${tx} ${y}v${h}`, this.muted); this.dot(tx, py(current), 4, color); this.c.restore()
    this.text('0', x, 548, 10, this.muted); this.text(`${duration.toFixed(1)} s`, x + w, 548, 10, this.muted, false, 'right')
  }
}
