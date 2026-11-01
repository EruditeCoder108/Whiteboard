// My shelf (Note 3 deep dive §8.2): keep a diagram or a page once, use it in any lesson, carry it to another PC.
// Run: npm run e2e:shelf
import { launch, check, summary, fw, shotDir, gesture, wave } from './lib.mjs'
import { join } from 'node:path'
import { existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'

const files = mkdtempSync(join(tmpdir(), 'fw-shelf-files-'))
const shelfFile = join(files, 'My shelf.wbshelf')
let { app, page, logs, userData } = await launch({ layout: 'board' })
const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: join(shotDir, `shelf-${name}.png`) }) } // past the sheets' fade-in
const stub = () => app.evaluate(({ dialog, shell }, file) => {
  dialog.showSaveDialog = async () => ({ canceled: false, filePath: file })
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] })
  // Tests leave the real Recycle Bin alone.
  shell.trashItem = async (p) => { await process.mainModule.require('node:fs').promises.rename(p, p + '.binned') }
}, shelfFile)
const open = async () => {
  await fw(page, w => { w.S.popover.value = 'shelf' })
  await page.waitForSelector('.library .library-body')
  await page.waitForFunction(() => !document.querySelector('.library .pop-hint'))
}
const items = () => fw(page, w => w.board.doc.items.map(it => ({ id: it.id, c: it.c, group: it.group, locked: !!it.locked, t: it.t })))
/** Saved through the real sheet: name it, tap Save. */
const saveAs = async (name) => {
  await page.waitForSelector('.new-lesson-card')
  await page.locator('.new-lesson-card input').first().fill(name)
  await page.getByRole('button', { name: 'Save to shelf' }).click()
  await page.waitForFunction(() => !document.querySelector('.new-lesson-card'))
}
const card = (name) => page.getByRole('button', { name: `Use ${name}` })

try {
  await stub()
  await open()
  await shot('empty')
  check('an empty shelf says how to fill it', (await page.locator('.shelf-empty').textContent()).includes('Draw it once'))
  await fw(page, w => { w.S.popover.value = null })

  // ── a diagram: drawn in white on a chalkboard, and grouped ─────────────────
  await fw(page, w => { w.board.setColor('#1d3b33') })
  await fw(page, w => { w.S.penColor.value = '#ffffff'; w.board.setTool('pen') })
  await gesture(page, wave(300, 300, 40, 30, 8), { type: 'pen', pressure: 0.6 })
  await gesture(page, wave(300, 420, 40, 30, 8), { type: 'pen', pressure: 0.6 })
  await fw(page, w => { w.board.selectAll(); w.board.groupSelection() })
  await page.waitForSelector('[data-testid=selection-toolbar]')
  await shot('selection-toolbar')
  await page.getByRole('button', { name: 'Save to My shelf' }).click()
  await page.waitForSelector('.shelf-preview')
  await shot('save-sheet')
  check('saving shows a picture of what will be kept', await page.locator('.shelf-preview').evaluate(el => el.naturalWidth > 0))
  await saveAs('Wave diagram')
  check('the selection is still there after saving', await fw(page, w => w.board.selection.length) === 2)
  const original = await items()

  // ── a fresh copy on the same page ──────────────────────────────────────────
  await open()
  await shot('shelf-one-item')
  check('the shelf lists it by name', await card('Wave diagram').count() === 1)
  await card('Wave diagram').click()
  await page.waitForFunction(() => !document.querySelector('.library'))
  let now = await items()
  const copies = now.slice(2)
  check('tapping it adds a copy, leaving the original', now.length === 4)
  check('the copy has its own ids', copies.every(c => !original.some(o => o.id === c.id)))
  check('the copy stays grouped, in a group of its own', copies[0].group && copies[0].group === copies[1].group && copies[0].group !== original[0].group, JSON.stringify(now))
  check('the copy is selected, ready to move', await fw(page, w => w.board.selection.length) === 2 && await fw(page, w => w.S.tool.value) === 'select')
  check('on the same board its ink is unchanged', copies.every(c => c.c === '#ffffff'))
  await fw(page, w => w.board.undo())
  check('one Undo takes the copy away', (await items()).length === 2)

  // ── any other lesson, on another board ─────────────────────────────────────
  await fw(page, w => w.lessonState.lesson.newLesson({ name: 'Second lesson', subject: 'Physics', kind: 'notebook' }))
  await page.waitForFunction(() => window.__fw.board.doc.items.length === 0)
  await fw(page, w => { w.board.setColor('#ffffff') })
  await open()
  await card('Wave diagram').click()
  await page.waitForFunction(() => window.__fw.board.doc.items.length === 2)
  now = await items()
  check('in another lesson on a white board, white chalk comes in as dark ink', now.every(c => c.c === '#111827'), JSON.stringify(now))
  const box = await fw(page, w => { const b = w.board.doc.bounds(); const r = w.board.visibleRect(); return { cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, vx: (r[0] + r[2]) / 2, vy: (r[1] + r[3]) / 2 } })
  check('it lands in the middle of the board', Math.abs(box.cx - box.vx) < 2 && Math.abs(box.cy - box.vy) < 2, JSON.stringify(box))
  await shot('inserted-on-white')

  // ── a picture stays with it ────────────────────────────────────────────────
  await fw(page, w => w.board.addPage())
  const src = await fw(page, async w => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 32
    const c = cv.getContext('2d'); c.fillStyle = '#c02020'; c.fillRect(0, 0, 64, 32)
    const url = cv.toDataURL('image/png')
    const it = w.board.insertImage(url, 64, 32)
    w.board.setSelection([it])
    return url
  })
  await page.getByRole('button', { name: 'Save to My shelf' }).click()
  await saveAs('Red picture')
  await fw(page, w => w.board.addPage())
  await open()
  await page.locator('.library-search input').fill('red')
  check('search finds an item by the teacher’s own words', await card('Red picture').count() === 1 && await card('Wave diagram').count() === 0)
  await card('Red picture').click()
  await page.waitForFunction(() => window.__fw.board.doc.items.length === 1)
  check('a saved picture comes back whole', await fw(page, w => w.board.doc.items[0].src) === src)

  // ── a whole page: paper, colour, long page ─────────────────────────────────
  await fw(page, w => w.board.addPage())
  await fw(page, w => { w.board.setPaper('graph'); w.board.setColor('#fdf6e3'); w.board.setTitle(w.board.page, 'Graph worksheet'); w.board.extendPage() })
  await page.waitForTimeout(600) // the page scrolls to the new space first
  await fw(page, w => { w.S.penColor.value = '#2f6bff'; w.board.setTool('pen') })
  await gesture(page, wave(300, 300, 40, 30, 8), { type: 'pen', pressure: 0.6 })
  await open()
  await page.getByRole('button', { name: 'Save this page' }).click()
  await page.waitForSelector('.shelf-preview')
  check('a page offers its own name', await page.locator('.new-lesson-card input').first().inputValue() === 'Graph worksheet')
  await page.getByRole('button', { name: 'Save to shelf' }).click()
  await page.waitForFunction(() => !document.querySelector('.new-lesson-card'))

  await fw(page, w => w.lessonState.lesson.newLesson({ name: 'Third lesson', subject: '', kind: 'notebook' }))
  await page.waitForFunction(() => window.__fw.board.doc.items.length === 0)
  const before = await fw(page, w => w.S.pageCount.value)
  await open()
  await shot('shelf-several')
  await card('Graph worksheet').click()
  await page.waitForFunction(() => window.__fw.board.doc.items.length === 1)
  const saved = await fw(page, w => ({ grid: w.S.grid.value, bg: w.S.bgColor.value, title: w.board.titleOf(w.board.page), extent: w.board.pageFrame.extent, pages: w.S.pageCount.value }))
  check('a saved page looks as it did: paper, colour, name, length', saved.grid === 'graph' && saved.bg === '#fdf6e3' && saved.title === 'Graph worksheet' && saved.extent === 2, JSON.stringify(saved))
  check('on a blank first page it takes that page’s place', saved.pages === before, JSON.stringify(saved))
  await shot('page-inserted')
  await fw(page, w => w.board.undo())
  const undone = await fw(page, w => ({ grid: w.S.grid.value, items: w.board.doc.items.length, pages: w.S.pageCount.value }))
  check('Undo takes the saved page away again', undone.items === 0 && undone.grid === 'none' && undone.pages === before, JSON.stringify(undone))
  await fw(page, w => w.board.addPage())
  await fw(page, w => { w.S.penColor.value = '#111827'; w.board.setTool('pen') })
  await gesture(page, wave(300, 300, 20, 30, 8), { type: 'pen', pressure: 0.6 })
  const pagesBefore = await fw(page, w => w.S.pageCount.value)
  await open()
  await card('Graph worksheet').click()
  await page.waitForFunction((n) => window.__fw.S.pageCount.value === n + 1, pagesBefore)
  check('after a page with writing it goes on a new page, leaving that page alone', await fw(page, w => w.board.page) === pagesBefore)

  // ── on a canvas: the next frame ────────────────────────────────────────────
  await fw(page, w => w.lessonState.lesson.newLesson({ name: 'Canvas lesson', subject: '', kind: 'canvas' }))
  await page.waitForFunction(() => window.__fw.S.kind.value === 'canvas' && window.__fw.board.doc.items.length === 0)
  await open()
  check('a canvas with no frame offers what is on screen', await page.getByRole('button', { name: 'Save what’s on screen' }).count() === 1)
  await card('Graph worksheet').click()
  await page.waitForFunction(() => window.__fw.board.doc.items.length === 1)
  const frame = await fw(page, w => ({ frames: w.S.frameCount.value, index: w.S.frameIndex.value, bg: w.S.bgColor.value, here: w.S.grid.value, inside: (() => { const f = w.board.frames[0]; const b = w.board.doc.bounds(); return b[0] >= f.x && b[2] <= f.x + 1600 })() }))
  check('on a canvas a saved page becomes the next frame, with its look', frame.frames === 1 && frame.index === 0 && frame.inside, JSON.stringify(frame))
  await fw(page, w => w.board.undo())
  const cleared = await fw(page, w => ({ frames: w.S.frameCount.value, items: w.board.doc.items.length }))
  check('Undo takes the frame and its objects away together', cleared.frames === 0 && cleared.items === 0, JSON.stringify(cleared))

  // ── rename, subject, delete ────────────────────────────────────────────────
  await open()
  await page.getByRole('button', { name: 'More for Red picture' }).click()
  await page.locator('.lesson-actions').getByRole('button', { name: 'Rename' }).click()
  await page.locator('.shelf-card .card-input').fill('Red rectangle')
  await page.locator('.shelf-card .card-input').press('Enter')
  await page.waitForFunction(() => document.querySelector('[aria-label="Use Red rectangle"]'))
  check('rename shows at once', await card('Red rectangle').count() === 1)
  await page.getByRole('button', { name: 'More for Red rectangle' }).click()
  await page.locator('.lesson-actions').getByRole('button', { name: 'Subject' }).click()
  await page.locator('.shelf-card .card-input').fill('Maths')
  await page.locator('.shelf-card .card-input').press('Enter')
  await page.waitForFunction(() => [...document.querySelectorAll('.library-group h2')].some(h => h.textContent.includes('Maths')))
  check('items are filed under their subject', true)
  await shot('shelf-groups')

  // ── carry it to another PC ─────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Save shelf to a file' }).click()
  for (let i = 0; i < 30 && !existsSync(shelfFile); i++) await page.waitForTimeout(100)
  check('the whole shelf saves to one file', existsSync(shelfFile))

  await page.getByRole('button', { name: 'More for Red rectangle' }).click()
  await page.locator('.lesson-actions').getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await page.waitForFunction(() => !document.querySelector('[aria-label="Use Red rectangle"]'))
  const dir = join(userData, 'shelf')
  check('delete goes through the Recycle Bin path, as one folder', readdirSync(dir).some(n => n.endsWith('.binned')))

  // ── after a restart ────────────────────────────────────────────────────────
  await app.close()
  ;({ app, page, logs } = await launch({ userData }))
  await stub()
  await open()
  check('after a restart the shelf is still there', await card('Wave diagram').count() === 1 && await card('Graph worksheet').count() === 1 && await card('Red rectangle').count() === 0)
  check('saved items show their pictures', await page.locator('.shelf-card img').first().evaluate(el => el.naturalWidth > 0))
  await page.getByRole('button', { name: 'Add from a file' }).click()
  await page.waitForFunction(() => document.querySelector('[aria-label="Use Red rectangle"]'))
  const count = await page.locator('.shelf-card').count()
  check('adding from a file brings back only what is missing', count === 3, String(count))
  await shot('after-import')

  // ── the dark board keeps it readable ───────────────────────────────────────
  await fw(page, w => { w.S.popover.value = null; w.board.setColor('#1d3b33') })
  await open()
  await shot('shelf-dark')

  // ── the laptop layout reaches it too ───────────────────────────────────────
  await app.close()
  ;({ app, page, logs } = await launch({ userData: undefined }))
  await fw(page, w => { w.S.popover.value = 'insert' })
  await page.getByRole('button', { name: /My shelf/ }).click()
  await page.waitForSelector('.library .shelf-empty')
  check('the laptop Insert menu opens the shelf', true)
  await shot('laptop')

  check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.join(' | '))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
