import { describe, expect, it } from 'vitest'
import { itemBounds } from '../src/renderer/src/engine/items'
import { niceStride, parseAxis, parseStep, plotOf, scaleBox, snapAt, tickLabel, ticksOf, toWorld, togglePoint, validAxis } from '../src/renderer/src/engine/scale'
import { itemFromJson, itemToJson } from '../src/renderer/src/engine/serialize'
import { readableOn } from '../src/renderer/src/engine/shelf'
import { transformItem } from '../src/renderer/src/engine/transforms'
import type { ScaleItem } from '../src/renderer/src/engine/types'

const line: ScaleItem = { t: 'n', id: 'l', c: '#111827', w: 2, p: [0, 0, 1000, 120], x: { min: 0, max: 10, step: 1 } }
const axes: ScaleItem = { t: 'n', id: 'a', c: '#111827', w: 2, p: [0, 0, 1000, 500], x: { min: -5, max: 5, step: 1 }, y: { min: -5, max: 5, step: 1 }, equal: true }

describe('ticks and their labels', () => {
  it('are whole multiples of the step, clean of rounding noise', () => {
    expect(ticksOf({ min: 0, max: 1, step: .1 })).toEqual([0, .1, .2, .3, .4, .5, .6, .7, .8, .9, 1])
    expect(ticksOf({ min: -2.5, max: 2.5, step: 1 })).toEqual([-2, -1, 0, 1, 2])
    expect(ticksOf({ min: 0, max: 1, step: 1 / 3 })).toHaveLength(4)
  })

  it('are labelled by counting in ones, twos, fives or tens', () => {
    expect([.5, 1, 1.2, 3, 6, 11, 21].map(niceStride)).toEqual([1, 1, 2, 5, 10, 20, 50])
  })

  it('read as a teacher writes them', () => {
    expect(tickLabel(-2)).toEqual({ text: '−2' })
    expect(tickLabel(.25)).toEqual({ text: '0.25' })
    expect(tickLabel(.25, 4)).toEqual({ whole: '', num: 1, den: 4 })
    expect(tickLabel(.5, 4)).toEqual({ whole: '', num: 1, den: 2 })
    expect(tickLabel(1.75, 4)).toEqual({ whole: '1', num: 3, den: 4 })
    expect(tickLabel(-.5, 2)).toEqual({ whole: '−', num: 1, den: 2 })
    expect(tickLabel(2, 4)).toEqual({ text: '2' })
  })
})

describe('what the teacher types', () => {
  it('takes a step as a number or a fraction', () => {
    expect(parseStep('2')).toEqual({ step: 2 })
    expect(parseStep('1/4')).toEqual({ step: .25, den: 4 })
    expect(parseStep(' 3 / 4 ')).toEqual({ step: .75, den: 4 })
    expect(parseStep('0')).toBeNull()
    expect(parseStep('abc')).toBeNull()
    expect(parseStep('1/0')).toBeNull()
  })

  it('says what is wrong in plain words', () => {
    expect(parseAxis({ min: '0', max: '10', step: '1', name: ' Time (s) ' })).toEqual({ axis: { min: 0, max: 10, step: 1, name: 'Time (s)' } })
    expect(parseAxis({ min: '−5', max: '5', step: '1', name: '' })).toEqual({ axis: { min: -5, max: 5, step: 1 } })
    expect(parseAxis({ min: '5', max: '1', step: '1', name: '' })).toHaveProperty('problem')
    expect(parseAxis({ min: '', max: '1', step: '1', name: '' })).toHaveProperty('problem')
    expect(parseAxis({ min: '0', max: '1000', step: '1', name: '' })).toHaveProperty('problem')
  })
})

describe('measuring', () => {
  it('one unit is the same length both ways on equal axes, whatever the box', () => {
    const p = plotOf(axes)
    expect(p.ux).toBeCloseTo(p.uy)
    expect((p.x0 + p.x1) / 2).toBeCloseTo(500)
    const free = plotOf({ ...axes, equal: false })
    expect(free.ux).toBeGreaterThan(free.uy)
  })

  it('values land exactly, and a resize or move keeps them on the scale', () => {
    const at = toWorld(axes, 0, 0)
    expect(at[0]).toBeCloseTo(500)
    expect(at[1]).toBeCloseTo(250)
    const moved = transformItem(axes, [0, 0], 2, 2, 0, 100, 50) as ScaleItem
    const again = toWorld(moved, 0, 0)
    expect(again[0]).toBeCloseTo(1100)
    expect(again[1]).toBeCloseTo(550)
    const p = plotOf(moved)
    expect(p.ux).toBeCloseTo(p.uy)
    expect(moved.x).toEqual(axes.x)
  })

  it('a tap goes to the nearest tick, inside the range', () => {
    const [x, y] = toWorld(axes, 2, 3)
    expect(snapAt(axes, x + 3, y - 3)).toEqual([2, 3])
    expect(snapAt(axes, -500, 9999)).toEqual([-5, -5])
    const [lx] = toWorld(line, 7, 0)
    expect(snapAt(line, lx + 2, 500)).toEqual([7, 0])
    const quarters: ScaleItem = { ...line, x: { min: 0, max: 2, step: .25, den: 4 } }
    const [qx] = toWorld(quarters, 1.25, 0)
    expect(snapAt(quarters, qx + 1, 0)[0]).toBe(1.25)
  })

  it('tapping a marked point takes it away', () => {
    const one = togglePoint([], [2, 3])
    expect(one).toEqual([[2, 3]])
    expect(togglePoint(one, [2, 3])).toEqual([])
    expect(togglePoint(one, [3, 3])).toHaveLength(2)
  })

  it('a new object fits the room, and equal axes are true-shaped', () => {
    const b = scaleBox({ min: 0, max: 10, step: 1 }, { min: 0, max: 5, step: 1 }, true, 800, 450, 1600, 900)
    expect(b[2] - b[0]).toBeLessThanOrEqual(1600)
    expect(b[3] - b[1]).toBeLessThanOrEqual(900)
    expect((b[2] - b[0]) / (b[3] - b[1])).toBeCloseTo(2)
    expect((b[0] + b[2]) / 2).toBeCloseTo(800)
    const l = scaleBox({ min: 0, max: 10, step: 1 }, undefined, true, 800, 450, 1600, 900)
    expect(l[3] - l[1]).toBeLessThan(200)
  })
})

describe('as an object', () => {
  it('survives the lesson file with every setting, and a bad one is refused', () => {
    const full: ScaleItem = { ...axes, x: { ...axes.x, name: 'Time (s)', den: 4 }, grid: true, points: [[1, 2], [-3, 4]], coords: true, angle: .5, group: 'g' }
    const back = itemFromJson(JSON.parse(JSON.stringify(itemToJson(full))))
    expect(back).toEqual(full)
    expect(itemFromJson(JSON.parse(JSON.stringify(itemToJson(line))))).toEqual(line)
    const json = JSON.parse(JSON.stringify(itemToJson(line)))
    expect(itemFromJson({ ...json, x: { min: 5, max: 1, step: 1 } })).toBeNull()
    expect(itemFromJson({ ...json, x: { min: 0, max: 1e5, step: 1 } })).toBeNull()
    expect(itemFromJson({ ...json, points: [[1]] })).toBeNull()
    expect(validAxis({ min: 0, max: 1, step: 1, name: 'x'.repeat(200) })).toBe(false)
  })

  it('has its box as its bounds, and its ink follows the board', () => {
    expect(itemBounds(line)).toEqual([0, 0, 1000, 120])
    expect(readableOn([{ ...line, c: '#ffffff' }], '#1d3b33', '#ffffff')[0].c).toBe('#111827')
  })
})
