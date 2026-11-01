// Background & paper (Note 3 deep dive Â§6): spacing, strength and line colour, new papers, writing papers
// that follow the zoom on the canvas, and a background picture with a complete lifecycle.
// Run: npm run e2e:papers
import { launch, check, summary, fw, gesture, wave } from './lib.mjs'

const { app, page, logs } = await launch({ layout: 'board' })
const ink = (y = 400) => gesture(page, wave(300, y, 40, 20, 8), { type: 'pen', pressure: 0.6 })
const here = () => fw(page, w => { const h = w.S.here.value; return { paper: h.paper, ...h.style, art: h.art && { fit: h.art.fit, opacity: h.art.opacity, span: h.art.span } } })
const openSheet = async () => {
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Background' }).click()
}
/** The colour at a point of a PNG (fractions of its size). */
const pixelAt = (png, fx, fy) => page.evaluate(async ({ bytes, fx, fy }) => {
  const bmp = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }))
  const cv = new OffscreenCanvas(bmp.width, bmp.height); const ctx = cv.getContext('2d'); ctx.drawImage(bmp, 0, 0)
  return [...ctx.getImageData(Math.floor(bmp.width * fx), Math.floor(bmp.height * fy), 1, 1).data]
}, { bytes: png, fx, fy })
const pagePng = () => fw(page, async w => Array.from(new Uint8Array(await w.board.exportPng({ scope: 'page' }))))
/** A test picture: red, 400Ã—300. */
const red = await page.evaluate(async () => {
  const cv = new OffscreenCanvas(400, 300); const ctx = cv.getContext('2d'); ctx.fillStyle = '#e00000'; ctx.fillRect(0, 0, 400, 300)
  const blob = await cv.convertToBlob({ type: 'image/png' })
  return await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob) })
})
const isRed = (px) => px[0] > 200 && px[1] < 60 && px[2] < 60

try {
  // â”€â”€ paper settings in the Background & paper sheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await openSheet()
  for (const name of ['Isometric dots', 'Isometric grid', 'Two columns', 'Three columns', 'Worked example', 'Exit ticket'])
    check(`the sheet offers ${name}`, await page.getByRole('button', { name, exact: true }).count() === 1)
  await page.getByRole('button', { name: 'Four-line', exact: true }).click()
  check('tapping Four-line gives this page four-line paper', (await here()).paper === 'fourline')
  await page.getByRole('button', { name: 'Large', exact: true }).click()
  check('Large spacing makes the bands wider', (await here()).spacing === 1.5)
  await page.getByRole('button', { name: 'Further apart' }).click()
  check('the + button fine-tunes the spacing', (await here()).spacing === 1.6, JSON.stringify(await here()))
  await page.getByRole('button', { name: 'Strong', exact: true }).click()
  await page.getByRole('button', { name: 'Green lines' }).click()
  const tuned = await here()
  check('strength and line colour are set', tuned.strength === 1.7 && tuned.lines === '#16a34a', JSON.stringify(tuned))
  const saved = await fw(page, w => JSON.parse(w.board.serialize()).pages[0])
  check('the settings are saved with the page', saved.spacing === 1.6 && saved.strength === 1.7 && saved.lines === '#16a34a' && saved.paper === 'fourline', JSON.stringify(saved))
  check('new lessons remember how the paper was drawn', await fw(page, w => [w.S.defaultSpacing.value, w.S.defaultStrength.value, w.S.defaultLines.value].join()) === '1.6,1.7,#16a34a')
  await fw(page, w => w.board.undo())
  check('one Undo takes back the whole run of adjustments', (await here()).spacing === 1 && (await here()).paper === 'fourline', JSON.stringify(await here()))
  await page.getByRole('button', { name: 'Large', exact: true }).click()
  await page.getByRole('button', { name: 'Restore the paper as designed' }).click()
  const preset = await here()
  check('Restore puts the paper back as designed, keeping the paper', preset.paper === 'fourline' && preset.spacing === 1 && preset.strength === 1 && !preset.lines, JSON.stringify(preset))
  await page.keyboard.press('Escape')

  // â”€â”€ All pages, new pages, duplicate and undo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await fw(page, w => { w.board.addPage(); w.board.goToPage(0) })
  await openSheet()
  await page.getByRole('button', { name: 'All pages' }).first().click()
  await page.getByRole('button', { name: 'Graph paper', exact: true }).click()
  await page.getByRole('button', { name: 'Small', exact: true }).click()
  const all = await fw(page, w => w.board.pageData().map(p => `${p.paper}:${p.spacing ?? 1}`))
  check('with All pages on, every page gets the paper and its spacing', all.join() === 'graph:0.75,graph:0.75', all.join())
  await page.keyboard.press('Escape')
  await fw(page, w => { w.board.addPage() })
  check('a new page takes the paper of the page before, with its settings', await fw(page, w => `${w.S.here.value.paper}:${w.S.here.value.style.spacing}`) === 'graph:0.75')

  // â”€â”€ background picture â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await fw(page, (w, src) => { w.board.newLesson('notebook'); w.board.setPaper('none'); w.board.setArt({ src, fit: 'fill', opacity: 1, align: [.5, .5], span: 'first' }) }, red)
  await page.waitForTimeout(300)
  const filled = [await pixelAt(await pagePng(), .5, .5), await pixelAt(await pagePng(), .02, .02)]
  check('a filled picture shows behind the page, in the picture export too', filled.every(isRed), JSON.stringify({ filled, here: await here() }))
  await fw(page, w => w.background.adjust({ fit: 'fit' }))
  check('Whole picture keeps it uncropped and unstretched (the sides show the board)', isRed(await pixelAt(await pagePng(), .5, .5)) && !isRed(await pixelAt(await pagePng(), .03, .5)))
  await ink()
  await fw(page, w => w.board.clearBoard())
  check('Clear ink keeps the picture and says so', (await here()).art !== null && await page.getByText(/the picture and paper stay/).count() === 1)
  await fw(page, w => w.board.undo())
  check('and the cleared ink comes back with Undo', await fw(page, w => w.board.doc.items.length) === 1)
  const exported = await fw(page, async w => { w.board.clearBoard(); return (await w.board.exportPages()).length })
  check('a page with only a picture still exports (a printable worksheet)', exported === 1)
  // The file carries the picture: reopen it as a new lesson on top.
  const json = await fw(page, w => w.board.serialize())
  await fw(page, (w, json) => { w.board.newLesson('notebook'); w.board.load(json, { undoable: true }) }, json)
  await page.waitForTimeout(300)
  check('the saved lesson reopens with its picture, without the original file', (await here()).art?.fit === 'fit' && isRed(await pixelAt(await pagePng(), .5, .5)))
  await fw(page, w => { w.board.duplicatePage(0) })
  await fw(page, w => w.background.remove())
  const copies = await fw(page, w => w.board.pageData().map(p => !!p.art))
  check('removing the picture from a copy leaves the original page alone', copies.join() === 'true,false', copies.join())
  await page.getByRole('button', { name: 'Undo' }).last().click()
  check('Undo in the message brings the picture back', await fw(page, w => w.board.pageData().map(p => !!p.art).join()) === 'true,true')

  // A worksheet picture on the page becomes its background.
  await fw(page, (w, src) => { w.board.newLesson('notebook'); const it = w.board.insertImage(src, 400, 300); w.board.setSelection([it]) }, red)
  await openSheet()
  await page.getByRole('button', { name: 'Use selected picture' }).click()
  check('Use selected picture moves it behind the ink', await fw(page, w => w.board.doc.items.length) === 0 && (await here()).art !== null)
  check('the sheet now offers Remove, position and long-page choices', await page.getByRole('button', { name: 'Remove the picture' }).count() === 1 && await page.getByRole('button', { name: 'Every screen' }).count() === 1)
  await page.keyboard.press('Escape')

  // â”€â”€ canvas: writing papers follow the zoom â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /** How many paper lines cross the middle column of the background canvas. */
  const lines = () => fw(page, w => {
    const cv = w.board.gridCv, ctx = cv.getContext('2d'), x = Math.floor(cv.width / 2)
    const col = ctx.getImageData(x, 0, 1, cv.height).data
    let n = 0, on = false
    for (let i = 3; i < col.length; i += 4) { const ink = col[i] > 20; if (ink && !on) n++; on = ink }
    return n
  })
  await fw(page, w => { w.board.newLesson('canvas'); w.board.setPaper('fourline'); w.board.setView({ x: 0, y: 0, zoom: 1 }) })
  await page.waitForTimeout(200)
  const at1 = await lines()
  await fw(page, w => w.board.setView({ x: 0, y: 0, zoom: 4 }))
  await page.waitForTimeout(200)
  const at4 = await lines()
  await fw(page, w => w.board.setView({ x: 0, y: 0, zoom: .25 }))
  await page.waitForTimeout(200)
  const atQuarter = await lines()
  check('zooming in on a canvas keeps the four-line bands close together (not 4Ã— apart)', at4 > at1 * .5, `${at1} â†’ ${at4}`)
  check('zooming out does not crowd them into a block', atQuarter < at1 * 2, `${at1} â†’ ${atQuarter}`)
  await fw(page, w => { w.board.newLesson('notebook'); w.board.setPaper('fourline') })
  await page.waitForTimeout(200)
  check('a notebook page keeps its paper fixed to the page', (await lines()) > 10)

  // ── board surfaces: colour + texture ─────────────────────────────────────
  await fw(page, w => { w.board.newLesson('notebook'); w.board.setPaper('none') })
  await openSheet()
  await page.getByRole('button', { name: 'Chalkboard', exact: true }).click()
  const chalk = await fw(page, w => ({ ...w.S.here.value, pen: w.S.penColor.value, def: w.S.defaultTexture.value }))
  check('Chalkboard gives the lesson a dark chalk surface and white chalk ink', chalk.texture === 'chalk' && chalk.color === '#262a2e' && chalk.pen === '#ffffff' && chalk.def === 'chalk', JSON.stringify(chalk))
  /** How many different colours a band across the page export has: 1 on a flat board, many on a textured one. */
  const variety = async () => fw(page, async w => {
    const bytes = new Uint8Array(await w.board.exportPng({ scope: 'page' }))
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const cv = new OffscreenCanvas(bmp.width, bmp.height); const ctx = cv.getContext('2d'); ctx.drawImage(bmp, 0, 0)
    const d = ctx.getImageData(0, Math.floor(bmp.height / 2), bmp.width, 4).data, seen = new Set()
    for (let i = 0; i < d.length; i += 4) seen.add(d[i] << 16 | d[i + 1] << 8 | d[i + 2])
    return seen.size
  })
  check('the texture is in the exported picture too', await variety() > 20)
  await page.getByRole('button', { name: 'Smooth', exact: true }).click()
  check('Smooth keeps the colour and takes the texture away', (await fw(page, w => w.S.here.value.texture)) === 'none' && await variety() <= 2)
  await page.getByRole('button', { name: 'Green board', exact: true }).click()
  await fw(page, w => w.board.addPage())
  await page.getByRole('button', { name: 'Only this page' }).click()
  await page.getByRole('button', { name: 'Slate', exact: true }).first().click()
  const surfaces = await fw(page, w => { const f = JSON.parse(w.board.serialize()); return { root: f.texture, color: f.color, pages: f.pages.map(p => p.texture ?? null) } })
  check('the lesson keeps its surface in the file, and a page can have its own', surfaces.root === 'chalk' && surfaces.color === '#22423a' && surfaces.pages.join() === ',slate', JSON.stringify(surfaces))
  await page.keyboard.press('Escape')

  check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.join(' | '))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
