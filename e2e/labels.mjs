// Every sheet at the classroom's usual screen sizes: no label cut off, no panel running off the screen.
// Run: npm run e2e:labels
import { launch, check, summary, fw } from './lib.mjs'

const SHEETS = {
  board: ['board-menu', 'pages', 'shapes', 'props', 'paper', 'subjects', 'export', 'settings', 'help', 'maths', 'lessons', 'new-lesson', 'shelf', 'scale', 'periodic', 'table', 'inputs', 'templates', 'zones', 'poll', 'agent', 'replay', 'science', 'equation', 'graph', 'recovery'],
  laptop: ['board-menu', 'select-tools', 'settings', 'help', 'props', 'shapes', 'paper', 'export', 'lessons', 'shelf', 'scale', 'periodic', 'table', 'inputs', 'templates', 'zones', 'poll', 'agent', 'replay', 'science', 'equation', 'graph']
}

for (const [layout, list] of Object.entries(SHEETS)) for (const size of [[1920, 1080], [1366, 768], [1280, 720]]) {
  const { app, page, logs } = await launch({ layout })
  try {
    await app.evaluate(({ BrowserWindow }, s) => { for (const w of BrowserWindow.getAllWindows()) w.setContentSize(s[0], s[1]) }, size)
    await page.waitForTimeout(250)
    const problems = new Set()
    for (const name of [null, ...list]) {
      await fw(page, (w, n) => { w.S.popover.value = n }, name)
      await page.waitForTimeout(150)
      const found = await page.evaluate(() => {
        const out = []
        for (const el of document.querySelectorAll('.ui *')) {
          const text = el.childElementCount === 0 ? el.textContent.trim() : ''
          if (!text) continue
          const r = el.getBoundingClientRect()
          if (!r.width || !r.height) continue
          const cut = el.scrollWidth > el.clientWidth + 1 && (getComputedStyle(el).overflow !== 'visible' || !!el.closest('button'))
          // A panel that scrolls may hold text out of view; anything else off the window is lost.
          const off = (r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1) && !el.closest('.popover, .chooser-card, .agent-panel, .replay-panel, .tiles, .science-card, .catalogue')
          if (cut || off) out.push(`${cut ? 'cut' : 'off'}: "${text.slice(0, 36)}"`)
        }
        // A panel may scroll down, but never sideways: that hides the end of a row.
        for (const box of document.querySelectorAll('.popover, .chooser-card, .agent-panel, .replay-panel, .board-sheet')) if (box.scrollWidth > box.clientWidth + 2) out.push(`sideways: ${box.className.split(' ').slice(0, 3).join('.')} ${box.scrollWidth}>${box.clientWidth}`)
        const panel = document.querySelector('.popover, .chooser-card, .agent-panel, .replay-panel')
        if (panel) { const r = panel.getBoundingClientRect(); if (r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.left < -1 || r.top < -1) out.push('panel runs off the window') }
        return out
      })
      for (const f of found) problems.add(`${name ?? 'toolbar'} · ${f}`)
    }
    check(`${layout} at ${size.join('×')}: nothing cut off`, problems.size === 0, [...problems].slice(0, 14).join(' | '))
    check(`${layout} at ${size.join('×')}: no errors`, logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.filter(l => /pageerror|\[error\]/.test(l)).slice(0, 2).join(' | '))
  } finally { await app.close().catch(() => {}) }
}
process.exit(summary() ? 1 : 0)
