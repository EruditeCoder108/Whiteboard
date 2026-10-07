// Launch the PACKAGED app (dist/win-unpacked) and make sure it really works.
import { _electron as electron } from 'playwright'
import { mkdtempSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appDir, check, gesture, summary, wave, shotDir } from './lib.mjs'

const expectedVersion = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8')).version
const exe = join(appDir, 'dist', 'win-unpacked', 'Floating Whiteboard.exe')
check('packaged exe exists', existsSync(exe))
const dir = mkdtempSync(join(tmpdir(), 'fw-pkg-'))
const app = await electron.launch({ executablePath: exe, args: [`--user-data-dir=${dir}`] })
const page = await app.firstWindow()
const logs = []
page.on('console', (m) => logs.push(m.text()))
page.on('pageerror', (e) => logs.push('pageerror ' + e.message))
await page.waitForSelector('.stage', { timeout: 20000 })
await page.waitForFunction(() => window.__fw.S.ready.value)
await gesture(page, wave(200, 200, 60, 20, 5), { type: 'pen', pressure: 'wave' })
check('packaged app draws', (await page.evaluate(() => window.__fw.itemCount())) === 1)
const info = await app.evaluate(({ app, BrowserWindow }) => ({
  version: app.getVersion(), name: app.getName(), packaged: app.isPackaged,
  transparent: BrowserWindow.getAllWindows()[0].getBackgroundColor()
}))
console.log('  ', JSON.stringify(info))
check('app reports itself as packaged', info.packaged === true)
check('packaged version matches the current release', info.version === expectedVersion)
await page.waitForFunction(() => window.__fw.S.saveStatus.value === 'saved')
check('packaged autosave is confirmed on disk', JSON.parse(readFileSync(join(dir, 'board.json'), 'utf8')).items.length === 1)
await page.screenshot({ path: join(shotDir, 'packaged.png') })
check('no console errors', logs.length === 0, logs.join(' | '))
await app.close()
check('packaged close flushes settings and board', existsSync(join(dir, 'settings.json')) && JSON.parse(readFileSync(join(dir, 'board.json'), 'utf8')).items.length === 1)
process.exit(summary() ? 1 : 0)
