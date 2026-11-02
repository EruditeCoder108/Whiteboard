// Production S0 verification. Disposable profile; hidden, input-isolated window.
import { launch, appDir, check, summary, gesture } from './lib.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const target = join(appDir, 'docs', 'science-qa')
mkdirSync(target, { recursive: true })
const { app, page, logs } = await launch()
try {
  await app.evaluate(({ BrowserWindow }) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.setIgnoreMouseEvents(true); win.setAlwaysOnTop(false); win.hide()
    }
  })
  const evidence = await page.evaluate(async () => {
    const { board, S } = window.__fw
    if (board.anim) { cancelAnimationFrame(board.anim.raf); board.anim = null }
    S.radialEnabled.value = false
    const frame = () => new Promise(r => setTimeout(() => {
      cancelAnimationFrame(board.raf); board.frame(); r()
    }, 16))
    const settle = async () => { await new Promise(r => setTimeout(r, 150)); await frame(); await frame() }
    const pixels = () => {
      const copy = document.createElement('canvas'); copy.width = board.gridCv.width; copy.height = board.gridCv.height
      const ctx = copy.getContext('2d', { willReadFrequently: true }); ctx.drawImage(board.gridCv, 0, 0)
      return ctx.getImageData(0, 0, copy.width, copy.height).data
    }
    const alphaDiff = (a, b) => {
      let delta = 0, total = 0
      for (let i = 3; i < a.length; i += 4) { delta += Math.abs(a[i] - b[i]); total += a[i] }
      return delta / Math.max(1, total)
    }
    const maxAlphaDiff = (a, b) => {
      let delta = 0
      for (let i = 3; i < a.length; i += 4) delta = Math.max(delta, Math.abs(a[i] - b[i]))
      return delta
    }
    const area = (canvas, sx, sy, rx = 6, ry = 6) => {
      const d = board.dpr, cv = document.createElement('canvas')
      cv.width = Math.ceil(rx * 2 * d); cv.height = Math.ceil(ry * 2 * d)
      const ctx = cv.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(canvas, Math.round((sx - rx) * d), Math.round((sy - ry) * d), cv.width, cv.height, 0, 0, cv.width, cv.height)
      const data = ctx.getImageData(0, 0, cv.width, cv.height).data
      let sum = 0; for (let i = 3; i < data.length; i += 4) sum += data[i] / 255 / d ** 2
      return sum
    }
    board.doc.replaceAll([]); board.setPaper('dots')
    board.setView({ x: 0, y: 0, zoom: 1 }); board.refresh(null); await settle()
    const sx = 320, sy = 240, before = board.toWorld(sx, sy)
    const base = area(board.gridCv, sx, sy), cacheAlpha = area(board.cache, (sx - board.cv0.x), (sy - board.cv0.y))
    board.rebuildMs = 99; board.zoomAt(1.5, sx, sy); board.renderCommitted()
    const preview = area(board.gridCv, sx, sy), after = board.toWorld(sx, sy)
    const previewCacheZoom = board.cv0.zoom
    await settle(); const settled = area(board.gridCv, sx, sy)
    const transitions = []
    for (const dark of [false, true]) for (const mode of ['dots', 'lines']) {
      board.setColor(dark ? '#1f232b' : '#ffffff'); board.setPaper(mode)
      // Dot and square-grid boundaries plus the two old abrupt thresholds.
      for (const z of [.1, .225, .4, .45, .9, 1.6, 1.8, 3.6, 6.4, 7.2, 14.4, .4499, 4]) {
        board.setView({ x: -80, y: -80, zoom: z * (1 - 1e-6) }); board.renderCommitted(); const a = pixels()
        board.setView({ x: -80, y: -80, zoom: z * (1 + 1e-6) }); board.renderCommitted()
        const b = pixels()
        transitions.push({ dark, mode, zoom: z, relativeAlphaChange: alphaDiff(a, b), maxAlphaChange: maxAlphaDiff(a, b) })
      }
    }
    const thickness = []
    board.setColor('#ffffff'); board.setPaper('lines')
    for (const z of [.05, 1, 1.5, 16]) {
      // Isolate a full-strength world-origin line, away from horizontal lines.
      board.setView({ x: -100 / z, y: -103 / z, zoom: z }); board.renderCommitted()
      thickness.push({ zoom: z, area: area(board.gridCv, 100.5, 108, 5, 2) })
    }
    return { viewport: { ...board.size, dpr: board.dpr }, userAgent: navigator.userAgent, base, preview, settled, cacheAlpha, previewCacheZoom,
      anchorError: Math.max(...before.map((v, i) => Math.abs(v - after[i]))), transitions, thickness }
  })
  // Pixel QA intentionally synchronizes the GPU. Reload before timing to discard
  // the temporary readback canvases and avoid measuring their memory/GC cost.
  await page.reload(); await page.waitForFunction(() => window.__fw?.S.ready.value, null, { polling: 100 })
  await page.evaluate(() => window.__fw.board.newLesson('canvas'))
  const performanceEvidence = await page.evaluate(async () => {
    const { board, S } = window.__fw
    S.radialEnabled.value = false
    // Hidden-window compositor policy can suspend rAF after reload. Exercise
    // the real Board frame explicitly on a timer. These intervals describe
    // scripted scheduler/CPU work, not visible compositor frame rate.
    const frame = () => new Promise(r => setTimeout(() => {
      cancelAnimationFrame(board.raf); board.frame(); r()
    }, 16))
    const settle = async () => { await new Promise(r => setTimeout(r, 150)); await frame(); await frame() }
    const stats = a => { const s = [...a].sort((x, y) => x - y); return { meanMs: a.reduce((x, y) => x + y, 0) / a.length, p95Ms: s[Math.floor(s.length * .95)], maxMs: s.at(-1) } }
    const benchmarks = []
    for (const count of [0, 500, 4000]) {
      const items = Array.from({ length: count }, (_, n) => {
        const p = [], x = n % 80 * 60, y = Math.floor(n / 80) * 40
        for (let i = 0; i < 60; i++) p.push(x + i * .9, y + 12 * Math.sin(i * .3), .5)
        return { t: 's', id: `s0-${n}`, c: '#111827', w: 2.5, m: false, v: false, p }
      })
      board.doc.replaceAll(items)
      for (const grid of ['dots', 'lines']) for (const mode of ['pan', 'zoom']) {
        board.setPaper(grid); board.setView({ x: 0, y: 0, zoom: count === 4000 ? .35 : 1 }); board.refresh(null); await settle()
        const cpu = [], intervals = [], rebuilds = [], drift = []
        const render = board.renderCommitted.bind(board), rebuild = board.rebuildCache.bind(board)
        board.renderCommitted = () => { const t = performance.now(); render(); cpu.push(performance.now() - t) }
        board.rebuildCache = () => { rebuild(); rebuilds.push(board.rebuildMs) }
        let last = performance.now()
        for (let i = 0; i < 90; i++) {
          if (mode === 'pan') board.panBy(12, 6)
          else board.zoomAt(Math.exp(.013 * Math.cos(i / 18)), board.w / 2, board.h / 2)
          const expected = { ...board.view }; await frame(); const now = performance.now(); intervals.push(now - last); last = now
          if (Object.keys(expected).some(k => expected[k] !== board.view[k])) drift.push(i)
        }
        board.renderCommitted = render; board.rebuildCache = rebuild
        benchmarks.push({ count, samples: count * 60, grid, mode, frameIntervals: stats(intervals), renderCPU: stats(cpu), rebuilds, drift })
      }
    }
    const captures = []
    board.doc.replaceAll([])
    for (const dark of [false, true]) for (const mode of ['dots', 'lines']) {
      board.setColor(dark ? '#1f232b' : '#ffffff'); board.setPaper(mode)
      board.setView({ x: -150, y: -50, zoom: 1.3 }); board.refresh(null); board.renderCommitted()
      const cv = document.createElement('canvas'); cv.width = board.gridCv.width; cv.height = board.gridCv.height
      const ctx = cv.getContext('2d'); ctx.fillStyle = S.bgColor.value; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(board.gridCv, 0, 0)
      captures.push({ name: `s0-${mode}-${dark ? 'dark' : 'light'}`, png: cv.toDataURL().split(',')[1] })
    }
    board.setPaper('none'); board.renderCommitted()
    const empty = board.gctx.getImageData(0, 0, board.gridCv.width, board.gridCv.height).data.every(v => v === 0)
    board.setView({ x: 1e6, y: -1e6, zoom: 1 }); await settle()
    return { benchmarks, captures, empty, distant: { ...board.view } }
  })
  Object.assign(evidence, performanceEvidence)
  check('background omitted from content cache', evidence.cacheAlpha === 0)
  check('expensive zoom uses ink preview', evidence.previewCacheZoom === 1)
  check('dot area stable during preview and settled redraw', evidence.base > 0 && Math.abs(evidence.preview / evidence.base - 1) < .05 && Math.abs(evidence.settled / evidence.base - 1) < .05)
  check('zoom world anchor preserved', evidence.anchorError < 1e-8)
  // One 8-bit step can exceed 2% of the new low-contrast line's alpha. Preserve
  // the aggregate gate and also accept changes limited to one code step.
  check('density boundaries continuous in both themes and modes', evidence.transitions.every(t => t.relativeAlphaChange < .02 || t.maxAlphaChange <= 1))
  check('line width stable over zoom range', evidence.thickness.every(t => Math.abs(t.area / evidence.thickness[0].area - 1) < .05))
  check('no camera contamination during benchmarks', evidence.benchmarks.every(t => !t.drift.length))
  check('none clears background', evidence.empty)
  check('distant negative world supported', evidence.distant.x === 1e6 && evidence.distant.y === -1e6)
  const wheel = await page.evaluate(() => {
    const { board } = window.__fw, el = document.querySelector('.stage'), r = el.getBoundingClientRect()
    board.setView({ x: 100, y: -200, zoom: 1 })
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: r.left + 380, clientY: r.top + 240, ctrlKey: true, deltaY: -100 })
    const world = () => board.toWorld(event.clientX - r.left, event.clientY - r.top), before = world()
    el.dispatchEvent(event); const after = world(), zoomed = { ...board.view }
    el.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 21, deltaY: 35 }))
    return { error: Math.max(...before.map((v, i) => Math.abs(v - after[i]))), zoomed, panned: { ...board.view } }
  })
  check('Ctrl+wheel preserves pointer anchor', wheel.error < 1e-8 && wheel.zoomed.zoom > 1)
  check('wheel pan remains zoom aware', Math.abs(wheel.panned.y - wheel.zoomed.y - 35 / wheel.zoomed.zoom) < 1e-8)
  evidence.wheel = wheel
  await page.evaluate(() => { const { board } = window.__fw; board.setView({ x: 0, y: 0, zoom: 1 }) })
  await gesture(page, [[300, 240]], { type: 'touch', id: 1, up: false })
  await gesture(page, [[500, 240]], { type: 'touch', id: 2, up: false })
  await gesture(page, [[500, 240], [600, 240]], { type: 'touch', id: 2, down: false, up: false, gap: 0 })
  check('pinch changes zoom without ink', await page.evaluate(() => window.__fw.board.view.zoom > 1 && window.__fw.board.doc.items.length === 0))
  await gesture(page, [[600, 240]], { type: 'touch', id: 2, down: false })
  await gesture(page, [[300, 240]], { type: 'touch', id: 1, down: false })
  for (const capture of evidence.captures) writeFileSync(join(target, `${capture.name}.png`), Buffer.from(capture.png, 'base64'))
  delete evidence.captures
  evidence.recordedAt = new Date().toISOString(); evidence.scheduler = '16ms timer with explicit Board.frame; no visible-compositor FPS claim'
  evidence.pageErrors = logs.filter(l => l.startsWith('[pageerror]'))
  check('no renderer exceptions', !evidence.pageErrors.length)
  writeFileSync(join(target, 's0-results.json'), JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify(evidence.benchmarks.map(r => ({ count: r.count, grid: r.grid, mode: r.mode, p95: r.frameIntervals.p95Ms, max: r.frameIntervals.maxMs, cpuP95: r.renderCPU.p95Ms }))))
  if (summary()) process.exitCode = 1
} finally { await app.close() }
