import { ELEMENTS } from '../elements'
import { CONTENTS, INDICATORS, liquidColor, phOf, shellsOf, universalColor } from './chem'
import type { C, Control, Live, Params, Part, Setting } from './parts'
import { BLACK, BRASS, STEEL, WOOD, addParts, box, disc, glass, grip, ink, line, plate, poly, shade, text } from './parts'

const base = { subject: 'chemistry' as const }
const fresh = (ml: number, content = 0): Params => ({ ml, acid: CONTENTS[content].acid * ml, base: CONTENTS[content].base * ml, dye: CONTENTS[content].dye, indicator: 0, temp: 27, content, showPh: 0 })

/** Choosing what a vessel holds fills it again with that liquid, at its current volume. */
const liquidSettings: Setting[] = [
  { key: 'content', label: 'Holds', choices: CONTENTS.map(c => c.name), apply: (v, q) => { const k = CONTENTS[v]; q.content = v; q.acid = k.acid * q.ml; q.base = k.base * q.ml; q.dye = k.dye } },
  { key: 'indicator', label: 'Indicator', choices: INDICATORS },
  { key: 'showPh', label: 'Show the pH', toggle: true }
]

/** Vessels share their working: `outline` is the glass, and `widthAt` tells the liquid how wide the glass is at a height. */
interface Vessel { kind: string; name: string; w: number; h: number; ml: number; cap: number; top: number; bottom: number; left: number; outline: (c: C) => void; widthAt?: (y: number) => [number, number]; scale?: boolean; group?: string }

function fillLevel(v: Vessel, q: Params): number { return v.bottom - (v.bottom - v.top) * Math.min(1, q.ml / v.cap) }

function drawLiquid(c: C, v: Vessel, q: Params, l: Live): void {
  if (q.ml <= .01) return
  const y = fillLevel(v, q), { color, alpha } = liquidColor(q as never)
  c.save(); c.beginPath(); v.outline(c); c.clip()
  c.globalAlpha *= alpha; c.fillStyle = color; c.fillRect(0, y, v.w, v.h - y)
  c.restore()
  line(c, v.left, y, v.w - v.left, y, 'rgba(255,255,255,.55)', 2)
  // It boils at 100 °C; bubbles begin to rise well before that.
  if (q.temp > 60) {
    const hot = Math.min(1, (q.temp - 60) / 40), n = Math.round(4 + hot * 12)
    c.save(); c.beginPath(); v.outline(c); c.clip()
    for (let i = 0; i < n; i++) {
      const seed = i * 37.7, cycle = ((l.time * (.4 + hot) + seed * .13) % 1)
      const bx = v.left + 8 + ((seed * 13.1) % (v.w - v.left * 2 - 16)), by = v.bottom - (v.bottom - y) * cycle
      disc(c, bx, by, 2.5 + hot * 3.5, 'rgba(255,255,255,.75)')
    }
    c.restore()
  }
}

function vessel(d: Vessel): Part {
  const controls: Control[] = [{
    name: 'Liquid level', reach: 28, at: q => [d.w / 2, fillLevel(d, q)],
    drag: (q, _x, y) => {
      const ml = Math.max(0, Math.min(d.cap, Math.round((d.bottom - y) / (d.bottom - d.top) * d.cap)))
      const share = q.ml > 0 ? ml / q.ml : 0
      if (q.ml > 0) { q.acid *= share; q.base *= share } else { const k = CONTENTS[q.content ?? 0]; q.acid = k.acid * ml; q.base = k.base * ml }
      q.ml = ml
    }
  }]
  return {
    ...base, group: d.group ?? 'Glassware', kind: d.kind, name: d.name, w: d.w, h: d.h, params: fresh(d.ml), settings: liquidSettings, controls,
    moving: q => q.temp > 60,
    paint(c, q, l) {
      drawLiquid(c, d, q, l)
      glass(c, () => d.outline(c), l.dark)
      if (d.scale) for (let i = 1; i <= 4; i++) {
        const y = d.bottom - (d.bottom - d.top) * i / 5
        line(c, d.left + 10, y, d.left + 30, y, ink(l), 1.6)
        text(c, String(Math.round(d.cap * i / 5)), d.left + 34, y, 12, ink(l), 'left')
      }
      grip(c, d.w / 2, fillLevel(d, q), 8, '#2f7fd6')
      if (q.showPh) plate(c, `pH ${phOf(q.acid, q.base, q.ml).toFixed(1)}`, d.w / 2, d.h - 16, 16)
      if (q.temp > 32) plate(c, `${Math.round(q.temp)} °C`, d.w / 2, 18, 14, '#7a1912')
    }
  }
}

const BEAKER: Vessel = { kind: 'beaker', name: 'Beaker', w: 180, h: 210, ml: 100, cap: 250, top: 34, bottom: 196, left: 24, scale: true,
  outline: c => { c.moveTo(14, 18); c.lineTo(24, 26); c.lineTo(24, 186); c.quadraticCurveTo(24, 198, 36, 198); c.lineTo(144, 198); c.quadraticCurveTo(156, 198, 156, 186); c.lineTo(156, 26); c.lineTo(166, 18) } }
const CONICAL: Vessel = { kind: 'conical-flask', name: 'Conical flask', w: 190, h: 240, ml: 25, cap: 250, top: 70, bottom: 224, left: 26, scale: false,
  outline: c => { c.moveTo(74, 12); c.lineTo(74, 76); c.lineTo(18, 208); c.quadraticCurveTo(10, 226, 30, 226); c.lineTo(160, 226); c.quadraticCurveTo(180, 226, 172, 208); c.lineTo(116, 76); c.lineTo(116, 12) } }
const ROUND: Vessel = { kind: 'round-flask', name: 'Round-bottom flask', w: 200, h: 240, ml: 100, cap: 500, top: 60, bottom: 232, left: 24,
  outline: c => { c.moveTo(82, 12); c.lineTo(82, 72); c.arc(100, 152, 82, -1.79, -1.35, true); c.lineTo(118, 12) } }
const TUBE: Vessel = { kind: 'test-tube', name: 'Test tube', w: 70, h: 260, ml: 10, cap: 25, top: 26, bottom: 244, left: 16,
  outline: c => { c.moveTo(14, 12); c.lineTo(14, 222); c.arc(35, 222, 21, Math.PI, 0, true); c.lineTo(56, 12) } }
const CYLINDER: Vessel = { kind: 'measuring-cylinder', name: 'Measuring cylinder', w: 110, h: 340, ml: 40, cap: 100, top: 30, bottom: 304, left: 22, scale: true,
  outline: c => { c.moveTo(22, 12); c.lineTo(22, 306); c.lineTo(88, 306); c.lineTo(88, 12) } }
const DISH: Vessel = { kind: 'evaporating-dish', name: 'Evaporating dish', w: 190, h: 90, ml: 20, cap: 60, top: 26, bottom: 76, left: 18,
  outline: c => { c.moveTo(12, 22); c.quadraticCurveTo(30, 84, 95, 84); c.quadraticCurveTo(160, 84, 178, 22) } }

export const NOZZLE: Record<string, [number, number]> = { burette: [60, 448], dropper: [40, 200], 'reagent-bottle': [70, 10] }

export const CHEMISTRY: Part[] = [
  vessel(BEAKER), vessel(CONICAL), vessel(ROUND), vessel(TUBE), vessel(CYLINDER), vessel(DISH),
  { ...base, group: 'Glassware', kind: 'burette', name: 'Burette', w: 120, h: 460, params: { ...fresh(50, 2), open: 0 }, settings: liquidSettings,
    controls: [{ name: 'Burette tap', at: () => [60, 412], reach: 32, tap: q => { q.open = q.open ? 0 : 1 } }],
    moving: q => !!q.open && q.ml > 0,
    paint(c, q, l) {
      const top = 22, bottom = 382, y = bottom - (bottom - top) * Math.min(1, q.ml / 50), { color, alpha } = liquidColor(q as never)
      c.save(); c.globalAlpha *= alpha; c.fillStyle = color; c.fillRect(49, y, 22, bottom - y + 18); c.restore()
      glass(c, () => { c.moveTo(48, 12); c.lineTo(48, 398); c.lineTo(72, 398); c.lineTo(72, 12) }, l.dark)
      for (let i = 0; i <= 50; i += 5) { const py = top + (bottom - top) * i / 50; line(c, 48, py, i % 10 ? 56 : 62, py, ink(l), 1.4); if (i % 10 === 0) text(c, String(i), 78, py, 12, ink(l), 'left') }
      glass(c, () => { c.moveTo(52, 398); c.lineTo(56, 448); c.lineTo(64, 448); c.lineTo(68, 398) }, l.dark, 2)
      c.save(); c.translate(60, 412); c.rotate(q.open ? Math.PI / 2 : 0)
      box(c, -22, -7, 44, 14, 6, q.open ? '#2fa66a' : '#d43b33')
      c.restore()
      if (q.open && q.ml > 0) { const f = l.time * 2.4 % 1; disc(c, 60, 452 + f * 6, 3, `${color}`) }
      plate(c, `${(50 - q.ml).toFixed(1)} mL used`, 60, 6, 13)
      if (!q.open) plate(c, 'Tap to open', 60, 432, 12)
    } },
  { ...base, group: 'Glassware', kind: 'reagent-bottle', name: 'Reagent bottle', w: 140, h: 200, params: { ...fresh(250, 1), pour: 0 }, settings: liquidSettings,
    controls: [{ name: 'Pour 10 mL into what is below', at: () => [70, 34], reach: 34, tap: q => { q.pour = (q.pour ?? 0) + 1 } }],
    paint(c, q, l) {
      const { color, alpha } = liquidColor(q as never)
      box(c, 16, 60, 108, 132, 14, shade(c, 16, 0, 124, 0, ['#7a5a30', '#a47a42', '#6f5128']))
      c.save(); c.globalAlpha *= alpha * .8; c.fillStyle = color; c.fillRect(22, 88, 96, 98); c.restore()
      box(c, 54, 22, 32, 40, 6, shade(c, 54, 0, 86, 0, ['#7a5a30', '#a47a42', '#6f5128']))
      box(c, 48, 10, 44, 18, 5, shade(c, 0, 10, 0, 28, STEEL))
      box(c, 26, 104, 88, 48, 3, '#fbf7ea', 'rgba(30,20,10,.4)', 1)
      const name = CONTENTS[q.content]?.name ?? ''
      name.split(' ').slice(0, 3).forEach((w, i, all) => text(c, w, 70, 128 - (all.length - 1) * 8 + i * 16, 13, '#172033'))
      plate(c, 'Tap cap to pour', 70, 44, 11); void l
    } },
  { ...base, group: 'Glassware', kind: 'funnel', name: 'Funnel', w: 150, h: 180, params: {},
    paint(c, _q, l) { glass(c, () => { c.moveTo(10, 14); c.lineTo(140, 14); c.lineTo(84, 98); c.lineTo(84, 170); c.lineTo(66, 170); c.lineTo(66, 98); c.closePath() }, l.dark) } },
  { ...base, group: 'Heating and support', kind: 'bunsen', name: 'Bunsen burner', w: 130, h: 240, params: { on: 0 },
    controls: [{ name: 'Burner on or off', at: () => [40, 200], reach: 34, tap: q => { q.on = q.on ? 0 : 1 } }],
    moving: q => !!q.on,
    paint(c, q, l) {
      if (q.on) {
        const f = Math.sin(l.time * 18) * 5
        poly(c, [65, 26 + f, 88, 92, 42, 92], 'rgba(70,120,255,.55)')
        poly(c, [65, 54 - f * .5, 78, 92, 52, 92], 'rgba(120,200,255,.9)')
      }
      box(c, 52, 92, 26, 110, 3, shade(c, 52, 0, 78, 0, BRASS))
      box(c, 46, 170, 38, 12, 2, shade(c, 46, 0, 84, 0, ['#8a6a2a', '#d3b064', '#8a6a2a']))
      box(c, 16, 202, 98, 30, 6, shade(c, 0, 202, 0, 232, BLACK))
      disc(c, 40, 200, 14, q.on ? '#2fa66a' : '#d43b33', 'rgba(0,0,0,.5)')
      text(c, q.on ? 'ON' : 'OFF', 86, 217, 13, '#fff', 'center', 700)
    } },
  { ...base, group: 'Heating and support', kind: 'spirit-lamp', name: 'Spirit lamp', w: 140, h: 170, params: { on: 0 },
    controls: [{ name: 'Lamp on or off', at: () => [70, 62], reach: 44, tap: q => { q.on = q.on ? 0 : 1 } }],
    moving: q => !!q.on,
    paint(c, q, l) {
      if (q.on) poly(c, [70, 8 + Math.sin(l.time * 14) * 4, 86, 50, 54, 50], 'rgba(255,170,50,.9)')
      box(c, 62, 46, 16, 26, 3, '#f4eedc', 'rgba(30,20,10,.5)')
      c.beginPath(); c.ellipse(70, 118, 56, 46, 0, 0, Math.PI * 2); c.fillStyle = l.dark ? 'rgba(220,235,245,.18)' : 'rgba(205,225,240,.35)'; c.fill(); c.strokeStyle = l.dark ? '#e6f0fa' : '#3b4d5c'; c.lineWidth = 3; c.stroke()
      c.save(); c.beginPath(); c.ellipse(70, 118, 53, 43, 0, 0, Math.PI * 2); c.clip(); c.fillStyle = 'rgba(160,190,240,.5)'; c.fillRect(10, 112, 120, 60); c.restore()
      plate(c, q.on ? 'Lit' : 'Tap to light', 70, 118, 13)
    } },
  { ...base, group: 'Heating and support', kind: 'tripod', name: 'Tripod and gauze', w: 180, h: 170, params: {},
    paint(c, _q, l) {
      const m = l.dark ? '#c5ccd6' : '#3b4252'
      line(c, 34, 22, 14, 164, m, 7); line(c, 146, 22, 166, 164, m, 7); line(c, 90, 26, 90, 150, m, 6)
      box(c, 16, 12, 148, 12, 2, '#59616d', '')
      for (let x = 26; x < 160; x += 12) line(c, x, 12, x, 24, 'rgba(255,255,255,.3)', 1)
    } },
  { ...base, group: 'Heating and support', kind: 'retort-stand', name: 'Stand and clamp', w: 200, h: 460, params: { y: 120 },
    controls: [{ name: 'Clamp height', at: q => [46, q.y], reach: 34, drag: (q, _x, y) => { q.y = Math.max(40, Math.min(380, Math.round(y))) } }],
    paint(c, q, l) {
      box(c, 8, 432, 184, 22, 4, shade(c, 0, 432, 0, 454, BLACK))
      box(c, 40, 12, 12, 424, 4, shade(c, 40, 0, 52, 0, STEEL))
      box(c, 36, q.y - 12, 22, 24, 3, shade(c, 36, 0, 58, 0, BRASS))
      line(c, 58, q.y, 138, q.y, l.dark ? '#c5ccd6' : '#59616d', 7)
      c.beginPath(); c.arc(148, q.y, 16, -2.4, 2.4); c.strokeStyle = l.dark ? '#c5ccd6' : '#59616d'; c.lineWidth = 7; c.stroke()
      grip(c, 46, q.y, 9)
    } },
  { ...base, group: 'Measuring', kind: 'ph-strip', name: 'pH paper', w: 50, h: 170, params: {},
    paint(c, _q, l) {
      const colour = l.value !== undefined ? universalColor(l.value) : '#f1e7a4'
      box(c, 14, 8, 22, 154, 3, '#fbf7e4', 'rgba(30,20,10,.45)', 1.5)
      box(c, 14, 92, 22, 70, 3, colour, 'rgba(30,20,10,.45)', 1.5)
      if (l.value !== undefined) plate(c, `pH ${l.value.toFixed(0)}`, 25, 40, 12)
    } },
  { ...base, group: 'Measuring', kind: 'balance', name: 'Balance', w: 260, h: 130, params: {},
    paint(c, _q, l) {
      box(c, 14, 14, 232, 16, 8, shade(c, 0, 14, 0, 30, STEEL))
      box(c, 8, 44, 244, 80, 10, shade(c, 0, 44, 0, 124, ['#454b55', '#2a2e35']))
      box(c, 54, 62, 152, 44, 6, '#0d1a12', 'rgba(255,255,255,.2)', 1)
      text(c, `${(l.value ?? 0).toFixed(1)} g`, 130, 84, 28, '#7dff9a', 'center', 700)
    } },
  { ...base, group: 'Atoms', kind: 'atom', name: 'Atomic shells', w: 340, h: 370, params: { z: 11, spin: 1 },
    settings: [{ key: 'z', label: 'Element', min: 1, max: 36, step: 1 }, { key: 'spin', label: 'Electrons move', toggle: true }],
    moving: q => !!q.spin,
    paint(c, q, l) {
      const el = ELEMENTS[Math.round(q.z) - 1], shells = shellsOf(q.z), cx = 170, cy = 170, m = ink(l)
      const step = 34 + (4 - shells.length) * 9
      shells.forEach((count, i) => {
        const r = 40 + step * i
        disc(c, cx, cy, r, 'transparent', l.dark ? 'rgba(230,235,245,.55)' : 'rgba(40,50,70,.45)', 2)
        for (let k = 0; k < count; k++) {
          const a = k / count * Math.PI * 2 + (q.spin ? l.time * (.8 / (i + 1)) : 0)
          disc(c, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 7, '#2f6bff', 'rgba(255,255,255,.8)', 1.5)
        }
      })
      disc(c, cx, cy, 28, shade(c, cx - 20, cy - 20, cx + 20, cy + 20, ['#ff8a7a', '#d43b33', '#9c1f18']))
      text(c, el.symbol, cx, cy + 1, 22, '#fff', 'center', 800)
      text(c, `${el.name} · Z = ${el.z}`, cx, 346, 18, m, 'center', 700)
      text(c, shells.join(', '), cx, 366, 15, m, 'center', 600)
    } }
]
addParts(CHEMISTRY)
void BRASS, WOOD
