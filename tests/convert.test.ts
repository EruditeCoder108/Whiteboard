import { describe, expect, it } from 'vitest'
import { FRAME_GAP, canvasToNotebook, nextFrameSlot, notebookToCanvas } from '@/engine/convert'
import { PAGE_H, PAGE_W } from '@/engine/pages'
import type { Item, StrokeItem } from '@/engine/types'

const dot = (id: string, x: number, y: number): StrokeItem => ({ t: 's', id, c: '#000', w: 4, m: false, v: false, p: [x, y, .5, x + 10, y + 10, .5] })
const at = (it: Item): number[] => [it.p[0], it.p[1]]

describe('notebook ⇄ canvas', () => {
  const notebook = [
    { items: [dot('a', 100, 100)], frame: { x: 0, y: 0, extent: 1 } },
    { items: [dot('b', 200, 1500)], frame: { x: 0, y: 0, extent: 2 } }
  ]

  it('lays the pages out side by side as frames, ink moving with its page', () => {
    const { items, frames } = notebookToCanvas(notebook)
    expect(frames).toEqual([{ x: 0, y: 0, extent: 1 }, { x: PAGE_W + FRAME_GAP, y: 0, extent: 2 }])
    expect(at(items.find(it => it.id === 'b')!)).toEqual([PAGE_W + FRAME_GAP + 200, 1500])
  })

  it('round-trips: the same pages with the same ink in the same places', () => {
    const { items, frames } = notebookToCanvas(notebook)
    const pages = canvasToNotebook(items, frames)
    expect(pages.map(p => p.frame.extent)).toEqual([1, 2])
    expect(pages.map(p => p.items.map(at))).toEqual([[[100, 100]], [[200, 1500]]])
  })

  it('drawing outside every frame gets pages of its own, nothing is dropped', () => {
    const pages = canvasToNotebook([dot('in', 50, 50), dot('far', 9000, 300), dot('farther', 12000, 300)], [{ x: 0, y: 0, extent: 1 }])
    expect(pages.flatMap(p => p.items.map(it => it.id)).sort()).toEqual(['far', 'farther', 'in'])
    expect(pages.length).toBe(3)
    for (const p of pages) for (const it of p.items) expect(it.p[0]).toBeGreaterThanOrEqual(0)
  })

  it('a canvas with nothing on it becomes one blank page', () => {
    expect(canvasToNotebook([], [])).toEqual([{ items: [], frame: { x: 0, y: 0, extent: 1 }, paper: 'none' }])
  })

  it('a new frame goes after the last one, or beside the drawing', () => {
    expect(nextFrameSlot([{ x: 0, y: 0, extent: 1 }], [])).toEqual({ x: PAGE_W + FRAME_GAP, y: 0 })
    expect(nextFrameSlot([], [dot('a', 0, 0)]).x).toBeGreaterThan(10)
    expect(nextFrameSlot([], [])).toEqual({ x: 0, y: 0 })
    expect(PAGE_H).toBe(900)
  })
})
