// A picture of every physics part, on a white and on a dark board, to judge how they look. Run: node e2e/parts-sheet.mjs [out.png]
import { launch, appDir, fw } from './lib.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const out = process.argv[2] ?? join(appDir, 'docs', 'apparatus-qa', 'physics-sheet.png')
mkdirSync(dirname(out), { recursive: true })
const { app, page } = await launch({ layout: 'board' })
try {
  const data = await fw(page, w => {
    // The states worth seeing: each part at rest and, where it matters, working.
    const rows = [
      ['cell', {}, {}], ['battery', {}, {}], ['ac-supply', {}, { time: .4 }], ['switch', { on: 0 }, {}], ['switch', { on: 1 }, {}], ['resistor', { r: 470 }, {}], ['rheostat', {}, {}],
      ['bulb', {}, {}], ['bulb', {}, { volts: 6, amps: .5 }], ['bulb', { burnt: 1 }, {}], ['led', { hue: 0 }, {}], ['led', { hue: 1 }, { amps: .1 }], ['diode', {}, {}], ['capacitor', {}, { volts: 4.2 }], ['coil', {}, {}],
      ['ammeter', {}, { amps: .5 }], ['voltmeter', {}, { volts: 6 }], ['galvanometer', {}, { amps: .004 }], ['fuse', {}, {}], ['fuse', { blown: 1 }, {}], ['motor', {}, { amps: .5 }], ['buzzer', {}, {}], ['buzzer', {}, { amps: .05, time: .13 }],
      ['ray-box', {}, {}], ['ray-box', { beams: 1 }, {}], ['convex-lens', {}, {}], ['concave-lens', {}, {}], ['mirror', {}, {}], ['prism', {}, {}], ['bar-magnet', { field: 1 }, {}], ['bar-magnet', {}, {}], ['compass', {}, { value: .5 }],
      ['force', {}, {}], ['spring-balance', {}, {}], ['pendulum', { on: 1 }, { time: .2 }], ['vernier', {}, {}]
    ]
    const gap = 44, width = 1500, sheet = document.createElement('canvas')
    let x = gap, y = gap + 30, tall = 0
    const at = rows.map(([kind]) => {
      const p = w.apparatus.partOf(kind)
      if (x + p.w > width - gap) { x = gap; y += tall + gap + 30; tall = 0 }
      const spot = [x, y]; x += p.w + gap; tall = Math.max(tall, p.h)
      return spot
    })
    const height = y + tall + gap
    sheet.width = width; sheet.height = height * 2
    const c = sheet.getContext('2d')
    for (const [dark, top] of [[false, 0], [true, height]]) {
      c.fillStyle = dark ? '#1f2a2c' : '#ffffff'; c.fillRect(0, top, width, height)
      rows.forEach(([kind, params, live], i) => {
        const part = w.apparatus.partOf(kind)
        c.save(); c.translate(at[i][0], top + at[i][1])
        c.font = '600 13px "Segoe UI"'; c.fillStyle = dark ? '#8fa0a8' : '#7a8691'; c.textAlign = 'left'; c.textBaseline = 'alphabetic'
        c.fillText(part.name, 0, -12)
        const q = { ...part.params, ...params }, it = { t: 'a', id: 'sheet', kind, params: q, p: [0, 0, part.w, part.h] }
        part.paint(c, q, { volts: 0, amps: 0, time: 0, dark, ...live }, it)
        part.terminals?.forEach(([tx, ty], t) => w.apparatus.post(c, tx, ty, part.polar ? t === 0 ? 'plus' : 'minus' : 'plain'))
        c.restore()
      })
    }
    return sheet.toDataURL('image/png')
  })
  writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'))
  console.log('wrote', out)
} finally { await app.close() }
