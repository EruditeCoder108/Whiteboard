import { describe, expect, it } from 'vitest'
import { stageBatch } from '../src/renderer/src/engine/agent'
import type { Item } from '../src/renderer/src/engine/types'
const a: Item = { t: 't', id: 'a', c: '#111827', w: 2, p: [0, 0, 100, 100], text: 'One', note: true, fontSize: 24 }
const b: Item = { ...a, id: 'b', p: [120, 0, 240, 100] }
const batch = (operations: unknown[], extra = {}) => ({ expectedRevision: 5, requestId: 'req-1', label: 'Test edit', operations, ...extra })
describe('semantic agent transactions', () => {
  it('creates then updates a referenced object in one staged batch', () => {
    const staged = stageBatch([a], batch([{ op: 'create', id: 'new', kind: 'note', x: 300, y: 100, text: 'New' }, { op: 'update', ids: ['new'], fill: '#dbeafe', bold: true }]), 5)
    expect(staged.items).toHaveLength(2)
    expect(staged.items[1]).toMatchObject({ id: 'new', fill: '#dbeafe', bold: true, note: true })
    expect(a.text).toBe('One')
  })
  it('rejects stale edits and unsupported operations without touching input', () => {
    const original = [a, b]
    expect(() => stageBatch(original, batch([{ op: 'move', ids: ['a'], dx: 3, dy: 4 }]), 6)).toThrow('Board changed')
    expect(() => stageBatch(original, batch([{ op: 'move', ids: ['a'], dx: 3, dy: 4 }, { op: 'execute', code: 'anything' }]), 5)).toThrow('Unknown operation')
    expect(original).toEqual([a, b]); expect(a.p).toEqual([0, 0, 100, 100])
  })
  it('expands groups for movement and removal', () => {
    const group = [{ ...a, group: 'g' }, { ...b, group: 'g' }]
    const moved = stageBatch(group, batch([{ op: 'move', ids: ['a'], dx: 10, dy: 30 }]), 5)
    expect(moved.items[0].p).toEqual([10, 30, 110, 130]); expect(moved.items[1].p).toEqual([130, 30, 250, 130])
    expect(stageBatch(group, batch([{ op: 'remove', ids: ['b'] }]), 5).items).toEqual([])
  })
  it('rejects an entire group if a hidden member is locked', () => {
    const group = [{ ...a, group: 'g' }, { ...b, group: 'g', locked: true }]
    expect(() => stageBatch(group, batch([{ op: 'move', ids: ['a'], dx: 10, dy: 0 }]), 5)).toThrow('Unlock')
    expect(() => stageBatch(group, batch([{ op: 'group', ids: ['a'] }]), 5)).toThrow('Unlock')
  })
  it('arranges groups as units and preserves their relative positions', () => {
    const input = [{ ...a, group: 'g' }, { ...b, group: 'g' }, { ...a, id: 'c', p: [100, 300, 200, 400] } as Item]
    const arranged = stageBatch(input, batch([{ op: 'arrange', ids: ['c', 'b', 'a'], layout: 'row', x: 10, y: 20, gap: 50 }]), 5)
    expect(arranged.items[2].p).toEqual([10, 20, 110, 120]); expect(arranged.items[0].p).toEqual([160, 20, 260, 120])
    expect(arranged.items[1].p).toEqual([280, 20, 400, 120])
  })
  it('rejects invalid styles, NaN, duplicate IDs, missing IDs and unknown fields', () => {
    for (const op of [{ op: 'update', ids: ['a'], opacity: 3 }, { op: 'move', ids: ['a'], dx: NaN, dy: 0 }, { op: 'update', ids: ['a', 'a'], text: 'x' },
      { op: 'remove', ids: ['missing'] }, { op: 'create', kind: 'rect', id: 'a', x: 2, y: 3 }, { op: 'update', ids: ['a'], locked: false }]) {
      expect(() => stageBatch([a], batch([op]), 5)).toThrow()
    }
  })
  it('supports reversed arrow endpoints while rejecting negative note sizes', () => {
    expect(stageBatch([], batch([{ op: 'create', id: 'arrow', kind: 'arrow', x: 100, y: 100, width: -90, height: -40 }]), 5).items[0].p).toEqual([100, 100, 10, 60])
    expect(() => stageBatch([], batch([{ op: 'create', id: 'note', kind: 'note', x: 0, y: 0, width: -5 }]), 5)).toThrow()
  })
  it('ungroups all members and keeps stable object IDs', () => {
    const result = stageBatch([{ ...a, group: 'g' }, { ...b, group: 'g' }], batch([{ op: 'ungroup', ids: ['a'] }]), 5)
    expect(result.items.map(it => it.id)).toEqual(['a', 'b']); expect(result.items.every(it => it.group === undefined)).toBe(true)
  })
  it('resizes text in world coordinates and validates the new geometry', () => {
    const result = stageBatch([a], batch([{ op: 'update', ids: ['a'], x: 50, width: 400, height: 200, text: 'Wider note' }]), 5)
    expect(result.items[0]).toMatchObject({ id: 'a', p: [50, 0, 450, 200], text: 'Wider note' })
    expect(() => stageBatch([a], batch([{ op: 'update', ids: ['a'], width: -1 }]), 5)).toThrow('Invalid object size')
  })
  it('bounds operations and validates transformed coordinates', () => {
    expect(() => stageBatch([a], batch(Array(201).fill({ op: 'remove', ids: ['a'] })), 5)).toThrow('1–200')
    expect(() => stageBatch([{ ...a, p: [1e9, 0, 1e9, 100] }], batch([{ op: 'move', ids: ['a'], dx: 1, dy: 0 }]), 5)).toThrow()
  })
})
