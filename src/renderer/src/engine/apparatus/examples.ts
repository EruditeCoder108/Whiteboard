import { routeConnector } from '../connectors'
import type { ApparatusItem, Item, ShapeItem } from '../types'
import { newId } from '../types'
import type { Subject } from './parts'
import { partOf } from './parts'
import { newPart } from './world'

/** Ready-made set-ups, so a lesson starts from a working circuit or titration. Each is made of the same parts a teacher can take out. */
export const EXAMPLES: { id: string; name: string; subject: Subject; build: () => Item[] }[] = [
  { id: 'bulb', name: 'Bulb and switch', subject: 'physics', build: () => circuit([['battery', 300, 120], ['switch', 780, 120], ['bulb', 560, 480]], [[0, 0, 1, 0], [1, 1, 2, 1], [2, 0, 0, 1]]) },
  { id: 'series', name: 'Bulbs in series', subject: 'physics', build: () => circuit([['battery', 240, 130, { v: 12 }], ['switch', 640, 130, { on: 1 }], ['bulb', 280, 520], ['bulb', 720, 520]], [[0, 0, 1, 0], [1, 1, 3, 1], [3, 0, 2, 1], [2, 0, 0, 1]]) },
  { id: 'parallel', name: 'Bulbs in parallel', subject: 'physics', build: () => circuit([['battery', 200, 130], ['switch', 600, 130, { on: 1 }], ['bulb', 330, 520], ['bulb', 800, 520]], [[0, 0, 1, 0], [1, 1, 2, 1], [1, 1, 3, 1], [2, 0, 0, 1], [3, 0, 0, 1]]) },
  { id: 'ohm', name: "Ohm's law", subject: 'physics', build: () => circuit([['battery', 180, 110], ['rheostat', 560, 110, { max: 50, pos: .3 }], ['ammeter', 960, 160], ['resistor', 560, 520, { r: 10 }], ['voltmeter', 180, 480]], [[0, 0, 1, 0], [1, 1, 2, 0], [2, 1, 3, 1], [3, 0, 0, 1], [4, 0, 3, 1], [4, 1, 3, 0]]) },
  { id: 'galvanometer', name: 'Galvanometer', subject: 'physics', build: () => circuit([['cell', 200, 140], ['switch', 600, 140], ['resistor', 600, 460, { r: 330 }], ['galvanometer', 200, 440]], [[0, 0, 1, 0], [1, 1, 2, 1], [2, 0, 3, 1], [3, 0, 0, 1]]) },
  { id: 'capacitor', name: 'Charging a capacitor', subject: 'physics', build: () => circuit([['battery', 200, 120], ['switch', 600, 120], ['resistor', 960, 120, { r: 300 }], ['capacitor', 600, 500, { uf: 10000 }], ['voltmeter', 220, 470]], [[0, 0, 1, 0], [1, 1, 2, 0], [2, 1, 3, 0], [3, 1, 0, 1], [4, 0, 3, 0], [4, 1, 3, 1]]) },
  { id: 'lens', name: 'Rays through a lens', subject: 'physics', build: () => [part('ray-box', 240, 400), part('convex-lens', 720, 400)] },
  { id: 'prism', name: 'White light and a prism', subject: 'physics', build: () => [{ ...part('ray-box', 130, 565, { beams: 1 }), angle: -.31 }, part('prism', 640, 420)] },
  { id: 'compass', name: 'Compass and magnet', subject: 'physics', build: () => [part('bar-magnet', 640, 300, { field: 1 }), part('compass', 300, 520), part('compass', 980, 520), part('compass', 640, 620)] },
  { id: 'titration', name: 'Titration', subject: 'chemistry', build: () => {
    const q = { ...partOf('conical-flask')!.params, ml: 25, acid: 2.5, indicator: 2, content: 1, showPh: 1 }
    return [part('retort-stand', 560, 300, { y: 130 }, .85), part('burette', 680, 270, {}, .9), part('conical-flask', 680, 680, q, .8)]
  } },
  { id: 'heating', name: 'Heating water', subject: 'chemistry', build: () => [part('bunsen', 680, 660, {}, .85), part('tripod', 680, 500, {}, .9), part('beaker', 680, 340, { ml: 100 }, .9), part('thermometer', 690, 240, {}, .75)] }
]

function part(kind: string, x: number, y: number, params: Record<string, number> = {}, scale = 1): ApparatusItem {
  return newPart(partOf(kind)!, x, y, scale, params)
}

type Spec = [string, number, number, Record<string, number>?]

/** Parts placed by their top left, joined by wires listed as [part, terminal, part, terminal]. */
function circuit(specs: Spec[], wires: [number, number, number, number][]): Item[] {
  const parts = specs.map(([kind, x, y, params]) => {
    const def = partOf(kind)!
    return newPart(def, x + def.w / 2, y + def.h / 2, 1, params ?? {})
  })
  const find = (id: string): Item | undefined => parts.find(p => p.id === id)
  const lines = wires.map(([a, ta, b, tb]): ShapeItem => {
    const from = parts[a], to = parts[b], fp = partOf(from.kind)!, tp = partOf(to.kind)!
    const f = fp.terminals![ta], g = tp.terminals![tb]
    return routeConnector({
      t: 'h', id: newId(), c: fp.polar && ta === 0 ? '#d43b33' : '#3a4656', w: 5, k: 'line', wire: true, p: [0, 0, 1, 1],
      from: { id: from.id, at: [f[0] / fp.w, f[1] / fp.h] }, to: { id: to.id, at: [g[0] / tp.w, g[1] / tp.h] }
    }, find)
  })
  return [...lines, ...parts]
}
