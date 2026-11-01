// The big action bar, mirror and flip, links, mind maps. Run: npm run e2e:objects
import { launch, check, summary, fw, shotDir } from './lib.mjs'
import { join } from 'node:path'

const { app, page, logs } = await launch({ layout: 'board' })
const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: join(shotDir, `objects-${name}.png`) }) }
const bar = () => page.getByRole('toolbar', { name: 'Selection actions' })
const act = (name) => bar().getByRole('button', { name, exact: true })
const finish = async () => { await page.keyboard.press('Control+Enter'); await page.waitForTimeout(80) }

try {
  await fw(page, w => w.board.convertTo('notebook'))

  // ── the action bar ─────────────────────────────────────────────────────────
  const made = await fw(page, w => {
    const it = { t: 'h', id: 'box1', c: '#111827', w: 3, k: 'rect', p: [500, 300, 800, 480], text: 'Idea', fontSize: 28 }
    w.board.doc.replaceAll([it]); w.board.setTool('select'); w.board.setSelection(w.board.doc.items); w.board.refresh(null)
    return w.board.selection.length
  })
  check('an object is selected', made === 1)
  await page.waitForSelector('.selection-tools.big')
  await shot('bar')
  const sizes = await bar().locator('.sel-act').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), e.querySelector('span')?.textContent] }))
  check('every action is big and named', sizes.length >= 10 && sizes.every(([w, h, label]) => w >= 56 && h >= 56 && label), JSON.stringify(sizes))
  const box = await bar().boundingBox()
  const itemBox = await fw(page, w => { const [x0, y0] = w.board.doc.items[0].p; const z = w.board.view.zoom; return { y: (y0 - w.board.view.y) * z } })
  check('it sits beside the object', box.y + box.height <= itemBox.y + 4, `${box.y + box.height} vs ${itemBox.y}`)

  // A large object: the bar must still be reachable, clear of the toolbar along the bottom.
  const clear = await fw(page, w => {
    const keep = w.board.doc.items[0]
    w.board.setSelection([])
    const big = { ...keep, id: 'big1', p: [40, 40, 1560, 860], text: '' }
    w.board.doc.replaceAll([big]); w.board.setSelection(w.board.doc.items); w.board.refresh(null)
    return true
  })
  await page.waitForTimeout(150)
  const barBox = await bar().boundingBox(), toolBox = await page.getByRole('toolbar', { name: 'Board tools' }).boundingBox()
  check('with a large object the bar stays clear of the toolbar', clear && barBox.y + barBox.height <= toolBox.y, JSON.stringify({ barBox, toolBox }))
  await fw(page, w => {
    const it = { t: 'h', id: 'box1', c: '#111827', w: 3, k: 'rect', p: [500, 300, 800, 480], text: 'Idea', fontSize: 28 }
    w.board.doc.replaceAll([it]); w.board.setSelection(w.board.doc.items); w.board.refresh(null)
  })
  await page.waitForTimeout(100)

  const fontBefore = await fw(page, w => w.board.selection[0].fontSize)
  await act('Bigger text').click()
  check('Bigger makes the text bigger', (await fw(page, w => w.board.selection[0].fontSize)) > fontBefore)
  await act('Bold text').click()
  check('Bold works from the bar', await fw(page, w => w.board.selection[0].bold === true))

  // ── mirror and flip ────────────────────────────────────────────────────────
  await fw(page, w => {
    const cv = document.createElement('canvas'); cv.width = 40; cv.height = 20
    const g = cv.getContext('2d'); g.fillStyle = '#ff0000'; g.fillRect(0, 0, 20, 20); g.fillStyle = '#0000ff'; g.fillRect(20, 0, 20, 20)
    const img = w.board.insertImage(cv.toDataURL(), 400, 200)
    w.board.setTool('select'); w.board.setSelection([w.board.doc.items.at(-1)]); return !!img
  })
  await page.waitForTimeout(150)
  const leftColour = () => page.evaluate(() => {
    const out = document.createElement('canvas'); out.width = 40; out.height = 20
    const g = out.getContext('2d'), w = window.__fw, it = w.board.doc.items.at(-1)
    g.setTransform(40 / (it.p[2] - it.p[0]), 0, 0, 20 / (it.p[3] - it.p[1]), -it.p[0] * 40 / (it.p[2] - it.p[0]), -it.p[1] * 20 / (it.p[3] - it.p[1]))
    w.paintItem(g, it)
    const d = g.getImageData(5, 10, 1, 1).data
    return d[0] > d[2] ? 'red' : 'blue'
  })
  check('the picture starts red on the left', (await leftColour()) === 'red')
  await act('Mirror left to right').click()
  await page.waitForTimeout(80)
  check('mirrored, it is blue on the left', (await leftColour()) === 'blue')
  await fw(page, w => w.board.undo())
  check('undo puts it back', (await leftColour()) === 'red')
  await fw(page, w => w.board.setSelection([w.board.doc.items.at(-1)]))
  await page.waitForTimeout(60)
  await act('Flip upside down').click()
  check('flip marks the picture', await fw(page, w => w.board.doc.items.at(-1).flipY === true))
  const kept = await fw(page, w => { w.board.load(w.board.serialize(), { undoable: false }); return w.board.doc.items.at(-1).flipY })
  check('flip survives saving and opening', kept === true)

  // ── links ──────────────────────────────────────────────────────────────────
  await fw(page, w => { w.board.setTool('select'); w.board.setSelection([w.board.doc.items[0]]) })
  await act('More selection actions').click()
  await page.getByRole('button', { name: 'Add a link' }).click()
  await page.getByRole('textbox', { name: 'Web address' }).fill('javascript:alert(1)')
  await page.getByRole('button', { name: 'Save link' }).click()
  check('a bad address is refused', await page.getByText('That is not a web address').isVisible())
  check('and nothing was saved', await fw(page, w => w.board.selection[0].link === undefined))
  await page.getByRole('textbox', { name: 'Web address' }).fill('ncert.nic.in')
  await shot('link')
  await page.getByRole('button', { name: 'Save link' }).click()
  await page.waitForTimeout(80)
  check('a good one is saved', await fw(page, w => w.board.selection[0].link === 'https://ncert.nic.in/'))
  await page.waitForSelector('.sel-act[aria-label^="Open"]')
  check('and an Open link button appears', await bar().locator('.sel-act[aria-label^="Open"]').isVisible())
  check('main opens web addresses', await page.evaluate(() => window.api.openLink('https://ncert.nic.in/')))
  check('main refuses anything else', !(await page.evaluate(() => window.api.openLink('file:///c:/windows/notepad.exe'))))
  check('the link is saved in the file', await fw(page, w => JSON.parse(w.board.serialize()).pages.some(p => p.items.some(i => i.link === 'https://ncert.nic.in/'))))
  await shot('linked')

  // ── mind maps ──────────────────────────────────────────────────────────────
  await fw(page, w => { w.board.addPage(); w.board.setTool('select') })
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Mind map', exact: true }).click()
  await page.waitForSelector('[data-testid="inline-editor"] textarea')
  await page.keyboard.type('Water cycle')
  await finish()
  check('the main idea is typed straight in', await fw(page, w => w.board.selection[0]?.text === 'Water cycle'))
  for (const idea of ['Evaporation', 'Condensation', 'Rain']) {
    await fw(page, w => { w.board.setSelection(w.board.doc.items.filter(i => i.text === 'Water cycle')) })
    await page.waitForTimeout(60)
    await act('Add a branch').click()
    await page.waitForSelector('[data-testid="inline-editor"] textarea')
    await page.keyboard.type(idea)
    await finish()
  }
  const map = await fw(page, w => {
    const all = w.board.doc.items
    const nodes = all.filter(i => i.text), lines = all.filter(i => i.k === 'line')
    const overlaps = nodes.some((a, n) => nodes.some((b, m) => m > n && a.p[0] < b.p[2] && a.p[2] > b.p[0] && a.p[1] < b.p[3] && a.p[3] > b.p[1]))
    return { nodes: nodes.length, lines: lines.length, overlaps, attached: lines.every(l => l.from && l.to), fills: new Set(nodes.map(n => n.fill)).size }
  })
  check('four ideas joined by three lines', map.nodes === 4 && map.lines === 3, JSON.stringify(map))
  check('no two ideas overlap', !map.overlaps)
  check('the lines are attached at both ends', map.attached)
  check('each branch has its own colour', map.fills === 4, String(map.fills))
  const follows = await fw(page, w => {
    const rain = w.board.doc.items.find(i => i.text === 'Rain'), line = w.board.doc.items.find(i => i.k === 'line' && i.to?.id === rain.id)
    const before = [...line.p]
    w.board.setSelection([rain]); w.board.nudgeSelection(0, 40)
    const after = w.board.doc.items.find(i => i.id === line.id).p
    return before.join() !== after.join()
  })
  check('a line follows when its idea moves', follows)
  await fw(page, w => w.board.setSelection([]))
  await shot('mindmap')
  await fw(page, w => w.board.setSurface({ color: '#262a2e', texture: 'chalk' }))
  await shot('mindmap-dark')
  await fw(page, w => { w.board.undo(); w.board.undo() })

  check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.filter(l => /pageerror|\[error\]/.test(l)).slice(0, 2).join(' | '))
} catch (error) {
  check('the suite ran to the end', false, String(error).slice(0, 500))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
