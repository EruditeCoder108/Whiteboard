import { createServer, type Server } from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { networkInterfaces } from 'node:os'
import type { Socket } from 'node:net'
import type { ShareAddress, ShareStatus } from '../shared/api'

const PRIVATE = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/

/** Prefer the school LAN; loopback and self-assigned addresses cannot reach phones. */
export function listAddresses(): ShareAddress[] {
  const seen = new Set<string>()
  return Object.entries(networkInterfaces()).flatMap(([name, entries]) => (entries ?? []).flatMap(n => {
    if (n.family !== 'IPv4' || n.internal || /^(127\.|169\.254\.|0\.)/.test(n.address) || seen.has(n.address)) return []
    seen.add(n.address)
    return [{ name, address: n.address }]
  })).sort((a, b) => Number(PRIVATE.test(b.address)) - Number(PRIVATE.test(a.address)))
}

const escape = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const empty = (): ShareStatus => ({ active: false, url: '', downloads: 0, expiresAt: 0 })

/** A single, short-lived PDF snapshot. No file paths or disk access enter the server. */
export class ShareServer {
  private server: Server | null = null
  private sockets = new Set<Socket>()
  private expiry?: ReturnType<typeof setTimeout>
  private sweep?: ReturnType<typeof setInterval>
  private current = empty()
  private generation = 0

  // Short lifetimes and an OS-selected port keep tests independent of the classroom defaults.
  constructor(private options: { durationMs?: number; port?: number } = {}) {}

  async start({ pdf, name, address }: { pdf: Buffer; name: string; address: string }): Promise<{ url: string; expiresAt: number }> {
    this.stop()
    const generation = this.generation
    const token = randomBytes(16).toString('base64url')
    const expected = Buffer.from(token)
    const filename = (name.replace(/[^\x20-\x7e]|[\\/:*?"<>|]/g, '_').trim().replace(/[. ]+$/, '').slice(0, 100) || 'lesson') + '.pdf'
    const html = Buffer.from(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(name)}</title><style>body{font:20px/1.5 system-ui,sans-serif;max-width:32rem;margin:12vh auto;padding:24px;color:#172033;background:#f6f8fc}h1{overflow-wrap:anywhere}a{display:block;padding:20px;background:#4262ff;color:white;text-align:center;border-radius:16px;text-decoration:none;font-weight:bold}p{font-size:16px}</style><h1>${escape(name)}</h1><a href="lesson.pdf" download>Download PDF</a><p>Keep your phone on the same Wi-Fi as the board PC. This link expires after class.</p></html>`)
    const visits = new Map<string, number[]>()
    const server = createServer((req, res) => {
      const end = (code: number): void => { res.writeHead(code, { 'Content-Length': '0', 'Cache-Control': 'no-store' }); res.end() }
      if (!this.current.active || this.server !== server || Date.now() >= this.current.expiresAt) {
        end(404)
        if (this.server === server) this.stop()
        return
      }
      const now = Date.now(), remote = req.socket.remoteAddress ?? ''
      const recent = (visits.get(remote) ?? []).filter(t => now - t < 60_000)
      if (recent.length >= 200 || (!visits.has(remote) && visits.size >= 2048)) { end(429); return }
      recent.push(now); visits.set(remote, recent)
      if (req.method !== 'GET' && req.method !== 'HEAD') { end(405); return }
      // Match the raw path: URL normalisation must never turn a traversal into an allowed route.
      const match = /^\/([^/]+)\/(lesson\.pdf)?$/.exec(req.url ?? '')
      const supplied = Buffer.from(match?.[1] ?? '')
      const padded = Buffer.alloc(expected.length)
      supplied.copy(padded, 0, 0, expected.length)
      const valid = timingSafeEqual(expected, padded) && supplied.length === expected.length
      if (!match || !valid) { end(404); return }
      const isPdf = !!match[2], body = isPdf ? pdf : html
      res.writeHead(200, {
        'Content-Type': isPdf ? 'application/pdf' : 'text/html; charset=utf-8',
        'Content-Length': body.length,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
        ...(isPdf ? { 'Content-Disposition': `attachment; filename="${filename}"` } : {})
      })
      if (isPdf && req.method === 'GET') res.once('finish', () => {
        if (this.server === server && this.current.active) this.current.downloads++
      })
      res.end(req.method === 'HEAD' ? undefined : body)
    })
    this.server = server
    server.maxConnections = 64
    server.maxHeadersCount = 32
    server.headersTimeout = 10_000
    server.requestTimeout = 15_000
    server.keepAliveTimeout = 5_000
    server.setTimeout(15_000, socket => socket.destroy())
    server.on('connection', socket => { this.sockets.add(socket); socket.once('close', () => this.sockets.delete(socket)) })
    const listen = (port: number): Promise<void> => new Promise((resolve, reject) => {
      const error = (e: Error): void => { server.off('listening', ready); server.off('close', closed); reject(e) }
      const ready = (): void => { server.off('error', error); server.off('close', closed); resolve() }
      const closed = (): void => { server.off('error', error); server.off('listening', ready); reject(new Error('Sharing was stopped')) }
      server.once('error', error); server.once('listening', ready); server.once('close', closed); server.listen(port, address)
    })
    try {
      try { await listen(this.options.port ?? 8723) } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE' || generation !== this.generation) throw error
        await listen(0)
      }
      if (generation !== this.generation) { server.close(); throw new Error('Sharing was stopped') }
      server.on('error', () => { if (this.server === server) this.stop() })
      const port = (server.address() as { port: number }).port
      const url = `http://${address}:${port}/${token}/`
      const expiresAt = Date.now() + (this.options.durationMs ?? 30 * 60_000)
      this.current = { active: true, url, downloads: 0, expiresAt }
      this.expiry = setTimeout(() => this.stop(), Math.max(1, expiresAt - Date.now()))
      this.sweep = setInterval(() => {
        for (const [key, times] of visits) if (Date.now() - times[times.length - 1] >= 60_000) visits.delete(key)
      }, 60_000)
      this.expiry.unref(); this.sweep.unref()
      return { url, expiresAt }
    } catch (error) {
      if (this.server === server) this.stop()
      throw error
    }
  }

  stop(): void {
    this.generation++
    clearTimeout(this.expiry); clearInterval(this.sweep)
    this.current = empty()
    const server = this.server
    this.server = null
    server?.close()
    for (const socket of this.sockets) socket.destroy()
    this.sockets.clear()
  }

  status(): ShareStatus {
    if (this.current.active && Date.now() >= this.current.expiresAt) this.stop()
    return { ...this.current }
  }
}
