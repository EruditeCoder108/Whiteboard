import { describe, expect, it } from 'vitest'
import { newMemory, solveCircuit } from '@/engine/apparatus/circuit'
import type { CircuitPart } from '@/engine/apparatus/circuit'
import { traceRays } from '@/engine/apparatus/optics'
import type { Optic } from '@/engine/apparatus/optics'
import { CONTENTS, liquidColor, phOf, pour, shellsOf } from '@/engine/apparatus/chem'
import { resistorBands } from '@/engine/apparatus/parts-electric'
import type { Liquid } from '@/engine/apparatus/chem'

const cell = (id: string, a: string, b: string, volts = 6, r = 0): CircuitPart => ({ id, kind: 'source', a, b, volts, r })
const res = (id: string, a: string, b: string, ohms: number): CircuitPart => ({ id, kind: 'resistor', a, b, ohms })

describe('a resistor shows its value', () => {
  const BROWN = '#7a3b16', BLACK = '#111', RED = '#d43b33', VIOLET = '#8a4fd6', YELLOW = '#f5c518', GOLD = '#c9a227'
  it('reads two digits and a multiplier', () => {
    expect(resistorBands(10)).toEqual([BROWN, BLACK, BLACK])
    expect(resistorBands(1000)).toEqual([BROWN, BLACK, RED])
    expect(resistorBands(47)).toEqual([YELLOW, VIOLET, BLACK])
    expect(resistorBands(5)[2]).toBe(GOLD)
  })
})

describe('circuits', () => {
  it("Ohm's law", () => {
    const s = solveCircuit([cell('b', 'b+', 'b-', 6), res('r', 'r1', 'r2', 12)], [['b+', 'r1'], ['r2', 'b-']])
    expect(s.get('r')!.amps).toBeCloseTo(.5, 3)
    expect(s.get('r')!.volts).toBeCloseTo(6, 2)
    expect(s.get('b')!.amps).toBeCloseTo(.5, 3)
  })

  it('resistors in series share the voltage and carry the same current', () => {
    const s = solveCircuit([cell('b', 'p', 'n', 9), res('a', 'p', 'm', 10), res('c', 'm', 'n', 20)], [])
    expect(s.get('a')!.amps).toBeCloseTo(.3, 3)
    expect(s.get('c')!.amps).toBeCloseTo(.3, 3)
    expect(s.get('a')!.volts).toBeCloseTo(3, 2)
    expect(s.get('c')!.volts).toBeCloseTo(6, 2)
  })

  it('in parallel the currents add up at the junction (Kirchhoff)', () => {
    const s = solveCircuit([cell('b', 'p', 'n', 12), res('a', 'p', 'n', 6), res('c', 'p', 'n', 12)], [])
    expect(s.get('a')!.amps).toBeCloseTo(2, 3)
    expect(s.get('c')!.amps).toBeCloseTo(1, 3)
    expect(s.get('b')!.amps).toBeCloseTo(3, 3)
  })

  it('a battery has its own resistance, so its voltage sags under load', () => {
    const s = solveCircuit([cell('b', 'p', 'n', 6, 1), res('r', 'p', 'n', 5)], [])
    expect(s.get('r')!.amps).toBeCloseTo(1, 3)
    expect(s.get('r')!.volts).toBeCloseTo(5, 2)
  })

  it('a short circuit is limited only by the battery, and an open one carries nothing', () => {
    expect(solveCircuit([cell('b', 'p', 'n', 6, .2)], [['p', 'n']]).get('b')!.amps).toBeCloseTo(30, 1)
    const open = solveCircuit([cell('b', 'p', 'n', 6, .2), { id: 'sw', kind: 'open', a: 'p', b: 'x' }, res('r', 'x', 'n', 10)], [])
    expect(Math.abs(open.get('r')!.amps)).toBeLessThan(1e-6)
  })

  it('a voltmeter in series stops the current; an ammeter barely changes it', () => {
    const volt = solveCircuit([cell('b', 'p', 'n', 6), res('v', 'p', 'x', 1e7), res('r', 'x', 'n', 10)], [])
    expect(volt.get('v')!.volts).toBeCloseTo(6, 2)
    expect(Math.abs(volt.get('r')!.amps)).toBeLessThan(1e-5)
    const amp = solveCircuit([cell('b', 'p', 'n', 6), res('a', 'p', 'x', .01), res('r', 'x', 'n', 10)], [])
    expect(amp.get('a')!.amps).toBeCloseTo(.6, 2)
  })

  it('reversing the battery reverses the current', () => {
    const s = solveCircuit([cell('b', 'n', 'p', 6), res('r', 'p', 'n', 6)], [])
    expect(s.get('r')!.amps).toBeCloseTo(-1, 3)
  })

  it('a diode conducts one way only, losing its drop', () => {
    const on = solveCircuit([cell('b', 'p', 'n', 5), { id: 'd', kind: 'diode', a: 'p', b: 'x', drop: .7, ron: .1 }, res('r', 'x', 'n', 43)], [])
    expect(on.get('r')!.amps).toBeCloseTo(.1, 2)
    const off = solveCircuit([cell('b', 'p', 'n', 5), { id: 'd', kind: 'diode', a: 'x', b: 'p', drop: .7, ron: .1 }, res('r', 'x', 'n', 43)], [])
    expect(Math.abs(off.get('r')!.amps)).toBeLessThan(1e-5)
  })

  it('a capacitor charges along the RC curve, then blocks', () => {
    const parts: CircuitPart[] = [cell('b', 'p', 'n', 10), res('r', 'p', 'x', 1000), { id: 'c', kind: 'capacitor', a: 'x', b: 'n', farads: 1e-3 }]
    const memory = newMemory()
    let at1 = 0
    for (let i = 1; i <= 5000; i++) {
      const s = solveCircuit(parts, [], memory, .001)
      if (i === 1000) at1 = s.get('c')!.volts // one time constant
    }
    expect(at1).toBeCloseTo(10 * (1 - Math.exp(-1)), 0)
    expect(solveCircuit(parts, [], memory, .001).get('c')!.volts).toBeGreaterThan(9.8)
  })

  it('a coil slows the current down, then has only its own resistance', () => {
    const parts: CircuitPart[] = [cell('b', 'p', 'n', 10), { id: 'l', kind: 'inductor', a: 'p', b: 'n', henries: 1, r: 10 }]
    const memory = newMemory()
    let first = 0, last = 0
    for (let i = 1; i <= 2000; i++) { const a = solveCircuit(parts, [], memory, .005).get('l')!.amps; if (i === 1) first = a; last = a }
    expect(first).toBeLessThan(.1)
    expect(last).toBeCloseTo(1, 2)
  })

  it('two separate circuits on one page do not disturb each other', () => {
    const s = solveCircuit([cell('b', 'p', 'n', 6), res('r', 'p', 'n', 6), cell('c', 'q', 'm', 3), res('t', 'q', 'm', 3)], [])
    expect(s.get('r')!.amps).toBeCloseTo(1, 3)
    expect(s.get('t')!.amps).toBeCloseTo(1, 3)
  })

  it('an empty page is fine, and a part connected to nothing carries nothing', () => {
    expect(solveCircuit([], []).size).toBe(0)
    expect(Math.abs(solveCircuit([res('r', 'a', 'b', 10)], []).get('r')!.amps)).toBeLessThan(1e-9)
  })
})

describe('optics', () => {
  const lens = (focal: number): Optic => ({ kind: 'lens', at: [0, 0], angle: 0, half: 200, focal })
  const end = (s: { a: number[]; b: number[] }, x: number): number => s.a[1] + (s.b[1] - s.a[1]) * (x - s.a[0]) / (s.b[0] - s.a[0])

  it('a convex lens brings parallel rays to its focus', () => {
    for (const h of [-100, -40, 40, 100]) {
      const segs = traceRays([{ from: [-300, h], dir: [1, 0], color: '#fff' }], [lens(150)])
      expect(segs.length).toBe(2)
      expect(end(segs.at(-1)!.a[0] > -1 ? segs[segs.findIndex(s => s.a[0] > -1)] : segs[0], 150)).toBeCloseTo(0, 3)
    }
  })

  it('a concave lens spreads them as if from its focus', () => {
    const segs = traceRays([{ from: [-300, 50], dir: [1, 0], color: '#fff' }], [lens(-150)])
    const out = segs.find(s => s.a[0] > -1)!
    expect((out.b[1] - out.a[1]) / (out.b[0] - out.a[0])).toBeCloseTo(50 / 150, 3)
  })

  it('the lens formula holds for a point object', () => {
    // 1/v = 1/f + 1/u, u = -400, f = 100 gives v = 133.3
    const segs = traceRays([{ from: [-400, 0], dir: [400, 80], color: '#fff' }], [lens(100)])
    const out = segs.find(s => s.a[0] > -1)!
    expect(end(out, 400 / 3)).toBeCloseTo(0, 2)
  })

  it('a mirror reflects at the equal angle', () => {
    const segs = traceRays([{ from: [-100, -100], dir: [1, 1], color: '#fff' }], [{ kind: 'mirror', at: [0, 0], angle: 0, half: 100 }])
    const out = segs.find(s => s.a[0] > -1 || s !== segs[0])!
    expect(out.b[0]).toBeLessThan(0)
    expect(out.b[1]).toBeGreaterThan(0)
  })

  it('a prism splits white light, with violet bent most', () => {
    const prism: Optic = { kind: 'prism', points: [[0, -120], [120, 90], [-120, 90]] }
    const segs = traceRays([{ from: [-400, 20], dir: [1, -.1], color: '#fff7d6' }], [prism])
    const left = segs.filter(s => s.a[0] > 20 && s.b[0] > 1000)
    const colours = new Set(left.map(s => s.color))
    expect(colours.size).toBe(7)
    const slope = (c: string): number => { const s = left.find(x => x.color === c)!; return (s.b[1] - s.a[1]) / (s.b[0] - s.a[0]) }
    expect(slope('#a855f7')).toBeGreaterThan(slope('#ff3b30'))
  })

  it('a ray that hits nothing just goes on, and a beam is never endless', () => {
    expect(traceRays([{ from: [0, 0], dir: [1, 0], color: '#fff' }], []).length).toBe(1)
    const a: Optic = { kind: 'mirror', at: [0, 0], angle: 0, half: 300 }, b: Optic = { kind: 'mirror', at: [100, 0], angle: Math.PI, half: 300 }
    expect(traceRays([{ from: [50, 0], dir: [1, 0], color: '#fff' }], [a, b]).length).toBeLessThan(40)
  })
})

describe('chemistry', () => {
  const liquid = (ml: number, content = 0, indicator = 0): Liquid => ({ ml, acid: CONTENTS[content].acid * ml, base: CONTENTS[content].base * ml, indicator, dye: CONTENTS[content].dye, temp: 27 })

  it('pH of strong acid and alkali', () => {
    expect(phOf(1, 0, 10)).toBeCloseTo(1, 5) // 0.1 M
    expect(phOf(.01, 0, 10)).toBeCloseTo(3, 5)
    expect(phOf(0, 1, 10)).toBeCloseTo(13, 5)
    expect(phOf(0, 0, 10)).toBe(7)
    expect(phOf(0, 0, 0)).toBe(7)
  })

  it('a titration turns phenolphthalein pink exactly past the end point', () => {
    const flask = liquid(25, 1, 2), burette = liquid(50, 2)
    pour(burette, flask, 24)
    expect(phOf(flask.acid, flask.base, flask.ml)).toBeLessThan(4)
    expect(liquidColor(flask).color).toBe('#dfeefb')
    pour(burette, flask, 1)
    expect(phOf(flask.acid, flask.base, flask.ml)).toBeCloseTo(7, 1)
    pour(burette, flask, .2)
    expect(phOf(flask.acid, flask.base, flask.ml)).toBeGreaterThan(10)
    expect(liquidColor(flask).color).toBe('#e8368f')
    expect(burette.ml).toBeCloseTo(24.8, 5)
  })

  it('litmus goes red in acid and blue in alkali', () => {
    expect(liquidColor(liquid(10, 1, 1)).color).toBe('#d93a4a')
    expect(liquidColor(liquid(10, 2, 1)).color).toBe('#3460d8')
  })

  it('pouring mixes amounts and temperature, and cannot pour what is not there', () => {
    const a = { ...liquid(10), temp: 80 }, b = { ...liquid(10), temp: 20 }
    pour(a, b, 10)
    expect(b.temp).toBeCloseTo(50)
    expect(a.ml).toBe(0)
    pour(a, b, 5)
    expect(b.ml).toBe(20)
  })

  it('shells follow the table', () => {
    expect(shellsOf(1)).toEqual([1])
    expect(shellsOf(2)).toEqual([2])
    expect(shellsOf(8)).toEqual([2, 6])
    expect(shellsOf(11)).toEqual([2, 8, 1])
    expect(shellsOf(18)).toEqual([2, 8, 8])
    expect(shellsOf(20)).toEqual([2, 8, 8, 2])
    expect(shellsOf(26)).toEqual([2, 8, 14, 2])
    expect(shellsOf(24)).toEqual([2, 8, 13, 1])
    expect(shellsOf(29)).toEqual([2, 8, 18, 1])
    expect(shellsOf(36)).toEqual([2, 8, 18, 8])
  })
})
