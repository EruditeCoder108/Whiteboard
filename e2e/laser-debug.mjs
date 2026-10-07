import { launch, hover } from './lib.mjs'
const { app, page } = await launch()
await page.evaluate(() => window.__fw.board.setTool('laser'))
for (let i = 0; i < 30; i++) { await hover(page, 200 + i * 6, 200); await page.waitForTimeout(14) }
await page.evaluate(() => document.querySelector('.stage').dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })))
for (const ms of [200, 1000, 1500, 2500, 4000]) {
  await page.waitForTimeout(ms === 200 ? 200 : 600)
  console.log(ms, await page.evaluate(() => { const l = window.__fw.board.tools.laser; return JSON.stringify({ trail: l.trail.length, head: l.head, live: l.headLive, anim: l.animating, tool: window.__fw.S.tool.value }) }))
}
await app.close()
