import { describe, expect, it } from 'vitest'
import { FIELDS, fieldMarks, logTicks } from '@/engine/fields'
import { PAPERS, isLayout, isPaper, planPaper } from '@/engine/grid'
import { FULL_CROP, cropInSource, croppedBox, dragCrop, isWholeCrop } from '@/engine/objects'
import { TEMPLATES, templateItems } from '@/engine/templates'
import { itemFromJson, itemToJson } from '@/engine/serialize'
import type { Item, Rect, ShapeItem, TableItem } from '@/engine/types'

const cell: Rect = [0, 0, 1600, 900]

describe('measured papers and fields', () => {
  it('are real papers that follow the page', () => {
    for (const f of FIELDS) {
      expect(PAPERS).toContain(f)
      expect(isPaper(f)).toBe(true)
      expect(isLayout(f)).toBe(true)
    }
  })

  it('stay inside the screen they are fitted to', () => {
    for (const f of FIELDS) {
      const { major, minor } = fieldMarks(f, cell)
      expect(major.length).toBeGreaterThan(8)
      for (const list of [major, minor]) for (let i = 0; i < list.length; i += 2) {
        expect(list[i]).toBeGreaterThanOrEqual(0)
        expect(list[i]).toBeLessThanOrEqual(1600)
        expect(list[i + 1]).toBeGreaterThanOrEqual(0)
        expect(list[i + 1]).toBeLessThanOrEqual(900)
      }
    }
  })

  it('log lines fall where logarithms say', () => {
    const t = logTicks()
    expect(t[0]).toBeCloseTo(Math.log10(2))
    expect(t.at(-1)).toBeCloseTo(Math.log10(9))
    // On semi-log, the line for 2 sits log10(2) of a decade above each decade line.
    const { minor } = fieldMarks('semilog', cell)
    const H = 900 - 144, y = 804 - H / 3 * Math.log10(2)
    let found = false
    for (let i = 0; i < minor.length; i += 4) if (Math.abs(minor[i + 1] - y) < 1e-6 && minor[i + 1] === minor[i + 3]) found = true
    expect(found).toBe(true)
  })

  it('a football pitch keeps its true shape', () => {
    const { major } = fieldMarks('football', cell)
    const xs = major.filter((_, i) => i % 2 === 0), ys = major.filter((_, i) => i % 2 === 1)
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys)
    expect(w / h).toBeCloseTo(105 / 68, 1)
  })

  it('paint through the normal paper path on a page, and nothing on an open canvas', () => {
    expect(planPaper({ x: 0, y: 0, zoom: 1 }, 1600, 900, 'polar', false, undefined, [cell]).length).toBe(2)
    expect(planPaper({ x: 0, y: 0, zoom: 1 }, 1600, 900, 'polar', false)).toEqual([])
  })
})

describe('templates', () => {
  for (const { id } of TEMPLATES) {
    it(`${id} is made of ordinary objects that save and load`, () => {
      for (const dark of [false, true]) {
        const items = templateItems(id, dark)
        expect(items.length).toBeGreaterThan(0)
        for (const it of items) expect(itemFromJson(itemToJson(it)), JSON.stringify(it).slice(0, 120)).not.toBeNull()
        expect(new Set(items.map(i => i.id)).size).toBe(items.length)
      }
    })
  }

  it('every attached line holds on to something in the template', () => {
    for (const { id } of TEMPLATES) {
      const items = templateItems(id, false), ids = new Set(items.map((i: Item) => i.id))
      for (const it of items) if (it.t === 'h') {
        const s = it as ShapeItem
        if (s.from) expect(ids.has(s.from.id)).toBe(true)
        if (s.to) expect(ids.has(s.to.id)).toBe(true)
      }
    }
  })

  it('a KWL chart has its three headings, and ink matches the board', () => {
    const [t] = templateItems('kwl', true) as TableItem[]
    expect(t.cells[0]).toEqual(['What I know', 'What I want to know', 'What I learned'])
    expect(t.head).toBe(true)
    expect(t.c).toBe('#ffffff')
    expect((templateItems('kwl', false)[0] as TableItem).c).toBe('#111827')
  })
})

describe('crop', () => {
  it('a corner moves its two sides, and the frame cannot close or leave the picture', () => {
    expect(dragCrop(FULL_CROP, 'nw', [.2, .3], [0, 0])).toEqual([.2, .3, 1, 1])
    expect(dragCrop(FULL_CROP, 'se', [.5, .5], [1, 1])).toEqual([0, 0, .5, .5])
    const closed = dragCrop([.4, .4, .6, .6], 'nw', [.9, .9], [.4, .4])
    expect(closed[0]).toBeLessThan(closed[2])
    expect(closed[1]).toBeLessThan(closed[3])
  })

  it('moving keeps the size and stays on the picture', () => {
    const moved = dragCrop([.2, .2, .6, .6], 'move', [2, 2], [0, 0])
    expect(moved[2]).toBe(1)
    expect(moved[3]).toBe(1)
    expect(moved[2] - moved[0]).toBeCloseTo(.4)
  })

  it('a mirrored picture is cut on the side the teacher saw', () => {
    expect(cropInSource([.1, 0, .4, 1], true, false)).toEqual([.6, 0, .9, 1])
    expect(cropInSource([0, .1, 1, .4], false, true)[1]).toBeCloseTo(.6)
    expect(cropInSource([.1, .1, .4, .4], false, false)).toEqual([.1, .1, .4, .4])
  })

  it('the cropped part stays where it was on the board', () => {
    expect(croppedBox({ p: [100, 100, 300, 200] }, [0, 0, .5, 1])).toEqual([100, 100, 200, 200])
    expect(croppedBox({ p: [100, 100, 300, 200] }, [.5, .5, 1, 1])).toEqual([200, 150, 300, 200])
    expect(isWholeCrop(FULL_CROP)).toBe(true)
    expect(isWholeCrop([.1, 0, 1, 1])).toBe(false)
  })
})
