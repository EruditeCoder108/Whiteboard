import { launch, gesture, hover, wave, fw, itemCount, check, summary, shotDir } from './lib.mjs'
import { join } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'

const { app, page, logs, userData } = await launch()
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 4000, y: 40, width: 1280, height: 800 }))
await page.waitForTimeout(200)
await fw(page, w => w.board.setView({ x: 0, y: 0, zoom: 1 }))
const shot = (name) => page.screenshot({ path: join(shotDir, name + '.png') })
const key = (k, opts) => page.keyboard.press(k, opts)
const state = (path) => fw(page, (w, p) => p.split('.').reduce((o, k) => o[k], w.S).value, path)
const setTool = (t) => fw(page, (w, t) => w.board.setTool(t), t)
const sleep = (ms) => page.waitForTimeout(ms)

// ── pen / mouse / touch drawing ────────────────────────────────────────────────
await gesture(page, wave(220, 150, 70, 22, 4.5), { type: 'pen', pressure: 'wave' })
check('pen stroke is committed', (await itemCount(page)) === 1)
const pen = await fw(page, (w) => w.board.doc.items[0])
check('pen stroke has pressure-sensitive width', pen.v === true && new Set(pen.p.filter((_, i) => i % 3 === 2).map((v) => Math.round(v * 10))).size > 3)
check('pen size is the true size (3, not 8)', pen.w === 3)
await sleep(900)
await gesture(page, wave(220, 230, 70, 22, 4.5), { type: 'mouse' })
const mouse = await fw(page, (w) => w.board.doc.items[1])
check('mouse stroke is constant width', (await itemCount(page)) === 2 && mouse.v === false)
await gesture(page, wave(220, 310, 70, 22, 4.5), { type: 'touch', id: 7 })
check('finger draws', (await itemCount(page)) === 3)

// palm rejection: touch right after a pen stroke is ignored
await gesture(page, wave(220, 380, 30, 10, 5), { type: 'pen', pressure: 0.5 })
const n = await itemCount(page)
await gesture(page, wave(220, 420, 30, 10, 5), { type: 'touch', id: 8 })
check('touch ignored right after pen (palm rejection)', (await itemCount(page)) === n)
await sleep(900)

// ── undo / redo ────────────────────────────────────────────────────────────────
await key('Control+z')
check('undo', (await itemCount(page)) === n - 1)
await key('Control+y')
check('redo', (await itemCount(page)) === n)
await key('Control+z'); await key('Control+z')
await key('Control+Shift+z'); await key('Control+y')
check('redo (Ctrl+Shift+Z and Ctrl+Y)', (await itemCount(page)) === n)

// ── shapes ───────────────────────────────────────────────────────────────────────
await key('r'); await gesture(page, [[700, 140], [820, 230]])
await key('a'); await gesture(page, [[700, 260], [830, 330]], { shift: true })
await key('o'); await gesture(page, [[700, 360], [800, 430]])
const kinds = await fw(page, (w) => w.board.doc.items.slice(-3).map((i) => i.k))
check('rectangle, arrow, ellipse created', kinds.join() === 'rect,arrow,ellipse')
const arrow = await fw(page, (w) => w.board.doc.items.at(-2))
const ang = Math.atan2(arrow.p[3] - arrow.p[1], arrow.p[2] - arrow.p[0]) * 180 / Math.PI
check('Shift snaps arrow to 15° steps', Math.abs(ang / 15 - Math.round(ang / 15)) < 1e-6)
const total = await itemCount(page)

// ── eraser: stroke mode ────────────────────────────────────────────────────────────
await key('e')
check('E selects eraser', (await state('tool')) === 'eraser')
await gesture(page, [[300, 120], [300, 190]])
check('stroke eraser removes a whole stroke', (await itemCount(page)) === total - 1)
await key('Control+z')
check('erase is undoable', (await itemCount(page)) === total)

// pixel mode via E again
await key('e')
check('E again switches to Pixel', (await state('eraserMode')) === 'pixel')
await gesture(page, [[330, 120], [330, 190]])
const after = await itemCount(page)
check('pixel eraser splits the stroke instead of deleting it', after === total + 1, `got ${after}, want ${total + 1}`)
await key('Control+z')
check('pixel erase undoes cleanly', (await itemCount(page)) === total)
await gesture(page, [[694, 185], [830, 185]])
const kinds2 = await fw(page, (w) => w.board.doc.items.map((i) => i.t + (i.k ?? '')).join())
check('pixel eraser can cut through a rectangle (turns into ink)', /s/.test(kinds2.split(',').slice(-4).join()) && !/hrect/.test(kinds2))
await key('Control+z')

// ── eraser ghosting: pixels must be clean after a drag ───────────────────────────────
await key('Control+z')   // drop the ellipse etc. so the test area is empty
const probe = async () => page.evaluate(() => {
  const cv = document.querySelectorAll('.cv')[1]
  const ctx = cv.getContext('2d')
  const d = ctx.getImageData(0, 0, cv.width, cv.height).data
  let nonEmpty = 0
  for (let i = 3; i < d.length; i += 4) if (d[i] > 8) nonEmpty++
  return nonEmpty
})
await setTool('eraser')
await hover(page, 400, 500); await hover(page, 450, 520)
await gesture(page, Array.from({ length: 25 }, (_, i) => [400 + i * 12, 500 + 30 * Math.sin(i * 0.5)]), { gap: 8 })
await sleep(120)
const ring = await probe()
check('eraser ring is visible only at its final position (no ghosts)', ring > 50 && ring < 12000, `live-layer pixels: ${ring}`)
await hover(page, 1000, 150) // move away, ring follows
await sleep(120)
const ring2 = await probe()
check('ring moves with the pointer (still exactly one ring)', ring2 > 50 && ring2 < 12000, `live-layer pixels: ${ring2}`)
await page.evaluate(() => document.querySelector('.stage').dispatchEvent(new PointerEvent('pointerleave', { bubbles: false, pointerType: 'mouse' })))
await sleep(120)
check('ring disappears when the pointer leaves', (await probe()) === 0)

// ── select / move / duplicate / delete ───────────────────────────────────────────────
await key('v')
await gesture(page, [[690, 130], [840, 440]])                      // marquee over the shapes
const sel = await state('selectionCount')
check('marquee selects items', sel >= 2, `selected ${sel}`)
const b0 = await fw(page, (w) => w.board.selection[0].p.slice(0, 2))
await gesture(page, [[760, 200], [800, 230], [820, 250]])          // drag selection
const moved = await fw(page, (w) => w.board.selection[0].p.slice(0, 2))
check('drag moves the selection', Math.abs(moved[0] - b0[0] - 60) < 2 && Math.abs(moved[1] - b0[1] - 50) < 2, JSON.stringify([b0, moved]))
await key('Control+z')
const undone = await fw(page, (w) => w.board.selection[0]?.p.slice(0, 2))
await key('Control+d')
check('Ctrl+D duplicates', (await state('selectionCount')) >= 2)
await key('Delete')
check('Delete removes the selection', (await state('selectionCount')) === 0)
await key('Control+z'); await key('Control+z')

// ── radial menu ─────────────────────────────────────────────────────────────────────────
await setTool('pen')
const nb = await itemCount(page)
await gesture(page, [[500, 460]], { up: false })                     // press…
await sleep(650)                                                      // …and hold
await page.waitForSelector('.radial', { timeout: 2000 })
check('press-and-hold opens the radial menu', (await page.locator('.radial').count()) === 1)
check('no stray stroke while the menu is open', (await itemCount(page)) === nb)
await shot('radial')
// release on the Marker slice (45° clockwise from top, inner ring)
const c = await page.evaluate(() => { const r = document.querySelector('.radial').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })
const stage = await page.evaluate(() => { const r = document.querySelector('.stage').getBoundingClientRect(); return [r.left, r.top] })
const rad = 59, a = Math.PI / 4
await page.evaluate(({ x, y }) => {
  const el = document.querySelector('.stage')
  el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'mouse', clientX: x, clientY: y, buttons: 1, button: -1 }))
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'mouse', clientX: x, clientY: y, buttons: 0, button: 0 }))
}, { x: c[0] + rad * Math.sin(a), y: c[1] - rad * Math.cos(a) })
await sleep(100)
check('radial pick switches tool', (await state('tool')) === 'marker')
check('radial closes', (await page.locator('.radial').count()) === 0)
await setTool('pen')

// radial colour ring
await gesture(page, [[500, 460]], { up: false }); await sleep(650)
const c2 = await page.evaluate(() => { const r = document.querySelector('.radial').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })
const rr = 100, a2 = Math.PI / 4   // colour index 1 = red
await page.evaluate(({ x, y }) => {
  const el = document.querySelector('.stage')
  el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'mouse', clientX: x, clientY: y, buttons: 1, button: -1 }))
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'mouse', clientX: x, clientY: y, buttons: 0, button: 0 }))
}, { x: c2[0] + rr * Math.sin(a2), y: c2[1] - rr * Math.cos(a2) })
await sleep(100)
check('radial colour ring picks a colour', (await state('penColor')) === '#e5484d')
await fw(page, (w) => { w.S.penColor.value = '#111827' })

// touch long-press also opens it
await gesture(page, [[500, 460]], { type: 'touch', id: 9, up: false }); await sleep(650)
check('touch press-and-hold opens the radial menu', (await page.locator('.radial').count()) === 1)
await page.evaluate(() => document.querySelector('.stage').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, pointerType: 'touch', clientX: 500, clientY: 500, buttons: 0, button: 0 })))
await sleep(900)

// ── zoom / pan ──────────────────────────────────────────────────────────────────────────
const z0 = await state('zoom')
await page.mouse.move(600, 400)
await page.keyboard.down('Control'); await page.mouse.wheel(0, -200); await page.keyboard.up('Control')
await sleep(100)
check('Ctrl+wheel zooms in', (await state('zoom')) > z0)
await key('Control+0'); await page.waitForFunction(() => Math.abs(window.__fw.S.zoom.value - 1) < 0.001, null, { timeout: 3000 }).catch(() => {})
check('Ctrl+0 resets zoom', Math.abs((await state('zoom')) - 1) < 0.01, String(await state('zoom')))
await key('Control+1'); await sleep(400)
check('Ctrl+1 fits all content', (await state('zoom')) > 0.05)
await key('Control+0'); await page.waitForFunction(() => Math.abs(window.__fw.S.zoom.value - 1) < 0.001, null, { timeout: 3000 }).catch(() => {})

// two-finger pinch
const zb = await state('zoom')
const countBeforePinch = await itemCount(page)
await page.evaluate(() => {
  const el = document.querySelector('.stage'); const r = el.getBoundingClientRect()
  const ev = (n, id, x, y) => el.dispatchEvent(new PointerEvent(n, { bubbles: true, pointerId: id, pointerType: 'touch', isPrimary: id === 20, clientX: r.left + x, clientY: r.top + y, buttons: n === 'pointerup' ? 0 : 1, button: 0 }))
  ev('pointerdown', 20, 600, 400); ev('pointerdown', 21, 700, 400)
  for (let i = 1; i <= 10; i++) { ev('pointermove', 20, 600 - i * 15, 400); ev('pointermove', 21, 700 + i * 15, 400) }
  ev('pointerup', 20, 450, 400); ev('pointerup', 21, 850, 400)
})
await sleep(900)
check('two-finger pinch zooms and draws nothing', (await state('zoom')) > zb * 1.5 && await itemCount(page) === countBeforePinch, `before ${zb}, after ${await state('zoom')}`)
await key('Control+0'); await sleep(400)

// ── hide interface & pass-through state ───────────────────────────────────────────────
await key('Tab'); await sleep(150)
check('Tab hides the interface', (await page.locator('.dock').count()) === 0 && (await page.locator('.minibar').count()) === 1)
await fw(page, (w) => { w.S.bgAlpha.value = 0 })
await sleep(100)
await shot('hidden-opacity0')
const mini = await page.locator('.minibar').boundingBox()
check('mini bar sits top-right', mini && mini.x > 1000 && mini.y < 20, JSON.stringify(mini))
await page.locator('.minibar button').first().click()
check('mini bar button restores the interface', (await page.locator('.dock').count()) === 1)
await fw(page, (w) => { w.S.bgAlpha.value = 96 })

// ── panels & popovers (visual) ───────────────────────────────────────────────────────────
await page.locator('.colordot').click(); await sleep(150); await shot('popover-props')
check('colour popover opens', (await page.locator('.props').count()) === 1)
await page.locator('.props .swatch').nth(7).click()
check('picking a swatch sets the pen colour', (await state('penColor')) === '#2f6bff')
await page.mouse.click(900, 600)
check('clicking the board closes the popover', (await page.locator('.popover').count()) === 0)
await page.getByRole('button', { name: 'Board settings', exact: true }).click(); await sleep(150); await shot('popover-settings')
await page.keyboard.press('Escape')
await page.locator('.topbar .btn').first().click(); await sleep(150); await shot('popover-menu')
await page.keyboard.press('Escape')
await key('F1'); await sleep(150); await shot('popover-help')
await key('Escape')
await key('Control+z'); await key('Control+z'); await key('Control+z')
await setTool('eraser'); await page.locator('.colordot').click(); await sleep(150); await shot('popover-eraser')
await page.keyboard.press('Escape'); await page.mouse.click(900, 600)
await setTool('pen')

// ── persistence ──────────────────────────────────────────────────────────────────────────────
await fw(page, (w) => { w.S.bgColor.value = '#fbf6e9'; w.S.grid.value = 'dots' })
await sleep(1500)                         // let the debounced autosave land
const countBefore = await itemCount(page)
await shot('main')
await app.close()
check('board file written on close', existsSync(join(userData, 'board.json')))
check('settings file written', existsSync(join(userData, 'settings.json')))

const again = await launch({ userData })
const countAfter = await itemCount(again.page)
check(`board restored after restart (${countBefore} items)`, countAfter === countBefore && countBefore > 0, `restored ${countAfter}`)
check('settings restored (paper background, dots)', (await fw(again.page, (w) => w.S.bgColor.value + w.S.grid.value)) === '#fbf6e9dots')
await again.page.screenshot({ path: join(shotDir, 'restored.png') })
const all = [...logs, ...again.logs].filter((l) => !/DevTools|Autofill|willReadFrequently/.test(l))
check('no console errors', all.length === 0, all.join(' | '))
await again.app.close()
process.exit(summary() ? 1 : 0)
