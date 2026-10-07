import { launch, gesture, wave, fw, itemCount, check, summary, shotDir } from './lib.mjs'
import { mkdirSync, rmdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

let session = await launch()
let { app, page, userData, logs } = session
const waitSaved = () => page.waitForFunction(() => window.__fw.S.saveStatus.value === 'saved' && !window.__fw.S.settingsError.value)
const shot = async (name) => {
  await page.waitForTimeout(250)
  return page.screenshot({ path: join(shotDir, name + '.png') })
}

try {
  await page.waitForFunction(() => window.__fw.S.ready.value)
  await gesture(page, wave(240, 160, 30))
  await gesture(page, wave(240, 260, 30))
  await waitSaved()
  check('save indicator reflects confirmed board saves', (await page.getByTestId('save-status').innerText()) === 'Saved')

  await page.keyboard.press('Control+a')
  await page.locator('.colordot').click()
  check('colour panel preserves selection and shows its properties', (await fw(page, (w) => w.S.selectionCount.value)) === 2 && await page.locator('.selection-props').count() === 1)
  await page.locator('.selection-props .swatch').nth(7).click()
  check('swatch recolours selected objects', await fw(page, (w) => w.board.selection.every((it) => it.c === '#2f6bff')))
  await page.keyboard.press('Control+z')
  check('undo recolour preserves all selected objects', await fw(page, (w) => w.board.selection.length === 2 && w.board.selection.every((it) => it.c === '#111827')))
  // One object already matches: undo must retain unchanged members of the selection as well.
  await fw(page, (w) => w.board.setSelection([w.board.doc.items[0]]))
  await page.locator('.selection-props .swatch').nth(7).click()
  await page.keyboard.press('Control+a')
  await page.locator('.selection-props .swatch').nth(7).click()
  await page.keyboard.press('Control+z')
  check('undo a partial style change retains the full mixed selection', await fw(page, (w) => w.board.selection.length === 2 && new Set(w.board.selection.map((it) => it.c)).size === 2))
  const slider = page.getByRole('slider', { name: 'Selection thickness' })
  await slider.evaluate((el) => {
    el.value = '12'
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  check('thickness applies to the selection', await fw(page, (w) => w.board.selection.every((it) => it.w === 12)))
  await page.keyboard.press('Control+z')
  check('one undo restores the previous thickness', await fw(page, (w) => w.board.selection.length === 2 && w.board.selection.every((it) => it.w === 3)))
  await page.keyboard.press('Control+y')
  await page.waitForFunction(() => document.querySelector('.selection-props .val').textContent === '12')
  await shot('phase1-selection')
  await page.keyboard.press('Escape')
  await page.keyboard.press('p')
  await waitSaved()

  // Force a real disk error rather than mocking the bridge.
  const obstacle = join(userData, 'board.json.tmp')
  const before = readFileSync(join(userData, 'board.json'), 'utf8')
  mkdirSync(obstacle)
  await gesture(page, wave(240, 360, 30))
  await page.waitForFunction(() => window.__fw.S.saveStatus.value === 'error')
  check('failed write shows a retry control and preserves the previous file', (await page.getByTestId('save-status').innerText()) === 'Retry save' && readFileSync(join(userData, 'board.json'), 'utf8') === before)
  await page.evaluate(() => window.api.win.close())
  await page.waitForFunction(() => !window.__fw.S.closing.value && window.__fw.S.saveStatus.value === 'error')
  check('failed close keeps the board open with unsaved work', await itemCount(page) === 3 && await page.locator('.stage').isVisible())
  await shot('phase1-save-error')
  rmdirSync(obstacle)
  await page.getByTestId('save-status').click()
  await waitSaved()
  check('retry saves unsaved work after the disk error is cleared', JSON.parse(readFileSync(join(userData, 'board.json'), 'utf8')).items.length === 3)

  // Both preferences and the view must survive an immediate close (before debounce).
  await fw(page, (w) => { w.S.radialEnabled.value = false; w.S.radialDelay.value = 1000; w.board.panBy(90, 40) })
  const expectedView = await fw(page, (w) => w.board.view)
  await app.close()
  session = await launch({ userData })
  ;({ app, page } = session)
  logs.push(...session.logs)
  await page.waitForFunction(() => window.__fw.S.ready.value)
  check('close flushes the board, pending preferences and view', await fw(page, (w, v) => w.board.doc.items.length === 3 && !w.S.radialEnabled.value && w.S.radialDelay.value === 1000 && Math.abs(w.board.view.x - v.x) < .01 && Math.abs(w.board.view.y - v.y) < .01, expectedView))
  await gesture(page, [[450, 450]], { hold: 700 })
  check('disabling hold menu allows a deliberate long pen press', await page.locator('.radial').count() === 0 && await itemCount(page) === 4)
  await waitSaved()

  // Create a controlled snapshot using the real store IPC, then restore through the menu UI.
  const snapshot = await page.evaluate(() => window.api.store.listBackups())
  check('recovery snapshots are available', snapshot.length > 0)
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await page.getByRole('button', { name: 'Recovery backups…' }).click()
  await page.waitForSelector('.backup-row')
  await shot('phase1-recovery')
  const currentCount = await itemCount(page)
  await page.locator('.backup-row').first().click()
  await page.waitForFunction(() => window.__fw.S.popover.value === null)
  check('recovery panel restores a previous snapshot', await itemCount(page) < currentCount)
  await page.keyboard.press('Control+z')
  check('backup restoration is undoable', await itemCount(page) === currentCount)

  // Legacy import uses the ordinary file dialog pathway, with the dialog stubbed in main.
  const legacyPath = join(userData, 'python-v10.wbd')
  writeFileSync(legacyPath, JSON.stringify({ version: 1, view: { x: 0, y: 0, z: 1 }, items: [
    { t: 'ink', c: '#2f6bff', w: 4, m: 0, v: 0, p: [10, 10, 100, 60] },
    { t: 'shape', s: 'ellipse', c: '#e5484d', w: 3, p: [120, 10, 240, 100] }
  ] }))
  await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }) }, legacyPath)
  await page.keyboard.press('Control+o')
  await page.waitForFunction(() => window.__fw.board.doc.items.length === 2)
  check('Python board imports through the normal open command', await fw(page, (w) => w.board.doc.items[0].t === 's' && w.board.doc.items[1].t === 'h'))
  await page.keyboard.press('Control+z')
  check('legacy import is undoable', await itemCount(page) === currentCount)
  await waitSaved()

  // Settings remain accessible at the minimum supported window size.
  await page.evaluate(() => window.api.win.setBounds({ width: 420, height: 320 }))
  await page.getByRole('button', { name: 'Board settings', exact: true }).click()
  const fits = await page.locator('.settings').evaluate((el) => {
    const r = el.getBoundingClientRect()
    return r.top >= 0 && r.bottom <= window.innerHeight && el.scrollHeight > el.clientHeight
  })
  check('settings scroll within a small window instead of being clipped', fits)
  await shot('phase1-small-window')
  await page.keyboard.press('Escape')
  await page.evaluate(() => window.api.win.setBounds({ width: 1100, height: 720 }))

  // A damaged primary at startup automatically falls back to a readable snapshot.
  const validBackups = await page.evaluate(() => window.api.store.listBackups())
  const recoveryJson = await page.evaluate((id) => window.api.store.loadBackup(id), validBackups[0].id)
  const recoveryCount = JSON.parse(recoveryJson).items.length
  await app.close()
  writeFileSync(join(userData, 'board.json'), '{damaged-autosave')
  session = await launch({ userData })
  ;({ app, page } = session)
  await page.waitForFunction(() => window.__fw.S.ready.value)
  check('startup recovers from a damaged autosave', await itemCount(page) === recoveryCount && (await page.locator('.toast').innerText()).includes('Recovered'))
  await app.close()
  app = null
  check('repaired autosave retains the damaged original', readdirSync(userData).some((name) => name.startsWith('board-damaged-')))
  logs.push(...session.logs)

  // With no usable backup, merely opening and closing must preserve damaged data.
  const damagedOnly = await launch()
  await damagedOnly.app.close()
  writeFileSync(join(damagedOnly.userData, 'board.json'), '{unrecoverable-original')
  const untouched = await launch({ userData: damagedOnly.userData })
  await untouched.page.waitForFunction(() => window.__fw.S.ready.value)
  await untouched.app.close()
  check('opening and closing an unrecoverable board does not replace its original', readFileSync(join(damagedOnly.userData, 'board.json'), 'utf8') === '{unrecoverable-original')
  const errors = logs.filter((l) => /\[error\]|\[pageerror\]/.test(l) && !/DevTools|Autofill/.test(l))
  check('no renderer errors during phase 1 flows', errors.length === 0, errors.join(' | '))
} finally {
  if (app) {
    // Test-created obstacles are empty and always confined to this disposable profile.
    try { rmdirSync(join(userData, 'board.json.tmp')) } catch {}
    await app.close()
  }
}
process.exit(summary() ? 1 : 0)
