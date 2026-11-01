import { afterEach, describe, expect, it, vi } from 'vitest'
import { request, createServer, type Server } from 'node:http'
import { connect } from 'node:net'
import * as os from 'node:os'
import { ShareServer, listAddresses } from '../src/main/share'

vi.mock('node:os', async original => ({ ...await original<typeof os>(), networkInterfaces: vi.fn() }))
const servers: ShareServer[] = []
const pdf = Buffer.from('%PDF-1.7\nexample lesson\n%%EOF')
const make = (options: { durationMs?: number; port?: number } = {}): ShareServer => {
  const s = new ShareServer({ port: 0, ...options }); servers.push(s); return s
}
const start = (s: ShareServer, name = 'Fractions'): Promise<{ url: string; expiresAt: number }> => s.start({ pdf, name, address: '127.0.0.1' })
const get = (url: string, path?: string, method = 'GET'): Promise<{ code: number; headers: import('node:http').IncomingHttpHeaders; body: Buffer }> => new Promise((resolve, reject) => {
  const u = new URL(url)
  const req = request({ hostname: u.hostname, port: u.port, path: path ?? u.pathname, method, agent: false }, res => {
    const chunks: Buffer[] = []
    res.on('data', chunk => chunks.push(chunk))
    res.on('end', () => resolve({ code: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks) }))
    res.on('error', reject)
  })
  req.on('error', reject); req.end()
})
const listener = (s: ShareServer): Server => (s as unknown as { server: Server }).server
afterEach(() => { for (const s of servers) s.stop(); servers.length = 0; vi.useRealTimers(); vi.restoreAllMocks() })

describe('phone sharing', () => {
  it('starts explicitly, serves just the page and PDF with the right headers and bytes', async () => {
    const s = make()
    expect(s.status().active).toBe(false)
    const { url, expiresAt } = await start(s)
    expect(expiresAt - Date.now()).toBeGreaterThan(29 * 60_000)
    expect(Buffer.from(new URL(url).pathname.split('/')[1], 'base64url').length).toBeGreaterThanOrEqual(16)
    const page = await get(url), file = await get(url + 'lesson.pdf')
    expect(page.code).toBe(200)
    expect(page.body.toString()).toContain('<h1>Fractions</h1>')
    expect(page.body.toString()).toContain('Download PDF')
    expect(file.code).toBe(200)
    expect(file.headers['content-type']).toBe('application/pdf')
    expect(file.headers['content-disposition']).toBe('attachment; filename="Fractions.pdf"')
    expect(file.body).toEqual(pdf)
    expect(file.headers['cache-control']).toBe('no-store')
  })

  it('rejects wrong tokens, traversal, other files, queries and methods without body detail', async () => {
    const { url } = await start(make()), path = new URL(url).pathname
    for (const target of ['/', '/wrong/', path.replace(/.$/, 'x/'), path + '../x', path + 'lesson.json', path + 'lesson.pdf/x', path + '?x=1', path + '%2e%2e/lesson.pdf']) {
      const r = await get(url, target)
      expect(r.code, target).toBe(404); expect(r.body.length).toBe(0)
    }
    const r = await get(url, undefined, 'POST')
    expect(r.code).toBe(405); expect(r.body.length).toBe(0)
  })

  it('counts completed PDF GETs, but not the landing page or HEAD', async () => {
    const s = make(), { url } = await start(s)
    await get(url)
    const head = await get(url + 'lesson.pdf', undefined, 'HEAD')
    expect(head.code).toBe(200); expect(head.body.length).toBe(0)
    expect(head.headers['content-length']).toBe(String(pdf.length))
    expect(s.status().downloads).toBe(0)
    await get(url + 'lesson.pdf'); await get(url + 'lesson.pdf')
    expect(s.status().downloads).toBe(2)
  })

  it('expires, closes its listener and invalidates the old URL', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const s = make({ durationMs: 100 }), { url } = await start(s), server = listener(s)
    await vi.advanceTimersByTimeAsync(101)
    expect(s.status().active).toBe(false)
    expect(server.listening).toBe(false)
    await expect(get(url)).rejects.toThrow()
  })

  it('stops open sockets as well as the listener and can start a fresh token', async () => {
    const s = make(), { url } = await start(s), server = listener(s), u = new URL(url)
    const socket = connect({ host: u.hostname, port: Number(u.port) })
    await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject) })
    const closed = new Promise<void>(resolve => socket.once('close', () => resolve()))
    s.stop(); await closed
    expect(server.listening).toBe(false)
    const next = await start(s)
    expect(next.url).not.toBe(url)
    expect((await get(next.url, u.pathname)).code).toBe(404)
  })

  it('cannot resume a session whose start was cancelled before listening', async () => {
    const s = make(), pending = start(s), server = listener(s)
    s.stop()
    await expect(pending).rejects.toThrow('Sharing was stopped')
    expect(s.status().active).toBe(false)
    expect(server.listening).toBe(false)
  })

  it('binds only to the selected address', async () => {
    const s = make(), { url } = await start(s)
    expect(listener(s).address()).toMatchObject({ address: '127.0.0.1', family: 'IPv4' })
    await expect(get(url.replace('127.0.0.1', '127.0.0.2'))).rejects.toThrow()
  })

  it('uses a free port if the preferred port is already occupied', async () => {
    const busy = createServer()
    await new Promise<void>(resolve => busy.listen(0, '127.0.0.1', resolve))
    try {
      const port = (busy.address() as { port: number }).port
      const { url } = await start(make({ port }))
      expect(Number(new URL(url).port)).not.toBe(port)
      expect((await get(url)).code).toBe(200)
    } finally { await new Promise<void>(resolve => busy.close(() => resolve())) }
  })

  it('skips internal, link-local and IPv6 addresses and prefers private IPv4', () => {
    const entry = (address: string, internal = false, family = 'IPv4') => ({ address, internal, family, netmask: '', mac: '', cidr: null }) as os.NetworkInterfaceInfo
    vi.mocked(os.networkInterfaces).mockReturnValue({
      Public: [entry('203.0.113.1')], Loopback: [entry('127.0.0.1', true)],
      Unplugged: [entry('169.254.0.2')], 'Wi-Fi': [entry('192.168.1.20'), entry('fe80::1', false, 'IPv6')],
      Ethernet: [entry('10.0.0.5'), entry('172.31.1.2')], Duplicate: [entry('192.168.1.20')]
    })
    expect(listAddresses()).toEqual([
      { name: 'Wi-Fi', address: '192.168.1.20' }, { name: 'Ethernet', address: '10.0.0.5' },
      { name: 'Ethernet', address: '172.31.1.2' }, { name: 'Public', address: '203.0.113.1' }
    ])
    vi.mocked(os.networkInterfaces).mockReturnValue({ Loopback: [entry('127.0.0.1', true)] })
    expect(listAddresses()).toEqual([])
  })

  it('allows 200 requests per remote address in a rolling minute, then returns 429', async () => {
    const s = make(), { url } = await start(s)
    const clock = vi.spyOn(Date, 'now')
    const now = Date.now(); clock.mockReturnValue(now)
    for (let i = 0; i < 200; i++) expect((await get(url, undefined, 'HEAD')).code).toBe(200)
    expect((await get(url)).code).toBe(429)
    clock.mockReturnValue(now + 59_999)
    expect((await get(url)).code).toBe(429)
    clock.mockReturnValue(now + 60_000)
    expect((await get(url)).code).toBe(200)
  })

  it('escapes lesson HTML and keeps filenames safe for response headers', async () => {
    const { url } = await start(make(), '<img src=x>"\r\n/Bad\\name')
    const page = (await get(url)).body.toString()
    expect(page).not.toContain('<img')
    expect(page).toContain('&lt;img src=x&gt;')
    const file = await get(url + 'lesson.pdf')
    expect(file.code).toBe(200)
    expect(file.headers['content-disposition']).toMatch(/^attachment; filename="[\x20-\x7e]+\.pdf"$/)
  })
})
