import { launch, gesture, hover, shotDir, check, summary, fw, appDir } from './lib.mjs'
import { join } from 'node:path'

const executablePath = process.argv.includes('packaged') ? join(appDir, 'dist', 'win-unpacked', 'Floating Whiteboard.exe') : undefined
const { app, page, logs } = await launch({ executablePath })
const pixel = (x, y) => page.evaluate(([x, y]) => {
  const cv = document.querySelectorAll('.cv')[1], ctx = cv.getContext('2d'), dpr = devicePixelRatio
  return [...ctx.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data]
}, [x, y])
const leave = () => page.evaluate(() => document.querySelector('.stage').dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })))
try {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 4000, y: 100, width: 900, height: 600 }))
  await page.waitForTimeout(200)
  await fw(page, w => { w.S.radialEnabled.value = false; w.S.bgAlpha.value = 100; w.board.setTool('laser') })
  await gesture(page, [[150, 150]], { type: 'touch', id: 9 })
  await gesture(page, [[650, 150]], { type: 'touch', id: 9 })
  await page.waitForTimeout(40)
  check('separate touch taps do not draw a connecting line', (await pixel(400, 150))[3] === 0)
  check('touch tap shows a concentrated laser dot', (await pixel(650, 150))[3] > 180)
  await page.waitForTimeout(2500)
  await gesture(page, [[150, 260], [450, 260]], { type: 'touch', id: 10, up: false })
  await gesture(page, [[750, 260]], { type: 'touch', id: 10, down: false })
  await page.waitForTimeout(40)
  check('fast movement reaches the final lifted endpoint', await fw(page, w => w.board.tools.laser.head?.[0] === 750))
  const thickness = await page.evaluate(() => {
    const cv = document.querySelectorAll('.cv')[1], ctx = cv.getContext('2d'), dpr = devicePixelRatio
    const data = ctx.getImageData(Math.round(350 * dpr), Math.round(250 * dpr), 1, Math.round(20 * dpr)).data
    let strong = 0, visible = 0
    for (let i = 3; i < data.length; i += 4) { if (data[i] > 100) strong++; if (data[i] > 8) visible++ }
    return { core: strong / dpr, halo: visible / dpr }
  })
  check('laser line has a thin fixed core and compact halo', thickness.core <= 3 && thickness.core >= 1 && thickness.halo <= 5, JSON.stringify(thickness))
  await page.screenshot({ path: join(shotDir, 'laser-fast.png') })
  await page.waitForTimeout(2500)
  await page.evaluate(async () => {
    const el = document.querySelector('.stage'), r = el.getBoundingClientRect()
    for (let i = 0; i < 70; i++) {
      el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', pointerId: 1, buttons: 0, clientX: r.left + 150 + i * 7, clientY: r.top + 230 }))
      await new Promise(res => setTimeout(res, 12))
    }
  })
  const smoothness = await page.evaluate(() => {
    const cv = document.querySelectorAll('.cv')[1], ctx = cv.getContext('2d'), dpr = devicePixelRatio
    const trail = window.__fw.board.tools.laser.trail, head = trail.at(-1)
    // Probe the recent visible path, since a busy machine may have already expired its oldest end.
    const left = Math.max(head.x - 90, trail[0].x + 20), right = head.x - 10
    const x = Math.round(left * dpr), y = Math.round(228 * dpr), width = Math.max(1, Math.round((right - left) * dpr)), height = Math.round(4 * dpr)
    const data = ctx.getImageData(x, y, width, height).data, alpha = []
    for (let col = 0; col < width; col++) {
      let strongest = 0
      for (let row = 0; row < height; row++) strongest = Math.max(strongest, data[(row * width + col) * 4 + 3])
      alpha.push(strongest)
    }
    return { min: Math.min(...alpha), max: Math.max(...alpha), spike: Math.max(...alpha.slice(1).map((a, i) => Math.abs(a - alpha[i]))) }
  })
  check('average-speed motion has a continuous core without dark beads at sample joins', smoothness.min > 100 && smoothness.max > 200 && smoothness.spike <= 4, JSON.stringify(smoothness))
  await page.screenshot({ path: join(shotDir, 'laser-average.png') })
  await leave(); await page.waitForTimeout(2600)
  await page.evaluate(async () => {
    const el = document.querySelector('.stage'), r = el.getBoundingClientRect()
    for (let i = 0; i < 75; i++) {
      el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', pointerId: 1, buttons: 0, clientX: r.left + 250 + i * 1.8, clientY: r.top + 250 + 55 * Math.sin(i * .065) }))
      await new Promise(res => setTimeout(res, 24))
    }
  })
  check('slow curved motion retains a single smooth contact path to the pointer', await fw(page, w => { const t = w.board.tools.laser.trail; return t.length > 50 && new Set(t.map(p => p.stroke)).size === 1 && w.board.tools.laser.head[0] > 380 }))
  await page.screenshot({ path: join(shotDir, 'laser-slow.png') })
  await leave(); await page.waitForTimeout(2600)
  await page.evaluate(() => {
    const el = document.querySelector('.stage'), r = el.getBoundingClientRect()
    const send = (name, x, y, buttons) => el.dispatchEvent(new PointerEvent(name, { bubbles: true, pointerType: 'mouse', pointerId: 1, button: name === 'pointermove' ? -1 : 0, buttons, clientX: r.left + x, clientY: r.top + y }))
    send('pointerdown', 100, 400, 1)
    for (let i = 1; i <= 1500; i++) send('pointermove', 100 + i * .45, 400 + 40 * Math.sin(i * .025), 1)
    send('pointerup', 775, 400 + 40 * Math.sin(1500 * .025), 0)
  })
  const dense = await fw(page, w => ({ count: w.board.tools.laser.trail.length, start: w.board.tools.laser.trail[0]?.x, end: w.board.tools.laser.trail.at(-1)?.x }))
  check('dense input retains more than 400 samples and the complete recent trail', dense.count > 800 && dense.start === 100 && dense.end === 775, JSON.stringify(dense))
  const stats = await page.evaluate(async () => {
    const cv = document.querySelectorAll('.cv')[1], ctx = cv.getContext('2d'), values = []
    for (let i = 0; i < 30; i++) {
      await new Promise(r => requestAnimationFrame(r))
      const d = ctx.getImageData(Math.round(650 * devicePixelRatio), Math.round(350 * devicePixelRatio), Math.round(100 * devicePixelRatio), Math.round(100 * devicePixelRatio)).data
      values.push(d.some((v, i) => i % 4 === 3 && v > 50))
    }
    const test = document.createElement('canvas'); test.width = cv.width; test.height = cv.height
    const g = test.getContext('2d'), start = performance.now()
    for (let i = 0; i < 10; i++) { g.clearRect(0, 0, test.width, test.height); window.__fw.board.tools.laser.paintOverlay(g) }
    return { stable: values.every(Boolean), paintMeanMs: (performance.now() - start) / 10 }
  })
  console.log('  Dense laser render:', JSON.stringify(stats))
  check('dense trails stay visible across consecutive frames without flicker', stats.stable)
  await page.screenshot({ path: join(shotDir, 'laser-dense.png') })
  await leave(); await page.waitForTimeout(2800)
  check('laser trails and dot completely expire after leaving', await fw(page, w => w.board.tools.laser.trail.length === 0 && w.board.tools.laser.head === null && !w.board.tools.laser.animating))
  await hover(page, 200, 200); await hover(page, 260, 200)
  await leave(); await hover(page, 600, 200); await hover(page, 650, 200)
  await page.waitForTimeout(30)
  check('re-entering the board does not connect to the old hover path', (await pixel(400, 200))[3] === 0)
  await fw(page, w => w.board.setTool('pen')); await page.waitForTimeout(2800)
  check('switching tools does not leave a stuck laser head', await fw(page, w => !w.board.tools.laser.head && !w.board.tools.laser.animating))
  await fw(page, w => { w.S.fingerDraw.value = false; w.board.setTool('laser') })
  const viewBefore = await fw(page, w => JSON.stringify(w.board.view))
  await gesture(page, [[200, 330], [450, 330]], { type: 'touch', id: 12 })
  check('touch laser works even when finger ink drawing is disabled', await fw(page, (w, before) => w.board.tools.laser.head?.[0] === 450 && JSON.stringify(w.board.view) === before, viewBefore))
  check('laser is transient and adds no saved objects or undo entries', await fw(page, w => w.board.doc.items.length === 0 && JSON.parse(w.board.serialize()).items.length === 0 && !w.S.canUndo.value))
  check('no laser renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.join(' | '))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
