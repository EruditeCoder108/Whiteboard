import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, evaluate, flight, samples, validParams } from '@/engine/science/projectile'
import { LabRuntime, supportedLab } from '@/engine/science/runtime'
import { labToWorld, launchHandle, worldToLab } from '@/engine/science/scene'
import { transformItem } from '@/engine/transforms'
import { cloneItem, hitObject, itemBounds } from '@/engine/items'
import { Doc, History } from '@/engine/doc'
import { itemFromJson, parseBoard, serializeBoard } from '@/engine/serialize'
import type { LabItem, StrokeItem } from '@/engine/types'
import { ReplayRecorder, ReplayTimeline, parseRecording, serializeRecording } from '@/engine/replay'

const lab = (): LabItem => ({ t: 'l', id: 'lab', c: '#007c88', w: 1, p: [10, 20, 1010, 660], labVersion: 1, model: 'projectile', modelVersion: 1,
  params: { ...DEFAULT_PARAMS }, frozenTime: 0, theme: 'blueprint', reveal: { trajectory: true, vectors: true, graphs: true, energy: true, strobes: true, equations: true, compare: false } })

describe('SI projectile references (NCERT XI §3.9)', () => {
  it('matches the 20 m/s, 30°, g=10 analytical reference at launch, apex and landing', () => {
    const p = { ...DEFAULT_PARAMS, angle: 30, gravity: 10 }, f = flight(p)
    expect(f.duration).toBeCloseTo(2, 12); expect(f.apexTime).toBeCloseTo(1, 12); expect(f.maxHeight).toBeCloseTo(5, 12)
    expect(f.range).toBeCloseTo(20 * Math.sqrt(3), 12)
    expect(evaluate(p, 1).vx).toBeCloseTo(10 * Math.sqrt(3), 12); expect(evaluate(p, 1).vy).toBeCloseTo(0, 12)
    expect(evaluate(p, f.duration)).toMatchObject({ y: 0, landed: true }); expect(evaluate(p, f.duration).vy).toBeCloseTo(-10, 12)
  })
  it('complementary ground angles share range but differ in apex and flight time', () => {
    const a = flight({ ...DEFAULT_PARAMS, angle: 30 }), b = flight({ ...DEFAULT_PARAMS, angle: 60 })
    expect(a.range).toBeCloseTo(b.range, 12); expect(a.duration).toBeLessThan(b.duration); expect(a.maxHeight).toBeLessThan(b.maxHeight)
  })
  it('initial height removes complementary-angle symmetry', () => {
    expect(flight({ ...DEFAULT_PARAMS, angle: 30, height: 10 }).range).not.toBeCloseTo(flight({ ...DEFAULT_PARAMS, angle: 60, height: 10 }).range)
  })
  it('zero-speed drop from 45 m takes 3 s at g=10, with pre-impact vy=-30', () => {
    const p = { ...DEFAULT_PARAMS, speed: 0, height: 45, gravity: 10 }
    expect(flight(p)).toMatchObject({ duration: 3, apexTime: 0, maxHeight: 45, range: 0 })
    expect(evaluate(p, 3)).toMatchObject({ x: 0, y: 0, vy: -30, kinetic: 450, potential: 0, landed: true })
  })
  it('horizontal launch from height 5 m travels 10 m in 1 s', () => {
    const p = { ...DEFAULT_PARAMS, speed: 10, angle: 0, height: 5, gravity: 10 }
    expect(flight(p)).toMatchObject({ duration: 1, range: 10, maxHeight: 5 })
    expect(evaluate(p, 1)).toMatchObject({ vx: 10, vy: -10, y: 0 })
  })
  it('vertical launch has exactly zero horizontal motion and an apex at 2 s', () => {
    const p = { ...DEFAULT_PARAMS, angle: 90, gravity: 10 }
    expect(flight(p)).toMatchObject({ vx: 0, range: 0, duration: 4, apexTime: 2, maxHeight: 20 })
    expect(evaluate(p, 2)).toMatchObject({ x: 0, y: 20, vx: 0, vy: 0 })
  })
  it('zero and horizontal ground launches are bounded zero-duration flights', () => {
    for (const p of [{ ...DEFAULT_PARAMS, speed: 0 }, { ...DEFAULT_PARAMS, angle: 0 }]) {
      expect(flight(p).duration).toBe(0); expect(samples(p).every(s => Number.isFinite(s.energy) && s.y === 0 && s.t === 0)).toBe(true)
    }
  })
  it('conserves mechanical energy through flight, including elevated launch and landing', () => {
    for (const gravity of [0.1, 1.62, 3.71, 9.81, 30]) {
      const p = { ...DEFAULT_PARAMS, height: 12.3, mass: 4.2, gravity }, total = p.mass * (p.speed ** 2 / 2 + p.gravity * p.height)
      for (const s of samples(p, 240)) expect(s.energy).toBeCloseTo(total, 8)
    }
  })
  it('clamps seek to the flight and evaluates identically regardless of sample order', () => {
    const p = DEFAULT_PARAMS, f = flight(p), t = 0.123456789
    const expected = evaluate(p, t)
    samples(p); evaluate(p, f.duration); evaluate(p, 0)
    expect(evaluate(p, t)).toEqual(expected); expect(evaluate(p, -1)).toEqual(evaluate(p, 0)); expect(evaluate(p, 1e5)).toEqual(evaluate(p, f.duration))
  })
  it('rejects invalid, non-finite and out-of-range inputs and bounds sampling', () => {
    expect(validParams(DEFAULT_PARAMS)).toBe(true)
    for (const p of [{ ...DEFAULT_PARAMS, gravity: 0 }, { ...DEFAULT_PARAMS, angle: 91 }, { ...DEFAULT_PARAMS, speed: NaN }, { ...DEFAULT_PARAMS, mass: -1 }, { ...DEFAULT_PARAMS, extra: 1 }, null]) expect(validParams(p)).toBe(false)
    expect(samples(DEFAULT_PARAMS, 1e6)).toHaveLength(241)
  })
})

describe('native lab lifecycle and clock', () => {
  it('frozen lab edits round-trip in replay format 2 and seek reproducibly', () => {
    let now = 0
    const l = lab(), rec = new ReplayRecorder([l], { x: 0, y: 0, zoom: 1 }, { w: 1000, h: 640 }, '#ffffff', 'Science', null, () => now)
    now = 1000; const frozen = { ...l, frozenTime: 1.5 }; rec.capture([frozen], { x: 0, y: 0, zoom: 1 }, 'Freeze')
    const parsed = parseRecording(serializeRecording(rec.snapshot()))!
    expect(parsed.version).toBe(2); expect(new ReplayTimeline(parsed).frame(1000).items).toEqual([frozen]); expect(new ReplayTimeline(parsed).frame(0).items).toEqual([l])
    expect(parseRecording(JSON.stringify({ ...parsed, version: 1 }))).toBeNull()
  })
  it('round-trips lab precision, frozen time, surrounding ink, metadata and stacking order', () => {
    const l = { ...lab(), frozenTime: 1.23456789, group: 'lesson', locked: true, opacity: 0.8, params: { ...DEFAULT_PARAMS, speed: 20.1234567 } }
    const ink: StrokeItem = { t: 's', id: 'ink', c: '#000000', w: 2, p: [12, 20, 0.5, 20, 25, 0.5], m: false, v: false }
    const json = serializeBoard([ink, l, { ...ink, id: 'above' }])
    expect(JSON.parse(json).version).toBe(3); expect(parseBoard(json)?.items).toEqual([ink, l, { ...ink, id: 'above' }])
    expect(JSON.parse(serializeBoard([ink])).version).toBe(2)
  })
  it('preserves an unavailable version for explicit compatibility rendering, without running it', () => {
    const l = { ...lab(), modelVersion: 9 }, runtime = new LabRuntime()
    expect(parseBoard(serializeBoard([l]))?.items).toEqual([l]); expect(supportedLab(l)).toBe(false)
    runtime.play(l, 0); expect(runtime.playing(l)).toBe(false)
  })
  it('rejects malformed labs and a lab hidden inside the old native board version', () => {
    for (const patch of [{ p: [0, 0, 100, 100] }, { modelVersion: 0 }, { params: { ...DEFAULT_PARAMS, gravity: -1 } }, { frozenTime: 1000 }, { reveal: { trajectory: 'yes' } }, { angle: Infinity }]) expect(itemFromJson({ ...lab(), ...patch })).toBeNull()
    expect(parseBoard(JSON.stringify({ format: 'floating-whiteboard', version: 2, items: [lab()] }))).toBeNull()
  })
  it('frame moves, rotation and uniform resizing leave physical state intact', () => {
    const l = lab(), transformed = transformItem(l, [0, 0], 2, 2, Math.PI / 5, 50, 60) as LabItem
    expect(transformed.params).toEqual(l.params); expect(transformed.frozenTime).toBe(l.frozenTime)
    expect((transformed.p[3] - transformed.p[1]) / (transformed.p[2] - transformed.p[0])).toBeCloseTo(0.64)
    const h = launchHandle(transformed), world = labToWorld(transformed, h.tip)
    expect(worldToLab(transformed, ...world)[0]).toBeCloseTo(h.tip[0], 10); expect(worldToLab(transformed, ...world)[1]).toBeCloseTo(h.tip[1], 10)
    expect(itemBounds(l)).toEqual(l.p); expect(hitObject(l, 500, 400, 0)).toBe(true)
    expect(evaluate(transformed.params, 1)).toEqual(evaluate(l.params, 1))
  })
  it('clone retains saved configuration with independent parameter/reveal values after editing', () => {
    const l = lab(), copy = cloneItem(l, 28, 28) as LabItem
    expect(copy.id).not.toBe(l.id); expect(copy.params).toEqual(l.params)
    const edit = { ...copy, params: { ...copy.params, angle: 60 } }
    expect(l.params.angle).toBe(45); expect(edit.params.angle).toBe(60)
  })
  it('uses a wall-clock origin rather than per-frame increments', () => {
    const l = lab(), a = new LabRuntime(), b = new LabRuntime()
    a.play(l, 0); b.play(l, 0)
    for (const now of [16, 27, 300, 700, 1000]) a.tick([l], now)
    b.tick([l], 1000)
    expect(a.time(l)).toBe(1); expect(b.time(l)).toBe(1)
  })
  it('moving a frame retains transient time; parameter and frozen-time edits reset it', () => {
    const l = lab(), runtime = new LabRuntime(); runtime.seek(l, 1.5)
    const moved = { ...l, p: [30, 40, 1030, 680] as LabItem['p'] }
    expect(runtime.time(moved)).toBe(1.5)
    expect(runtime.time({ ...moved, params: { ...moved.params, speed: 10 } })).toBe(0)
    expect(runtime.time({ ...moved, frozenTime: 0.75 })).toBe(0.75)
  })
  it('stops exactly at impact, respects locks and keeps clocks independent', () => {
    const l = lab(), other = { ...lab(), id: 'other', params: { ...DEFAULT_PARAMS, gravity: 1.62 } }, runtime = new LabRuntime()
    runtime.play(l, 0); runtime.play(other, 0); runtime.tick([l, other], 4000)
    expect(runtime.time(l)).toBe(flight(l.params).duration); expect(runtime.playing(l)).toBe(false); expect(runtime.playing(other)).toBe(true)
    const locked = { ...other, locked: true }; runtime.tick([locked], 4100); expect(runtime.playing(locked)).toBe(false)
  })
  it('freeze edits undo and redo once while transient playback leaves Doc untouched', () => {
    const doc = new Doc(), history = new History(doc), l = lab(), runtime = new LabRuntime()
    doc.replaceAll([l]); const version = doc.version
    runtime.play(l, 0); runtime.tick([l], 1000); runtime.seek(l, 0.5)
    expect(doc.version).toBe(version); expect(history.canUndo).toBe(false)
    const before = doc.snapshot(), frozen = { ...l, frozenTime: runtime.time(l) }
    doc.replaceAll([frozen]); history.push(doc.diff(before)!)
    history.undo(); expect(doc.items).toEqual([l]); history.redo(); expect(doc.items).toEqual([frozen])
  })
})
