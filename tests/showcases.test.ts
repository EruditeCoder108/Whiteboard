import { describe, expect, it } from 'vitest'
import { getModel, labDuration, labState, EXPLAIN_REVEAL } from '@/engine/science/models'
import { fluxState, heartState, indicatorState, validMagnetTrace } from '@/engine/science/showcase-models'
import { indicatorColour } from '@/engine/science/indicator-studio'
import { itemFromJson, serializeBoard, parseBoard } from '@/engine/serialize'
import { LabRuntime } from '@/engine/science/runtime'
import { ReplayRecorder, ReplayTimeline } from '@/engine/replay'
import type { LabItem } from '@/engine/types'
const lab = (model: string): LabItem => ({ t: 'l', id: model, model, labVersion: 1, modelVersion: 1, c: '#007c88', w: 1, p: [0, 0, 1000, 640], frozenTime: 0, theme: 'blueprint', params: { ...getModel(model)!.defaults }, reveal: { ...EXPLAIN_REVEAL } })
describe('Showcase science and native persistence', () => {
  it('hand-driven induction obeys an independently differentiated Faraday law', () => {
    const p: Record<string, number> = { ...lab('flux-studio').params, motion: 1 }, trace = [{ t: 0, x: -0.3 }, { t: 2, x: 0.3 }, { t: 2.05, x: 0.3 }]
    for (const t of [0.2, 0.6, 1.4, 1.8]) {
      const h = 1e-6, s = fluxState(p, t, trace), derivative = (fluxState(p, t + h, trace).flux - fluxState(p, t - h, trace).flux) / (2 * h)
      expect(s.velocity).toBeCloseTo(0.3, 12); expect(s.emf).toBeCloseTo(-p.turns * derivative, 7)
    }
    expect(fluxState(p, 2.05, trace).emf).toBe(0); expect(fluxState(p, 20, trace).velocity).toBe(0)
    expect(fluxState(p, 0.5, trace).emf).toBeLessThan(0); expect(fluxState(p, 1.5, trace).emf).toBeGreaterThan(0)
  })
  it('zero motion gives zero voltage and doubling turns doubles voltage, not flux', () => {
    const p = lab('flux-studio').params, a = fluxState(p, 0.7), b = fluxState({ ...p, turns: p.turns * 2 }, 0.7)
    expect(b.emf).toBeCloseTo(a.emf * 2); expect(b.flux).toBe(a.flux); expect(fluxState({ ...p, motion: 1 }, 3).emf).toBe(0)
  })
  it('a long recorded trace survives reopening, clamps playback and has no seek-order dependence', () => {
    const a = { ...lab('flux-studio'), params: { ...lab('flux-studio').params, motion: 1 }, gesture: [{ t: 0, x: -0.3 }, { t: 20, x: 0.3 }, { t: 20.05, x: 0.3 }], frozenTime: 10 }
    const restored = parseBoard(serializeBoard([a], { x: 0, y: 0, zoom: 1 }))!.items[0] as LabItem
    expect(restored).toEqual(a); expect(labDuration(restored)).toBeCloseTo(20.3)
    const expected = labState(restored, 3); labState(restored, 19); expect(labState(restored, 3)).toEqual(expected); expect(Object.values(labState(restored, NaN)).every(Number.isFinite)).toBe(true)
    const runtime = new LabRuntime(); runtime.seek(restored, 100); expect(runtime.time(restored)).toBeCloseTo(20.3); runtime.seek(restored, 10); runtime.play(restored, 1000); runtime.tick([restored], 1200); expect(runtime.time(restored)).toBeCloseTo(10.2)
    expect(JSON.parse(serializeBoard([restored], { x: 0, y: 0, zoom: 1 }))).toEqual(JSON.parse(serializeBoard([a], { x: 0, y: 0, zoom: 1 })))
  })
  it('rejects malformed, unbounded and oversized motion traces without mutating a board', () => {
    const a = lab('flux-studio')
    for (const gesture of [[], [{ t: 0, x: 0 }], [{ t: 0, x: 0 }, { t: 0, x: 0.1 }], [{ t: 0, x: 0 }, { t: 1, x: 0.5 }], [{ t: 0, x: 0 }, { t: 31, x: 0 }], [{ t: 0, x: 0, extra: 1 }, { t: 1, x: 0 }], Array.from({ length: 801 }, (_, i) => ({ t: i / 100, x: 0 }))]) {
      expect(validMagnetTrace(gesture)).toBe(false); expect(itemFromJson({ ...a, gesture })).toBeNull()
    }
    expect(itemFromJson({ ...lab('heart-studio'), gesture: [{ t: 0, x: 0 }, { t: 1, x: 0 }] })).toBeNull()
  })
  it('native frozen motion edits also survive backward lesson replay', () => {
    let now = 0; const a = lab('flux-studio'), b = { ...a, params: { ...a.params, motion: 1 }, gesture: [{ t: 0, x: -0.3 }, { t: 1, x: 0.3 }, { t: 1.05, x: 0.3 }], frozenTime: 1.05 }
    const recorder = new ReplayRecorder([a], { x: 0, y: 0, zoom: 1 }, { w: 1000, h: 640 }, '#ffffff', 'Induction', null, () => now)
    now = 500; recorder.capture([b], { x: 0, y: 0, zoom: 1 }, 'Hand motion'); now = 1000
    const timeline = new ReplayTimeline(recorder.snapshot()); expect(timeline.frame(600).items[0]).toEqual(b); expect(timeline.frame(0).items[0]).toEqual(a)
  })
  it('every chemistry frame conserves liquid and stoichiometric reactants, including extreme amounts', () => {
    for (const p of [lab('indicator-studio').params, { acid: 100, base: 5, concentration: 0.2 }, { acid: 5, base: 100, concentration: 0.01 }]) for (let t = 0; t <= 16; t += 0.07) {
      const s = indicatorState(p, t)
      expect(s.volume).toBeCloseTo(20 + p.acid * s.acidPour + p.base * s.basePour, 10)
      expect(s.acidRemaining + s.gas).toBeCloseTo(p.acid * p.concentration * s.acidPour, 10)
      expect(s.baseRemaining + s.gas).toBeCloseTo(p.base * p.concentration * s.basePour, 10)
      expect(s.volume).toBeLessThanOrEqual(220); expect(s.ph).toBeGreaterThan(0); expect(s.ph).toBeLessThan(14)
    }
  })
  it('the reaction is neutral initially, acid before bicarbonate, and reaches its expected final gas yield', () => {
    const p = lab('indicator-studio').params
    expect(indicatorState(p, 0).ph).toBeCloseTo(7); expect(indicatorState(p, 5.6).ph).toBeLessThan(4); expect(indicatorState(p, 5.6).gas).toBe(0)
    expect(indicatorState(p, 16)).toMatchObject({ gas: 3, volume: 100, acidPour: 1, basePour: 1 })
    expect(indicatorColour(7)).toBe(indicatorColour(7 + 1e-8))
  })
  it('heartbeat timing follows bpm, and inlet/outlet valves never open together', () => {
    const p = lab('heart-studio').params
    for (let t = 0; t < 4; t += 0.003) { const s = heartState(p, t); expect(s.avOpen * s.outflowOpen).toBe(0); expect(s.fill).toBeGreaterThanOrEqual(0.35); expect(s.fill).toBeLessThanOrEqual(1) }
    expect(heartState(p, 0.3)).toMatchObject({ stage: 0, avOpen: 1, outflowOpen: 0 })
    expect(heartState(p, 0.73)).toMatchObject({ stage: 2, avOpen: 0, outflowOpen: 1 })
    expect(heartState(p, 0.95)).toMatchObject({ stage: 3, avOpen: 0, outflowOpen: 0 })
    expect(heartState({ ...p, bpm: 120 }, 0.365)).toEqual({ ...heartState(p, 0.73), bpm: 120 })
  })
})
