import { describe, expect, it } from 'vitest'
import { FRAME_GAP, canvasToNotebook, notebookToCanvas } from '@/engine/convert'
import { PAGE_W } from '@/engine/pages'
import { backdropOf } from '@/engine/scene'
import { parseBoard, serializePages } from '@/engine/serialize'
import type { PageData } from '@/engine/serialize'
import type { ImageItem, Item, StrokeItem } from '@/engine/types'

const dot = (id: string, x: number, y: number): StrokeItem => ({ t: 's', id, c: '#fff', w: 4, m: false, v: false, p: [x, y, .5, x + 10, y + 10, .5] })
const picture = (id: string): ImageItem => ({ t: 'i', id, c: '#111827', w: 1, p: [0, 0, 100, 60], src: 'data:image/png;base64,iVBORw0KGgo=', aspect: 100 / 60 })
const page = (items: Item[], more: Partial<PageData> = {}): PageData => ({ items, view: { x: 0, y: 0, zoom: 1 }, ...more })
const roundTrip = (pages: PageData[], meta: Parameters<typeof serializePages>[3], shown = 0) => {
  const parsed = parseBoard(serializePages(pages, shown, true, meta).json)!
  return parsed
}

describe('a lesson keeps how it looks (F1, F2)', () => {
  it('a plain canvas with paper is saved with its paper, whatever is on it', () => {
    for (const items of [[], [dot('a', 5, 5)], [dot('a', 5, 5), picture('p')]]) {
      const { json } = serializePages([page(items, { paper: 'fourline' })], 0, true, { kind: 'canvas', frames: [] })
      expect(JSON.parse(json).version).toBe(4)
      expect(parseBoard(json)!.pages![0].paper).toBe('fourline')
    }
  })

  it('only a bare white canvas keeps the old single-board format', () => {
    expect(JSON.parse(serializePages([page([dot('a', 5, 5)], { paper: 'none' })], 0, true, { kind: 'canvas', frames: [], color: '#ffffff' }).json).version).toBe(2)
    expect(JSON.parse(serializePages([page([dot('a', 5, 5)], { paper: 'none' })], 0, true, { kind: 'canvas', frames: [], color: '#1d3b33' }).json).version).toBe(4)
    expect(JSON.parse(serializePages([page([], { paper: 'none', title: 'Warm-up' })], 0, true, { kind: 'canvas', frames: [] }).json).version).toBe(4)
  })

  it('the board colour travels with the file, and pages can override it', () => {
    const parsed = roundTrip([page([dot('a', 5, 5)], { paper: 'none' }), page([], { paper: 'graph', color: '#ffffff' })], { kind: 'notebook', frames: [], color: '#1d3b33' })
    expect(parsed.color).toBe('#1d3b33')
    expect(parsed.pages!.map(p => p.color)).toEqual([undefined, '#ffffff'])
    expect(parsed.pages!.map(p => p.paper)).toEqual(['none', 'graph'])
  })

  it('a file from before the colour was saved has none, so the reader chooses', () => {
    const parsed = parseBoard(JSON.stringify({ format: 'floating-whiteboard', version: 4, kind: 'notebook', page: 0, pages: [{ items: [dot('a', 1, 1)], paper: 'ruled' }], assetKeys: [] }), { externalAssets: true })!
    expect(parsed.color).toBeUndefined()
    expect(parsed.pages![0].paper).toBe('ruled')
    const old = parseBoard(JSON.stringify({ format: 'floating-whiteboard', version: 2, items: [{ ...dot('a', 1, 1) }] }))!
    expect(old.color).toBeUndefined()
    expect(old.pages).toBeUndefined()
  })

  it('page names and paper origins are kept; broken look values are ignored, not fatal', () => {
    const parsed = roundTrip([page([dot('a', 1, 1)], { paper: 'ruled', title: 'Worked example 2', origin: [30, 12.345] })], { kind: 'notebook', frames: [] })
    expect(parsed.pages![0]).toMatchObject({ paper: 'ruled', title: 'Worked example 2', origin: [30, 12.35] })
    const damaged = parseBoard(JSON.stringify({ format: 'floating-whiteboard', version: 4, color: 'blue', page: 0, pages: [{ items: [dot('a', 1, 1)], paper: 'wallpaper', color: 'x', title: 7, origin: [NaN, 1] }], assetKeys: [] }), { externalAssets: true })!
    expect(damaged.skipped).toBe(0)
    expect(damaged.color).toBeUndefined()
    for (const key of ['paper', 'color', 'title', 'origin']) expect(damaged.pages![0]).not.toHaveProperty(key)
  })

  it('a canvas keeps the look of every frame', () => {
    const frames = [{ x: 0, y: 0, extent: 1, paper: 'graph' as const, color: '#1f232b', title: 'Axes', origin: [0, 0] as [number, number] }, { x: 1800, y: 0, extent: 2 }]
    const parsed = roundTrip([page([dot('a', 5, 5)], { paper: 'dots' })], { kind: 'canvas', frames })
    expect(parsed.frames).toEqual([{ x: 0, y: 0, extent: 1, paper: 'graph', color: '#1f232b', title: 'Axes' }, { x: 1800, y: 0, extent: 2 }])
  })

  it('the picture assets still travel in the portable file', () => {
    const parsed = roundTrip([page([picture('p')], { paper: 'lines' })], { kind: 'canvas', frames: [], color: '#fbf6e9' })
    expect(parsed.items.some(it => it.t === 'i')).toBe(true)
    expect(parsed.color).toBe('#fbf6e9')
  })
})

describe('notebook ⇄ canvas keeps every page’s look (F3)', () => {
  const notebook = [
    { items: [dot('a', 100, 100)], frame: { x: 0, y: 0, extent: 1 }, paper: 'fourline' as const, title: 'Letters' },
    { items: [dot('b', 200, 300)], frame: { x: 0, y: 0, extent: 2 }, paper: 'graph' as const, color: '#1d3b33' },
    { items: [], frame: { x: 0, y: 0, extent: 1 }, paper: 'hindi' as const, title: 'Hindi' }
  ]

  it('four-line, graph and Hindi pages go to a canvas and come back with their paper, colour, title, ink and order', () => {
    const { items, frames } = notebookToCanvas(notebook)
    expect(frames.map(f => f.paper)).toEqual(['fourline', 'graph', 'hindi'])
    expect(frames.map(f => f.color)).toEqual([undefined, '#1d3b33', undefined])
    expect(frames.map(f => f.title)).toEqual(['Letters', undefined, 'Hindi'])
    const back = canvasToNotebook(items, frames, 'none')
    expect(back.map(p => p.paper)).toEqual(['fourline', 'graph', 'hindi'])
    expect(back.map(p => p.color)).toEqual([undefined, '#1d3b33', undefined])
    expect(back.map(p => p.title)).toEqual(['Letters', undefined, 'Hindi'])
    expect(back.map(p => p.items.map(it => it.id))).toEqual([['a'], ['b'], []])
    expect(back.map(p => p.frame.extent)).toEqual([1, 2, 1])
    expect(back.every(p => !p.origin)).toBe(true)
  })

  it('the paper starts where its page does: the pattern moves with the ink', () => {
    const { frames } = notebookToCanvas(notebook)
    // page 2 sits one page-width plus a gap to the right; its paper origin moved by the same amount
    expect(frames[1].origin).toEqual([PAGE_W + FRAME_GAP, 0])
    expect(frames[0].origin).toBeUndefined()
  })

  it('a page whose frame is not at the origin keeps its paper aligned with its ink both ways', () => {
    const shifted = [{ items: [dot('a', 300, 460)], frame: { x: -40, y: -40, extent: 1 }, paper: 'ruled' as const }]
    const { items, frames } = notebookToCanvas(shifted)
    // ink moved by (+40, +40); the paper origin (the old world origin) moved with it
    expect(items[0].p.slice(0, 2)).toEqual([340, 500])
    expect(frames[0]).toMatchObject({ x: 0, y: 0, paper: 'ruled', origin: [40, 40] })
    const back = canvasToNotebook(items, frames)
    expect(back[0].origin).toEqual([40, 40])
    expect(back[0].items[0].p.slice(0, 2)).toEqual([340, 500])
  })

  it('canvas frames without their own paper show the canvas paper when they become pages', () => {
    const back = canvasToNotebook([dot('a', 100, 100)], [{ x: 0, y: 0, extent: 1 }, { x: 2000, y: 0, extent: 1, paper: 'music' }], 'lines')
    expect(back.map(p => p.paper)).toEqual(['lines', 'music'])
    // the canvas paper is anchored at the canvas origin: page 1 starts at it, page 2 (x = 2000) is 2000 further on
    expect(back[0].origin).toBeUndefined()
    expect(back.length).toBe(2)
  })

  it('a canvas frame with no paper takes the canvas paper at the canvas origin, wherever the frame is', () => {
    const back = canvasToNotebook([dot('a', 2100, 100)], [{ x: 2000, y: 0, extent: 1 }], 'lines')
    expect(back[0].paper).toBe('lines')
    expect(back[0].origin).toEqual([-2000, 0])
  })

  it('a file round trip of a converted lesson loses nothing either', () => {
    const { items, frames } = notebookToCanvas(notebook)
    const parsed = roundTrip([page(items, { paper: 'none' })], { kind: 'canvas', frames, color: '#fbf6e9' })
    const back = canvasToNotebook(parsed.items, parsed.frames!, 'none')
    expect(back.map(p => [p.paper, p.color, p.title])).toEqual([['fourline', undefined, 'Letters'], ['graph', '#1d3b33', undefined], ['hindi', undefined, 'Hindi']])
  })
})

describe('the backdrop is one description for screen, thumbnails and export', () => {
  it('a page’s own colour and paper win; otherwise the lesson’s apply', () => {
    const base = { color: '#1d3b33', paper: 'none' as const }
    expect(backdropOf(base)).toMatchObject({ color: '#1d3b33', paper: 'none', origin: [0, 0] })
    expect(backdropOf(base, { paper: 'graph', color: '#ffffff', origin: [5, 6] })).toMatchObject({ color: '#ffffff', paper: 'graph', origin: [5, 6] })
    expect(backdropOf({ color: '#fff', paper: 'lines' }, { color: '#000' })).toMatchObject({ color: '#000', paper: 'lines', origin: [0, 0] })
  })
})
