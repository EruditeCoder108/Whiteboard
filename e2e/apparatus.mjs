// Working apparatus: take parts out, wire a circuit by hand, run experiments. Run: npm run e2e:apparatus
import { launch, check, summary, fw, gesture, shotDir } from './lib.mjs'
import { join } from 'node:path'

const { app, page, logs } = await launch({ layout: 'board' })
const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: join(shotDir, `apparatus-${name}.png`) }) }
const more = async (label) => { await page.getByRole('button', { name: 'More', exact: true }).click(); await page.getByRole('button', { name: label, exact: true }).click() }
const newPage = () => fw(page, w => { w.board.addPage(); w.board.setTool('select'); w.board.setSelection([]) })
const parts = (kind) => fw(page, (w, k) => w.board.doc.items.filter(i => i.t === 'a' && (!k || i.kind === k)).map(i => ({ id: i.id, kind: i.kind, p: i.p, params: i.params })), kind)
const reading = (kind) => fw(page, (w, k) => { const it = w.board.doc.items.find(i => i.t === 'a' && i.kind === k); return it ? w.apparatus.world.readingOf(it) : null }, kind)
/** A spot on a part (its own units) as a point on the stage. */
const at = (kind, x, y, n = 0) => fw(page, (w, a) => {
  const it = w.board.doc.items.filter(i => i.t === 'a' && i.kind === a.kind)[a.n], part = w.apparatus.partOf(a.kind), v = w.board.view
  const wx = it.p[0] + a.x / part.w * (it.p[2] - it.p[0]), wy = it.p[1] + a.y / part.h * (it.p[3] - it.p[1])
  return [(wx - v.x) * v.zoom, (wy - v.y) * v.zoom]
}, { kind, x, y, n })
const terminal = (kind, t, n = 0) => fw(page, (w, a) => {
  const it = w.board.doc.items.filter(i => i.t === 'a' && i.kind === a.kind)[a.n], part = w.apparatus.partOf(a.kind), v = w.board.view, [x, y] = part.terminals[a.t]
  const wx = it.p[0] + x / part.w * (it.p[2] - it.p[0]), wy = it.p[1] + y / part.h * (it.p[3] - it.p[1])
  return [(wx - v.x) * v.zoom, (wy - v.y) * v.zoom]
}, { kind, t, n })
const wire = async (a, b) => { await gesture(page, [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 20], b], { type: 'mouse', gap: 10 }); await page.waitForTimeout(60) }
const tap = async (p) => { await gesture(page, [p], { type: 'mouse' }); await page.waitForTimeout(60) }
const settle = () => page.waitForTimeout(160)
const place = (kind, x, y, params = {}) => fw(page, (w, a) => { const it = w.apparatus.newPart(w.apparatus.partOf(a.kind), a.x, a.y, a.scale ?? 1, a.params); w.board.insertSaved([it]); w.board.setSelection([]) }, { kind, x, y, params })

try {
  await fw(page, w => w.board.convertTo('notebook'))

  // ── the cupboard ───────────────────────────────────────────────────────────
  await more('Apparatus')
  await page.waitForSelector('.apparatus-tray')
  await shot('tray-physics')
  const count = async () => page.locator('.part-tile').count()
  const physics = await count()
  await page.locator('.tray-tabs').getByRole('tab', { name: 'Chemistry' }).click()
  await page.waitForTimeout(150)
  await shot('tray-chemistry')
  const chemistry = await count()
  await page.locator('.tray-tabs').getByRole('tab', { name: 'Biology' }).click()
  await page.waitForTimeout(150)
  const biology = await count()
  check('more than Note 3 for every subject', physics >= 25 && chemistry >= 13 && biology >= 13, `${physics} ${chemistry} ${biology}`)
  const drawn = await page.locator('.part-picture').first().evaluate(cv => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n })
  check('each tile shows the real part', drawn > 200, String(drawn))
  await page.locator('.tray-tabs').getByRole('tab', { name: 'Physics' }).click()

  // ── wire a circuit by hand ─────────────────────────────────────────────────
  await fw(page, w => { w.board.addPage(); w.board.setTool('pen'); window.__tray = true })
  for (const name of ['Battery', 'Switch', 'Bulb', 'Ammeter']) await page.getByRole('button', { name: `Take out ${name}`, exact: true }).click()
  check('the cupboard stays open while parts come out', await page.locator('.apparatus-tray').isVisible())
  check('four parts are on the page', (await parts()).length === 4)
  await fw(page, w => {
    const put = (kind, x, y) => { const it = w.board.doc.items.find(i => i.kind === kind), dx = x - it.p[0], dy = y - it.p[1]; const moved = { ...it, p: [it.p[0] + dx, it.p[1] + dy, it.p[2] + dx, it.p[3] + dy] }; w.board.doc.replaceAll(w.board.doc.items.map(i => i === it ? moved : i)) }
    put('battery', 120, 60); put('switch', 500, 60); put('ammeter', 760, 60); put('bulb', 430, 400); w.board.setSelection([]); w.board.refresh(null)
  })
  await fw(page, w => { w.board.setTool('pen') })
  const inkBefore = (await fw(page, w => w.board.doc.items.filter(i => i.t === 's').length))
  await wire(await terminal('battery', 0), await terminal('switch', 0))
  await wire(await terminal('switch', 1), await terminal('ammeter', 0))
  await wire(await terminal('ammeter', 1), await terminal('bulb', 1))
  await wire(await terminal('bulb', 0), await terminal('battery', 1))
  const wires = await fw(page, w => w.board.doc.items.filter(i => i.wire).length)
  check('dragging between terminals makes wires, with the pen in hand', wires === 4, String(wires))
  check('the new wires lie over the parts', await fw(page, w => w.board.doc.items.slice(-4).every(i => i.wire)))
  check('and draws no ink', (await fw(page, w => w.board.doc.items.filter(i => i.t === 's').length)) === inkBefore)
  await page.waitForTimeout(100)
  const preview = await page.evaluate(() => { const cv = document.querySelectorAll('.stage canvas')[2], d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let blue = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i] < 90 && d[i + 2] > 220) blue++; return blue })
  check('the dashed wire preview is gone once the wire is made', preview === 0, String(preview))
  await settle()
  check('with the switch open, nothing flows', Math.abs((await reading('bulb')).amps) < 1e-5)
  await shot('circuit-off')
  await tap(await at('switch', 118, 48))
  await settle()
  const lit = await reading('bulb'), meter = await reading('ammeter')
  check('tap the switch: the bulb lights', Math.abs(lit.amps) > .4, JSON.stringify(lit))
  check('the ammeter reads the same current', Math.abs(meter.amps - .49) < .02, JSON.stringify(meter))
  await shot('circuit-on')
  await fw(page, w => w.board.undo())
  await settle()
  check('undo opens the switch again', Math.abs((await reading('bulb')).amps) < 1e-5)
  await fw(page, w => w.board.redo())
  await settle()
  const moved = await fw(page, w => { const it = w.board.doc.items.find(i => i.kind === 'bulb'), wire = w.board.doc.items.find(i => i.wire && (i.to?.id === it.id || i.from?.id === it.id)), was = wire.p.join(); w.board.setSelection([it]); w.board.nudgeSelection(40, 10); w.board.setSelection([]); return was !== w.board.doc.items.find(i => i.id === wire.id).p.join() })
  check('wires follow when a part moves', moved)
  await settle()
  check('and the circuit still works', Math.abs((await reading('bulb')).amps) > .4)

  // Settings from the bar: more volts, more current.
  await fw(page, w => { w.board.setTool('select'); w.board.setSelection(w.board.doc.items.filter(i => i.kind === 'battery')) })
  await page.getByRole('button', { name: 'Change its settings' }).click()
  await page.waitForSelector('.part-options')
  await shot('settings')
  await fw(page, w => { const it = w.board.doc.items.find(i => i.kind === 'battery'); w.board.setPartValue(it, w.apparatus.partOf('battery').settings[0], 12) })
  await settle()
  check('twelve volts doubles the current', Math.abs((await reading('ammeter')).amps - .98) < .03, JSON.stringify(await reading('ammeter')))
  await fw(page, w => { const it = w.board.doc.items.find(i => i.kind === 'battery'); w.board.setPartValue(it, w.apparatus.partOf('battery').settings[0], 24); w.board.setSelection([]) })
  await page.waitForTimeout(300)
  check('far too many volts burn the bulb out', (await parts('bulb'))[0].params.burnt === 1)
  await settle()
  check('and the current stops', Math.abs((await reading('ammeter')).amps) < 1e-4)
  await shot('burnt')
  const kept = await fw(page, w => { const json = w.board.serialize(); w.board.load(json, { undoable: false }); return { wires: w.board.doc.items.filter(i => i.wire).length, parts: w.board.doc.items.filter(i => i.t === 'a').length } })
  check('the whole circuit survives saving and opening', kept.wires === 4 && kept.parts === 4, JSON.stringify(kept))

  // ── a short circuit says so ────────────────────────────────────────────────
  await fw(page, w => { w.board.addPage(); w.board.setTool('pen') })
  await place('battery', 500, 300)
  await wire(await terminal('battery', 0), await terminal('battery', 1))
  await settle()
  check('a short circuit warns', (await reading('battery')).warn === 'Short circuit!', JSON.stringify(await reading('battery')))
  await shot('short')

  // ── ready-made examples ────────────────────────────────────────────────────
  for (const id of ['ohm', 'capacitor', 'lens', 'prism', 'compass', 'titration', 'heating']) {
    await newPage()
    await fw(page, (w, e) => { const it = w.apparatus.EXAMPLES.find(x => x.id === e); w.board.insertSaved(it.build()); w.board.setSelection([]) }, id)
    await settle()
    await shot(`example-${id}`)
  }

  // Lens: rays cross near the focus.
  await newPage()
  await fw(page, w => { const ex = w.apparatus.EXAMPLES.find(x => x.id === 'lens'); w.board.insertSaved(ex.build()); w.board.setSelection([]) })
  await settle()
  check('a ray box shines through a lens', await fw(page, w => w.apparatus.world.hasBeams))
  await fw(page, w => { w.board.setSurface({ color: '#22423a', texture: 'chalk' }, true) })
  await settle()
  await shot('lens-chalkboard')
  await fw(page, w => { w.board.setSurface({ color: '#ffffff', texture: 'none' }, true) })
  await settle()
  check('an idle page stops redrawing', !(await fw(page, w => w.apparatus.world.moving)))

  // Compass turns when a magnet comes close.
  await newPage()
  await place('compass', 800, 450)
  await settle()
  const alone = (await reading('compass')).value
  check('alone, a compass points north', Math.abs(alone) < .01, String(alone))
  await place('bar-magnet', 980, 450)
  await settle()
  const near = (await reading('compass')).value
  check('with a magnet close it turns', Math.abs(near) > .3, String(near))

  // ── a real titration ───────────────────────────────────────────────────────
  await newPage()
  await fw(page, w => { const ex = w.apparatus.EXAMPLES.find(x => x.id === 'titration'); w.board.insertSaved(ex.build()); w.board.setSelection([]) })
  await settle()
  const flask = () => fw(page, w => { const q = w.board.doc.items.find(i => i.kind === 'conical-flask').params; return { ml: q.ml, acid: q.acid, base: q.base } })
  const start = await flask()
  check('the flask holds acid', start.ml === 25 && start.acid === 2.5, JSON.stringify(start))
  await tap(await at('burette', 60, 412))
  await page.waitForTimeout(1500)
  const during = await flask()
  check('open the tap: liquid runs into the flask', during.ml > start.ml, JSON.stringify(during))
  check('and neutralises the acid', during.acid < start.acid - .01, JSON.stringify(during))
  await shot('titration-running')
  // Skip ahead to just past the end point, as real pouring would.
  await fw(page, w => { const b = w.board.doc.items.find(i => i.kind === 'burette').params, f = w.board.doc.items.find(i => i.kind === 'conical-flask').params; b.open = 0; b.ml = 24; b.base = 2.4; f.ml = 50.2; f.acid = 0; f.base = .02; w.board.refresh(null) })
  await settle()
  await shot('titration-end')
  const colour = await page.evaluate(() => { const w = window.__fw, it = w.board.doc.items.find(i => i.kind === 'conical-flask'), part = w.apparatus.partOf(it.kind); const cv = document.createElement('canvas'); cv.width = 400; cv.height = 400; const g = cv.getContext('2d'); g.setTransform(400 / (it.p[2] - it.p[0]), 0, 0, 400 / (it.p[3] - it.p[1]), -it.p[0] * 400 / (it.p[2] - it.p[0]), -it.p[1] * 400 / (it.p[3] - it.p[1])); w.paintItem(g, it); const d = g.getImageData(200, 340, 1, 1).data; return [d[0], d[1], d[2]] })
  check('past the end point phenolphthalein turns pink', colour[0] > 180 && colour[1] < 150, colour.join())

  // ── heat and thermometer ───────────────────────────────────────────────────
  await newPage()
  await fw(page, w => { const ex = w.apparatus.EXAMPLES.find(x => x.id === 'heating'); w.board.insertSaved(ex.build()); w.board.setSelection([]) })
  await settle()
  const temp0 = await fw(page, w => w.board.doc.items.find(i => i.kind === 'beaker').params.temp)
  const burner = await at('bunsen', 40, 200)
  await tap(burner)
  await page.waitForTimeout(1600)
  const temp1 = await fw(page, w => w.board.doc.items.find(i => i.kind === 'beaker').params.temp)
  check('the burner heats the beaker above it', temp1 > temp0 + 3, `${temp0} → ${temp1}`)
  const read = await reading('thermometer')
  check('the thermometer standing in it reads its temperature', Math.abs(read.value - temp1) < 3, JSON.stringify(read))
  await tap(burner)
  await shot('heating')
  const drip = await fw(page, w => w.apparatus.world.moving)
  void drip

  // ── biology ────────────────────────────────────────────────────────────────
  await newPage()
  await place('microscope', 800, 420)
  await shot('microscope-blurred')
  const knob = await at('microscope', 200, 150 + .35 * 120)
  const sharp = await at('microscope', 200, 150 + .62 * 120)
  await gesture(page, [knob, sharp], { type: 'mouse', gap: 20 })
  await settle()
  check('the focus knob moves', Math.abs((await parts('microscope'))[0].params.focus - .62) < .02, JSON.stringify((await parts('microscope'))[0].params))
  await shot('microscope-sharp')
  for (const kind of ['bacterium', 'leaf-section', 'stoma', 'slide', 'plant-cell', 'animal-cell', 'neuron', 'dna', 'flower', 'lungs-model', 'osmosis', 'atom', 'pendulum', 'spring-balance', 'vernier']) {
    await newPage()
    await place(kind, 800, 450)
    await shot(`part-${kind}`)
  }

  // In a window: the same cupboard, clear of the window's own strip.
  const laptop = await launch({ layout: 'laptop' })
  try {
    await laptop.page.getByRole('button', { name: 'More', exact: true }).click()
    await laptop.page.getByRole('button', { name: /^Apparatus/ }).click()
    await laptop.page.waitForSelector('.apparatus-tray')
    const box = await laptop.page.locator('.apparatus-tray').boundingBox()
    check('on a laptop the cupboard opens inside the window', box.y >= 28 && box.y + box.height <= 1080, JSON.stringify(box))
  } finally { await laptop.app.close().catch(() => {}) }

  check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.filter(l => /pageerror|\[error\]/.test(l)).slice(0, 3).join(' | '))
} catch (error) {
  check('the suite ran to the end', false, String(error).slice(0, 700))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
