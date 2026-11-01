import { createServer, type Server } from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { Socket } from 'node:net'
import type { PollStatus } from '../shared/api'

const MAX_VOTERS = 1000
const empty = (): PollStatus => ({ active: false, url: '', question: '', options: [], counts: [], total: 0, expiresAt: 0 })
const escape = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** What a teacher may ask: short text, two to six answers. Anything else never reaches a phone. */
export function validPoll(question: unknown, options: unknown): options is string[] {
  return typeof question === 'string' && question.length <= 200 && Array.isArray(options) && options.length >= 2 && options.length <= 6 &&
    options.every(o => typeof o === 'string' && o.trim().length > 0 && o.length <= 40)
}

const page = (question: string, options: string[], chosen: number | null): string => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Class poll</title>
<style>body{font:18px system-ui,sans-serif;margin:0;padding:24px;background:#f6f7fb;color:#172033}h1{font-size:24px;margin:0 0 20px}form{display:flex;flex-direction:column;gap:12px}button{font:600 20px system-ui,sans-serif;padding:18px;border-radius:14px;border:2px solid #c7cfe0;background:#fff;color:#172033}button.on{border-color:#2f6bff;background:#e4ecff}p{color:#2f6bff;font-weight:600}</style>
<h1>${escape(question || 'Choose your answer')}</h1>
<form method="post" action="vote">${options.map((o, i) => `<button name="option" value="${i}" class="${chosen === i ? 'on' : ''}">${escape(o)}</button>`).join('')}</form>
${chosen === null ? '' : '<p>Your answer is in. You can still change it.</p>'}</html>`

/** A short-lived class poll on the school's own network: no account, no cloud, one answer per phone. */
export class PollServer {
  private server: Server | null = null
  private sockets = new Set<Socket>()
  private expiry?: ReturnType<typeof setTimeout>
  private current = empty()
  private votes = new Map<string, number>()
  private generation = 0

  constructor(private options: { durationMs?: number; port?: number } = {}) {}

  async start({ question, options, address }: { question: string; options: string[]; address: string }): Promise<{ url: string; expiresAt: number }> {
    this.stop()
    const generation = this.generation
    const token = randomBytes(16).toString('base64url')
    const expected = Buffer.from(token)
    this.votes = new Map()
    const server = createServer((req, res) => {
      const end = (code: number): void => { res.writeHead(code, { 'Content-Length': '0', 'Cache-Control': 'no-store' }); res.end() }
      if (!this.current.active || this.server !== server || Date.now() >= this.current.expiresAt) { end(404); if (this.server === server) this.stop(); return }
      // Match the raw path: URL normalisation must never turn a traversal into an allowed route.
      const match = /^\/([^/?]+)\/(vote)?$/.exec(req.url ?? '')
      const supplied = Buffer.from(match?.[1] ?? '')
      const padded = Buffer.alloc(expected.length)
      supplied.copy(padded, 0, 0, expected.length)
      if (!match || supplied.length !== expected.length || !timingSafeEqual(expected, padded)) { end(404); return }
      // One answer per phone: the phone keeps a random id, and answering again replaces its answer.
      const cookie = /(?:^|;\s*)voter=([A-Za-z0-9_-]{16,64})/.exec(req.headers.cookie ?? '')?.[1]
      const voter = cookie ?? randomBytes(16).toString('base64url')
      const send = (): void => {
        const body = Buffer.from(page(question, options, this.votes.get(voter) ?? null))
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
          'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
          'Set-Cookie': `voter=${voter}; Path=/${token}/; HttpOnly; SameSite=Strict`
        })
        res.end(req.method === 'HEAD' ? undefined : body)
      }
      if (!match[2]) {
        if (req.method !== 'GET' && req.method !== 'HEAD') { end(405); return }
        return send()
      }
      if (req.method !== 'POST') { end(405); return }
      let raw = ''
      req.setEncoding('utf8')
      req.on('data', chunk => { raw += chunk; if (raw.length > 64) { end(413); req.destroy() } })
      req.on('end', () => {
        if (res.writableEnded) return
        const value = /^option=(\d)$/.exec(raw.trim())
        const option = value ? Number(value[1]) : -1
        if (!cookie || option < 0 || option >= options.length) { end(400); return }
        if (!this.votes.has(voter) && this.votes.size >= MAX_VOTERS) { end(429); return }
        this.votes.set(voter, option)
        send()
      })
    })
    this.server = server
    server.maxConnections = 128
    server.headersTimeout = 10_000
    server.requestTimeout = 15_000
    server.keepAliveTimeout = 5_000
    server.on('connection', socket => { this.sockets.add(socket); socket.once('close', () => this.sockets.delete(socket)) })
    const listen = (port: number): Promise<void> => new Promise((resolve, reject) => {
      const error = (e: Error): void => { server.off('listening', ready); reject(e) }
      const ready = (): void => { server.off('error', error); resolve() }
      server.once('error', error); server.once('listening', ready); server.listen(port, address)
    })
    try {
      try { await listen(this.options.port ?? 8724) } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE' || generation !== this.generation) throw error
        await listen(0)
      }
      if (generation !== this.generation) { server.close(); throw new Error('The poll was stopped') }
      server.on('error', () => { if (this.server === server) this.stop() })
      const port = (server.address() as { port: number }).port
      const url = `http://${address}:${port}/${token}/`
      const expiresAt = Date.now() + (this.options.durationMs ?? 30 * 60_000)
      this.current = { active: true, url, question, options: [...options], counts: options.map(() => 0), total: 0, expiresAt }
      this.expiry = setTimeout(() => this.stop(), Math.max(1, expiresAt - Date.now()))
      this.expiry.unref()
      return { url, expiresAt }
    } catch (error) {
      if (this.server === server) this.stop()
      throw error
    }
  }

  stop(): void {
    this.generation++
    clearTimeout(this.expiry)
    this.current = empty()
    this.votes = new Map()
    const server = this.server
    this.server = null
    server?.close()
    for (const socket of this.sockets) socket.destroy()
    this.sockets.clear()
  }

  status(): PollStatus {
    if (this.current.active && Date.now() >= this.current.expiresAt) this.stop()
    const counts = this.current.options.map(() => 0)
    for (const v of this.votes.values()) counts[v]++
    return { ...this.current, options: [...this.current.options], counts, total: this.votes.size }
  }
}
