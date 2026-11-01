// Handwriting to text and to equations, against a stand-in model on this PC. Run: npm run e2e:recognize
import { launch, check, summary, fw, gesture, shotDir } from './lib.mjs'
import { createServer } from 'node:http'
import { join } from 'node:path'

const asked = []
let reply = 'Newton’s laws'
const model = createServer((req, res) => {
  let body = ''
  req.on('data', c => { body += c })
  req.on('end', () => {
    asked.push({ url: req.url, auth: req.headers.authorization, body: body ? JSON.parse(body) : null })
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: reply } }] }))
  })
})
await new Promise(r => model.listen(0, '127.0.0.1', r))
const endpoint = `http://127.0.0.1:${model.address().port}/v1`

const { app, page, logs } = await launch({ layout: 'board' })
const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: join(shotDir, `recognize-${name}.png`) }) }
const bar = () => page.getByRole('toolbar', { name: 'Selection actions' })
const items = () => fw(page, w => w.board.doc.items.map(({ t, text, latex, c }) => ({ t, text, latex, c })))
const write = async () => {
  await fw(page, w => { w.board.setTool('pen'); w.S.penSize.value = 6; w.S.penColor.value = '#e5484d'; w.board.doc.replaceAll([]); w.board.refresh(null) })
  await page.waitForTimeout(800)
  await gesture(page, Array.from({ length: 30 }, (_, i) => [420 + i * 14, 300 + Math.sin(i * .6) * 30]), { type: 'touch', gap: 6 })
  await page.waitForTimeout(50)
  await gesture(page, Array.from({ length: 24 }, (_, i) => [420 + i * 16, 390 + Math.cos(i * .6) * 24]), { type: 'touch', gap: 6 })
  await fw(page, w => { w.board.setTool('select'); w.board.setSelection(w.board.doc.items) })
  await page.waitForSelector('[data-testid="selection-toolbar"]')
}

try {
  await fw(page, w => w.board.convertTo('notebook'))

  // ── no model connected ─────────────────────────────────────────────────────
  await write()
  await bar().getByRole('button', { name: 'Handwriting to text', exact: true }).click()
  await page.waitForSelector('.read-card')
  check('with no model it says what is needed, and sends nothing', await page.getByText('Connect one in Assistant').isVisible() && asked.length === 0)
  await shot('no-model')
  await page.locator('.read-card').getByRole('button', { name: 'Cancel' }).click()
  check('and the writing is untouched', (await items()).every(i => i.t === 's') && (await items()).length === 2)

  // ── text ───────────────────────────────────────────────────────────────────
  await page.evaluate(endpoint => window.api.agent.saveConfig({ endpoint, model: 'stand-in', protocol: 'chat' }), endpoint)
  await write()
  await bar().getByRole('button', { name: 'Handwriting to text', exact: true }).click()
  await page.waitForSelector('.read-answer')
  check('the answer waits for the teacher: the writing is still there', (await items()).filter(i => i.t === 's').length === 2)
  const request = asked.at(-1)
  const content = request.body.messages.find(m => m.role === 'user').content
  const image = content.find(c => c.type === 'image_url')?.image_url.url ?? ''
  check('only the picture of the writing goes to the model', request.url === '/v1/chat/completions' && image.startsWith('data:image/png;base64,') && image.length > 500, request.url)
  check('it is asked to copy, not to answer or add', /only/i.test(request.body.messages[0].content) && /never/i.test(request.body.messages[0].content))
  await shot('text')
  const field = page.getByRole('textbox', { name: 'What the writing says' })
  check('the teacher sees what it read', (await field.inputValue()) === 'Newton’s laws')
  await field.fill('Newton’s three laws')
  await page.getByRole('button', { name: 'Replace the writing' }).click()
  const after = await items()
  check('the correction replaces the writing, as one object', after.length === 1 && after[0].t === 't' && after[0].text === 'Newton’s three laws', JSON.stringify(after))
  check('in the ink colour', after[0].c === '#e5484d')
  await fw(page, w => w.board.undo())
  check('one undo brings the handwriting back', (await items()).filter(i => i.t === 's').length === 2, JSON.stringify(await items()))

  // ── Hindi ──────────────────────────────────────────────────────────────────
  reply = 'प्रकाश संश्लेषण'
  await fw(page, w => { w.board.setTool('select'); w.board.setSelection(w.board.doc.items) })
  await page.waitForSelector('[data-testid="selection-toolbar"]')
  await bar().getByRole('button', { name: 'Handwriting to text', exact: true }).click()
  await page.waitForSelector('.read-answer')
  await page.waitForFunction(() => document.querySelector('.read-answer')?.value)
  await page.getByRole('button', { name: 'Replace the writing' }).click()
  check('Hindi comes through', (await items())[0].text === 'प्रकाश संश्लेषण')
  await fw(page, w => { w.board.setSelection([]) })
  await shot('hindi')

  // ── maths ──────────────────────────────────────────────────────────────────
  reply = '```latex\n$x = \\frac{-b}{2a}$\n```'
  await write()
  await bar().getByRole('button', { name: 'Handwriting to equation', exact: true }).click()
  await page.waitForSelector('.read-answer')
  await page.waitForFunction(() => document.querySelector('.read-answer')?.value)
  check('the code fence and dollar signs are removed', (await page.getByRole('textbox', { name: 'What the writing says' }).inputValue()) === 'x = \\frac{-b}{2a}')
  await page.waitForSelector('.read-equation', { timeout: 15000 })
  await shot('maths')
  await page.getByRole('textbox', { name: 'What the writing says' }).fill('x = \\frac{')
  await page.waitForTimeout(400)
  const stuck = await page.getByRole('button', { name: 'Replace the writing' }).isDisabled()
  await page.getByRole('textbox', { name: 'What the writing says' }).fill('x = \\frac{-b}{2a}')
  await page.waitForSelector('.read-equation')
  check('an equation that cannot be drawn cannot be placed', stuck)
  await page.getByRole('button', { name: 'Replace the writing' }).click()
  const eq = await items()
  check('it becomes an equation that can still be edited', eq.length === 1 && eq[0].t === 'i' && eq[0].latex === 'x = \\frac{-b}{2a}', JSON.stringify(eq))

  // ── failure ────────────────────────────────────────────────────────────────
  await page.evaluate(() => window.api.agent.saveConfig({ endpoint: 'http://127.0.0.1:9/v1', model: 'gone', protocol: 'chat' }))
  await write()
  await bar().getByRole('button', { name: 'Handwriting to text', exact: true }).click()
  await page.waitForSelector('.read-card [role="alert"]', { timeout: 20000 })
  check('a model that cannot be reached says so', true)
  await page.getByRole('button', { name: 'Keep the writing' }).click()
  check('and the writing stays', (await items()).filter(i => i.t === 's').length === 2)

  check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.filter(l => /pageerror|\[error\]/.test(l)).slice(0, 2).join(' | '))
} catch (error) {
  check('the suite ran to the end', false, String(error).slice(0, 600))
} finally { await app.close().catch(() => {}); model.close() }
process.exit(summary() ? 1 : 0)
