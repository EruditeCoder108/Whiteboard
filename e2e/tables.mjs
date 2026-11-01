// Tables (Note 3 deep dive §8.3): typed text in rows and columns, behaving like every other object.
// Run: npm run e2e:tables
import { launch, check, summary, fw, shotDir, gesture } from './lib.mjs'
import { join } from 'node:path'

let { app, page, logs } = await launch({ layout: 'board' })
const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: join(shotDir, `tables-${name}.png`) }) }
const table = () => fw(page, w => w.board.doc.items.find(it => it.t === 'b'))
const screen = ([x, y]) => fw(page, (w, [x, y]) => { const v = w.board.view; return [(x - v.x) * v.zoom, (y - v.y) * v.zoom] }, [x, y])
/** Stage px of the middle of a cell. */
const cellPoint = (r, c) => fw(page, (w, [r, c]) => {
  const it = w.board.doc.items.find(i => i.t === 'b'), v = w.board.view
  let x = it.p[0], y = it.p[1]
  for (let i = 0; i < c; i++) x += it.cols[i] * (it.p[2] - it.p[0])
  for (let i = 0; i < r; i++) y += it.rows[i] * (it.p[3] - it.p[1])
  x += it.cols[c] * (it.p[2] - it.p[0]) / 2; y += it.rows[r] * (it.p[3] - it.p[1]) / 2
  return [(x - v.x) * v.zoom, (y - v.y) * v.zoom]
}, [r, c])
const cell = () => page.locator('.table-cell-editor textarea')
const tapCell = async (r, c) => { const p = await cellPoint(r, c); await gesture(page, [p]); await page.waitForTimeout(60) }
const moreMenu = async (name) => {
  const item = page.locator('.selection-detail').getByRole('button', { name: new RegExp('^' + name) }) // the heading row also says on or off
  if (!(await item.count())) await page.getByRole('button', { name: 'More selection actions' }).click() // it stays open for several changes
  await item.click()
}

try {
  // ── choosing a size ────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Table', exact: true }).click()
  await page.waitForSelector('.table-card')
  await shot('chooser')
  await page.getByRole('button', { name: 'More rows' }).click()
  await page.getByRole('button', { name: 'Fewer columns' }).click()
  await page.getByRole('button', { name: 'Put on the board' }).click()
  let t = await table()
  check('the More menu makes a table of the chosen size', t?.rows.length === 4 && t.cols.length === 2 && t.head === true, JSON.stringify(t)?.slice(0, 160))
  check('it is selected, ready to use', await fw(page, w => w.board.selection.length === 1 && w.S.tool.value === 'select'))
  const centred = await fw(page, w => { const it = w.board.doc.items[0], r = w.board.visibleRect(); return Math.abs((it.p[0] + it.p[2]) / 2 - (r[0] + r[2]) / 2) < 1 })
  check('in the middle of the board', centred)

  // ── typing ─────────────────────────────────────────────────────────────────
  await tapCell(0, 0)
  check('tapping a cell of the selected table opens it', await cell().count() === 1)
  await cell().fill('Name')
  await cell().press('Tab')
  await page.waitForTimeout(60)
  check('Tab saves and moves on', (await table()).cells[0][0] === 'Name' && (await cell().getAttribute('aria-label')) === 'Row 1, column 2')
  await cell().fill('क्षेत्रफल')
  await cell().press('Tab')
  await page.waitForTimeout(60)
  await cell().fill('Line one\nLine two')
  await cell().press('Shift+Tab')
  await page.waitForTimeout(60)
  check('Shift+Tab goes back', (await cell().getAttribute('aria-label')) === 'Row 1, column 2')
  check('Enter makes a new line in the cell, and Hindi stays whole', (await table()).cells[1][0] === 'Line one\nLine two' && (await table()).cells[0][1] === 'क्षेत्रफल')
  await cell().press('Escape')
  await page.waitForTimeout(60)
  check('Esc finishes', await cell().count() === 0)
  await shot('typed')
  const undoOne = await fw(page, w => { w.board.undo(); return w.board.doc.items[0].cells[1][0] })
  check('one Undo takes back one finished cell', undoOne === '')
  await fw(page, w => w.board.redo())
  check('Redo brings it back', (await table()).cells[1][0] === 'Line one\nLine two')

  // ── a tap elsewhere finishes ───────────────────────────────────────────────
  await fw(page, w => w.board.setSelection(w.board.doc.items.slice()))
  await tapCell(2, 1)
  await cell().fill('from a tap')
  await gesture(page, [[30, 200]])
  await page.waitForTimeout(100)
  check('a tap elsewhere saves the cell', (await table()).cells[2][1] === 'from a tap' && await cell().count() === 0)

  // ── text never clips ───────────────────────────────────────────────────────
  await fw(page, w => w.board.setSelection(w.board.doc.items.slice()))
  const before = await table()
  await tapCell(3, 0)
  await cell().fill('A much longer piece of text that cannot possibly fit on one line of this column of the table at all, not even close.')
  await cell().press('Escape')
  await page.waitForTimeout(60)
  t = await table()
  check('a row grows for long text, and the table with it', t.p[3] - t.p[1] > before.p[3] - before.p[1] + 20 && t.rows[3] > before.rows[3], JSON.stringify([t.p, t.rows]))
  await shot('long-text')

  // ── changing the shape ─────────────────────────────────────────────────────
  await moreMenu('Add column')
  t = await table()
  check('Add column works', t.cols.length === 3 && t.cells.every(r => r.length === 3))
  await moreMenu('Add row')
  check('Add row works', (await table()).rows.length === 5)
  await moreMenu('Remove row')
  check('Remove row works', (await table()).rows.length === 4)
  await moreMenu('Remove column')
  check('Remove column works', (await table()).cols.length === 2)
  await moreMenu('Heading row')
  check('Heading row switches', !(await table()).head)
  await moreMenu('Heading row')

  // ── dragging a line ────────────────────────────────────────────────────────
  t = await table()
  const line = await screen([t.p[0] + t.cols[0] * (t.p[2] - t.p[0]), t.p[1] + 10])
  await gesture(page, [line, [line[0] + 40, line[1]], [line[0] + 80, line[1]]])
  const dragged = await table()
  check('dragging a line between columns moves just that line', dragged.cols[0] > t.cols[0] && dragged.p[2] === t.p[2], JSON.stringify(dragged.cols))
  await fw(page, w => w.board.undo())
  check('one Undo puts it back', Math.abs((await table()).cols[0] - t.cols[0]) < 1e-6)

  // ── like any other object ──────────────────────────────────────────────────
  const moved = await fw(page, w => { w.board.nudgeSelection(30, 20); return w.board.selection[0].p[0] })
  check('it moves', moved === t.p[0] + 30)
  check('colour and thickness apply', await fw(page, w => { w.board.patchSelection({ c: '#2f6bff', w: 4 }, 'stroke'); const s = w.board.selection[0]; return s.c === '#2f6bff' && s.w === 4 }))
  check('it rotates', await fw(page, w => { w.board.rotateSelection(.2); const a = w.board.selection[0].angle; w.board.undo(); return Math.abs(a - .2) < 1e-6 }))
  check('it locks', await fw(page, w => { w.board.toggleLockSelection(); const l = w.board.selection[0].locked; w.board.toggleLockSelection(); return l === true }))
  const copy = await fw(page, w => { const id = w.board.selection[0].id; w.board.duplicateSelection(); const s = w.board.selection[0], ok = s.t === 'b' && s.id !== id && s.cells[0][0] === 'Name'; w.board.undo(); w.board.setSelection(w.board.doc.items.slice()); return ok })
  check('it copies with its text', copy)
  const reopened = await fw(page, w => {
    const was = w.board.doc.items[0]
    w.board.load(w.board.serialize(), { undoable: false })
    const it = w.board.doc.items[0]
    return JSON.stringify(it.cells) === JSON.stringify(was.cells) && it.head === was.head && it.cols.length === was.cols.length
  })
  check('saved and reopened it is the same', reopened)
  const png = await fw(page, async w => { const b = await w.board.exportPng({ scope: 'content', paper: false }); return b.byteLength })
  check('it comes out in a picture', png > 1000, String(png))
  check('and in a PDF', await fw(page, async w => (await w.board.exportPages()).length) >= 1)
  const conv = await fw(page, w => { w.board.convertTo('canvas'); const a = w.board.doc.items.some(i => i.t === 'b'); w.board.convertTo('notebook'); return a && w.board.doc.items.some(i => i.t === 'b') })
  check('notebook ⇄ canvas keeps it', conv)

  // ── arrows, reveals and My shelf ───────────────────────────────────────────
  const arrow = await fw(page, w => {
    const it = w.board.doc.items.find(i => i.t === 'b')
    return [it.p[2] + 120, (it.p[1] + it.p[3]) / 2, it.p[2] - 20, (it.p[1] + it.p[3]) / 2]
  })
  await fw(page, w => { w.board.setSelection([]); w.board.setTool('arrow') })
  const a = await screen([arrow[0], arrow[1]]), b = await screen([arrow[2], arrow[3]])
  await gesture(page, [a, [(a[0] + b[0]) / 2, a[1]], b])
  const held = await fw(page, w => { const c = w.board.doc.items.find(i => i.k === 'arrow'), it = w.board.doc.items.find(i => i.t === 'b'); return { to: c?.to?.id === it.id, outside: c?.p[2] > it.p[2] } })
  check('an arrow attaches to its edge', held.to && held.outside, JSON.stringify(held))
  await fw(page, w => { w.board.setTool('select'); w.board.setSelection(w.board.doc.items.filter(i => i.t === 'b')) })
  await page.getByRole('button', { name: 'Save to My shelf' }).click()
  await page.locator('.new-lesson-card input').first().fill('Marks table')
  await page.getByRole('button', { name: 'Save to shelf' }).click()
  await page.waitForFunction(() => !document.querySelector('.new-lesson-card'))
  await fw(page, w => w.lessonState.lesson.newLesson({ name: 'Other', subject: '', kind: 'notebook' }))
  await page.waitForFunction(() => window.__fw.board.doc.items.length === 0)
  await fw(page, w => w.board.setColor('#1d3b33'))
  await fw(page, w => { w.S.popover.value = 'shelf' })
  await page.getByRole('button', { name: 'Use Marks table' }).click()
  await page.waitForFunction(() => window.__fw.board.doc.items.length === 1)
  t = await table()
  check('from My shelf onto a chalkboard its lines stay readable', t.cells[0][0] === 'Name' && t.c !== '#111827' && t.c !== '#2f6bff', JSON.stringify([t.c, t.cells[0]]))
  await fw(page, w => w.board.setSelection([]))
  await shot('on-chalkboard')

  // ── on the laptop ──────────────────────────────────────────────────────────
  await app.close()
  ;({ app, page, logs } = await launch())
  await fw(page, w => { w.S.popover.value = 'insert' })
  await page.getByRole('button', { name: 'Table', exact: true }).click()
  await page.getByRole('button', { name: 'Put on the board' }).click()
  check('the laptop Insert menu makes one too', (await table())?.rows.length === 3)
  await page.getByRole('button', { name: 'Type in the table' }).click()
  await page.waitForTimeout(60)
  check('the pencil opens the first cell', (await cell().getAttribute('aria-label')) === 'Row 1, column 1')
  await cell().fill('ok')
  await cell().press('Escape')
  await shot('laptop')

  check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.join(' | '))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
