// Magnifier, clock, timer presets, name picker, dice, scoreboard, students at the board, phone poll.
// Run: npm run e2e:classroom
import { launch, check, summary, fw, gesture, shotDir } from './lib.mjs'
import { join } from 'node:path'

const { app, page, logs } = await launch({ layout: 'board' })
const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: join(shotDir, `classroom-${name}.png`) }) }
const more = async (label) => { await page.getByRole('button', { name: 'More', exact: true }).click(); await page.getByRole('button', { name: label, exact: true }).click() }
const count = () => fw(page, w => w.board.doc.items.length)

try {
  await fw(page, w => { w.board.convertTo('notebook'); w.board.setTool('pen'); w.S.penSize.value = 6; w.S.penColor.value = '#e5484d' })
  await gesture(page, Array.from({ length: 30 }, (_, i) => [500 + i * 14, 320 + Math.sin(i * .5) * 40]), { type: 'touch', gap: 8 })

  // ── magnifier ──────────────────────────────────────────────────────────────
  await more('Magnifier')
  await page.waitForSelector('.lens-glass')
  const red = () => page.locator('.lens-glass').evaluate(cv => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] < 120) n++; return n })
  await page.waitForTimeout(120)
  const lensBox = await page.locator('.lens-glass').boundingBox()
  await page.evaluate(({ x, y }) => { const el = document.querySelector('.lens-glass'); el.setPointerCapture = () => {}; const fire = (t, cx, cy) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 3, pointerType: 'touch', clientX: cx, clientY: cy })); fire('pointerdown', x, y); fire('pointermove', 700, 320); fire('pointerup', 700, 320) }, { x: lensBox.x + 170, y: lensBox.y + 170 })
  await page.waitForTimeout(150)
  const seen = await red()
  check('the lens shows the writing under it', seen > 200, String(seen))
  await shot('magnifier')
  await page.locator('.lens-controls').getByRole('button', { name: '4×' }).click()
  await page.waitForTimeout(120)
  check('more magnification, thicker writing', (await red()) > seen, `${await red()} vs ${seen}`)
  check('the lens does not add anything to the page', (await count()) === 1)
  await page.getByRole('button', { name: 'Close the magnifier' }).click()

  // ── clock and timer ────────────────────────────────────────────────────────
  await more('Clock')
  await page.waitForSelector('.clock-face')
  check('the clock shows today', (await page.locator('.clock-date').textContent()).includes(String(new Date().getFullYear())))
  await shot('clock')
  await page.getByRole('button', { name: 'Close the clock' }).click()
  await more('Timer')
  await page.waitForSelector('.timer')
  await page.locator('.timer-row.presets').getByRole('button', { name: '30 s' }).click()
  await page.waitForTimeout(1200)
  const face = await page.locator('.timer-face').textContent()
  check('one tap on a preset starts it counting down', /^0:2\d$/.test(face), face)
  await page.getByRole('button', { name: 'Close timer' }).click()

  // ── name picker ────────────────────────────────────────────────────────────
  await more('Name picker')
  await page.waitForSelector('.picker-result')
  await fw(page, w => { w.S.pickerMax.value = 3 })
  await page.waitForTimeout(60)
  const drawn = []
  for (let i = 0; i < 3; i++) {
    await page.locator('.class-tool').getByRole('button', { name: 'Pick', exact: true }).click()
    await page.waitForFunction(() => !document.querySelector('.picker-result.spinning'))
    await page.waitForTimeout(860)
    drawn.push((await page.locator('.picker-result').textContent()).trim())
  }
  check('everyone gets a turn before anyone comes twice', [...drawn].sort().join() === '1,2,3', drawn.join())
  await shot('picker')
  await page.locator('.class-tool .seg').getByRole('button', { name: 'Names' }).click()
  await page.getByRole('textbox', { name: 'Names, one on each line' }).fill('Asha\nरवि')
  await page.locator('.class-tool').getByRole('button', { name: 'Pick', exact: true }).click()
  await page.waitForTimeout(950)
  const name = (await page.locator('.picker-result').textContent()).trim()
  check('names work, in Hindi too', ['Asha', 'रवि'].includes(name), name)
  check('the list is remembered on this computer', await fw(page, w => w.S.pickerNames.value.includes('Asha')))
  await page.getByRole('button', { name: 'Close the name picker' }).click()

  // ── dice ───────────────────────────────────────────────────────────────────
  await more('Dice')
  await page.waitForSelector('.die')
  await page.locator('.class-tool .seg').getByRole('button', { name: 'Two' }).click()
  await page.locator('.class-tool').getByRole('button', { name: 'Roll', exact: true }).click()
  await page.waitForTimeout(800)
  const dice = await page.locator('.die').evaluateAll(ds => ds.map(d => Number(d.getAttribute('aria-label'))))
  const total = await page.locator('.dice-total').textContent()
  check('two dice with a total', dice.length === 2 && total === `Total ${dice[0] + dice[1]}`, `${dice} ${total}`)
  check('a die shows as many dots as its number', await page.locator('.die').first().evaluate(d => d.querySelectorAll('.die-pip').length === Number(d.getAttribute('aria-label'))))
  await shot('dice')
  await page.getByRole('button', { name: 'Close the dice' }).click()

  // ── scoreboard ─────────────────────────────────────────────────────────────
  await more('Scoreboard')
  await page.waitForSelector('.score-team')
  await page.getByRole('button', { name: 'Add a point to Team 1' }).click()
  await page.getByRole('button', { name: 'Add a point to Team 1' }).click()
  await page.getByRole('button', { name: 'Add a point to Team 2' }).click()
  await page.getByRole('button', { name: 'Take a point from Team 2' }).click()
  await page.getByRole('button', { name: 'Take a point from Team 2' }).click()
  const scores = await page.locator('.score-value').allTextContents()
  check('points add and never go below zero', scores.join() === '2,0', scores.join())
  check('the team ahead stands out', await page.locator('.score-team').first().evaluate(t => t.classList.contains('lead')))
  await page.getByRole('button', { name: 'Add a team' }).click()
  check('more teams can join', (await page.locator('.score-team').count()) === 3)
  await shot('scoreboard')
  await page.getByRole('button', { name: 'Close the scoreboard' }).click()

  // ── students at the board ──────────────────────────────────────────────────
  await fw(page, w => { w.board.addPage() })
  await more('Students at board')
  await page.waitForSelector('.zone-choices')
  await shot('zones-sheet')
  await page.getByRole('button', { name: '3 sides' }).click()
  await page.waitForSelector('.zones')
  check('the teacher toolbar steps aside', !(await page.getByRole('toolbar', { name: 'Board tools' }).isVisible()))
  const size = await page.locator('.stage').boundingBox()
  const W = size.width
  // Three hands at once, their events interleaved the way a multi-touch panel sends them.
  await page.evaluate(async ({ W }) => {
    const el = document.querySelector('.stage'), r = el.getBoundingClientRect()
    el.setPointerCapture = () => {}
    const fire = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: id === 21, clientX: r.left + x, clientY: r.top + y, button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' ? 0 : 1, width: 16, height: 16, pressure: .5 }))
    const hands = [[21, W * .1], [22, W * .45], [23, W * .8]]
    for (const [id, x] of hands) fire('pointerdown', id, x, 200)
    for (let i = 1; i <= 30; i++) {
      for (const [id, x] of hands) fire('pointermove', id, x + i * 8, 200 + Math.sin(i * .4) * 50)
      await new Promise(res => setTimeout(res, 6))
    }
    for (const [id, x] of hands) fire('pointerup', id, x + 240, 200)
  }, { W })
  await page.waitForTimeout(120)
  const inks = await fw(page, w => w.board.doc.items.map(i => i.c))
  const expected = await fw(page, w => w.S.zoneInks.value)
  check('three students write at the same time', inks.length === 3, String(inks.length))
  check('each in their own colour', [...inks].sort().join() === [...expected].sort().join(), `${inks} vs ${expected}`)
  await shot('zones')
  // A hand wandering across the line stays on its own side.
  const crossed = await page.evaluate(async ({ W }) => {
    const el = document.querySelector('.stage'), r = el.getBoundingClientRect()
    const fire = (type, x, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 31, pointerType: 'touch', clientX: r.left + x, clientY: r.top + y, button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' ? 0 : 1, width: 16, height: 16, pressure: .5 }))
    fire('pointerdown', W * .2, 500)
    for (let i = 1; i <= 25; i++) { fire('pointermove', W * .2 + i * 40, 500); await new Promise(res => setTimeout(res, 4)) }
    fire('pointerup', W * .2 + 1000, 500)
    const it = window.__fw.board.doc.items.at(-1), v = window.__fw.board.view
    let most = -1e9
    for (let i = 0; i < it.p.length; i += 3) most = Math.max(most, (it.p[i] - v.x) * v.zoom)
    return most
  }, { W })
  check('a stroke cannot cross into the next side', crossed <= W / 3 + 12, `${crossed} vs ${W / 3}`)
  const before = await count()
  await page.getByRole('button', { name: 'Side 2 undo' }).click()
  const left = await fw(page, w => w.board.doc.items.map(i => i.c))
  check("a student's undo takes only their own work", left.length === before - 1 && !left.includes(expected[1]), left.join())
  await page.getByRole('button', { name: 'Side 3 eraser' }).click()
  const eraseAt = W * .8 + 120
  await page.evaluate(async ({ x }) => {
    const el = document.querySelector('.stage'), r = el.getBoundingClientRect()
    const fire = (type, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 41, pointerType: 'touch', clientX: r.left + x, clientY: r.top + y, button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' ? 0 : 1, width: 16, height: 16, pressure: .5 }))
    fire('pointerdown', 120)
    for (let y = 130; y <= 300; y += 8) { fire('pointermove', y); await new Promise(res => setTimeout(res, 3)) }
    fire('pointerup', 300)
  }, { x: eraseAt })
  await page.waitForTimeout(100)
  const afterErase = await fw(page, w => w.board.doc.items.map(i => i.c))
  check('a side can have its own eraser', !afterErase.includes(expected[2]), afterErase.join())
  await page.getByRole('button', { name: 'Finish' }).click()
  await page.getByRole('button', { name: 'Yes', exact: true }).click()
  check('finishing brings the teacher back', await page.getByRole('toolbar', { name: 'Board tools' }).isVisible() && await fw(page, w => w.S.zones.value === 0))
  check('and the work stays, with undo', await fw(page, w => { const n = w.board.doc.items.length; w.board.undo(); const m = w.board.doc.items.length; w.board.redo(); return n > 0 && m !== n }))

  // ── poll ───────────────────────────────────────────────────────────────────
  await more('Ask the class')
  await page.waitForSelector('.poll-card')
  const network = await page.evaluate(() => window.api.share.addresses())
  if (network.length) {
    await page.getByRole('textbox', { name: 'Question' }).fill('Is water wet?')
    await page.locator('.poll-sets').getByRole('button', { name: 'Yes / No' }).click()
    await shot('poll-setup')
    await page.getByRole('button', { name: 'Start the poll' }).click()
    await page.waitForSelector('.poll-qr[src]')
    const url = await page.locator('.poll-join small').textContent()
    check('the poll starts with a QR code', url.startsWith('http://'))
    const form = await fetch(url)
    const cookie = form.headers.get('set-cookie').split(';')[0]
    const html = await form.text()
    check('a phone sees the question and answers', html.includes('Is water wet?') && html.includes('>Yes<') && html.includes('>No<'))
    const sent = await fetch(url + 'vote', { method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: 'option=0' })
    check('a phone can answer', sent.status === 200)
    await page.waitForFunction(() => document.querySelector('.poll-total')?.textContent.startsWith('1 answer'), null, { timeout: 4000 })
    check('the answer shows live on the board', true)
    await shot('poll-live')
    await page.getByRole('button', { name: 'Put the result on the board' }).click()
    const chart = await fw(page, w => w.board.doc.items.some(i => i.text === 'Is water wet?') && w.board.doc.items.some(i => i.t === 'h' && i.k === 'rect'))
    check('the result goes on the board', chart)
    await fw(page, w => w.board.setSelection([]))
    await shot('poll-board')
    await page.evaluate(() => window.api.poll.stop())
    const gone = await fetch(url).then(() => false).catch(() => true)
    check('stopping ends it for every phone', gone)
  } else {
    check('with no network it says so', await page.getByText('not on a network').isVisible())
  }

  check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.filter(l => /pageerror|\[error\]/.test(l)).slice(0, 2).join(' | '))
} catch (error) {
  check('the suite ran to the end', false, String(error).slice(0, 600))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
