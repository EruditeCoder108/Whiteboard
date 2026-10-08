// Source-app audit only. The proposed background split is patched in memory in
// a throw-away Electron profile; no shipped renderer or user board is changed.
import { launch, appDir, check, summary, gesture } from './lib.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const target = join(appDir, 'docs', 'canvas-audit')
mkdirSync(target, { recursive: true })
async function captureDots(page) {
  const metadata = []
  for (const [name, preview] of [['our-dots-preview', true], ['our-dots-settled', false]]) {
    const captured = await page.evaluate(preview => {
      const { board, S } = window.__fw
      if (board.anim) { cancelAnimationFrame(board.anim.raf); board.anim = null }
      window.clearTimeout(board.zoomTimer)
      S.grid.value = 'dots'; board.doc.replaceAll([])
      board.setView({ x: 0, y: 0, zoom: 1 }); board.refresh(null); board.renderCommitted()
      board.rebuildMs = 99; board.zoomAt(2.5, board.w / 2, board.h / 2)
      if (!preview) board.refresh(null)
      board.renderCommitted(); window.clearTimeout(board.zoomTimer)
      // Capture atomically with the render, without an intervening rAF.
      const source = board.boardCv, capture = document.createElement('canvas')
      capture.width = source.width; capture.height = source.height
      const ctx = capture.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, capture.width, capture.height)
      ctx.drawImage(source, 0, 0)
      return { png: capture.toDataURL('image/png').split(',')[1], view: { ...board.view }, cache: { ...board.cv0 } }
    }, preview)
    if (captured.view.zoom !== 2.5 || captured.cache.zoom !== (preview ? 1 : 2.5)) throw new Error('Unexpected camera state in dot capture')
    writeFileSync(join(target, `${name}.png`), Buffer.from(captured.png, 'base64'))
    metadata.push({ name, view: captured.view, cache: captured.cache })
  }
  writeFileSync(join(target, 'visual-captures.json'), JSON.stringify(metadata, null, 2) + '\n')
  return metadata
}
const { app, page, logs } = await launch()
try {
  // Keep benchmark input isolated from the user's browser and open whiteboard.
  // The app already disables backgroundThrottling, so rAF continues while hidden.
  await app.evaluate(({ BrowserWindow }) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.setIgnoreMouseEvents(true); window.setAlwaysOnTop(false); window.hide()
    }
  })
  if (process.argv[2] === 'visual') {
    console.log(JSON.stringify(await captureDots(page), null, 2))
  } else {
  const evidence = await page.evaluate(async () => {
    const { board, S } = window.__fw
    S.radialEnabled.value = false
    S.grid.value = 'dots'
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
    const settle = async () => { await new Promise(r => setTimeout(r, 160)); await frame(); await frame() }
    const world = (x, y) => [board.view.x + x / board.view.zoom, board.view.y + y / board.view.zoom]
    const measureDot = (sx, sy) => {
      const d = board.dpr, r = 9
      // Read a tiny copy, so auditing alpha does not move the main canvas onto
      // Chromium's frequent-readback CPU path and distort the benchmark.
      const sample = document.createElement('canvas'); sample.width = sample.height = 2 * r
      const ctx = sample.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(board.boardCv, Math.round(sx * d) - r, Math.round(sy * d) - r, 2 * r, 2 * r, 0, 0, 2 * r, 2 * r)
      const data = ctx.getImageData(0, 0, 2 * r, 2 * r).data
      let alphaArea = 0, count = 0
      for (let i = 3; i < data.length; i += 4) { alphaArea += data[i] / 255 / (d * d); if (data[i] > 0) count++ }
      return { alphaArea, nonzeroPixels: count }
    }
    const stepAt = z => { let step = 40; while (step * z < 18) step *= 2; while (step * z > 160) step /= 2; return { zoom: z, worldStep: step, screenStep: step * z } }
    board.doc.replaceAll([])
    board.setView({ x: 0, y: 0, zoom: 1 }); board.refresh(null); await settle()
    const sx = Math.floor(board.w / 2 / 40) * 40, sy = Math.floor(board.h / 2 / 40) * 40
    const before = world(sx, sy), baseDot = measureDot(sx, sy)
    board.rebuildMs = 99 // exercise the documented expensive-board preview branch
    board.zoomAt(1.5, sx, sy)
    board.renderCommitted()
    const previewDot = measureDot(sx, sy), after = world(sx, sy)
    await settle()
    const settledDot = measureDot(sx, sy)
    const anchorError = Math.max(...before.map((v, i) => Math.abs(v - after[i])))
    board.setView({ x: 1000000, y: -1000000, zoom: 1 }); await settle()
    const distant = { ...board.view }
    board.setView({ x: 0, y: 0, zoom: 1 }); await settle()
    const originalDrawGrid = board.drawGrid.bind(board), originalBlit = board.blit.bind(board)
    const background = document.createElement('canvas'), backgroundCtx = background.getContext('2d')
    background.className = 'cv'; background.width = board.boardCv.width; background.height = board.boardCv.height
    background.style.width = `${board.w}px`; background.style.height = `${board.h}px`
    board.boardCv.before(background)
    const installSplit = () => {
      board.drawGrid = () => {} // omit the background from the expensive object cache
      board.blit = function(preview) {
        originalBlit(preview)
        const ctx = backgroundCtx, width = this.cw, height = this.ch
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, background.width, background.height)
        ctx.save()
        this.cw = this.w; this.ch = this.h
        try { originalDrawGrid(ctx, this.view) } finally { this.cw = width; this.ch = height; ctx.restore() }
      }
      board.refresh(null)
    }
    const uninstallSplit = () => {
      backgroundCtx.setTransform(1, 0, 0, 1, 0, 0); backgroundCtx.clearRect(0, 0, background.width, background.height)
      board.drawGrid = originalDrawGrid; board.blit = originalBlit; board.refresh(null)
    }
    const stats = samples => {
      const sorted = [...samples].sort((a, b) => a - b)
      return { meanMs: samples.reduce((a, b) => a + b, 0) / samples.length, p95Ms: sorted[Math.floor(sorted.length * .95)], maxMs: sorted.at(-1) }
    }
    const makeItems = count => Array.from({ length: count }, (_, n) => {
      const p = [], x = (n % 80) * 60, y = Math.floor(n / 80) * 40
      for (let i = 0; i < 60; i++) p.push(x + i * .9, y + 12 * Math.sin(i * .3), .5)
      return { t: 's', id: `canvas-audit-${n}`, c: '#111827', w: 2.5, m: false, v: false, p }
    })
    const benchmarks = []
    for (const count of [0, 500, 4000]) {
      const items = makeItems(count)
      for (const split of [false, true]) {
        if (split) installSplit(); else uninstallSplit()
        board.doc.replaceAll(items)
        board.setView({ x: 0, y: 0, zoom: count === 4000 ? .35 : 1 }); board.refresh(null); await settle()
        for (const mode of ['pan', 'zoom']) {
          const cpu = [], rebuilds = [], intervals = [], previews = [], unexpectedCameraChanges = []
          const render = board.renderCommitted.bind(board), rebuild = board.rebuildCache.bind(board)
          const blit = board.blit.bind(board)
          board.renderCommitted = () => { const t = performance.now(); render(); cpu.push(performance.now() - t) }
          board.rebuildCache = () => { rebuild(); rebuilds.push(board.rebuildMs) }
          board.blit = p => { previews.push(p); blit(p) }
          let last = performance.now()
          for (let i = 0; i < 90; i++) {
            if (mode === 'pan') board.panBy(12, 6)
            else board.zoomAt(Math.exp(.013 * Math.cos(i / 18)), board.w / 2, board.h / 2)
            const expected = { ...board.view }
            await frame(); const now = performance.now(); intervals.push(now - last); last = now
            if (Object.keys(expected).some(key => expected[key] !== board.view[key])) unexpectedCameraChanges.push({ frame: i, expected, actual: { ...board.view } })
          }
          board.renderCommitted = render; board.rebuildCache = rebuild; board.blit = blit
          const row = { count, samples: count * 60, splitBackground: split, mode,
            frameIntervals: stats(intervals), renderCPU: stats(cpu), rebuildCount: rebuilds.length,
            rebuildCPU: rebuilds.length ? stats(rebuilds) : null, previewFrames: previews.filter(Boolean).length, unexpectedCameraChanges }
          benchmarks.push(row)
          await settle()
        }
      }
    }
    board.doc.replaceAll([]); board.setView({ x: 0, y: 0, zoom: 1 }); board.refresh(null); await settle()
    const measureBackgroundDot = () => {
      const data = backgroundCtx.getImageData(Math.round(sx * board.dpr) - 9, Math.round(sy * board.dpr) - 9, 18, 18).data
      let alphaArea = 0
      for (let i = 3; i < data.length; i += 4) alphaArea += data[i] / 255 / (board.dpr * board.dpr)
      return { alphaArea }
    }
    const splitBaseDot = measureBackgroundDot()
    board.rebuildMs = 99; board.zoomAt(1.5, sx, sy); board.renderCommitted()
    const splitPreviewDot = measureBackgroundDot()
    await settle()
    uninstallSplit(); await settle()
    return { recordedAt: new Date().toISOString(), viewport: { width: board.w, height: board.h, dpr: board.dpr },
      userAgent: navigator.userAgent, isolatedHiddenWindow: true, anchorError, distant, baseDot, previewDot, settledDot,
      splitBaseDot, splitPreviewDot, gridThresholds: [.449, .451, 3.99, 4.01].map(stepAt), benchmarks }
  })
  check('zoom retains its world anchor', evidence.anchorError < 1e-8)
  check('benchmark camera changes come only from the scripted gestures', evidence.benchmarks.every(row => !row.unexpectedCameraChanges.length))
  check('camera navigates far beyond the viewport', evidence.distant.x === 1000000 && evidence.distant.y === -1000000)
  check('cached-grid preview reproduces dot growth', evidence.previewDot.alphaArea > evidence.baseDot.alphaArea * 1.6)
  check('settled dots return to the original area', Math.abs(evidence.settledDot.alphaArea / evidence.baseDot.alphaArea - 1) < .25)
  check('background-split prototype keeps dot size during zoom', Math.abs(evidence.splitPreviewDot.alphaArea / evidence.splitBaseDot.alphaArea - 1) < .05)

  const input = await page.evaluate(() => {
    const { board, S } = window.__fw
    S.grid.value = 'dots'; board.doc.replaceAll([]); board.setView({ x: 100, y: -200, zoom: 1 })
    const el = document.querySelector('.stage'), r = el.getBoundingClientRect(), sx = 380, sy = 240
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: r.left + sx, clientY: r.top + sy, ctrlKey: true, deltaY: -100, deltaMode: 0 })
    // MouseEvent may round client coordinates; compare at the actual input point.
    const actualWorld = () => [board.view.x + (event.clientX - r.left) / board.view.zoom, board.view.y + (event.clientY - r.top) / board.view.zoom]
    const before = actualWorld()
    el.dispatchEvent(event)
    const after = actualWorld(), zoomed = { ...board.view }
    el.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 21, deltaY: 35, deltaMode: 0 }))
    return { error: Math.max(...before.map((v, i) => Math.abs(v - after[i]))), zoomed, panned: { ...board.view } }
  })
  check('Ctrl+wheel uses pointer-anchored zoom', input.error < 1e-8 && input.zoomed.zoom > 1)
  check('wheel pan scales correctly with zoom', Math.abs(input.panned.y - input.zoomed.y - 35 / input.zoomed.zoom) < 1e-8)
  await page.evaluate(() => { const { board } = window.__fw; board.setView({ x: 0, y: 0, zoom: 1 }) })
  await gesture(page, [[300, 240]], { type: 'touch', id: 1, up: false })
  await gesture(page, [[500, 240]], { type: 'touch', id: 2, up: false })
  await gesture(page, [[500, 240], [600, 240]], { type: 'touch', id: 2, down: false, up: false, gap: 0 })
  const pinch = await page.evaluate(() => ({ ...window.__fw.board.view }))
  await gesture(page, [[600, 240]], { type: 'touch', id: 2, down: false })
  await gesture(page, [[300, 240]], { type: 'touch', id: 1, down: false })
  check('two-touch pinch changes zoom without committing ink', pinch.zoom > 1 && await page.evaluate(() => window.__fw.board.doc.items.length === 0))
  evidence.input = { ...input, pinch, note: 'Synthetic renderer pointer events; physical trackpad and touchscreen feel not measured.' }

  evidence.visualCaptures = await captureDots(page)
  evidence.pageErrors = logs.filter(l => l.startsWith('[pageerror]'))
  check('canvas audit has no renderer exceptions', !evidence.pageErrors.length)
  writeFileSync(join(target, 'source-results.json'), JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify({ viewport: evidence.viewport, dotAreaRatio: evidence.previewDot.alphaArea / evidence.baseDot.alphaArea,
    benchmarks: evidence.benchmarks.map(r => ({ count: r.count, split: r.splitBackground, mode: r.mode, frameP95: r.frameIntervals.p95Ms, cpuP95: r.renderCPU.p95Ms, rebuilds: r.rebuildCount, previewFrames: r.previewFrames })) }, null, 2))
  if (summary()) process.exitCode = 1
  }
} finally { await app.close() }
