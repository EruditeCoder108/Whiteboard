import { _electron as electron } from 'playwright'
import { mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const appDir = join(here, '..')
export const shotDir = join(appDir, 'e2e', 'shots')
mkdirSync(shotDir, { recursive: true })

/** Launch the built app with a throw-away profile; returns { app, page, logs, userData }. */
export async function launch({ userData, executablePath } = {}) {
  const dir = userData ?? mkdtempSync(join(tmpdir(), 'fw-e2e-'))
  const app = await electron.launch({
    ...(executablePath ? { executablePath } : {}),
    args: [...(executablePath ? [] : [appDir]), `--user-data-dir=${dir}`],
    cwd: appDir
  })
  const page = await app.firstWindow()
  const logs = []
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
  await page.waitForSelector('.stage', { timeout: 15000 })
  await page.waitForFunction(() => window.__fw?.S.ready.value)
  await page.waitForTimeout(600)
  return { app, page, logs, userData: dir }
}

/**
 * Dispatch a pointer gesture on the stage.
 *   pts: [[x,y], …] in stage CSS px
 *   type: 'mouse' | 'pen' | 'touch'
 *   pressure: number | 'ramp' | 'wave'
 *   hold: ms to wait after the down event (for long-press)
 *   gap: ms between move events (a real pen reports every ~5-8 ms)
 */
export async function gesture(page, pts, opts = {}) {
  const o = { type: 'mouse', pressure: 0.5, buttons: 1, button: 0, shift: false, id: 1, down: true, up: true, hold: 0, gap: 6, ...opts }
  await page.evaluate(
    async ({ pts, o }) => {
      const el = document.querySelector('.stage')
      const r = el.getBoundingClientRect()
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms))
      const press = (i) =>
        o.pressure === 'ramp' ? 0.15 + 0.8 * (i / Math.max(1, pts.length - 1))
        : o.pressure === 'wave' ? 0.5 + 0.45 * Math.sin(i * 0.25)
        : o.pressure
      const mk = (name, p, b, pr) =>
        new PointerEvent(name, {
          bubbles: true, cancelable: true, composed: true,
          pointerId: o.id, pointerType: o.type, isPrimary: o.id === 1,
          clientX: r.left + p[0], clientY: r.top + p[1],
          screenX: p[0], screenY: p[1],
          pressure: pr, button: name === 'pointermove' ? -1 : o.button, buttons: b, shiftKey: o.shift
        })
      if (o.down) el.dispatchEvent(mk('pointerdown', pts[0], o.buttons, press(0)))
      if (o.hold) await sleep(o.hold)
      for (let i = 1; i < pts.length; i++) {
        el.dispatchEvent(mk('pointermove', pts[i], o.buttons, press(i)))
        if (o.gap) await sleep(o.gap)
      }
      if (o.up) el.dispatchEvent(mk('pointerup', pts[pts.length - 1], 0, 0))
    },
    { pts, o }
  )
}

/** a hover (no buttons) move */
export async function hover(page, x, y, type = 'mouse') {
  await page.evaluate(({ x, y, type }) => {
    const el = document.querySelector('.stage')
    const r = el.getBoundingClientRect()
    el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: type, clientX: r.left + x, clientY: r.top + y, buttons: 0, pressure: 0 }))
  }, { x, y, type })
}

export const wave = (x0, y0, n = 60, amp = 24, step = 5, k = 0.22) =>
  Array.from({ length: n }, (_, i) => [x0 + i * step, y0 + amp * Math.sin(i * k)])

export const fw = (page, fn, arg) => page.evaluate(`(${fn.toString()})(window.__fw, ${JSON.stringify(arg ?? null)})`)
export const itemCount = (page) => fw(page, (w) => w.board.doc.items.length)

let passed = 0
let failed = 0
export function check(name, cond, extra = '') {
  if (cond) passed++
  else failed++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`)
}
export function summary() {
  console.log(`\n${passed} passed, ${failed} failed`)
  return failed
}
