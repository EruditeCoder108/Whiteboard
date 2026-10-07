import { describe, expect, it } from 'vitest'
import { LaserTool } from '@/engine/laser'
import type { Ptr } from '@/engine/tool-types'

function harness() {
  let now = 0
  const laser = new LaserTool({ requestOverlay() {} }, () => now)
  const segments: { points: number[][]; width: number; alpha: number }[] = []
  let path: number[][] = []
  const ctx = {
    lineWidth: 0, globalAlpha: 1, lineCap: '', lineJoin: '', strokeStyle: '', fillStyle: '',
    save() {}, restore() {}, beginPath() { path = [] },
    moveTo(x: number, y: number) { path.push([x, y]) }, lineTo(x: number, y: number) { path.push([x, y]) },
    quadraticCurveTo(cx: number, cy: number, x: number, y: number) { path.push([cx, cy], [x, y]) },
    createLinearGradient() { return { addColorStop() {} } },
    stroke(this: { lineWidth: number; globalAlpha: number }) { segments.push({ points: path.slice(), width: this.lineWidth, alpha: this.globalAlpha }) },
    arc() {}, fill() {}
  } as unknown as CanvasRenderingContext2D
  const point = (x: number, y: number, type: Ptr['type'] = 'touch'): Ptr => ({ id: 1, type, x, y, wx: x, wy: y, t: now, pressure: .5, buttons: 1, shift: false, alt: false, ctrl: false })
  return { laser, segments, point, time(t: number) { now = t }, paint() { segments.length = 0; laser.paintOverlay(ctx) } }
}

describe('laser pointer', () => {
  it('never draws a bridge between separate touch contacts, even with the same pointer ID', () => {
    const h = harness()
    h.laser.down(h.point(10, 10)); h.time(.1); h.laser.up(h.point(40, 10))
    h.time(.2); h.laser.down(h.point(400, 10)); h.time(.3); h.laser.up(h.point(430, 10)); h.paint()
    expect(h.segments.filter(s => s.width === 1.8).map(s => [s.points[0], s.points.at(-1)])).toEqual([[[10, 10], [40, 10]], [[400, 10], [430, 10]]])
  })
  it('retains the final lifted endpoint after a fast drag', () => {
    const h = harness()
    h.laser.down(h.point(0, 0)); h.time(.01); h.laser.move(h.point(200, 40)); h.time(.02); h.laser.up(h.point(600, 60)); h.paint()
    expect(h.segments.at(-1)?.points.at(-1)).toEqual([600, 60])
  })
  it('keeps a high-rate trail beyond the old 400-point cutoff without dropping batches', () => {
    const h = harness()
    h.laser.down(h.point(0, 0))
    for (let i = 1; i <= 1200; i++) { h.time(i / 2000); h.laser.move(h.point(i, i % 2)) }
    h.paint()
    const core = h.segments.filter(s => s.width === 1.8)
    expect(core).toHaveLength(1) // continuous painting prevents sample-density-dependent beads
    expect(core[0].points[0]).toEqual([0, 0]); expect(core.at(-1)?.points.at(-1)).toEqual([1200, 0])
    expect(core.at(-1)?.alpha).toBeGreaterThan(.94)
    expect(h.segments.every(s => s.width <= 4)).toBe(true)
  })
  it('interpolates expiry at the tail and finishes animation after touch release', () => {
    const h = harness()
    h.laser.down(h.point(0, 0)); h.time(1); h.laser.up(h.point(100, 0))
    h.time(2.5); h.paint()
    expect(h.segments[0].points[0][0]).toBeCloseTo(10)
    h.time(3.5); h.paint(); expect(h.segments).toEqual([]); expect(h.laser.animating).toBe(false)
  })
  it('starts a fresh path after pointer leave and fades the dot when switching tools', () => {
    const h = harness()
    h.laser.hover(h.point(0, 0, 'mouse')); h.time(.1); h.laser.hover(h.point(30, 0, 'mouse'))
    h.laser.leave(); h.time(.2); h.laser.hover(h.point(300, 0, 'mouse')); h.time(.3); h.laser.hover(h.point(330, 0, 'mouse')); h.paint()
    expect(h.segments.filter(s => s.width === 1.8).map(s => [s.points[0], s.points.at(-1)])).toEqual([[[0, 0], [30, 0]], [[300, 0], [330, 0]]])
    h.laser.cancel(); h.time(3); h.paint(); expect(h.laser.animating).toBe(false)
  })
  it('ignores stale input samples instead of snapping the head backwards', () => {
    const h = harness()
    h.laser.down(h.point(0, 0)); h.time(.2); h.laser.move(h.point(100, 0)); h.time(.3)
    h.laser.move({ ...h.point(40, 0), t: .1 }); h.paint()
    expect(h.segments.at(-1)?.points.at(-1)).toEqual([100, 0])
  })
})
