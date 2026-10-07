// Visual check of the laser trail: a slow and a fast stroke should both look smooth (no dots).
import { launch, hover, shotDir, check, summary, fw } from './lib.mjs'
import { join } from 'node:path'

const { app, page } = await launch()
// park the window off-screen so the real mouse cursor can't interfere with the synthetic events
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 4000, y: 100, width: 900, height: 600 }))
await page.waitForTimeout(500)
await page.evaluate(() => window.__fw.board.setTool('laser'))
const sleep = (ms) => page.waitForTimeout(ms)

// slow stroke (points very close together)
for (let i = 0; i < 90; i++) { await hover(page, 200 + i * 2.2, 200 + 40 * Math.sin(i * 0.09)); await sleep(14) }
await page.screenshot({ path: join(shotDir, 'laser-slow.png'), clip: { x: 150, y: 120, width: 520, height: 180 } })
// fast stroke (points far apart)
await sleep(2600)
for (let i = 0; i < 24; i++) { await hover(page, 200 + i * 20, 420 + 40 * Math.sin(i * 0.33)); await sleep(14) }
await page.screenshot({ path: join(shotDir, 'laser-fast.png'), clip: { x: 150, y: 340, width: 520, height: 180 } })

// lifetime: still visible after 1.5 s, gone after ~3 s; dot lingers after the pointer leaves
await sleep(1500)
const mid = await page.evaluate(() => { const l = window.__fw.board.tools.laser; return l.trail.length })
check('trail still visible 1.5 s after the last move', mid > 0)
await page.evaluate(() => document.querySelector('.stage').dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })))
await sleep(400)
check('red dot fades gently after the pointer leaves (still there at 0.4 s)', await page.evaluate(() => window.__fw.board.tools.laser.head !== null))
await sleep(3500)
check('trail and dot are fully gone afterwards', await page.evaluate(() => window.__fw.board.tools.laser.trail.length === 0 && window.__fw.board.tools.laser.head === null))
await app.close()
process.exit(summary() ? 1 : 0)
