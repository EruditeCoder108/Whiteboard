import { launch, fw, check, summary } from './lib.mjs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { appDir } from './lib.mjs'

const { app, page, userData } = await launch()
const bounds = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds())
const win = (fn) => app.evaluate(({ BrowserWindow }, f) => new Function('w', `return (${f})(w)`)(BrowserWindow.getAllWindows()[0]), fn.toString())
const sleep = (ms) => page.waitForTimeout(ms)

// ── custom resize handles (transparent windows can't resize natively) ─────────────────
const b0 = await bounds()
await page.evaluate(() => {
  const h = document.querySelector('.rz-se')
  const ev = (n, x, y) => h.dispatchEvent(new PointerEvent(n, { bubbles: true, pointerId: 5, clientX: x, clientY: y, screenX: x, screenY: y, buttons: n === 'pointerup' ? 0 : 1 }))
  ev('pointerdown', 1000, 600)
  return new Promise((res) => setTimeout(res, 120))
})
await page.evaluate(async () => {
  const h = document.querySelector('.rz-se')
  const ev = (n, x, y) => h.dispatchEvent(new PointerEvent(n, { bubbles: true, pointerId: 5, clientX: x, clientY: y, screenX: x, screenY: y, buttons: n === 'pointerup' ? 0 : 1 }))
  for (let i = 1; i <= 10; i++) { ev('pointermove', 1000 + i * 12, 600 + i * 8); await new Promise((r) => setTimeout(r, 16)) }
  ev('pointerup', 1120, 680)
})
await sleep(200)
const b1 = await bounds()
check('SE handle grows the window', b1.width === b0.width + 120 && b1.height === b0.height + 80, JSON.stringify([b0, b1]))
check('top-left stays put when resizing from the SE corner', b1.x === b0.x && b1.y === b0.y)

// resize from the NW corner: size shrinks, position follows
await page.evaluate(async () => {
  const h = document.querySelector('.rz-nw')
  const ev = (n, x, y) => h.dispatchEvent(new PointerEvent(n, { bubbles: true, pointerId: 6, clientX: x, clientY: y, screenX: x, screenY: y, buttons: n === 'pointerup' ? 0 : 1 }))
  ev('pointerdown', 100, 100)
  await new Promise((r) => setTimeout(r, 120))
  for (let i = 1; i <= 8; i++) { ev('pointermove', 100 + i * 10, 100 + i * 10); await new Promise((r) => setTimeout(r, 16)) }
  ev('pointerup', 180, 180)
})
await sleep(200)
const b2 = await bounds()
check('NW handle moves the origin and shrinks the window', b2.x === b1.x + 80 && b2.y === b1.y + 80 && b2.width === b1.width - 80, JSON.stringify([b1, b2]))

// minimum size clamp
await page.evaluate(async () => {
  const h = document.querySelector('.rz-se')
  const ev = (n, x, y) => h.dispatchEvent(new PointerEvent(n, { bubbles: true, pointerId: 7, clientX: x, clientY: y, screenX: x, screenY: y, buttons: n === 'pointerup' ? 0 : 1 }))
  ev('pointerdown', 500, 500); await new Promise((r) => setTimeout(r, 120))
  ev('pointermove', -3000, -3000); await new Promise((r) => setTimeout(r, 80)); ev('pointerup', -3000, -3000)
})
await sleep(200)
const b3 = await bounds()
check('window cannot shrink below 420×320', b3.width === 420 && b3.height === 320, JSON.stringify(b3))

// ── always on top / fullscreen ───────────────────────────────────────────────────────────
check('starts always-on-top', await win((w) => w.isAlwaysOnTop()))
await page.getByRole('button', { name: /Always on top/ }).click()
await sleep(200)
check('pin button turns always-on-top off', !(await win((w) => w.isAlwaysOnTop())))
await page.keyboard.press('Control+t'); await sleep(200)
check('Ctrl+T turns it back on', await win((w) => w.isAlwaysOnTop()))

const before = await bounds()
await page.keyboard.press('F11'); await sleep(300)
const fsB = await bounds()
const disp = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().bounds)
check('F11 fills the display', fsB.width === disp.width && fsB.height === disp.height, JSON.stringify([fsB, disp]))
check('fullscreen state reaches the UI (flat corners)', await page.evaluate(() => document.querySelector('.window').classList.contains('flat')))
await page.keyboard.press('Escape'); await sleep(300)
const back = await bounds()
check('Esc leaves fullscreen and restores the size', back.width === before.width && back.height === before.height, JSON.stringify([before, back]))

// ── global hotkeys ─────────────────────────────────────────────────────────────────────
const reg = await app.evaluate(({ globalShortcut }) => ({
  pass: globalShortcut.isRegistered('CommandOrControl+Shift+Space'),
  hide: globalShortcut.isRegistered('CommandOrControl+Shift+H')
}))
check('global hotkeys registered (pass-through, hide window)', reg.pass && reg.hide, JSON.stringify(reg))

// pass-through toggles cleanly from the UI; a pill window exists only while it is on
await page.getByRole('button', { name: /Pass-through: click/ }).click(); await sleep(500)
check('pass-through button turns the mode on', await fw(page, (w) => w.S.passthrough.value))
check('pill window opened', (await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)) === 2)
check('board hides its chrome while click-through', (await page.locator('.dock').count()) === 0)
await page.evaluate(() => window.api.win.setPassthrough(false)); await sleep(500)
check('turning it off closes the pill and restores the UI', (await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)) === 1 && (await page.locator('.dock').count()) === 1)

// ── single instance ──────────────────────────────────────────────────────────────────────
const exe = createRequire(import.meta.url)(join(appDir, 'node_modules', 'electron'))
const second = spawn(exe, [appDir, `--user-data-dir=${userData}`], { stdio: 'ignore' })
const exited = await new Promise((res) => {
  const t = setTimeout(() => res(false), 8000)
  second.on('exit', () => { clearTimeout(t); res(true) })
})
if (!exited) second.kill()
check('a second launch exits immediately (single instance)', exited)

// ── performance with a big board ─────────────────────────────────────────────────────────
const perf = await page.evaluate(async () => {
  const { board } = window.__fw
  const items = []
  for (let s = 0; s < 4000; s++) {
    const p = []
    const x0 = (s % 80) * 60, y0 = Math.floor(s / 80) * 40
    for (let i = 0; i < 60; i++) p.push(x0 + i * 0.9, y0 + 12 * Math.sin(i * 0.3), 0.5)
    items.push({ t: 's', id: 'perf' + s, c: '#111827', w: 2.5, m: false, v: false, p })
  }
  board.doc.replaceAll(items)
  board.setView({ x: 0, y: 0, zoom: 0.35 })
  const raf = () => new Promise((r) => requestAnimationFrame(r))
  await raf(); await raf()
  // pan for 90 frames and record frame intervals
  const times = []
  let last = performance.now()
  for (let i = 0; i < 90; i++) {
    board.panBy(6, 3)
    await raf()
    const now = performance.now(); times.push(now - last); last = now
  }
  times.sort((a, b) => a - b)
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  // cost of one full board redraw
  const t0 = performance.now()
  for (let i = 0; i < 10; i++) board.panBy(1, 1), board.refresh(null), board.renderBoardNow?.()
  return { avg, p95: times[Math.floor(times.length * 0.95)], n: items.length }
})
console.log(`  4000 strokes / 240k points: pan frame avg ${perf.avg.toFixed(1)} ms, p95 ${perf.p95.toFixed(1)} ms`)
check('panning 4000 strokes stays under ~30 ms/frame (p95)', perf.p95 < 34, `p95 ${perf.p95.toFixed(1)}`)

// cost of building + painting one long live stroke (latency proxy)
const live = await page.evaluate(async () => {
  const { board } = window.__fw
  board.doc.replaceAll([])
  board.refresh(null)
  board.setView({ x: 0, y: 0, zoom: 1 })
  const stage = document.querySelector('.stage'); const r = stage.getBoundingClientRect()
  const mk = (n, x, y, b) => new PointerEvent(n, { bubbles: true, pointerId: 3, pointerType: 'pen', isPrimary: true, clientX: r.left + x, clientY: r.top + y, pressure: 0.5, buttons: b, button: n === 'pointermove' ? -1 : 0 })
  stage.dispatchEvent(mk('pointerdown', 100, 300, 1))
  const raf = () => new Promise((res) => requestAnimationFrame(res))
  const frames = []
  for (let i = 1; i <= 2500; i++) {
    stage.dispatchEvent(mk('pointermove', 100 + i * 0.45, 300 + 90 * Math.sin(i * 0.02) + 10 * Math.sin(i * 0.31), 1))
    if (i % 4 === 0) { const t = performance.now(); await raf(); frames.push(performance.now() - t) }
  }
  stage.dispatchEvent(mk('pointerup', 1200, 300, 0))
  frames.sort((a, b) => a - b)
  return { p95: frames[Math.floor(frames.length * 0.95)], max: frames[frames.length - 1], pts: board.doc.items[0]?.p.length / 3 }
})
console.log(`  one ${live.pts}-point pen stroke: live frame p95 ${live.p95.toFixed(1)} ms, max ${live.max.toFixed(1)} ms`)
check('a 2500-point live stroke keeps frames under ~20 ms (p95)', live.p95 < 20, `p95 ${live.p95.toFixed(1)}`)

await app.close()
process.exit(summary() ? 1 : 0)
