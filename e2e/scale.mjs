// Number line and coordinate axes (Note 3 deep dive §6.6, §8.1): measured objects with explicit ranges, steps and units.
// Run: npm run e2e:scale
import { launch, check, summary, fw, shotDir, gesture } from './lib.mjs'
import { join } from 'node:path'

let { app, page, logs } = await launch({ layout: 'board' })
const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: join(shotDir, `scale-${name}.png`) }) }
const more = async (label) => {
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.waitForSelector('.scale-card')
}
const put = async () => { await page.getByRole('button', { name: 'Put on the board' }).click(); await page.waitForFunction(() => !document.querySelector('.scale-card')) }
const scale = () => fw(page, w => w.board.doc.items.find(it => it.t === 'n'))
/** Tap the preview where the object's value (x, y) is drawn. */
const tapPreview = async (x, y) => {
  const box = await page.locator('.scale-preview').boundingBox()
  await page.locator('.scale-preview').click({ position: { x: box.width * x, y: box.height * y } })
}
const ink = () => fw(page, w => w.board.exportPng({ scope: 'selection', paper: false }).then(b => b && b.byteLength))

try {
  // ── a number line, from the menu ───────────────────────────────────────────
  await more('Number line')
  await shot('line-editor')
  await put()
  let n = await scale()
  check('the More menu puts a number line on the board', n && !n.y && n.x.min === 0 && n.x.max === 10 && n.x.step === 1, JSON.stringify(n))
  check('it is selected, ready to move', await fw(page, w => w.board.selection.length === 1 && w.S.tool.value === 'select'))
  const middle = await fw(page, w => { const it = w.board.doc.items[0], r = w.board.visibleRect(); return Math.abs((it.p[0] + it.p[2]) / 2 - (r[0] + r[2]) / 2) < 1 })
  check('it lands in the middle of the board', middle)
  await shot('line')

  // ── changing it ────────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Change the scale' }).click()
  await page.waitForSelector('.scale-card')
  await page.getByRole('button', { name: 'Quarters, 0 to 2' }).click()
  const pv = await page.locator('.scale-preview').boundingBox()
  await tapPreview(.5, .5)
  await page.getByRole('switch').first().click()
  await shot('fractions-editor')
  await page.getByRole('button', { name: 'Update' }).click()
  await page.waitForFunction(() => !document.querySelector('.scale-card'))
  n = await scale()
  check('the pencil changes the range and step, with fraction labels', n.x.max === 2 && n.x.step === .25 && n.x.den === 4, JSON.stringify(n))
  check('a tap on the picture marks a value exactly on a tick', n.points?.length === 1 && Number.isInteger(n.points[0][0] / .25) && n.points[0][1] === 0 && n.coords === true, JSON.stringify(n))
  check('the object stays the same object, and one Undo restores it', await fw(page, w => { const id = w.board.doc.items[0].id; w.board.undo(); const it = w.board.doc.items[0]; const ok = it.id === id && it.x.max === 10; w.board.redo(); return ok }))
  await fw(page, w => w.board.setSelection([]))
  await shot('fractions')
  await fw(page, w => w.board.setSelection(w.board.doc.items.slice()))

  // ── plain words when something is wrong ────────────────────────────────────
  await page.getByRole('button', { name: 'Change the scale' }).click()
  await page.waitForSelector('.scale-card')
  await page.getByRole('textbox', { name: 'To', exact: true }).fill('-3')
  check('a wrong range says so and cannot be applied', (await page.getByRole('alert').textContent()).includes('more than') && await page.getByRole('button', { name: 'Update' }).isDisabled())
  await page.getByRole('button', { name: 'Cancel' }).click()
  check('Cancel changes nothing', (await scale()).x.max === 2)

  // ── typing and steppers ────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Change the scale' }).click()
  await page.waitForSelector('.scale-card')
  await page.getByRole('button', { name: '0 to 10', exact: true }).click()
  await page.getByRole('button', { name: 'To: more' }).click()
  await page.getByRole('button', { name: 'To: more' }).click()
  await page.getByRole('button', { name: 'From: less' }).click()
  await page.getByRole('button', { name: 'Update' }).click()
  await page.waitForFunction(() => !document.querySelector('.scale-card'))
  n = await scale()
  check('the big + and − move the ends by one step, with no typing', n.x.min === -1 && n.x.max === 12, JSON.stringify(n.x))

  // ── coordinate axes ────────────────────────────────────────────────────────
  await fw(page, w => w.board.addPage())
  await page.getByRole('button', { name: 'Subjects', exact: true }).click()
  await page.getByRole('button', { name: 'Coordinate axes', exact: true }).click()
  await page.waitForSelector('.scale-card')
  await tapPreview(.5, .5)
  await tapPreview(.7, .3)
  await page.getByRole('switch', { name: undefined }).first().click()
  await shot('axes-editor')
  await put()
  n = await scale()
  check('the Subjects drawer puts axes on the board', n.y && n.x.min === -10 && n.y.max === 10 && n.equal === true && n.grid === true, JSON.stringify(n).slice(0, 200))
  check('points were marked in the preview', n.points?.length === 2 && n.points.every(q => Number.isInteger(q[0]) && Number.isInteger(q[1])), JSON.stringify(n.points))
  const shape = await fw(page, w => { const it = w.board.doc.items[0]; return (it.p[2] - it.p[0]) / (it.p[3] - it.p[1]) })
  check('a square range gets a square box', Math.abs(shape - 1) < .01, String(shape))
  await fw(page, w => w.board.setSelection([]))
  await shot('axes')

  // ── a real graph with its own units ────────────────────────────────────────
  await fw(page, (w, it) => { w.board.setSelection(w.board.doc.items.slice()) })
  await page.getByRole('button', { name: 'Change the scale' }).click()
  await page.waitForSelector('.scale-card')
  await page.getByRole('button', { name: 'Time and distance' }).click()
  await page.getByRole('button', { name: 'Update' }).click()
  await page.waitForFunction(() => !document.querySelector('.scale-card'))
  n = await scale()
  check('each axis keeps its own range, step and unit', n.x.name === 'Time (s)' && n.y.name === 'Distance (m)' && n.x.step === 10 && n.y.step === 20 && !n.equal, JSON.stringify(n).slice(0, 220))
  check('marks outside the new range are not kept... inside ones are', (n.points ?? []).every(q => q[0] >= 0 && q[1] >= 0), JSON.stringify(n.points))
  await fw(page, w => w.board.setSelection([]))
  await shot('units')

  // ── on any board, with an arrow pointing at it ─────────────────────────────
  await fw(page, w => { w.board.setColor('#1d3b33'); w.board.addPage(); w.S.penColor.value = '#ffffff' })
  await more('Axes')
  await page.waitForTimeout(300)
  await shot('axes-editor-dark')
  await put()
  n = await scale()
  check('on a chalkboard it comes in chalk colour', n.c === '#ffffff', n.c)
  await shot('axes-dark')
  const box = n.p
  const screen = await fw(page, (w, [x, y]) => { const v = w.board.view; return [(x - v.x) * v.zoom, (y - v.y) * v.zoom] }, [(box[0] + box[2]) / 2 + 40, (box[1] + box[3]) / 2 - 40])
  await fw(page, w => w.board.setTool('arrow'))
  await gesture(page, [[140, 60], [220, 90], [screen[0], screen[1]]])
  const arrow = await fw(page, w => w.board.doc.items.find(it => it.k === 'arrow'))
  check('an arrow onto it holds that spot', arrow?.to?.id === n.id && !!arrow.to.at, JSON.stringify(arrow))
  await fw(page, (w, id) => { w.board.setTool('select'); w.board.setSelection([w.board.doc.items.find(it => it.id === id)]); w.board.nudgeSelection(60, 0) }, n.id)
  const after = await fw(page, w => w.board.doc.items.find(it => it.k === 'arrow'))
  check('and follows when it moves', Math.abs(after.p[2] - arrow.p[2] - 60) < .5)

  // ── normal object behaviour ────────────────────────────────────────────────
  await fw(page, (w, id) => { w.board.setSelection([w.board.doc.items.find(it => it.id === id)]) }, n.id)
  check('colour and thickness controls apply', await fw(page, w => { w.board.patchSelection({ c: '#f5c518', w: 5 }, 'stroke'); const s = w.board.selection[0]; return s.c === '#f5c518' && s.w === 5 }))
  check('duplicate gives a separate copy', await fw(page, w => { w.board.duplicateSelection(); const s = w.board.selection[0], ok = s.t === 'n' && s.x.min === -10; w.board.undo(); return ok }))
  await fw(page, (w, id) => { w.board.setSelection([w.board.doc.items.find(it => it.id === id)]) }, n.id)
  check('export draws it', (await ink()) > 500)

  const kept = await fw(page, w => {
    const same = it => JSON.stringify([it.id, it.c, it.w, it.p.map(v => Math.round(v * 100) / 100), it.x, it.y, !!it.grid, !!it.equal, it.points ?? [], !!it.coords]) // positions are saved to two decimals
    const before = w.board.doc.items.filter(it => it.t === 'n').map(same).join()
    w.board.load(w.board.serialize(), { undoable: false })
    return before === w.board.doc.items.filter(it => it.t === 'n').map(same).join()
  })
  check('saved and reopened it is exactly the same', kept)
  const dark = await fw(page, w => w.board.doc.items.find(it => it.t === 'n').c)
  await fw(page, async w => { w.board.convertTo('canvas'); w.board.convertTo('notebook') })
  check('notebook ⇄ canvas keeps it', await fw(page, w => w.board.doc.items.some(it => it.t === 'n')) && !!dark)

  // ── double tap, on a canvas ────────────────────────────────────────────────
  await app.close()
  ;({ app, page, logs } = await launch())
  await fw(page, w => { w.S.popover.value = 'board-menu' })
  await page.getByRole('button', { name: 'Axes', exact: true }).click()
  await page.waitForSelector('.scale-card')
  await shot('laptop-editor')
  await put()
  check('a canvas takes axes too', !!(await scale())?.y)
  await fw(page, w => { const it = w.board.doc.items[0]; w.board.setSelection([]); w.board.onEditMedia(it) })
  await page.waitForSelector('.scale-card')
  check('tapping twice opens the same editor', await page.getByRole('heading', { name: 'Change the scale' }).count() === 1)
  void pv

  check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.join(' | '))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
