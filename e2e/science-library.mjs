import { launch, appDir, fw, check as report, summary, gesture } from './lib.mjs'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
const target = join(appDir, 'docs', 'showcase-qa', 'library'); mkdirSync(target, { recursive: true })
let session = await launch({ inputIsolated: true }), { app, page } = session
const checks = [], errors = [], network = [], evidence = { recordedAt: new Date().toISOString(), checks, models: [], network, errors }
const check = (name, ok) => { checks.push({ name, passed: !!ok }); report(name, ok) }
async function isolate() {
  page.setDefaultTimeout(10000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  page.on('pageerror', e => errors.push(e.message)); await page.route(/^https?:\/\//, r => { network.push(r.request().url()); return r.abort() })
  await app.evaluate(({ BrowserWindow }) => { for (const win of BrowserWindow.getAllWindows()) win.hide() })
  await fw(page, w => { w.S.radialEnabled.value = false; window.__libraryTimer = setInterval(() => { cancelAnimationFrame(w.board.raf); w.board.frame() }, 16) })
}
async function captureUi(name) {
  const data = await app.evaluate(async ({ BrowserWindow, screen }) => {
    const win = BrowserWindow.getAllWindows()[0], wasVisible = win.isVisible()
    const outside = Math.max(...screen.getAllDisplays().map(d => d.bounds.x + d.bounds.width)) + 200
    win.setPosition(outside, 40); win.setFocusable(false); win.setIgnoreMouseEvents(true); win.showInactive(); await new Promise(resolve => setTimeout(resolve, 160))
    try { return (await win.capturePage(undefined, { stayAwake: true })).toPNG().toString('base64') } finally { if (!wasVisible) win.hide() }
  })
  writeFileSync(join(target, name), Buffer.from(data, 'base64'))
}
async function open() { await page.getByRole('button', { name: 'Science labs', exact: true }).click(); await page.getByTestId('science-library').waitFor() }
try {
  await isolate(); await gesture(page, [[90, 90], [110, 95], [130, 88]], { type: 'pen' })
  const original = await fw(page, w => w.board.doc.items[0])
  await open()
  check('Three showcases are featured on library entry', await page.locator('.science-card').count() === 3)
  await page.getByRole('button', { name: 'Browse all', exact: true }).click()
  check('All fourteen offline experiments appear in the library', await page.locator('.science-card').count() === 14)
  const button = await page.locator('.science-card').first().locator('.science-primary').evaluate(el => { const r = el.getBoundingClientRect(), icon = el.querySelector('svg').getBoundingClientRect(), text = el.querySelector('span').getBoundingClientRect(); return { r: { width: r.width, height: r.height }, icon: { width: icon.width, height: icon.height }, text: { height: text.height }, aligned: Math.abs((icon.top + icon.height / 2) - (text.top + text.height / 2)) < 2 } })
  check('Insertion button icon stays small and label stays on one aligned line', button.icon.width <= 17 && button.icon.height <= 17 && button.text.height < 20 && button.aligned)
  evidence.button = button
  await captureUi('library-wide.png')
  await page.getByRole('button', { name: /^Chemistry\s*4$/ }).click()
  check('Subject navigation filters four chemistry experiments', await page.locator('.science-card').count() === 4)
  await page.getByRole('button', { name: /^Biology\s*2$/ }).click()
  check('Biology navigation retains circulation and adds the heart showcase', await page.locator('.science-card[data-concept=circulation]').count() === 1 && await page.locator('.science-card').count() === 2)
  await page.getByRole('button', { name: /^Maths\s*0$/ }).click()
  check('Empty subjects have an honest roadmap state', await page.getByText('Maths is on the roadmap.', { exact: true }).isVisible() && await page.locator('.science-primary').count() === 0)
  await page.getByRole('button', { name: 'Show all experiments', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Search animations' }).fill('vinegar')
  check('Search discovers both reaction apparatus versions by chemical name', await page.locator('.science-card').count() === 2 && await page.locator('.science-card[data-concept=apparatus]').count() === 1)
  await page.getByRole('searchbox', { name: 'Search animations' }).press('Escape')
  check('Escape clears search without losing the library', await page.getByTestId('science-library').isVisible() && await page.locator('.science-card').count() === 14)
  const ui = await fw(page, w => w.S.uiHidden.value)
  await page.getByRole('searchbox', { name: 'Search animations' }).press('Tab')
  check('Tab navigates library controls without hiding the interface', await fw(page, w => w.S.uiHidden.value) === ui && await page.getByTestId('science-library').isVisible())
  await page.getByRole('button', { name: 'Close science catalogue', exact: true }).click()
  const defs = await fw(page, w => w.science.models.map(m => ({ id: m.id, title: m.title, defaults: m.defaults, params: m.params, duration: m.duration(m.defaults) })))
  for (const model of defs) {
    await open(); await page.getByRole('searchbox', { name: 'Search animations' }).fill(model.title)
    await page.getByRole('button', { name: model.id === 'projectile' ? 'Insert projectile lab' : `Insert ${model.title} lab`, exact: true }).click()
    check(`${model.title}: inserts a native editable object`, await fw(page, (w, id) => w.board.selection[0].model === id, model.id))
    const before = await fw(page, w => ({ json: w.board.serialize(), undo: w.board.history.undoStack.length }))
    await page.getByRole('button', { name: 'Play lab', exact: true }).click(); await page.waitForTimeout(160); await page.getByRole('button', { name: 'Pause lab', exact: true }).click()
    check(`${model.title}: play is transient and advances`, await fw(page, (w, b) => w.board.labTime(w.board.selection[0]) > 0 && w.board.serialize() === b.json && w.board.history.undoStack.length === b.undo, before))
    const key = Object.keys(model.params)[0], spec = model.params[key], next = spec.choices ? 1 : Math.min(spec.max, model.defaults[key] + spec.step)
    if (spec.choices) await page.getByRole('combobox', { name: spec.label, exact: true }).selectOption(String(next))
    else { await page.getByRole('spinbutton', { name: spec.label, exact: true }).fill(String(next)); await page.getByRole('spinbutton', { name: spec.label, exact: true }).evaluate(el => el.blur()) }
    check(`${model.title}: parameter edit is one undo step and restarts time`, await fw(page, (w, v) => w.board.selection[0].params[v.key] === v.next && w.board.labTime(w.board.selection[0]) === 0 && w.board.history.undoStack.length === v.undo + 1, { key, next, undo: before.undo }))
    await fw(page, w => w.board.undo())
    check(`${model.title}: undo restores its scientific parameters`, await fw(page, (w, d) => JSON.stringify(w.board.selection[0].params) === JSON.stringify(d), model.defaults))
    if (model.id === 'matter') {
      await page.getByRole('spinbutton', { name: 'Visible particles', exact: true }).fill('36.5')
      await page.getByRole('spinbutton', { name: 'Visible particles', exact: true }).evaluate(el => el.blur())
      check('Particle counts reject fractions with a visible validation error', await page.getByRole('alert').isVisible() && await fw(page, w => w.board.selection[0].params.count) === 36)
      await page.getByRole('spinbutton', { name: 'Visible particles', exact: true }).fill('36')
      await page.getByRole('spinbutton', { name: 'Visible particles', exact: true }).evaluate(el => el.blur())
    }
    await page.getByRole('button', { name: 'Explain', exact: true }).click()
    const t = model.id === 'apparatus' ? 3.9 : model.id === 'optics' || model.id === 'reactions' ? 3 : model.id === 'projectile' ? model.duration / 2 : 1.4
    await page.getByRole('slider', { name: 'Lab time', exact: true }).evaluate((el, t) => { el.value = String(t); el.dispatchEvent(new Event('input', { bubbles: true })) }, t)
    await page.getByRole('button', { name: 'Save this frozen starting frame', exact: true }).click()
    check(`${model.title}: scrub and freeze store its exact instant`, await fw(page, (w, t) => Math.abs(w.board.selection[0].frozenTime - t) < 0.0011, t))
    const png = await fw(page, w => { const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 640; const it = w.board.selection[0]; w.science.paintLab(canvas.getContext('2d'), { ...it, p: [0, 0, 1000, 640] }, it.frozenTime); return canvas.toDataURL('image/png') })
    writeFileSync(join(target, `demo-${model.id}.png`), Buffer.from(png.split(',')[1], 'base64'))
    evidence.models.push({ id: model.id, params: model.defaults, frozenTime: t, state: await fw(page, (w, v) => w.science.modelState(v.id, v.params, v.t), { id: model.id, params: model.defaults, t }) })
  }
  const png = await fw(page, async w => {
    const bytes = new Uint8Array(await w.board.exportPng('#ffffff', true, 1)), bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    return { magic: [...bytes.slice(0, 8)], bytes: bytes.length, width: bitmap.width, height: bitmap.height }
  })
  check('Board PNG export decodes with the mixed fourteen-model document', png.magic.join(',') === '137,80,78,71,13,10,26,10' && png.bytes > 10000 && png.width > 500)
  evidence.png = png
  check('The original pen stroke survives all fourteen insertions', await fw(page, (w, original) => JSON.stringify(w.board.doc.items.find(it => it.id === original.id)) === JSON.stringify(original), original))
  await open(); await page.getByRole('button', { name: 'On this board 14', exact: true }).click()
  check('On-board library lists all fourteen editable labs', await page.locator('.science-board-lab').count() === 14)
  await page.getByRole('button', { name: 'Focus Colour-change reaction 14', exact: true }).click()
  check('On-board navigation focuses the existing apparatus without creating a duplicate', await fw(page, w => w.board.selection[0].model === 'apparatus' && w.board.doc.items.filter(it => it.t === 'l').length === 14))
  await page.getByRole('button', { name: 'Freeze & annotate', exact: true }).click(); await gesture(page, [[180, 160], [195, 145], [215, 160]], { type: 'pen' })
  check('Reaction apparatus accepts ordinary undoable ink annotations', await fw(page, w => w.board.doc.items.at(-1).t === 's' && w.board.doc.items.filter(it => it.t === 'l').length === 14))
  await open()
  check('Library avoids overlapping active inspector and transport', !await page.getByTestId('science-inspector').isVisible() && !await page.getByTestId('science-transport').isVisible())
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(420, 320)); await page.waitForTimeout(150)
  const compact = await page.getByTestId('science-library').evaluate(el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: innerWidth, h: innerHeight, noHorizontalScroll: el.scrollWidth <= el.clientWidth + 1 } })
  check('Library stays inside the minimum window without horizontal scrolling', compact.left >= 0 && compact.top >= 28 && compact.right <= compact.w && compact.bottom <= compact.h && compact.noHorizontalScroll)
  evidence.compact = compact
  await page.getByRole('combobox', { name: 'Animation subject', exact: true }).selectOption('chemistry'); await page.getByRole('searchbox', { name: 'Search animations' }).fill('vinegar')
  await page.getByRole('button', { name: 'Insert Colour-change reaction lab', exact: true }).scrollIntoViewIfNeeded()
  const actionBounds = await page.getByRole('button', { name: 'Insert Colour-change reaction lab', exact: true }).evaluate(el => { const a = el.getBoundingClientRect(), c = el.closest('.science-library-content').getBoundingClientRect(); return { top: a.top, bottom: a.bottom, contentTop: c.top, contentBottom: c.bottom } })
  evidence.compactAction = actionBounds
  check('Compact insertion button is fully inside its scrollable content', actionBounds.top >= actionBounds.contentTop && actionBounds.bottom <= actionBounds.contentBottom + 1)
  await captureUi('library-compact.png')
  check('Compact library keeps the chemistry insertion action reachable', await page.getByRole('button', { name: 'Insert Colour-change reaction lab', exact: true }).isVisible())
  await page.getByRole('button', { name: 'Close science catalogue', exact: true }).click()
  await app.close()
  const saved = JSON.parse(readFileSync(join(session.userData, 'board.json'), 'utf8'))
  check('Disk save contains fourteen native labs with frozen parameters', saved.items.filter(it => it.t === 'l').length === 14 && saved.version === 3)
  session = await launch({ userData: session.userData, inputIsolated: true }); ({ app, page } = session); await isolate()
  check('Restart restores all fourteen native labs and annotations', await fw(page, w => w.board.doc.items.filter(it => it.t === 'l').length === 14 && w.board.doc.items.filter(it => it.t === 's').length === 2))
  await open(); await page.getByRole('button', { name: 'On this board 14', exact: true }).click(); await page.getByRole('button', { name: 'Focus Colour-change reaction 14', exact: true }).click()
  check('Reopened apparatus retains its exact saved chemistry and time', await fw(page, w => { const it = w.board.selection[0]; return it.params.acid === 30 && it.params.base === 50 && Math.abs(it.frozenTime - 3.9) < 0.001 }))
  check('Every demonstration operates with external renderer requests blocked', network.length === 0)
  check('No uncaught renderer exceptions', errors.length === 0)
} finally { await app.close(); writeFileSync(join(target, 'library-results.json'), JSON.stringify(evidence, null, 2)) }
process.exitCode = summary() ? 1 : 0
