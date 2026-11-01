import type { Part } from './parts'
import { BRASS, STEEL, WOOD, addParts, box, disc, grip, ink, line, plate, poly, shade, text } from './parts'

const base = { subject: 'physics' as const }
const G = 9.8

/** Rays and lenses are placed like any object: world.ts traces the beam through whatever is on the page. */
export const PHYSICS: Part[] = [
  { ...base, group: 'Light', kind: 'ray-box', name: 'Ray box', w: 170, h: 100, params: { beams: 3 },
    settings: [{ key: 'beams', label: 'Beams', choices: ['One', 'Three', 'Five'], apply: (v, q) => { q.beams = [1, 3, 5][v] } }],
    paint(c) {
      box(c, 8, 16, 130, 68, 8, shade(c, 0, 16, 0, 84, ['#4a4f58', '#2b2f36', '#17191d']))
      box(c, 138, 26, 24, 48, 3, shade(c, 138, 0, 162, 0, ['#fff5c2', '#ffe680']))
      text(c, 'LIGHT', 72, 50, 18, '#ffe680', 'center', 700)
    } },
  ...([['convex-lens', 'Convex lens', 150], ['concave-lens', 'Concave lens', -150]] as [string, string, number][]).map(([kind, name, focal]): Part => ({
    ...base, group: 'Light', kind, name, w: 110, h: 280, params: { f: focal },
    settings: [{ key: 'f', label: 'Focal length', min: 50, max: 300, step: 10, unit: 'units', apply: (v, q) => { q.f = focal > 0 ? v : -v } }],
    paint(c, q, l) {
      const bulge = q.f > 0 ? 34 : -22, edge = q.f > 0 ? 8 : 30
      c.beginPath(); c.moveTo(55 - edge, 14); c.quadraticCurveTo(55 - edge - bulge * 2 + edge * 0, 140, 55 - edge, 266); c.lineTo(55 + edge, 266); c.quadraticCurveTo(55 + edge + bulge * 2, 140, 55 + edge, 14); c.closePath()
      c.fillStyle = l.dark ? 'rgba(170,215,255,.26)' : 'rgba(120,180,235,.32)'; c.fill(); c.strokeStyle = l.dark ? '#cfe6ff' : '#2f6d9e'; c.lineWidth = 3; c.stroke()
      plate(c, `f = ${Math.abs(q.f)}`, 55, 268, 15)
    }
  })),
  { ...base, group: 'Light', kind: 'mirror', name: 'Plane mirror', w: 50, h: 280, params: {},
    paint(c, _q, l) {
      box(c, 22, 10, 12, 260, 3, shade(c, 22, 0, 34, 0, ['#f4f8fb', '#a9bccb']), l.dark ? '#dfeaf3' : '#3b4d5c')
      for (let y = 18; y < 266; y += 16) line(c, 34, y, 44, y + 8, l.dark ? '#dfeaf3' : '#3b4d5c', 2)
    } },
  { ...base, group: 'Light', kind: 'prism', name: 'Glass prism', w: 240, h: 220, params: {},
    paint(c, _q, l) { poly(c, [120, 10, 232, 210, 8, 210], l.dark ? 'rgba(180,220,255,.22)' : 'rgba(150,200,240,.3)', l.dark ? '#d9edff' : '#2f6d9e', 3) } },
  { ...base, group: 'Magnets and forces', kind: 'bar-magnet', name: 'Bar magnet', w: 260, h: 70, params: { field: 0 },
    settings: [{ key: 'field', label: 'Show field lines', toggle: true }],
    paint(c, q, l) {
      if (q.field) {
        for (const k of [1, 2, 3]) for (const s of [-1, 1]) {
          c.beginPath(); c.moveTo(40, 35); c.bezierCurveTo(40 - 70 * k, 35 + s * 80 * k, 220 + 70 * k, 35 + s * 80 * k, 220, 35)
          c.strokeStyle = l.dark ? 'rgba(180,210,255,.65)' : 'rgba(47,107,255,.5)'; c.lineWidth = 2; c.stroke()
        }
      }
      box(c, 8, 10, 122, 50, 0, shade(c, 0, 10, 0, 60, ['#ec5a50', '#d43b33', '#a82620']), 'rgba(40,15,10,.6)')
      box(c, 130, 10, 122, 50, 0, shade(c, 0, 10, 0, 60, ['#5b84e8', '#2f5fd3', '#1f43a1']), 'rgba(10,15,40,.6)')
      text(c, 'N', 36, 35, 32, '#fff', 'center', 800); text(c, 'S', 224, 35, 32, '#fff', 'center', 800)
    } },
  { ...base, group: 'Magnets and forces', kind: 'compass', name: 'Compass', w: 150, h: 150, params: {},
    paint(c, _q, l) {
      disc(c, 75, 75, 68, shade(c, 10, 10, 140, 140, BRASS), 'rgba(40,25,10,.7)')
      disc(c, 75, 75, 56, '#fdfbf3', 'rgba(40,25,10,.4)')
      for (const [t, a] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]] as [string, number][]) { const r = a * Math.PI / 180; text(c, t, 75 + 44 * Math.sin(r), 75 - 44 * Math.cos(r), 16, '#2b2f36', 'center', 700) }
      const a = l.value ?? 0
      c.save(); c.translate(75, 75); c.rotate(a)
      poly(c, [0, -40, 8, 0, -8, 0], '#d43b33'); poly(c, [0, 40, 8, 0, -8, 0], '#50596a')
      c.restore()
      disc(c, 75, 75, 5, '#2b2f36')
    } },
  { ...base, group: 'Magnets and forces', kind: 'force', name: 'Force arrow', w: 320, h: 320, params: { x: 90, y: 0 },
    controls: [{ name: 'Arrow tip', at: q => [160 + q.x, 160 + q.y], reach: 34, drag: (q, x, y) => { q.x = Math.max(-150, Math.min(150, Math.round((x - 160) / 5) * 5)); q.y = Math.max(-150, Math.min(150, Math.round((y - 160) / 5) * 5)) } }],
    paint(c, q, l) {
      const L = Math.hypot(q.x, q.y) || 1, ux = q.x / L, uy = q.y / L, tx = 160 + q.x, ty = 160 + q.y, col = l.dark ? '#ff8a8a' : '#d43b33'
      disc(c, 160, 160, 6, col)
      if (L > 8) {
        line(c, 160, 160, tx - ux * 14, ty - uy * 14, col, 7)
        poly(c, [tx, ty, tx - ux * 24 - uy * 12, ty - uy * 24 + ux * 12, tx - ux * 24 + uy * 12, ty - uy * 24 - ux * 12], col)
      }
      grip(c, tx, ty, 11, col)
      // Ten board units stand for one newton.
      plate(c, `${(L / 10).toFixed(1)} N`, 160 + q.x / 2 - uy * 26, 160 + q.y / 2 + ux * 26, 17)
    } },
  { ...base, group: 'Measuring', kind: 'spring-balance', name: 'Spring balance', w: 100, h: 380, params: { g: 200 },
    settings: [{ key: 'g', label: 'Mass hanging', min: 0, max: 1000, step: 50, unit: 'g' }],
    controls: [{ name: 'Hook', at: q => [50, 140 + q.g * .16], reach: 40, drag: (q, _x, y) => { q.g = Math.max(0, Math.min(1000, Math.round((y - 140) / .16 / 50) * 50)) } }],
    paint(c, q) {
      const ext = q.g * .16, newtons = q.g / 1000 * G
      disc(c, 50, 10, 8, 'transparent', '#555', 3)
      box(c, 26, 18, 48, 240, 8, shade(c, 26, 0, 74, 0, ['#fafafa', '#d5d9de']))
      for (let i = 0; i <= 10; i++) { const y = 34 + i * 16; line(c, 30, y, i % 5 ? 40 : 46, y, '#2b2f36', 1.6); if (i % 5 === 0) text(c, String(i), 58, y, 13, '#2b2f36') }
      const py = 34 + ext
      c.beginPath(); for (let i = 0; i <= 12; i++) { const y = 22 + (py - 22) * i / 12; i ? c.lineTo(50 + (i % 2 ? 7 : -7), y) : c.moveTo(50, y) }
      c.strokeStyle = '#7f8a96'; c.lineWidth = 2; c.stroke()
      line(c, 26, py, 74, py, '#d43b33', 3)
      line(c, 50, py, 50, 136 + ext, '#6b7280', 3)
      grip(c, 50, 140 + ext, 10)
      if (q.g > 0) { const m = 16 + q.g * .018; box(c, 50 - m, 154 + ext, m * 2, 22 + q.g * .03, 4, shade(c, 0, 154 + ext, 0, 184 + ext, STEEL)); text(c, `${q.g} g`, 50, 165 + ext + q.g * .015, 13, '#172033', 'center', 700) }
      plate(c, `${newtons.toFixed(1)} N`, 50, 372, 15)
    } },
  { ...base, group: 'Motion', kind: 'pendulum', name: 'Pendulum', w: 300, h: 380, params: { l: .6, on: 0, angle: 18 },
    settings: [{ key: 'l', label: 'Length', min: .1, max: 1, step: .05, unit: 'm' }, { key: 'angle', label: 'Swing', min: 5, max: 30, step: 1, unit: '°' }],
    controls: [{ name: 'Start or stop the swing', at: () => [150, 20], reach: 40, tap: q => { q.on = q.on ? 0 : 1 } }],
    moving: q => !!q.on,
    paint(c, q, l) {
      const length = 40 + q.l * 290, omega = Math.sqrt(G / q.l), theta = q.on ? q.angle * Math.PI / 180 * Math.cos(omega * l.time) : 0
      box(c, 40, 8, 220, 22, 5, shade(c, 0, 8, 0, 30, WOOD))
      const bx = 150 + Math.sin(theta) * length, by = 30 + Math.cos(theta) * length
      line(c, 150, 30, bx, by, l.dark ? '#e6eaf0' : '#3b4252', 2.5)
      disc(c, bx, by, 18, shade(c, bx - 14, by - 14, bx + 14, by + 14, BRASS), 'rgba(40,25,10,.7)')
      plate(c, `T = ${(2 * Math.PI * Math.sqrt(q.l / G)).toFixed(2)} s`, 150, 366, 17)
      if (!q.on) plate(c, 'Tap the top to swing', 150, 50, 14)
    } },
  { ...base, group: 'Measuring', kind: 'vernier', name: 'Vernier caliper', w: 520, h: 160, params: { cm: 2.34 },
    controls: [{ name: 'Sliding jaw', at: q => [70 + q.cm * 30 + 24, 74], reach: 44, drag: (q, x) => { q.cm = Math.max(0, Math.min(14, Math.round((x - 94) / 30 * 100) / 100)) } }],
    paint(c, q, l) {
      const main = 70, per = 30, x = main + q.cm * per
      box(c, 40, 54, 470, 34, 3, shade(c, 0, 54, 0, 88, STEEL))
      for (let i = 0; i <= 140; i++) { const px = main + i * per / 10; line(c, px, 54, px, 54 + (i % 10 === 0 ? 16 : i % 5 === 0 ? 12 : 7), '#1b2436', 1); if (i % 10 === 0) text(c, String(i / 10), px, 76, 12, '#1b2436') }
      poly(c, [40, 54, 70, 54, 70, 150, 54, 150, 40, 110], shade(c, 40, 0, 70, 0, STEEL), '#3b4252', 1.5)
      box(c, x - 4, 88, 90, 28, 2, shade(c, 0, 88, 0, 116, ['#d9dee4', '#aeb6bf']), '#3b4252', 1.5)
      // Ten vernier divisions span nine main-scale millimetres: this is what gives 0.01 cm.
      for (let i = 0; i <= 10; i++) { const px = x + i * per * .09; line(c, px, 88, px, 88 + (i % 5 === 0 ? 12 : 8), '#c0261e', 1.3); if (i % 5 === 0) text(c, String(i), px, 106, 10, '#c0261e') }
      poly(c, [x, 88, x + 30, 88, x + 30, 116, x + 16, 150, x, 150], shade(c, x, 0, x + 30, 0, STEEL), '#3b4252', 1.5)
      grip(c, x + 24, 74, 12)
      plate(c, `${q.cm.toFixed(2)} cm`, 260, 22, 20)
      void l
    } },
  { ...base, group: 'Measuring', kind: 'thermometer', subject: 'chemistry', name: 'Thermometer', w: 70, h: 360, params: { c: 27 },
    controls: [{ name: 'Temperature', at: q => [35, 300 - (q.c + 10) * 2.3], reach: 26, drag: (q, _x, y) => { q.c = Math.max(-10, Math.min(110, Math.round((300 - y) / 2.3 - 10))) } }],
    paint(c, q, l) {
      const temp = l.value ?? q.c, y = 300 - (temp + 10) * 2.3
      box(c, 26, 10, 18, 306, 9, l.dark ? 'rgba(235,245,255,.22)' : 'rgba(225,235,245,.75)', l.dark ? '#e6f0fa' : '#3b4d5c')
      disc(c, 35, 330, 22, '#d43b33', l.dark ? '#e6f0fa' : '#3b4d5c')
      box(c, 30, y, 10, 318 - y, 2, '#d43b33', '')
      for (let t = -10; t <= 110; t += 10) { const py = 300 - (t + 10) * 2.3; line(c, 44, py, t % 50 === 0 ? 56 : 50, py, ink(l), 1.6); if (t % 20 === 0) text(c, String(t), 66, py, 11, ink(l), 'right') }
      plate(c, `${Math.round(temp)} °C`, 35, 330, 13, '#7a1912')
      if (l.value === undefined) grip(c, 35, y, 9, '#d43b33')
    } }
]
addParts(PHYSICS)
