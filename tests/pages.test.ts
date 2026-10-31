import { describe, expect, it } from 'vitest'
import { PAGE_H, PAGE_W, clampToFrame, fitZoom, frameForContent, frameView, scrollOf, validFrame } from '@/engine/pages'

const W = 1920, H = 1080
const sheet = { x: 0, y: 0, extent: 1 }

describe('page mode', () => {
  it('a page fills a 16:9 screen exactly and cannot be zoomed out or panned off', () => {
    const v = clampToFrame({ x: -500, y: 300, zoom: .2 }, sheet, W, H)
    expect(v.zoom).toBeCloseTo(fitZoom(W, H))
    expect(v.x).toBeCloseTo(0); expect(v.y).toBeCloseTo(0)
  })

  it('zoomed in, the view stays inside the sheet', () => {
    const v = clampToFrame({ x: 5000, y: -400, zoom: 3 }, sheet, W, H)
    expect(v.x + W / v.zoom).toBeCloseTo(PAGE_W)
    expect(v.y).toBeCloseTo(0)
  })

  it('a taller (16:10) screen centres the sheet with letterbox bands', () => {
    const v = frameView(sheet, 1920, 1200)
    expect(v.x).toBeCloseTo(0)
    expect(v.y).toBeLessThan(0)
    expect(v.y + 1200 / v.zoom).toBeGreaterThan(PAGE_H)
  })

  it('an extended page scrolls from top to bottom', () => {
    const long = { x: 0, y: 0, extent: 3 }
    const bottom = frameView(long, W, H, 1)
    expect(bottom.y + H / bottom.zoom).toBeCloseTo(PAGE_H * 3)
    expect(scrollOf(bottom, long, H)).toBeCloseTo(1)
    expect(scrollOf(frameView(long, W, H), long, H)).toBe(0)
  })

  it('content from the endless canvas gets a sheet that holds it', () => {
    expect(frameForContent([100, 100, 900, 600])).toEqual(sheet)
    const f = frameForContent([-300, 200, 600, 2500])
    expect(f.x).toBeLessThan(-300); expect(f.y).toBeLessThan(200)
    expect(f.y + f.extent * PAGE_H).toBeGreaterThanOrEqual(2500)
  })

  it('rejects broken frames from files', () => {
    expect(validFrame({ x: 0, y: 0, extent: 2 })).toEqual({ x: 0, y: 0, extent: 2 })
    expect(validFrame({ x: 0, y: 0, extent: 0 })).toBeUndefined()
    expect(validFrame({ x: NaN, y: 0, extent: 1 })).toBeUndefined()
    expect(validFrame({ x: 0, y: 0, extent: 99 })).toBeUndefined()
  })
})
