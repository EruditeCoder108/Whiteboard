import { describe, expect, it } from 'vitest'
import { calculate, showNumber } from '../src/renderer/src/engine/calculator'
import { ELEMENTS, FAMILY_NAMES } from '../src/renderer/src/engine/elements'
import { writingStrip } from '../src/renderer/src/engine/strips'

describe('the calculator', () => {
  it('does sums as they are written', () => {
    expect(calculate('2 × (3 + 4)')).toBe(14)
    expect(calculate('10 ÷ 4')).toBe(2.5)
    expect(calculate('7 − 10')).toBe(-3)
    expect(calculate('2^10')).toBe(1024)
    expect(calculate('√(16)')).toBe(4)
    expect(calculate('50%')).toBe(.5)
    expect(calculate('200×15%')).toBe(30)
    expect(calculate('.1+.2')).toBe(.3)
  })

  it('takes angles in degrees, and closes brackets left open', () => {
    expect(calculate('sin(30)')).toBeCloseTo(.5, 9)
    expect(calculate('cos(60)')).toBeCloseTo(.5, 9)
    expect(calculate('tan(45)')).toBeCloseTo(1, 9)
    expect(calculate('sin(15 + 15)')).toBeCloseTo(.5, 9)
    expect(calculate('sin(30')).toBeCloseTo(.5, 9)
    expect(calculate('2×(3+4')).toBe(14)
    expect(calculate('pi')).toBeCloseTo(Math.PI, 9)
  })

  it('says nothing rather than a wrong answer', () => {
    expect(calculate('')).toBeNull()
    expect(calculate('2+')).toBeNull()
    expect(calculate('5÷0')).toBeNull()
    expect(calculate('3)')).toBeNull()
    expect(calculate('√(−1)')).toBeNull()
    expect(showNumber(-2)).toBe('−2')
  })
})

describe('the periodic table', () => {
  it('has all 118 elements, each once, in their places', () => {
    expect(ELEMENTS).toHaveLength(118)
    expect(ELEMENTS.map(e => e.z)).toEqual(Array.from({ length: 118 }, (_, i) => i + 1))
    expect(new Set(ELEMENTS.map(e => e.symbol)).size).toBe(118)
    expect(new Set(ELEMENTS.map(e => `${e.col},${e.row}`)).size).toBe(118)
    for (const e of ELEMENTS) {
      expect(e.col).toBeGreaterThanOrEqual(1); expect(e.col).toBeLessThanOrEqual(18)
      expect(FAMILY_NAMES[e.family]).toBeTruthy()
      expect(e.mass).toMatch(/^(\d+\.\d+|\d+\.\d+|\[\d+\])$/)
    }
  })

  it('matches what a teacher knows', () => {
    const at = (s: string) => ELEMENTS.find(e => e.symbol === s)!
    expect(at('C')).toMatchObject({ z: 6, group: 14, period: 2, family: 'nonmetal' })
    expect(at('Na')).toMatchObject({ z: 11, group: 1, period: 3, name: 'Sodium', family: 'alkali' })
    expect(at('Fe')).toMatchObject({ z: 26, group: 8, period: 4, mass: '55.845' })
    expect(at('Cl')).toMatchObject({ z: 17, group: 17, family: 'halogen', mass: '35.45' })
    expect(at('Au')).toMatchObject({ z: 79, group: 11, period: 6 })
    expect(at('U')).toMatchObject({ z: 92, group: null, period: 7, family: 'actinide' })
    expect(at('Ce')).toMatchObject({ z: 58, group: null, period: 6, family: 'lanthanide' })
    expect(at('Og')).toMatchObject({ z: 118, group: 18, period: 7 })
  })

  it('periods run in order across each row', () => {
    for (const row of [1, 2, 3, 4, 5]) {
      const cells = ELEMENTS.filter(e => e.row === row).sort((a, b) => a.col - b.col)
      cells.reduce((prev, e) => { expect(e.z).toBeGreaterThan(prev); return e.z }, 0)
    }
  })
})

describe('writing strips', () => {
  it('are lines grouped together, as the writing papers draw them', () => {
    const four = writingStrip('fourline', false)
    expect(four).toHaveLength(4)
    expect(new Set(four.map(l => l.group)).size).toBe(1)
    expect(four[2].c).toBe('#e5484d')
    const hindi = writingStrip('hindi', false)
    expect(hindi).toHaveLength(2)
    expect(hindi[0].w).toBeGreaterThan(hindi[1].w)
    expect(hindi[1].dash).toBe('dashed')
  })

  it('use colours that show on a dark board', () => {
    expect(writingStrip('fourline', true)[0].c).not.toBe(writingStrip('fourline', false)[0].c)
  })
})
