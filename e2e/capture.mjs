// Real chooser, crop gestures and lesson insertion; screen pixels are a deterministic, local fixture.
import { launch, check, summary, fw, gesture, wave, appDir } from './lib.mjs'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

const shots = join(appDir, '.work', 'capture-shots')
mkdirSync(shots, { recursive: true })
const { app, page, logs } = await launch({ layout: 'board' })
const open = async () => {
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Capture', exact: true }).click()
  await page.getByRole('dialog', { name: 'Capture to lesson' }).waitFor()
}
const closed = () => page.locator('.capture-shade').waitFor({ state: 'hidden' })
const screenTile = () => page.locator('[data-source-kind="screen"]').first()
const snapshot = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(w => ({ opacity: w.getOpacity(), bounds: w.getBounds(), top: w.isAlwaysOnTop(), visible: w.isVisible() })))
const control = values => app.evaluate((_, values) => Object.assign(globalThis.__captureQA, values), values)
const area = async (a, b) => page.evaluate(({ a, b }) => {
  const el = document.querySelector('.capture-picture'), r = el.getBoundingClientRect()
  const event = (name, p, buttons) => new PointerEvent(name, { bubbles: true, cancelable: true, pointerId: 41, pointerType: 'touch', isPrimary: true, button: 0, buttons, clientX: r.left + r.width * p[0], clientY: r.top + r.height * p[1] })
  el.dispatchEvent(event('pointerdown', a, 1)); el.dispatchEvent(event('pointermove', b, 1)); el.dispatchEvent(event('pointerup', b, 0))
}, { a, b })

try {
  await gesture(page, wave(300, 350, 40, 25, 7), { type: 'pen', pressure: .6 })
  await open()
  const own = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(w => w.getMediaSourceId().split(':').slice(0, 2).join(':')))
  // This enumerates the real desktop; no screenshots or window titles are written to the test log.
  const native = await page.evaluate(() => window.api.capture.sources()).catch(() => [])
  check('the real source list leaves our windows out', !native.some(s => s.kind === 'window' && own.includes(s.id.split(':').slice(0, 2).join(':'))))
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await closed()

  const fixture = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 3200; c.height = 1800
    const x = c.getContext('2d'); x.fillStyle = '#f3f6fb'; x.fillRect(0, 0, 3200, 1800)
    x.fillStyle = '#1b4f59'; x.fillRect(0, 0, 3200, 330)
    x.fillStyle = '#fff'; x.font = 'bold 120px Segoe UI'; x.fillText('A classroom slide', 150, 220)
    x.fillStyle = '#fff'; x.fillRect(150, 440, 1850, 1140)
    x.fillStyle = '#172033'; x.font = '80px Segoe UI'; x.fillText('Capture what matters', 270, 650)
    x.fillStyle = '#4262ff'; x.fillRect(270, 800, 1470, 32); x.fillRect(270, 920, 1190, 32)
    x.fillStyle = '#eaad56'; x.beginPath(); x.arc(2520, 950, 310, 0, Math.PI * 2); x.fill()
    return c.toDataURL('image/png')
  })
  const screenId = await app.evaluate(({ desktopCapturer, nativeImage, screen, BrowserWindow }, png) => {
    const image = nativeImage.createFromDataURL(png), display = screen.getPrimaryDisplay()
    const id = `screen:${display.id}:0`
    globalThis.__captureQA = { fail: false, black: false, observations: [], fullRequests: [] }
    desktopCapturer.getSources = async options => {
      const qa = globalThis.__captureQA, full = options.thumbnailSize.width > 480
      if (full) {
        qa.fullRequests.push(options.thumbnailSize)
        qa.observations.push({ kind: options.types[0], opacity: BrowserWindow.getAllWindows().map(w => w.getOpacity()) })
        if (qa.fail) throw new Error('Synthetic compositor failure')
      }
      const thumb = qa.black && full ? nativeImage.createFromBuffer(Buffer.from([0, 0, 0, 255]), { width: 1, height: 1 }) : full ? image : image.resize({ width: 480 })
      return [
        { id, name: 'Entire screen', display_id: String(display.id), thumbnail: thumb, appIcon: null },
        { id: 'window:987654321:0', name: 'Lesson slide — browser', display_id: '', thumbnail: thumb, appIcon: image.resize({ width: 28 }) },
        ...BrowserWindow.getAllWindows().map(w => ({ id: w.getMediaSourceId(), name: w.getTitle(), display_id: '', thumbnail: thumb, appIcon: null }))
      ].filter(s => options.types.includes(s.id.startsWith('screen:') ? 'screen' : 'window'))
    }
    return id
  }, fixture)
  const scaled = await app.evaluate(({ nativeImage }, png) => {
    const raw = Buffer.from(png.split(',')[1], 'base64'), image = nativeImage.createFromBuffer(raw, { scaleFactor: 2 })
    const selected = image.toPNG({ scaleFactor: Math.max(...image.getScaleFactors()) })
    return { width: selected.readUInt32BE(16), height: selected.readUInt32BE(20) }
  }, fixture)
  check('native image scaling preserves all source pixels', scaled.width === 3200 && scaled.height === 1800)

  await open()
  await screenTile().waitFor()
  check('chooser has large screen and window thumbnail tiles', await page.locator('.capture-source').count() === 2 && await page.locator('.capture-thumbnail img').count() === 2)
  const tile = await screenTile().boundingBox()
  check('source tiles are large touch targets', tile.width >= 200 && tile.height >= 150)
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await screenTile().waitFor()
  check('Refresh rebuilds the source list without our own windows', await page.locator('.capture-source').count() === 2)
  await page.screenshot({ path: join(shots, 'capture-chooser.png') })
  await screenTile().click()
  await page.locator('.capture-picture').waitFor()
  check('Use this area waits for a selection', await page.getByRole('button', { name: 'Use this area', exact: true }).isDisabled())
  await area([.2, .2], [.65, .65])
  await page.locator('[data-corner="se"]').waitFor()
  const handle = await page.locator('[data-corner="se"]').boundingBox()
  check('crop corners have 44-pixel or larger touch handles', handle.width >= 44 && handle.height >= 44)
  const before = await page.locator('.capture-status').innerText()
  const picture = await page.locator('.capture-picture').boundingBox()
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down(); await page.mouse.move(picture.x + picture.width * .8, picture.y + picture.height * .75, { steps: 6 }); await page.mouse.up()
  const selected = await page.locator('.capture-status').innerText()
  check('touch selects an area and dragging a corner adjusts it', selected !== before && !await page.getByRole('button', { name: 'Use this area', exact: true }).isDisabled())
  const actionsFit = await page.evaluate(() => [...document.querySelectorAll('.capture-footer button')].every(b => { const r = b.getBoundingClientRect(); return r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }))
  check('all crop actions stay inside the smart-board window', actionsFit)
  await page.screenshot({ path: join(shots, 'capture-region.png') })
  await page.getByRole('button', { name: 'Use this area', exact: true }).click(); await closed()
  const inserted = await fw(page, w => ({ pages: w.board.pageCount, current: w.board.page, item: w.board.doc.items[0], tool: w.S.tool.value }))
  const [cw, ch] = selected.match(/\d+/g).map(Number)
  check('a cropped, locked picture lands on a new notebook page after the ink', inserted.pages === 2 && inserted.current === 1 && inserted.item.t === 'i' && inserted.item.locked && inserted.item.src.startsWith('data:image/webp'))
  check('placement preserves the crop aspect ratio with a small sheet margin', Math.abs(inserted.item.aspect - cw / ch) < .01 && inserted.item.p[0] >= 32 && inserted.item.p[1] >= 32 && inserted.item.p[2] <= 1568 && inserted.item.p[3] <= 868)
  const saved = await fw(page, w => w.board.serialize())
  await page.keyboard.press('Control+z')
  check('Ctrl+Z removes the capture', await fw(page, w => w.board.pageCount) === 1)
  await fw(page, (w, json) => w.board.load(json, { undoable: false }), saved)
  check('serialization and loading keep the locked picture and its pixels', await fw(page, (w, src) => w.board.doc.items[0]?.locked && w.board.doc.items[0].src === src, inserted.item.src))
  await gesture(page, wave(300, 420, 40, 25, 7), { type: 'pen', pressure: .6 })
  check('the teacher can write on the locked capture immediately', await fw(page, w => w.board.doc.items.some(i => i.t === 's') && w.board.doc.items.some(i => i.t === 'i' && i.locked)))

  const qa = await app.evaluate(({ screen }) => ({ ...globalThis.__captureQA, display: screen.getPrimaryDisplay() }))
  check('the screen grab requests physical pixels and hides the board', qa.fullRequests[0].width === Math.round(qa.display.size.width * qa.display.scaleFactor) && qa.fullRequests[0].height === Math.round(qa.display.size.height * qa.display.scaleFactor) && qa.observations[0].opacity.every(o => o === 0))
  await fw(page, w => w.board.newLesson('notebook'))
  await page.keyboard.press('Control+Shift+c'); await screenTile().waitFor(); await screenTile().click()
  await page.getByRole('button', { name: 'Use whole screen', exact: true }).click(); await closed()
  check('a whole screen reuses an empty notebook page', await fw(page, w => w.board.pageCount === 1 && w.board.doc.items.length === 1 && w.board.doc.items[0].locked))

  await open(); await page.locator('[data-source-kind="window"]').click(); await closed()
  const last = await app.evaluate(() => globalThis.__captureQA.observations.at(-1))
  check('window capture inserts directly without hiding the board', last.kind === 'window' && last.opacity.every(o => o === 1) && await fw(page, w => w.board.pageCount === 2 && w.board.doc.items[0].locked))
  const pixels = await fw(page, async w => { const img = new Image(); await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = w.board.doc.items[0].src }); return [img.naturalWidth, img.naturalHeight] })
  check('only the existing image pipeline downsizes the result, to at most 2400 pixels', Math.max(...pixels) === 2400)

  await page.evaluate(() => window.api.win.setPassthrough(true))
  await page.waitForFunction(() => window.__fw.S.passthrough.value)
  await app.evaluate(async ({ BrowserWindow }) => { for (let i = 0; i < 100; i++) { const windows = BrowserWindow.getAllWindows(); if (windows.length === 2 && windows.every(w => w.isVisible())) break; await new Promise(r => setTimeout(r, 20)) } })
  const windowBefore = await snapshot()
  await control({ fail: true })
  const failed = await page.evaluate(id => window.api.capture.grab(id), screenId)
  const windowAfter = await snapshot()
  const mode = await fw(page, w => ({ passthrough: w.S.passthrough.value, fullscreen: w.S.fullscreen.value }))
  check('capture failure restores board and floating controls exactly', !failed.ok && JSON.stringify(windowBefore) === JSON.stringify(windowAfter) && mode.passthrough && mode.fullscreen, JSON.stringify({ failed, windowBefore, windowAfter, mode }))
  check('the floating controls are hidden during a screen grab too', (await app.evaluate(() => globalThis.__captureQA.observations.at(-1))).opacity.every(o => o === 0))
  await page.evaluate(() => window.api.win.setPassthrough(false)); await page.waitForFunction(() => !window.__fw.S.passthrough.value)
  await control({ fail: false, black: true })
  await open(); await screenTile().click()
  await page.getByRole('alert').waitFor()
  check('a black capture is rejected with an honest protected-window hint', (await page.getByRole('alert').innerText()) === 'That window could not be captured (it may be protected). Try capturing the whole screen instead.')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await closed(); await control({ black: false })

  await fw(page, w => { w.board.newLesson('canvas'); w.S.layout.value = 'laptop'; w.board.setColor('#1f232b') })
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ width: 1100, height: 750 }))
  await page.evaluate(() => { const input = document.createElement('input'); input.id = 'capture-typing-test'; document.body.append(input); input.focus() })
  await page.keyboard.press('Control+Shift+c')
  check('the capture shortcut is ignored while typing', await page.locator('.capture-shade').count() === 0)
  await page.evaluate(() => document.getElementById('capture-typing-test').remove())
  // The laptop Insert menu and the shortcut reach the same chooser.
  await fw(page, w => { w.S.popover.value = 'insert' })
  await page.getByRole('button', { name: 'Capture screen…', exact: false }).click()
  await screenTile().waitFor(); await screenTile().click(); await page.locator('.capture-picture').waitFor()
  await area([.15, .15], [.8, .8])
  const use = await page.getByRole('button', { name: 'Use this area', exact: true }).boundingBox()
  check('the dark laptop crop keeps its actions inside the window', use.y >= 0 && use.y + use.height <= await page.evaluate(() => innerHeight))
  await page.screenshot({ path: join(shots, 'capture-laptop-dark.png') })
  await page.getByRole('button', { name: 'Use this area', exact: true }).click(); await closed()
  check('canvas captures use a frame and retain the locked picture', await fw(page, w => w.board.frameList.length === 1 && w.board.doc.items[0].locked))
  await page.keyboard.press('Control+Shift+c'); await screenTile().waitFor(); await page.keyboard.press('Escape'); await closed()
  check('Escape closes the chooser and releases thumbnail elements', await page.locator('.capture-source img').count() === 0)
  check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.join(' | '))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
