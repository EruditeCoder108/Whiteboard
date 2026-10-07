// NSIS launches a child Electron process without forwarding its inspector pipe.
// Attach to the renderer through its local DevTools port to test the actual wrapper.
import { chromium } from 'playwright'
import { extractFile } from '@electron/asar'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { appDir, check, fw, gesture, shotDir, summary, wave } from './lib.mjs'

const version = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8')).version
const exe = join(appDir, 'dist', `Floating-Whiteboard-portable-${version}.exe`)
const userData = process.argv[2] ?? mkdtempSync(join(tmpdir(), 'fw-portable-'))
const child = process.argv[2] ? null : spawn(exe, [`--user-data-dir=${userData}`, '--remote-debugging-port=0'], { windowsHide: true, stdio: 'ignore' })
let browser, page
try {
  check('portable release executable exists', existsSync(exe))
  const portFile = join(userData, 'DevToolsActivePort'), deadline = Date.now() + 120000
  while (!existsSync(portFile) && Date.now() < deadline) await new Promise(r => setTimeout(r, 100))
  if (!existsSync(portFile)) throw new Error('Portable launcher did not become ready')
  const port = Number(readFileSync(portFile, 'utf8').split('\n')[0])
  while (!browser && Date.now() < deadline) {
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 3000 }) }
    catch { await new Promise(r => setTimeout(r, 200)) }
  }
  if (!browser) throw new Error('Portable debugging endpoint did not become ready')
  page = browser.contexts()[0].pages()[0]
  await page.waitForSelector('.stage'); await page.waitForFunction(() => window.__fw?.S.ready.value)
  const logs = []
  page.on('pageerror', e => logs.push(e.message))
  const path = fileURLToPath(page.url()), asar = path.slice(0, path.indexOf('app.asar') + 'app.asar'.length)
  const payload = JSON.parse(extractFile(asar, 'package.json').toString())
  check('portable wrapper starts the current packaged payload', payload.version === version && asar.includes('resources'))
  await page.evaluate(() => window.api.win.setBounds({ x: 4000, y: 80, width: 1000, height: 700 }))
  await page.waitForTimeout(200)
  await fw(page, w => { w.S.radialEnabled.value = false; w.board.setView({ x: 0, y: 0, zoom: 1 }) })
  await gesture(page, wave(180, 180, 50, 20, 5), { type: 'pen', pressure: 'wave' })
  check('portable app draws pressure-sensitive ink', await fw(page, w => w.board.doc.items.length === 1 && w.board.doc.items[0].v))
  await page.keyboard.press('n'); await gesture(page, [[240, 340]])
  await page.getByRole('textbox', { name: 'Sticky note text' }).fill('Portable and editable')
  await page.keyboard.press('Control+Enter')
  check('portable app creates editable notes', await fw(page, w => w.board.doc.items.length === 2 && w.board.selection[0].note))
  const agent = await page.evaluate(() => window.api.agent.enable())
  check('portable extraction includes its agent adapter', agent.enabled && existsSync(join(userData, 'whiteboard-mcp.cjs')))
  const connection = JSON.parse(readFileSync(join(userData, 'agent-connection.json'), 'utf8'))
  const read = await fetch(connection.endpoint + '/call', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.token}` }, body: JSON.stringify({ name: 'whiteboard_read', arguments: {} }) }).then(r => r.json())
  check('portable agent connection reads the actual editable board', read.ok && read.objects.some(it => it.text === 'Portable and editable'))
  await page.evaluate(() => window.api.agent.disable())
  check('portable agent access is revocable', !existsSync(join(userData, 'agent-connection.json')))
  await page.waitForFunction(() => window.__fw.S.saveStatus.value === 'saved')
  check('portable autosave writes all new objects to disk', JSON.parse(readFileSync(join(userData, 'board.json'), 'utf8')).items.length === 2)
  await page.screenshot({ path: join(shotDir, `portable-${version}.png`) })
  check('portable renderer has no errors', logs.length === 0, logs.join(' | '))
  const closed = page.waitForEvent('close', { timeout: 15000 })
  await page.evaluate(() => window.api.win.close())
  await closed
  check('portable shutdown flushes preferences and editable content', existsSync(join(userData, 'settings.json')) && JSON.parse(readFileSync(join(userData, 'board.json'), 'utf8')).items.some(it => it.text === 'Portable and editable'))
} finally {
  if (page && !page.isClosed()) await page.evaluate(() => window.api.win.close()).catch(() => {})
  await browser?.close().catch(() => {})
  if (child && child.exitCode === null) await new Promise(r => { child.once('exit', r); setTimeout(r, 3000) })
}
process.exit(summary() ? 1 : 0)
