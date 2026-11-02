import type { C, Part } from './parts'
import { addParts, box, disc, fmt, line, poly, shade, text } from './parts'
import { AMBER, BRASS_LEAD, DARK_METAL, EDGE, GRAPHITE, IVORY, PRINT, RED, R_BLACK, R_BRASS, R_COPPER, R_STEEL, WARN, glow, handle, lead, meter, mount, print, readout } from './look'

const base = { subject: 'physics' as const, group: 'Electric circuits' }
const ends: [number, number][] = [[28, 90], [172, 90]]

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

/** A part held up on its leads: from each post along the plate, then up into the part. */
const legs = (c: C, lx: number, rx: number, top: number, w = 200, y = 90, color?: string): void => {
  lead(c, [28, y, lx, y, lx, top], color)
  lead(c, [w - 28, y, rx, y, rx, top], color)
}

/** A cased battery: two posts on a lid. */
function batteryCase(c: C): void {
  for (const x of [60, 160]) box(c, x - 17, 22, 34, 12, 1, shade(c, 0, 22, 0, 34, R_STEEL), EDGE, 1.5)
  box(c, 14, 40, 192, 84, 3, shade(c, 0, 40, 0, 124, GRAPHITE), EDGE, 2)
  box(c, 10, 30, 200, 15, 2, shade(c, 0, 30, 0, 45, ['#6a7681', '#46505a']), EDGE, 2)
}

/** The turns of wire on a coil or a rheostat: copper, wound close, with the light across the whole winding. */
function winding(c: C, x: number, y: number, w: number, h: number, gap = 4): void {
  box(c, x, y, w, h, 1, shade(c, 0, y, 0, y + h, R_COPPER), EDGE, 1.5)
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip()
  for (let px = x - 4; px < x + w + 4; px += gap) line(c, px, y, px + 3, y + h, 'rgba(45,20,6,.5)', 1.3)
  c.restore()
}

export const ELECTRIC: Part[] = [
  { ...base, kind: 'cell', name: 'Cell', w: 200, h: 110, params: { v: 1.5 }, polar: true, terminals: [[176, 55], [24, 55]],
    settings: [{ key: 'v', label: 'Voltage', min: 1, max: 2, step: .1, unit: 'V' }],
    circuit: (id, a, b, q) => ({ id, kind: 'source', a, b, volts: q.v, r: .1 }),
    paint(c, q, l) {
      mount(c, 4, 20, 192, 70)
      lead(c, [24, 55, 44, 55]); lead(c, [160, 55, 176, 55])
      // Lying on its side with the + end to the right: steel caps, a nipple, and the coloured band at the + end.
      box(c, 154, 45, 8, 20, 1, shade(c, 0, 45, 0, 65, R_STEEL), EDGE, 1.5)
      box(c, 42, 30, 114, 50, 3, shade(c, 0, 30, 0, 80, R_BLACK), EDGE, 2)
      c.fillStyle = shade(c, 0, 30, 0, 80, R_COPPER); c.fillRect(118, 31, 30, 48)
      c.fillStyle = shade(c, 0, 30, 0, 80, R_STEEL); c.fillRect(43, 31, 7, 48); c.fillRect(148, 31, 7, 48)
      text(c, `${q.v.toFixed(1)} V`, 84, 55, 21, '#fff', 'center', 700)
      text(c, '+', 133, 54, 22, '#fff', 'center', 700)
      if (l.warn) readout(c, l.warn, 100, 10, 14, WARN)
    } },
  { ...base, kind: 'battery', name: 'Battery', w: 220, h: 130, params: { v: 6 }, polar: true, terminals: [[60, 22], [160, 22]],
    settings: [{ key: 'v', label: 'Voltage', min: 1.5, max: 24, step: .5, unit: 'V' }],
    circuit: (id, a, b, q) => ({ id, kind: 'source', a, b, volts: q.v, r: .2 }),
    paint(c, q, l) {
      batteryCase(c)
      box(c, 28, 56, 164, 56, 1, shade(c, 0, 56, 0, 112, IVORY), EDGE, 1.5)
      c.fillStyle = RED; c.fillRect(29, 57, 162, 7)
      text(c, `${q.v % 1 ? q.v.toFixed(1) : q.v} V`, 124, 88, 32, '#23282e', 'center', 700)
      // The symbol for a battery, as it is drawn in a circuit diagram.
      for (const [x, h, w] of [[46, 28, 1.8], [53, 14, 3.4], [60, 28, 1.8], [67, 14, 3.4]]) { c.fillStyle = '#23282e'; c.fillRect(x - w / 2, 88 - h / 2, w, h) }
      if (l.warn) readout(c, l.warn, 110, 112, 14, WARN)
    } },
  { ...base, kind: 'ac-supply', name: 'AC supply', w: 220, h: 130, params: { v: 6, f: .5 }, terminals: [[60, 22], [160, 22]],
    settings: [{ key: 'v', label: 'Voltage', min: 1, max: 24, step: 1, unit: 'V' }, { key: 'f', label: 'Slowed down to', min: .2, max: 2, step: .1, unit: 'Hz' }],
    circuit: (id, a, b, q, t) => ({ id, kind: 'source', a, b, volts: q.v * Math.sin(2 * Math.PI * q.f * t), r: .2 }),
    moving: () => true,
    paint(c, q, l) {
      batteryCase(c)
      box(c, 26, 54, 110, 58, 1, '#0d1412', 'rgba(255,255,255,.25)', 1.5)
      line(c, 30, 83, 132, 83, 'rgba(126,226,160,.25)', 1)
      c.beginPath()
      for (let x = 0; x <= 96; x += 3) { const y = 83 - 21 * Math.sin(x / 96 * Math.PI * 2 - l.time * q.f * 6.283); x ? c.lineTo(33 + x, y) : c.moveTo(33 + x, y) }
      c.strokeStyle = '#7ee2a0'; c.lineWidth = 2.5; c.lineJoin = 'round'; c.stroke()
      disc(c, 170, 72, 17, shade(c, 153, 55, 187, 89, ['#6a7681', '#23282e']), EDGE, 2)
      line(c, 170, 72, 178, 60, '#fff', 2.5)
      print(c, `${q.v} V AC`, 170, 104, 15)
    } },
  { ...base, kind: 'switch', name: 'Switch', w: 200, h: 110, params: { on: 0 }, terminals: ends,
    controls: [{ name: 'Switch', at: q => q.on ? [122, 62] : [112, 30], reach: 40, tap: q => { q.on = q.on ? 0 : 1 } }],
    circuit: (id, a, b, q) => q.on ? { id, kind: 'resistor', a, b, ohms: 1e-3 } : { id, kind: 'open', a, b },
    paint(c, q) {
      mount(c, 6, 10, 188, 98)
      legs(c, 62, 138, 70, 200, 90, BRASS_LEAD)
      // A knife switch: the blade turns on its hinge and drops into the clip.
      box(c, 54, 56, 16, 18, 1, shade(c, 0, 56, 0, 74, R_BRASS), EDGE, 1.5)
      box(c, 130, 52, 16, 22, 1, shade(c, 0, 52, 0, 74, R_BRASS), EDGE, 1.5)
      const angle = q.on ? 0 : -.55, ca = Math.cos(angle), sa = Math.sin(angle), along = (t: number): [number, number] => [62 + ca * t, 62 + sa * t]
      const [bx, by] = along(84), [hx, hy] = along(48)
      c.lineCap = 'butt'
      line(c, 62, 62, hx, hy, EDGE, 8); c.lineCap = 'butt'; line(c, 62, 62, hx, hy, '#ecd28f', 5)
      if (q.on) { c.fillStyle = shade(c, 0, 54, 0, 70, R_BRASS); c.fillRect(134, 54, 8, 16) }
      c.lineCap = 'butt'; line(c, hx, hy, bx, by, EDGE, 15); c.lineCap = 'butt'; line(c, hx, hy, bx, by, RED, 11)
      c.lineCap = 'butt'; line(c, hx, hy - 3, bx, by - 3, 'rgba(255,255,255,.3)', 2)
      disc(c, 62, 62, 6, shade(c, 56, 56, 68, 68, ['#fff0c2', '#8a6a2a']), EDGE, 1.5)
      print(c, q.on ? 'ON' : 'OFF', 100, 90, 15, q.on ? '#8ce8ae' : '#c8d0d7', 700)
    } },
  { ...base, kind: 'resistor', name: 'Resistor', w: 200, h: 110, params: { r: 10 }, terminals: ends,
    settings: [{ key: 'r', label: 'Resistance', min: 1, max: 1000, step: 1, unit: 'Ω' }],
    circuit: (id, a, b, q) => ({ id, kind: 'resistor', a, b, ohms: q.r }),
    paint(c, q) {
      mount(c, 6, 10, 188, 98)
      lead(c, [28, 90, 28, 48, 172, 48, 172, 90])
      // The real shape: a waist between two rounded ends.
      const body = (): void => { c.beginPath(); c.roundRect(58, 28, 26, 40, 10); c.roundRect(116, 28, 26, 40, 10); c.rect(70, 32, 60, 32) }
      body(); c.strokeStyle = EDGE; c.lineWidth = 3; c.stroke()
      c.fillStyle = shade(c, 0, 28, 0, 68, ['#a98a58', '#f4e3bf', '#d3b482', '#94764a']); c.fill()
      c.save(); body(); c.clip()
      const bands = resistorBands(q.r)
      for (const [x, col] of [[68, bands[0]], [82, bands[1]], [96, bands[2]], [124, '#c9a227']] as [number, string][]) { c.fillStyle = col; c.fillRect(x, 26, 8, 44) }
      c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(56, 35, 88, 5)
      c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(56, 56, 88, 14)
      c.restore()
      print(c, `${q.r} Ω`, 100, 90, 19)
    } },
  { ...base, kind: 'rheostat', name: 'Rheostat', w: 240, h: 130, params: { max: 50, pos: .5 }, terminals: [[30, 108], [210, 108]],
    settings: [{ key: 'max', label: 'Largest resistance', min: 10, max: 200, step: 5, unit: 'Ω' }],
    controls: [{ name: 'Slider', at: q => [50 + q.pos * 140, 42], reach: 34, drag: (q, x) => { q.pos = Math.max(0, Math.min(1, (x - 50) / 140)) } }],
    circuit: (id, a, b, q) => ({ id, kind: 'resistor', a, b, ohms: Math.max(.5, q.max * q.pos) }),
    paint(c, q) {
      mount(c, 6, 88, 228, 38)
      winding(c, 36, 48, 168, 40, 3.5)
      // Current runs in at the left, along the wire to the slider, then back along the rod: more wire, more resistance.
      lead(c, [30, 108, 30, 90]); lead(c, [210, 108, 210, 90])
      box(c, 22, 22, 16, 70, 1, shade(c, 22, 0, 38, 0, GRAPHITE), EDGE, 1.5)
      box(c, 202, 22, 16, 70, 1, shade(c, 202, 0, 218, 0, GRAPHITE), EDGE, 1.5)
      const x = 50 + q.pos * 140
      box(c, 24, 27, 192, 7, 1, shade(c, 0, 27, 0, 34, R_STEEL), EDGE, 1.2)
      lead(c, [x, 38, x, 52], BRASS_LEAD)
      box(c, x - 15, 20, 30, 22, 2, shade(c, 0, 20, 0, 42, DARK_METAL), EDGE, 1.5)
      handle(c, x, 31, 9)
      readout(c, `${Math.max(.5, q.max * q.pos).toFixed(q.max * q.pos < 10 ? 1 : 0)} Ω`, 120, 106, 16)
    } },
  { ...base, kind: 'bulb', name: 'Bulb', w: 160, h: 190, params: { burnt: 0 }, terminals: [[32, 166], [128, 166]],
    controls: [{ name: 'Replace the bulb', at: () => [80, 58], reach: 44, tap: q => { q.burnt = 0 } }],
    circuit: (id, a, b, q) => q.burnt ? { id, kind: 'open', a, b } : { id, kind: 'resistor', a, b, ohms: 12 },
    paint(c, q, l) {
      // Rated 6 V, 3 W: full brightness at 3 W. Far beyond that it burns out.
      const glowing = q.burnt ? 0 : Math.min(1.4, Math.abs(l.volts * l.amps) / 3), lit = glowing > .02, power = Math.min(1, glowing)
      if (lit) glow(c, 80, 56, 70 + 60 * glowing, '255,214,120', Math.min(.9, .3 + glowing * .55))
      mount(c, 8, 142, 144, 44)
      lead(c, [32, 166, 62, 166, 62, 148], BRASS_LEAD); lead(c, [128, 166, 98, 166, 98, 148], BRASS_LEAD)
      // The glass: a globe that narrows into its neck.
      const globe = (): void => { c.beginPath(); c.moveTo(62, 108); c.bezierCurveTo(60, 92, 32, 84, 32, 56); c.arc(80, 56, 48, Math.PI, 0); c.bezierCurveTo(128, 84, 100, 92, 98, 108); c.closePath() }
      globe()
      if (lit) { const g = c.createRadialGradient(80, 56, 4, 80, 56, 58); g.addColorStop(0, '#fffdf0'); g.addColorStop(1, `rgba(255,${Math.round(226 - 40 * power)},${Math.round(150 - 80 * power)},${.35 + .6 * power})`); c.fillStyle = g } else c.fillStyle = q.burnt ? 'rgba(120,120,120,.28)' : l.dark ? 'rgba(220,235,245,.12)' : 'rgba(205,225,240,.25)'
      c.fill()
      // The stem and the two wires that hold the filament.
      poly(c, [71, 108, 75, 84, 85, 84, 89, 108], l.dark ? 'rgba(220,235,245,.25)' : 'rgba(150,175,195,.35)')
      const wire = l.dark ? '#c5ced6' : '#5c6670'
      line(c, 76, 86, 64, 56, wire, 1.8); line(c, 84, 86, 96, 56, wire, 1.8)
      if (q.burnt) { line(c, 64, 56, 72, 51, wire, 2); line(c, 96, 56, 88, 60, wire, 2) } else {
        c.beginPath(); for (let i = 0; i <= 32; i++) { const x = 64 + 32 * i / 32, y = 54 - 5 * Math.sin(i * Math.PI / 2.5); i ? c.lineTo(x, y) : c.moveTo(x, y) }
        c.strokeStyle = lit ? power > .5 ? '#fff4c0' : AMBER : wire; c.lineWidth = lit ? 2.6 : 1.6; c.lineJoin = 'round'; c.stroke()
      }
      globe(); c.strokeStyle = l.dark ? 'rgba(235,245,255,.9)' : 'rgba(55,80,105,.85)'; c.lineWidth = 2.5; c.stroke()
      c.beginPath(); c.arc(80, 56, 39, Math.PI * 1.04, Math.PI * 1.4); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 4; c.lineCap = 'round'; c.stroke()
      // The screw cap in its holder.
      box(c, 60, 106, 40, 22, 1, shade(c, 60, 0, 100, 0, R_STEEL), EDGE, 1.5)
      for (const y of [112, 118, 124]) line(c, 61, y, 99, y - 3, 'rgba(40,48,56,.5)', 1.6)
      box(c, 52, 124, 56, 20, 1, shade(c, 52, 0, 108, 0, ['#cfc9b8', '#fbf8ef', '#d8d2c1', '#a8a292']), EDGE, 1.5)
      box(c, 46, 142, 68, 8, 1, shade(c, 0, 142, 0, 150, IVORY), EDGE, 1.5)
      if (q.burnt) readout(c, 'Burnt out · tap to replace', 80, 14, 13, WARN)
    } },
  { ...base, kind: 'led', name: 'LED', w: 160, h: 150, params: { hue: 0 }, polar: true, terminals: [[32, 126], [128, 126]],
    settings: [{ key: 'hue', label: 'Colour', choices: ['Red', 'Green', 'Blue', 'Yellow'] }],
    circuit: (id, a, b) => ({ id, kind: 'diode', a, b, drop: 2, ron: 20 }),
    paint(c, q, l) {
      const col = ['#e8362b', '#27c455', '#2f6dff', '#f2c40a'][q.hue] ?? '#e8362b', rgb = ['255,70,55', '60,220,110', '70,130,255', '255,214,40'][q.hue] ?? '255,70,55'
      const on = l.amps > .001
      if (on) glow(c, 80, 44, 78, rgb, .85)
      mount(c, 8, 102, 144, 44)
      // The longer leg is the + side.
      lead(c, [32, 126, 70, 126, 70, 74]); lead(c, [128, 126, 90, 126, 90, 80])
      const dome = (): void => { c.beginPath(); c.moveTo(60, 72); c.lineTo(60, 40); c.arc(80, 40, 20, Math.PI, 0); c.lineTo(100, 72); c.closePath() }
      dome(); c.fillStyle = shade(c, 60, 0, 100, 0, on ? [col, '#ffffff', col] : [`${col}cc`, `${col}70`, `${col}cc`]); c.fill()
      // Inside the clear dome: the post and the wider anvil that holds the chip.
      poly(c, [68, 72, 68, 52, 73, 49, 73, 72], 'rgba(40,40,48,.55)')
      poly(c, [83, 72, 83, 54, 94, 48, 94, 72], 'rgba(40,40,48,.6)')
      line(c, 72, 49, 84, 54, 'rgba(40,40,48,.6)', 1)
      dome(); c.strokeStyle = 'rgba(25,20,25,.6)'; c.lineWidth = 2; c.stroke()
      line(c, 67, 38, 67, 58, 'rgba(255,255,255,.65)', 3)
      box(c, 55, 72, 50, 8, 1, on ? col : `${col}dd`, 'rgba(25,20,25,.6)', 1.5)
    } },
  { ...base, kind: 'diode', name: 'Diode', w: 200, h: 110, params: {}, polar: true, terminals: ends,
    circuit: (id, a, b) => ({ id, kind: 'diode', a, b, drop: .7, ron: 1 }),
    paint(c) {
      mount(c, 6, 10, 188, 98)
      lead(c, [28, 90, 28, 46, 172, 46, 172, 90])
      box(c, 66, 30, 68, 32, 3, shade(c, 0, 30, 0, 62, R_BLACK), EDGE, 2)
      c.fillStyle = shade(c, 0, 30, 0, 62, R_STEEL); c.fillRect(114, 31, 9, 30)
      // Its symbol: current flows the way the triangle points.
      poly(c, [86, 80, 86, 100, 106, 90], PRINT)
      c.fillStyle = PRINT; c.fillRect(106, 80, 3, 20); c.fillRect(74, 89, 12, 2.5); c.fillRect(109, 89, 15, 2.5)
    } },
  { ...base, kind: 'capacitor', name: 'Capacitor', w: 200, h: 110, params: { uf: 10000 }, polar: true, terminals: ends,
    settings: [{ key: 'uf', label: 'Capacitance', min: 1000, max: 47000, step: 1000, unit: 'µF' }],
    circuit: (id, a, b, q) => ({ id, kind: 'capacitor', a, b, farads: q.uf * 1e-6 }),
    moving: (_q, l) => Math.abs(l.amps) > 1e-4,
    paint(c, q, l) {
      mount(c, 6, 10, 188, 98)
      legs(c, 108, 132, 74)
      // A standing can: sleeve, crimp, a pale stripe on the − side.
      box(c, 92, 14, 56, 62, 3, shade(c, 92, 0, 148, 0, ['#0e1e38', '#3a6db0', '#1f4579', '#0b1830']), EDGE, 2)
      c.fillStyle = shade(c, 0, 15, 0, 22, ['#f4f7f9', '#9aa4ad']); c.fillRect(93, 15, 54, 7)
      c.fillStyle = 'rgba(218,226,238,.9)'; c.fillRect(132, 22, 12, 53)
      for (const y of [32, 46, 60]) text(c, '−', 138, y, 13, '#14305a', 'center', 700)
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(93, 26, 54, 2)
      text(c, `${q.uf / 1000}`, 112, 44, 17, '#fff', 'center', 700)
      text(c, 'mF', 112, 60, 12, '#dbe6f5')
      readout(c, `${Math.abs(l.volts).toFixed(1)} V`, 62, 44, 14)
    } },
  { ...base, kind: 'coil', name: 'Coil', w: 220, h: 110, params: { h: 2, r: 8 }, terminals: [[28, 90], [192, 90]],
    settings: [{ key: 'h', label: 'Inductance', min: .2, max: 10, step: .2, unit: 'H' }, { key: 'r', label: 'Wire resistance', min: 1, max: 50, step: 1, unit: 'Ω' }],
    circuit: (id, a, b, q) => ({ id, kind: 'inductor', a, b, henries: q.h, r: q.r }),
    moving: (q, l) => Math.abs(l.amps - l.volts / q.r) > 1e-3,
    paint(c, q) {
      mount(c, 6, 10, 208, 98)
      legs(c, 46, 174, 70, 220)
      winding(c, 50, 22, 120, 44)
      for (const x of [42, 169]) box(c, x, 16, 9, 56, 1, shade(c, 0, 16, 0, 72, DARK_METAL), EDGE, 1.5)
      print(c, `${q.h} H · ${q.r} Ω`, 110, 90, 16)
    } },
  { ...base, kind: 'ammeter', name: 'Ammeter', w: 200, h: 210, params: { range: 1 }, polar: true, terminals: [[28, 188], [172, 188]],
    settings: [{ key: 'range', label: 'Scale up to', choices: ['0.5 A', '1 A', '5 A'], apply: (v, q) => { q.range = [0.5, 1, 5][v] } }],
    circuit: (id, a, b) => ({ id, kind: 'resistor', a, b, ohms: .01 }),
    paint(c, q, l) {
      const back = l.amps < -.0005
      meter(c, l.amps, 0, q.range, 'A', scaleLabels(q.range), back ? 'Connected backwards' : fmt(Math.abs(l.amps) < 5e-4 ? 0 : l.amps, 'A'), back)
    } },
  { ...base, kind: 'voltmeter', name: 'Voltmeter', w: 200, h: 210, params: { range: 10 }, polar: true, terminals: [[28, 188], [172, 188]],
    settings: [{ key: 'range', label: 'Scale up to', choices: ['3 V', '10 V', '30 V'], apply: (v, q) => { q.range = [3, 10, 30][v] } }],
    circuit: (id, a, b) => ({ id, kind: 'resistor', a, b, ohms: 1e7 }),
    paint(c, q, l) {
      const back = l.volts < -.005
      meter(c, l.volts, 0, q.range, 'V', scaleLabels(q.range), back ? 'Connected backwards' : fmt(Math.abs(l.volts) < .005 ? 0 : l.volts, 'V'), back)
    } },
  { ...base, kind: 'galvanometer', name: 'Galvanometer', w: 200, h: 210, params: { range: .01 }, terminals: [[28, 188], [172, 188]],
    settings: [{ key: 'range', label: 'Full swing at', choices: ['1 mA', '10 mA', '100 mA'], apply: (v, q) => { q.range = [.001, .01, .1][v] } }],
    circuit: (id, a, b) => ({ id, kind: 'resistor', a, b, ohms: 100 }),
    paint(c, q, l) {
      const m = q.range * 1000
      meter(c, l.amps, -q.range, q.range, 'G', [`${m}`, '0', `${m}`], fmt(Math.abs(l.amps) < 1e-6 ? 0 : l.amps, 'A'))
    } },
  { ...base, kind: 'fuse', name: 'Fuse', w: 200, h: 110, params: { a: 1, blown: 0 }, terminals: ends,
    settings: [{ key: 'a', label: 'Blows above', min: .1, max: 10, step: .1, unit: 'A' }],
    controls: [{ name: 'Replace the fuse', at: () => [100, 48], reach: 44, tap: q => { q.blown = 0 } }],
    circuit: (id, a, b, q) => q.blown ? { id, kind: 'open', a, b } : { id, kind: 'resistor', a, b, ohms: .05 },
    paint(c, q) {
      mount(c, 6, 10, 188, 98)
      legs(c, 60, 140, 70, 200, 90, BRASS_LEAD)
      // Sprung clips hold a glass tube with steel caps, and a thin wire inside.
      for (const x of [50, 130]) box(c, x, 56, 20, 18, 1, shade(c, 0, 56, 0, 74, R_BRASS), EDGE, 1.5)
      box(c, 60, 32, 80, 32, 1, q.blown ? 'rgba(150,150,150,.75)' : 'rgba(226,238,246,.85)', EDGE, 1.5)
      if (q.blown) {
        const g = c.createRadialGradient(100, 48, 2, 100, 48, 26); g.addColorStop(0, 'rgba(25,20,18,.8)'); g.addColorStop(1, 'rgba(25,20,18,0)')
        c.fillStyle = g; c.fillRect(62, 33, 76, 30)
        line(c, 68, 48, 90, 44, '#2a2a2a', 2); line(c, 110, 52, 132, 48, '#2a2a2a', 2)
      } else line(c, 68, 48, 132, 48, '#4a5058', 2)
      line(c, 72, 38, 128, 38, 'rgba(255,255,255,.8)', 2.5)
      for (const x of [48, 134]) box(c, x, 30, 18, 36, 1, shade(c, 0, 30, 0, 66, R_STEEL), EDGE, 1.5)
      print(c, `${q.a} A`, 100, 90, 17)
      if (q.blown) readout(c, 'Blown · tap to replace', 100, 16, 13, WARN)
    } },
  { ...base, kind: 'motor', name: 'Motor', w: 200, h: 180, params: { spin: 0 }, terminals: [[28, 158], [172, 158]],
    circuit: (id, a, b) => ({ id, kind: 'resistor', a, b, ohms: 8 }),
    moving: (_q, l) => Math.abs(l.amps) > .02,
    paint(c, q, l) {
      mount(c, 6, 132, 188, 44)
      lead(c, [28, 158, 70, 158, 70, 130]); lead(c, [172, 158, 118, 158, 118, 130])
      box(c, 60, 102, 68, 34, 1, shade(c, 0, 102, 0, 136, DARK_METAL), EDGE, 1.5)
      // A small motor from the side: plastic end with its tabs, steel can, shaft, and a propeller on the shaft.
      for (const y of [60, 90]) box(c, 22, y, 12, 6, 1, shade(c, 0, y, 0, y + 6, R_BRASS), EDGE, 1)
      box(c, 30, 54, 16, 44, 1, shade(c, 0, 54, 0, 98, R_BLACK), EDGE, 1.5)
      box(c, 44, 46, 90, 60, 2, shade(c, 0, 46, 0, 106, R_STEEL), EDGE, 2)
      c.fillStyle = 'rgba(40,48,56,.3)'; c.fillRect(116, 47, 3, 58)
      for (const y of [58, 72, 86]) { c.fillStyle = 'rgba(30,36,42,.55)'; c.fillRect(60, y, 26, 5) }
      box(c, 134, 64, 8, 24, 1, shade(c, 0, 64, 0, 88, R_STEEL), EDGE, 1.5)
      box(c, 142, 73, 16, 6, 0, shade(c, 0, 73, 0, 79, R_STEEL), EDGE, 1)
      // Speed follows the current; the direction follows which way it flows.
      q.spin += Math.sign(l.amps) * Math.min(1.2, Math.abs(l.amps) * 1.1) * .22
      const reach = 54 * Math.cos(q.spin)
      if (Math.abs(reach) > 1) {
        box(c, 155, 76 - Math.abs(reach), 9, Math.abs(reach), 1, reach > 0 ? AMBER : '#aeb7bf', EDGE, 1.5)
        box(c, 155, 76, 9, Math.abs(reach), 1, reach > 0 ? '#aeb7bf' : AMBER, EDGE, 1.5)
      }
      box(c, 153, 68, 13, 16, 1, shade(c, 0, 68, 0, 84, DARK_METAL), EDGE, 1.5)
      // The symbol, as drawn in a circuit diagram, with a dot that runs round it the way the motor turns.
      c.beginPath(); c.arc(94, 155, 13, 0, Math.PI * 2); c.strokeStyle = PRINT; c.lineWidth = 1.8; c.stroke()
      print(c, 'M', 94, 155, 13, PRINT, 700)
      disc(c, 94 + 13 * Math.cos(q.spin * .35), 155 + 13 * Math.sin(q.spin * .35), 3.5, AMBER, EDGE, 1)
    } },
  { ...base, kind: 'buzzer', name: 'Buzzer', w: 170, h: 150, params: {}, polar: true, terminals: [[28, 128], [142, 128]],
    circuit: (id, a, b) => ({ id, kind: 'resistor', a, b, ohms: 100 }),
    moving: (_q, l) => l.amps > .005,
    paint(c, _q, l) {
      const on = l.amps > .005, wob = on ? Math.sin(l.time * 40) * 1.2 : 0
      if (on) for (const r of [54, 66, 78]) {
        const grow = r + (l.time * 60 % 12), fade = .9 - (grow - 54) / 45
        for (const mid of [0, Math.PI]) { c.beginPath(); c.arc(85, 52, grow, mid - .55, mid + .55); c.strokeStyle = `rgba(227,154,45,${Math.max(.15, fade)})`; c.lineWidth = 2.5; c.lineCap = 'round'; c.stroke() }
      }
      mount(c, 8, 104, 154, 42)
      lead(c, [28, 128, 66, 128, 66, 88]); lead(c, [142, 128, 104, 128, 104, 88])
      // A round sounder seen from above: a black case and the small hole the sound comes from.
      disc(c, 85 + wob, 52, 44, shade(c, 50, 10, 120, 96, ['#565c64', '#22262b', '#0d0f12']), EDGE, 2)
      c.beginPath(); c.arc(85 + wob, 52, 34, 0, Math.PI * 2); c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1.5; c.stroke()
      disc(c, 85 + wob, 52, 9, '#050607', 'rgba(255,255,255,.3)', 1.5)
      text(c, '+', 58 + wob, 36, 16, 'rgba(255,255,255,.75)', 'center', 700)
    } }
]
addParts(ELECTRIC)
