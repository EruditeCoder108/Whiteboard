import type { Part } from './parts'
import { addParts, box, disc, grip, ink, line, plate, poly, shade, text } from './parts'
import { AMBER, DARK_METAL, EDGE, GRAPHITE, IVORY, RED, R_BRASS, R_STEEL, glow, handle, mount, print, readout, screw } from './look'

const base = { subject: 'physics' as const }
const G = 9.8
/** How far the spring balance's spring stretches for each gram, in the part's units. */
const STRETCH = .11

/** Rays and lenses are placed like any object: world.ts traces the beam through whatever is on the page. */
export const PHYSICS: Part[] = [
  { ...base, group: 'Light', kind: 'ray-box', name: 'Ray box', w: 170, h: 100, params: { beams: 3 },
    settings: [{ key: 'beams', label: 'Beams', choices: ['One', 'Three', 'Five'], apply: (v, q) => { q.beams = [1, 3, 5][v] } }],
    paint(c, q) {
      box(c, 8, 14, 124, 72, 3, shade(c, 0, 14, 0, 86, GRAPHITE), EDGE, 2)
      line(c, 11, 16, 129, 16, 'rgba(255,255,255,.2)', 1.5)
      for (let x = 22; x < 122; x += 12) { c.fillStyle = '#14181c'; c.fillRect(x, 24, 6, 14) }
      print(c, 'RAY BOX', 70, 62, 16, undefined, 700)
      disc(c, 120, 74, 4, AMBER, EDGE, 1)
      // The lamp's light leaves through a slit plate: one slit for each beam.
      box(c, 132, 22, 16, 56, 1, shade(c, 0, 22, 0, 78, DARK_METAL), EDGE, 1.5)
      box(c, 148, 24, 14, 52, 1, '#14181c', EDGE, 1.5)
      for (let i = 0; i < q.beams; i++) {
        const y = 50 + (q.beams > 1 ? (i - (q.beams - 1) / 2) * 44 / (q.beams - 1) : 0)
        glow(c, 158, y, 12, '255,226,140', .6)
        c.fillStyle = '#fff7d3'; c.fillRect(150, y - 1.5, 12, 3)
      }
    } },
  ...([['convex-lens', 'Convex lens', 150], ['concave-lens', 'Concave lens', -150]] as [string, string, number][]).map(([kind, name, focal]): Part => ({
    ...base, group: 'Light', kind, name, w: 110, h: 280, params: { f: focal },
    settings: [{ key: 'f', label: 'Focal length', min: 50, max: 300, step: 10, unit: 'units', apply: (v, q) => { q.f = focal > 0 ? v : -v } }],
    paint(c, q, l) {
      // A shorter focal length is a more curved lens.
      const power = Math.min(1.4, 150 / Math.abs(q.f)), bulge = q.f > 0 ? 22 + 16 * power : -(10 + 8 * power), edge = q.f > 0 ? 6 : 30
      const outline = l.dark ? '#d2e8f5' : '#42768d'
      for (const y of [8, 266]) box(c, 55 - edge - 5, y, edge * 2 + 10, 6, 1, shade(c, 0, y, 0, y + 6, R_STEEL), EDGE, 1.2)
      const lens = (): void => { c.beginPath(); c.moveTo(55 - edge, 12); c.quadraticCurveTo(55 - edge - bulge * 2, 140, 55 - edge, 268); c.lineTo(55 + edge, 268); c.quadraticCurveTo(55 + edge + bulge * 2, 140, 55 + edge, 12); c.closePath() }
      lens()
      c.fillStyle = shade(c, 8, 0, 102, 0, l.dark ? ['rgba(175,219,249,.34)', 'rgba(228,245,255,.08)', 'rgba(175,219,249,.38)'] : ['rgba(91,159,195,.34)', 'rgba(226,242,249,.16)', 'rgba(91,159,195,.4)']); c.fill()
      c.strokeStyle = outline; c.lineWidth = 2.5; c.lineJoin = 'miter'; c.stroke()
      c.save(); lens(); c.clip()
      const shine = 55 - edge - bulge * .55
      c.beginPath(); c.moveTo(shine + bulge * .3, 36); c.quadraticCurveTo(shine - bulge * .3, 140, shine + bulge * .3, 244); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3; c.stroke()
      c.restore()
      // The stored sign follows NCERT's Cartesian convention; these are board units, not cm.
      readout(c, `f = ${q.f < 0 ? '−' : '+'}${Math.abs(q.f)} units`, 55, 248, 11)
    }
  })),
  { ...base, group: 'Light', kind: 'mirror', name: 'Plane mirror', w: 50, h: 280, params: {},
    paint(c, _q, l) {
      const back = l.dark ? '#dfeaf3' : '#3b4d5c'
      // Hatching on the back is how a mirror is drawn in a ray diagram.
      for (let y = 16; y < 264; y += 14) line(c, 31, y, 43, y + 10, back, 1.8)
      box(c, 19, 10, 12, 260, 1, shade(c, 19, 0, 31, 0, ['#ffffff', '#c7d6e1', '#8fa3b2']), back, 2)
      for (const y of [6, 268]) box(c, 14, y, 22, 6, 1, shade(c, 0, y, 0, y + 6, R_STEEL), EDGE, 1.2)
    } },
  { ...base, group: 'Light', kind: 'prism', name: 'Glass prism', w: 240, h: 220, params: {},
    paint(c, _q, l) {
      // Keep the optical faces at exactly the coordinates traced by the world.
      poly(c, [120, 10, 232, 210, 8, 210], shade(c, 30, 40, 210, 200, l.dark ? ['rgba(215,238,249,.34)', 'rgba(122,186,218,.1)', 'rgba(174,219,242,.34)'] : ['rgba(214,236,246,.6)', 'rgba(131,190,214,.2)', 'rgba(82,142,172,.42)']), l.dark ? '#d9edff' : '#42768d', 2.5)
      poly(c, [120, 28, 218, 203, 22, 203], null, l.dark ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.85)', 1.5)
      line(c, 112, 42, 44, 164, 'rgba(255,255,255,.75)', 3)
    } },
  { ...base, group: 'Magnets and forces', kind: 'bar-magnet', name: 'Bar magnet', w: 260, h: 70, params: { field: 0 },
    settings: [{ key: 'field', label: 'Show field lines', toggle: true }],
    paint(c, q, l) {
      if (q.field) {
        const color = l.dark ? '#a4d2df' : '#42798b'
        // Out of the north pole, round, and into the south.
        for (const height of [44, 76, 112]) for (const s of [-1, 1]) {
          c.beginPath(); c.moveTo(28, 35 + s * 12); c.bezierCurveTo(-14, 35 + s * height * 1.3, 274, 35 + s * height * 1.3, 232, 35 + s * 12)
          c.strokeStyle = color; c.lineWidth = 1.5; c.stroke()
          const y = 35 + s * (3 + height * .975)
          poly(c, [136, y, 128, y - 4, 128, y + 4], color)
        }
        line(c, 6, 35, -30, 35, color, 1.5); poly(c, [-34, 35, -26, 31, -26, 39], color)
        line(c, 292, 35, 256, 35, color, 1.5); poly(c, [254, 35, 262, 31, 262, 39], color)
      }
      box(c, 8, 17, 122, 36, 1, shade(c, 0, 17, 0, 53, ['#d8574b', '#ba3a30', '#8f2a22']), EDGE, 1.5)
      box(c, 130, 17, 122, 36, 1, shade(c, 0, 17, 0, 53, ['#5f86ad', '#3d6891', '#2b4b6b']), EDGE, 1.5)
      line(c, 10, 20, 250, 20, 'rgba(255,255,255,.28)', 2)
      text(c, 'N', 30, 36, 23, '#fff', 'center', 700); text(c, 'S', 230, 36, 23, '#fff', 'center', 700)
      if (q.field) { line(c, 178, 35, 86, 35, '#fff3da', 1.5); poly(c, [80, 35, 88, 31, 88, 39], '#fff3da') }
    } },
  { ...base, group: 'Magnets and forces', kind: 'compass', name: 'Compass', w: 150, h: 150, params: {},
    paint(c, _q, l) {
      disc(c, 75, 75, 70, shade(c, 10, 10, 140, 140, ['#f6e2a4', '#c9a24f', '#7a5c22']), EDGE, 2)
      disc(c, 75, 75, 60, shade(c, 140, 140, 10, 10, ['#f6e2a4', '#a9843a']), 'rgba(40,25,10,.6)', 1)
      disc(c, 75, 75, 55, shade(c, 0, 20, 0, 130, IVORY), EDGE, 1.5)
      for (let i = 0; i < 32; i++) {
        if (i % 8 === 0) continue // Leave the cardinal letters clear.
        const a = i * Math.PI / 16, r = i % 4 ? 49 : 45
        line(c, 75 + 53 * Math.sin(a), 75 - 53 * Math.cos(a), 75 + r * Math.sin(a), 75 - r * Math.cos(a), '#6e6b5e', i % 4 ? 1 : 1.6)
      }
      for (const [t, a] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]] as [string, number][]) { const r = a * Math.PI / 180; text(c, t, 75 + 43 * Math.sin(r), 75 - 43 * Math.cos(r), 16, t === 'N' ? RED : '#23282e', 'center', 700) }
      const a = l.value ?? 0
      c.save(); c.translate(75, 75); c.rotate(a)
      poly(c, [0, -38, 7, 0, -7, 0], RED); poly(c, [0, 38, 7, 0, -7, 0], '#3f4852')
      poly(c, [0, -38, 0, 0, -7, 0], 'rgba(255,255,255,.2)')
      c.restore()
      disc(c, 75, 75, 5, shade(c, 70, 70, 80, 80, R_BRASS), EDGE, 1.2)
      c.beginPath(); c.arc(75, 75, 47, Math.PI * 1.05, Math.PI * 1.45); c.strokeStyle = 'rgba(255,255,255,.65)'; c.lineWidth = 3; c.stroke()
    } },
  { ...base, group: 'Magnets and forces', kind: 'force', name: 'Force arrow', w: 320, h: 320, params: { x: 90, y: 0 },
    controls: [{ name: 'Arrow tip', at: q => [160 + q.x, 160 + q.y], reach: 34, drag: (q, x, y) => { q.x = Math.max(-150, Math.min(150, Math.round((x - 160) / 5) * 5)); q.y = Math.max(-150, Math.min(150, Math.round((y - 160) / 5) * 5)) } }],
    paint(c, q, l) {
      const L = Math.hypot(q.x, q.y), ux = L ? q.x / L : 1, uy = L ? q.y / L : 0, tx = 160 + q.x, ty = 160 + q.y, col = l.dark ? '#ff9c8f' : RED
      disc(c, 160, 160, 6, col)
      if (L > 8) {
        line(c, 160, 160, tx - ux * 14, ty - uy * 14, col, 6)
        poly(c, [tx, ty, tx - ux * 24 - uy * 11, ty - uy * 24 + ux * 11, tx - ux * 24 + uy * 11, ty - uy * 24 - ux * 11], col)
      }
      handle(c, tx, ty, 8)
      // Ten board units stand for one newton.
      readout(c, `${(L / 10).toFixed(1)} N`, 160 + q.x / 2 - uy * 26, 160 + q.y / 2 + ux * 26, 16)
    } },
  { ...base, group: 'Measuring', kind: 'spring-balance', name: 'Spring balance', w: 100, h: 380, params: { g: 200 },
    settings: [{ key: 'g', label: 'Mass hanging', min: 0, max: 1000, step: 50, unit: 'g' }],
    controls: [{ name: 'Hook', at: q => [50, 172 + q.g * STRETCH], reach: 40, drag: (q, _x, y) => { q.g = Math.max(0, Math.min(1000, Math.round((y - 172) / STRETCH / 50) * 50)) } }],
    paint(c, q, l) {
      const ext = q.g * STRETCH, newtons = q.g / 1000 * G, py = 36 + ext, hook = 172 + ext
      disc(c, 50, 10, 7, 'transparent', l.dark ? '#d2d9dd' : '#4c555f', 3)
      // The rod carries the pointer down inside the case, and the hook outside it.
      line(c, 50, 150, 50, hook - 8, l.dark ? '#c5ced6' : '#5c6670', 3)
      box(c, 20, 17, 60, 143, 3, shade(c, 20, 0, 80, 0, ['#8d98a2', '#e6ebef', '#b7c0c8', '#7c8791']), EDGE, 2)
      box(c, 26, 24, 48, 129, 1, shade(c, 0, 24, 0, 153, IVORY), EDGE, 1)
      box(c, 42, 28, 16, 121, 1, '#2b3138', EDGE, 1)
      // Pointer displacement is fixed by the hook control; graduate it in newtons using the same g.
      for (let i = 0; i <= 20; i++) { const n = i / 2, y = 36 + n / G * 1000 * STRETCH; line(c, 60, y, i % 2 ? 65 : 71, y, '#23282e', i % 2 ? .9 : 1.5); if (i % 10 === 0) text(c, String(n), 34, y, 11, '#23282e', 'center', 700) }
      text(c, 'N', 34, 66, 11, '#5c6670', 'center', 700)
      c.beginPath(); for (let i = 0; i <= 12; i++) { const y = 28 + (py - 28) * i / 12; i ? c.lineTo(50 + (i % 2 ? 6 : -6), y) : c.moveTo(50, y) }
      c.strokeStyle = '#cfd6dc'; c.lineWidth = 1.8; c.lineJoin = 'miter'; c.stroke()
      c.fillStyle = RED; c.fillRect(41, py - 1.5, 21, 3)
      if (q.g > 0) { const m = 16 + q.g * .018, height = 22 + q.g * .012, top = hook + 12; box(c, 50 - m, top, m * 2, height, 1, shade(c, 0, top, 0, top + height, R_STEEL), EDGE, 1.5); text(c, `${q.g} g`, 50, top + height / 2, 12, '#172033', 'center', 700) }
      handle(c, 50, hook, 10)
      readout(c, `${newtons.toFixed(1)} N`, 50, hook + (q.g > 0 ? 34 + 22 + q.g * .012 : 30), 15)
    } },
  { ...base, group: 'Motion', kind: 'pendulum', name: 'Pendulum', w: 300, h: 380, params: { l: .6, on: 0, angle: 18 },
    settings: [{ key: 'l', label: 'Length', min: .1, max: 1, step: .05, unit: 'm' }, { key: 'angle', label: 'Swing', min: 5, max: 30, step: 1, unit: '°' }],
    controls: [{ name: 'Start or stop the swing', at: () => [150, 20], reach: 40, tap: q => { q.on = q.on ? 0 : 1 } }],
    moving: q => !!q.on,
    paint(c, q, l) {
      const length = 260 * q.l, omega = Math.sqrt(G / q.l), theta = q.on ? q.angle * Math.PI / 180 * Math.cos(omega * l.time) : 0, muted = l.dark ? 'rgba(220,229,235,.45)' : 'rgba(63,81,91,.45)'
      // A stand: a heavy foot, an upright rod, an arm, and a clamp that holds the thread.
      box(c, 26, 14, 10, 330, 1, shade(c, 26, 0, 36, 0, R_STEEL), EDGE, 1.5)
      box(c, 22, 12, 138, 9, 1, shade(c, 0, 12, 0, 21, R_STEEL), EDGE, 1.5)
      mount(c, 10, 340, 280, 36)
      print(c, `L = ${q.l.toFixed(2)} m`, 58, 357, 14)
      readout(c, `T ≈ ${(2 * Math.PI * Math.sqrt(q.l / G)).toFixed(2)} s`, 136, 357, 14)
      print(c, 'Small-angle model', 236, 357, 11, undefined, 500)
      // A scale behind the swing, in degrees.
      c.setLineDash([4, 5]); c.lineCap = 'butt'; line(c, 150, 34, 150, Math.min(330, 34 + length), muted, 1); c.setLineDash([])
      c.beginPath(); c.arc(150, 30, 92, Math.PI / 2 - .5236, Math.PI / 2 + .5236); c.strokeStyle = muted; c.lineWidth = 1; c.stroke()
      for (let d = -30; d <= 30; d += 5) { const a = d * Math.PI / 180, r0 = 92, r1 = d % 15 ? 97 : 102; line(c, 150 + r0 * Math.sin(a), 30 + r0 * Math.cos(a), 150 + r1 * Math.sin(a), 30 + r1 * Math.cos(a), muted, d % 15 ? 1 : 1.6) }
      const bx = 150 + Math.sin(theta) * length, by = 30 + Math.cos(theta) * length
      line(c, 150, 30, bx, by, l.dark ? '#e6eaf0' : '#3b4252', 2)
      disc(c, bx, by, 18, shade(c, bx - 14, by - 14, bx + 14, by + 14, ['#f6e2a4', '#c9a24f', '#7a5c22']), EDGE, 1.5)
      disc(c, bx - 6, by - 6, 3.5, 'rgba(255,255,255,.7)')
      box(c, 140, 8, 20, 26, 1, shade(c, 0, 8, 0, 34, DARK_METAL), EDGE, 1.5)
      screw(c, 150, 18, 4)
      if (!q.on) readout(c, 'Tap the top to swing', 226, 60, 13)
    } },
  { ...base, group: 'Measuring', kind: 'vernier', name: 'Vernier callipers', w: 520, h: 160, params: { cm: 2.34 },
    controls: [{ name: 'Sliding jaw', at: q => [70 + q.cm * 30 + 10, 132], reach: 44, drag: (q, x) => { q.cm = Math.max(0, Math.min(14, Math.round((x - 80) / 30 * 100) / 100)) } }],
    paint(c, q, l) {
      const main = 70, per = 30, x = main + q.cm * per, steel = ['#f1f4f6', '#c5cdd4', '#98a3ad']
      readout(c, `${q.cm.toFixed(2)} cm`, 290, 24, 17)
      text(c, 'Least count 0.01 cm', 300, 118, 12, ink(l))
      box(c, 40, 54, 470, 34, 1, shade(c, 0, 54, 0, 88, steel), EDGE, 1.5)
      for (let i = 0; i <= 140; i++) { const px = main + i * per / 10; line(c, px, 54, px, 54 + (i % 10 === 0 ? 16 : i % 5 === 0 ? 12 : 7), '#1b2436', i % 10 === 0 ? 1.3 : .9); if (i % 10 === 0 && i) text(c, String(i / 10), px, 78, 12, '#1b2436', 'center', 600) }
      c.lineJoin = 'miter'
      poly(c, [40, 54, 70, 54, 70, 150, 56, 150, 40, 110], shade(c, 40, 0, 70, 0, steel), EDGE, 1.5)
      poly(c, [54, 54, 54, 20, 70, 40, 70, 54], shade(c, 54, 0, 70, 0, steel), EDGE, 1.5)
      poly(c, [x, 54, x, 40, x + 14, 20, x + 14, 54], shade(c, x, 0, x + 14, 0, steel), EDGE, 1.5)
      box(c, x - 4, 88, 36, 28, 1, shade(c, 0, 88, 0, 116, ['#f4f7f9', '#c5cdd4']), EDGE, 1.5)
      // Ten vernier divisions span nine main-scale millimetres: this is what gives 0.01 cm.
      for (let i = 0; i <= 10; i++) { const px = x + i * per * .09; line(c, px, 88, px, 88 + (i % 5 === 0 ? 12 : 8), RED, 1); if (i % 5 === 0) text(c, String(i), px, 107, 8, RED, i === 0 ? 'left' : 'center', 700) }
      poly(c, [x, 116, x + 30, 116, x + 16, 150, x, 150], shade(c, x, 0, x + 30, 0, steel), EDGE, 1.5)
      handle(c, x + 10, 132, 9)
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
