import { createServer, type Server } from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { AGENT_TOOLS, type AgentCall, type AgentResult, type BridgeStatus } from '../shared/agent'

export class AgentBridge {
  private server: Server | null = null
  private token = ''
  private endpoint = ''
  private starting: Promise<BridgeStatus> | null = null
  private busy = false
  readonly connectionFile: string
  constructor(private dir: string, private adapterSource: string, private call: (call: AgentCall) => Promise<AgentResult>) {
    this.connectionFile = join(dir, 'agent-connection.json')
  }
  status(): BridgeStatus {
    if (!this.server) return { enabled: false }
    return { enabled: true, endpoint: this.endpoint, connectionFile: this.connectionFile,
      config: JSON.stringify({ mcpServers: { 'floating-whiteboard': { command: 'node', args: [join(this.dir, 'whiteboard-mcp.cjs'), this.connectionFile] } } }, null, 2) }
  }
  async enable(): Promise<BridgeStatus> {
    if (this.starting) return this.starting
    if (this.server) return this.status()
    this.starting = this.start()
    try { return await this.starting } finally { this.starting = null }
  }
  private async start(): Promise<BridgeStatus> {
    const token = randomBytes(32).toString('hex')
    const server = createServer(async (req, res) => {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      const reply = (status: number, data: unknown): void => { if (!res.destroyed) { res.writeHead(status); res.end(JSON.stringify(data)) } }
      const supplied = req.headers.authorization ?? ''
      const expected = `Bearer ${this.token}`
      const suppliedBytes = Buffer.from(supplied), expectedBytes = Buffer.from(expected)
      // No browser origins, cross-site requests or alternate Host headers are accepted.
      if (req.headers.origin !== undefined || req.headers.host !== this.endpoint.replace('http://', '') ||
          suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) {
        req.resume(); return reply(403, { ok: false, error: 'Unauthorized local connection' })
      }
      if (req.method === 'GET' && req.url === '/tools') return reply(200, { tools: AGENT_TOOLS })
      if (req.method !== 'POST' || req.url !== '/call') { req.resume(); return reply(404, { ok: false, error: 'Not found' }) }
      if (this.busy) { req.resume(); return reply(429, { ok: false, error: 'Another agent command is running. Retry shortly.' }) }
      this.busy = true
      try {
        const chunks: Buffer[] = []; let bytes = 0
        for await (const chunk of req) {
          bytes += chunk.length
          if (bytes > 1024 * 1024) { reply(413, { ok: false, error: 'Command exceeds 1 MB' }); req.destroy(); return }
          chunks.push(Buffer.from(chunk))
        }
        const call = JSON.parse(Buffer.concat(chunks).toString('utf8')) as AgentCall
        if (!call || !AGENT_TOOLS.some(t => t.name === call.name)) return reply(400, { ok: false, error: 'Unknown tool' })
        reply(200, await this.call(call))
      } catch { reply(400, { ok: false, error: 'Invalid or interrupted command' }) }
      finally { this.busy = false }
    })
    server.requestTimeout = 15000; server.headersTimeout = 10000
    try {
      await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('Cannot start agent connection')
      this.endpoint = `http://127.0.0.1:${address.port}`; this.token = token
      await fs.mkdir(this.dir, { recursive: true })
      await fs.copyFile(this.adapterSource, join(this.dir, 'whiteboard-mcp.cjs'))
      await fs.writeFile(this.connectionFile, JSON.stringify({ endpoint: this.endpoint, token }), { mode: 0o600 })
      this.server = server
      return this.status()
    } catch (error) {
      server.close(); this.token = ''; this.endpoint = ''
      await fs.rm(this.connectionFile, { force: true }).catch(() => {})
      return { enabled: false, error: error instanceof Error ? error.message : 'Could not start agent connection' }
    }
  }
  async disable(): Promise<BridgeStatus> {
    if (this.starting) await this.starting
    const server = this.server; this.server = null; this.token = ''; this.endpoint = ''
    if (server) { server.close(); server.closeAllConnections() }
    await fs.rm(this.connectionFile, { force: true }).catch(() => {})
    return { enabled: false }
  }
}
