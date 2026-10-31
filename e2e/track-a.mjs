// Essential end-to-end checks for the teaching essentials: pictures, PDF pages, equations, graphs,
// page persistence and PDF export. Run: npm run e2e:track-a
import { launch, check, summary, fw, shotDir, gesture } from './lib.mjs'
import { join } from 'node:path'

/** A two-page PDF built by hand; pdf.js rebuilds the cross-reference table itself. */
const PDF = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 7 0 R >> >> >> endobj
4 0 obj << /Length 52 >> stream
BT /F1 48 Tf 72 700 Td (Worksheet page 1) Tj ET
endstream endobj
5 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >> endobj
6 0 obj << /Length 52 >> stream
BT /F1 48 Tf 72 700 Td (Worksheet page 2) Tj ET
endstream endobj
7 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
trailer << /Root 1 0 R >>
%%EOF`

let { app, page, logs, userData } = await launch()
try {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 4000, y: 100, width: 1100, height: 750 }))
  await page.waitForTimeout(200)

  // Picture from a generated PNG file, as if dropped or picked.
  const picture = await page.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 320
    const g = cv.getContext('2d'); g.fillStyle = '#2f6bff'; g.fillRect(0, 0, 640, 320); g.fillStyle = '#fff'; g.font = '80px sans-serif'; g.fillText('Photo', 180, 190)
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'))
    await window.__fw.insert.insertFiles([new File([blob], 'photo.png', { type: 'image/png' })])
    const it = window.__fw.board.doc.items.at(-1)
    return { t: it?.t, aspect: it?.aspect, webp: it?.src.startsWith('data:image/webp') }
  })
  check('a picture inserts as an image object, re-encoded as WebP', picture.t === 'i' && Math.abs(picture.aspect - 2) < .01 && picture.webp, JSON.stringify(picture))

  // Equation (maths + chemistry) and graph.
  const equation = await page.evaluate(async () => {
    const render = await window.__fw.insert.loadTypesetter()
    const r = render('x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a} \\quad \\ce{CaCO3 -> CaO + CO2}')
    const it = window.__fw.board.insertImage(window.__fw.insert.svgDataUrl(r.svg), r.width, r.height, { latex: 'x', color: '#e5484d' })
    let error = ''
    try { render('\\frac{a}{') } catch (e) { error = e.message }
    return { latex: it.latex, wide: r.width > r.height, error }
  })
  check('an equation with chemistry typesets to SVG and inserts', equation.latex === 'x' && equation.wide, JSON.stringify(equation))
  check('a malformed equation reports an error instead of inserting', !!equation.error)
  const graph = await fw(page, w => { const g = w.board.insertGraph(['sin(x)', '2x^2 - 1', 'sinx']); return { t: g.t, fns: g.fns.length } })
  check('a graph object inserts with several functions', graph.t === 'g' && graph.fns === 3)
  await page.waitForTimeout(300)
  await fw(page, w => w.board.fitContent()); await page.waitForTimeout(500)
  await page.screenshot({ path: join(shotDir, 'track-a-objects.png') })

  // PDF worksheet: one locked page picture per board page, after the current page.
  const pdf = await page.evaluate(async (text) => {
    await window.__fw.insert.importPdf(new File([text], 'worksheet.pdf', { type: 'application/pdf' }))
    const b = window.__fw.board
    return { pages: b.pageCount, page: b.page, items: b.doc.items.map(it => ({ t: it.t, locked: !!it.locked })) }
  }, PDF)
  check('a two-page PDF adds two board pages with locked page pictures', pdf.pages === 3 && pdf.page === 2 && pdf.items.length === 1 && pdf.items[0].t === 'i' && pdf.items[0].locked, JSON.stringify(pdf))
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(shotDir, 'track-a-pdf.png') })

  // Undo is per page; switching pages keeps each page's content.
  const nav = await fw(page, w => {
    const b = w.board; b.goToPage(0)
    const first = b.doc.items.length
    b.undo(); const afterUndo = b.doc.items.length
    b.redo(); b.goToPage(1)
    return { first, afterUndo, second: b.doc.items.length, signals: [w.S.page.value, w.S.pageCount.value] }
  })
  check('each page keeps its own items and undo history', nav.first === 3 && nav.afterUndo === 2 && nav.second === 1 && nav.signals[0] === 1 && nav.signals[1] === 3, JSON.stringify(nav))

  const exported = await fw(page, async w => (await w.board.exportPages('#ffffff')).map(b => b.byteLength))
  check('every page renders for PDF export', exported.length === 3 && exported.every(n => n > 2000), JSON.stringify(exported))

  // Autosave writes pictures once as separate files; a restart restores every page.
  const save = await fw(page, async w => { await w.S.retrySave.value(); return w.S.saveStatus.value })
  check('autosave succeeds with pictures and pages', save === 'saved', save + ' ' + await fw(page, w => w.S.saveError.value))
  await app.close()
  ;({ app, page, logs } = await launch({ userData }))
  const restored = await fw(page, w => {
    const b = w.board
    const pages = []
    for (let i = 0; i < b.pageCount; i++) { b.goToPage(i); pages.push(b.doc.items.map(it => it.t).join('')) }
    return { pages, current: b.page }
  })
  check('pages, pictures, equations and graphs survive a restart', JSON.stringify(restored.pages) === JSON.stringify(['iig', 'i', 'i']), JSON.stringify(restored))
  const { readdirSync, statSync } = await import('node:fs')
  const assets = readdirSync(join(userData, 'assets'))
  const boardSize = statSync(join(userData, 'board.json')).size
  check('pictures are stored once as asset files, keeping board.json small', assets.length === 4 && boardSize < 20000, `${assets.length} assets, board.json ${boardSize} bytes`)
  // Instruments: a pen stroke started on the ruler's edge stays exactly on it.
  await fw(page, w => { w.board.addPage(); w.board.setTool('pen'); w.board.instruments.toggle('ruler') })
  const edge = await fw(page, w => { const b = w.board, v = b.view, [cx, cy] = b.viewCentre(); return { x0: (cx - 250 - v.x) * v.zoom, x1: (cx + 250 - v.x) * v.zoom, y: (cy - 1.2 * 37.8 - v.y) * v.zoom, wy: cy - 1.2 * 37.8 } })
  await gesture(page, [[edge.x0, edge.y + 4], [edge.x0 + 120, edge.y + 9], [edge.x0 + 260, edge.y - 7], [edge.x1, edge.y + 3]], { type: 'pen' })
  const ruled = await fw(page, (w, wy) => { const it = w.board.doc.items.at(-1); const ys = it.p.filter((_, i) => i % 3 === 1); return { t: it.t, spread: Math.max(...ys.map(y => Math.abs(y - wy))) } }, edge.wy)
  check('a pen stroke along the ruler edge is perfectly straight', ruled.t === 's' && ruled.spread < .01, JSON.stringify(ruled))
  const moved = await fw(page, w => { w.board.instruments.toggle('ruler'); w.board.instruments.toggle('compass'); return w.board.instruments.active })
  // Compass: dragging the pencil sweeps an arc at the set radius around the pin.
  const pencil = await fw(page, w => { const b = w.board, v = b.view, [cx, cy] = b.viewCentre(); return { cx, cy, x: (cx + 4 * 37.8 - v.x) * v.zoom, y: (cy - v.y) * v.zoom, px: (cx - v.x) * v.zoom, py: (cy - v.y) * v.zoom } })
  const arc = []
  for (let k = 0; k <= 30; k++) { const a = k / 30 * Math.PI * 1.2; arc.push([pencil.px + (pencil.x - pencil.px) * Math.cos(a), pencil.py + (pencil.x - pencil.px) * Math.sin(a)]) }
  await gesture(page, arc, { type: 'mouse' })
  const drawn = await fw(page, (w, c) => { const it = w.board.doc.items.at(-1); const r = []; for (let i = 0; i < it.p.length; i += 3) r.push(Math.hypot(it.p[i] - c.cx, it.p[i + 1] - c.cy)); return { t: it.t, min: Math.min(...r), max: Math.max(...r) } }, pencil)
  check('the compass draws an arc at exactly its radius', moved && drawn.t === 's' && Math.abs(drawn.min - 4 * 37.8) < .5 && Math.abs(drawn.max - 4 * 37.8) < .5, JSON.stringify(drawn))
  await page.screenshot({ path: join(shotDir, 'track-a-instruments.png') })
  await fw(page, w => w.board.instruments.toggle('compass'))

  // Shape snapping: a wobbly circle held still at the end becomes a clean circle.
  const rough = []
  for (let k = 0; k <= 64; k++) { const a = k / 64 * Math.PI * 2; const r = 90 + 6 * Math.sin(k * 1.7); rough.push([450 + r * Math.cos(a), 330 + r * Math.sin(a)]) }
  await gesture(page, rough, { type: 'pen', up: false })
  await page.waitForTimeout(800)
  await gesture(page, [rough.at(-1)], { type: 'pen', down: false })
  const shape = await fw(page, w => { const it = w.board.doc.items.at(-1); return { t: it.t, k: it.k, w: it.p[2] - it.p[0], h: it.p[3] - it.p[1] } })
  check('a rough circle held at the end snaps into a clean circle', shape.t === 'h' && shape.k === 'ellipse' && Math.abs(shape.w - shape.h) < .01, JSON.stringify(shape))
  const square = [[300, 500], [420, 503], [540, 498], [541, 560], [539, 640], [420, 641], [300, 638], [302, 570], [300, 503]]
  const dense = square.flatMap((p, i) => i ? Array.from({ length: 8 }, (_, j) => [square[i - 1][0] + (p[0] - square[i - 1][0]) * (j + 1) / 8, square[i - 1][1] + (p[1] - square[i - 1][1]) * (j + 1) / 8]) : [p])
  await gesture(page, dense, { type: 'pen', up: false }); await page.waitForTimeout(800); await gesture(page, [dense.at(-1)], { type: 'pen', down: false })
  check('a rough square held at the end snaps into a rectangle', await fw(page, w => w.board.doc.items.at(-1).k === 'rect'))

  check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.join(' | '))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
