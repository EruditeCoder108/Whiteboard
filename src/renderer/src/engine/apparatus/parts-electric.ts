import type { Part } from './parts'
import { BLACK, BRASS, STEEL, WOOD, addParts, box, disc, fmt, grip, line, meter, plate, poly, shade, text } from './parts'

const base = { subject: 'physics' as const, group: 'Electric circuits' }
const ends: [number, number][] = [[28, 90], [172, 90]]

/** A wooden base with a part on it, the way school circuit boards hold components. */
const board = (c: CanvasRenderingContext2D, w = 200, h = 110): void => box(c, 6, 40, w - 12, h - 44, 10, shade(c, 0, 40, 0, h, WOOD))

const nice = (v: number): number[] => [0, v / 2, v]
const scaleLabels = (range: number): string[] => nice(range).map(v => Number(v.toFixed(2)).toString())

const BAND_COLOURS = ['#111', '#7a3b16', '#d43b33', '#ef8a1f', '#f5c518', '#2fa66a', '#2f6bff', '#8a4fd6', '#8a8f98', '#f4f4f4']
/** The first three colour bands of a resistor, to two significant figures. A value below 10 Ω has a gold multiplier band (× 0.1). */
export function resistorBands(ohms: number): [string, string, string] {
  const r = Math.max(1, Math.round(ohms))
  if (r < 10) return [BAND_COLOURS[r], BAND_COLOURS[0], '#c9a227']
  const power = Math.floor(Math.log10(r)) - 1
  const digits = Math.min(99, Math.round(r / 10 ** power))
  return [BAND_COLOURS[Math.floor(digits / 10)], BAND_COLOURS[digits % 10], BAND_COLOURS[power]]
}

export const ELECTRIC: Part[] = [
  { ...base, kind: 'cell', name: 'Cell', w: 200, h: 110, params: { v: 1.5 }, polar: true, terminals: [[176, 55], [24, 55]],
    settings: [{ key: 'v', label: 'Voltage', min: 1, max: 2, step: .1, unit: 'V' }],
    circuit: (id, a, b, q) => ({ id, kind: 'source', a, b, volts: q.v, r: .1 }),
    paint(c, q, l) {
      box(c, 34, 22, 122, 66, 12, shade(c, 0, 22, 0, 88, ['#3d4a57', '#1e262e', '#101418']))
      box(c, 34, 22, 40, 66, 12, shade(c, 0, 22, 0, 88, ['#f2b134', '#d98f1a', '#a56a10']), '')
      box(c, 156, 40, 12, 30, 3, shade(c, 0, 40, 0, 70, STEEL))
      text(c, `${q.v.toFixed(1)} V`, 110, 55, 24, '#fff', 'center', 700)
      if (l.warn) plate(c, l.warn, 100, 12, 17, '#b3261e')
    } },
  { ...base, kind: 'battery', name: 'Battery', w: 220, h: 130, params: { v: 6 }, polar: true, terminals: [[60, 22], [160, 22]],
    settings: [{ key: 'v', label: 'Voltage', min: 1.5, max: 24, step: .5, unit: 'V' }],
    circuit: (id, a, b, q) => ({ id, kind: 'source', a, b, volts: q.v, r: .2 }),
    paint(c, q, l) {
      box(c, 18, 26, 184, 96, 10, shade(c, 0, 26, 0, 122, ['#39536e', '#23384d', '#16222f']))
      box(c, 18, 26, 184, 18, 8, shade(c, 0, 26, 0, 44, ['#59748f', '#3c5570']), '')
      text(c, `${q.v % 1 ? q.v.toFixed(1) : q.v} V`, 110, 84, 36, '#fff', 'center', 700)
      if (l.warn) plate(c, l.warn, 110, 112, 17, '#b3261e')
    } },
  { ...base, kind: 'ac-supply', name: 'AC supply', w: 220, h: 130, params: { v: 6, f: .5 }, terminals: [[60, 22], [160, 22]],
    settings: [{ key: 'v', label: 'Voltage', min: 1, max: 24, step: 1, unit: 'V' }, { key: 'f', label: 'Slowed down to', min: .2, max: 2, step: .1, unit: 'Hz' }],
    circuit: (id, a, b, q, t) => ({ id, kind: 'source', a, b, volts: q.v * Math.sin(2 * Math.PI * q.f * t), r: .2 }),
    moving: () => true,
    paint(c, q, l) {
      box(c, 18, 26, 184, 96, 10, shade(c, 0, 26, 0, 122, ['#5c5f66', '#3b3d42', '#26272b']))
      c.beginPath()
      for (let x = 0; x <= 90; x += 3) { const y = 66 - 17 * Math.sin(x / 90 * Math.PI * 2 - l.time * q.f * 6.283); x ? c.lineTo(40 + x, y) : c.moveTo(40 + x, y) }
      c.strokeStyle = '#7dff9a'; c.lineWidth = 3; c.stroke()
      text(c, `${q.v} V AC`, 110, 102, 22, '#fff', 'center', 700)
    } },
  { ...base, kind: 'switch', name: 'Switch', w: 200, h: 110, params: { on: 0 }, terminals: ends,
    controls: [{ name: 'Switch', at: q => q.on ? [100, 72] : [118, 48], reach: 40, tap: q => { q.on = q.on ? 0 : 1 } }],
    circuit: (id, a, b, q) => q.on ? { id, kind: 'resistor', a, b, ohms: 1e-3 } : { id, kind: 'open', a, b },
    paint(c, q) {
      board(c)
      disc(c, 62, 84, 9, shade(c, 53, 75, 71, 93, BRASS), 'rgba(30,20,10,.6)')
      disc(c, 138, 84, 9, shade(c, 129, 75, 147, 93, BRASS), 'rgba(30,20,10,.6)')
      const tip: [number, number] = q.on ? [138, 82] : [126, 46]
      line(c, 62, 84, tip[0], tip[1], '#caa24f', 8)
      line(c, 62, 84, tip[0], tip[1], '#efd98f', 3)
      disc(c, tip[0], tip[1], 10, q.on ? '#2fa66a' : '#d43b33', 'rgba(20,15,10,.6)')
      text(c, q.on ? 'ON' : 'OFF', 100, 28, 19, q.on ? '#1f7a4c' : '#b3261e', 'center', 700)
    } },
  { ...base, kind: 'resistor', name: 'Resistor', w: 200, h: 110, params: { r: 10 }, terminals: ends,
    settings: [{ key: 'r', label: 'Resistance', min: 1, max: 1000, step: 1, unit: 'Ω' }],
    circuit: (id, a, b, q) => ({ id, kind: 'resistor', a, b, ohms: q.r }),
    paint(c, q, l) {
      board(c)
      line(c, 34, 80, 166, 80, '#7f8a96', 5)
      box(c, 60, 62, 80, 36, 14, shade(c, 0, 62, 0, 98, ['#e6c893', '#c9a56c', '#a07f4c']))
      const bands = resistorBands(q.r)
      for (const [x, col] of [[72, bands[0]], [86, bands[1]], [100, bands[2]], [122, '#c9a227']] as [number, string][]) box(c, x, 62, 7, 36, 0, col, '')
      text(c, `${q.r} Ω`, 100, 24, 22, l.dark ? '#f4f6fb' : '#172033', 'center', 700)
    } },
  { ...base, kind: 'rheostat', name: 'Rheostat', w: 240, h: 130, params: { max: 50, pos: .5 }, terminals: [[30, 108], [210, 108]],
    settings: [{ key: 'max', label: 'Largest resistance', min: 10, max: 200, step: 5, unit: 'Ω' }],
    controls: [{ name: 'Slider', at: q => [50 + q.pos * 140, 42], reach: 34, drag: (q, x) => { q.pos = Math.max(0, Math.min(1, (x - 50) / 140)) } }],
    circuit: (id, a, b, q) => ({ id, kind: 'resistor', a, b, ohms: Math.max(.5, q.max * q.pos) }),
    paint(c, q) {
      box(c, 8, 84, 224, 40, 8, shade(c, 0, 84, 0, 124, WOOD))
      box(c, 34, 46, 172, 42, 18, shade(c, 0, 46, 0, 88, ['#b9845c', '#8e5f3d', '#65412a']))
      for (let x = 42; x < 200; x += 7) line(c, x, 47, x, 87, 'rgba(255,225,190,.5)', 2)
      const x = 50 + q.pos * 140
      line(c, 34, 30, 206, 30, '#8c96a3', 6)
      line(c, x, 30, x, 56, '#3a3f47', 7)
      grip(c, x, 42, 14)
      text(c, `${Math.max(.5, q.max * q.pos).toFixed(q.max * q.pos < 10 ? 1 : 0)} Ω`, 120, 12, 20, '#172033', 'center', 700)
    } },
  { ...base, kind: 'bulb', name: 'Bulb', w: 160, h: 190, params: { burnt: 0 }, terminals: [[32, 166], [128, 166]],
    controls: [{ name: 'Replace the bulb', at: () => [80, 62], reach: 44, tap: q => { q.burnt = 0 } }],
    circuit: (id, a, b, q) => q.burnt ? { id, kind: 'open', a, b } : { id, kind: 'resistor', a, b, ohms: 12 },
    paint(c, q, l) {
      // Rated 6 V, 3 W: full brightness at 3 W. Far beyond that it burns out.
      const glow = q.burnt ? 0 : Math.min(1.4, Math.abs(l.volts * l.amps) / 3)
      if (glow > .02) {
        const g = c.createRadialGradient(80, 62, 12, 80, 62, 66 + 60 * glow)
        g.addColorStop(0, `rgba(255,236,130,${Math.min(.95, .35 + glow * .6)})`); g.addColorStop(1, 'rgba(255,220,90,0)')
        disc(c, 80, 62, 66 + 60 * glow, g)
      }
      c.beginPath(); c.arc(80, 62, 50, Math.PI * .8, Math.PI * .2)
      c.lineTo(102, 124); c.lineTo(58, 124); c.closePath()
      c.fillStyle = glow > .02 ? `rgba(255,240,${Math.round(190 - 120 * Math.min(1, glow))},${.45 + .5 * Math.min(1, glow)})` : q.burnt ? 'rgba(150,150,150,.3)' : 'rgba(225,238,245,.4)'
      c.fill(); c.strokeStyle = l.dark ? 'rgba(235,245,255,.9)' : 'rgba(55,80,105,.8)'; c.lineWidth = 3; c.stroke()
      line(c, 66, 122, 70, 70, '#6d6d6d', 2); line(c, 94, 122, 90, 70, '#6d6d6d', 2)
      c.beginPath(); for (let i = 0; i <= 6; i++) { const x = 70 + i * 20 / 6, y = 70 + (i % 2 ? -8 : 2); i ? c.lineTo(x, y) : c.moveTo(x, y) }
      c.strokeStyle = glow > .05 ? '#ffb300' : q.burnt ? 'transparent' : '#6d6d6d'; c.lineWidth = glow > .05 ? 4 : 2; c.stroke()
      box(c, 56, 122, 48, 26, 5, shade(c, 56, 0, 104, 0, STEEL))
      for (const y of [129, 136, 143]) line(c, 57, y, 103, y, 'rgba(60,60,60,.45)', 1.6)
      box(c, 12, 146, 136, 40, 8, shade(c, 0, 146, 0, 186, WOOD))
      if (q.burnt) plate(c, 'Burnt out · tap to replace', 80, 18, 15, '#b3261e')
    } },
  { ...base, kind: 'led', name: 'LED', w: 160, h: 150, params: { hue: 0 }, polar: true, terminals: [[32, 126], [128, 126]],
    settings: [{ key: 'hue', label: 'Colour', choices: ['Red', 'Green', 'Blue', 'Yellow'] }],
    circuit: (id, a, b) => ({ id, kind: 'diode', a, b, drop: 2, ron: 20 }),
    paint(c, q, l) {
      const col = ['#ff3b30', '#30d158', '#3a7bff', '#ffd60a'][q.hue] ?? '#ff3b30'
      const on = l.amps > .001
      if (on) { const g = c.createRadialGradient(80, 52, 8, 80, 52, 74); g.addColorStop(0, col); g.addColorStop(1, `${col}00`); disc(c, 80, 52, 74, g) }
      box(c, 8, 106, 144, 40, 8, shade(c, 0, 106, 0, 146, WOOD))
      line(c, 66, 104, 66, 84, '#8c96a3', 4); line(c, 94, 108, 94, 84, '#8c96a3', 4)
      c.beginPath(); c.moveTo(56, 86); c.lineTo(56, 52); c.arc(80, 52, 24, Math.PI, 0); c.lineTo(104, 86); c.closePath()
      c.fillStyle = on ? col : `${col}88`; c.fill(); c.strokeStyle = 'rgba(30,20,20,.55)'; c.lineWidth = 2; c.stroke()
    } },
  { ...base, kind: 'diode', name: 'Diode', w: 200, h: 110, params: {}, polar: true, terminals: ends,
    circuit: (id, a, b) => ({ id, kind: 'diode', a, b, drop: .7, ron: 1 }),
    paint(c, _q, l) {
      board(c)
      line(c, 34, 80, 166, 80, '#7f8a96', 5)
      box(c, 72, 66, 56, 28, 6, shade(c, 0, 66, 0, 94, BLACK))
      box(c, 112, 66, 7, 28, 0, '#d9dde2', '')
      text(c, '→', 100, 26, 26, l.dark ? '#f4f6fb' : '#172033', 'center', 700)
    } },
  { ...base, kind: 'capacitor', name: 'Capacitor', w: 200, h: 110, params: { uf: 10000 }, polar: true, terminals: ends,
    settings: [{ key: 'uf', label: 'Capacitance', min: 1000, max: 47000, step: 1000, unit: 'µF' }],
    circuit: (id, a, b, q) => ({ id, kind: 'capacitor', a, b, farads: q.uf * 1e-6 }),
    moving: (_q, l) => Math.abs(l.amps) > 1e-4,
    paint(c, q, l) {
      board(c)
      line(c, 34, 80, 166, 80, '#7f8a96', 5)
      box(c, 76, 50, 48, 46, 8, shade(c, 76, 0, 124, 0, ['#2a4f8f', '#1b3768', '#10244a']))
      box(c, 112, 50, 12, 46, 0, '#c8d3e6', '')
      text(c, `${Math.abs(l.volts).toFixed(1)} V`, 100, 24, 20, l.dark ? '#f4f6fb' : '#172033', 'center', 700)
      text(c, `${q.uf / 1000} mF`, 94, 74, 13, '#fff')
    } },
  { ...base, kind: 'coil', name: 'Coil', w: 220, h: 110, params: { h: 2, r: 8 }, terminals: [[28, 90], [192, 90]],
    settings: [{ key: 'h', label: 'Inductance', min: .2, max: 10, step: .2, unit: 'H' }, { key: 'r', label: 'Wire resistance', min: 1, max: 50, step: 1, unit: 'Ω' }],
    circuit: (id, a, b, q) => ({ id, kind: 'inductor', a, b, henries: q.h, r: q.r }),
    moving: (q, l) => Math.abs(l.amps - l.volts / q.r) > 1e-3,
    paint(c) {
      box(c, 6, 60, 208, 46, 10, shade(c, 0, 60, 0, 106, WOOD))
      box(c, 44, 28, 132, 54, 10, shade(c, 0, 28, 0, 82, ['#7a4a2b', '#52301b']))
      for (let x = 52; x < 170; x += 8) line(c, x, 30, x + 2, 80, '#d9863f', 5)
    } },
  { ...base, kind: 'ammeter', name: 'Ammeter', w: 200, h: 210, params: { range: 1 }, polar: true, terminals: [[28, 188], [172, 188]],
    settings: [{ key: 'range', label: 'Scale up to', choices: ['0.5 A', '1 A', '5 A'], apply: (v, q) => { q.range = [0.5, 1, 5][v] } }],
    circuit: (id, a, b) => ({ id, kind: 'resistor', a, b, ohms: .01 }),
    paint(c, q, l) {
      box(c, 8, 164, 184, 42, 8, shade(c, 0, 164, 0, 206, WOOD))
      meter(c, 100, 88, 72, l.amps, 0, q.range, 'A', scaleLabels(q.range), l.amps < -.0005 ? 'Connected backwards' : fmt(Math.abs(l.amps) < 5e-4 ? 0 : l.amps, 'A'))
    } },
  { ...base, kind: 'voltmeter', name: 'Voltmeter', w: 200, h: 210, params: { range: 10 }, polar: true, terminals: [[28, 188], [172, 188]],
    settings: [{ key: 'range', label: 'Scale up to', choices: ['3 V', '10 V', '30 V'], apply: (v, q) => { q.range = [3, 10, 30][v] } }],
    circuit: (id, a, b) => ({ id, kind: 'resistor', a, b, ohms: 1e7 }),
    paint(c, q, l) {
      box(c, 8, 164, 184, 42, 8, shade(c, 0, 164, 0, 206, WOOD))
      meter(c, 100, 88, 72, l.volts, 0, q.range, 'V', scaleLabels(q.range), l.volts < -.005 ? 'Connected backwards' : fmt(Math.abs(l.volts) < .005 ? 0 : l.volts, 'V'))
    } },
  { ...base, kind: 'galvanometer', name: 'Galvanometer', w: 200, h: 210, params: { range: .01 }, terminals: [[28, 188], [172, 188]],
    settings: [{ key: 'range', label: 'Full swing at', choices: ['1 mA', '10 mA', '100 mA'], apply: (v, q) => { q.range = [.001, .01, .1][v] } }],
    circuit: (id, a, b) => ({ id, kind: 'resistor', a, b, ohms: 100 }),
    paint(c, q, l) {
      box(c, 8, 164, 184, 42, 8, shade(c, 0, 164, 0, 206, WOOD))
      const m = q.range * 1000
      meter(c, 100, 88, 72, l.amps, -q.range, q.range, 'G', [`${m}`, '0', `${m}`], fmt(Math.abs(l.amps) < 1e-6 ? 0 : l.amps, 'A'))
    } },
  { ...base, kind: 'fuse', name: 'Fuse', w: 200, h: 110, params: { a: 1, blown: 0 }, terminals: ends,
    settings: [{ key: 'a', label: 'Blows above', min: .1, max: 10, step: .1, unit: 'A' }],
    controls: [{ name: 'Replace the fuse', at: () => [100, 76], reach: 44, tap: q => { q.blown = 0 } }],
    circuit: (id, a, b, q) => q.blown ? { id, kind: 'open', a, b } : { id, kind: 'resistor', a, b, ohms: .05 },
    paint(c, q, l) {
      board(c)
      box(c, 54, 62, 92, 30, 13, 'rgba(232,240,246,.75)', 'rgba(55,70,90,.7)')
      box(c, 46, 60, 18, 34, 4, shade(c, 46, 0, 64, 0, STEEL)); box(c, 136, 60, 18, 34, 4, shade(c, 136, 0, 154, 0, STEEL))
      if (q.blown) { line(c, 64, 77, 88, 72, '#444', 2.5); line(c, 112, 80, 136, 77, '#444', 2.5); disc(c, 100, 76, 9, 'rgba(60,60,60,.4)') } else line(c, 64, 77, 136, 77, '#666', 2.5)
      plate(c, q.blown ? 'Blown · tap to replace' : `${q.a} A`, 100, 24, q.blown ? 15 : 19, q.blown ? '#b3261e' : l.dark ? '#172033' : '#172033')
    } },
  { ...base, kind: 'motor', name: 'Motor', w: 200, h: 180, params: { spin: 0 }, terminals: [[28, 158], [172, 158]],
    circuit: (id, a, b) => ({ id, kind: 'resistor', a, b, ohms: 8 }),
    moving: (_q, l) => Math.abs(l.amps) > .02,
    paint(c, q, l) {
      box(c, 8, 134, 184, 42, 8, shade(c, 0, 134, 0, 176, WOOD))
      box(c, 52, 74, 96, 62, 10, shade(c, 0, 74, 0, 136, STEEL))
      for (const y of [86, 100, 114, 126]) line(c, 58, y, 142, y, 'rgba(50,60,70,.35)', 2)
      line(c, 100, 76, 100, 44, '#4b5563', 6)
      // Speed follows the current; the direction follows which way it flows.
      q.spin += Math.sign(l.amps) * Math.min(1.2, Math.abs(l.amps) * 1.1) * .22
      const a = q.spin, s = Math.abs(Math.cos(a))
      c.save(); c.translate(100, 40); c.scale(1, .35)
      for (let i = 0; i < 3; i++) { const b = a + i * Math.PI * 2 / 3; c.beginPath(); c.ellipse(Math.cos(b) * 38, Math.sin(b) * 38, 34, 15, b, 0, Math.PI * 2); c.fillStyle = i ? '#3a7bff' : '#d43b33'; c.fill(); c.strokeStyle = 'rgba(20,20,30,.5)'; c.lineWidth = 2; c.stroke() }
      c.restore(); void s
      disc(c, 100, 40, 7, '#2b2f36')
    } },
  { ...base, kind: 'buzzer', name: 'Buzzer', w: 170, h: 150, params: {}, polar: true, terminals: [[28, 128], [142, 128]],
    circuit: (id, a, b) => ({ id, kind: 'resistor', a, b, ohms: 100 }),
    moving: (_q, l) => l.amps > .005,
    paint(c, _q, l) {
      box(c, 8, 106, 154, 40, 8, shade(c, 0, 106, 0, 146, WOOD))
      const on = l.amps > .005, wob = on ? Math.sin(l.time * 40) * 1.6 : 0
      disc(c, 85 + wob, 66, 42, shade(c, 40, 30, 130, 100, BLACK))
      disc(c, 85 + wob, 66, 12, '#111', '#555')
      if (on) for (const r of [54, 66, 78]) { c.beginPath(); c.arc(85, 66, r + (l.time * 60 % 12), -.6, .6); c.strokeStyle = 'rgba(232,90,40,.7)'; c.lineWidth = 3; c.stroke(); c.beginPath(); c.arc(85, 66, r + (l.time * 60 % 12), Math.PI - .6, Math.PI + .6); c.stroke() }
    } }
]
addParts(ELECTRIC)
void poly
