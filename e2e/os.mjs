// REAL OS-level input: mouse, touch (multi-contact) and pen (pressure) are injected through the
// Windows pointer APIs and travel the whole path  OS → Chromium → our input router.
// A backdrop window plays "the app underneath" so we can verify see-through and click-through.
import { _electron as electron } from 'playwright'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appDir, check, summary, shotDir, fw } from './lib.mjs'

const electronExe = createRequire(import.meta.url)(join(appDir, 'node_modules', 'electron'))
const injectScript = join(appDir, 'e2e', 'os', 'inject.ps1')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── injector server ─────────────────────────────────────────────────────────────────────
const inj = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', injectScript], { stdio: ['pipe', 'pipe', 'inherit'] })
let injBuf = ''
const waiters = []
inj.stdout.on('data', (d) => {
  injBuf += d
  let i
  while ((i = injBuf.indexOf('\n')) >= 0) {
    const line = injBuf.slice(0, i).trim(); injBuf = injBuf.slice(i + 1)
    waiters.shift()?.(line)
  }
})
await new Promise((res) => waiters.push(res))   // READY
const run = (script) => new Promise((res) => { waiters.push(res); inj.stdin.write(script + '\n') })

// ── backdrop (the "app underneath") ──────────────────────────────────────────────────────────
const backdrop = spawn(electronExe, [join(appDir, 'e2e', 'os', 'backdrop.cjs')], { stdio: ['ignore', 'pipe', 'inherit'] })
const clicks = []
await new Promise((res) => {
  backdrop.stdout.on('data', (d) => {
    for (const l of String(d).split('\n')) {
      if (l.startsWith('READY')) res()
      if (l.startsWith('CLICK')) clicks.push(l.trim())
    }
  })
})
await sleep(600)

const cleanup = () => {
  try { inj.kill() } catch {}
  try { backdrop.kill() } catch {}
}
process.on('exit', cleanup)
process.on('uncaughtException', (e) => { console.error(e); cleanup(); process.exit(2) })
process.on('unhandledRejection', (e) => { console.error(e); cleanup(); process.exit(2) })

// ── whiteboard on top of it ─────────────────────────────────────────────────────────────────
const dir = mkdtempSync(join(tmpdir(), 'fw-os-'))
const app = await electron.launch({ args: [appDir, `--user-data-dir=${dir}`], cwd: appDir })
const page = await app.firstWindow()
await page.waitForSelector('.stage')
process.on('exit', () => { try { app.process().kill() } catch {} })
const scale = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().scaleFactor)
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 160, y: 90, width: 900, height: 520 }))
await sleep(500)
const win = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds())
console.log(`  scale ${scale}, window`, win)
const phys = (x, y) => [Math.round((win.x + x) * scale), Math.round((win.y + y) * scale)]
const items = () => page.evaluate(() => window.__fw.itemCount())
const S = (k) => fw(page, (w, k) => k.split('.').reduce((o, p) => o[p], w.S).value, k)
const grab = async () => {
  const b64 = await app.evaluate(async ({ desktopCapturer, screen }) => {
    const d = screen.getPrimaryDisplay()
    const s = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: Math.round(d.size.width * d.scaleFactor), height: Math.round(d.size.height * d.scaleFactor) } })
    return s[0].thumbnail.toPNG().toString('base64')
  })
  return b64
}
const pixel = (b64, x, y) => page.evaluate(async ({ b64, x, y }) => {
  const img = new Image()
  img.src = 'data:image/png;base64,' + b64
  await img.decode()
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0)
  return Array.from(g.getImageData(x, y, 1, 1).data)
}, { b64, x, y })

// ── A. see-through: opacity 0 shows the app underneath ────────────────────────────────────────
await fw(page, (w) => { w.S.bgAlpha.value = 100 })
await sleep(300)
const solid = await pixel(await grab(), ...phys(400, 300))
await fw(page, (w) => { w.S.bgAlpha.value = 0 })
await sleep(300)
const clear = await pixel(await grab(), ...phys(400, 300))
console.log('  board 100% ->', solid.slice(0, 3).join(','), '   board 0% ->', clear.slice(0, 3).join(','))
check('opacity 100%: the board is solid white', solid[0] > 245 && solid[1] > 245 && solid[2] > 245)
const isOrange = (p) => p[0] > 200 && p[1] > 90 && p[1] < 150 && p[2] < 60
const isTeal = (p) => p[0] < 60 && p[1] > 150 && p[2] > 140
check('opacity 0%: the screen shows through (backdrop colours visible)', isOrange(clear) || isTeal(clear), clear.join(','))
await page.screenshot({ path: join(shotDir, 'os-opacity0.png') })

// ── B. writing over the see-through board with a real mouse ──────────────────────────────────────
const n0 = await items()
await run(`m ${phys(300, 250).join(' ')}; md; ${Array.from({ length: 30 }, (_, i) => `m ${phys(300 + i * 8, 250 + 25 * Math.sin(i * 0.3)).join(' ')}; w 8`).join('; ')}; mu`)
await sleep(300)
check('real mouse drag writes on the transparent board', (await items()) === n0 + 1)
const shotB = await grab()
let darkest = 255
for (let dx = -6; dx <= 6; dx += 2) for (let dy = -6; dy <= 6; dy += 2) {
  const q = await pixel(shotB, ...phys(300 + 15 * 8 + dx / scale, 250 + 25 * Math.sin(15 * 0.3) + dy / scale))
  darkest = Math.min(darkest, q[0])
}
check('ink is drawn on top of the see-through board (dark pixels over the backdrop)', darkest < 90, 'darkest ' + darkest)

// ── C. pass-through: clicks reach the app underneath; the pill brings you back ───────────────────────
const btn = await page.getByRole('button', { name: /Pass-through: click/ }).boundingBox()
const bx = btn.x + btn.width / 2, by = btn.y + btn.height / 2
await run(`m ${phys(bx, by).join(' ')}; w 150; md; w 40; mu; w 500`)
check('real click on the pass-through button turns it on', await S('passthrough'))
const winCount = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)
check('a small "Back to drawing" pill window appears', winCount === 2, 'windows: ' + winCount)
clicks.length = 0
const before = await items()
await run(`m ${phys(500, 400).join(' ')}; w 200; md; w 40; mu; w 300`)
check('click on the board goes through to the app underneath', clicks.length === 1, JSON.stringify(clicks))
check('…and does not draw on the whiteboard', (await items()) === before)
// the pill sits top-right of the board
const pillX = win.x + win.width - 10 - 75, pillY = win.y + 8 + 18
await run(`m ${Math.round(pillX * scale)} ${Math.round(pillY * scale)}; w 200; md; w 40; mu; w 500`)
check('clicking the pill (real mouse) goes back to drawing', !(await S('passthrough')))
check('the pill is gone again', (await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)) === 1)
clicks.length = 0
await run(`m ${phys(500, 400).join(' ')}; w 150; md; w 40; mu; w 300`)
check('with pass-through off, clicks stay on the whiteboard', clicks.length === 0)
await fw(page, (w) => { w.board.undo() })

// the same exit with a FINGER (touch never produces hover, so this is the case that matters)
await run(`m 5 5`)
await page.evaluate(() => window.api.win.setPassthrough(true))
await sleep(600)
check('pass-through on (via API)', await S('passthrough'))
await run(`t 5 ${Math.round(pillX * scale)} ${Math.round(pillY * scale)} d; w 80; t 5 ${Math.round(pillX * scale)} ${Math.round(pillY * scale)} u; w 600`)
check('tapping the pill with a real finger goes back to drawing', !(await S('passthrough')))

// ── D. global hotkey (works while another app has focus) ─────────────────────────────────────────────────
await run('k ctrl+shift+space; w 500')
check('global hotkey Ctrl+Shift+Space turns pass-through on', await S('passthrough'))
await run('k ctrl+shift+space; w 500')
check('…and off again', !(await S('passthrough')))

// ── E. real TOUCH ──────────────────────────────────────────────────────────────────────────────────────────
await fw(page, (w) => { w.S.bgAlpha.value = 96 })
await sleep(1000)
const t0 = await items()
const [tx, ty] = phys(300, 330)
await run(`t 1 ${tx} ${ty} d; ${Array.from({ length: 25 }, (_, i) => `t 1 ${tx + i * 12} ${ty + Math.round(20 * Math.sin(i * 0.4))} m; w 8`).join('; ')}; t 1 ${tx + 300} ${ty} u`)
await sleep(300)
check('real finger drawing works', (await items()) === t0 + 1)
const stroke = await fw(page, (w) => { const i = w.board.doc.items.at(-1); return { v: i.v, w: i.w } })
check('finger stroke is constant width', stroke.v === false)

// long press with a finger → radial menu
const [lx, ly] = phys(600, 330)
await run(`t 1 ${lx} ${ly} d; w 750`)
check('REAL finger press-and-hold opens the radial menu', (await page.locator('.radial').count()) === 1)
await page.screenshot({ path: join(shotDir, 'os-touch-radial.png') })
const rc = await page.locator('.radial').boundingBox()
const ccx = rc.x + rc.width / 2, ccy = rc.y + rc.height / 2
const a = Math.PI / 4
const [sx, sy] = phys(ccx + 59 * Math.sin(a), ccy - 59 * Math.cos(a))   // highlighter slice
await run(`t 1 ${Math.round((lx + sx) / 2)} ${Math.round((ly + sy) / 2)} m; w 30; t 1 ${sx} ${sy} m; w 80; t 1 ${sx} ${sy} u; w 150`)
check('releasing over a slice picks it (highlighter)', (await S('tool')) === 'marker')
check('radial closes and no stray ink', (await page.locator('.radial').count()) === 0 && (await items()) === t0 + 1)
await fw(page, (w) => w.board.setTool('pen'))

// two-finger pinch
const z0 = await S('zoom')
const [p1x, p1y] = phys(500, 300), [p2x, p2y] = phys(600, 300)
await run(`t 1 ${p1x} ${p1y} d; t 2 ${p2x} ${p2y} d; w 30; ${Array.from({ length: 12 }, (_, i) => `t 1 ${p1x - i * 14} ${p1y} m; t 2 ${p2x + i * 14} ${p2y} m; w 12`).join('; ')}; t 1 ${p1x - 150} ${p1y} u; t 2 ${p2x + 150} ${p2y} u`)
await sleep(300)
check('two real fingers pinch-zoom', (await S('zoom')) > z0 * 1.4, `zoom ${z0} → ${await S('zoom')}`)
check('…without leaving ink behind', (await items()) === t0 + 1)
await fw(page, (w) => w.board.resetZoom())
await sleep(500)

// ── F. real PEN with pressure ──────────────────────────────────────────────────────────────────────────────
await sleep(900)
const q0 = await items()
const [px, py] = phys(250, 420)
await run(`p ${px} ${py} 200 d; ${Array.from({ length: 30 }, (_, i) => `p ${px + i * 10} ${py + Math.round(18 * Math.sin(i * 0.35))} ${200 + i * 25} m; w 8`).join('; ')}; p ${px + 300} ${py} 0 u`)
await sleep(300)
check('real pen stroke is committed', (await items()) === q0 + 1)
const pen = await fw(page, (w) => w.board.doc.items.at(-1))
const pr = pen.p.filter((_, i) => i % 3 === 2)
check('pen reports pressure and stroke width follows it', pen.v === true && Math.max(...pr) - Math.min(...pr) > 0.3, `pressure range ${Math.min(...pr).toFixed(2)}–${Math.max(...pr).toFixed(2)}`)
await page.screenshot({ path: join(shotDir, 'os-pen.png') })

// touch right after the pen must be rejected (palm)
const q1 = await items()
const [hx, hy] = phys(700, 450)
await run(`t 3 ${hx} ${hy} d; w 40; t 3 ${hx + 40} ${hy} m; w 40; t 3 ${hx + 40} ${hy} u`)
await sleep(200)
check('a finger right after the pen is ignored (palm rejection)', (await items()) === q1)

// ── G. laser through the real Windows touch path and desktop capture ─────────────────────────────────────────
await sleep(900) // let the preceding pen's palm-rejection interval finish
await fw(page, w => { w.S.bgAlpha.value = 100; w.S.fingerDraw.value = false; w.board.setTool('laser') })
const laserItems = await items()
const [laX, laY] = phys(200, 140), [lbX, lbY] = phys(700, 140)
await run(`t 1 ${laX} ${laY} d; w 30; t 1 ${laX} ${laY} u; w 40; t 1 ${lbX} ${lbY} d; w 30; t 1 ${lbX} ${lbY} u; w 40`)
const laserAlpha = (x, y) => page.evaluate(([x, y]) => {
  const c = document.querySelectorAll('.cv')[1], d = devicePixelRatio
  return c.getContext('2d').getImageData(Math.round(x * d), Math.round(y * d), 1, 1).data[3]
}, [x, y])
check('real touch taps do not connect the laser across the board', await laserAlpha(450, 140) === 0)
check('real touch laser jumps to the second contact with finger drawing disabled', await fw(page, w => Math.abs(w.board.tools.laser.head?.[0] - 700) < 2))
const [lcX, lcY] = phys(200, 190), [ldX, ldY] = phys(740, 190)
await run(`t 1 ${lcX} ${lcY} d; w 20; t 1 ${ldX} ${ldY} m; w 20; t 1 ${ldX} ${ldY} u; w 40`)
check('fast real touch laser reaches the lift endpoint', await fw(page, w => Math.abs(w.board.tools.laser.head?.[0] - 740) < 2))
const laserCapture = await grab()
const laserPixel = await pixel(laserCapture, ...phys(450, 190))
check('screen capture includes the thin red laser line', laserPixel[0] > 170 && laserPixel[1] < 150 && laserPixel[2] < 150, JSON.stringify(laserPixel))
check('real laser gestures add no permanent objects', await items() === laserItems)
await page.screenshot({ path: join(shotDir, 'os-laser.png') })
await fw(page, w => w.board.setTool('pen')); await sleep(2800)
check('laser expires after returning to the pen with no stuck dot', await fw(page, w => !w.board.tools.laser.head && !w.board.tools.laser.animating))

// ── wrap up ──────────────────────────────────────────────────────────────────────────────────────────────────
await page.screenshot({ path: join(shotDir, 'os-final.png') })
await app.close()
inj.kill(); backdrop.kill()
process.exit(summary() ? 1 : 0)
