/**
 * Solves school circuits by nodal analysis: every part is a conductance with, where needed, a current
 * source beside it, so a battery's own resistance, a charging capacitor and an ideal wire all reduce to one
 * small matrix. Written here rather than taken from a simulator so the app owes nothing to anyone's licence,
 * and because classroom circuits need steady answers, not transistor models.
 */
export type CircuitPart =
  | { id: string; kind: 'source'; a: string; b: string; volts: number; r: number }
  | { id: string; kind: 'resistor'; a: string; b: string; ohms: number }
  | { id: string; kind: 'diode'; a: string; b: string; drop: number; ron: number }
  | { id: string; kind: 'capacitor'; a: string; b: string; farads: number }
  | { id: string; kind: 'inductor'; a: string; b: string; henries: number; r: number }
  | { id: string; kind: 'open'; a: string; b: string }
  | { id: string; kind: 'short'; a: string; b: string }

export interface PartState { volts: number; amps: number }
/** What a capacitor and a coil carry from one moment to the next. */
export interface Memory { capVolts: Map<string, number>; coilAmps: Map<string, number> }
export const newMemory = (): Memory => ({ capVolts: new Map(), coilAmps: new Map() })

/** A tiny leak to the reference, so a part of a circuit connected to nothing is settled rather than unsolvable. */
const LEAK = 1e-9
const OFF = 1e-9

function solve(A: Float64Array[], b: Float64Array): Float64Array {
  const n = b.length
  for (let c = 0; c < n; c++) {
    let pivot = c
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[pivot][c])) pivot = r
    if (pivot !== c) { const t = A[c]; A[c] = A[pivot]; A[pivot] = t; const v = b[c]; b[c] = b[pivot]; b[pivot] = v }
    const d = A[c][c]
    if (Math.abs(d) < 1e-30) continue
    for (let r = c + 1; r < n; r++) {
      const k = A[r][c] / d
      if (!k) continue
      for (let j = c; j < n; j++) A[r][j] -= k * A[c][j]
      b[r] -= k * b[c]
    }
  }
  const x = new Float64Array(n)
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r]
    for (let j = r + 1; j < n; j++) s -= A[r][j] * x[j]
    x[r] = Math.abs(A[r][r]) < 1e-30 ? 0 : s / A[r][r]
  }
  return x
}

/**
 * `joins` are wires: terminals they tie together are one node. `dt` is the time step for capacitors and coils;
 * with none the circuit is taken as settled (a capacitor is a gap, a coil only its own resistance).
 * A part's `amps` run from its `a` end through it to `b`, except a source, whose amps leave its + end `a`.
 */
export function solveCircuit(parts: CircuitPart[], joins: [string, string][], memory: Memory = newMemory(), dt: number | null = null): Map<string, PartState> {
  const parent = new Map<string, string>()
  const find = (t: string): string => {
    if (!parent.has(t)) parent.set(t, t)
    let root = t
    while (parent.get(root) !== root) root = parent.get(root)!
    let at = t
    while (parent.get(at) !== root) { const next = parent.get(at)!; parent.set(at, root); at = next }
    return root
  }
  const join = (x: string, y: string): void => { parent.set(find(x), find(y)) }
  for (const [x, y] of joins) join(x, y)
  for (const p of parts) if (p.kind === 'short') join(p.a, p.b)

  const index = new Map<string, number>()
  const node = (t: string): number => {
    const root = find(t)
    if (!index.has(root)) index.set(root, index.size)
    return index.get(root)!
  }
  for (const p of parts) { node(p.a); node(p.b) }
  const n = index.size
  const out = new Map<string, PartState>()
  if (!n) return out

  const diodes = new Map(parts.filter(p => p.kind === 'diode').map(p => [p.id, false]))
  let v: Float64Array = new Float64Array(n)
  for (let round = 0; round < 40; round++) {
    const A = Array.from({ length: n }, () => new Float64Array(n)), rhs = new Float64Array(n)
    for (let i = 0; i < n; i++) A[i][i] = LEAK
    const conduct = (a: number, b: number, g: number): void => { A[a][a] += g; A[b][b] += g; A[a][b] -= g; A[b][a] -= g }
    /** Current pushed into `a` and drawn from `b`. */
    const push = (a: number, b: number, amps: number): void => { rhs[a] += amps; rhs[b] -= amps }
    for (const p of parts) {
      const a = node(p.a), b = node(p.b)
      if (a === b) continue
      switch (p.kind) {
        case 'source': { const g = 1 / Math.max(1e-4, p.r); conduct(a, b, g); push(a, b, p.volts * g); break }
        case 'resistor': conduct(a, b, 1 / Math.max(1e-6, p.ohms)); break
        case 'diode': {
          if (diodes.get(p.id)) { const g = 1 / p.ron; conduct(a, b, g); push(a, b, p.drop * g) } else conduct(a, b, OFF)
          break
        }
        case 'capacitor': {
          if (dt) { const g = p.farads / dt; conduct(a, b, g); push(a, b, g * (memory.capVolts.get(p.id) ?? 0)) } else conduct(a, b, OFF)
          break
        }
        case 'inductor': {
          const reach = dt ? p.henries / dt : 0, g = 1 / (p.r + reach)
          conduct(a, b, g)
          if (dt) push(b, a, g * reach * (memory.coilAmps.get(p.id) ?? 0))
          break
        }
        case 'open': conduct(a, b, OFF); break
      }
    }
    v = solve(A, rhs)
    // A diode conducts when forward biased past its drop, and stops when its current would reverse.
    let settled = true
    for (const p of parts) if (p.kind === 'diode') {
      const across = v[node(p.a)] - v[node(p.b)], on = diodes.get(p.id)!
      const next = on ? (across - p.drop) / p.ron > 0 : across > p.drop
      if (next !== on) { diodes.set(p.id, next); settled = false }
    }
    if (settled) break
  }

  for (const p of parts) {
    const a = node(p.a), b = node(p.b), volts = a === b ? 0 : v[a] - v[b]
    let amps = 0
    switch (p.kind) {
      case 'source': amps = a === b ? p.volts / Math.max(1e-4, p.r) : (p.volts - volts) / Math.max(1e-4, p.r); break
      case 'resistor': amps = volts / Math.max(1e-6, p.ohms); break
      case 'diode': amps = diodes.get(p.id) ? (volts - p.drop) / p.ron : 0; break
      case 'capacitor': {
        if (dt) {
          amps = p.farads / dt * (volts - (memory.capVolts.get(p.id) ?? 0))
          memory.capVolts.set(p.id, volts)
        }
        break
      }
      case 'inductor': {
        const reach = dt ? p.henries / dt : 0
        amps = (volts + reach * (memory.coilAmps.get(p.id) ?? 0)) / (p.r + reach)
        if (dt) memory.coilAmps.set(p.id, amps)
        break
      }
      case 'short': amps = 0; break
      case 'open': amps = 0; break
    }
    out.set(p.id, { volts, amps })
  }
  return out
}

