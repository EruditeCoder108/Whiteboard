import { describe, expect, it } from 'vitest'
import { gridLevel, squareGridLevel } from '@/engine/grid'

/** World-origin lattice intensity, including the retained coarse subset. */
const opacity = (zoom: number, x: number, y: number, dots: boolean): number => {
  const { step, fade } = gridLevel(zoom), ix = x / step, iy = y / step
  if (Math.abs(ix - Math.round(ix)) > 1e-8 || (dots && Math.abs(iy - Math.round(iy)) > 1e-8)) return 0
  return Math.round(ix) % 2 === 0 && (!dots || Math.round(iy) % 2 === 0) ? 1 : fade
}
describe('decorative world lattice', () => {
  it('has bounded viewport work over the entire supported zoom range', () => {
    for (let zoom = .05; zoom <= 16; zoom *= 1.013) {
      const { step, fade } = gridLevel(zoom)
      expect(step * zoom).toBeGreaterThanOrEqual(18 - 1e-10)
      expect(step * zoom).toBeLessThanOrEqual(36 + 1e-10)
      expect(fade).toBeGreaterThanOrEqual(0); expect(fade).toBeLessThanOrEqual(1)
    }
  })
  it('retains world-point intensity at each density boundary in either direction', () => {
    for (const zoom of [.05625, .1125, .225, .45, .9, 1.8, 3.6, 7.2, 14.4]) {
      const step = gridLevel(zoom * (1 - 1e-7)).step
      for (const dots of [true, false]) for (let x = -4; x <= 4; x++) for (let y = -4; y <= 4; y++) {
        expect(opacity(zoom * (1 - 1e-7), x * step / 2, y * step / 2, dots))
          .toBeCloseTo(opacity(zoom * (1 + 1e-7), x * step / 2, y * step / 2, dots), 10)
      }
    }
  })
})

describe('square graph paper', () => {
  const intensity = (zoom: number, world: number): number => {
    const { step, fade } = squareGridLevel(zoom), index = world / step
    if (Math.abs(index - Math.round(index)) > 1e-8) return 0
    return Math.round(index) % 4 === 0 ? 1 : fade
  }

  it('keeps useful squares even at the extreme zoom levels without unbounded drawing', () => {
    for (let zoom = .05; zoom <= 16; zoom *= 1.007) {
      const { step, fade } = squareGridLevel(zoom)
      expect(step * zoom).toBeGreaterThanOrEqual(8 - 1e-10)
      expect(step * zoom).toBeLessThanOrEqual(32 + 1e-10)
      expect(4 * step * zoom).toBeLessThanOrEqual(128 + 1e-10)
      expect(fade).toBeGreaterThanOrEqual(0)
      expect(fade).toBeLessThanOrEqual(1)
    }
  })

  it('does not replace the visible lattice at a zoom boundary or when reversing direction', () => {
    for (const boundary of [.1, .4, 1.6, 6.4]) {
      const outgoing = squareGridLevel(boundary * (1 - 1e-7)).step
      for (let i = -32; i <= 32; i++) {
        const world = i * outgoing / 4
        expect(intensity(boundary * (1 - 1e-7), world))
          .toBeCloseTo(intensity(boundary * (1 + 1e-7), world), 10)
      }
    }
  })

  it('starts with gentle subdivisions and preserves the same world lattice after 4x zoom', () => {
    expect(squareGridLevel(1)).toEqual({ step: 20, fade: .5 })
    for (const zoom of [.05, .2, .39, .75, 1, 2.32, 4]) {
      const a = squareGridLevel(zoom), b = squareGridLevel(zoom * 4)
      expect(a.step).toBe(b.step * 4)
      expect(a.fade).toBeCloseTo(b.fade, 12)
    }
  })
})
