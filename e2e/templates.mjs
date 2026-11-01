// Templates, measured papers and playing fields, picture crop. Run: npm run e2e:templates
import { launch, check, summary, fw, shotDir } from './lib.mjs'
import { join } from 'node:path'

const { app, page, logs } = await launch({ layout: 'board' })
const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: join(shotDir, `templates-${name}.png`) }) }
const more = async (label) => { await page.getByRole('button', { name: 'More', exact: true }).click(); await page.getByRole('button', { name: label, exact: true }).click() }

try {
  await fw(page, w => w.board.convertTo('notebook'))
  // ── templates ──────────────────────────────────────────────────────────────
  await more('Templates')
  await page.waitForSelector('.template-grid')
  await shot('sheet')
  const tiles = await page.locator('.template-tile').count()
  check('eight templates to choose from', tiles === 8, String(tiles))
  const inked = await page.locator('.template-sample').first().evaluate(cv => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n })
  check('each tile shows the real template', inked > 100, String(inked))
  for (const name of ['Timeline', 'Venn diagram', 'KWL chart', 'Cycle', 'Worksheet']) {
    await fw(page, w => { w.board.addPage(); w.S.popover.value = 'templates' })
    await page.locator('.template-tile', { hasText: name }).click()
    await page.waitForTimeout(120)
    const r = await fw(page, w => {
      const v = w.board.visibleRect(), b = w.board.doc.bounds(w.board.doc.items)
      return { count: w.board.doc.items.length, inside: b[0] >= v[0] && b[1] >= v[1] && b[2] <= v[2] && b[3] <= v[3], selected: w.board.selection.length }
    })
    check(`${name} lands inside the page, selected`, r.count > 0 && r.inside && r.selected === r.count, JSON.stringify(r))
    await fw(page, w => w.board.setSelection([]))
    await shot(name.toLowerCase().replace(' ', '-'))
  }
  const undone = await fw(page, w => { w.board.undo(); return w.board.doc.items.length })
  check('one undo takes a whole template away', undone === 0, String(undone))

  // a timeline event can be retyped and its line follows
  await fw(page, w => w.board.addPage())
  await fw(page, w => { w.S.popover.value = 'templates' })
  await page.locator('.template-tile', { hasText: 'Timeline' }).click()
  const follows = await fw(page, w => {
    const card = w.board.doc.items.find(i => i.text === 'Event 1'), line = w.board.doc.items.find(i => i.k === 'line' && i.from?.id === card.id)
    const before = line.p.join()
    w.board.setSelection([card]); w.board.nudgeSelection(0, -30)
    return before !== w.board.doc.items.find(i => i.id === line.id).p.join()
  })
  check('a timeline line follows its card', follows)

  // ── papers and fields ──────────────────────────────────────────────────────
  for (const paper of ['semilog', 'polar', 'football', 'cricket', 'basketball', 'kabaddi']) {
    await fw(page, (w, p) => { w.board.addPage(); w.board.setPaper(p) }, paper)
    await shot(`paper-${paper}`)
    const saved = await fw(page, w => w.board.here?.paper ?? w.S.grid.value)
    check(`${paper} is the page's paper`, saved === paper, String(saved))
  }
  const dark = await fw(page, w => { w.board.setSurface({ color: '#22423a', texture: 'chalk' }, true); return w.S.grid.value })
  await shot('paper-kabaddi-dark')
  check('a field stays on a dark board', dark === 'kabaddi')
  const survived = await fw(page, w => { const pg = w.board.page ?? 0; w.board.load(w.board.serialize(), { undoable: false }); return w.S.grid.value })
  check('it survives saving and opening', survived === 'kabaddi', survived)
  await fw(page, w => { w.board.setSurface({ color: '#ffffff', texture: 'none' }); w.board.addPage(); w.S.popover.value = 'paper' })
  await page.waitForSelector('.paper-sheet')
  check('the picker offers the new papers', await page.locator('.paper-tile', { hasText: 'Log-log' }).isVisible() && await page.getByText('Playing fields').isVisible())
  await page.locator('.paper-tile', { hasText: 'Kabaddi' }).scrollIntoViewIfNeeded()
  await shot('picker')
  await fw(page, w => { w.S.popover.value = null })

  // ── crop ───────────────────────────────────────────────────────────────────
  await fw(page, w => {
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 200
    const g = cv.getContext('2d'); g.fillStyle = '#ff0000'; g.fillRect(0, 0, 200, 200); g.fillStyle = '#0000ff'; g.fillRect(200, 0, 200, 200)
    w.board.insertImage(cv.toDataURL(), 400, 200)
    w.board.setTool('select'); w.board.setSelection([w.board.doc.items.at(-1)])
  })
  await page.waitForTimeout(120)
  const before = await fw(page, w => { const it = w.board.doc.items.at(-1); return { p: [...it.p], aspect: it.aspect } })
  await page.getByRole('button', { name: 'Crop the picture' }).click()
  await page.waitForSelector('.crop-stage img')
  await page.waitForTimeout(120)
  const stage = await page.locator('.crop-stage').boundingBox()
  await shot('crop-sheet')
  const fire = (selector, type, x, y) => page.evaluate(({ selector, type, x, y }) => {
    const el = document.querySelector(selector)
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 11, pointerType: 'touch', clientX: x, clientY: y, button: 0 }))
  }, { selector, type, x, y })
  await fire('.capture-corner.se', 'pointerdown', stage.x + stage.width, stage.y + stage.height)
  await page.waitForTimeout(30)
  await fire('.crop-stage', 'pointermove', stage.x + stage.width * .5, stage.y + stage.height)
  await page.waitForTimeout(30)
  await fire('.crop-stage', 'pointerup', stage.x + stage.width * .5, stage.y + stage.height)
  await page.waitForTimeout(60)
  await shot('crop-frame')
  await page.locator('.dialog-btn', { hasText: /^Crop$/ }).click()
  await page.waitForTimeout(200)
  const after = await fw(page, w => { const it = w.board.doc.items.at(-1); return { p: [...it.p], aspect: it.aspect, selected: w.board.selection.length } })
  check('the picture is the left half now', Math.abs(after.aspect - before.aspect / 2) < .05, JSON.stringify(after))
  check('and it stays where that half was', Math.abs(after.p[0] - before.p[0]) < 1 && Math.abs((after.p[2] - after.p[0]) - (before.p[2] - before.p[0]) / 2) < 1.5, JSON.stringify({ before, after }))
  const colours = await page.evaluate(async () => {
    const it = window.__fw.board.doc.items.at(-1), img = new Image()
    img.src = it.src
    await img.decode()
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0)
    const d = g.getImageData(cv.width - 2, 2, 1, 1).data
    return { red: d[0] > 150, blue: d[2] > 150, width: cv.width }
  })
  check('only the red part is left, at full resolution', colours.red && !colours.blue && colours.width === 200, JSON.stringify(colours))
  await fw(page, w => w.board.undo())
  check('undo brings the whole picture back', await fw(page, (w, a) => Math.abs(w.board.doc.items.at(-1).aspect - a) < .01, before.aspect))

  const bg = await fw(page, w => { const it = w.board.doc.items.at(-1); w.board.setSelection([it]); return w.board.pictureToBackground(it) })
  await page.waitForTimeout(150)
  check('a picture goes behind the writing', bg === true)
  await fw(page, w => { w.S.popover.value = 'paper' })
  await page.waitForSelector('.paper-sheet')
  await page.getByRole('button', { name: 'Crop the picture' }).click()
  await page.waitForSelector('.crop-stage img')
  await page.waitForTimeout(120)
  const s2 = await page.locator('.crop-stage').boundingBox()
  await fire('.capture-corner.nw', 'pointerdown', s2.x, s2.y)
  await fire('.crop-stage', 'pointermove', s2.x + s2.width * .5, s2.y)
  await fire('.crop-stage', 'pointerup', s2.x + s2.width * .5, s2.y)
  await page.waitForTimeout(60)
  const artBefore = await fw(page, w => w.S.here.value.art.src.length)
  await page.locator('.dialog-btn', { hasText: /^Crop$/ }).click()
  await page.waitForTimeout(150)
  const artAfter = await fw(page, w => { const a = w.S.here.value.art; return { len: a.src.length, webp: a.src.startsWith('data:image/webp') } })
  check('the background picture crops too', artAfter.webp && artAfter.len !== artBefore, JSON.stringify(artAfter))

  check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.filter(l => /pageerror|\[error\]/.test(l)).slice(0, 2).join(' | '))
} catch (error) {
  check('the suite ran to the end', false, String(error).slice(0, 500))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
