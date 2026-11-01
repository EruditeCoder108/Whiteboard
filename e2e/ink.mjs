// Pen styles, a tool per input, and slide to clear. Run: npm run e2e:ink
import { launch, check, summary, fw, gesture, shotDir } from './lib.mjs'
import { join } from 'node:path'

const { app, page, logs } = await launch({ layout: 'board' })
const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: join(shotDir, `ink-${name}.png`) }) }
const items = () => fw(page, w => w.board.doc.items.map(({ t, c, w: width, v, style }) => ({ t, c, width, v, style })))
const clear = () => fw(page, w => { w.board.clearBoard(); w.S.popover.value = null })
const wave = (y, x0 = 160) => Array.from({ length: 30 }, (_, i) => [x0 + i * 22, y + Math.sin(i * .5) * 30])
const tool = (name) => page.getByRole('toolbar', { name: 'Board tools' }).getByRole('button', { name, exact: true })

try {
  // ── pen styles ─────────────────────────────────────────────────────────────
  await fw(page, w => { w.board.convertTo('notebook'); w.board.setTool('pen'); w.S.penSize.value = 6 })
  await tool('Pen').click()
  check('tapping the pen in hand opens its choices', await page.locator('.pen-styles').isVisible())
  await shot('choices')
  const names = await page.locator('.pen-styles .tile span').allTextContents()
  check('five pens to choose from', names.join() === 'Pen,Pencil,Brush,Chalk,Marker', names.join())

  let y = 120
  for (const [label, style] of [['Pencil', 'pencil'], ['Brush', 'brush'], ['Chalk', 'chalk'], ['Marker', 'felt']]) {
    await page.locator('.pen-styles').getByRole('button', { name: label, exact: true }).click()
    check(`the toolbar button says ${label}`, await tool(label).isVisible())
    await page.keyboard.press('Escape')
    await gesture(page, wave(y), { type: 'touch', gap: 8 })
    y += 130
    const last = (await items()).at(-1)
    check(`${label} writes with its own style`, last?.style === style, JSON.stringify(last))
    await tool(label).click()
  }
  await page.locator('.pen-styles').getByRole('button', { name: 'Pen', exact: true }).click()
  await page.keyboard.press('Escape')
  await gesture(page, wave(y), { type: 'touch', gap: 8 })
  const all = await items()
  check('the plain pen stores no style', all.at(-1)?.style === undefined)
  check('each style has its own width', new Set(all.map(s => s.width)).size === 5, all.map(s => s.width).join())
  check('a brush follows speed even with a mouse', await (async () => {
    await fw(page, w => { w.S.penStyle.value = 'brush' })
    await gesture(page, wave(600, 900), { type: 'mouse', gap: 6 })
    const v = (await items()).at(-1).v
    await fw(page, w => { w.board.undo(); w.S.penStyle.value = 'pen' })
    return v
  })())
  await shot('styles')
  await fw(page, w => { w.board.setSurface({ color: '#22423a', texture: 'chalk' }) })
  await shot('styles-chalkboard')

  const saved = await fw(page, w => { const s = w.board.serialize(); w.board.load(s, { undoable: false }); return w.board.doc.items.map(i => i.style ?? 'pen').join() })
  check('every style survives saving and opening', saved === 'pencil,brush,chalk,felt,pen', saved)

  const dark = await fw(page, async w => {
    // what is painted on the page really is grainy: chalk leaves see-through gaps, the plain pen does not
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 60
    const ctx = cv.getContext('2d')
    const holes = async (style) => {
      ctx.clearRect(0, 0, 400, 60)
      const p = []; for (let i = 0; i < 40; i++) p.push(i * 10, 30, .5)
      w.paintItem(ctx, { t: 's', id: 'x', c: '#000000', w: 20, m: false, v: false, ...(style ? { style } : {}), p })
      const d = ctx.getImageData(40, 25, 300, 10).data
      let clear = 0
      for (let i = 3; i < d.length; i += 4) if (d[i] < 40) clear++
      return clear / (d.length / 4)
    }
    return { chalk: await holes('chalk'), pen: await holes() }
  })
  check('chalk really has gaps in it', dark.chalk > .05, String(dark.chalk))
  check('the plain pen is solid', dark.pen === 0, String(dark.pen))

  // ── a tool per input ───────────────────────────────────────────────────────
  await clear()
  await fw(page, w => { w.board.setSurface({ color: '#ffffff', texture: 'none' }); w.S.penColor.value = '#111827'; w.S.fingerRole.value = 'pen'; w.S.fingerInk.value = '#2fa66a'; w.S.tipRole.value = 'pen'; w.S.tipInk.value = '#2f6bff' })
  await gesture(page, wave(150), { type: 'touch', size: 20, gap: 8 })
  check('a finger writes in its own colour', (await items()).at(-1)?.c === '#2fa66a')
  check('the toolbar colour is left alone', await fw(page, w => w.S.penColor.value === '#111827' && w.S.override.value === null && w.S.inkOverride.value === null))
  await gesture(page, wave(280), { type: 'pen', gap: 8 })
  check('a real stylus writes as the thin tip', (await items()).at(-1)?.c === '#2f6bff')
  await page.waitForTimeout(800) // palm rejection ignores touches just after a stylus

  await fw(page, w => { w.S.tipMax.value = 8; w.S.thickMax.value = 16; w.S.thickRole.value = 'pen'; w.S.thickInk.value = '#e5484d' })
  await gesture(page, wave(410), { type: 'touch', size: 5, gap: 8 })
  check('measured: a thin touch is the tip', (await items()).at(-1)?.c === '#2f6bff')
  await gesture(page, wave(540), { type: 'touch', size: 12, gap: 8 })
  check('measured: a wider touch is the thick end', (await items()).at(-1)?.c === '#e5484d')

  const before = (await items()).length
  await fw(page, w => { w.S.fingerRole.value = 'eraser'; w.S.eraserMode.value = 'stroke' })
  await gesture(page, [[300, 110], [300, 200]], { type: 'touch', size: 22, gap: 8 })
  check('a finger set to eraser erases', (await items()).length < before, `${before} → ${(await items()).length}`)
  check('and the pen is back in hand afterwards', await fw(page, w => w.S.override.value === null && w.S.tool.value === 'pen'))

  const count = (await items()).length
  await fw(page, w => { w.S.fingerRole.value = 'move' })
  await gesture(page, wave(200, 900), { type: 'touch', size: 22, gap: 8 })
  check('a finger set to move draws nothing', (await items()).length === count)

  await fw(page, w => { w.S.fingerRole.value = 'eraser'; w.board.setTool('select') })
  await gesture(page, [[300, 410], [300, 560]], { type: 'touch', size: 22, gap: 8 })
  check('with Select in hand, a finger does not erase', (await items()).length === count)

  await fw(page, w => { w.board.setTool('pen'); w.S.tipRole.value = 'same'; w.S.thickRole.value = 'same'; w.S.fingerRole.value = 'same'; w.S.tipMax.value = 0; w.S.thickMax.value = 0; w.S.popover.value = 'inputs' })
  await page.waitForSelector('.inputs-card')
  await shot('inputs')
  await page.locator('.input-row').nth(2).getByRole('button', { name: 'Pen', exact: true }).click()
  check('the sheet sets the finger', await fw(page, w => w.S.fingerRole.value === 'pen'))
  await page.locator('.input-row').nth(2).locator('.swatch').first().click()
  await page.getByRole('button', { name: 'Measure my stylus' }).click()
  const touch = (size) => page.evaluate((size) => {
    const el = document.querySelector('.input-measure')
    for (const type of ['pointerdown', 'pointerup']) el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', pointerId: 9, width: size, height: size }))
  }, size)
  for (const size of [4, 10, 24]) { await touch(size); await page.waitForTimeout(80) }
  const limits = await fw(page, w => [w.S.tipMax.value, w.S.thickMax.value])
  check('measuring finds limits between the three', limits[0] > 4 && limits[0] < 10 && limits[1] > 10 && limits[1] < 24, limits.join())
  await page.getByRole('button', { name: 'Done' }).click()
  await fw(page, w => { w.S.fingerRole.value = 'same'; w.S.tipMax.value = 0; w.S.thickMax.value = 0 })

  // ── slide to clear ─────────────────────────────────────────────────────────
  await fw(page, w => w.board.setTool('eraser'))
  await tool('Eraser').click()
  const thumb = page.getByRole('button', { name: 'Clear this page' })
  const box = await thumb.boundingBox()
  const track = await page.locator('.slide-clear').boundingBox()
  await shot('slide')
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2
  const drag = async (to) => {
    await page.evaluate(async ({ cx, cy, to }) => {
      const el = document.querySelector('.slide-thumb')
      const fire = (type, x) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', pointerId: 7, clientX: x, clientY: cy }))
      el.setPointerCapture = () => {}
      fire('pointerdown', cx)
      await new Promise(r => setTimeout(r, 40))
      for (let i = 1; i <= 10; i++) { fire('pointermove', cx + (to - cx) * i / 10); await new Promise(r => setTimeout(r, 16)) }
      fire('pointerup', to)
    }, { cx, cy, to })
    await page.waitForTimeout(120)
  }
  const had = (await items()).length
  check('there is ink to clear', had > 0)
  await drag(cx + 60)
  check('a short slide clears nothing', (await items()).length === had)
  await drag(track.x + track.width - 10)
  check('a full slide clears the page', (await items()).length === 0)
  check('with an Undo button', await page.getByRole('button', { name: 'Undo', exact: true }).first().isVisible())
  await fw(page, w => w.board.undo())
  check('and undo brings it back', (await items()).length === had)

  const errors = logs.filter(l => l.startsWith('[pageerror]') || l.startsWith('[error]'))
  check('no errors in the console', errors.length === 0, errors.slice(0, 3).join(' | '))
} catch (error) {
  check('the suite ran to the end', false, String(error))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
