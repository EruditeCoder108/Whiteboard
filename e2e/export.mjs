// Export preview and print-friendly PDFs: see the sheets first, choose, and dark boards print on white.
// Run: npm run e2e:export
import { launch, check, summary, fw, shotDir } from './lib.mjs'
import { join } from 'node:path'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const files = mkdtempSync(join(tmpdir(), 'fw-export-'))
const pdf = join(files, 'Lesson.pdf')
const { app, page, logs } = await launch({ layout: 'board' })
await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }) }, pdf)
const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: join(shotDir, `export-${name}.png`) }) }
const addTo = (over) => fw(page, (w, over) => {
  const before = w.board.doc.snapshot()
  w.board.doc.replaceAll([...before, { t: 'h', id: `s${Math.random()}`, c: '#ffffff', w: 8, k: 'rect', p: [300, 200, 1000, 700], ...over }])
  w.board.commit(w.board.doc.diff(before)); w.board.refresh(null)
}, over)
/** Colours of a world point in the first exported sheet. */
const sampled = (opts) => fw(page, async (w, opts) => {
  const [png] = await w.board.exportPages(opts)
  const bmp = await createImageBitmap(new Blob([png], { type: 'image/png' }))
  const cv = new OffscreenCanvas(bmp.width, bmp.height), c = cv.getContext('2d'); c.drawImage(bmp, 0, 0)
  const k = bmp.width / 1600, at = (x, y) => [...c.getImageData(x * k, y * k, 1, 1).data].slice(0, 3).join()
  return { corner: at(20, 20), line: at(300, 400), yellow: at(1200, 400), width: bmp.width }
}, opts)
const openPreview = async () => {
  await fw(page, w => { w.S.popover.value = 'export' })
  await page.getByRole('button', { name: 'Save PDF', exact: true }).click()
  await page.waitForSelector('.preview-sheet')
  await page.waitForFunction(() => document.querySelector('.preview-count')?.textContent.includes('sheet') && !document.querySelector('.preview-count').textContent.includes('Preparing'))
}
const sheets = () => page.locator('.preview-page').count()

try {
  // ── print-friendly ─────────────────────────────────────────────────────────
  await fw(page, w => w.board.setColor('#1d3b33'))
  await fw(page, w => w.board.setPaper('lines'))
  await addTo({})
  await addTo({ c: '#f5c518', p: [1200, 200, 1300, 700] })
  const plain = await sampled({})
  check('a normal PDF looks like the board', plain.corner !== '255,255,255' && plain.line === '255,255,255', JSON.stringify(plain))
  const printed = await sampled({ print: true })
  check('print-friendly: the board turns to white paper', printed.corner.split(',').every(v => +v > 225), JSON.stringify(printed)) // white, or a faint paper line
  check('white chalk turns to dark ink', printed.line === '17,24,39', JSON.stringify(printed))
  check('yellow chalk keeps its colour family but gets darker', printed.yellow !== '245,197,24' && printed.yellow !== '17,24,39' && printed.yellow !== '255,255,255', JSON.stringify(printed))
  check('the lesson itself is untouched', await fw(page, w => w.board.doc.items[0].c === '#ffffff' && w.S.bgColor.value === '#1d3b33'))

  // ── the preview ────────────────────────────────────────────────────────────
  await fw(page, w => w.board.addPage())
  await addTo({})
  await fw(page, w => w.board.addPage())
  await addTo({ p: [100, 100, 500, 500] })
  await openPreview()
  await shot('preview')
  check('the preview shows every sheet', await sheets() === 3, String(await sheets()))
  check('it offers print-friendly because the board is dark', await page.getByText('Print-friendly').count() === 1)
  check('it does not offer hidden answers when there are none', await page.getByText('Include hidden answers').count() === 0)
  const before = await page.locator('.preview-page img').first().getAttribute('src')
  await page.locator('.preview-sheet [role=switch]').first().click()
  await page.waitForFunction((b) => { const i = document.querySelector('.preview-page img'); return i && i.getAttribute('src') !== b && document.querySelectorAll('.preview-page').length === 3 && !document.querySelector('.preview-count').textContent.includes('Preparing') }, before)
  await shot('print')
  check('switching to print-friendly updates the sheets shown', true)

  await page.locator('.preview-page').nth(1).click()
  check('tapping a sheet leaves it out', (await page.locator('.preview-count').textContent()).includes('2 sheets') && await page.locator('.preview-page.out').count() === 1)
  await shot('left-out')
  await page.locator('.preview-page').nth(1).click()
  check('tapping again puts it back', (await page.locator('.preview-count').textContent()).includes('3 sheets'))
  await page.locator('.preview-page').nth(2).click()
  await page.getByRole('button', { name: 'Save PDF', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.toast')?.textContent.includes('PDF saved'), null, { timeout: 15000 })
  check('Save writes a PDF', existsSync(pdf) && readFileSync(pdf).subarray(0, 4).toString() === '%PDF')
  check('with only the sheets kept', (await page.locator('.toast').textContent()).includes('2 sheets'), await page.locator('.toast').textContent())

  // ── hidden answers ─────────────────────────────────────────────────────────
  await fw(page, w => { const before = w.board.doc.snapshot(); const it = before[0]; w.board.doc.replaceAll([{ ...it, step: { n: 1 } }]); w.board.commit(w.board.doc.diff(before)); w.board.refresh(null) })
  await openPreview()
  check('with something hidden it asks about hidden answers', await page.getByText('Include hidden answers').count() === 1)
  await page.getByRole('button', { name: 'Close' }).click()

  // ── a light lesson needs no print-friendly ─────────────────────────────────
  await fw(page, w => w.lessonState.lesson.newLesson({ name: 'Light', subject: '', kind: 'notebook' }))
  await page.waitForFunction(() => window.__fw.board.doc.items.length === 0)
  await fw(page, w => w.board.setColor('#ffffff'))
  await addTo({ c: '#111827' })
  await openPreview()
  check('a white board does not offer print-friendly', await page.getByText('Print-friendly').count() === 0)
  await page.getByRole('button', { name: 'Close' }).click()
  const same = await sampled({ print: true })
  check('and it would change nothing', same.line === '17,24,39' && same.corner === '255,255,255', JSON.stringify(same))

  // ── a closed preview stops working ─────────────────────────────────────────
  await fw(page, w => w.board.setColor('#1d3b33'))
  await fw(page, w => { w.S.popover.value = 'export-preview' })
  await page.waitForSelector('.preview-sheet')
  await page.getByRole('button', { name: 'Close' }).click()
  await page.waitForTimeout(300)
  check('closing mid-way leaves no errors', logs.filter(l => /pageerror/.test(l)).length === 0, logs.join(' | '))

  check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.join(' | '))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
