// One layout on every screen: the page clear of the toolbar, and writing straight on the screen.
// Run: npm run e2e:oneboard
import { launch, check, summary, fw, gesture, wave, shotDir } from './lib.mjs'
import { join } from 'node:path'

const shot = name => page.screenshot({ path: join(shotDir, `oneboard-${name}.png`) })
const sized = async (app, w, h) => {
  await app.evaluate(({ BrowserWindow }, s) => { const win = BrowserWindow.getAllWindows()[0]; win.setFullScreen(false); win.setBounds({ x: 4000, y: 40, width: s[0], height: s[1] }) }, [w, h])
  await new Promise(r => setTimeout(r, 350))
}
// Where the page's sheet ends on the screen.
const sheet = (page) => fw(page, w => { const v = w.board.view, f = w.board.pageRect; return { left: (f[0] - v.x) * v.zoom, top: (f[1] - v.y) * v.zoom, right: (f[2] - v.x) * v.zoom, bottom: (f[3] - v.y) * v.zoom } })
const barTop = (page) => page.locator('.boardbar').evaluate(el => el.getBoundingClientRect().top)
const stageTop = (page) => page.locator('.stage').evaluate(el => el.getBoundingClientRect().top)

const { app, page, logs } = await launch({ layout: 'board' })
try {
  check('no question on first launch', await page.locator('.chooser').count() === 0)
  check('opens full screen on a notebook', await fw(page, w => w.S.fullscreen.value && w.S.kind.value === 'notebook'))

  // ── the page sits clear of the toolbar on every screen ─────────────────────
  for (const [w, h] of [[1920, 1080], [1366, 768], [1280, 720], [1024, 700]]) {
    await sized(app, w, h)
    const s = await sheet(page), bar = await barTop(page), top = await stageTop(page), inner = await page.evaluate(() => innerWidth)
    check(`${w}×${h}: the page ends above the toolbar`, top + s.bottom <= bar + 1, JSON.stringify({ s, bar, top }))
    check(`${w}×${h}: the page stays on the screen`, s.left >= -1 && s.right <= inner + 1, JSON.stringify(s))
    check(`${w}×${h}: the toolbar fits`, await page.locator('.boardbar').evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 }))
    await shot(`page-${w}`)
  }
  await sized(app, 1280, 720)

  // ── a pen in the margin writes nothing; on the page it writes ──────────────
  await fw(page, w => { w.board.setTool('pen') })
  const s = await sheet(page), top = await stageTop(page)
  const before = await fw(page, w => w.board.doc.items.length)
  if (s.left > 24) await gesture(page, [[s.left / 2, top + 200], [s.left / 2 + 4, top + 240], [s.left / 2, top + 280]], { type: 'pen' })
  check('a pen in the margin writes nothing', await fw(page, w => w.board.doc.items.length) === before)
  await gesture(page, wave(s.left + 200, top + 200, 120, 20), { type: 'pen' })
  check('a pen on the page writes', await fw(page, w => w.board.doc.items.length) === before + 1)

  // ── hide the toolbar and the page fills the screen ─────────────────────────
  const small = (await sheet(page)).bottom
  await page.keyboard.press('Tab')
  await page.waitForTimeout(250)
  const large = await sheet(page)
  check('hiding the toolbar gives the page the room', large.bottom > small + 40, JSON.stringify({ small, large }))
  await page.keyboard.press('Tab')
  await page.waitForTimeout(250)

  // ── a canvas runs edge to edge ─────────────────────────────────────────────
  await fw(page, w => { w.board.newLesson('canvas') })
  await page.waitForTimeout(250)
  check('a canvas has no page to fit and no zoom on a notebook', await page.locator('.zoombar').count() === 1)
  await fw(page, w => { w.board.newLesson('notebook') })
  await page.waitForTimeout(250)
  check('a notebook has no zoom buttons', await page.locator('.zoombar').count() === 0)

  // ── writing on the screen ──────────────────────────────────────────────────
  const pages = await fw(page, w => w.board.pageCount)
  await fw(page, w => { w.board.setColor('#ffffff') })
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Write on screen', exact: true }).click()
  await page.waitForTimeout(350)
  await sized(app, 1280, 720)
  check('only the small bar is left', await page.locator('.screen-bar').isVisible() && await page.locator('.boardbar').count() === 0 && await page.locator('.edge-tab').count() === 0 && await page.locator('.minibar').count() === 0)
  const clear = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll('.stage canvas')]
    return canvases.every(c => {
      const g = c.getContext('2d')
      if (!g || !c.width) return true
      return g.getImageData(c.width >> 1, c.height >> 1, 1, 1).data[3] === 0
    })
  })
  check('no paper, picture or margin is painted', clear)
  check('the window itself is see-through', await page.evaluate(() => {
    const seen = getComputedStyle(document.querySelector('.window')).getPropertyValue('--bg')
    const match = seen.match(/[\d.]+(?=\s*\)\s*$)/)
    return match ? Number(match[0]) < .01 : false
  }))
  check('the bar is small', await page.locator('.screen-bar').evaluate(el => el.getBoundingClientRect().height <= 80))
  await shot('screen')
  await page.getByRole('button', { name: 'Back to board', exact: true }).click()
  await page.waitForTimeout(350)
  await sized(app, 1280, 720)
  check('nothing written: the extra page goes away', await fw(page, w => w.board.pageCount) === pages)
  check('the board comes back solid', await fw(page, w => w.S.bgAlpha.value) === 100 && await page.locator('.boardbar').count() === 1)

  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Write on screen', exact: true }).click()
  await page.waitForTimeout(350)
  await sized(app, 1280, 720)
  await page.getByRole('button', { name: 'Ink #e5484d' }).click()
  await gesture(page, wave(300, 200, 200, 30), { type: 'pen' })
  check('the pen writes on the screen', await fw(page, w => w.board.doc.items.length) === 1)
  await page.getByRole('button', { name: 'Undo' }).click()
  check('undo works from the small bar', await fw(page, w => w.board.doc.items.length) === 0)
  await gesture(page, wave(300, 200, 200, 30), { type: 'pen' })
  await page.getByRole('button', { name: 'Back to board', exact: true }).click()
  await page.waitForTimeout(350)
  check('what was written is kept on a page of its own', await fw(page, w => w.board.pageCount) === pages + 1 && w_title(await fw(page, w => w.board.titleOf(1))))
  check('the lesson comes back to the page it was on', await fw(page, w => w.board.page) === 0)

  // A canvas has no page to give, so it moves clear of the lesson and back.
  await fw(page, w => { w.board.newLesson('canvas'); w.board.setTool('pen') })
  await page.waitForTimeout(250)
  await sized(app, 1280, 720)
  await gesture(page, wave(400, 300, 200, 30), { type: 'pen' })
  const homeView = await fw(page, w => w.board.view)
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Write on screen', exact: true }).click()
  await page.waitForTimeout(350)
  const away = await fw(page, w => { const v = w.board.view, b = w.board.doc.bounds(); return v.x > b[2] })
  check('on a canvas the screen starts clear of the lesson', away)
  await page.getByRole('button', { name: 'Back to board', exact: true }).click()
  await page.waitForTimeout(350)
  const backView = await fw(page, w => w.board.view)
  check('and the canvas comes back where it was', backView.x === homeView.x && backView.y === homeView.y, JSON.stringify({ homeView, backView }))
  await fw(page, w => { w.board.newLesson('notebook') })
  await page.waitForTimeout(250)

  // ── settings: no opacity, no layout question ───────────────────────────────
  await fw(page, w => { w.S.popover.value = 'settings' })
  await page.waitForTimeout(150)
  const text = await page.locator('.popover').first().innerText()
  check('settings has no opacity or layout choice', !/opacity|smart board|laptop/i.test(text))
  await fw(page, w => { w.S.popover.value = null })

  // ── lasso and hand have a home ─────────────────────────────────────────────
  await page.getByRole('button', { name: 'Select', exact: true }).first().click()
  check('tapping Select takes it in hand', await fw(page, w => w.S.tool.value) === 'select')
  await page.locator('.boardbar').getByRole('button', { name: 'Select', exact: true }).click()
  await page.waitForTimeout(120)
  await page.locator('.select-tools').getByRole('button', { name: 'Lasso', exact: true }).click()
  check('tapping again offers the lasso', await fw(page, w => w.S.tool.value) === 'lasso')

  // ── in a window, and it remembers ──────────────────────────────────────────
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'In a window', exact: true }).click()
  await page.waitForTimeout(450)
  check('leaving full screen is remembered', await fw(page, w => w.S.windowed.value === true && w.S.fullscreen.value === false))
  check('a window has a strip to move and close it', await page.locator('.window-bar').isVisible() && await page.getByRole('button', { name: /^Close/ }).isVisible())
  await sized(app, 900, 600)
  const small2 = await sheet(page), bar2 = await barTop(page), top2 = await stageTop(page)
  check('in a small window the page still clears the toolbar', top2 + small2.bottom <= bar2 + 1, JSON.stringify({ small2, bar2, top2 }))
  await shot('window')

  // ── icon packs ─────────────────────────────────────────────────────────────
  check('a canvas keeps its zoom buttons below the window strip', await fw(page, w => { w.board.newLesson('canvas') }).then(() => page.waitForTimeout(250)).then(() => page.evaluate(() => document.querySelector('.zoombar').getBoundingClientRect().top >= document.querySelector('.window-bar').getBoundingClientRect().bottom)))
  await fw(page, w => { w.board.newLesson('notebook'); w.S.iconPack.value = 'pictures'; w.S.popover.value = 'settings' })
  await page.waitForTimeout(200)
  check('settings offers the icon packs', await page.getByRole('button', { name: 'Simple lines', exact: true }).count() + await page.getByRole('radio', { name: 'Simple lines', exact: true }).count() === 1)
  const pictures = await page.locator('.boardbar img.art').count()
  await fw(page, w => { w.S.iconPack.value = 'plain'; w.S.popover.value = null })
  await page.waitForTimeout(200)
  check('simple lines takes the pictures away', pictures >= 8 && await page.locator('.boardbar img.art').count() === 0 && await page.locator('.boardbar svg').count() >= 10)
  await gesture(page, [[300, 300]], { up: false }); await page.waitForTimeout(650)
  check('the radial menu has marks in it too', await page.locator('.radial image').count() === 0 && await page.locator('.radial svg').count() >= 8)
  await page.evaluate(() => document.querySelector('.stage').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'mouse', clientX: 300, clientY: 300, buttons: 0, button: 0 })))
  await page.keyboard.press('Escape')
  await fw(page, w => { w.S.iconPack.value = 'pictures'; w.board.setSelection([]) })

  // ── pouring ────────────────────────────────────────────────────────────────
  const place = (kind, x, y) => fw(page, (w, a) => { const it = w.apparatus.newPart(w.apparatus.partOf(a.kind), a.x, a.y, 1, {}); w.board.insertSaved([it]); w.board.setSelection([]); return it.id }, { kind, x, y })
  const cap = (id) => fw(page, (w, id) => { const it = w.board.doc.items.find(i => i.id === id), part = w.apparatus.partOf(it.kind), v = w.board.view; return [((it.p[0] + 70 / part.w * (it.p[2] - it.p[0])) - v.x) * v.zoom, ((it.p[1] + 34 / part.h * (it.p[3] - it.p[1])) - v.y) * v.zoom] }, id)
  const levels = () => fw(page, w => w.board.doc.items.filter(i => i.t === 'a').map(i => Math.round(i.params.ml)))
  const poursInto = async (kind) => {
    await fw(page, w => { w.board.newLesson('notebook'); w.board.setTool('pen') })
    await page.waitForTimeout(150)
    const bottle = await place('reagent-bottle', 600, 20); await place(kind, 600, 320)
    const before = await levels()
    await gesture(page, [await cap(bottle)], { type: 'pen' }); await page.waitForTimeout(250)
    const after = await levels()
    return after[0] === before[0] - 10 && after[1] === before[1] + 10
  }
  check('a bottle pours 10 mL into a beaker, with the pen in hand', await poursInto('beaker'))
  check('and into another bottle', await poursInto('reagent-bottle'))
  check('and into a burette', await poursInto('burette'))

  // A part's settings stay above the toolbar on the owner's laptop screen (tools audit, finding 6).
  await fw(page, w => { w.board.newLesson('notebook'); w.board.setTool('select') })
  await page.waitForTimeout(150)
  await sized(app, 1280, 720)
  await place('evaporating-dish', 500, 500)
  await fw(page, w => { w.board.setSelection([w.board.doc.items[0]]) })
  await page.waitForTimeout(200)
  await page.locator('.selection-tools').getByRole('button', { name: 'Change its settings' }).click()
  await page.waitForTimeout(200)
  const settings = await page.evaluate(() => { const d = document.querySelector('.selection-detail').getBoundingClientRect(), b = document.querySelector('.boardbar').getBoundingClientRect(); return { detail: d.bottom, bar: b.top, top: d.top } })
  check('a part\'s settings end above the toolbar', settings.detail <= settings.bar, JSON.stringify(settings))
  await fw(page, w => { w.board.setSelection([]) })

  check('no renderer errors', !logs.some(l => /pageerror|\[error\]/.test(l)), logs.filter(l => /pageerror|\[error\]/.test(l)).slice(0, 4).join(' | '))
} catch (error) {
  check('the suite ran to the end', false, String(error).slice(0, 700))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)

function w_title(title) { return title === 'Written on the screen' }
