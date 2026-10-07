// Finds how transparent the board may get before Windows stops delivering mouse input to it.
// For each alpha: put the board over a backdrop window, inject a REAL mouse click in the middle and
// see who receives it (the whiteboard or the backdrop).  Also saves what the screen looks like.
import { _electron as electron } from 'playwright'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appDir, shotDir } from './lib.mjs'

const electronExe = createRequire(import.meta.url)(join(appDir, 'node_modules', 'electron'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const inj = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(appDir, 'e2e', 'os', 'inject.ps1')], { stdio: ['pipe', 'pipe', 'inherit'] })
const waiters = []
let buf = ''
inj.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); waiters.shift()?.(l) } })
await new Promise((res) => waiters.push(res))
const run = (s) => new Promise((res) => { waiters.push(res); inj.stdin.write(s + '\n') })

const backdrop = spawn(electronExe, [join(appDir, 'e2e', 'os', 'backdrop.cjs')], { stdio: ['ignore', 'pipe', 'inherit'] })
const clicks = []
await new Promise((res) => backdrop.stdout.on('data', (d) => { for (const l of String(d).split('\n')) { if (l.startsWith('READY')) res(); if (l.startsWith('CLICK')) clicks.push(l) } }))
const done = () => { try { inj.kill() } catch {} try { backdrop.kill() } catch {} }
process.on('exit', done)
await sleep(800)

const app = await electron.launch({ args: [appDir, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'fw-probe-'))}`], cwd: appDir })
process.on('exit', () => { try { app.process().kill() } catch {} })
const page = await app.firstWindow()
await page.waitForSelector('.stage')
const scale = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().scaleFactor)
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 160, y: 90, width: 900, height: 520 }))
await sleep(600)
await page.evaluate(() => { window.__hits = 0; document.querySelector('.stage').addEventListener('pointerdown', () => window.__hits++) })

const capture = async (name) => {
  const b64 = await app.evaluate(async ({ desktopCapturer, screen }) => {
    const d = screen.getPrimaryDisplay()
    const s = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: Math.round(d.size.width * d.scaleFactor), height: Math.round(d.size.height * d.scaleFactor) } })
    return s[0].thumbnail.toPNG().toString('base64')
  })
  writeFileSync(join(shotDir, name + '.png'), Buffer.from(b64, 'base64'))
}

const setAlpha = (a) => page.evaluate((a) => document.querySelector('.window').style.setProperty('--bg', `rgba(255,255,255,${a})`), a)
const px = (x, y) => [Math.round((160 + x) * scale), Math.round((90 + y) * scale)]

for (const a of [1, 0.004, 0.01, 0.02, 0.03, 0.05, 0.1]) {
  await setAlpha(a)
  await sleep(400)
  clicks.length = 0
  const hits0 = await page.evaluate(() => window.__hits)
  await run(`m ${px(450, 300).join(' ')}; w 120; md; w 40; mu; w 200`)
  const hits = (await page.evaluate(() => window.__hits)) - hits0
  console.log(`alpha ${String(a).padEnd(6)} → whiteboard got ${hits} press(es), backdrop got ${clicks.length}`)
  if (a === 1 || a === 0.004) await capture('probe-alpha-' + a)
}
await app.close()
done()
process.exit(0)
