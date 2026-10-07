import { launch } from './lib.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { appDir } from './lib.mjs'

const tag = process.argv[2] === 'baseline' ? 'baseline' : 'phase2'
const { app, page } = await launch()
try {
  await page.waitForFunction(() => window.__fw.S.ready.value)
  const result = await page.evaluate(async () => {
    const { board, S } = window.__fw
    S.radialEnabled.value = false
    const items = Array.from({ length: 4000 }, (_, s) => {
      const p = [], x = (s % 80) * 60, y = Math.floor(s / 80) * 40
      for (let i = 0; i < 60; i++) p.push(x + i * .9, y + 12 * Math.sin(i * .3), .5)
      return { t: 's', id: 'perf' + s, c: '#111827', w: 2.5, m: false, v: false, p }
    })
    const frame = () => new Promise(r => requestAnimationFrame(r))
    board.doc.replaceAll(items); board.setView({ x: 0, y: 0, zoom: .35 }); board.refresh(null)
    await frame(); await frame()
    const intervals = []
    let last = performance.now()
    for (let i = 0; i < 90; i++) {
      board.panBy(6, 3); await frame()
      const now = performance.now(); intervals.push(now - last); last = now
    }
    intervals.sort((a, b) => a - b)
    return { strokes: items.length, samples: 240000, panMeanMs: intervals.reduce((a, b) => a + b, 0) / intervals.length, panP95Ms: intervals[Math.floor(intervals.length * .95)] }
  })
  mkdirSync(join(appDir, '.work'), { recursive: true })
  writeFileSync(join(appDir, '.work', `performance-${tag}.json`), JSON.stringify(result, null, 2))
  console.log(JSON.stringify({ tag, ...result }))
} finally { await app.close() }
