// The real Export sheet, local server and in-memory PDF, with a throw-away off-screen profile.
import { get } from 'node:http'
import { join } from 'node:path'
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { launch, check, summary, fw, gesture, wave, appDir } from './lib.mjs'

const shotDir = join(appDir, '.work', 'share-shots')
mkdirSync(shotDir, { recursive: true })

const fetchLocal = (url) => new Promise((resolve, reject) => {
  const req = get(url, { agent: false, timeout: 5000 }, res => {
    const chunks = []
    res.on('data', chunk => chunks.push(chunk))
    res.on('end', () => resolve({ code: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }))
    res.on('error', reject)
  })
  req.on('error', reject)
  req.on('timeout', () => req.destroy(new Error('Local share timed out')))
})
const stopped = async (url) => {
  try { return (await fetchLocal(url)).code === 404 } catch { return true }
}
const { app, page, logs } = await launch({ layout: 'board' })
const open = async () => {
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await page.getByRole('button', { name: 'Share to phones', exact: true }).click()
  await page.getByRole('dialog', { name: 'Share to phones' }).waitFor()
}
const start = async () => {
  await page.getByRole('button', { name: 'Start sharing', exact: true }).click()
  await page.locator('[data-share-url]').waitFor({ timeout: 30000 })
  await page.locator('.share-qr[src^="data:image/png"]').waitFor()
  return page.locator('[data-share-url]').innerText()
}

try {
  check('nothing is shared at launch', !(await page.evaluate(() => window.api.share.status())).active)
  await gesture(page, wave(300, 350, 40, 25, 7), { type: 'pen', pressure: .6 })
  await open()
  check('opening the panel does not start a listener', !(await page.evaluate(() => window.api.share.status())).active)
  check('the same Wi-Fi and no cloud upload requirements are plain', (await page.locator('.share-head').innerText()).includes('same Wi-Fi') && (await page.locator('.share-head').innerText()).includes('No cloud upload'))
  const addresses = await page.evaluate(() => window.api.share.addresses())
  if (!addresses.length) throw new Error('This PC has no usable network: live sharing cannot be verified here.')
  const url = await start()
  check('the URL uses the selected interface', new URL(url).hostname === addresses[0].address)
  const landing = await fetchLocal(url), pdf = await fetchLocal(url + 'lesson.pdf')
  check('the phone page offers the named lesson PDF', landing.code === 200 && landing.body.toString().includes('Download PDF') && landing.body.toString().includes('Untitled lesson'))
  check('the exported bytes are a PDF attachment', pdf.code === 200 && pdf.body.subarray(0, 4).toString() === '%PDF' && pdf.headers['content-type'] === 'application/pdf' && pdf.headers['content-disposition'].includes('attachment'))
  await page.waitForFunction(() => document.querySelector('.share-count')?.textContent === '1 PDF download')
  check('the panel shows the completed download', (await page.locator('.share-count').innerText()) === '1 PDF download')
  const qr = await page.locator('.share-qr').boundingBox()
  check('the QR is at least 280 pixels on the smart board', qr.width >= 280 && qr.height >= 280)
  const stop = page.getByRole('button', { name: 'Stop sharing', exact: true })
  const button = await stop.boundingBox()
  check('Stop sharing is a large visible touch target', await stop.isVisible() && button.height >= 48 && button.width >= 48)
  check('the panel explains expiry and common school network problems', (await page.locator('.share-body').innerText()).includes('Sharing ends in') && (await page.locator('.share-body').innerText()).includes('guest') && (await page.locator('.share-body').innerText()).includes('Private networks'))
  await page.screenshot({ path: join(shotDir, 'share-live.png') })
  await stop.click()
  await page.getByRole('button', { name: 'Start sharing', exact: true }).waitFor()
  check('Stop closes the server and invalidates the URL', await stopped(url) && !(await page.evaluate(() => window.api.share.status())).active)

  const second = await start()
  check('a new session has a fresh token', second !== url)
  await page.getByRole('button', { name: 'Close sharing' }).click()
  await page.getByRole('dialog', { name: 'Share to phones' }).waitFor({ state: 'hidden' })
  check('closing the panel stops sharing', await stopped(second))

  await open(); const third = await start()
  // New lesson uses the normal archive/open lifecycle, including when an unsaved lesson is unnamed.
  await fw(page, w => { void w.lessonState.lesson.newLesson() }) // the old lesson saves itself first
  await page.waitForFunction(async () => !(await window.api.share.status()).active)
  check('replacing the lesson stops sharing', await stopped(third))
  await page.getByRole('button', { name: 'Close sharing' }).click()
  await gesture(page, wave(300, 350, 40, 25, 7), { type: 'pen', pressure: .6 })

  await open(); const fourth = await start()
  const manual = join(mkdtempSync(join(tmpdir(), 'fw-share-pdf-')), 'Manual.pdf')
  await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }) }, manual)
  await page.getByRole('button', { name: 'Save PDF instead' }).click()
  await page.locator('.toast').filter({ hasText: 'PDF saved' }).waitFor()
  check('Save PDF instead stops sharing and keeps manual PDF export working', await stopped(fourth) && readFileSync(manual).subarray(0, 4).toString() === '%PDF')

  // Opening a different lesson follows the real file dialog and stops the old snapshot.
  const lessonFile = join(tmpdir(), `fw-share-open-${Date.now()}.wbd`)
  writeFileSync(lessonFile, await fw(page, w => w.board.serialize()))
  await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }) }, lessonFile)
  await open(); const fifth = await start()
  await fw(page, w => { void w.lessonState.lesson.open() })
  await page.waitForFunction(async () => !(await window.api.share.status()).active)
  check('opening another lesson stops sharing', await stopped(fifth))
  await page.getByRole('button', { name: 'Close sharing' }).click()
  await page.getByRole('dialog', { name: 'Share to phones' }).waitFor({ state: 'hidden' })

  // A smaller laptop viewport keeps Stop fixed while the body scrolls, including dark boards.
  await fw(page, w => { w.S.layout.value = 'laptop'; w.board.setColor('#1f232b') })
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ width: 1100, height: 750 }))
  await page.keyboard.press('Control+e')
  await page.getByRole('button', { name: 'Share to phones', exact: true }).click()
  const small = await start()
  const smallStop = await page.getByRole('button', { name: 'Stop sharing', exact: true }).boundingBox()
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }))
  check('Stop stays in reach on a smaller laptop screen', smallStop.y >= 0 && smallStop.y + smallStop.height <= viewport.height)
  await page.screenshot({ path: join(shotDir, 'share-laptop-dark.png') })
  await page.keyboard.press('Escape')
  await page.getByRole('dialog', { name: 'Share to phones' }).waitFor({ state: 'hidden' })
  check('Escape also stops sharing', await stopped(small))
  await fw(page, w => { w.S.layout.value = 'board' })

  // Exercise the no-network UI without changing the host's network configuration.
  await app.evaluate(({ ipcMain }) => { ipcMain.removeHandler('share:addresses'); ipcMain.handle('share:addresses', () => []) })
  await open()
  await page.locator('.share-no-network').waitFor()
  check('offline fallback explains USB and offers Save PDF', (await page.locator('.share-no-network').innerText()) === "This PC isn't on a network. Save the PDF and share it by USB instead." && await page.getByRole('button', { name: 'Save PDF', exact: true }).isVisible() && await page.getByRole('button', { name: 'Start sharing', exact: true }).count() === 0)
  await page.screenshot({ path: join(shotDir, 'share-no-network.png') })
  await page.getByRole('button', { name: 'Close sharing' }).click()
  check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.join(' | '))

  await app.evaluate(({ ipcMain }, networks) => { ipcMain.removeHandler('share:addresses'); ipcMain.handle('share:addresses', () => networks) }, addresses)
  await open(); const last = await start()
  await app.close()
  check('quitting the app closes the server', await stopped(last))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
