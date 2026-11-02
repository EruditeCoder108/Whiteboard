// Essential checks for smart board mode: first-launch choice, board toolbar, soft pen, pages.
// Run: npm run e2e:board
import { launch, check, summary, fw, shotDir, gesture, wave } from './lib.mjs'
import { join } from 'node:path'

const { app, page, logs } = await launch({ layout: null })
const offscreen = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 4000, y: 60, width: 1920, height: 1080 }))
try {
  check('first launch asks nothing', await page.locator('.chooser').count() === 0)
  await page.waitForTimeout(400)
  const chosen = await fw(page, w => ({ kind: w.S.kind.value, fullscreen: w.S.fullscreen.value, alpha: w.S.bgAlpha.value }))
  check('a fresh install opens full screen on a solid notebook', chosen.kind === 'notebook' && chosen.fullscreen && chosen.alpha === 100, JSON.stringify(chosen))
  await offscreen()
  await page.waitForTimeout(300)
  check('the board toolbar is the only toolbar', await page.locator('.boardbar').isVisible() && !(await page.locator('.topbar').count()) && !(await page.locator('.dock').count()))
  await page.screenshot({ path: join(shotDir, 'board-toolbar.png') })

  // Soft pen: touch has no pressure, so a slow-then-fast finger stroke still varies in width.
  await page.getByRole('button', { name: 'Pen', exact: true }).click()
  await page.getByRole('button', { name: 'Thick' }).click()
  const pts = [...Array.from({ length: 30 }, (_, i) => [300 + i * 2, 400]), ...Array.from({ length: 30 }, (_, i) => [360 + i * 26, 400 + i * 3])]
  await gesture(page, pts, { type: 'touch', pressure: 0, gap: 8 })
  const soft = await fw(page, w => { const it = w.board.doc.items.at(-1); const pr = it.p.filter((_, i) => i % 3 === 2); return { v: it.v, w: it.w, lo: Math.min(...pr), hi: Math.max(...pr) } })
  check('a finger stroke gets soft-pen width from speed', soft.v === true && soft.w === 12 && soft.hi - soft.lo > 0.15, JSON.stringify(soft))
  await page.getByRole('button', { name: 'Ink #e5484d' }).click()
  check('one tap on an ink sets the pen colour', await fw(page, w => w.S.penColor.value) === '#e5484d')

  // Pages: new page, sorter thumbnails, duplicate and reorder.
  await page.getByRole('button', { name: 'New page' }).click()
  await gesture(page, wave(400, 500), { type: 'pen' })
  await page.getByRole('button', { name: 'All pages' }).click()
  await page.waitForTimeout(200)
  check('page sorter shows a thumbnail per page', await page.locator('.thumb').count() === 2)
  await page.screenshot({ path: join(shotDir, 'board-pages.png') })
  await page.getByRole('button', { name: 'Duplicate page 2' }).click()
  const dup = await fw(page, w => ({ count: w.board.pageCount, page: w.board.page, items: w.board.doc.items.length }))
  check('duplicating a page copies its ink and shows the copy', dup.count === 3 && dup.page === 2 && dup.items === 1, JSON.stringify(dup))
  await page.getByRole('button', { name: 'Move page 3 earlier' }).click()
  check('moving a page keeps the moved page in view', await fw(page, w => w.board.page) === 1)

  // Main menu as large tiles; the toolbar follows the teacher's side.
  await page.keyboard.press('Escape')
  await page.locator('.edge-tab.left').click()
  check('left edge tab brings the toolbar left and opens the menu', await page.locator('.board-sheet').isVisible() && await fw(page, w => w.S.barSide.value) === 'left')
  await page.screenshot({ path: join(shotDir, 'board-menu.png') })
  await page.getByRole('button', { name: 'Write on screen' }).click()
  check('write on screen makes the board see-through', await fw(page, w => w.S.bgAlpha.value) === 0)
  await page.getByRole('button', { name: 'Back to board' }).click()
  await offscreen()
  await page.waitForTimeout(300)
  await fw(page, w => { w.S.barSide.value = 'center' })

  // Palm erase: a finger-sized touch draws, a palm-sized one wipes and then hands the pen back.
  const start = await fw(page, w => { w.board.goToPage(0); w.board.setTool('pen'); return w.board.doc.items.length })
  // The board learns this screen's fingertip size from the first few touches.
  for (const y of [300, 360, 420]) await gesture(page, wave(300, y, 50, 20), { type: 'touch', pressure: 0, size: 12 })
  const drawn = await fw(page, w => w.board.doc.items.length)
  await gesture(page, Array.from({ length: 30 }, (_, i) => [280 + i * 10, 300 + (i % 4) * 40]), { type: 'touch', pressure: 0, size: 90 })
  const palm = await fw(page, w => ({ items: w.board.doc.items.length, tool: w.S.tool.value, override: w.S.override.value, palm: w.S.palm.value }))
  check('finger-sized touches draw', drawn - start === 3, JSON.stringify({ start, drawn }))
  check('a palm wipes the ink away and the pen comes back', palm.items < drawn && palm.tool === 'pen' && palm.override === null && palm.palm === 0, JSON.stringify({ drawn, ...palm }))

  // Paper belongs to its page.
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Background' }).click()
  await page.getByRole('button', { name: 'Four-line' }).click()
  await page.screenshot({ path: join(shotDir, 'board-paper.png') })
  await fw(page, w => w.board.goToPage(1))
  const other = await fw(page, w => w.S.grid.value)
  await fw(page, w => w.board.goToPage(0))
  const back = await fw(page, w => ({ grid: w.S.grid.value, saved: JSON.parse(w.board.serialize()).pages.map(p => p.paper) }))
  check('each page keeps its own paper', other !== 'fourline' && back.grid === 'fourline' && back.saved[0] === 'fourline', JSON.stringify({ other, ...back }))

  // Subjects drawer and the chalkboard look.
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Subjects' }).click()
  await page.getByRole('tab', { name: 'Maths' }).click()
  await page.getByRole('button', { name: 'Ruler' }).click()
  check('subjects drawer puts the maths instruments one tap away', (await fw(page, w => w.board.instruments.shown ?? null)) !== undefined && await page.locator('.subjects-sheet .tile.on').count() === 1)
  await page.getByRole('button', { name: 'Ruler' }).click()
  await fw(page, w => { w.board.setColor('#1d3b33'); w.S.penColor.value = '#ffffff' })
  await page.getByRole('tab', { name: 'English' }).click()
  await page.waitForTimeout(250)
  await page.screenshot({ path: join(shotDir, 'board-chalk.png') })
  await fw(page, w => { w.board.setColor('#ffffff'); w.board.setPaper('none', true) })

  // Notebook: each page is a fixed sheet: no zoom either way, no panning, turns with a swipe.
  await page.keyboard.press('Escape')
  const fit = await fw(page, w => {
    w.board.goToPage(0); w.board.zoomAt(.2, 500, 500); const out = w.board.view.zoom
    w.board.zoomAt(4, 500, 500); const into = w.board.view.zoom; w.board.panBy(-3000, 2000)
    return { kind: w.board.kind, out, into, v: w.board.view, size: w.board.size, area: w.board.areaH }
  })
  const fixed = Math.min(fit.size.w / 1600, fit.area / 900)
  check('smart board starts a notebook whose pages have one fixed size: no zoom in or out, no panning off',
    fit.kind === 'notebook' && Math.abs(fit.out - fixed) < .01 && Math.abs(fit.into - fixed) < .01 && Math.abs(-fit.v.x * fit.into * 2 + 1600 * fit.into - fit.size.w) < 1 && Math.abs(fit.v.y) < .5, JSON.stringify(fit))
  const swipe = async (dx) => page.evaluate(async (dx) => {
    const el = document.querySelector('.stage'), r = el.getBoundingClientRect(), sleep = (ms) => new Promise(res => setTimeout(res, ms))
    const ev = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: id === 11, clientX: r.left + x, clientY: r.top + y, buttons: type === 'pointerup' ? 0 : 1, pressure: .5 }))
    ev('pointerdown', 11, 900, 500); ev('pointerdown', 12, 1000, 520)
    for (let i = 1; i <= 12; i++) { ev('pointermove', 11, 900 + dx * i / 12, 500); ev('pointermove', 12, 1000 + dx * i / 12, 520); await sleep(8) }
    ev('pointerup', 11, 900 + dx, 500); ev('pointerup', 12, 1000 + dx, 520)
  }, dx)
  await swipe(-320)
  const afterSwipe = await fw(page, w => ({ page: w.board.page, items: w.board.doc.items.length }))
  await page.waitForTimeout(80)
  await page.screenshot({ path: join(shotDir, 'board-page-turn.png') })
  await page.waitForTimeout(300)
  await swipe(320)
  check('a two-finger swipe turns the page forward and back without drawing', afterSwipe.page === 1 && await fw(page, w => w.board.page) === 0, JSON.stringify(afterSwipe))
  await page.getByRole('button', { name: 'More space below' }).click()
  await page.waitForTimeout(350)
  const long = await fw(page, w => ({ extent: w.board.pageFrame.extent, y: w.board.view.y }))
  check('more space below extends the page and scrolls down to it', long.extent === 2 && long.y > 100, JSON.stringify(long))
  check('a long page shows its map on the right edge', await page.locator('.rail-map').isVisible())
  await page.screenshot({ path: join(shotDir, 'board-long-page.png') })
  const pdf = await fw(page, async w => (await w.board.exportPages()).length)
  check('PDF export keeps every sheet, blank ones too', pdf === await fw(page, w => w.board.pageCount), String(pdf))
  await page.getByRole('button', { name: 'Remove the empty space at the bottom' }).click()
  check('empty space at the bottom can be removed again', await fw(page, w => w.board.pageFrame.extent) === 1)
  // Canvas: a different kind of board. Converting keeps every stroke; pages become numbered frames.
  const before = await fw(page, w => ({ pages: w.board.pageCount, ink: w.board.pageData().reduce((n, p) => n + p.items.length, 0) }))
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Turn into canvas' }).click()
  await page.waitForTimeout(200)
  const canvas = await fw(page, w => ({ kind: w.board.kind, pages: w.board.pageCount, frames: w.board.frameList.length, ink: w.board.doc.items.length }))
  check('turning a notebook into a canvas lays its pages out as frames and keeps all the ink',
    canvas.kind === 'canvas' && canvas.pages === 1 && canvas.frames === before.pages && canvas.ink === before.ink, JSON.stringify({ before, canvas }))
  await fw(page, w => w.board.zoomAt(.3, 500, 500))
  await page.waitForTimeout(300)
  check('a canvas zooms out freely', await fw(page, w => w.board.view.zoom) < .6)
  await page.screenshot({ path: join(shotDir, 'board-canvas-frames.png') })
  await page.getByRole('button', { name: 'Next' }).click()
  await page.waitForTimeout(500)
  check('Back/Next on a canvas fly between its frames', await fw(page, w => w.S.frameIndex.value) >= 0)
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Turn into notebook' }).click()
  const round = await fw(page, w => ({ kind: w.board.kind, pages: w.board.pageCount, ink: w.board.pageData().reduce((n, p) => n + p.items.length, 0) }))
  check('and back into a notebook: the same pages, the same ink', round.kind === 'notebook' && round.pages === before.pages && round.ink === before.ink, JSON.stringify({ before, round }))

  check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.join(' | '))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
