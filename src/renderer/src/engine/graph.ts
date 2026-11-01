import type { GraphItem } from './types'

/** A compiled expression in x. Parsed by hand: no eval, no access to anything but Math. */
export type Fn = (x: number) => number

const FUNCS: Record<string, (v: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp,
  ln: Math.log, log: Math.log10, floor: Math.floor, ceil: Math.ceil, sign: Math.sign,
  sec: v => 1 / Math.cos(v), cosec: v => 1 / Math.sin(v), csc: v => 1 / Math.sin(v), cot: v => 1 / Math.tan(v)
}
const CONSTS: Record<string, number> = { pi: Math.PI, π: Math.PI, e: Math.E }

/** Grammar: sum := product (± product)*; product := unary ((*|/|implicit) unary)*; unary := -unary | power; power := atom (^ unary)? */
export function compile(source: string): Fn | null {
  const text = source.replace(/^\s*y\s*=\s*/i, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/²/g, '^2').replace(/³/g, '^3')
  const raw = text.match(/\d*\.?\d+(?:e[+-]?\d+)?|[a-zπ]+|[-+*/^(),|]/gi)
  if (!raw || raw.join('') !== text.replace(/\s+/g, '')) return null
  // Split runs such as "sinx", "2pix" or "xcosx" into known names, longest first.
  const names = [...Object.keys(FUNCS), ...Object.keys(CONSTS), 'x'].sort((p, q) => q.length - p.length)
  const tokens: string[] = []
  for (const t of raw) {
    if (!/^[a-zπ]+$/i.test(t)) { tokens.push(t); continue }
    for (let rest = t.toLowerCase(); rest;) {
      const name = names.find(n => rest.startsWith(n))
      if (!name) return null
      tokens.push(name); rest = rest.slice(name.length)
    }
  }
  let i = 0
  const peek = (): string | undefined => tokens[i]
  type Node = (x: number) => number
  const atom = (): Node => {
    const t = tokens[i++]
    if (t === undefined) throw 0
    if (t === '(') { const e = sum(); if (tokens[i++] !== ')') throw 0; return e }
    if (t === '|') { const e = sum(); if (tokens[i++] !== '|') throw 0; return x => Math.abs(e(x)) }
    if (/^\d|^\./.test(t)) { const v = Number(t); return () => v }
    const name = t.toLowerCase()
    if (name === 'x') return x => x
    if (name in CONSTS) { const v = CONSTS[name]; return () => v }
    if (name in FUNCS) {
      const f = FUNCS[name]
      // sin^2(x) and sin x are both common on a board.
      let power: Node | null = null
      if (peek() === '^') { i++; power = unary() }
      const arg = peek() === '(' ? atom() : unary()
      return power ? x => f(arg(x)) ** power!(x) : x => f(arg(x))
    }
    // Implicit products of letters, such as "pix" or "ex", are not guessed.
    throw 0
  }
  const power = (): Node => {
    const base = atom()
    if (peek() !== '^') return base
    i++
    const exp = unary()
    return x => base(x) ** exp(x)
  }
  const unary = (): Node => {
    if (peek() === '-') { i++; const v = unary(); return x => -v(x) }
    if (peek() === '+') { i++; return unary() }
    return power()
  }
  const product = (): Node => {
    let left = unary()
    for (;;) {
      const t = peek()
      if (t === '*' || t === '/') { i++; const a = left, b = unary(); left = t === '*' ? x => a(x) * b(x) : x => a(x) / b(x) }
      else if (t !== undefined && t !== ')' && t !== '|' && t !== '+' && t !== '-' && t !== ',' && t !== '^') { const a = left, b = unary(); left = x => a(x) * b(x) }
      else return left
    }
  }
  const sum = (): Node => {
    let left = product()
    while (peek() === '+' || peek() === '-') { const t = tokens[i++]; const a = left, b = product(); left = t === '+' ? x => a(x) + b(x) : x => a(x) - b(x) }
    return left
  }
  try {
    const fn = sum()
    if (i !== tokens.length) return null
    return fn
  } catch { return null }
}

const cache = new Map<string, Fn | null>()
const compiled = (src: string): Fn | null => { if (!cache.has(src)) cache.set(src, compile(src)); return cache.get(src)! }

export const GRAPH_COLORS = ['#2f6bff', '#e5484d', '#2fa66a', '#8a4fff', '#f28c28']

/** "Nice" tick spacing: 1, 2 or 5 × 10^n. */
function step(range: number, target: number): number {
  const raw = range / target, mag = 10 ** Math.floor(Math.log10(raw)), n = raw / mag
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * mag
}
const label = (v: number, s: number): string => Math.abs(v) < s / 1e6 ? '0' : Number(v.toFixed(Math.max(0, -Math.floor(Math.log10(s))))).toString()

export function paintGraph(ctx: CanvasRenderingContext2D, it: GraphItem): void {
  const [x0, y0, x1, y1] = it.p
  const W = x1 - x0, H = y1 - y0
  if (W <= 0 || H <= 0) return
  const [a, b] = it.xr, [c, d] = it.yr
  const sx = (x: number): number => x0 + (x - a) / (b - a) * W
  const sy = (y: number): number => y1 - (y - c) / (d - c) * H
  const font = Math.max(10, Math.min(W, H) / 26)
  ctx.save()
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x0, y0, W, H)
  ctx.beginPath(); ctx.rect(x0, y0, W, H); ctx.clip()
  const dx = step(b - a, W / 70), dy = step(d - c, H / 70)
  ctx.lineWidth = Math.max(.5, font / 16); ctx.strokeStyle = '#e3e7ee'
  ctx.beginPath()
  for (let x = Math.ceil(a / dx) * dx; x <= b; x += dx) { ctx.moveTo(sx(x), y0); ctx.lineTo(sx(x), y1) }
  for (let y = Math.ceil(c / dy) * dy; y <= d; y += dy) { ctx.moveTo(x0, sy(y)); ctx.lineTo(x1, sy(y)) }
  ctx.stroke()
  // Axes sit at zero when visible, otherwise along the nearest edge.
  const ax = Math.min(Math.max(sx(0), x0), x1), ay = Math.min(Math.max(sy(0), y0), y1)
  ctx.strokeStyle = '#4b5563'; ctx.lineWidth = Math.max(1, font / 10)
  ctx.beginPath(); ctx.moveTo(x0, ay); ctx.lineTo(x1, ay); ctx.moveTo(ax, y0); ctx.lineTo(ax, y1); ctx.stroke()
  ctx.fillStyle = '#4b5563'; ctx.font = `${font}px "Segoe UI", "Nirmala UI", sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  for (let x = Math.ceil(a / dx) * dx; x <= b; x += dx) if (Math.abs(x) > dx / 2) ctx.fillText(label(x, dx), sx(x), Math.min(ay + font * .3, y1 - font * 1.2))
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
  for (let y = Math.ceil(c / dy) * dy; y <= d; y += dy) if (Math.abs(y) > dy / 2) ctx.fillText(label(y, dy), Math.max(ax - font * .3, x0 + font * 2.2), sy(y))
  ctx.lineWidth = Math.max(1.5, font / 5); ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  it.fns.forEach((src, n) => {
    const f = compiled(src)
    if (!f) return
    ctx.strokeStyle = GRAPH_COLORS[n % GRAPH_COLORS.length]
    ctx.beginPath()
    const samples = Math.max(200, Math.round(W * 1.5))
    let pen = false, prev = NaN
    for (let k = 0; k <= samples; k++) {
      const x = a + (b - a) * k / samples, y = f(x)
      // Break the line at undefined points and at asymptotes (huge jumps across the view).
      if (!Number.isFinite(y) || (Number.isFinite(prev) && Math.abs(y - prev) > (d - c) * 4)) { pen = false; prev = y; continue }
      const py = Math.min(Math.max(sy(y), y0 - H), y1 + H)
      if (pen) ctx.lineTo(sx(x), py); else ctx.moveTo(sx(x), py)
      pen = true; prev = y
    }
    ctx.stroke()
    ctx.fillStyle = ctx.strokeStyle; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.font = `600 ${font * 1.1}px "Segoe UI", "Nirmala UI", sans-serif`
    ctx.fillText(`y = ${src.replace(/^\s*y\s*=\s*/i, '')}`, x0 + font * .6, y0 + font * (.5 + n * 1.5))
  })
  ctx.restore()
  ctx.strokeStyle = '#9aa3b2'; ctx.lineWidth = Math.max(1, font / 12); ctx.strokeRect(x0, y0, W, H)
}
