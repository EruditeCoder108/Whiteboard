import { ELEMENTS } from '../elements'
import { CONTENTS, INDICATORS, liquidColor, phOf, shellsOf, universalColor } from './chem'
import type { C, Control, Live, Params, Part, Setting } from './parts'
import { BLACK, BRASS, STEEL, WOOD, addParts, box, disc, glass, grip, ink, line, plate, shade, text } from './parts'

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
  // The meniscus must remain inside the neck/bowl, including a nearly full round flask.
  c.save(); c.beginPath(); v.outline(c); c.clip()
  c.beginPath(); c.moveTo(0, y - 2); c.quadraticCurveTo(v.w / 2, y + 3, v.w, y - 2)
  c.strokeStyle = l.dark ? 'rgba(235,248,252,.8)' : 'rgba(75,130,155,.65)'; c.lineWidth = 1.3; c.stroke()
  c.restore()
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
      const ceramic = d.kind === 'evaporating-dish', cylinder = d.kind === 'measuring-cylinder'
      if (ceramic) {
        c.beginPath(); d.outline(c); c.closePath(); c.fillStyle = shade(c, 0, 24, 0, 84, ['#fffdf3', '#e3dfd2']); c.fill()
      }
      drawLiquid(c, d, q, l)
      if (ceramic) {
        c.beginPath(); d.outline(c); c.strokeStyle = l.dark ? '#eee7d5' : '#777567'; c.lineWidth = 3; c.stroke()
        c.beginPath(); c.ellipse(95, 22, 82, 7, 0, 0, Math.PI * 2); c.strokeStyle = l.dark ? '#fff8e8' : '#8d8a7d'; c.lineWidth = 2; c.stroke()
      } else {
        glass(c, () => d.outline(c), l.dark, 2.5)
        c.save(); c.beginPath(); d.outline(c); c.clip()
        const highlight = cylinder ? 39 : d.left + 6
        line(c, highlight, d.top + 12, highlight, d.bottom - 14, l.dark ? 'rgba(235,247,250,.3)' : 'rgba(255,255,255,.8)', 3)
        c.restore()
        if (d.kind === 'beaker') line(c, 28, 27, 153, 27, l.dark ? '#bfd8e1' : '#809ba5', 1)
        if (d.kind === 'conical-flask') { line(c, 70, 12, 120, 12, l.dark ? '#e0edf1' : '#617f8e', 3); line(c, 77, 16, 113, 16, 'rgba(255,255,255,.6)', 1) }
        if (d.kind === 'round-flask') line(c, 79, 12, 121, 12, l.dark ? '#e0edf1' : '#617f8e', 3)
        if (d.kind === 'test-tube') { c.beginPath(); c.ellipse(35, 12, 21, 4, 0, 0, Math.PI * 2); c.strokeStyle = l.dark ? '#dcecf1' : '#617f8e'; c.lineWidth = 1.5; c.stroke() }
      }
      if (cylinder) {
        box(c, 12, 311, 86, 19, 5, shade(c, 0, 311, 0, 330, l.dark ? ['#8babb8', '#597887'] : ['#e8eff0', '#9aadb5']), l.dark ? '#d9e9ef' : '#617f8e', 1.5)
        line(c, 30, 307, 80, 307, l.dark ? '#dcecf1' : '#617f8e', 2)
      }
      if (d.scale) for (let i = 1; i <= (cylinder ? 20 : 10); i++) {
        const divisions = cylinder ? 20 : 10, y = d.bottom - (d.bottom - d.top) * i / divisions
        const major = i % 2 === 0, x = cylinder ? 40 : d.left + 10
        line(c, x, y, x + (major ? 17 : 10), y, ink(l), major ? 1.3 : .8)
        if (major) text(c, String(Math.round(d.cap * i / divisions)), cylinder ? 88 : d.left + 33, y, 11, ink(l), cylinder ? 'right' : 'left')
      }
      if (d.scale) text(c, 'mL', cylinder ? 55 : 126, cylinder ? 19 : 49, cylinder ? 9 : 10, ink(l))
      const level = fillLevel(d, q), badgeY = ceramic ? 10 : cylinder ? d.h - 16 : Math.abs(level - (d.h - 16)) < 22 ? 18 : d.h - 16
      grip(c, d.w / 2, level, 8, '#2f7fd6')
      if (q.showPh) plate(c, q.ml > .01 ? `pH ${phOf(q.acid, q.base, q.ml).toFixed(1)}` : 'Empty', d.w / 2, badgeY, Math.min(ceramic ? 12 : 14, d.w / 5.5))
      if (q.temp > 32 && q.ml > .01) {
        if (cylinder) { text(c, String(Math.round(q.temp)), 16, 158, 10, ink(l)); text(c, '°C', 16, 171, 9, ink(l)) }
        else plate(c, `${Math.round(q.temp)} °C`, d.w / 2, q.showPh && badgeY < 30 ? 46 : 18, 14, '#7a1912')
      }
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
  outline: c => { c.moveTo(31, 9); c.lineTo(34, 17); c.lineTo(34, 301); c.quadraticCurveTo(34, 307, 40, 307); c.lineTo(70, 307); c.quadraticCurveTo(76, 307, 76, 301); c.lineTo(76, 17); c.lineTo(82, 9) } }
const DISH: Vessel = { kind: 'evaporating-dish', name: 'Evaporating dish', w: 190, h: 90, ml: 20, cap: 60, top: 26, bottom: 76, left: 18,
  outline: c => { c.moveTo(12, 22); c.quadraticCurveTo(30, 84, 95, 84); c.quadraticCurveTo(160, 84, 178, 22) } }

export const NOZZLE: Record<string, [number, number]> = { burette: [60, 448], dropper: [40, 200], 'reagent-bottle': [70, 10] }

export const CHEMISTRY: Part[] = [
  vessel(BEAKER), vessel(CONICAL), vessel(ROUND), vessel(TUBE), vessel(CYLINDER), vessel(DISH),
  { ...base, group: 'Glassware', kind: 'burette', name: 'Burette', w: 120, h: 460, params: { ...fresh(50, 2), open: 0 }, settings: liquidSettings,
    controls: [{ name: 'Burette tap', at: () => [60, 412], reach: 32, tap: q => { q.open = q.open ? 0 : 1 } }],
    moving: q => !!q.open && q.ml > 0,
    paint(c, q, l) {
      const top = 30, bottom = 382, y = bottom - (bottom - top) * Math.min(1, q.ml / 50), { color, alpha } = liquidColor(q as never)
      if (q.ml > .01) {
        c.save(); c.globalAlpha *= alpha; c.fillStyle = color; c.fillRect(49, y, 22, 398 - y); c.restore()
        c.beginPath(); c.moveTo(49, y - 1.5); c.quadraticCurveTo(60, y + 3, 71, y - 1.5); c.strokeStyle = l.dark ? '#d4ebf0' : '#527f93'; c.lineWidth = 1.2; c.stroke()
      }
      glass(c, () => { c.moveTo(48, 12); c.lineTo(48, 398); c.lineTo(72, 398); c.lineTo(72, 12) }, l.dark)
      line(c, 52, 24, 52, 393, 'rgba(255,255,255,.55)', 1)
      for (let i = 0; i <= 50; i++) { const py = top + (bottom - top) * i / 50; line(c, 48, py, i % 5 ? 53 : i % 10 ? 57 : 62, py, ink(l), i % 5 ? .7 : 1.3); if (i % 10 === 0) text(c, String(i), 79, py, 11, ink(l), 'left') }
      glass(c, () => { c.moveTo(52, 398); c.lineTo(56, 448); c.lineTo(64, 448); c.lineTo(68, 398) }, l.dark, 2)
      c.save(); c.translate(60, 412); c.rotate(q.open ? Math.PI / 2 : 0)
      box(c, -22, -6, 44, 12, 5, shade(c, -22, 0, 22, 0, q.open ? ['#b6d7bd', '#4c8a67', '#426e54'] : ['#e3b3a7', '#a95848', '#804235']))
      disc(c, 0, 0, 4, '#e1e7df', '#56665a', 1)
      c.restore()
      if (q.open && q.ml > 0) { const f = l.time * 2.4 % 1; disc(c, 60, 450 + f * 6, 2.5, color) }
      plate(c, `${(50 - q.ml).toFixed(1)} mL`, 60, 10, 10)
      if (q.showPh) plate(c, q.ml > .01 ? `pH ${phOf(q.acid, q.base, q.ml).toFixed(1)}` : 'Empty', 60, 207, 11)
      plate(c, q.open ? 'Open' : 'Tap to open', 60, 433, 10)
    } },
  { ...base, group: 'Glassware', kind: 'reagent-bottle', name: 'Reagent bottle', w: 140, h: 200, params: { ...fresh(250, 1), pour: 0 }, settings: liquidSettings,
    controls: [{ name: 'Pour 10 mL into what is below', at: () => [70, 34], reach: 34, tap: q => { q.pour = (q.pour ?? 0) + 1 } }],
    paint(c, q, l) {
      const { color, alpha } = liquidColor(q as never)
      box(c, 16, 60, 108, 132, 14, shade(c, 16, 0, 124, 0, ['#7a5a30', '#a47a42', '#6f5128']))
      c.save(); c.beginPath(); c.roundRect(18, 62, 104, 128, 12); c.clip(); c.globalAlpha *= alpha * .5; c.fillStyle = color; const y = 188 - 112 * Math.min(1, q.ml / 250); if (q.ml > .01) c.fillRect(20, y, 100, 190 - y); c.restore()
      box(c, 54, 22, 32, 40, 6, shade(c, 54, 0, 86, 0, ['#7a5a30', '#a47a42', '#6f5128']))
      box(c, 48, 10, 44, 18, 5, shade(c, 0, 10, 0, 28, STEEL))
      line(c, 26, 78, 26, 174, 'rgba(255,233,186,.25)', 3)
      box(c, 22, 100, 96, 57, 3, '#fbf7ea', 'rgba(30,20,10,.4)', 1)
      const name = CONTENTS[q.content]?.name ?? ''
      name.split(' ').slice(0, 3).forEach((w, i, all) => text(c, w, 70, 128 - (all.length - 1) * 8 + i * 16, 13, '#172033'))
      text(c, `${Math.round(q.ml)} mL`, 70, 167, 11, '#fff3d8')
      if (q.showPh) plate(c, q.ml > .01 ? `pH ${phOf(q.acid, q.base, q.ml).toFixed(1)}` : 'Empty', 70, 183, 10)
      plate(c, 'Tap cap to pour', 70, 44, 10); void l
    } },
  { ...base, group: 'Glassware', kind: 'funnel', name: 'Funnel', w: 150, h: 180, params: {},
    paint(c, _q, l) {
      glass(c, () => { c.moveTo(10, 14); c.lineTo(140, 14); c.lineTo(84, 98); c.lineTo(84, 170); c.lineTo(66, 170); c.lineTo(66, 98); c.closePath() }, l.dark, 2.5)
      c.beginPath(); c.ellipse(75, 14, 65, 7, 0, 0, Math.PI * 2); c.strokeStyle = l.dark ? '#d6e9ef' : '#617f8e'; c.lineWidth = 1.5; c.stroke()
      line(c, 28, 26, 70, 92, 'rgba(235,247,250,.75)', 2)
      line(c, 71, 103, 71, 164, 'rgba(235,247,250,.7)', 2)
    } },
  { ...base, group: 'Heating and support', kind: 'bunsen', name: 'Bunsen burner', w: 130, h: 240, params: { on: 0 },
    controls: [{ name: 'Burner on or off', at: () => [40, 200], reach: 34, tap: q => { q.on = q.on ? 0 : 1 } }],
    moving: q => !!q.on,
    paint(c, q, l) {
      if (q.on) {
        const f = Math.sin(l.time * 18) * 3
        c.beginPath(); c.moveTo(65, 22 + f); c.bezierCurveTo(70, 47, 91, 72, 78, 92); c.quadraticCurveTo(65, 100, 52, 92); c.bezierCurveTo(40, 73, 60, 48, 65, 22 + f)
        c.fillStyle = shade(c, 0, 25, 0, 96, ['rgba(87,141,216,.2)', 'rgba(77,145,226,.75)', 'rgba(71,112,190,.8)']); c.fill()
        c.beginPath(); c.moveTo(65, 57); c.quadraticCurveTo(81, 91, 65, 94); c.quadraticCurveTo(49, 91, 65, 57); c.fillStyle = '#b5e3ef'; c.fill()
      }
      box(c, 52, 92, 26, 110, 3, shade(c, 52, 0, 78, 0, BRASS))
      box(c, 46, 170, 38, 12, 2, shade(c, 46, 0, 84, 0, ['#8a6a2a', '#d3b064', '#8a6a2a']))
      box(c, 54, 174, 13, 5, 2, '#343c40', '', 1)
      line(c, 78, 195, 116, 195, '#8c7148', 8)
      for (const x of [103, 109, 115]) line(c, x, 190, x, 200, '#544c3c', 1)
      box(c, 16, 202, 98, 30, 6, shade(c, 0, 202, 0, 232, BLACK))
      disc(c, 40, 200, 14, q.on ? '#2fa66a' : '#d43b33', 'rgba(0,0,0,.5)')
      text(c, q.on ? 'ON' : 'OFF', 86, 217, 12, '#fff', 'center', 600)
    } },
  { ...base, group: 'Heating and support', kind: 'spirit-lamp', name: 'Spirit lamp', w: 140, h: 170, params: { on: 0 },
    controls: [{ name: 'Lamp on or off', at: () => [70, 62], reach: 44, tap: q => { q.on = q.on ? 0 : 1 } }],
    moving: q => !!q.on,
    paint(c, q, l) {
      if (q.on) { c.beginPath(); c.moveTo(70, 8 + Math.sin(l.time * 14) * 3); c.bezierCurveTo(75, 23, 87, 43, 76, 50); c.quadraticCurveTo(70, 54, 64, 50); c.bezierCurveTo(53, 43, 66, 23, 70, 8); c.fillStyle = shade(c, 0, 8, 0, 51, ['rgba(229,189,101,.8)', '#91c2dc', '#5b94be']); c.fill() }
      box(c, 62, 46, 16, 26, 3, '#f4eedc', 'rgba(30,20,10,.5)')
      box(c, 56, 66, 28, 7, 2, shade(c, 56, 0, 84, 0, STEEL))
      box(c, 64, 46, 12, 4, 1, '#6d6452', '')
      c.beginPath(); c.ellipse(70, 118, 56, 46, 0, 0, Math.PI * 2); c.fillStyle = l.dark ? 'rgba(220,235,245,.18)' : 'rgba(205,225,240,.35)'; c.fill(); c.strokeStyle = l.dark ? '#e6f0fa' : '#3b4d5c'; c.lineWidth = 3; c.stroke()
      c.save(); c.beginPath(); c.ellipse(70, 118, 53, 43, 0, 0, Math.PI * 2); c.clip(); c.fillStyle = 'rgba(160,190,240,.5)'; c.fillRect(10, 112, 120, 60); c.restore()
      c.beginPath(); c.ellipse(48, 107, 8, 18, .35, 0, Math.PI * 2); c.strokeStyle = 'rgba(246,252,255,.7)'; c.lineWidth = 3; c.stroke()
      plate(c, q.on ? 'Lit' : 'Tap to light', 70, 136, 12)
    } },
  { ...base, group: 'Heating and support', kind: 'tripod', name: 'Tripod and gauze', w: 180, h: 170, params: {},
    paint(c, _q, l) {
      const m = l.dark ? '#c5ccd6' : '#3b4252'
      line(c, 34, 22, 14, 164, m, 7); line(c, 146, 22, 166, 164, m, 7); line(c, 90, 26, 90, 150, m, 6)
      c.beginPath(); c.ellipse(90, 24, 70, 12, 0, 0, Math.PI * 2); c.strokeStyle = m; c.lineWidth = 5; c.stroke()
      box(c, 16, 7, 148, 24, 2, l.dark ? '#667579' : '#c1c9c7', m, 1)
      for (let x = 22; x < 164; x += 6) line(c, x, 8, x, 30, l.dark ? '#c0ced0' : '#667977', .6)
      for (let y = 11; y < 31; y += 4) line(c, 17, y, 163, y, l.dark ? '#c0ced0' : '#667977', .6)
      c.beginPath(); c.ellipse(90, 19, 22, 9, 0, 0, Math.PI * 2); c.fillStyle = '#d8d4c6'; c.fill(); c.strokeStyle = '#8f948b'; c.lineWidth = .8; c.stroke()
    } },
  { ...base, group: 'Heating and support', kind: 'retort-stand', name: 'Stand and clamp', w: 200, h: 460, params: { y: 120 },
    controls: [{ name: 'Clamp height', at: q => [46, q.y], reach: 34, drag: (q, _x, y) => { q.y = Math.max(40, Math.min(380, Math.round(y))) } }],
    paint(c, q, l) {
      box(c, 8, 432, 184, 22, 4, shade(c, 0, 432, 0, 454, BLACK))
      box(c, 40, 12, 12, 424, 4, shade(c, 40, 0, 52, 0, STEEL))
      box(c, 36, q.y - 12, 22, 24, 3, shade(c, 36, 0, 58, 0, BRASS))
      line(c, 58, q.y, 138, q.y, l.dark ? '#c5ccd6' : '#59616d', 7)
      c.beginPath(); c.arc(148, q.y, 16, -2.4, 2.4); c.strokeStyle = l.dark ? '#c5ccd6' : '#59616d'; c.lineWidth = 7; c.stroke()
      for (const s of [-1, 1]) { line(c, 136, q.y + s * 12, 158, q.y + s * 13, '#6d7374', 5); line(c, 148, q.y + s * 12, 158, q.y + s * 13, '#b9ad8b', 3) }
      line(c, 38, q.y - 5, 54, q.y - 5, 'rgba(255,245,210,.45)', 1)
      line(c, 16, 437, 181, 437, 'rgba(235,240,242,.22)', 1)
      grip(c, 46, q.y, 9)
    } },
  { ...base, group: 'Measuring', kind: 'ph-strip', name: 'pH paper', w: 50, h: 170, params: {},
    paint(c, _q, l) {
      const colour = l.value !== undefined ? universalColor(l.value) : '#f1e7a4'
      box(c, 14, 8, 22, 154, 3, shade(c, 14, 0, 36, 0, ['#e9e0bc', '#fff9e5', '#e9e0bc']), l.dark ? '#d5d3bd' : '#8f8a71', 1.2)
      box(c, 14, 92, 22, 70, 3, colour, 'rgba(30,20,10,.45)', 1.5)
      if (l.value !== undefined) plate(c, `pH ${l.value.toFixed(0)}`, 25, 40, 11)
    } },
  { ...base, group: 'Measuring', kind: 'balance', name: 'Balance', w: 260, h: 130, params: {},
    paint(c, _q, l) {
      box(c, 14, 14, 232, 16, 8, shade(c, 0, 14, 0, 30, STEEL))
      box(c, 8, 44, 244, 80, 10, shade(c, 0, 44, 0, 124, ['#454b55', '#2a2e35']))
      box(c, 54, 62, 152, 44, 6, '#0d1a12', 'rgba(255,255,255,.2)', 1)
      line(c, 20, 49, 240, 49, '#70777b', 1)
      for (const x of [25, 235]) disc(c, x, 111, 2, '#889498')
      text(c, `${(l.value ?? 0).toFixed(1)} g`, 130, 84, 24, '#a6dcb3', 'center', 600)
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
          disc(c, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 6, '#427b9c', 'rgba(247,253,255,.9)', 1.5)
        }
      })
      disc(c, cx, cy, 28, shade(c, cx - 20, cy - 20, cx + 20, cy + 20, ['#ff8a7a', '#d43b33', '#9c1f18']))
      text(c, el.symbol, cx, cy + 1, 22, '#fff', 'center', 800)
      text(c, `${el.symbol === 'S' ? 'Sulphur' : el.name} · Z = ${el.z}`, cx, 333, 17, m, 'center', 600)
      text(c, shells.map((n, i) => `${'KLMN'[i]}: ${n}`).join('   '), cx, 355, 13, m)
    } }
]
addParts(CHEMISTRY)
void BRASS, WOOD
