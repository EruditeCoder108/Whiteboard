import { paintExperiment } from './experiments'
import { isShowcase } from './showcase-models'
import { paintShowcase } from './showcase-scenes'
import { paintBaseball } from './props'
import type { LabItem } from '../types'
import { evaluate, flight, samples } from './projectile'
import { supportedLab } from './runtime'

export const LAB_W = 1000, LAB_H = 640
export const fmt = (n: number): string => Math.abs(n) >= 10000 ? n.toExponential(1) : Math.abs(n) >= 100 ? n.toFixed(1) : n.toFixed(2)
const cache = new WeakMap<LabItem, ReturnType<typeof buildScene>>()
function nice(v: number): number {
  const unit = 10 ** Math.floor(Math.log10(Math.max(v, 0.001))), f = v / unit
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * unit
}
function buildScene(it: LabItem) {
  const f = flight(it.params), comparison = { ...it.params, angle: 90 - it.params.angle }, cf = flight(comparison)
  const range = Math.max(f.range, it.reveal.compare ? cf.range : 0), height = Math.max(f.maxHeight, it.reveal.compare ? cf.maxHeight : 0)
  const scale = Math.min(550 / Math.max(range, 1), 245 / Math.max(height, 1))
  const ox = 86, oy = 432, gain = Math.min(5, 110 / Math.max(it.params.speed, 1))
  const point = (x: number, y: number): [number, number] => [ox + x * scale, oy - y * scale]
  return { f, points: samples(it.params), compare: samples(comparison), comparison, cf, scale, ox, oy, gain, point,
    xTick: nice(550 / scale / 5), yTick: nice(275 / scale / 4) }
}
export function scene(it: LabItem) {
  let s = cache.get(it)
  if (!s) { s = buildScene(it); cache.set(it, s) }
  return s
}
/** Handle coordinates are presentation only; its labelled scale is in m/s. */
export function launchHandle(it: LabItem): { origin: [number, number]; tip: [number, number]; gain: number } {
  const s = scene(it), origin = s.point(0, it.params.height)
  return { origin, tip: [origin[0] + s.f.vx * s.gain, origin[1] - s.f.vy0 * s.gain], gain: s.gain }
}
export function labToWorld(it: LabItem, point: [number, number]): [number, number] {
  const scale = (it.p[2] - it.p[0]) / LAB_W
  const x = it.p[0] + point[0] * scale, y = it.p[1] + point[1] * scale
  const cx = (it.p[0] + it.p[2]) / 2, cy = (it.p[1] + it.p[3]) / 2, a = it.angle ?? 0
  return [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]
}
export function worldToLab(it: LabItem, x: number, y: number): [number, number] {
  const cx = (it.p[0] + it.p[2]) / 2, cy = (it.p[1] + it.p[3]) / 2, a = -(it.angle ?? 0)
  const lx = cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), ly = cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)
  const scale = LAB_W / (it.p[2] - it.p[0])
  return [(lx - it.p[0]) * scale, (ly - it.p[1]) * scale]
}

/** One bounded scene for the board, PNG and frozen lesson replay. */
export function paintLab(ctx: CanvasRenderingContext2D, it: LabItem, time = it.frozenTime): void {
  if (supportedLab(it) && isShowcase(it.model)) { paintShowcase(ctx, it, time); return }
  if (supportedLab(it) && it.model !== 'projectile') { paintExperiment(ctx, it, time); return }
  const baseAlpha = ctx.globalAlpha
  const scale = (it.p[2] - it.p[0]) / LAB_W
  ctx.save(); ctx.translate(it.p[0], it.p[1]); ctx.scale(scale, scale)
  ctx.beginPath(); ctx.roundRect(0, 0, LAB_W, LAB_H, 22); ctx.clip()
  const dark = it.theme === 'blueprint'
  const bg = dark ? '#0c2034' : '#fbfcf8', ink = dark ? '#e5f1f9' : '#1e3446', muted = dark ? '#9bb4c8' : '#566e7c'
  const line = dark ? '#284153' : '#dee7e5', cyan = it.c !== '#007c88' ? it.c : dark ? '#66e6ef' : '#007c88', gold = dark ? '#ffc575' : '#a85c04', pink = dark ? '#f8a0bd' : '#b94269'
  const text = (label: string, x: number, y: number, size = 15, color = ink, align: CanvasTextAlign = 'left', bold = false): void => {
    ctx.font = `${bold ? '600 ' : ''}${size}px "Segoe UI", sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y)
  }
  const stroke = (x0: number, y0: number, x1: number, y1: number, color = line, width = 1): void => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
  }
  const dot = (x: number, y: number, r: number, color: string): void => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill() }
  const arrow = (x: number, y: number, dx: number, dy: number, color: string): void => {
    if (Math.hypot(dx, dy) < 0.05) { dot(x, y, 2.5, color); return }
    stroke(x, y, x + dx, y + dy, color, 2.5)
    const a = Math.atan2(dy, dx), head = Math.min(8, Math.hypot(dx, dy) / 2)
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x + dx, y + dy)
    ctx.lineTo(x + dx - head * Math.cos(a - 0.5), y + dy - head * Math.sin(a - 0.5))
    ctx.lineTo(x + dx - head * Math.cos(a + 0.5), y + dy - head * Math.sin(a + 0.5)); ctx.fill()
  }
  ctx.fillStyle = bg; ctx.fillRect(0, 0, LAB_W, LAB_H)
  ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(1, 1, LAB_W - 2, LAB_H - 2, 22); ctx.stroke()
  text('SCIENCE / MECHANICS', 30, 28, 12, cyan, 'left', true)
  text('Projectile motion', 30, 60, 30, ink, 'left', true)
  text('IDEAL FLIGHT  ·  SI UNITS', 970, 30, 12, muted, 'right')
  if (!supportedLab(it)) {
    text('This lab needs a newer model', 500, 270, 28, ink, 'center', true)
    text(`${it.model} · model v${it.modelVersion} · lab v${it.labVersion}`, 500, 316, 19, muted, 'center')
    text('Saved settings are preserved. Calculation and playback are unavailable.', 500, 356, 17, muted, 'center')
    ctx.restore(); return
  }
  const s = scene(it), state = evaluate(it.params, time), f = s.f
  text(`t = ${fmt(state.t)} s`, 970, 62, 23, cyan, 'right', true)
  stroke(30, 88, 970, 88)
  const cards = [['FLIGHT TIME', `${fmt(f.duration)} s`], ['RANGE', `${fmt(f.range)} m`], ['PEAK HEIGHT', `${fmt(f.maxHeight)} m`], ['SPEED NOW', `${fmt(state.speed)} m/s`]]
  cards.forEach(([label, value], i) => { const x = 30 + i * 240; text(label, x, 109, 11, muted); text(value, x, 133, 21, ink, 'left', true) })
  // Equal scale on x and y; axis density is labelled explicitly in metres.
  ctx.save(); ctx.beginPath(); ctx.rect(38, 155, 636, 317); ctx.clip()
  for (let x = 0, i = 0; x <= 555 / s.scale && i < 8; x += s.xTick, i++) {
    const px = s.ox + x * s.scale; stroke(px, 161, px, s.oy)
    text(fmt(x), px, 448, 12, muted, 'center')
  }
  for (let y = s.yTick, i = 0; y <= 264 / s.scale && i < 8; y += s.yTick, i++) {
    const py = s.oy - y * s.scale; stroke(s.ox, py, 641, py); text(fmt(y), 77, py, 12, muted, 'right')
  }
  ctx.fillStyle = dark ? '#152f40' : '#ecf1e9'; ctx.fillRect(s.ox, s.oy, 557, 5)
  arrow(s.ox, s.oy, 562, 0, muted); arrow(s.ox, s.oy, 0, -268, muted)
  const path = (points: ReturnType<typeof samples>, color: string, dash: number[], until = Infinity, width = 2): void => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.beginPath()
    let first = true
    for (const p of points) { if (p.t > until) break; const [x, y] = s.point(p.x, p.y); if (first) ctx.moveTo(x, y); else ctx.lineTo(x, y); first = false }
    if (until !== Infinity) { const p = evaluate(it.params, until), [x, y] = s.point(p.x, p.y); ctx.lineTo(x, y) }
    ctx.stroke(); ctx.setLineDash([])
  }
  if (it.reveal.compare) path(s.compare, pink, [5, 6])
  if (it.reveal.trajectory) { ctx.globalAlpha = baseAlpha * 0.4; path(s.points, cyan, [4, 5]); ctx.globalAlpha = baseAlpha }
  path(s.points, cyan, [], state.t, 3)
  if (it.reveal.strobes && f.duration > 0) for (let i = 0; i <= 12; i++) {
    const p = evaluate(it.params, f.duration * i / 12)
    if (p.t > state.t + 1e-9) break
    dot(...s.point(p.x, p.y), 3.2, cyan)
  }
  const [px, py] = s.point(state.x, state.y), apex = s.point(f.vx * f.apexTime, f.maxHeight)
  if (it.reveal.trajectory && f.maxHeight > 0) {
    ctx.globalAlpha = baseAlpha * 0.5; stroke(apex[0] - 5, apex[1], apex[0] + 5, apex[1], gold); stroke(apex[0], apex[1] - 5, apex[0], apex[1] + 5, gold); ctx.globalAlpha = baseAlpha
  }
  if (it.reveal.vectors) {
    // Use one gain for both components, bounded by the plot's available space.
    // This keeps the whole vector visible at elevated launch and pre-impact.
    const gain = Math.max(0, Math.min(s.gain, 85 / Math.max(state.speed, 1),
      state.vx > 0 ? (648 - px) / state.vx : Infinity,
      state.vy > 0 ? (py - 170) / state.vy : state.vy < 0 ? (465 - py) / -state.vy : Infinity))
    const dx = state.vx * gain, dy = -state.vy * gain
    arrow(px, py, dx, 0, gold); arrow(px, py, 0, dy, pink); arrow(px, py, dx, dy, cyan)
    text('vₓ', Math.min(646, px + dx + 8), py + 15, 13, gold)
    text('vᵧ', px - 11, Math.max(174, Math.min(455, py + dy - 10)), 13, pink, 'right')
  }
  ctx.globalAlpha = baseAlpha * 0.15; dot(px, py, 17, cyan); ctx.globalAlpha = baseAlpha
  paintBaseball(ctx, px, py, 10.5)
  if (state.landed && state.t > 0) { stroke(px - 12, py + 9, px + 12, py + 9, gold, 2); text('IMPACT', px, py + 28, 10, gold, 'center') }
  const handle = launchHandle(it), [lx, ly] = handle.origin
  ctx.globalAlpha = baseAlpha * (state.t > 0 ? 0.4 : 1)
  arrow(lx, ly, handle.tip[0] - lx, handle.tip[1] - ly, cyan)
  ctx.strokeStyle = cyan; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(lx, ly, 27, -it.params.angle * Math.PI / 180, 0); ctx.stroke()
  text(`${fmt(it.params.angle)}°`, lx + 35, ly - 10, 12, muted)
  ctx.globalAlpha = baseAlpha
  ctx.restore()
  text('y (m) ↑', 41, 166, 13, muted); text('x (m) →', 648, 470, 13, muted, 'right')
  text(`Equal x/y scale · ${fmt(100 / s.scale)} m per 100 frame units`, 86, 473, 11, muted)
  if (it.reveal.compare) text(`Dashed rose: ${fmt(s.comparison.angle)}° comparison`, 86, 492, 12, pink)
  else text(it.reveal.strobes ? 'Trail dots: equal time intervals' : 'Drag the launch arrow to change speed and angle', 86, 492, 12, muted)
  // Two synchronized plots with exact moving cursor, sampled at bounded resolution.
  if (it.reveal.graphs) {
    const graph = (top: number, title: string, low: number, high: number, value: (p: ReturnType<typeof evaluate>) => number, color: string): void => {
      const gx = 742, gy = top + 96, gw = 213, gh = 72, span = Math.max(0.001, high - low)
      text(title, 713, top, 15, ink, 'left', true)
      const mapY = (v: number): number => gy - (v - low) / span * gh
      for (let i = 0; i <= 2; i++) { const y = gy - i * gh / 2; stroke(gx, y, gx + gw, y); text(fmt(low + i * span / 2), gx - 8, y, 10, muted, 'right') }
      stroke(gx, gy, gx + gw, gy, muted); stroke(gx, gy - gh, gx, gy, muted)
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath()
      s.points.forEach((p, i) => { const x = gx + (f.duration ? p.t / f.duration : 0) * gw, y = mapY(value(p)); if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y) }); ctx.stroke()
      const x = gx + (f.duration ? state.t / f.duration : 0) * gw
      ctx.setLineDash([3, 4]); stroke(x, gy - gh, x, gy, cyan); ctx.setLineDash([]); dot(x, mapY(value(state)), 4, color)
      text('0', gx, gy + 15, 11, muted); text(`${fmt(f.duration)} s`, gx + gw, gy + 15, 11, muted, 'right')
    }
    graph(177, 'Height · y(t) / m', 0, Math.max(1, f.maxHeight) * 1.1, p => p.y, cyan)
    graph(313, 'Vertical velocity · vᵧ(t) / m/s', -Math.max(1, Math.abs(evaluate(it.params, f.duration).vy)) * 1.1, Math.max(1, f.vy0) * 1.1, p => p.vy, pink)
  } else {
    text('ONE MOTION.', 727, 265, 22, ink, 'left', true); text('TWO COMPONENTS.', 727, 298, 19, ink, 'left', true)
    text('Horizontal velocity stays constant.', 727, 345, 13, muted)
    text('Gravity changes vertical velocity.', 727, 369, 13, muted)
  }
  text(`vₓ ${fmt(state.vx)} m/s   ·   vᵧ ${fmt(state.vy)} m/s`, 715, 458, 13, muted)
  text(state.landed ? 'Velocity immediately before impact' : `x ${fmt(state.x)} m   ·   y ${fmt(state.y)} m`, 715, 482, 12, muted)
  stroke(30, 514, 970, 514)
  if (it.reveal.energy) {
    text('MECHANICAL ENERGY', 30, 539, 11, muted)
    text(`${fmt(state.energy)} J`, 30, 564, 23, ink, 'left', true)
    const fraction = state.energy > 0 ? state.kinetic / state.energy : 0
    ctx.fillStyle = line; ctx.fillRect(275, 534, 250, 9)
    ctx.fillStyle = cyan; ctx.fillRect(275, 534, 250 * fraction, 9)
    ctx.fillStyle = gold; ctx.fillRect(275 + 250 * fraction, 534, 250 * (1 - fraction), 9)
    text(`K ${fmt(state.kinetic)} J`, 275, 563, 13, cyan); text(`U ${fmt(state.potential)} J`, 525, 563, 13, gold, 'right')
  }
  if (it.reveal.equations) {
    text('x = (v₀ cos θ)t', 595, 539, 15, ink)
    text('y = h₀ + (v₀ sin θ)t − ½gt²', 595, 565, 15, ink)
  }
  text(`Uniform g = ${fmt(it.params.gravity)} m/s² ↓  ·  no air resistance  ·  point mass  ·  level landing plane`, 30, 604, 13, muted)
  text('PROJECTILE / v1', 970, 605, 11, muted, 'right')
  ctx.restore()
}
