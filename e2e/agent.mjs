import { launch, check, summary, fw, shotDir } from './lib.mjs'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { createServer, request } from 'node:http'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

const { app, page, logs, userData } = await launch({ executablePath: process.argv[2] })
let fixture, adapter
const close = async () => { adapter?.kill(); fixture?.close(); await app.close().catch(() => {}) }
try {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 4000, y: 40, width: 1280, height: 800 }))
  await page.waitForTimeout(200)
  const initial = await page.evaluate(() => window.api.agent.status())
  check('Agent access starts disabled', !initial.enabled)
  await page.getByRole('button', { name: 'Agent tools and assistant', exact: true }).click()
  await page.getByRole('button', { name: 'Planning board', exact: true }).click()
  await page.waitForTimeout(350)
  let state = await fw(page, w => ({ count: w.board.doc.items.length, notes: w.board.doc.items.every(it => it.t === 't' && it.note) }))
  check('Offline starter creates three editable notes without a key', state.count === 3 && state.notes)
  await fw(page, w => w.board.undo())
  check('Offline starter is one undo step', await fw(page, w => w.board.doc.items.length) === 0)
  await fw(page, w => w.board.redo())
  await page.getByRole('button', { name: 'Agent tools and assistant', exact: true }).click()
  await page.getByRole('button', { name: 'Enable connection', exact: true }).click()
  await page.waitForTimeout(150)
  let status = await page.evaluate(() => window.api.agent.status())
  check('Connection binds only loopback', status.enabled && /^http:\/\/127\.0\.0\.1:\d+$/.test(status.endpoint))
  const connection = JSON.parse(await readFile(join(userData, 'agent-connection.json'), 'utf8'))
  const headers = { Authorization: `Bearer ${connection.token}`, 'Content-Type': 'application/json' }
  const call = async (name, args) => (await fetch(connection.endpoint + '/call', { method: 'POST', headers, body: JSON.stringify({ name, arguments: args }) })).json()
  check('Missing authentication is rejected', (await fetch(connection.endpoint + '/tools')).status === 403)
  check('Browser-origin request is rejected', (await fetch(connection.endpoint + '/tools', { headers: { ...headers, Origin: 'https://other.example' } })).status === 403)
  const badHost = await new Promise((resolve, reject) => { const req = request(connection.endpoint + '/tools', { headers: { ...headers, Host: 'other.example' } }, res => { res.resume(); resolve(res.statusCode) }); req.on('error', reject); req.end() })
  check('Alternate Host header is rejected', badHost === 403)
  check('Configuration contains no token', !status.config.includes(connection.token))
  let snapshot = await call('whiteboard_read', { limit: 2 })
  check('Read returns stable IDs, revision and compact pagination', snapshot.ok && snapshot.objects.length === 2 && snapshot.nextOffset === 2 && Number.isInteger(snapshot.revision))
  const longText = 'A long editable note. '.repeat(180)
  await call('whiteboard_apply', { expectedRevision: snapshot.revision, requestId: 'long-create', label: 'Long note', operations: [{ op: 'create', id: 'long-note', kind: 'note', x: 1800, y: 100, text: longText }] })
  const compactText = await call('whiteboard_read', { ids: ['long-note'] })
  const fullText = await call('whiteboard_read', { ids: ['long-note'], limit: 1, textLimit: 100000 })
  check('Long text reads expose truncation and allow complete targeted reads', compactText.objects[0].textTruncated && fullText.objects[0].text === longText && !fullText.objects[0].textTruncated)
  const resized = await call('whiteboard_apply', { expectedRevision: fullText.revision, requestId: 'resize-note', label: 'Resize note', operations: [{ op: 'update', ids: ['long-note'], width: 400, x: 2000 }] })
  check('Semantic resizing preserves the editable object ID', resized.ok && resized.objects[0].id === 'long-note' && resized.objects[0].width === 400 && resized.objects[0].x === 2000)
  await fw(page, w => { w.board.undo(); w.board.undo() })
  snapshot = await call('whiteboard_read', {})
  let batch = { expectedRevision: snapshot.revision, requestId: 'external-1', label: 'Agent diagram', operations: [
    { op: 'create', id: 'agent-shape', kind: 'diamond', x: 700, y: 100, width: 180, height: 160, text: 'Decision', fill: '#dbeafe' },
    { op: 'create', id: 'agent-note', kind: 'note', x: 1000, y: 100, text: 'Action', fill: '#dcfce7' },
    { op: 'group', ids: ['agent-shape', 'agent-note'] }
  ] }
  const preview = await call('whiteboard_apply', { ...batch, dryRun: true })
  check('Dry run validates without changing the board', preview.ok && await fw(page, w => w.board.doc.items.length) === 3)
  const applied = await call('whiteboard_apply', batch)
  check('Real external call creates and groups editable objects', applied.ok && await fw(page, w => w.board.doc.items.filter(it => it.group).length) === 2)
  const replay = await call('whiteboard_apply', batch)
  check('Retry is idempotent', replay.ok && replay.replayed && await fw(page, w => w.board.doc.items.length) === 5)
  const conflict = await call('whiteboard_apply', { ...batch, label: 'Different' })
  check('Reusing a request ID for a different batch is rejected', !conflict.ok && conflict.code === 'REQUEST_CONFLICT')
  await fw(page, w => w.board.undo())
  check('External batch is one undo step', await fw(page, w => w.board.doc.items.length) === 3)
  await fw(page, w => w.board.redo())
  const stale = await call('whiteboard_apply', { ...batch, requestId: 'stale' })
  check('Stale revision is rejected', !stale.ok && stale.code === 'REVISION_CONFLICT')
  snapshot = await call('whiteboard_read', {})
  const atomic = await call('whiteboard_apply', { expectedRevision: snapshot.revision, requestId: 'atomic', label: 'Bad batch', operations: [{ op: 'create', id: 'must-not-exist', kind: 'note', x: 0, y: 0 }, { op: 'update', ids: ['missing'], text: 'x' }] })
  check('Invalid later operation rolls back the whole batch', !atomic.ok && !await fw(page, w => w.board.doc.items.some(it => it.id === 'must-not-exist')))
  await fw(page, w => { w.board.setSelection(w.board.doc.items.filter(it => it.id === 'agent-note')); w.board.toggleLockSelection() })
  snapshot = await call('whiteboard_read', {})
  const locked = await call('whiteboard_apply', { expectedRevision: snapshot.revision, requestId: 'locked', label: 'Move', operations: [{ op: 'move', ids: ['agent-shape'], dx: 20, dy: 0 }] })
  check('Locked group member blocks movement of the whole group', !locked.ok && locked.code === 'LOCKED')
  // Exercise the stdio adapter as a real child process, including protocol framing.
  const config = JSON.parse(status.config).mcpServers['floating-whiteboard']
  adapter = spawn(process.execPath, config.args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
  const replies = new Map(), lines = createInterface({ input: adapter.stdout })
  lines.on('line', line => { const msg = JSON.parse(line); replies.get(msg.id)?.(msg) })
  let id = 0
  const rpc = (method, params) => new Promise((resolve, reject) => {
    const requestId = ++id, timer = setTimeout(() => reject(new Error('MCP timeout')), 10000)
    replies.set(requestId, response => { clearTimeout(timer); replies.delete(requestId); resolve(response) })
    adapter.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }) + '\n')
  })
  const hello = await rpc('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } })
  adapter.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
  check('MCP initialization advertises native tools', hello.result?.capabilities?.tools && hello.result.protocolVersion === '2025-11-25')
  const tools = await rpc('tools/list', {})
  check('MCP discovers editing and recording tools', ['whiteboard_read', 'whiteboard_apply', 'whiteboard_replay'].every(name => tools.result?.tools?.some(tool => tool.name === name)))
  const read = await rpc('tools/call', { name: 'whiteboard_read', arguments: { query: 'Decision' } })
  check('MCP tool call reaches the actual board', !read.result?.isError && read.result?.structuredContent?.objects?.[0]?.id === 'agent-shape')
  const mcpEdit = await rpc('tools/call', { name: 'whiteboard_apply', arguments: { expectedRevision: read.result.structuredContent.revision, requestId: 'mcp-edit', label: 'MCP note', operations: [{ op: 'create', id: 'mcp-note', kind: 'note', x: 800, y: 350, text: 'Created via MCP' }] } })
  check('MCP writes through the semantic transaction', !mcpEdit.result?.isError && await fw(page, w => w.board.doc.items.some(it => it.id === 'mcp-note')))
  await fw(page, w => w.board.undo())
  const unknown = await rpc('tools/call', { name: 'execute_js', arguments: {} })
  check('MCP cannot execute arbitrary code', unknown.result?.isError)
  // Fixture speaks the documented chat/responses format, without using a paid provider.
  let mode = 'chat', receivedKey = null, providerCalls = 0
  fixture = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/v1/models') return res.end(JSON.stringify({ data: [{ id: 'fixture-tools' }] }))
    let body = ''; for await (const part of req) body += part
    providerCalls++; receivedKey = req.headers.authorization ?? null
    const current = await call('whiteboard_read', {})
    const args = JSON.stringify({ expectedRevision: current.revision, requestId: `draft-${providerCalls}`, label: 'Study plan', operations: [{ op: 'create', id: `draft-note-${providerCalls}`, kind: 'note', x: 100, y: 400, text: 'Study algebra\nPractice five examples', fill: '#fff1a8' }] })
    if (mode === 'slow') { await new Promise(resolve => setTimeout(resolve, 1000)); if (res.destroyed) return }
    res.end(JSON.stringify(mode === 'responses' ? { output: [{ type: 'function_call', call_id: 'call1', name: 'whiteboard_apply', arguments: args }] }
      : { choices: [{ message: { content: null, tool_calls: [{ id: 'call1', type: 'function', function: { name: 'whiteboard_apply', arguments: args } }] } }] }))
  })
  await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve))
  const endpoint = `http://127.0.0.1:${fixture.address().port}/v1`
  await page.getByRole('button', { name: 'Connection settings', exact: false }).click()
  await page.getByTestId('assistant-endpoint').fill(endpoint)
  await page.getByTestId('assistant-model').fill('fixture-tools')
  await page.getByRole('button', { name: 'Find models', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Found 1 models' }).waitFor()
  check('Local models are discoverable without a key', await page.locator('#agent-models option').count() === 1)
  await page.getByTestId('assistant-prompt').fill('Make a study plan')
  const beforeDraft = await fw(page, w => w.board.doc.items.length)
  await page.getByRole('button', { name: 'Prepare draft', exact: true }).click()
  await page.getByTestId('assistant-draft').waitFor()
  await page.getByRole('button', { name: 'Apply draft', exact: true }).scrollIntoViewIfNeeded()
  check('Assistant validates a draft before any mutation', await fw(page, w => w.board.doc.items.length) === beforeDraft)
  check('Local assistant sends no key', receivedKey === null)
  const intervening = await call('whiteboard_read', {})
  await call('whiteboard_apply', { expectedRevision: intervening.revision, requestId: 'concurrent', label: 'Concurrent edit', operations: [{ op: 'create', id: 'concurrent-note', kind: 'note', x: 50, y: 50, text: 'Another edit' }] })
  check('A concurrent board edit disables stale draft application', await page.getByRole('button', { name: 'Apply draft', exact: true }).isDisabled())
  await fw(page, w => w.board.undo())
  await page.getByRole('button', { name: 'Prepare draft', exact: true }).click()
  await page.getByRole('button', { name: 'Apply draft', exact: true }).waitFor({ state: 'visible' })
  await page.waitForFunction(() => !document.querySelector('[data-testid="assistant-draft"] .agent-primary')?.disabled)
  await page.screenshot({ path: join(shotDir, 'agent-draft.png') })
  await page.getByRole('button', { name: 'Apply draft', exact: true }).click()
  check('Draft becomes a normal editable note', await fw(page, w => w.board.doc.items.some(it => it.text?.startsWith('Study algebra'))))
  await fw(page, w => w.board.undo())
  check('Assistant edit is undoable in one step', await fw(page, w => w.board.doc.items.length) === beforeDraft)
  await page.getByRole('button', { name: 'Agent tools and assistant', exact: true }).click()
  mode = 'responses'
  await page.evaluate(async endpoint => window.api.agent.saveConfig({ endpoint, model: 'fixture-tools', protocol: 'responses' }), endpoint)
  const result = await page.evaluate(() => window.api.agent.generate('Create a note', []))
  check('Responses format prepares a validated draft', result.ok && result.draft?.summary === 'Study plan')
  mode = 'slow'
  const cancel = page.evaluate(() => window.api.agent.generate('Create a note', []))
  await page.waitForTimeout(150); await page.evaluate(() => window.api.agent.cancel())
  const cancelled = await cancel
  check('Stop cancels generation without mutation', !cancelled.ok && cancelled.error.includes('Cancelled') && await fw(page, w => w.board.doc.items.length) === beforeDraft)
  const secure = await page.evaluate(async endpoint => {
    const saved = await window.api.agent.saveConfig({ endpoint, model: 'fixture-tools', protocol: 'chat', key: 'test-secret-sentinel' })
    return { saved, read: await window.api.agent.config() }
  }, endpoint)
  const disk = await readFile(join(userData, 'assistant.json'), 'utf8')
  check('Key is encrypted on disk and excluded from renderer config', secure.saved.hasKey && !disk.includes('test-secret-sentinel') && !JSON.stringify(secure).includes('test-secret-sentinel'))
  mode = 'chat'
  const keyed = await page.evaluate(() => window.api.agent.generate('Create a note', []))
  check('Main process unlocks a saved key only for the configured endpoint', keyed.ok && keyed.draft && receivedKey === 'Bearer test-secret-sentinel')
  await page.evaluate(() => window.api.agent.saveConfig({ endpoint: 'http://127.0.0.1:11434/v1', model: '', protocol: 'chat' }))
  check('Changing endpoints clears the saved key', !(await page.evaluate(() => window.api.agent.config())).hasKey)
  await page.getByRole('button', { name: 'Disable connection', exact: true }).click()
  check('Disabling revokes the connection file', await stat(join(userData, 'agent-connection.json')).then(() => false, () => true))
  check('Disabled endpoint stops accepting connections', await fetch(connection.endpoint + '/tools', { headers }).then(() => false, () => true))
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ width: 420, height: 320 }))
  await page.waitForTimeout(200)
  const panelBounds = await page.getByTestId('agent-panel').boundingBox(), viewport = page.viewportSize()
  check('Agent panel stays inside the minimum window', panelBounds.x >= 0 && panelBounds.y >= 0 && panelBounds.x + panelBounds.width <= (viewport?.width ?? 420) && panelBounds.y + panelBounds.height <= (viewport?.height ?? 320))
  await page.screenshot({ path: join(shotDir, 'agent-small-window.png') })
  check('No renderer errors or leaked key in logs', !logs.some(l => /pageerror|test-secret-sentinel/.test(l)))
  await page.evaluate(() => window.api.win.close()); await page.waitForEvent('close', { timeout: 10000 }).catch(() => {})
  const savedBoard = JSON.parse(await readFile(join(userData, 'board.json'), 'utf8'))
  check('Agent-created objects save through the normal board pipeline', savedBoard.items.some(it => it.id === 'agent-shape') && savedBoard.items.some(it => it.id === 'agent-note'))
} catch (error) { console.error(error); check('Agent workflow completed', false, error.message) }
finally { await close() }
process.exitCode = summary() ? 1 : 0
