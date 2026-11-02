import type { Part } from './parts'
import { BRASS, STEEL, WOOD, addParts, box, disc, grip, ink, line, plate, poly, shade, text } from './parts'

const base = { subject: 'physics' as const }
const G = 9.8

/** Rays and lenses are placed like any object: world.ts traces the beam through whatever is on the page. */
export const PHYSICS: Part[] = [
  { ...base, group: 'Light', kind: 'ray-box', name: 'Ray box', w: 170, h: 100, params: { beams: 3 },
    settings: [{ key: 'beams', label: 'Beams', choices: ['One', 'Three', 'Five'], apply: (v, q) => { q.beams = [1, 3, 5][v] } }],
    paint(c, q) {
      box(c, 8, 16, 130, 68, 8, shade(c, 0, 16, 0, 84, ['#4a4f58', '#2b2f36', '#17191d']))
      box(c, 16, 23, 112, 4, 2, 'rgba(255,255,255,.15)', '')
      for (let x = 24; x < 124; x += 12) line(c, x, 70, x + 5, 70, '#87919c', 2)
      box(c, 138, 26, 24, 48, 3, shade(c, 138, 0, 162, 0, ['#c5b179', '#fff0b0', '#a18e59']))
      for (let i = 0; i < q.beams; i++) {
        const y = 50 + (q.beams > 1 ? (i - (q.beams - 1) / 2) * 44 / (q.beams - 1) : 0)
        line(c, 151, y, 162, y, '#fff7d3', 2.5)
      }
      for (const x of [17, 128]) disc(c, x, 34, 2, '#aab3bc')
      text(c, 'LIGHT', 72, 49, 16, '#ffe9a2', 'center', 700)
    } },
  ...([['convex-lens', 'Convex lens', 150], ['concave-lens', 'Concave lens', -150]] as [string, string, number][]).map(([kind, name, focal]): Part => ({
    ...base, group: 'Light', kind, name, w: 110, h: 280, params: { f: focal },
    settings: [{ key: 'f', label: 'Focal length', min: 50, max: 300, step: 10, unit: 'units', apply: (v, q) => { q.f = focal > 0 ? v : -v } }],
    paint(c, q, l) {
      const bulge = q.f > 0 ? 34 : -22, edge = q.f > 0 ? 8 : 30
      c.beginPath(); c.moveTo(55 - edge, 14); c.quadraticCurveTo(55 - edge - bulge * 2, 140, 55 - edge, 266); c.lineTo(55 + edge, 266); c.quadraticCurveTo(55 + edge + bulge * 2, 140, 55 + edge, 14); c.closePath()
      c.fillStyle = shade(c, 10, 0, 100, 0, l.dark ? ['rgba(175,219,249,.3)', 'rgba(228,245,255,.08)', 'rgba(175,219,249,.35)'] : ['rgba(91,159,195,.25)', 'rgba(226,242,249,.12)', 'rgba(91,159,195,.3)']); c.fill()
      c.strokeStyle = l.dark ? '#d2e8f5' : '#42768d'; c.lineWidth = 2.5; c.stroke()
      c.save(); c.clip(); line(c, 40, 34, 40, 234, 'rgba(255,255,255,.65)', 3); c.restore()
      // The stored sign follows NCERT's Cartesian convention; these are board units, not cm.
      plate(c, `f = ${q.f < 0 ? '−' : '+'}${Math.abs(q.f)} units`, 55, 266, 12)
    }
  })),
  { ...base, group: 'Light', kind: 'mirror', name: 'Plane mirror', w: 50, h: 280, params: {},
    paint(c, _q, l) {
      box(c, 22, 10, 12, 260, 3, shade(c, 22, 0, 34, 0, ['#f4f8fb', '#a9bccb']), l.dark ? '#dfeaf3' : '#3b4d5c')
      line(c, 23, 14, 23, 266, l.dark ? '#ffffff' : '#426477', 2)
      for (let y = 18; y < 266; y += 16) line(c, 34, y, 44, y + 8, l.dark ? '#dfeaf3' : '#3b4d5c', 2)
    } },
  { ...base, group: 'Light', kind: 'prism', name: 'Glass prism', w: 240, h: 220, params: {},
    paint(c, _q, l) {
      // Keep the optical faces at exactly the coordinates traced by the world.
      poly(c, [120, 10, 232, 210, 8, 210], shade(c, 30, 40, 210, 200, l.dark ? ['rgba(215,238,249,.3)', 'rgba(122,186,218,.08)', 'rgba(174,219,242,.3)'] : ['rgba(228,244,250,.5)', 'rgba(131,190,214,.14)', 'rgba(99,156,184,.3)']), l.dark ? '#d9edff' : '#42768d', 2.5)
      poly(c, [120, 24, 223, 204, 19, 204], null, l.dark ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.8)', 1.5)
    } },
  { ...base, group: 'Magnets and forces', kind: 'bar-magnet', name: 'Bar magnet', w: 260, h: 70, params: { field: 0 },
    settings: [{ key: 'field', label: 'Show field lines', toggle: true }],
    paint(c, q, l) {
      if (q.field) {
        for (const height of [29, 34, 39]) for (const s of [-1, 1]) {
          const controlY = 35 + s * height, arrowY = 35 + s * height * .75
          c.beginPath(); c.moveTo(20, 35); c.bezierCurveTo(10, controlY, 250, controlY, 240, 35)
          const color = l.dark ? '#a4d2df' : '#42798b'
          c.strokeStyle = color; c.lineWidth = 1.2; c.stroke()
          poly(c, [135, arrowY, 129, arrowY - 2.7, 129, arrowY + 2.7], color)
        }
      }
      box(c, 8, 17, 122, 36, 2, shade(c, 0, 17, 0, 53, ['#e67c6b', '#ba453c', '#90372f']), '#67382e', 1)
      box(c, 130, 17, 122, 36, 2, shade(c, 0, 17, 0, 53, ['#7196bb', '#426e99', '#31516f']), '#304b63', 1)
      text(c, 'N', 30, 35, 20, '#fff', 'center', 700); text(c, 'S', 230, 35, 20, '#fff', 'center', 700)
      if (q.field) { line(c, 178, 35, 82, 35, '#fff3da', 1.2); poly(c, [125, 35, 131, 32, 131, 38], '#fff3da') }
    } },
  { ...base, group: 'Magnets and forces', kind: 'compass', name: 'Compass', w: 150, h: 150, params: {},
    paint(c, _q, l) {
      disc(c, 75, 75, 68, shade(c, 10, 10, 140, 140, BRASS), 'rgba(40,25,10,.7)')
      disc(c, 75, 75, 56, '#fdfbf3', 'rgba(40,25,10,.4)')
      for (let i = 0; i < 32; i++) {
        if (i % 8 === 0) continue // Leave the cardinal letters clear.
        const a = i * Math.PI / 16, r = i % 4 ? 49 : 46
        line(c, 75 + 52 * Math.sin(a), 75 - 52 * Math.cos(a), 75 + r * Math.sin(a), 75 - r * Math.cos(a), '#8d8a79', i % 8 ? .8 : 1.2)
      }
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
      const L = Math.hypot(q.x, q.y), ux = L ? q.x / L : 1, uy = L ? q.y / L : 0, tx = 160 + q.x, ty = 160 + q.y, col = l.dark ? '#ffaaa0' : '#b84b40'
      disc(c, 160, 160, 6, col)
      if (L > 8) {
        line(c, 160, 160, tx - ux * 14, ty - uy * 14, col, 7)
        poly(c, [tx, ty, tx - ux * 24 - uy * 12, ty - uy * 24 + ux * 12, tx - ux * 24 + uy * 12, ty - uy * 24 - ux * 12], col)
      }
      grip(c, tx, ty, 8, col)
      // Ten board units stand for one newton.
      plate(c, `${(L / 10).toFixed(1)} N`, 160 + q.x / 2 - uy * 26, 160 + q.y / 2 + ux * 26, 17)
    } },
  { ...base, group: 'Measuring', kind: 'spring-balance', name: 'Spring balance', w: 100, h: 380, params: { g: 200 },
    settings: [{ key: 'g', label: 'Mass hanging', min: 0, max: 1000, step: 50, unit: 'g' }],
    controls: [{ name: 'Hook', at: q => [50, 140 + q.g * .16], reach: 40, drag: (q, _x, y) => { q.g = Math.max(0, Math.min(1000, Math.round((y - 140) / .16 / 50) * 50)) } }],
    paint(c, q, l) {
      const ext = q.g * .16, newtons = q.g / 1000 * G
      disc(c, 50, 10, 8, 'transparent', l.dark ? '#d2d9dd' : '#555', 2.5)
      box(c, 26, 18, 48, 240, 8, shade(c, 26, 0, 74, 0, ['#fafafa', '#d5d9de']))
      // Pointer displacement is fixed by the hook control; graduate it in newtons using the same g.
      for (let i = 0; i <= 20; i++) { const n = i / 2, y = 34 + n / G * 160; line(c, 30, y, i % 2 ? 36 : 40, y, '#39434b', i % 2 ? .8 : 1.2); if (i % 10 === 0) text(c, String(n), 88, y, 12, ink(l)) }
      text(c, 'N', 88, 218, 12, ink(l))
      const py = 34 + ext
      c.beginPath(); for (let i = 0; i <= 12; i++) { const y = 22 + (py - 22) * i / 12; i ? c.lineTo(50 + (i % 2 ? 7 : -7), y) : c.moveTo(50, y) }
      c.strokeStyle = '#7f8a96'; c.lineWidth = 1.8; c.stroke()
      line(c, 27, py, 54, py, '#b64637', 2.5)
      line(c, 50, py, 50, 136 + ext, '#6b7280', 3)
      grip(c, 50, 140 + ext, 10)
      if (q.g > 0) { const m = 16 + q.g * .018, height = 22 + q.g * .012; box(c, 50 - m, 154 + ext, m * 2, height, 4, shade(c, 0, 154 + ext, 0, 154 + ext + height, STEEL)); text(c, `${q.g} g`, 50, 154 + ext + height / 2, 12, '#172033', 'center', 600) }
      plate(c, `${newtons.toFixed(1)} N`, 50, 367, 14)
    } },
  { ...base, group: 'Motion', kind: 'pendulum', name: 'Pendulum', w: 300, h: 380, params: { l: .6, on: 0, angle: 18 },
    settings: [{ key: 'l', label: 'Length', min: .1, max: 1, step: .05, unit: 'm' }, { key: 'angle', label: 'Swing', min: 5, max: 30, step: 1, unit: '°' }],
    controls: [{ name: 'Start or stop the swing', at: () => [150, 20], reach: 40, tap: q => { q.on = q.on ? 0 : 1 } }],
    moving: q => !!q.on,
    paint(c, q, l) {
      const length = 260 * q.l, omega = Math.sqrt(G / q.l), theta = q.on ? q.angle * Math.PI / 180 * Math.cos(omega * l.time) : 0
      box(c, 40, 8, 220, 22, 5, shade(c, 0, 8, 0, 30, WOOD))
      for (const x of [52, 248]) { disc(c, x, 19, 3, '#685544'); line(c, x - 1.5, 19, x + 1.5, 19, '#dbcaad', .8) }
      line(c, 150, 31, 150, 316, l.dark ? 'rgba(220,229,235,.3)' : 'rgba(63,81,91,.22)', 1)
      const bx = 150 + Math.sin(theta) * length, by = 30 + Math.cos(theta) * length
      line(c, 150, 30, bx, by, l.dark ? '#e6eaf0' : '#3b4252', 2.5)
      disc(c, bx, by, 18, shade(c, bx - 14, by - 14, bx + 14, by + 14, BRASS), 'rgba(40,25,10,.7)')
      disc(c, 150, 30, 4, '#665343')
      text(c, `L = ${q.l.toFixed(2)} m`, 150, 323, 14, ink(l))
      plate(c, `T ≈ ${(2 * Math.PI * Math.sqrt(q.l / G)).toFixed(2)} s`, 150, 349, 16)
      text(c, 'Small-angle model', 150, 372, 12, ink(l))
      if (!q.on) plate(c, 'Tap the top to swing', 150, length < 90 ? 30 + length + 38 : 50, 14)
    } },
  { ...base, group: 'Measuring', kind: 'vernier', name: 'Vernier callipers', w: 520, h: 160, params: { cm: 2.34 },
    controls: [{ name: 'Sliding jaw', at: q => [70 + q.cm * 30 + 24, 74], reach: 44, drag: (q, x) => { q.cm = Math.max(0, Math.min(14, Math.round((x - 94) / 30 * 100) / 100)) } }],
    paint(c, q, l) {
      const main = 70, per = 30, x = main + q.cm * per
      box(c, 40, 54, 470, 34, 3, shade(c, 0, 54, 0, 88, STEEL))
      for (let i = 0; i <= 140; i++) { const px = main + i * per / 10; line(c, px, 54, px, 54 + (i % 10 === 0 ? 16 : i % 5 === 0 ? 12 : 7), '#1b2436', 1); if (i % 10 === 0) text(c, String(i / 10), px, 76, 12, '#1b2436') }
      poly(c, [40, 54, 70, 54, 70, 150, 54, 150, 40, 110], shade(c, 40, 0, 70, 0, STEEL), '#3b4252', 1.5)
      poly(c, [54, 54, 54, 18, 70, 40, 70, 54], shade(c, 54, 0, 70, 0, STEEL), '#596673', 1.2)
      poly(c, [x, 54, x, 40, x + 14, 18, x + 14, 54], shade(c, x, 0, x + 14, 0, STEEL), '#596673', 1.2)
      box(c, x - 4, 88, 33, 28, 2, shade(c, 0, 88, 0, 116, ['#edf0f2', '#b8c1c9']), '#3b4252', 1.2)
      // Ten vernier divisions span nine main-scale millimetres: this is what gives 0.01 cm.
      for (let i = 0; i <= 10; i++) { const px = x + i * per * .09; line(c, px, 88, px, 88 + (i % 5 === 0 ? 12 : 8), '#a94437', 1); if (i % 5 === 0) text(c, String(i), px, 106, 8, '#a94437', i === 10 ? 'right' : i === 0 ? 'left' : 'center') }
      poly(c, [x, 116, x + 28, 116, x + 16, 150, x, 150], shade(c, x, 0, x + 28, 0, STEEL), '#3b4252', 1.2)
      grip(c, x + 24, 74, Math.max(4, Math.min(10, 518 - x - 24)))
      plate(c, `${q.cm.toFixed(2)} cm`, 260, 22, 18)
      text(c, 'Least count 0.01 cm', 290, 136, 12, ink(l))
      void l
    } },
  { ...base, group: 'Measuring', kind: 'thermometer', subject: 'chemistry', name: 'Laboratory thermometer', w: 70, h: 360, params: { c: 27 },
    controls: [{ name: 'Temperature', at: q => [35, 300 - (q.c + 10) * 2.3], reach: 26, drag: (q, _x, y) => { q.c = Math.max(-10, Math.min(110, Math.round((300 - y) / 2.3 - 10))) } }],
    paint(c, q, l) {
      const temp = l.value ?? q.c, y = 300 - (temp + 10) * 2.3
      box(c, 26, 10, 18, 306, 9, l.dark ? 'rgba(235,245,255,.22)' : 'rgba(225,235,245,.75)', l.dark ? '#e6f0fa' : '#3b4d5c')
      disc(c, 35, 330, 22, '#d43b33', l.dark ? '#e6f0fa' : '#3b4d5c')
      box(c, 30, y, 10, 318 - y, 2, '#d43b33', '')
      line(c, 28, 18, 28, 303, 'rgba(255,255,255,.65)', 1)
      for (let t = -10; t <= 110; t += 5) { const py = 300 - (t + 10) * 2.3; line(c, 44, py, t % 10 === 0 ? 53 : 49, py, ink(l), t % 10 === 0 ? 1.3 : .7); if (t % 20 === 0 || t === -10 || t === 110) text(c, String(t), 22, py, 10, ink(l), 'right') }
      text(c, '°C', 57, 12, 11, ink(l))
      plate(c, `${Math.round(temp)} °C`, 35, 330, 13, '#7a1912')
      if (l.value === undefined) grip(c, 35, y, 9, '#d43b33')
    } }
]
addParts(PHYSICS)
