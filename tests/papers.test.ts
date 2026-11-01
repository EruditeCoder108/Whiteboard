import { describe, expect, it } from 'vitest'
import { PAPERS, fadeIn, planPaper, writingLevels } from '@/engine/grid'
import type { Paper, PaperPass, PaperStyle } from '@/engine/grid'
import { canvasToNotebook, notebookToCanvas } from '@/engine/convert'
import { PAGE_H, PAGE_W } from '@/engine/pages'
import { artTargets, backdropOf, placeArt, screensOf } from '@/engine/scene'
import { parseBoard, serializePages } from '@/engine/serialize'
import type { PageData } from '@/engine/serialize'
import type { Rect, StrokeItem, View } from '@/engine/types'
import { S, applySettings, snapshotSettings } from '@/state/store'
import { cloudTile, textureTile, tileNoise } from '@/engine/texture'

const W = 1600, H = 900
const view = (zoom: number, x = 0, y = 0): View => ({ x, y, zoom })
const plan = (paper: Paper, v: View, style?: Partial<PaperStyle>, opts: { dark?: boolean; cells?: Rect[]; adapt?: boolean } = {}): PaperPass[] =>
  planPaper(v, W, H, paper, !!opts.dark, { spacing: 1, strength: 1, ...style }, opts.cells, opts.adapt)
/** y positions (CSS px) of the full-width horizontal strips of one pass */
const rows = (p: PaperPass): number[] => {
  const out: number[] = [], r = p.rects ?? []
  for (let i = 0; i < r.length; i += 4) if (r[i + 2] === W) out.push(r[i + 1] + r[i + 3] / 2)
  return out.sort((a, b) => a - b)
}
const gaps = (ys: number[]): number[] => ys.slice(1).map((y, i) => y - ys[i])
const work = (passes: PaperPass[]): number => passes.reduce((n, p) => n + (p.rects?.length ?? 0) + (p.dots?.length ?? 0) + (p.segs?.length ?? 0), 0)
const ink: StrokeItem = { t: 's', id: 'a', c: '#111827', w: 3, m: false, v: false, p: [10, 10, .5, 40, 40, .5] }

describe('writing papers follow the zoom on the open canvas', () => {
  it('is exactly the preset near 100%, and the two sizes always add up to one paper', () => {
    expect(writingLevels(1)).toEqual([{ scale: 1, weight: 1 }])
    for (let z = .05; z <= 16; z *= 1.01) {
      const total = writingLevels(z).reduce((s, l) => s + l.weight, 0)
      expect(total).toBeCloseTo(1, 4) // a weight below 1e-5 is not drawn
    }
  })

  it('changes smoothly: no jump in the mix from one zoom step to the next', () => {
    let prev = writingLevels(.05)
    for (let z = .05 * 1.002; z <= 16; z *= 1.002) {
      const cur = writingLevels(z)
      const weight = (ls: typeof cur, s: number): number => ls.find(l => l.scale === s)?.weight ?? 0
      for (const l of [...cur, ...prev]) expect(Math.abs(weight(cur, l.scale) - weight(prev, l.scale))).toBeLessThan(.02)
      prev = cur
    }
  })

  it('four-line bands keep a readable gap on screen however far you zoom (the main size)', () => {
    for (const z of [.08, .2, .5, 1, 2, 5, 12]) {
      const main = writingLevels(z).reduce((a, b) => (b.weight > a.weight ? b : a))
      const gap = 16 * main.scale * z
      expect(gap).toBeGreaterThanOrEqual(16 / Math.SQRT2 - 1e-9)
      expect(gap).toBeLessThanOrEqual(16 * Math.SQRT2 + 1e-9)
    }
  })

  it('zooming in on the canvas no longer spreads the lines apart; on a page they stay with the page', () => {
    const adapt = gaps(rows(plan('ruled', view(6), {}, { adapt: true })[0]))
    expect(Math.max(...adapt)).toBeLessThan(80)
    const fixed = gaps(rows(plan('ruled', view(6))[0]))
    expect(fixed[0]).toBeCloseTo(52 * 6, 6)
  })

  it('zooming out fades crowded lines away instead of turning them into a solid block', () => {
    const far = plan('fourline', view(.1))
    expect(far.every(p => p.alpha < .001)).toBe(true)
    expect(fadeIn(2, 3, 7)).toBe(0)
    expect(fadeIn(8, 3, 7)).toBe(1)
  })

  it('the lines stay on the same world lattice at every size (ink written at 100% still sits on a line)', () => {
    for (const z of [.3, 2.5, 7]) for (const l of writingLevels(z)) {
      const period = 52 * l.scale
      expect(Number.isInteger(Math.log2(period / 52))).toBe(true)
    }
  })
})

describe('paper settings', () => {
  it('spacing scales the whole pattern', () => {
    expect(gaps(rows(plan('ruled', view(1))[0]))[0]).toBeCloseTo(52, 6)
    expect(gaps(rows(plan('ruled', view(1), { spacing: 2 })[0]))[0]).toBeCloseTo(104, 6)
    expect(gaps(rows(plan('music', view(1), { spacing: .5 })[0]))[0]).toBeCloseTo(75, 6) // staves 150 apart, halved
  })

  it('strength changes how strong the lines are, but paper always stays lighter than ink', () => {
    const normal = plan('ruled', view(1))[0].alpha
    expect(plan('ruled', view(1), { strength: .55 })[0].alpha).toBeCloseTo(normal * .55, 6)
    for (const paper of PAPERS) for (const p of plan(paper, view(1), { strength: 2.5 }, { cells: [[0, 0, W, H]] })) expect(p.alpha).toBeLessThanOrEqual(.7)
  })

  it('a line colour replaces the main lines; margins and baselines keep their red', () => {
    const passes = plan('fourline', view(1), { lines: '#16a34a' })
    expect(passes.map(p => p.rgb)).toEqual(['22,163,74', '22,163,74', '229,72,77', '22,163,74'])
    const ruled = plan('ruled', view(1, -40), { lines: '#16a34a' })
    expect(ruled.at(-1)!.rgb).toBe('229,72,77') // margin
  })

  it('chalk colours on a dark board', () => {
    expect(plan('ruled', view(1), {}, { dark: true })[0].rgb).toBe('140,180,255')
  })
})

describe('graph paper keeps its scale and draws cleanly', () => {
  it('lines follow the page smoothly (no rounding to whole pixels while panning)', () => {
    const a = plan('graph', view(1, 0))[0].rects!, b = plan('graph', view(1, .3))[0].rects!
    expect(a[0] - b[0]).toBeCloseTo(.3, 6)
  })

  it('a bold line, and a crossing, is exactly as dark as the bold line should be', () => {
    const [fine, major] = plan('graph', view(1))
    const combined = 1 - (1 - fine.alpha) * (1 - major.alpha)
    expect(combined).toBeCloseTo(.32, 6)
  })

  it('fine lines fade out as they crowd together rather than vanishing at once', () => {
    // the fine lines are the first of two passes; with one pass left only the bold lines remain
    const fine = (z: number): number => { const p = plan('graph', view(z)); return p.length === 2 ? p[0].alpha : 0 }
    expect(fine(.38)).toBe(0)
    expect(fine(1)).toBeCloseTo(.14, 6)
    for (let z = .38; z < .85; z += .01) expect(Math.abs(fine(z + .01) - fine(z))).toBeLessThan(.02)
  })
})

describe('isometric paper and lesson layouts', () => {
  it('isometric dots sit on the ±30° lines of the isometric grid', () => {
    const dots = plan('isodots', view(1))[0].dots!
    const lines = plan('isogrid', view(1))[0].segs!
    const t = Math.tan(Math.PI / 6)
    // every 30° line Y = X·t + c passes through lattice points: some dot lies on the first such line
    const c = lines.find((_, i) => i % 4 === 1 && lines[i + 2] > lines[i])!
    const onLine = (x: number, y: number): boolean => Math.abs(y - (x * t + c)) < 1e-6
    let found = false
    for (let i = 0; i < dots.length; i += 2) if (onLine(dots[i], dots[i + 1])) found = true
    expect(found).toBe(true)
  })

  it('layouts are drawn on each screen of the page, and nowhere without one', () => {
    expect(plan('compare', view(1))).toEqual([])
    const one = plan('compare', view(1), {}, { cells: [[0, 0, PAGE_W, PAGE_H]] })[0].segs!
    const two = plan('compare', view(1), {}, { cells: [[0, 0, PAGE_W, PAGE_H], [0, PAGE_H, PAGE_W, 2 * PAGE_H]] })[0].segs!
    expect(two.length).toBe(one.length * 2)
    for (let i = 0; i < one.length; i += 2) {
      expect(one[i]).toBeGreaterThanOrEqual(0); expect(one[i]).toBeLessThanOrEqual(PAGE_W)
      expect(one[i + 1]).toBeGreaterThanOrEqual(0); expect(one[i + 1]).toBeLessThanOrEqual(PAGE_H)
    }
  })

  it('every paper does a bounded amount of work at any zoom and spacing', () => {
    for (const paper of PAPERS) for (const z of [.05, .2, 1, 4, 16]) for (const spacing of [.5, 1, 3]) for (const adapt of [false, true]) {
      expect(work(plan(paper, view(z, -123.4, 567.8), { spacing }, { cells: [[0, 0, PAGE_W, PAGE_H]], adapt }))).toBeLessThan(60000)
    }
  })
})

describe('background picture', () => {
  const art = { src: 'data:image/png;base64,iVBORw0KGgo=', fit: 'fit' as const, opacity: .6, align: [0, .5] as [number, number], span: 'each' as const }

  it('fit shows the whole picture; fill covers the page without stretching, placed by its position', () => {
    expect(placeArt({ fit: 'fit', align: [.5, .5] }, 800, 800, [0, 0, 1600, 900])).toEqual([350, 0, 1250, 900])
    expect(placeArt({ fit: 'fill', align: [.5, 0] }, 800, 800, [0, 0, 1600, 900])).toEqual([0, 0, 1600, 1600])
    expect(placeArt({ fit: 'fit', align: [0, 0] }, 800, 800, [0, 0, 1600, 900])).toEqual([0, 0, 900, 900])
  })

  it('on a long page: first screen, every screen, or the whole page', () => {
    const sheet: Rect = [0, 0, PAGE_W, 3 * PAGE_H]
    const b = (span: 'first' | 'each' | 'whole') => ({ ...backdropOf({ color: '#fff', paper: 'none' }, { paper: 'none', art: { ...art, span } }, sheet) })
    expect(artTargets(b('first'), sheet)).toEqual([[0, 0, PAGE_W, PAGE_H]])
    expect(artTargets(b('each'), sheet)).toHaveLength(3)
    expect(artTargets(b('whole'), sheet)).toEqual([sheet])
    expect(screensOf({ origin: [0, 0] }, [-10, -10, 10, 10])).toHaveLength(4) // a canvas tiles page-sized screens from its origin
  })

  it('belongs to its own page: frames do not show the canvas picture', () => {
    const frame = backdropOf({ color: '#fff', paper: 'ruled', spacing: 2 }, {}, [0, 0, PAGE_W, PAGE_H])
    expect(frame.art).toBeUndefined()
    expect(frame.style.spacing).toBe(2) // but the canvas paper and its settings carry on
  })

  it('is saved with the lesson like other pictures, and comes back with its settings', () => {
    const pages: PageData[] = [{ items: [ink], view: { x: 0, y: 0, zoom: 1 }, paper: 'ruled', spacing: 1.5, strength: .55, lines: '#16a34a', art }]
    const portable = serializePages(pages, 0, true, { kind: 'notebook', frames: [] }).json
    const file = JSON.parse(portable)
    expect(file.pages[0].art.a).toMatch(/^[0-9a-f]+$/)
    expect(file.assets[file.pages[0].art.a]).toBe(art.src)
    const back = parseBoard(portable)!.pages![0]
    expect(back).toMatchObject({ paper: 'ruled', spacing: 1.5, strength: .55, lines: '#16a34a', art })
    // autosave keeps the picture on disk once, listed under assetKeys
    const stored = serializePages(pages, 0, false, { kind: 'notebook', frames: [] })
    expect(JSON.parse(stored.json).assetKeys).toContain(file.pages[0].art.a)
    expect(Object.values(stored.assets)).toContain(art.src)
  })

  it('a plain canvas with only a picture is saved in the page format, not the old single board', () => {
    const json = serializePages([{ items: [], paper: 'none', art }], 0, true, { kind: 'canvas', frames: [] }).json
    expect(JSON.parse(json).version).toBe(4)
  })

  it('a damaged picture or settings are dropped, the lesson still opens', () => {
    const bad = JSON.stringify({ format: 'floating-whiteboard', version: 4, kind: 'notebook', page: 0, pages: [{ items: [ink], paper: 'ruled', spacing: 99, strength: 'x', lines: 'blue', art: { a: 'zz', fit: 'fill' } }], assets: {} })
    const page = parseBoard(bad)!.pages![0]
    expect(page.paper).toBe('ruled')
    for (const k of ['spacing', 'strength', 'lines', 'art']) expect(page).not.toHaveProperty(k)
  })
})

describe('conversion keeps the paper settings and the picture', () => {
  it('notebook → canvas → notebook', () => {
    const art = { src: 'data:image/png;base64,iVBORw0KGgo=', fit: 'fill' as const, opacity: .8, align: [.5, 0] as [number, number], span: 'first' as const }
    const pages = [
      { items: [ink], frame: { x: 0, y: 0, extent: 1 }, paper: 'fourline' as const, spacing: 1.5, lines: '#6b7280', art },
      { items: [], frame: { x: 0, y: 0, extent: 1 }, paper: 'isogrid' as const, strength: 1.7 }
    ]
    const { items, frames } = notebookToCanvas(pages)
    expect(frames[0]).toMatchObject({ paper: 'fourline', spacing: 1.5, lines: '#6b7280', art })
    expect(frames[1]).toMatchObject({ paper: 'isogrid', strength: 1.7 })
    const back = canvasToNotebook(items, frames, 'none')
    expect(back[0]).toMatchObject({ paper: 'fourline', spacing: 1.5, lines: '#6b7280', art })
    expect(back[1]).toMatchObject({ paper: 'isogrid', strength: 1.7 })
  })

  it('frames that show the canvas paper take its settings when they become pages', () => {
    const back = canvasToNotebook([ink], [{ x: 0, y: 0, extent: 1 }], { paper: 'ruled', spacing: 2 })
    expect(back[0]).toMatchObject({ paper: 'ruled', spacing: 2 })
  })
})

describe('board surfaces', () => {
  it('the texture tiles join up with themselves on every side (no seams on the board)', () => {
    for (const [cx, cy] of [[3, 3], [1, 7], [128, 128]]) for (const p of [0, 17.5, 200]) {
      expect(tileNoise(p, 0, 256, cx, cy, 7)).toBeCloseTo(tileNoise(p + 256, 0, 256, cx, cy, 7), 9)
      expect(tileNoise(0, p, 256, cx, cy, 7)).toBeCloseTo(tileNoise(0, p + 256, 256, cx, cy, 7), 9)
    }
  })

  it('textures are quiet: on average they barely change the board, so ink keeps its contrast', () => {
    const mean = (rgba: Uint8ClampedArray): number => { let s = 0; for (let i = 3; i < rgba.length; i += 4) s += rgba[i]; return s / (rgba.length / 4) / 255 }
    for (const kind of ['chalk', 'slate', 'paper'] as const) {
      expect(mean(textureTile(kind, 128))).toBeLessThan(.06)
      expect(mean(cloudTile(kind, 64))).toBeLessThan(.06)
      expect(mean(textureTile(kind, 128))).toBeGreaterThan(0)
    }
    expect(mean(textureTile('none', 64))).toBe(0)
  })

  it('the same texture every time, on every PC', () => {
    expect(textureTile('chalk', 64)).toEqual(textureTile('chalk', 64))
  })

  it('the lesson keeps its texture, and a page can have its own', () => {
    const json = serializePages([{ items: [ink], paper: 'none' }, { items: [], paper: 'none', texture: 'none' }], 0, true, { kind: 'notebook', frames: [], color: '#22423a', texture: 'chalk' }).json
    const parsed = parseBoard(json)!
    expect(parsed.texture).toBe('chalk')
    expect(parsed.pages!.map(p => p.texture)).toEqual([undefined, 'none'])
    expect(parseBoard(JSON.stringify({ format: 'floating-whiteboard', version: 4, kind: 'notebook', page: 0, pages: [{ items: [ink] }], assets: {} }))!.texture).toBe('none')
    expect(JSON.parse(serializePages([{ items: [ink], paper: 'none' }], 0, true, { kind: 'canvas', frames: [], texture: 'paper' }).json).version).toBe(4)
  })

  it('a frame shows the lesson texture unless it sets its own', () => {
    expect(backdropOf({ color: '#22423a', paper: 'none', texture: 'chalk' }, {}).texture).toBe('chalk')
    expect(backdropOf({ color: '#22423a', paper: 'none', texture: 'chalk' }, { texture: 'none' }).texture).toBeUndefined()
  })
})

describe('new lessons remember how the paper was drawn', () => {
  it('keeps the spacing, strength and line colour within range', () => {
    const original = snapshotSettings()
    applySettings({ defaultSpacing: 9, defaultStrength: .1, defaultLines: 'green' })
    expect(S.defaultSpacing.value).toBe(3)
    expect(S.defaultStrength.value).toBe(.25)
    expect(S.defaultLines.value).toBe(original.defaultLines)
    applySettings({ defaultSpacing: 1.25, defaultLines: '#16a34a' })
    expect(S.defaultSpacing.value).toBe(1.25)
    expect(S.defaultLines.value).toBe('#16a34a')
    applySettings(original)
  })
})
