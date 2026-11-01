// Light and dark mode for the whole app: every toolbar, menu and sheet stays readable in each, on any board colour.
// Run: npm run e2e:theme
import { launch, check, summary, fw, shotDir } from './lib.mjs'
import { join } from 'node:path'

/** Text that cannot be read: its colour against what is really behind it, through any see-through layers. */
const unreadable = (page, min = 3) => page.evaluate((min) => {
  const parse = (c) => { const m = c.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0]; return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 } }
  const over = (top, under) => { const a = top.a + under.a * (1 - top.a); return a ? { r: (top.r * top.a + under.r * under.a * (1 - top.a)) / a, g: (top.g * top.a + under.g * under.a * (1 - top.a)) / a, b: (top.b * top.a + under.b * under.a * (1 - top.a)) / a, a } : top }
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b) }
  const board = parse(getComputedStyle(document.querySelector('.window')).getPropertyValue('--bg'))
  const behind = (el) => {
    let layers = []
    for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0) { layers.push(c); if (c.a >= 1) break } }
    return layers.reduceRight((under, top) => over(top, under), { ...board, a: 1 })
  }
  const bad = new Map()
  for (const el of document.querySelectorAll('.ui *, .ui')) {
    if (!(el instanceof HTMLElement) || el.closest('[disabled],.muted,.science-card-art') /* over drawn art */ || el.closest('canvas')) continue
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())
    const svg = el.querySelector(':scope > svg')
    if (!own && !svg) continue
    const r = el.getBoundingClientRect(), st = getComputedStyle(el)
    if (!r.width || !r.height || st.visibility === 'hidden' || +st.opacity < .3) continue
    const ink = own ? parse(st.color) : parse(getComputedStyle(svg).color)
    const bg = behind(el), fg = over(ink, bg)
    const a = lum(fg), b = lum(bg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
    if (ratio < min) bad.set(`${el.className || el.tagName}`.toString().slice(0, 40), `${ratio.toFixed(1)} "${(el.textContent || '').trim().slice(0, 18)}"`)
  }
  return [...bad.entries()].map(([k, v]) => `${k}: ${v}`)
}, min)

const POPOVERS = {
  board: ['board-menu', 'pages', 'shapes', 'props', 'paper', 'subjects', 'export', 'settings', 'help', 'maths', 'lessons', 'new-lesson', 'shelf', 'scale', 'periodic', 'agent', 'replay', 'science', 'equation', 'graph', 'recovery'],
  laptop: ['menu', 'insert', 'present', 'settings', 'help', 'props', 'shapes', 'paper', 'export', 'lessons', 'shelf', 'scale', 'periodic', 'agent', 'replay', 'science', 'equation', 'graph']
}

for (const layout of ['board', 'laptop']) {
  const { app, page, logs } = await launch({ layout })
  try {
    for (const [theme, color] of [['dark', '#ffffff'], ['light', '#1d3b33'], ['auto', '#1d3b33'], ['auto', '#ffffff']]) {
      await fw(page, (w, { theme, color }) => { w.S.uiTheme.value = theme; w.board.setColor(color) }, { theme, color })
      const dark = await page.locator('.window.dark').count() === 1
      const wantDark = theme === 'dark' || (theme === 'auto' && color !== '#ffffff')
      check(`${layout}: ${theme} on ${color} makes the app ${wantDark ? 'dark' : 'light'}`, dark === wantDark)
      await page.waitForTimeout(300) // past the colour transitions
      const found = new Set(await unreadable(page))
      await fw(page, (w, color) => { const it = { t: 'h', id: `b${Math.random()}`, c: '#e5484d', w: 3, k: 'rect', p: [500, 300, 800, 500] }; const before = w.board.doc.snapshot(); w.board.doc.replaceAll([...before, it]); w.board.commit(w.board.doc.diff(before)); w.board.setTool('select'); w.board.setSelection([it]) }, color)
      await page.waitForTimeout(80)
      for (const v of await unreadable(page)) found.add(v)
      if (color === (theme === 'dark' ? '#ffffff' : '#1d3b33')) await page.screenshot({ path: join(shotDir, `theme-${layout}-${theme}-toolbar.png`) })
      await fw(page, w => { w.board.setSelection([]); w.board.undo() })
      for (const name of POPOVERS[layout]) {
        await fw(page, (w, name) => { w.S.popover.value = name }, name)
        await page.waitForTimeout(220)
        for (const v of await unreadable(page)) found.add(`[${name}] ${v}`)
        if (theme !== 'auto') await page.screenshot({ path: join(shotDir, `theme-${layout}-${theme}-${name}.png`) })
      }
      await fw(page, w => { w.S.popover.value = null })
      await page.waitForTimeout(150)
      check(`${layout}: ${theme} on ${color}: everything can be read`, found.size === 0, [...found].join('\n      '))
    }
    if (layout === 'board') {
      await fw(page, w => { w.S.uiTheme.value = 'auto'; w.S.popover.value = 'settings' })
      await page.getByRole('button', { name: 'Dark', exact: true }).click()
      check('the choice is in Settings', await fw(page, w => w.S.uiTheme.value) === 'dark')
      await page.waitForTimeout(700)
    }
    check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.join(' | '))
  } finally { await app.close().catch(() => {}) }
}
process.exit(summary() ? 1 : 0)
