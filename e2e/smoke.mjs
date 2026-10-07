import { launch, gesture, wave, shotDir } from './lib.mjs'
import { join } from 'node:path'

const { app, page, logs } = await launch()
const size = await page.evaluate(() => ({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio }))
console.log('window', size)

// draw a few things with different devices
await gesture(page, wave(200, 160), { type: 'pen', pressure: 'wave' })
await gesture(page, wave(200, 240), { type: 'mouse' })
await gesture(page, wave(200, 320, 60, 24, 5, 0.3), { type: 'touch', id: 2 })
console.log('items after drawing:', await page.evaluate(() => window.__fw.itemCount()))

await page.screenshot({ path: join(shotDir, 'smoke.png') })
console.log('console logs:', logs.length ? logs : 'none')
await app.close()
