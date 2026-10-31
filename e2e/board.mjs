// Essential checks for smart board mode: first-launch choice, board toolbar, soft pen, pages.
// Run: npm run e2e:board
import { launch, check, summary, fw, shotDir, gesture, wave } from './lib.mjs'
import { join } from 'node:path'

const { app, page, logs } = await launch({ layout: null })
const offscreen = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 4000, y: 60, width: 1920, height: 1080 }))
try {
  check('first launch asks smart board or laptop', await page.locator('.chooser').isVisible())
  await page.getByRole('button', { name: /Smart board/ }).click()
  await page.waitForTimeout(400)
  const chosen = await fw(page, w => ({ layout: w.S.layout.value, chosen: w.S.layoutChosen.value, fullscreen: w.S.fullscreen.value, alpha: w.S.bgAlpha.value }))
  check('choosing smart board goes full screen with a solid board', chosen.layout === 'board' && chosen.chosen && chosen.fullscreen && chosen.alpha === 100, JSON.stringify(chosen))
  await offscreen()
  await page.waitForTimeout(300)
  check('board toolbar replaces the laptop chrome', await page.locator('.boardbar').isVisible() && !(await page.locator('.topbar').count()) && !(await page.locator('.dock').count()))
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
  await page.getByRole('button', { name: 'Write over screen' }).click()
  check('write over screen makes the board see-through', await fw(page, w => w.S.bgAlpha.value) < 20)
  await fw(page, w => { w.S.bgAlpha.value = 100; w.S.barSide.value = 'center' })

  // Palm erase: a finger-sized touch draws, a palm-sized one wipes and then hands the pen back.
  await fw(page, w => { w.board.goToPage(0); w.board.setTool('pen') })
  await gesture(page, wave(300, 300, 50, 20), { type: 'touch', pressure: 0, size: 12 })
  const drawn = await fw(page, w => w.board.doc.items.length)
  await gesture(page, Array.from({ length: 30 }, (_, i) => [280 + i * 10, 300 + (i % 2) * 10]), { type: 'touch', pressure: 0, size: 90 })
  const palm = await fw(page, w => ({ items: w.board.doc.items.length, tool: w.S.tool.value, override: w.S.override.value, palm: w.S.palm.value }))
  check('a finger-sized touch draws', drawn >= 2, String(drawn))
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
  await fw(page, w => { w.S.bgColor.value = '#1d3b33'; w.S.penColor.value = '#ffffff' })
  await page.getByRole('tab', { name: 'English' }).click()
  await page.waitForTimeout(250)
  await page.screenshot({ path: join(shotDir, 'board-chalk.png') })
  await fw(page, w => { w.S.bgColor.value = '#ffffff'; w.S.grid.value = 'none' })

  check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.join(' | '))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
