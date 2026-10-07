import { _electron as electron } from 'playwright'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appDir } from './lib.mjs'

const electronExe = createRequire(import.meta.url)(join(appDir, 'node_modules', 'electron'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const inj = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(appDir, 'e2e', 'os', 'inject.ps1')], { stdio: ['pipe', 'pipe', 'ignore'] })
const waiters = []; let buf = ''
inj.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); waiters.shift()?.(l) } })
await new Promise((res) => waiters.push(res))
const run = (s) => new Promise((res) => { waiters.push(res); inj.stdin.write(s + '\n') })
const backdrop = spawn(electronExe, [join(appDir, 'e2e', 'os', 'backdrop.cjs')], { stdio: ['ignore', 'pipe', 'inherit'] })
const bd = []
await new Promise((res) => backdrop.stdout.on('data', (d) => { for (const l of String(d).split('\n')) { if (l.startsWith('READY')) res(); if (/^CLICK/.test(l)) bd.push(l.trim()) } }))
const done = () => { try { inj.kill() } catch {} try { backdrop.kill() } catch {} }
process.on('exit', done)
await sleep(800)
const app = await electron.launch({ args: [appDir, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'fw-pt-'))}`], cwd: appDir })
process.on('exit', () => { try { app.process().kill() } catch {} })
const page = await app.firstWindow()
await page.waitForSelector('.stage')
const scale = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().scaleFactor)
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 160, y: 90, width: 900, height: 520 }))
await sleep(600)
const ph = (x, y) => [Math.round((160 + x) * scale), Math.round((90 + y) * scale)]
const nwin = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)
const st = async () => JSON.stringify({ pass: await page.evaluate(() => window.__fw.S.passthrough.value), windows: await nwin(), items: await page.evaluate(() => window.__fw.itemCount()), clicks: bd.length })

const btn = await page.getByRole('button', { name: /Pass-through: click/ }).boundingBox()
const bx = btn.x + btn.width / 2, by = btn.y + btn.height / 2
console.log('button centre', Math.round(bx), Math.round(by), ' → screen px', ph(bx, by))
console.log('0) start                       ', await st())
await run(`m ${ph(bx, by).join(' ')}; w 200; md; w 50; mu; w 800`)
console.log('1) real click on the button    ', await st())
await run(`m ${ph(500, 400).join(' ')}; w 250; md; w 50; mu; w 400`)
console.log('2) real click on the board     ', await st())
await run('k ctrl+shift+space; w 800')
console.log('3) global hotkey               ', await st())
await run('k ctrl+shift+space; w 800')
console.log('4) global hotkey again         ', await st())
await app.close(); done(); process.exit(0)
