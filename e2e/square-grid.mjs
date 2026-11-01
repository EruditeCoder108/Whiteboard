// Real production pixels in a disposable, hidden Electron profile.
import { launch, appDir, check, summary } from './lib.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const target = join(appDir, 'docs', 'grid-qa')
mkdirSync(target, { recursive: true })
const { app, page, logs } = await launch()
try {
  await app.evaluate(({ BrowserWindow }) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.setIgnoreMouseEvents(true); win.setAlwaysOnTop(false); win.hide()
    }
  })
  const evidence = await page.evaluate(() => {
    const { board, S } = window.__fw
    if (board.anim) { cancelAnimationFrame(board.anim.raf); board.anim = null }
    board.doc.replaceAll([]); board.setPaper('lines'); S.bgAlpha.value = 100
    const originalDpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio')
    const read = () => {
      const cv = document.createElement('canvas'); cv.width = board.gridCv.width; cv.height = board.gridCv.height
      const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(board.gridCv, 0, 0)
      return ctx.getImageData(0, 0, cv.width, cv.height)
    }
    const alphaDiff = (a, b) => {
      let delta = 0, total = 0
      for (let i = 3; i < a.data.length; i += 4) { delta += Math.abs(a.data[i] - b.data[i]); total += a.data[i] }
      return delta / Math.max(1, total)
    }
    const maxAlphaDiff = (a, b) => {
      let delta = 0
      for (let i = 3; i < a.data.length; i += 4) delta = Math.max(delta, Math.abs(a.data[i] - b.data[i]))
      return delta
    }
    const thickness = image => {
      // Full-strength origin line at x=100.5, away from horizontal lines.
      let total = 0
      const d = board.dpr
      for (let y = Math.round(106 * d); y < Math.round(110 * d); y++)
        for (let x = Math.round(97 * d); x < Math.round(104 * d); x++) total += image.data[(y * image.width + x) * 4 + 3] / 255
      return total / ((Math.round(110 * d) - Math.round(106 * d)) * d)
    }
    const profiles = [], captures = []
    const levels = [.05, .2, .32, .39, .5, .75, 1, 1.6, 2.32, 4, 6.4, 16]
    try {
      for (const dpr of [1, 1.25, 1.5, 2]) {
        Object.defineProperty(window, 'devicePixelRatio', { configurable: true, get: () => dpr })
        board.resize()
        for (const dark of [false, true]) {
          board.setColor(dark ? '#1f232b' : '#ffffff')
          const widths = [], boundaries = []
          for (const zoom of levels) {
            board.setView({ x: -100 / zoom, y: -103 / zoom, zoom }); board.renderCommitted()
            widths.push({ zoom, alphaWidth: thickness(read()) })
          }
          for (const zoom of [.1, .4, 1.6, 6.4]) {
            // Exercise both negative and distant world positions at a boundary.
            for (const origin of [-80, 1e6]) {
              board.setView({ x: origin, y: -origin, zoom: zoom * (1 - 1e-7) }); board.renderCommitted(); const a = read()
              board.setView({ x: origin, y: -origin, zoom: zoom * (1 + 1e-7) }); board.renderCommitted()
              const b = read()
              boundaries.push({ zoom, origin, relativeAlphaChange: alphaDiff(a, b), maxAlphaChange: maxAlphaDiff(a, b) })
            }
          }
          // A square lattice must have identical horizontal and vertical pixel
          // profiles, including subpixel pans and all tested zooms.
          const squares = []
          for (const zoom of levels) {
            board.setView({ x: -37.25 / zoom, y: -37.25 / zoom, zoom }); board.renderCommitted()
            const image = read(), sample = Math.round(41 * dpr), n = Math.floor(Math.min(image.width, image.height))
            const centres = vertical => {
              const result = []
              let weight = 0, moment = 0
              for (let i = 4; i < n - 4; i++) {
                const alpha = image.data[((vertical ? i * image.width + sample : sample * image.width + i)) * 4 + 3]
                if (alpha) { weight += alpha; moment += alpha * i }
                else if (weight) {
                  // Faint subdivisions near the 8-bit noise floor do not
                  // provide a reliable opacity-weighted geometric centroid.
                  if (weight >= Math.max(4, (dark ? .16 : .075) * 255 * dpr * .1)) result.push(moment / weight)
                  weight = 0; moment = 0
                }
              }
              return result
            }
            const row = centres(false), column = centres(true)
            squares.push({ zoom, rowCount: row.length, columnCount: column.length,
              maxCentreMismatch: Math.max(0, ...row.map((v, i) => Math.abs(v - (column[i] ?? Infinity)))) })
          }
          profiles.push({ dpr, dark, widths, boundaries, squares })
        }
      }
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, get: () => 1.5 }); board.resize()
      board.setColor('#ffffff'); board.setView({ x: -80, y: -80, zoom: 1 }); board.refresh(null); board.renderCommitted()
      board.rebuildMs = 99
      const cacheZoom = board.cv0.zoom
      board.zoomAt(2.32, 300, 220); board.renderCommitted()
      const preview = read(), usedPreview = board.cv0.zoom === cacheZoom
      board.rebuildCache(); board.renderCommitted()
      const previewDifference = alphaDiff(preview, read())

      board.setView({ x: 1e6, y: -1e6, zoom: 1 }); board.renderCommitted(); const distant = read()
      // A 1 CSS-pixel pan must translate the grid, without changing its phase
      // relative to content. Use DPR=2 for an exact device-pixel displacement.
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, get: () => 2 }); board.resize()
      board.setView({ x: -80, y: -80, zoom: 1 }); board.renderCommitted(); const panA = read()
      board.panBy(1, 1); board.renderCommitted(); const panB = read()
      let panMismatch = 0
      for (let y = 4; y < panA.height - 4; y++) for (let x = 4; x < panA.width - 4; x++) {
        const a = panA.data[(y * panA.width + x) * 4 + 3], b = panB.data[((y + 2) * panB.width + x + 2) * 4 + 3]
        panMismatch = Math.max(panMismatch, Math.abs(a - b))
      }

      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, get: () => 1.5 }); board.resize()
      const overview = document.createElement('canvas'); overview.width = 1280; overview.height = 540
      const overviewCtx = overview.getContext('2d'); overviewCtx.fillStyle = '#f4f5f7'; overviewCtx.fillRect(0, 0, 1280, 540)
      let panel = 0
      for (const dark of [false, true]) for (const zoom of [.05, .2, .39, .5, .75, 1, 2.32, 16]) {
        board.setColor(dark ? '#1f232b' : '#ffffff'); board.setView({ x: -80, y: -80, zoom }); board.renderCommitted()
        const cv = document.createElement('canvas'); cv.width = board.gridCv.width; cv.height = board.gridCv.height
        const ctx = cv.getContext('2d'); ctx.fillStyle = S.bgColor.value; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(board.gridCv, 0, 0)
        captures.push({ name: `square-${dark ? 'dark' : 'light'}-${Math.round(zoom * 100)}`, png: cv.toDataURL().split(',')[1] })
        if (!dark) {
          const x = panel % 4 * 320 + 8, y = Math.floor(panel / 4) * 270
          overviewCtx.fillStyle = '#242833'; overviewCtx.font = '600 16px Segoe UI'; overviewCtx.fillText(`${Math.round(zoom * 100)}%`, x, y + 28)
          // Crop production pixels at native CSS spacing instead of shrinking
          // an entire viewport and artificially changing the grid density.
          overviewCtx.drawImage(cv, 0, 0, 456, 327, x, y + 44, 304, 218)
          panel++
        }
      }
      captures.push({ name: 'square-overview', png: overview.toDataURL().split(',')[1] })
      board.setPaper('none'); board.renderCommitted(); const cleared = read().data.every(v => v === 0)
      return { profiles, usedPreview, previewDifference, panMismatch, distantPainted: distant.data.some(v => v !== 0), cleared,
        captures, viewport: { ...board.size }, innerSize: { width: innerWidth, height: innerHeight }, userAgent: navigator.userAgent }
    } finally {
      if (originalDpr) Object.defineProperty(window, 'devicePixelRatio', originalDpr)
      else delete window.devicePixelRatio
      board.resize()
    }
  })
  // Change Chromium's real resolution without changing CSS dimensions. This
  // exercises the resolution listener instead of directly calling resize.
  const cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send('Emulation.setDeviceMetricsOverride', { ...evidence.innerSize, deviceScaleFactor: 2, mobile: false })
    await page.waitForFunction(() => Math.abs(window.__fw.board.dpr - 2) < 1e-5, null, { polling: 100, timeout: 10000 })
    evidence.resolutionChange = await page.evaluate(() => {
      const { board } = window.__fw
      return { dpr: board.dpr, size: { ...board.size }, widths: [board.gridCv.width, board.boardCv.width, board.liveCv.width], expectedWidth: Math.round(board.w * 2) }
    })
  } finally { await cdp.send('Emulation.clearDeviceMetricsOverride'); await cdp.detach() }
  for (const p of evidence.profiles) {
    check(`thin lines at DPR ${p.dpr}, ${p.dark ? 'dark' : 'light'}, 5%-1600%`, p.widths.every(w => Math.abs(w.alphaWidth / (p.dark ? .16 : .075) - 1) < .12), JSON.stringify(p.widths))
    // One 8-bit alpha step is 5% of the low-contrast line itself. Require
    // per-pixel continuity as well as reporting relative aggregate change.
    check(`continuous density at DPR ${p.dpr}, ${p.dark ? 'dark' : 'light'}`, p.boundaries.every(b => b.maxAlphaChange <= 1), JSON.stringify(p.boundaries))
    check(`square geometry at DPR ${p.dpr}, ${p.dark ? 'dark' : 'light'}`, p.squares.every(s => s.rowCount === s.columnCount && s.rowCount > 2 && s.maxCentreMismatch <= .26), JSON.stringify(p.squares))
  }
  check('resolution change refreshes all canvases', Math.abs(evidence.resolutionChange.dpr - 2) < 1e-5 && evidence.resolutionChange.widths.every(w => w === evidence.resolutionChange.expectedWidth))
  check('grid pixels identical during ink preview and settled redraw', evidence.usedPreview && evidence.previewDifference === 0)
  check('pan translates grid with the camera', evidence.panMismatch <= 1, `${evidence.panMismatch}`)
  check('grid paints at distant positive and negative coordinates', evidence.distantPainted)
  check('turning grid off clears all background pixels', evidence.cleared)
  check('no renderer exceptions', !logs.some(l => l.startsWith('[pageerror]')))
  for (const capture of evidence.captures) writeFileSync(join(target, `${capture.name}.png`), Buffer.from(capture.png, 'base64'))
  delete evidence.captures
  evidence.recordedAt = new Date().toISOString()
  evidence.dprMethod = 'production resize with synthetic devicePixelRatio; actual Windows display changes remain manual'
  writeFileSync(join(target, 'square-grid-results.json'), JSON.stringify(evidence, null, 2) + '\n')
  if (summary()) process.exitCode = 1
} finally { await app.close() }
