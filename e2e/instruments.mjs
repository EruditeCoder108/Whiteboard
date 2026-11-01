// Clearer instruments and easier graph entry. Run: npm run e2e:instruments
import { launch, check, summary, fw, gesture, shotDir } from './lib.mjs'
import { join } from 'node:path'

const { app, page, logs } = await launch({ layout: 'board' })
const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: join(shotDir, `instruments-${name}.png`) }) }
const CM = 37.8
const screen = (wx, wy) => fw(page, (w, a) => { const v = w.board.view; return [(a[0] - v.x) * v.zoom, (a[1] - v.y) * v.zoom] }, [wx, wy])
const centre = () => fw(page, w => w.board.viewCentre())
const key = (name) => page.getByRole('button', { name: `Type ${name}`, exact: true }).click()

try {
  await fw(page, w => { w.board.convertTo('notebook'); w.board.setTool('pen'); w.S.penSize.value = 3 })
  const [cx, cy] = await centre()

  // ── the ruler says how long a line is, and can be put away by its own button ──
  await fw(page, w => w.board.instruments.toggle('ruler'))
  const y = cy - 1.2 * CM
  const [x0, sy] = await screen(cx - 6 * CM, y), [x1] = await screen(cx + 2 * CM, y)
  await gesture(page, [[x0, sy], [x0 + 100, sy + 3], [x1, sy - 2]], { type: 'pen', up: false })
  const reading = await fw(page, w => w.board.instruments.hint)
  check('a line along the ruler reads its length as it is drawn', reading === '8.0 cm', reading)
  await shot('ruler-reading')
  await gesture(page, [[x1, sy]], { type: 'pen', down: false })
  check('the reading goes when the pen lifts', (await fw(page, w => w.board.instruments.hint)) === '')
  const line = await fw(page, w => w.board.doc.items.at(-1).t)
  check('and the line is on the board', line === 's')

  await page.waitForTimeout(800) // palm rejection ignores touches just after a stylus
  const [closeX, closeY] = await screen(cx - 8 * CM + .7 * CM, cy)
  await gesture(page, [[closeX, closeY]], { type: 'touch' })
  check('the close button puts the ruler away', !(await fw(page, w => w.board.instruments.active)))

  // ── the rotate button is easy to hit, with a finger, slightly off centre ──
  await fw(page, w => w.board.instruments.toggle('ruler'))
  const [hx, hy] = await screen(cx + 8 * CM - .7 * CM, cy)
  const items = await fw(page, w => w.board.doc.items.length)
  await gesture(page, [[hx + 20, hy + 14], [hx + 20, hy + 60], [hx + 20, hy + 120]], { type: 'touch', up: false })
  const turning = await fw(page, w => w.board.instruments.hint)
  check('rotating shows the angle in large print', /^\d+°$/.test(turning), turning)
  await shot('ruler-turning')
  await gesture(page, [[hx + 20, hy + 120]], { type: 'touch', down: false })
  check('a finger slightly off the button still turns it, no stray ink', (await fw(page, w => w.board.doc.items.length)) === items)
  await fw(page, w => w.board.instruments.toggle('ruler'))

  // ── the protractor measures ──
  await fw(page, w => w.board.instruments.toggle('protractor'))
  await shot('protractor')
  const r = 8 * CM - 2.2 * CM
  const [ax, ay] = await screen(cx + r * Math.cos(Math.PI / 3), cy - r * Math.sin(Math.PI / 3))
  const [tx, ty] = await screen(cx + r * Math.cos(Math.PI * 35 / 180), cy - r * Math.sin(Math.PI * 35 / 180))
  await gesture(page, [[ax, ay], [(ax + tx) / 2, (ay + ty) / 2], [tx, ty]], { type: 'touch' })
  const arm = await fw(page, w => w.board.instruments.reading('protractor'))
  check('dragging the arm reads the angle', Math.abs(arm - 35) <= 1, String(arm))
  await shot('protractor-35')
  await fw(page, w => w.board.instruments.toggle('protractor'))

  // ── compass ──
  await fw(page, w => { w.S.penStyle.value = 'chalk'; w.board.instruments.toggle('compass') })
  await shot('compass')
  const [px, py] = await screen(cx + 4 * CM, cy), [cxs, cys] = await screen(cx, cy)
  const arc = []
  for (let k = 0; k <= 20; k++) { const a = k / 20 * Math.PI; arc.push([cxs + (px - cxs) * Math.cos(a), cys + (px - cxs) * Math.sin(a)]) }
  await gesture(page, arc, { type: 'touch' })
  const drawn = await fw(page, w => { const it = w.board.doc.items.at(-1); return { style: it.style, width: it.w } })
  check('the compass draws in the chosen pen', drawn.style === 'chalk' && drawn.width === 4.8, JSON.stringify(drawn))
  await fw(page, w => { w.board.instruments.toggle('compass'); w.S.penStyle.value = 'pen' })

  // ── graph entry without a keyboard ──
  await fw(page, w => { w.board.addPage(); w.board.setTool('select'); w.insert.editGraph(null) })
  await page.waitForSelector('.graph-editor')
  await shot('graph-editor')
  await page.locator('.fn-row input').first().fill('')
  await page.locator('.fn-row input').first().focus()
  for (const k of ['x²', '−', '4']) await key(k)
  check('the keys type x^2-4', (await page.locator('.fn-row input').first().inputValue()) === '^2-4')
  await page.getByRole('button', { name: 'Delete a character' }).click()
  await page.getByRole('button', { name: 'Delete a character' }).click()
  await page.getByRole('button', { name: 'Delete a character' }).click()
  await page.getByRole('button', { name: 'Delete a character' }).click()
  for (const k of ['x', 'x²', '−', '4']) await key(k)
  check('with delete, a function is written by tapping alone', (await page.locator('.fn-row input').first().inputValue()) === 'x^2-4', await page.locator('.fn-row input').first().inputValue())
  const painted = await page.evaluate(async () => {
    await new Promise(r => setTimeout(r, 150))
    const cv = document.querySelector('.graph-preview'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data
    let blue = 0
    for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 200 && d[i] < 90) blue++
    return blue
  })
  check('the preview draws the curve', painted > 50, String(painted))
  await page.getByRole('button', { name: 'Zoom out' }).click()
  check('zoom out widens the view', (await page.getByLabel('x from').inputValue()) === '-20', await page.getByLabel('x from').inputValue())
  await page.getByRole('button', { name: 'Reset' }).click()
  await page.locator('.fn-row input').nth(1).focus()
  await page.locator('.graph-curves').getByRole('button', { name: 'Sine', exact: true }).click()
  check('a common curve goes into the row in use', (await page.locator('.fn-row input').nth(1).inputValue()) === 'sin(x)')
  await shot('graph-two-curves')
  await page.getByRole('button', { name: 'Put on the board' }).click()
  const graph = await fw(page, w => { const g = w.board.doc.items.at(-1); return { t: g.t, fns: g.fns } })
  check('it lands on the board', graph.t === 'g' && graph.fns.join() === 'x^2-4,sin(x)', JSON.stringify(graph))
  await fw(page, w => w.board.setSelection([]))
  await shot('graph-board')

  check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.filter(l => /pageerror|\[error\]/.test(l)).slice(0, 2).join(' | '))
} catch (error) {
  check('the suite ran to the end', false, String(error).slice(0, 500))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
