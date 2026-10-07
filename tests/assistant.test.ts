import { describe, expect, it, vi, afterEach } from 'vitest'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Assistant, validEndpoint } from '../src/main/assistant'
const secrets = { available: () => true, encrypt: (s: string) => Buffer.from(s.split('').reverse().join('')), decrypt: (b: Buffer) => b.toString().split('').reverse().join('') }
afterEach(() => vi.unstubAllGlobals())
describe('optional local/model assistant', () => {
  it('allows local HTTP and remote HTTPS, rejects credentials and remote plaintext', () => {
    expect(validEndpoint('http://localhost:11434/v1/')).toBe('http://localhost:11434/v1')
    expect(validEndpoint('https://api.openai.com/v1')).toBe('https://api.openai.com/v1')
    for (const endpoint of ['http://remote.example/v1', 'https://user:key@host/v1', 'file:///etc/passwd', 'https://host/v1?key=x']) expect(() => validEndpoint(endpoint)).toThrow()
  })
  it('keeps secrets out of public config and clears a key on endpoint change', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fw-assistant-unit-')), file = join(dir, 'assistant.json')
    const assistant = new Assistant(file, secrets, async () => ({ ok: true }))
    const saved = await assistant.save({ endpoint: 'https://one.example/v1', model: 'model', protocol: 'responses', key: 'secret-sentinel' })
    expect(saved.hasKey).toBe(true); expect(JSON.stringify(saved)).not.toContain('sentinel')
    expect(await readFile(file, 'utf8')).not.toContain('secret-sentinel')
    const reloaded = new Assistant(file, secrets, async () => ({ ok: true })); expect((await reloaded.load()).hasKey).toBe(true)
    expect((await assistant.save({ endpoint: 'https://two.example/v1', model: 'model', protocol: 'chat' })).hasKey).toBe(false)
  })
  it('prepares a validated draft without an API key or live mutation', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fw-assistant-unit-'))
    const calls: unknown[] = [], requests: unknown[] = []
    const assistant = new Assistant(join(dir, 'assistant.json'), secrets, async call => {
      calls.push(call)
      return call.name === 'whiteboard_read' ? { ok: true, revision: 4, total: 0, objects: [] } : { ok: true, changed: ['n'], removed: [] }
    })
    await assistant.save({ endpoint: 'http://127.0.0.1:11434/v1', model: 'local', protocol: 'chat' })
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      requests.push(options)
      return Response.json({ choices: [{ message: { content: null, tool_calls: [{ id: 'call1', type: 'function', function: { name: 'whiteboard_apply', arguments: JSON.stringify({ expectedRevision: 4, requestId: 'r', label: 'Create note', operations: [{ op: 'create', id: 'n', kind: 'note', x: 0, y: 0 }] }) } }] } }] })
    }))
    const result = await assistant.generate('Create a note', [])
    expect(result.ok && result.draft?.summary).toBe('Create note')
    expect(calls[1]).toMatchObject({ name: 'whiteboard_apply', arguments: { dryRun: true } })
    expect((requests[0] as { headers: object }).headers).not.toHaveProperty('Authorization')
  })
  it('bounds retries when the model repeatedly proposes invalid drafts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fw-assistant-unit-'))
    const assistant = new Assistant(join(dir, 'assistant.json'), secrets, async call => call.name === 'whiteboard_read' ? { ok: true, revision: 1, objects: [] } : { ok: false, error: 'Invalid draft' })
    await assistant.save({ endpoint: 'http://localhost:11434/v1', model: 'local', protocol: 'responses' })
    const fetch = vi.fn(async () => Response.json({ output: [{ type: 'function_call', call_id: 'c', name: 'whiteboard_apply', arguments: '{}' }] }))
    vi.stubGlobal('fetch', fetch)
    expect((await assistant.generate('Create', [])).ok).toBe(false); expect(fetch).toHaveBeenCalledTimes(4)
  })
})
