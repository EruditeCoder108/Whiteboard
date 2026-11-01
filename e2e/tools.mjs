// The Note 3 study's top missing tools: calculator, periodic table, insertable writing strips.
// Run: npm run e2e:tools
import { launch, check, summary, fw, shotDir } from './lib.mjs'
import { join } from 'node:path'

const { app, page, logs } = await launch({ layout: 'board' })
const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: join(shotDir, `tools-${name}.png`) }) }
const more = async (label) => { await page.getByRole('button', { name: 'More', exact: true }).click(); await page.getByRole('button', { name: label, exact: true }).click() }
const key = (k) => page.locator('.calc-keys').getByRole('button', { name: k, exact: true }).click()
const keys = async (...list) => { for (const k of list) await key(k) }
const output = () => page.locator('.calc-screen output').textContent()

try {
  // ── calculator ─────────────────────────────────────────────────────────────
  await more('Calculator')
  await page.waitForSelector('.calculator')
  check('the calculator opens from the menu', true)
  await keys('1', '2', '×', '(', '3', '+', '4', ')')
  check('it shows the sum as it is typed, with the answer so far', (await output()) === '12×(3+4)' && (await page.locator('.calc-live').textContent()).includes('84'))
  await key('=')
  check('= gives the answer', (await output()) === '84')
  await shot('calculator')
  await page.getByRole('button', { name: 'Clear' }).click()
  await keys('sin', '3', '0', ')', '=')
  check('sin takes degrees', (await output()) === '0.5', await output())
  await page.getByRole('button', { name: 'Clear' }).click()
  await keys('7', '÷', '0', '=')
  check('a sum with no answer says so', (await output()) === 'Check the sum')
  await page.getByRole('button', { name: 'Clear' }).click()
  await keys('6', '×', '7')
  await page.getByRole('button', { name: 'Delete the last key' }).click()
  check('the back key takes off one key', (await output()) === '6×')
  await keys('7', '=')
  await page.getByRole('button', { name: 'Write it on the board' }).click()
  const written = await fw(page, w => { const it = w.board.selection[0]; return { t: it?.t, text: it?.text, c: it?.c } })
  check('the answer can be written on the board as text', written.t === 't' && written.text === '6×7 = 42', JSON.stringify(written))
  check('and it is ordinary text, with one Undo', await fw(page, w => { w.board.undo(); const n = w.board.doc.items.length; w.board.redo(); return n === 0 }))
  await page.getByRole('button', { name: 'Close the calculator' }).click()
  check('it closes', await page.locator('.calculator').count() === 0)

  // ── periodic table ─────────────────────────────────────────────────────────
  await fw(page, w => { w.board.clearBoard() })
  await more('Periodic table')
  await page.waitForSelector('.periodic-grid')
  check('all 118 elements are there', await page.locator('.periodic-el').count() === 118)
  await shot('periodic')
  await page.getByRole('button', { name: 'Sodium', exact: true }).click()
  const detail = await page.locator('.periodic-detail').textContent()
  check('tapping one shows it large, with its facts', ['Na', 'Sodium', 'Alkali metal', '22.990', 'Period 3', 'Group 1'].every(t => detail.includes(t)), detail)
  await shot('periodic-element')
  await page.getByRole('button', { name: 'Noble gas' }).click()
  check('tapping a family picks out its elements', await page.locator('.periodic-el:not(.faded)').count() === 6, String(await page.locator('.periodic-el:not(.faded)').count()))
  await page.getByRole('button', { name: 'Put this element on the board' }).click()
  await page.waitForFunction(() => window.__fw.board.doc.items.some(it => it.t === 'i'))
  check('an element goes on the board as a picture', await page.locator('.periodic-grid').count() === 0)
  check('at a sensible size', await fw(page, w => { const it = w.board.doc.items.find(i => i.t === 'i'); return it.p[2] - it.p[0] <= 301 }))
  await more('Periodic table')
  await page.waitForSelector('.periodic-grid')
  await page.getByRole('button', { name: 'Put the whole table on the board' }).click()
  await page.waitForFunction(() => window.__fw.board.doc.items.filter(it => it.t === 'i').length === 2)
  const fits = await fw(page, w => { const it = w.board.doc.items.at(-1), r = w.board.visibleRect(); return it.p[0] >= r[0] && it.p[2] <= r[2] && it.p[1] >= r[1] && it.p[3] <= r[3] && (it.p[2] - it.p[0]) > (r[2] - r[0]) * .6 })
  check('the whole table fits the board, large', fits)
  await fw(page, w => w.board.setSelection([]))
  await shot('table-on-board')

  // ── writing strips ─────────────────────────────────────────────────────────
  await fw(page, w => w.board.addPage())
  await page.getByRole('button', { name: 'Subjects', exact: true }).click()
  await page.getByRole('tab', { name: 'English' }).click()
  await page.getByRole('button', { name: 'Four-line strip' }).click()
  const strip = await fw(page, w => w.board.selection.map(it => [it.k, it.group]))
  check('a four-line strip goes on the page as one object', strip.length === 4 && new Set(strip.map(s => s[1])).size === 1 && strip.every(s => s[0] === 'line'), JSON.stringify(strip))
  check('the page paper is left alone', await fw(page, w => w.S.grid.value) === 'none')
  await fw(page, w => w.board.setSelection([]))
  await page.getByRole('button', { name: 'Subjects', exact: true }).click()
  await page.getByRole('tab', { name: 'Hindi' }).click()
  await page.getByRole('button', { name: 'Hindi strip' }).click()
  check('so does a Hindi strip', await fw(page, w => w.board.selection.length) === 2)
  await fw(page, w => { w.board.setSelection([]); w.S.popover.value = null })
  await shot('strips')

  // ── laptop ─────────────────────────────────────────────────────────────────
  check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.join(' | '))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
