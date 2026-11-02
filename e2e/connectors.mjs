// Attached arrows (Note 3 deep dive §8.3): arrows hold on to objects when they move, and frames no longer stack.
// Run: npm run e2e:connectors
import { launch, check, summary, fw, shotDir, gesture } from './lib.mjs'
import { join } from 'node:path'

let { app, page, logs } = await launch({ layout: 'board' })
const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: join(shotDir, `connectors-${name}.png`) }) }
/** Stage px of a world point. */
const screen = ([x, y]) => fw(page, (w, [x, y]) => { const v = w.board.view; return [(x - v.x) * v.zoom, (y - v.y) * v.zoom] }, [x, y])
const drag = async (a, b, opts = {}) => {
  const [p, q] = [await screen(a), await screen(b)]
  const pts = Array.from({ length: 13 }, (_, i) => [p[0] + (q[0] - p[0]) * i / 12, p[1] + (q[1] - p[1]) * i / 12])
  await gesture(page, pts, { type: 'mouse', ...opts })
}
const tool = (name) => fw(page, (w, name) => w.board.setTool(name), name)
const item = (id) => fw(page, (w, id) => w.board.doc.items.find(it => it.id === id), id)
const arrowOf = () => fw(page, w => w.board.doc.items.find(it => it.t === 'h' && it.k === 'arrow'))
const addBox = (x, y, over = {}) => fw(page, (w, { x, y, over }) => {
  const before = w.board.doc.snapshot()
  const it = { t: 'h', id: `box${x}_${y}`, c: '#111827', w: 3, k: 'rect', p: [x, y, x + 240, y + 130], ...over }
  w.board.doc.replaceAll([...w.board.doc.items, it])
  w.board.commit(w.board.doc.diff(before))
  w.board.refresh(null)
  return it.id
}, { x, y, over })

try {
  // ── drawing an arrow from box to box ───────────────────────────────────────
  const A = await addBox(200, 200), B = await addBox(900, 500)
  await tool('arrow')
  await drag([320, 265], [1020, 565], { up: false })
  await shot('drawing')
  await gesture(page, [await screen([1020, 565])], { down: false })
  let c = await arrowOf()
  check('an arrow drawn from box to box attaches to both', c?.from?.id === A && c?.to?.id === B, JSON.stringify(c))
  check('its ends stop at the edges of the boxes', c.p[0] > 200 && c.p[0] < 460 && c.p[1] >= 200 && c.p[2] < 1020 && c.p[2] > 880)

  // ── it follows ─────────────────────────────────────────────────────────────
  await tool('select')
  await drag([1020, 565], [1200, 250], { up: false })
  const live = await fw(page, w => w.board.currentTool().following.map(x => x.p))
  check('while a box is dragged the arrow follows on screen', live.length === 1 && Math.abs(live[0][3] - c.p[3]) > 40, JSON.stringify(live))
  await shot('following')
  await gesture(page, [await screen([1200, 250])], { down: false })
  let next = await arrowOf()
  check('after the drag the arrow is attached at the new place', next.to?.id === B && next.p[3] < c.p[3] - 100, JSON.stringify(next))
  const undoSteps = await fw(page, w => { w.board.undo(); return w.board.doc.items.find(it => it.k === 'arrow').p })
  check('one Undo puts the box and the arrow back', undoSteps.every((v, i) => Math.abs(v - c.p[i]) < .01), JSON.stringify(undoSteps))
  await fw(page, w => w.board.redo())
  check('Redo moves them again', (await arrowOf()).p[3] < c.p[3] - 100)
  check('the box itself is what moved', (await item(B)).p[0] > 900)

  // ── other ways of changing a box ───────────────────────────────────────────
  c = await arrowOf()
  await fw(page, (w, A) => { w.board.setSelection([w.board.doc.items.find(it => it.id === A)]); w.board.nudgeSelection(0, 100) }, A)
  check('nudging with the keyboard moves it too', (await arrowOf()).p[1] > c.p[1] + 50)
  c = await arrowOf()
  await fw(page, w => w.board.rotateSelection(Math.PI / 4))
  check('so does rotating', (await arrowOf()).p.some((v, i) => Math.abs(v - c.p[i]) > .5))
  await fw(page, w => w.board.undo())

  // ── deleting what it holds ─────────────────────────────────────────────────
  c = await arrowOf()
  await fw(page, w => w.board.deleteSelection())
  next = await arrowOf()
  check('deleting a box leaves the arrow, free at that end', !next.from && next.to?.id === B && next.p[0] === c.p[0], JSON.stringify(next))
  await fw(page, w => w.board.undo())
  check('Undo brings the box and the attachment back', (await arrowOf()).from?.id === A && !!(await item(A)))

  // ── dragging an end ────────────────────────────────────────────────────────
  await fw(page, w => { w.board.setTool('select'); w.board.setSelection([w.board.doc.items.find(it => it.k === 'arrow')]) })
  await shot('selected')
  c = await arrowOf()
  await drag([c.p[2], c.p[3]], [1400, 800])
  next = await arrowOf()
  check('dragging an end off lets go, and the end stays where it is dropped', !next.to && Math.abs(next.p[2] - 1400) < 2 && next.from?.id === A, JSON.stringify(next))
  const C = await addBox(1250, 620)
  await fw(page, w => { w.board.setTool('select'); w.board.setSelection([w.board.doc.items.find(it => it.k === 'arrow')]) })
  c = await arrowOf()
  await drag([c.p[2], c.p[3]], [1370, 685])
  check('dragging it onto another box attaches there', (await arrowOf()).to?.id === C, JSON.stringify(await arrowOf()))
  c = await arrowOf()
  const mid = [(c.p[0] + c.p[2]) / 2, (c.p[1] + c.p[3]) / 2]
  await drag(mid, [mid[0] + 40, mid[1] - 60])
  next = await arrowOf()
  check('dragging the arrow itself lets go of both', !next.from && !next.to, JSON.stringify(next))
  check('... and it moved', Math.abs(next.p[1] - c.p[1] + 60) < 2)
  await fw(page, w => w.board.undo())

  // ── elbow ──────────────────────────────────────────────────────────────────
  await fw(page, w => { w.board.setSelection([w.board.doc.items.find(it => it.k === 'arrow')]) })
  await page.getByRole('button', { name: 'Object style' }).click()
  await page.getByRole('button', { name: 'Elbow path' }).click()
  check('an arrow can turn square corners', !!(await arrowOf()).elbow)
  await fw(page, w => w.board.setSelection([]))
  await shot('elbow')

  // ── copies ─────────────────────────────────────────────────────────────────
  await fw(page, w => { w.board.selectAll(); w.board.duplicateSelection() })
  const dup = await fw(page, w => { const sel = w.board.selection, c = sel.find(it => it.k === 'arrow'); return { from: c.from?.id, to: c.to?.id, ids: sel.map(it => it.id) } })
  check('copying boxes and arrow together attaches the copy to the copied boxes', dup.ids.includes(dup.from) && dup.ids.includes(dup.to), JSON.stringify(dup))
  await fw(page, w => w.board.undo())
  await fw(page, w => { w.board.setSelection([w.board.doc.items.find(it => it.k === 'arrow')]); w.board.duplicateSelection() })
  const loose = await fw(page, w => w.board.selection[0])
  check('copying the arrow alone gives a free arrow', !loose.from && !loose.to, JSON.stringify(loose))
  await fw(page, w => w.board.undo())
  await fw(page, w => w.board.duplicatePage())
  const onCopy = await fw(page, w => { const items = w.board.doc.items, c = items.find(it => it.k === 'arrow'); return { attached: items.some(it => it.id === c.from?.id) && items.some(it => it.id === c.to?.id) } })
  check('a copied page keeps its arrows attached', onCopy.attached)
  const box = await fw(page, w => { const items = w.board.doc.items, c = items.find(it => it.k === 'arrow'), b = items.find(it => it.id === c.to.id); w.board.setSelection([b]); w.board.nudgeSelection(0, 50); return c.p[3] })
  check('and they follow on that page', (await arrowOf()).p[3] > box)

  // ── saved and reopened, converted ──────────────────────────────────────────
  const reopened = await fw(page, w => {
    const json = w.board.serialize()
    w.board.load(json, { undoable: false })
    const items = w.board.doc.items, c = items.find(it => it.k === 'arrow')
    w.board.setSelection([items.find(it => it.id === c.to.id)])
    w.board.nudgeSelection(0, 60)
    return { before: c.p[3], after: w.board.doc.items.find(it => it.k === 'arrow').p[3], elbow: c.elbow }
  })
  check('after saving and reopening they are still attached', reopened.after > reopened.before && !!reopened.elbow, JSON.stringify(reopened))
  const converted = await fw(page, w => {
    w.board.convertTo('canvas')
    const items = w.board.doc.items, arrows = items.filter(it => it.k === 'arrow')
    const c = arrows[1], before = c.p[3]
    w.board.setSelection([items.find(it => it.id === c.to.id)])
    w.board.nudgeSelection(0, 70)
    const after = w.board.doc.items.find(it => it.id === c.id).p[3]
    const other = w.board.doc.items.find(it => it.id === arrows[0].id).p[3]
    return { before, after, other, first: arrows[0].p[3], n: arrows.length }
  })
  check('on a canvas only that frame’s arrow follows', converted.n === 2 && converted.after > converted.before && converted.other === converted.first, JSON.stringify(converted))

  // ── a label pointing at part of a picture ──────────────────────────────────
  await fw(page, w => w.lessonState.lesson.newLesson({ name: 'Labels', subject: '', kind: 'notebook' }))
  await page.waitForFunction(() => window.__fw.board.doc.items.length === 0)
  const picture = await fw(page, w => {
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 200
    const it = w.board.insertImage(cv.toDataURL('image/png'), 400, 200, { at: [800, 450] })
    w.board.setSelection([])
    return it.p
  })
  const label = await addBox(120, 120)
  await tool('arrow')
  const spot = [picture[0] + (picture[2] - picture[0]) * .25, picture[1] + (picture[3] - picture[1]) * .5]
  await drag([240, 185], spot)
  c = await arrowOf()
  check('an arrow onto a picture holds that spot of it', c.from?.id === label && Math.abs(c.to?.at?.[0] - .25) < .01 && Math.abs(c.p[2] - spot[0]) < 2, JSON.stringify(c))
  await fw(page, w => { const pic = w.board.doc.items.find(it => it.t === 'i'); w.board.setTool('select'); w.board.setSelection([pic]); w.board.nudgeSelection(100, 40) })
  next = await arrowOf()
  check('when the picture moves the arrow still points at the same part', Math.abs(next.p[2] - spot[0] - 100) < .5 && Math.abs(next.p[3] - spot[1] - 40) < .5, JSON.stringify(next))
  await fw(page, w => w.board.setSelection([]))
  await shot('label')

  // ── both ends in one object, ink, export ───────────────────────────────────
  await fw(page, w => w.board.addPage())
  const big = await addBox(300, 200, { p: [300, 200, 1200, 800] })
  await tool('arrow')
  await drag([500, 400], [900, 600])
  c = await arrowOf()
  check('a line drawn inside one box does not attach or jump', !c.from && !c.to && Math.abs(c.p[0] - 500) < 2, JSON.stringify(c))
  check('an export with arrows still works', await fw(page, async w => !!(await w.board.exportPng({ scope: 'content' }))))
  void big

  // ── frames no longer stack ─────────────────────────────────────────────────
  await app.close()
  ;({ app, page, logs } = await launch())
  const frames = () => fw(page, w => w.S.frameCount.value)
  const add = page.getByRole('button', { name: 'Add frame', exact: true })
  await add.click()
  await page.waitForTimeout(450)
  check('the toolbar adds a frame', await frames() === 1)
  check('once on a frame the add button is gone, so it cannot stack', await add.count() === 0)
  await fw(page, w => w.board.addFrame('here'))
  check('asked again at the same spot it says so instead of stacking', await frames() === 1)
  await shot('laptop-frame')
  await fw(page, w => { for (let i = 0; i < 4; i++) w.board.frames.push({ ...w.board.frames[0], x: w.board.frames[0].x + i * 12 }) })
  await fw(page, w => w.board.removeFramesHere())
  check('Remove clears everything stacked at that spot at once', await frames() === 0, String(await frames()))
  check('and the add button is back', await add.count() === 1)
  await fw(page, w => w.board.undoStructure())
  check('Undo brings them back', await frames() === 5)

  check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.join(' | '))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
