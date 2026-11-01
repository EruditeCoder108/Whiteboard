import { describe, expect, it } from 'vitest'
import { bristleLines, chiselPressures, grainAlpha, grainValue, inkVaries, inkWidth, outlineOptions } from '@/engine/ink'
import { contactLimits, inputKind, isInputRole, rolesApply } from '@/engine/roles'
import { itemBounds, splitErase, strokeOutline } from '@/engine/items'
import { itemFromJson as parseItem, itemToJson } from '@/engine/serialize'
import type { StrokeItem } from '@/engine/types'

const line = (style?: StrokeItem['style'], n = 40): StrokeItem => {
  const p: number[] = []
  for (let i = 0; i < n; i++) p.push(i * 5, 100, .5)
  return { t: 's', id: 'a', c: '#111827', w: 10, m: false, v: style === 'brush', ...(style ? { style } : {}), p }
}

describe('pen styles', () => {
  it('every style draws a real outline, and a brush tapers only a real stroke', () => {
    for (const style of ['pencil', 'brush', 'chalk', 'felt'] as const) expect(strokeOutline(line(style)).length).toBeGreaterThan(8)
    expect(outlineOptions('brush', 10, true, 40).end.taper).toBeGreaterThan(0)
    expect(outlineOptions('brush', 10, true, 2).end.taper).toBeUndefined()
    expect(strokeOutline(line('brush', 1)).length).toBeGreaterThan(3)
  })

  it('a chisel marker is wider across its tip than along it', () => {
    const across = chiselPressures([0, 0, .5, 10, -10, .5, 20, -20, .5, 30, -30, .5, 40, -40, .5, 50, -50, .5]).at(-1)![2]
    const along = chiselPressures([0, 0, .5, 10, 10, .5, 20, 20, .5, 30, 30, .5, 40, 40, .5, 50, 50, .5]).at(-1)![2]
    expect(across).toBeLessThan(along)
  })

  it('widths follow the style, chalk and the marker ignore speed', () => {
    expect(inkWidth(10, 'pen')).toBe(10)
    expect(inkWidth(10, 'felt')).toBeGreaterThan(inkWidth(10, 'chalk'))
    expect(inkWidth(10, 'pencil')).toBeLessThan(10)
    expect(inkVaries('chalk')).toBe(false)
    expect(inkVaries('felt')).toBe(false)
    expect(inkVaries('brush')).toBe(true)
  })

  it('grain is the same every time, chalk has real gaps and a pencil never fully does', () => {
    expect(grainValue(1234)).toBe(grainValue(1234))
    expect(grainAlpha('chalk', 0, 0)).toBe(0)
    expect(grainAlpha('pencil', 0, 0)).toBeGreaterThan(0)
    expect(grainAlpha('chalk', 1, 1)).toBe(1)
  })

  it('bristles stay inside the stroke and leave a dab alone', () => {
    expect(bristleLines(line('brush', 2).p, 10, .75)).toEqual([])
    for (const l of bristleLines(line('brush').p, 10, .75)) for (let i = 1; i < l.length; i += 2) expect(Math.abs(l[i] - 100)).toBeLessThanOrEqual(5)
  })

  it('the style survives saving, erasing part of a stroke, and an unknown style loses nothing', () => {
    const chalk = line('chalk')
    expect((parseItem(itemToJson(chalk)) as StrokeItem).style).toBe('chalk')
    expect((parseItem(itemToJson(line())) as StrokeItem).style).toBeUndefined()
    const future = parseItem({ ...(itemToJson(chalk) as object), style: 'crayon' }) as StrokeItem
    expect(future.p.length).toBe(chalk.p.length)
    expect(future.style).toBeUndefined()
    const [x0, , x1] = itemBounds(chalk)
    const pieces = splitErase(chalk, (x0 + x1) / 2, 100, 20)
    expect(pieces.length).toBe(2)
    expect(pieces.every(s => s.style === 'chalk')).toBe(true)
  })
})

describe('a tool per input', () => {
  it('a stylus is the tip, a mouse has no role, and an unmeasured touch is a finger', () => {
    expect(inputKind('pen', 3, 0, 0)).toBe('tip')
    expect(inputKind('mouse', 0, 10, 20)).toBeNull()
    expect(inputKind('touch', 8, 0, 0)).toBe('finger')
    expect(inputKind('touch', 0, 10, 20)).toBe('finger')
  })

  it('measured contacts sort by size', () => {
    const l = contactLimits(4, 9, 20)!
    expect(inputKind('touch', 4, l.tipMax, l.thickMax)).toBe('tip')
    expect(inputKind('touch', 9, l.tipMax, l.thickMax)).toBe('thick')
    expect(inputKind('touch', 20, l.tipMax, l.thickMax)).toBe('finger')
  })

  it('refuses measurements that are too alike or out of order', () => {
    expect(contactLimits(4, 4.2, 20)).toBeNull()
    expect(contactLimits(4, 9, 9.5)).toBeNull()
    expect(contactLimits(9, 4, 20)).toBeNull()
    expect(contactLimits(0, 9, 20)).toBeNull()
  })

  it('only applies while writing', () => {
    for (const t of ['pen', 'marker', 'eraser']) expect(rolesApply(t)).toBe(true)
    for (const t of ['select', 'lasso', 'text', 'rect', 'laser']) expect(rolesApply(t)).toBe(false)
    expect(isInputRole('eraser')).toBe(true)
    expect(isInputRole('nope')).toBe(false)
  })
})
