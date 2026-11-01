import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '@/engine/apparatus/examples'
import { PARTS, partOf } from '@/engine/apparatus/parts'
import { buildCircuit, fromPart, isPart, isWire, newPart, terminalOf, toPart } from '@/engine/apparatus/world'
import { solveCircuit } from '@/engine/apparatus/circuit'
import { itemFromJson, itemToJson } from '@/engine/serialize'
import type { ApparatusItem, Item, ShapeItem } from '@/engine/types'

const stateOf = (items: Item[], kind: string): { amps: number; volts: number } => {
  const { parts, joins } = buildCircuit(items, 0)
  const id = items.find(i => i.t === 'a' && (i as ApparatusItem).kind === kind)!.id
  return solveCircuit(parts, joins).get(id)!
}
const example = (id: string): Item[] => EXAMPLES.find(e => e.id === id)!.build()
const flip = (items: Item[], kind: string, key: string, value: number): void => { for (const i of items) if (isPart(i) && i.kind === kind) i.params[key] = value }

describe('the collection', () => {
  it('goes well beyond a dozen for each subject, with no name repeated', () => {
    const count = (s: string): number => PARTS.filter(p => p.subject === s).length
    expect(count('physics')).toBeGreaterThanOrEqual(25)
    expect(count('chemistry')).toBeGreaterThanOrEqual(13)
    expect(count('biology')).toBeGreaterThanOrEqual(13)
    expect(new Set(PARTS.map(p => p.kind)).size).toBe(PARTS.length)
    expect(new Set(PARTS.map(p => p.name)).size).toBe(PARTS.length)
  })

  it('every part saves and loads, keeping its state', () => {
    for (const part of PARTS) {
      const it = newPart(part, 400, 300, 1, { ...part.params })
      const back = itemFromJson(itemToJson(it)) as ApparatusItem
      expect(back, part.kind).not.toBeNull()
      expect(back.kind).toBe(part.kind)
      expect(back.params).toEqual(part.params)
    }
  })

  it('every setting and control acts on values the part really has', () => {
    for (const part of PARTS) {
      for (const s of part.settings ?? []) if (!s.apply) expect(part.params, `${part.kind}.${s.key}`).toHaveProperty(s.key)
      for (const c of part.controls ?? []) {
        const [x, y] = c.at({ ...part.params })
        expect(x >= -1 && x <= part.w + 1 && y >= -1 && y <= part.h + 1, `${part.kind}: ${c.name}`).toBe(true)
      }
      for (const [x, y] of part.terminals ?? []) expect(x >= 0 && x <= part.w && y >= 0 && y <= part.h, part.kind).toBe(true)
      if (part.circuit) expect(part.terminals?.length, part.kind).toBe(2)
    }
  })

  it('a corrupt part is refused, and a harmful name never reaches a file path or a class', () => {
    const good = itemToJson(newPart(partOf('resistor')!, 0, 0)) as Record<string, unknown>
    expect(itemFromJson({ ...good, kind: '../../x' })).toBeNull()
    expect(itemFromJson({ ...good, params: { r: 'ten' } })).toBeNull()
    expect(itemFromJson({ ...good, params: { '__proto__x': 1 } })).toBeNull()
    expect((itemFromJson({ ...good, kind: 'from-a-newer-version' }) as ApparatusItem).kind).toBe('from-a-newer-version')
  })
})

describe('positions', () => {
  it('a turned, resized part still finds its own spots', () => {
    const part = partOf('battery')!
    const it: ApparatusItem = { ...newPart(part, 500, 400, 1.5), angle: .7 }
    const [wx, wy] = fromPart(it, part, 60, 22)
    const [x, y] = toPart(it, part, wx, wy)
    expect(x).toBeCloseTo(60)
    expect(y).toBeCloseTo(22)
  })

  it('a wire end finds the nearest terminal', () => {
    const part = partOf('resistor')!
    expect(terminalOf(part, [.1, .8])).toBe(0)
    expect(terminalOf(part, [.9, .8])).toBe(1)
    expect(terminalOf(part, undefined)).toBe(-1)
  })
})

describe('circuits made of parts', () => {
  it('the switch controls the bulb, at the bulb\'s rated power', () => {
    const items = example('bulb')
    expect(Math.abs(stateOf(items, 'bulb').amps)).toBeLessThan(1e-6)
    flip(items, 'switch', 'on', 1)
    const on = stateOf(items, 'bulb')
    // A 6 V battery with a little resistance of its own, across a 12 ohm bulb.
    expect(Math.abs(on.amps)).toBeCloseTo(6 / 12.2, 2)
  })

  it('two bulbs in series share the voltage; in parallel each gets it all', () => {
    const series = stateOf(example('series'), 'bulb'), parallel = stateOf(example('parallel'), 'bulb')
    expect(Math.abs(series.volts)).toBeCloseTo(6, 0)
    expect(Math.abs(parallel.volts)).toBeGreaterThan(5.5)
  })

  it("in the Ohm's law set-up the meters agree with V = IR", () => {
    const items = example('ohm')
    const a = stateOf(items, 'ammeter').amps, v = stateOf(items, 'voltmeter').volts
    expect(a).toBeGreaterThan(.1)
    expect(Math.abs(v / a)).toBeCloseTo(10, 1)
    flip(items, 'rheostat', 'pos', .05)
    expect(stateOf(items, 'ammeter').amps).toBeGreaterThan(a)
  })

  it('meters read forwards in the example set-ups', () => {
    const items = example('ohm')
    expect(stateOf(items, 'ammeter').amps).toBeGreaterThan(0)
    expect(stateOf(items, 'voltmeter').volts).toBeGreaterThan(0)
  })

  it('every wire in every example joins real terminals', () => {
    for (const e of EXAMPLES) {
      const items = e.build(), ids = new Set(items.map(i => i.id))
      for (const w of items.filter(isWire) as ShapeItem[]) {
        expect(ids.has(w.from!.id) && ids.has(w.to!.id), e.id).toBe(true)
        for (const v of w.p) expect(Number.isFinite(v)).toBe(true)
      }
      for (const it of items) expect(itemFromJson(itemToJson(it)), e.id).not.toBeNull()
    }
  })
})
