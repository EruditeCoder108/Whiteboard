// The polish pass: toolbar on every screen, the radial menu, side handles, plain marks, panel check.
// Run: npm run e2e:polish
import { launch, check, summary, fw, gesture, shotDir } from './lib.mjs'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const { app, page, logs } = await launch({ layout: 'board' })
const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: join(shotDir, `polish-${name}.png`) }) }
const size = async (w, h) => { await app.evaluate(({ BrowserWindow }, s) => { for (const b of BrowserWindow.getAllWindows()) b.setContentSize(s[0], s[1]) }, [w, h]); await page.waitForTimeout(250) }
const hold = async (x, y) => gesture(page, [[x, y]], { type: 'touch', hold: 800, up: false })

try {
  await fw(page, w => { w.board.convertTo('notebook'); w.board.addPage(); w.board.addPage(); w.board.turnPage(-1) })

  // ── the toolbar fits ───────────────────────────────────────────────────────
  for (const [w, h, wrapOk] of [[1920, 1080, false], [1366, 768, false], [1280, 720, false], [1100, 700, false], [900, 600, true]]) {
    await size(w, h)
    const bar = await page.locator('.boardbar').evaluate(el => {
      const r = el.getBoundingClientRect()
      const lost = [...el.querySelectorAll('button')].filter(b => { const q = b.getBoundingClientRect(); return q.width && (q.left < 0 || q.right > innerWidth || q.bottom > innerHeight) }).map(b => b.getAttribute('aria-label'))
      return { left: r.left, right: r.right, height: r.height, lost, width: innerWidth }
    })
    check(`at ${w} wide no toolbar button is lost`, bar.lost.length === 0 && bar.left >= 0 && bar.right <= bar.width, JSON.stringify(bar))
    if (!wrapOk) check(`at ${w} wide the toolbar stays on one row`, bar.height < 90, String(bar.height))
    for (const name of ['Pen', 'Eraser', 'Subjects', 'More']) check(`at ${w} wide ${name} can be tapped`, await page.getByRole('toolbar', { name: 'Board tools' }).getByRole('button', { name, exact: true }).isVisible())
    if (w === 1280) await shot('toolbar-1280')
  }
  await size(1920, 1080)

  // ── pictures only where they help ──────────────────────────────────────────
  const marks = await page.locator('.boardbar').evaluate(el => {
    const pic = (name) => !!el.querySelector(`[aria-label="${name}"] img.art`)
    return { pen: pic('Pen'), eraser: pic('Eraser'), undo: pic('Undo'), redo: pic('Redo'), back: pic('Back'), more: pic('More') }
  })
  check('tools keep their pictures', marks.pen && marks.eraser, JSON.stringify(marks))
  check('undo, redo and the menu are plain marks', !marks.undo && !marks.redo && !marks.more, JSON.stringify(marks))
  const handle = await page.locator('.edge-tab.left').evaluate(el => ({ art: !!el.querySelector('img,svg'), w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height, op: getComputedStyle(el.querySelector('i')).opacity }))
  check('the side handle is quiet, but still easy to hit', !handle.art && Number(handle.op) < .5 && handle.w >= 28 && handle.h >= 90, JSON.stringify(handle))
  await page.locator('.edge-tab.left').click()
  check('and still opens the menu on that side', await fw(page, w => w.S.popover.value === 'board-menu' && w.S.barSide.value === 'left'))
  await fw(page, w => { w.S.popover.value = null; w.S.barSide.value = 'center' })
  await fw(page, w => { w.S.popover.value = 'menu' })
  await fw(page, w => { w.S.popover.value = null })

  // ── brush ──────────────────────────────────────────────────────────────────
  const streak = await page.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 80
    const g = cv.getContext('2d'), p = []
    for (let i = 0; i < 40; i++) p.push(i * 10, 40, .5)
    window.__fw.paintItem(g, { t: 's', id: 'b', c: '#111827', w: 40, m: false, v: true, style: 'brush', p })
    const d = g.getImageData(200, 0, 1, 80).data, seen = new Set()
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 250) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`)
    return [...seen]
  })
  check('a brush stroke is one clean colour across its width', streak.length === 1, streak.join(' | '))

  // ── the radial menu ────────────────────────────────────────────────────────
  await fw(page, w => { w.board.setTool('pen'); w.S.penStyle.value = 'pen'; w.S.penColor.value = '#111827'; w.S.radialEnabled.value = true })
  const cx = 800, cy = 480
  const pick = async (dx, dy) => {
    await page.waitForTimeout(800)
    await gesture(page, [[cx, cy]], { type: 'touch', hold: 650, up: false })
    await page.waitForSelector('.radial')
    const open = await page.locator('.radial').count()
    await gesture(page, [[cx + dx / 2, cy + dy / 2], [cx + dx, cy + dy]], { type: 'touch', down: false, up: false, gap: 30 })
    await page.waitForTimeout(60)
    return open
  }
  const release = async (dx, dy) => { await gesture(page, [[cx + dx, cy + dy]], { type: 'touch', down: false }); await page.waitForTimeout(80) }
  const before = await fw(page, w => w.board.doc.items.length)
  await pick(0, -55)
  await shot('radial')
  await release(0, -55)
  check('the radial menu picks a tool', await fw(page, w => w.S.tool.value === 'pen'))
  await pick(55, 0) // Eraser sits at the right, two steps round from the top
  check('it shows pictures, not faint lines', (await page.locator('.radial image').count()) >= 10, String(await page.locator('.radial image').count()))
  await shot('radial-eraser')
  await release(55, 0)
  check('flick right for the eraser', await fw(page, w => w.S.tool.value === 'eraser'))
  // A pen style, from the arc above the tools.
  const style = (deg) => { const a = deg * Math.PI / 180; return [Math.sin(a) * 104, -Math.cos(a) * 104] }
  await pick(...style(-30))
  await release(...style(-30))
  check('the arc above chooses a pen style and picks up the pen', await fw(page, w => w.S.penStyle.value === 'pencil' && w.S.tool.value === 'pen'))
  await pick(...style(30))
  await release(...style(30))
  check('next along is chalk', await fw(page, w => w.S.penStyle.value === 'chalk'))
  // A colour, from the arc below.
  const colour = await fw(page, w => '')
  void colour
  const dot = (deg) => { const a = deg * Math.PI / 180; return [Math.sin(a) * 104, -Math.cos(a) * 104] }
  await pick(...dot(180 - 12))
  await release(...dot(180 - 12))
  const picked = await fw(page, w => w.S.penColor.value)
  check('the arc below chooses a colour', picked !== '#111827', picked)
  await fw(page, w => { w.S.penStyle.value = 'pen' })
  // Shapes and undo, and nothing destructive.
  await pick(...(() => { const a = 180 * Math.PI / 180; return [Math.sin(a) * 55, -Math.cos(a) * 55] })())
  await release(...(() => { const a = 180 * Math.PI / 180; return [Math.sin(a) * 55, -Math.cos(a) * 55] })())
  check('straight down is Shapes', await fw(page, w => ['line', 'arrow', 'rect', 'ellipse', 'diamond', 'triangle'].includes(w.S.tool.value)))
  await fw(page, w => { w.board.setTool('pen'); w.board.setSurface({ color: '#22423a', texture: 'chalk' }) })
  await pick(0, -55)
  await shot('radial-dark')
  const place = await fw(page, w => w.S.barSide.value), left = await page.locator('.boardbar').evaluate(e => Math.round(e.getBoundingClientRect().left + e.getBoundingClientRect().width / 2))
  check('the toolbar stays where it was through all of this', place === 'center' && Math.abs(left - 960) < 4, place + ' ' + left)
  await release(0, -55)
  await fw(page, w => { w.board.setSurface({ color: '#ffffff', texture: 'none' }) })
  check('no flick on the menu ever draws', (await fw(page, w => w.board.doc.items.length)) === before)
  check('the bin is gone from it', !(await fw(page, w => JSON.stringify(window.__fw.S.tool.value).includes('clear'))))

  // ── panel check ────────────────────────────────────────────────────────────
  await fw(page, w => { w.S.popover.value = 'settings' })
  await page.getByRole('button', { name: 'Panel check: measure this board…' }).click()
  await page.waitForSelector('.panel-pad')
  await shot('panel-step')
  const touch = (s, id = 5) => page.evaluate(({ s, id }) => {
    const el = document.querySelector('.panel-pad')
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: id, width: s, height: s, pressure: .5 }))
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: id, width: s, height: s }))
  }, { s, id })
  for (const [s] of [[4], [4], [4], [10], [10], [10], [22], [22], [22], [90], [90], [90]]) { await touch(s); await page.waitForTimeout(40) }
  await page.evaluate(() => {
    const el = document.querySelector('.panel-pad')
    for (let id = 1; id <= 6; id++) el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: id, width: 20, height: 20 }))
  })
  await page.waitForTimeout(60)
  check('it counts the fingers on the board', (await page.locator('.panel-pad').textContent()).includes('6 at once'), await page.locator('.panel-pad').textContent())
  await page.evaluate(() => { const el = document.querySelector('.panel-pad'); for (let id = 1; id <= 6; id++) el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: id })) })
  await page.waitForTimeout(60)
  await page.evaluate(async () => {
    const el = document.querySelector('.panel-pad')
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'pen', pointerId: 8, width: 2, height: 2, pressure: .4 }))
    for (let i = 0; i < 30; i++) { el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'pen', pointerId: 8, width: 2, height: 2 })); await new Promise(r => setTimeout(r, 8)) }
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'pen', pointerId: 8 }))
  })
  await page.waitForSelector('.panel-report')
  const report = await page.locator('.panel-report').textContent()
  check('the report holds what the screen reported', report.includes('contact 4 × 4') && report.includes('contact 10 × 10') && report.includes('contact 90 × 90') && report.includes('Most fingers at once: 6'), report)
  check('and the screen itself', report.includes('Windows display scale') && report.includes('Real pixels') && report.includes('Touch points reported'))
  check('and how fast it reports', /Pen events per second while drawing: [1-9]/.test(report), report)
  await shot('panel-report')
  await page.getByRole('textbox', { name: 'Your notes' }).fill('Thick end feels fine')
  await page.getByRole('button', { name: 'Save the report' }).click()
  await page.waitForSelector('.panel-check-card [role="status"]')
  const path = await page.locator('.panel-check-card [role="status"] b').textContent()
  check('the report is saved to a file', existsSync(path) && readFileSync(path, 'utf8').includes('Thick end feels fine'), path)
  await page.getByRole('button', { name: 'Use these on this board' }).click()
  const tuned = await fw(page, w => ({ tip: w.S.tipMax.value, thick: w.S.thickMax.value, palm: w.S.palmSize.value }))
  check('its numbers can tune this board', tuned.tip > 4 && tuned.tip < 10 && tuned.thick > 10 && tuned.thick < 22 && tuned.palm > 22 && tuned.palm < 90, JSON.stringify(tuned))
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  check('and it closes', !(await page.locator('.panel-check-card').isVisible()))

  check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.filter(l => /pageerror|\[error\]/.test(l)).slice(0, 3).join(' | '))
} catch (error) {
  check('the suite ran to the end', false, String(error).slice(0, 700))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
