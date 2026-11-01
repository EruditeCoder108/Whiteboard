// Prepared reveals (Note 3 deep dive §8.4): hide objects until their step, one big Next button, kept in the lesson.
// Run: npm run e2e:reveals
import { launch, check, summary, fw, shotDir, gesture } from './lib.mjs'
import { join } from 'node:path'

const { app, page, logs } = await launch({ layout: 'board' })
const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: join(shotDir, `reveals-${name}.png`) }) }
const add = (id, x, y, fill = '#fff2a8') => fw(page, (w, { id, x, y, fill }) => {
  const before = w.board.doc.snapshot()
  w.board.doc.replaceAll([...w.board.doc.items, { t: 't', id, c: '#172033', w: 1, p: [x, y, x + 320, y + 120], text: id, fontSize: 40, note: true, fill }])
  w.board.commit(w.board.doc.diff(before)); w.board.refresh(null)
}, { id, x, y, fill })
const select = (...ids) => fw(page, (w, ids) => { w.board.setTool('select'); w.board.setSelection(w.board.doc.items.filter(it => ids.includes(it.id))) }, ids)
const item = (id) => fw(page, (w, id) => w.board.doc.items.find(it => it.id === id), id)
const screen = ([x, y]) => fw(page, (w, [x, y]) => { const v = w.board.view; return [(x - v.x) * v.zoom, (y - v.y) * v.zoom] }, [x, y])
/** The colour on the board at a world point. */
const pixel = async (x, y) => {
  const [sx, sy] = await screen([x, y])
  const png = await page.screenshot({ clip: { x: Math.round(sx), y: Math.round(sy), width: 1, height: 1 } })
  return page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'image/png' }))
    const cv = new OffscreenCanvas(1, 1), c = cv.getContext('2d'); c.drawImage(bmp, 0, 0)
    return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3).join()
  }, png.toString('base64'))
}
const WHITE = '255,255,255'
const panel = async () => { await page.getByRole('button', { name: 'Hide for class' }).click(); await page.waitForSelector('.reveal-options') }
const next = () => page.locator('.reveal-next')

try {
  // ── preparing ──────────────────────────────────────────────────────────────
  await add('Question', 100, 100); await add('Hint', 100, 300); await add('Answer', 100, 500); await add('Card', 900, 300)
  await select('Hint')
  await panel()
  await shot('panel')
  await page.locator('.reveal-chips .chip', { hasText: 'Step 1' }).click()
  check('hiding an object puts it in a step', (await item('Hint')).step?.n === 1)
  check('and starts preparing, so the teacher can still see it', await fw(page, w => w.S.preparing.value))
  await page.locator('.reveal-options .chip', { hasText: 'Hint' }).click()
  check('a step can be given a name', (await item('Hint')).step?.name === 'Hint')
  await select('Answer')
  await panel()
  await page.locator('.reveal-chips .chip', { hasText: 'A new step' }).click()
  await page.locator('.reveal-options .chip', { hasText: 'Answer' }).click()
  check('the next one goes in a new step', (await item('Answer')).step?.n === 2 && (await item('Answer')).step?.name === 'Answer')
  await select('Card')
  await panel()
  await page.locator('.reveal-chips .chip', { hasText: 'A new step' }).click()
  await page.locator('.reveal-cover button').click()
  check('a step can show a card to tap', (await item('Card')).step?.cover === true && (await item('Card')).step?.n === 3)
  await fw(page, w => w.board.setSelection([]))
  await shot('preparing')
  check('while preparing a hidden object is faded, not gone', await pixel(250, 340) !== WHITE)

  // ── in class ───────────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Done' }).click()
  check('Done ends preparing', !(await fw(page, w => w.S.preparing.value)))
  await shot('class')
  check('in class the hidden object is not there', await pixel(250, 340) === WHITE, await pixel(250, 340))
  check('what is not hidden stays', await pixel(250, 140) !== WHITE)
  check('a card shows where one was asked for', await pixel(1050, 340) !== WHITE)
  check('the big button names the next step', (await next().textContent()).includes('Next: Hint'))
  const [hx, hy] = await screen([250, 340])
  await fw(page, w => w.board.setTool('select'))
  await gesture(page, [[hx, hy]])
  check('a hidden object cannot be selected by accident', await fw(page, w => w.board.selection.length) === 0)
  await fw(page, w => w.board.selectAll())
  check('nor by Select all', (await fw(page, w => w.board.selection.map(it => it.id))).join() === 'Question')
  await fw(page, w => w.board.setSelection([]))

  await next().click()
  await page.waitForTimeout(100)
  check('Next shows the first step', (await item('Hint')).step.shown === true && await pixel(250, 340) !== WHITE)
  check('and the button moves on', (await next().textContent()).includes('Next: Answer'))
  await fw(page, w => w.board.undo())
  check('Undo hides it again', !(await item('Hint')).step.shown)
  await fw(page, w => w.board.redo())

  // ── a clicker's Page Down goes through the steps before the page turns ──────
  await page.keyboard.press('PageDown')
  check('Page Down shows the next step instead of turning the page', (await item('Answer')).step.shown === true && await fw(page, w => w.S.page.value) === 0)
  await shot('after-next')

  // ── a card, tapped with the pen in hand ─────────────────────────────────────
  await fw(page, w => { w.S.penColor.value = '#e5484d'; w.board.setTool('pen') })
  const count = await fw(page, w => w.board.doc.items.length)
  const [cx, cy] = await screen([1050, 340])
  await gesture(page, [[cx, cy], [cx + 2, cy + 2]], { type: 'pen', pressure: .5 })
  check('tapping a card shows what it hides, even holding the pen', (await item('Card')).step.shown === true)
  check('and leaves no ink behind', await fw(page, w => w.board.doc.items.length) === count)
  check('nothing left to show: the Next button goes', await next().count() === 0)

  // ── in the lesson ──────────────────────────────────────────────────────────
  const reopened = await fw(page, w => {
    w.board.load(w.board.serialize(), { undoable: false })
    return w.board.doc.items.filter(it => it.step).map(it => [it.id, it.step.n, !!it.step.shown])
  })
  check('what has been shown is kept in the saved lesson', reopened.every(r => r[2]) && reopened.length === 3, JSON.stringify(reopened))
  await page.getByRole('button', { name: 'Hide again' }).click()
  check('Hide again gets the lesson ready for the next class', (await fw(page, w => w.board.doc.items.filter(it => it.step?.shown).length)) === 0)
  check('with one Undo to bring them back', await fw(page, w => { w.board.undo(); const n = w.board.doc.items.filter(it => it.step?.shown).length; w.board.redo(); return n }) === 3)

  const [fx, fy] = await screen([1050, 340])
  await gesture(page, [[fx, fy]], { type: 'touch' })
  check('a finger opens a card too', (await item('Card')).step.shown === true)
  await page.getByRole('button', { name: 'Hide again' }).click()

  // ── output ─────────────────────────────────────────────────────────────────
  const size = (show) => fw(page, async (w, show) => {
    const png = await w.board.exportPng({ scope: 'page', hidden: show ? 'show' : 'keep' })
    const bmp = await createImageBitmap(new Blob([png], { type: 'image/png' }))
    const cv = new OffscreenCanvas(bmp.width, bmp.height), c = cv.getContext('2d'); c.drawImage(bmp, 0, 0)
    const k = bmp.width / 1600, d = c.getImageData(250 * k, 340 * k, 1, 1).data
    return [...d].slice(0, 3).join()
  }, show)
  check('a picture keeps hidden answers hidden', await size(false) === WHITE, await size(false))
  check('or shows them all when asked', await size(true) !== WHITE, await size(true))
  await fw(page, w => { w.S.popover.value = 'export' })
  await page.waitForSelector('.export-sheet')
  check('the export sheet offers the choice', await page.getByText('Include hidden answers').count() === 1)
  await shot('export')
  await fw(page, w => { w.S.popover.value = null })
  check('a page never turns up its hidden objects in class even after a screen repaint', await fw(page, w => { w.board.refresh(null); return true }) && await pixel(250, 340) === WHITE)

  // ── copies and pages ───────────────────────────────────────────────────────
  await fw(page, w => w.board.duplicatePage())
  check('a copied page keeps its steps', (await fw(page, w => w.board.doc.items.filter(it => it.step).length)) === 3)
  await page.keyboard.press('PageDown')
  check('steps belong to the page on screen', (await fw(page, w => w.board.doc.items.filter(it => it.step?.shown).length)) === 1)
  await fw(page, w => w.board.addPage())
  check('a page with no steps has no button', await next().count() === 0 && await page.locator('.reveal-bar').count() === 0)
  await page.keyboard.press('PageUp')
  check('and Page Up still turns pages', await fw(page, w => w.S.page.value) === 1)

  // ── on a canvas each frame has its own steps ───────────────────────────────
  await fw(page, w => w.board.convertTo('canvas'))
  const first = await fw(page, w => { w.board.goToFrame(1, false); return w.board.revealSteps().length })
  check('on a canvas the frame in view has its own steps', first === 3, String(first))

  check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.join(' | '))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
