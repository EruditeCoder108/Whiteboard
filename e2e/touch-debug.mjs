// What does Chromium really deliver for a REAL finger that presses and holds?
import { _electron as electron } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appDir } from './lib.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const inj = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(appDir, 'e2e', 'os', 'inject.ps1')], { stdio: ['pipe', 'pipe', 'ignore'] })
const waiters = []; let buf = ''
inj.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); waiters.shift()?.(l) } })
await new Promise((res) => waiters.push(res))
const run = (s) => new Promise((res) => { waiters.push(res); inj.stdin.write(s + '\n') })
process.on('exit', () => { try { inj.kill() } catch {} })

const app = await electron.launch({ args: [appDir, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'fw-td-'))}`], cwd: appDir })
process.on('exit', () => { try { app.process().kill() } catch {} })
const page = await app.firstWindow()
await page.waitForSelector('.stage')
const scale = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().scaleFactor)
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 160, y: 90, width: 900, height: 520 }))
await sleep(600)
await page.evaluate(() => {
  window.__log = []
  const t0 = performance.now()
  for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'contextmenu', 'touchstart', 'touchend', 'touchcancel', 'gotpointercapture', 'lostpointercapture'])
    document.addEventListener(t, (e) => window.__log.push(`${Math.round(performance.now() - t0)}ms ${t}${e.pointerType ? ' ' + e.pointerType : ''}`), true)
})
const x = Math.round((160 + 600) * scale), y = Math.round((90 + 330) * scale)
await run(`t 1 ${x} ${y} d; w 1100`)
console.log('while the finger is STILL DOWN (1.1 s):')
console.log('  radial open:', (await page.locator('.radial').count()) === 1, '  mode:', await page.evaluate(() => 'n/a'))
console.log('  events:', JSON.stringify(await page.evaluate(() => window.__log)))
await run(`t 1 ${x} ${y} u; w 300`)
console.log('after lifting:', JSON.stringify(await page.evaluate(() => window.__log.slice(-4))))
await app.close()
inj.kill()
process.exit(0)
