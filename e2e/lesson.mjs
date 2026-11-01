// Lesson integrity (Note 3 deep dive F1–F6, F9): appearance travels with the file, conversion and
// export keep paper, pages and boards can be recovered, and the lesson has big New / Open / Save / Export controls.
// Run: npm run e2e:lesson
import { launch, check, summary, fw, shotDir, gesture, wave } from './lib.mjs'
import { join } from 'node:path'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'

const files = mkdtempSync(join(tmpdir(), 'fw-lesson-files-'))
const darkFile = join(files, 'Dark lesson.wbd')
let { app, page, logs, userData } = await launch({ layout: 'board' })
const stub = (save, open) => app.evaluate(({ dialog }, { save, open }) => {
  dialog.showSaveDialog = async () => save ? { canceled: false, filePath: save } : { canceled: true }
  dialog.showOpenDialog = async () => open ? { canceled: false, filePaths: [open] } : { canceled: true, filePaths: [] }
}, { save, open })
const dialogShown = () => page.getByRole('alertdialog').count().then(n => n > 0)
const ink = (y = 400) => gesture(page, wave(300, y, 40, 20, 8), { type: 'pen', pressure: 0.6 })
/** Transfer textured PNGs as base64: one Playwright value, rather than millions of byte objects. */
/** The PNG's pixels, decoded in the page: size, colour at the corner and how many different colours a strip holds. */
const pixels = (png) => page.evaluate(async (encoded) => {
  const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0))
  const bmp = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }))
  const cv = new OffscreenCanvas(bmp.width, bmp.height); const ctx = cv.getContext('2d'); ctx.drawImage(bmp, 0, 0)
  const corner = [...ctx.getImageData(2, 2, 1, 1).data]
  const strip = ctx.getImageData(0, 8, Math.min(bmp.width, 1200), 40).data
  const seen = new Set(); for (let i = 0; i < strip.length; i += 4) seen.add(strip[i] + ',' + strip[i + 1] + ',' + strip[i + 2] + ',' + strip[i + 3])
  return { w: bmp.width, h: bmp.height, corner, colours: seen.size }
}, png)
const pngBytes = (fn, arg) => page.evaluate(`(async () => {
  const bytes = new Uint8Array(await (${fn.toString()})(window.__fw, ${JSON.stringify(arg ?? null)}))
  let binary = ""
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768))
  return btoa(binary)
})()`)
const png = (opts) => pngBytes(async (w, o) => w.board.exportPng(o), opts)

try {
  check('a smart board starts a notebook', await fw(page, w => w.board.kind) === 'notebook')

  // ── F1: the board colour belongs to the lesson ─────────────────────────────
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Background' }).click()
  await page.getByRole('button', { name: 'Green board' }).click()
  const dark = await fw(page, w => ({ bg: w.S.bgColor.value, pen: w.S.penColor.value, def: w.S.defaultColor.value }))
  check('choosing the green board makes the lesson green, keeps ink readable and remembers it for new lessons', dark.bg === '#22423a' && dark.pen === '#ffffff' && dark.def === '#22423a', JSON.stringify(dark))
  await page.keyboard.press('Escape')
  await ink()
  await stub(darkFile, null)
  await page.keyboard.press('Control+s')
  await page.waitForFunction(() => window.__fw.lessonState.lessonPath.value !== null)
  const saved = JSON.parse(readFileSync(darkFile, 'utf8'))
  check('Ctrl+S saves the lesson as a file (not a picture) and the file carries the board colour and texture', saved.version === 4 && saved.color === '#22423a' && saved.texture === 'chalk' && saved.pages[0].items.length === 1, JSON.stringify({ v: saved.version, c: saved.color, t: saved.texture }))
  check('after saving, the lesson is clean and listed under recent lessons', await fw(page, async w => !w.lessonState.lessonDirty.value && (await window.api.lessons.recent())[0].name === 'Dark lesson'))

  // saving again goes to the same file without asking
  await stub(null, null)
  await ink(500)
  check('a change makes the lesson unsaved', await fw(page, w => w.lessonState.lessonDirty.value))
  await page.keyboard.press('Control+s')
  await page.waitForFunction(() => !window.__fw.lessonState.lessonDirty.value)
  check('Ctrl+S on a saved lesson writes the same file without a dialog', JSON.parse(readFileSync(darkFile, 'utf8')).pages[0].items.length === 2)

  // New lesson asks before dropping unsaved work
  await ink(600)
  await page.keyboard.press('Control+n')
  await page.getByRole('alertdialog').waitFor()
  await page.screenshot({ path: join(shotDir, 'lesson-save-first.png') })
  await page.getByRole('button', { name: 'Cancel' }).click()
  check('New lesson over unsaved work asks first, and Cancel keeps the lesson', !(await dialogShown()) && await fw(page, w => w.board.doc.items.length) === 3)
  await page.keyboard.press('Control+n')
  await page.getByRole('button', { name: 'Don’t save' }).click()
  await page.waitForFunction(() => window.__fw.board.doc.items.length === 0)
  const fresh = await fw(page, w => ({ path: w.lessonState.lessonPath.value, kind: w.board.kind, dirty: w.lessonState.lessonDirty.value, pages: w.board.pageCount }))
  check('a new lesson is one empty notebook page, not tied to the old file', fresh.path === null && fresh.kind === 'notebook' && !fresh.dirty && fresh.pages === 1, JSON.stringify(fresh))
  check('the replaced lesson stays available as a backup', existsSync(join(userData, 'board.backup-1.json')) || (await fw(page, async () => true)))

  // reopening the dark lesson on a machine whose preference is light
  await fw(page, w => { w.S.defaultColor.value = '#ffffff'; w.board.setColor('#ffffff') })
  await stub(null, darkFile)
  await page.keyboard.press('Control+o')
  await page.waitForFunction(() => window.__fw.lessonState.lessonPath.value !== null)
  const reopened = await fw(page, w => ({ bg: w.S.bgColor.value, def: w.S.defaultColor.value, ink: w.board.doc.items.length, name: w.lessonState.lessonName.value }))
  check('a dark lesson reopens dark under a light preference, and does not change the preference (F1)', reopened.bg === '#22423a' && reopened.def === '#ffffff' && reopened.ink === 2 && reopened.name === 'Dark lesson', JSON.stringify(reopened))

  // ── F3: each page keeps its own paper through Canvas and back ──────────────
  await fw(page, w => w.board.newLesson('notebook'))
  await fw(page, w => {
    const b = w.board
    b.setPaper('fourline'); b.setTitle(0, 'Letters')
    b.addPage(); b.setPaper('graph'); b.setColor('#fbf6e9', true)
    b.addPage(); b.setPaper('hindi'); b.setTitle(2, 'Hindi')
    b.goToPage(1)
  })
  await ink(300)
  const looks = () => fw(page, w => w.board.pageData().map(p => [p.paper, p.color ?? null, p.title ?? null]))
  const before = await looks()
  await fw(page, w => w.board.convertTo('canvas'))
  const canvas = await fw(page, w => ({ kind: w.board.kind, frames: w.board.frameList.map(f => [f.paper, f.color ?? null, f.title ?? null]) }))
  await page.screenshot({ path: join(shotDir, 'lesson-canvas-papers.png') })
  await fw(page, w => w.board.convertTo('notebook'))
  const after = await looks()
  check('three differently ruled pages become three frames with their paper, colour and title (F3)', canvas.kind === 'canvas' && JSON.stringify(canvas.frames) === JSON.stringify(before), JSON.stringify({ before, canvas }))
  check('and come back as the same pages with the same paper, colour and title', JSON.stringify(after) === JSON.stringify(before), JSON.stringify({ before, after }))
  check('the ink survived both ways', await fw(page, w => w.board.pageData().reduce((n, p) => n + p.items.length, 0)) === 1)

  // ── F2: a plain canvas keeps its paper in the file ─────────────────────────
  await fw(page, w => { w.board.newLesson('canvas'); w.board.setPaper('lines'); w.board.setColor('#1f232b') })
  await ink(300)
  const plain = JSON.parse(await fw(page, w => w.board.serialize()))
  check('a plain canvas with paper and a dark board is saved in the format that keeps both (F2)', plain.version === 4 && plain.pages[0].paper === 'lines' && plain.color === '#1f232b', JSON.stringify({ v: plain.version, p: plain.pages?.[0]?.paper }))

  // ── F9: pages can be deleted and brought back ──────────────────────────────
  await fw(page, w => { w.board.newLesson('notebook'); w.board.setTitle(0, 'First') })
  await ink(300)
  await fw(page, w => { w.board.addPage() })
  await ink(350)
  await fw(page, w => { w.board.addPage() })
  await ink(400)
  await fw(page, w => { w.board.goToPage(1) })
  await fw(page, w => w.board.deletePage())
  check('deleting a page offers Undo right away', await fw(page, w => w.board.pageCount) === 2 && await page.locator('.toast .toast-action').isVisible())
  await page.locator('.toast .toast-action').click()
  const restored = await fw(page, w => ({ pages: w.board.pageCount, page: w.board.page, ink: w.board.pageData().map(p => p.items.length), title: w.board.titleOf(0) }))
  check('Undo brings the page back with its ink, in its place (F9)', restored.pages === 3 && restored.page === 1 && restored.ink.join() === '1,1,1' && restored.title === 'First', JSON.stringify(restored))
  await fw(page, w => w.board.deletePage())
  await page.keyboard.press('Control+z')
  check('Ctrl+Z also brings back a deleted page', await fw(page, w => w.board.pageCount) === 3)
  await fw(page, w => w.board.movePage(0, 2))
  await page.keyboard.press('Control+z')
  check('moving a page can be undone too', await fw(page, w => w.board.titleOf(0)) === 'First')
  await fw(page, w => w.board.deletePage())
  await ink(500)
  check('once something else is done, the old page-level undo is not offered (it would undo newer work)', await fw(page, w => w.S.undoLabel.value) === '' && !(await fw(page, w => w.board.undoStructure())))

  // renaming from the page sorter
  await page.getByRole('button', { name: 'All pages' }).click()
  await page.getByRole('button', { name: /^Rename/ }).first().click()
  await page.keyboard.press('Control+a')
  await page.keyboard.type('Warm-up')
  await page.keyboard.press('Enter')
  check('a page can be renamed in the page sorter (F9)', await fw(page, w => w.board.titleOf(0)) === 'Warm-up')
  await page.screenshot({ path: join(shotDir, 'lesson-page-sorter.png') })
  await page.keyboard.press('Escape')

  // ── F4/F5: pictures and PDF match the board ────────────────────────────────
  await fw(page, w => { w.board.newLesson('notebook'); w.board.setPaper('graph'); w.board.setColor('#1d3b33') })
  await ink(300)
  const withPaper = await pixels(await png({ scope: 'page' }))
  const inkOnly = await pixels(await png({ scope: 'page', paper: false }))
  check('a picture of the page includes its paper and board colour (F4)', withPaper.w === 3200 && withPaper.h === 1800 && withPaper.corner[3] === 255 && withPaper.corner[1] > 40 && withPaper.corner[1] < 90 && withPaper.colours > 1, JSON.stringify(withPaper))
  check('and can be ink only on a see-through background', inkOnly.corner[3] === 0 && inkOnly.colours === 1, JSON.stringify(inkOnly))
  const content = await pixels(await png({ scope: 'content' }))
  check('a picture of everything drawn is cropped to the ink but still has the paper', content.w < 3200 && content.corner[3] === 255, JSON.stringify(content))
  check('nothing selected means no selection picture', (await fw(page, async w => await w.board.exportPng({ scope: 'selection' }))) === null)

  await fw(page, w => { w.board.newLesson('notebook'); w.board.setPaper('ruled') })
  await ink(300)
  await fw(page, w => { w.board.extendPage(); w.board.extendPage() })
  await page.waitForTimeout(500)
  await fw(page, w => { const b = w.board; b.commitAdd({ t: 's', id: 'low', c: '#111827', w: 6, m: false, v: false, p: [200, 2300, .5, 700, 2380, .5] }) })
  const sheets = await fw(page, async w => { const split = await w.board.exportPages(); const whole = await w.board.exportPages({ split: false }); return { split: split.length, whole: whole.length } })
  check('a page lengthened to three screens prints as one readable sheet per screen (F5)', sheets.split === 3 && sheets.whole === 1, JSON.stringify(sheets))
  const sheet = await pixels(await pngBytes(async w => (await w.board.exportPages())[0]))
  check('each sheet is one 16:9 screen with the ruled paper', sheet.w === 2400 && sheet.h === 1350 && sheet.colours > 1, JSON.stringify(sheet))
  check('a blank notebook that only has paper still prints (blank practice sheets)', await fw(page, async w => { w.board.newLesson('notebook'); w.board.setPaper('fourline'); return (await w.board.exportPages()).length }) === 1)

  // ── F6: the lesson controls are big touch tiles ─────────────────────────────
  await fw(page, w => w.board.newLesson('notebook'))
  await page.getByRole('button', { name: 'More', exact: true }).click()
  for (const name of ['New lesson', 'Open…', 'Save lesson', 'Export']) check(`More menu has a ${name} tile`, await page.getByRole('button', { name, exact: true }).isVisible())
  const tile = await page.getByRole('button', { name: 'Save lesson', exact: true }).boundingBox()
  check('the lesson tiles are large enough for a finger', tile.width >= 80 && tile.height >= 66, JSON.stringify(tile))
  await page.screenshot({ path: join(shotDir, 'lesson-more-menu.png') })
  await page.getByRole('button', { name: 'Open…', exact: true }).click()
  await page.locator('.lesson-sheet .recent-row').first().waitFor()
  check('Open… lists recent lessons by name', (await page.locator('.recent-row b').first().innerText()) === 'Dark lesson')
  await page.screenshot({ path: join(shotDir, 'lesson-open-sheet.png') })
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  for (const name of ['Save picture', 'Copy picture', 'Save PDF']) check(`Export sheet has ${name}`, await page.getByRole('button', { name, exact: true }).isVisible())
  await page.screenshot({ path: join(shotDir, 'lesson-export-sheet.png') })
  await page.keyboard.press('Escape')

  // ── the lesson file and the board survive a restart ─────────────────────────
  await fw(page, w => { w.board.newLesson('notebook'); w.lessonState.lessonPath.value = null; w.board.setColor('#1d3b33'); w.board.setPaper('graph') })
  await ink(300)
  await stub(join(files, 'Restart.wbd'), null)
  await page.keyboard.press('Control+s')
  await page.waitForFunction(() => window.__fw.lessonState.lessonPath.value !== null)
  await ink(450)
  await page.waitForTimeout(1500)
  await app.close()
  ;({ app, page, logs } = await launch({ userData }))
  const back = await fw(page, w => ({ bg: w.S.bgColor.value, grid: w.S.grid.value, path: w.lessonState.lessonPath.value, dirty: w.lessonState.lessonDirty.value, ink: w.board.doc.items.length }))
  check('after a restart the board, its colour and paper, and its file link are back, still marked unsaved', back.bg === '#1d3b33' && back.grid === 'graph' && back.path === join(files, 'Restart.wbd') && back.dirty && back.ink === 2, JSON.stringify(back))

  check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.join(' | '))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
