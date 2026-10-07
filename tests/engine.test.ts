import { describe, expect, it } from 'vitest'
import { Smoother, smoothingToCutoff } from '@/engine/smoother'
import { hitCircle, itemBounds, splitErase, translateItem, strokeOutline, shapePolylines } from '@/engine/items'
import { Doc, History, restyleItems } from '@/engine/doc'
import { parseBoard, serializeBoard } from '@/engine/serialize'
import { fitRect, panBy, toScreen, toWorld, zoomAt } from '@/engine/view'
import { densifyTriples, runsOutsideCircle } from '@/engine/geometry'
import type { ShapeItem, StrokeItem } from '@/engine/types'

let n = 0
const line = (x0: number, x1: number, y = 0, v = false): StrokeItem => {
  const p: number[] = []
  for (let x = x0; x <= x1; x += 3) p.push(x, y, 0.5)
  return { t: 's', id: 's' + n++, c: '#111111', w: 4, m: false, v, p }
}
const rect = (x0: number, y0: number, x1: number, y1: number): ShapeItem => ({
  t: 'h', id: 'h' + n++, c: '#ff0000', w: 4, k: 'rect', p: [x0, y0, x1, y1]
})

describe('smoother', () => {
  const circleRadius = (R: number, level: number, speed = 300, hz = 200): number => {
    const sm = new Smoother()
    const dt = 1 / hz
    const steps = Math.floor(((2 * Math.PI * R) / speed) * hz * 1.5)
    let sum = 0
    let cnt = 0
    for (let i = 0; i < steps; i++) {
      const a = ((i * speed) / R) * dt
      const [fx, fy] = sm.feed(100 + R * Math.cos(a), 100 + R * Math.sin(a), i * dt, smoothingToCutoff(level))
      if (i > steps / 3) {
        sum += Math.hypot(fx - 100, fy - 100)
        cnt++
      }
    }
    return sum / cnt
  }
  it('keeps handwriting-sized shapes intact at the default level', () => {
    expect(circleRadius(10, 4)).toBeGreaterThan(8.6) // <14% shrink on a 20px letter
    expect(circleRadius(20, 4)).toBeGreaterThan(19)
  })
  it('suppresses slow jitter', () => {
    const sm = new Smoother()
    let maxDev = 0
    for (let i = 0; i < 200; i++) {
      const jitter = i % 2 ? 1 : -1
      const [, fy] = sm.feed(i * 0.3, 50 + jitter, i / 200, smoothingToCutoff(6))
      if (i > 50) maxDev = Math.max(maxDev, Math.abs(fy - 50))
    }
    expect(maxDev).toBeLessThan(0.6)
  })
})

describe('geometry', () => {
  it('densifies without exceeding the step', () => {
    const d = densifyTriples([0, 0, 0, 10, 0, 1], 2)
    for (let i = 3; i < d.length; i += 3) expect(Math.hypot(d[i] - d[i - 3], d[i + 1] - d[i - 2])).toBeLessThanOrEqual(2.0001)
    expect(d[d.length - 1]).toBe(1)
  })
  it('splits runs around a circle', () => {
    const d = densifyTriples([0, 0, 0.5, 100, 0, 0.5], 2)
    const runs = runsOutsideCircle(d, 50, 0, 10, () => 0)
    expect(runs.length).toBe(2)
  })
})

describe('stroke outline & bounds', () => {
  it('builds a closed outline that contains the stroke', () => {
    const s = line(0, 90, 0, true)
    const o = strokeOutline(s)
    expect(o.length).toBeGreaterThan(10)
    const b = itemBounds(s)
    expect(b[0]).toBeLessThanOrEqual(0)
    expect(b[2]).toBeGreaterThanOrEqual(90)
    expect(b[1]).toBeLessThan(0)
    expect(b[3]).toBeGreaterThan(0)
  })
  it('renders a single tap as a dot', () => {
    const dot: StrokeItem = { t: 's', id: 'dot', c: '#000', w: 10, m: false, v: false, p: [50, 50, 0.5] }
    const b = itemBounds(dot)
    expect(b[2] - b[0]).toBeGreaterThan(8)
  })
  it('translate returns a new, moved item and leaves the original alone', () => {
    const s = line(0, 30)
    const t = translateItem(s, 10, 5) as StrokeItem
    expect(t).not.toBe(s)
    expect(t.p[0]).toBe(s.p[0] + 10)
    expect(s.p[0]).toBe(0)
  })
})

describe('erasing', () => {
  it('hit test respects stroke width', () => {
    const s = line(0, 100, 0)
    expect(hitCircle(s, 50, 8, 5)).toBe(false)
    expect(hitCircle(s, 50, 6, 5)).toBe(true)
  })
  it('pixel erase cuts a stroke into two surviving pieces', () => {
    const s = line(0, 300)
    const frags = splitErase(s, 150, 0, 12)
    expect(frags.length).toBe(2)
    const end0 = frags[0].p[frags[0].p.length - 3]
    const start1 = frags[1].p[0]
    expect(end0).toBeLessThan(150)
    expect(start1).toBeGreaterThan(150)
    expect(start1 - end0).toBeGreaterThan(12)
  })
  it('keeps style on fragments', () => {
    const s = { ...line(0, 300), c: '#2f6bff', m: true, w: 18 }
    const frags = splitErase(s, 150, 0, 12)
    expect(frags.every((f) => f.c === '#2f6bff' && f.m && f.w === 18)).toBe(true)
  })
  it('erasing a whole short stroke leaves nothing', () => {
    expect(splitErase(line(0, 20), 10, 0, 40).length).toBe(0)
  })
  it('pixel-erasing a shape turns it into ink fragments', () => {
    const r = rect(0, 0, 200, 100)
    const frags = splitErase(r, 0, 50, 15)
    expect(frags.length).toBeGreaterThanOrEqual(1)
    expect(frags.every((f) => f.t === 's')).toBe(true)
  })
  it('does not leave single-sample crumbs', () => {
    const frags = splitErase(line(0, 300), 150, 0, 12)
    expect(frags.every((f) => f.p.length >= 6)).toBe(true)
  })
})

describe('shapes', () => {
  it('arrow has a head', () => {
    const polys = shapePolylines({ t: 'h', id: 'a', c: '#000', w: 3, k: 'arrow', p: [0, 0, 100, 0] })
    expect(polys.length).toBe(2)
  })
  it('rect polyline is closed', () => {
    const [poly] = shapePolylines(rect(0, 0, 10, 20))
    expect([poly[0], poly[1]]).toEqual([poly[poly.length - 2], poly[poly.length - 1]])
  })
})

describe('document & history', () => {
  it('restyles a mixed selection in one undo step and keeps IDs and stacking order', () => {
    const doc = new Doc()
    const history = new History(doc)
    const a = line(0, 30)
    const b = rect(0, 0, 30, 40)
    const c = line(60, 90)
    doc.replaceAll([a, b, c])
    const before = doc.snapshot()
    const edited = restyleItems(doc.items, [a, b], { c: '#2f6bff', w: 12 })
    doc.replaceAll(edited.items)
    history.push(doc.diff(before)!)
    expect(edited.selection.map((it) => [it.id, it.c, it.w])).toEqual([[a.id, '#2f6bff', 12], [b.id, '#2f6bff', 12]])
    expect(doc.items[2]).toBe(c)
    history.undo()
    expect(doc.items).toEqual([a, b, c])
    history.redo()
    expect(doc.items).toEqual(edited.items)
  })
  it('does not create replacement items when the selected style already matches', () => {
    const a = line(0, 30)
    const result = restyleItems([a], [a], { c: a.c, w: a.w })
    expect(result.changed).toBe(false)
    expect(result.items[0]).toBe(a)
  })
  it('undo/redo restores order and identity', () => {
    const doc = new Doc()
    const h = new History(doc)
    const a = line(0, 30)
    const b = line(0, 30, 20)
    const c = line(0, 30, 40)
    h.push(doc.push(a))
    h.push(doc.push(b))
    h.push(doc.push(c))
    expect(doc.items).toEqual([a, b, c])
    h.undo()
    expect(doc.items).toEqual([a, b])
    h.redo()
    expect(doc.items).toEqual([a, b, c])
  })
  it('a diff op captures an erase and restores it in place', () => {
    const doc = new Doc()
    const h = new History(doc)
    const a = line(0, 30)
    const b = line(0, 30, 20)
    const c = line(0, 30, 40)
    ;[a, b, c].forEach((x) => doc.push(x))
    const before = doc.snapshot()
    const [f1, f2] = splitErase(b, 15, 20, 4)
    doc.items = [a, f1, f2, c]
    const op = doc.diff(before)!
    h.push(op)
    expect(doc.items.length).toBe(4)
    h.undo()
    expect(doc.items).toEqual([a, b, c])
    h.redo()
    expect(doc.items).toEqual([a, f1, f2, c])
  })
  it('a move is just remove+add and undoes cleanly', () => {
    const doc = new Doc()
    const h = new History(doc)
    const a = line(0, 30)
    const b = line(0, 30, 20)
    ;[a, b].forEach((x) => doc.push(x))
    const before = doc.snapshot()
    const moved = translateItem(a, 50, 0)
    doc.items = [moved, b]
    h.push(doc.diff(before)!)
    h.undo()
    expect(doc.items[0]).toBe(a)
  })
  it('new edits clear redo', () => {
    const doc = new Doc()
    const h = new History(doc)
    h.push(doc.push(line(0, 9)))
    h.undo()
    expect(h.canRedo).toBe(true)
    h.push(doc.push(line(0, 9)))
    expect(h.canRedo).toBe(false)
  })
})

describe('serialization', () => {
  it('rejects malformed samples instead of shifting the remaining coordinates', () => {
    const valid = line(0, 9)
    const damaged = { ...valid, id: 'bad', p: [0, 'bad', 0.5, 10, 20, 0.5, 30] }
    const parsed = parseBoard(JSON.stringify({ format: 'floating-whiteboard', version: 1, items: [valid, damaged] }))!
    expect(parsed.items.map((it) => it.id)).toEqual([valid.id])
    expect(parsed.skipped).toBe(1)
  })
  it('rejects unsupported versions and wholly damaged boards', () => {
    expect(parseBoard('{"format":"floating-whiteboard","version":3,"items":[]}')).toBeNull()
    expect(parseBoard('{"format":"floating-whiteboard","version":1,"items":[{"t":"s","c":"#00000","w":-1,"p":[1,2,3]}]}')).toBeNull()
  })
  it('imports Python XY ink, width-based ink and shapes, with a bounded view', () => {
    const parsed = parseBoard(JSON.stringify({ version: 1, view: { x: 12, y: 30, z: 100 }, items: [
      { t: 'ink', c: '#000000', w: 4, m: 0, v: 0, p: [1, 2, 3, 4] },
      { t: 'ink', c: '#000000', w: 10, m: 0, v: 1, p: [0, 0, 4, 10, 20, 16] },
      { t: 'shape', c: '#2f6bff', w: 3, s: 'rect', p: [1, 2, 30, 40] }
    ] }))!
    expect(parsed.legacy).toBe(true)
    expect(parsed.skipped).toBe(0)
    expect(parsed.items[0].p).toEqual([1, 2, 0.5, 3, 4, 0.5])
    expect(parsed.items[1].p).toEqual([0, 0, 0, 10, 20, 1])
    expect(parsed.items[2].t).toBe('h')
    expect(parsed.view).toEqual({ x: 12, y: 30, zoom: 16 })
    expect(parseBoard(serializeBoard(parsed.items))!.legacy).toBe(false)
  })
  it('does not treat unrelated JSON as a legacy board', () => {
    expect(parseBoard('{"version":1,"items":[{"t":"other"}]}')).toBeNull()
  })
  it('round-trips items and view', () => {
    const items = [line(0, 90, 0, true), rect(5, 5, 50, 60)]
    const json = serializeBoard(items, { x: 12, y: -4, zoom: 1.5 })
    const back = parseBoard(json)!
    expect(back.items.length).toBe(2)
    expect(back.view).toEqual({ x: 12, y: -4, zoom: 1.5 })
    expect((back.items[0] as StrokeItem).p.length).toBe(items[0].p.length)
    expect((back.items[1] as ShapeItem).k).toBe('rect')
  })
  it('survives garbage', () => {
    expect(parseBoard('not json')).toBeNull()
    expect(parseBoard('{"format":"nope"}')).toBeNull()
    const ok = parseBoard(
      JSON.stringify({ format: 'floating-whiteboard', version: 1, items: [null, 5, { t: 's' }, { t: 's', c: '#000', w: 3, p: [1, 2, 0.5] }] })
    )!
    expect(ok.items.length).toBe(1)
  })
})

describe('view math', () => {
  it('world/screen round trip', () => {
    const v = { x: 100, y: 50, zoom: 2 }
    const [sx, sy] = toScreen(v, 130, 80)
    expect(toWorld(v, sx, sy)).toEqual([130, 80])
  })
  it('zoom keeps the anchor fixed', () => {
    const v = { x: 0, y: 0, zoom: 1 }
    const before = toWorld(v, 300, 200)
    const v2 = zoomAt(v, 2.5, 300, 200)
    const after = toWorld(v2, 300, 200)
    expect(after[0]).toBeCloseTo(before[0])
    expect(after[1]).toBeCloseTo(before[1])
  })
  it('pan moves content with the pointer', () => {
    const v = panBy({ x: 0, y: 0, zoom: 2 }, 100, 40)
    expect(v.x).toBe(-50)
    expect(v.y).toBe(-20)
  })
  it('fit shows the whole rect', () => {
    const v = fitRect([0, 0, 1000, 500], 800, 600, 50)
    const [x1, y1] = toScreen(v, 1000, 500)
    expect(x1).toBeLessThanOrEqual(800)
    expect(y1).toBeLessThanOrEqual(600)
  })
})
