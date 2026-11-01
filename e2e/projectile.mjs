// Actual native teacher workflow in a disposable, hidden, input-isolated profile.
import { launch, appDir, check as reportCheck, summary, gesture, fw } from './lib.mjs'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const target = join(appDir, 'docs', 'science-qa')
mkdirSync(target, { recursive: true })
let session = await launch({ inputIsolated: true }), { app, page } = session
const errors = [], network = [], evidence = { recordedAt: new Date().toISOString(), isolatedHiddenWindow: true, offline: true }
const checks = []
function check(name, cond, extra = '') { checks.push({ name, passed: !!cond }); reportCheck(name, cond, extra) }
async function isolate() {
  page.on('pageerror', e => errors.push(e.message))
  await page.route(/^https?:\/\//, route => { network.push(route.request().url()); return route.abort() })
  await app.evaluate(({ BrowserWindow }) => { for (const win of BrowserWindow.getAllWindows()) { win.setAlwaysOnTop(false); win.setIgnoreMouseEvents(true); win.hide() } })
  await fw(page, w => {
    w.S.radialEnabled.value = false
    // Hidden windows have no reliable compositor rAF. Drive production frame(),
    // without changing the model/clock, from a timer for this workflow test.
    window.__scienceQaTimer = setInterval(() => { cancelAnimationFrame(w.board.raf); w.board.frame() }, 16)
  })
}
async function screenshot(name) {
  const data = await fw(page, async w => {
    w.board.refresh(null); w.board.frame()
    const png = await w.board.exportPng('#ffffff', true, 1.5)
    const blob = new Blob([png], { type: 'image/png' })
    return await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob) })
  })
  writeFileSync(join(target, name), Buffer.from(data.split(',')[1], 'base64'))
}
try {
  await isolate()
  await fw(page, w => { w.S.bgAlpha.value = 100; w.board.setColor('#ffffff'); w.board.setTool('pen') })
  await gesture(page, [[120, 150], [135, 160], [155, 148]], { type: 'pen' })
  const original = await fw(page, w => w.board.doc.items[0])
  await page.getByRole('button', { name: 'Science labs', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Search animations', exact: true }).fill('projectile')
  check('Science entry exposes offline projectile insertion', await page.getByRole('button', { name: 'Insert projectile lab', exact: true }).isVisible())
  await page.getByRole('button', { name: 'Insert projectile lab', exact: true }).click()
  const id = await fw(page, w => w.board.selection[0].id)
  check('Insert creates one native object and preserves existing ink', await fw(page, (w, original) => w.board.doc.items.length === 2 && JSON.stringify(w.board.doc.items[0]) === JSON.stringify(original) && w.board.selection[0].t === 'l', original))
  check('Inspector and native transport are available without a provider', await page.getByTestId('science-inspector').isVisible() && await page.getByTestId('science-transport').isVisible())
  await page.getByRole('button', { name: 'Explain', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Launch speed', exact: true }).fill('25')
  await page.getByRole('spinbutton', { name: 'Launch speed', exact: true }).evaluate(el => el.blur())
  check('Numeric launch edits commit with SI parameters', await fw(page, w => w.board.selection[0].params.speed) === 25)
  await fw(page, w => w.board.undo())
  check('A launch edit undoes in one step', await fw(page, w => w.board.selection[0].params.speed) === 20)
  await fw(page, w => w.board.redo())
  check('Redo restores edited launch', await fw(page, w => w.board.selection[0].params.speed) === 25)
  const sliderBefore = await fw(page, w => ({ json: w.board.serialize(), undo: w.board.history.undoStack.length }))
  await page.getByRole('slider', { name: 'Launch speed slider', exact: true }).evaluate(el => { el.value = '32'; el.dispatchEvent(new Event('input', { bubbles: true })) })
  check('Slider previews are transient until release', await fw(page, (w, b) => w.board.serialize() === b.json && w.board.history.undoStack.length === b.undo && w.board.labDraft.size === 1, sliderBefore))
  await page.getByRole('slider', { name: 'Launch speed slider', exact: true }).evaluate(el => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  check('Escape cancels a slider preview without a document edit', await fw(page, (w, b) => w.board.serialize() === b.json && w.board.labDraft.size === 0, sliderBefore))
  await page.getByRole('slider', { name: 'Launch speed slider', exact: true }).evaluate(el => { el.value = '28'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) })
  check('Slider release creates one intentional edit', await fw(page, (w, b) => w.board.selection[0].params.speed === 28 && w.board.history.undoStack.length === b.undo + 1 && w.board.labDraft.size === 0, sliderBefore))
  await fw(page, w => w.board.undo())
  const beforePreview = await fw(page, w => ({ json: w.board.serialize(), version: w.board.doc.version, undo: w.board.history.undoStack.length }))
  await page.getByRole('button', { name: 'Play lab', exact: true }).click()
  await page.waitForTimeout(250)
  await page.getByRole('button', { name: 'Pause lab', exact: true }).click()
  const paused = await fw(page, w => w.board.labs.time(w.board.selection[0]))
  await page.waitForTimeout(100)
  check('Play advances and pause holds an analytical clock', paused > 0.05 && paused < 2 && await fw(page, w => w.board.labs.time(w.board.selection[0])) === paused)
  check('Animation changes neither board serialization nor undo history', await fw(page, (w, b) => w.board.serialize() === b.json && w.board.doc.version === b.version && w.board.history.undoStack.length === b.undo, beforePreview))
  await page.getByRole('button', { name: 'Reset lab to launch', exact: true }).click()
  await page.getByRole('button', { name: 'Step lab forward 1/30 s', exact: true }).click()
  check('Step moves exactly 1/30 s', Math.abs(await fw(page, w => w.board.labs.time(w.board.selection[0])) - 1 / 30) < 1e-10)
  await page.getByRole('button', { name: 'Step lab backward 1/30 s', exact: true }).click()
  check('Back-step returns to launch', await fw(page, w => w.board.labs.time(w.board.selection[0])) === 0)
  await page.getByRole('slider', { name: 'Lab time', exact: true }).evaluate(el => { el.value = '1.234'; el.dispatchEvent(new Event('input', { bubbles: true })) })
  check('Scrub seeks the exact requested SI time', Math.abs(await fw(page, w => w.board.labs.time(w.board.selection[0])) - 1.234) < 1e-10)
  await page.getByRole('button', { name: 'Reset lab to launch', exact: true }).click()
  const drag = await fw(page, w => {
    const it = w.board.selection[0], h = w.science.launchHandle(it), toScreen = p => { const [x, y] = w.science.labToWorld(it, p); return [(x - w.board.view.x) * w.board.view.zoom, (y - w.board.view.y) * w.board.view.zoom] }
    return { points: [toScreen(h.tip), toScreen([h.origin[0] + 30 * Math.cos(Math.PI / 3) * h.gain, h.origin[1] - 30 * Math.sin(Math.PI / 3) * h.gain])], undo: w.board.history.undoStack.length }
  })
  await gesture(page, drag.points, { type: 'pen', gap: 20 })
  check('Direct launch handle edits speed and angle in one undo step', await fw(page, (w, undo) => { const it = w.board.selection[0]; return it.params.speed === 30 && Math.abs(it.params.angle - 60) < 1e-8 && w.board.history.undoStack.length === undo + 1 }, drag.undo))
  await page.getByText('Height, gravity & mass', { exact: true }).click()
  const gravityBefore = await fw(page, w => w.board.selection[0].params.gravity)
  await page.getByRole('spinbutton', { name: 'Gravity', exact: true }).fill('0')
  await page.getByRole('spinbutton', { name: 'Gravity', exact: true }).evaluate(el => el.blur())
  check('Invalid gravity is rejected without changing the model', await page.getByRole('alert').isVisible() && await fw(page, w => w.board.selection[0].params.gravity) === gravityBefore)
  await page.getByRole('button', { name: 'Moon', exact: true }).click()
  check('Gravity presets are model parameters, not presentation changes', await fw(page, w => w.board.selection[0].params.gravity) === 1.62)
  await page.getByRole('button', { name: 'Earth', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Complementary angle', exact: true }).check()
  await page.getByRole('button', { name: 'Apex', exact: true }).click()
  const atApex = await fw(page, w => w.science.evaluate(w.board.selection[0].params, w.board.labs.time(w.board.selection[0])))
  check('Apex checkpoint shows zero vertical velocity', Math.abs(atApex.vy) < 1e-9)
  await screenshot('projectile-blueprint.png')
  await page.getByRole('button', { name: 'Paper', exact: true }).click()
  await screenshot('projectile-paper.png')
  check('Paper/blueprint reveal edits retain the current instant', Math.abs(await fw(page, w => w.board.labs.time(w.board.selection[0])) - atApex.t) < 1e-9)
  await fw(page, w => w.replay.start('Frozen physics explanation'))
  const frozenTime = await fw(page, w => w.board.labs.time(w.board.selection[0]))
  await page.getByRole('button', { name: 'Freeze & annotate', exact: true }).click()
  check('Freeze persists the exact instant and activates the pen', await fw(page, (w, id) => w.S.tool.value === 'pen' && w.board.doc.items.find(it => it.id === id).frozenTime > 0, id))
  const line = await fw(page, (w, id) => {
    const it = w.board.doc.items.find(it => it.id === id); w.S.penColor.value = '#ef3030'; w.S.penSize.value = 6
    return [[330, 205], [420, 205], [510, 205]].map(p => { const [x, y] = w.science.labToWorld(it, p); return [(x - w.board.view.x) * w.board.view.zoom, (y - w.board.view.y) * w.board.view.zoom] })
  }, id)
  await gesture(page, line, { type: 'pen' })
  const annotation = await fw(page, w => w.board.doc.items.at(-1))
  check('Frozen lab accepts ordinary editable ink above it', annotation.t === 's' && annotation.c === '#ef3030')
  await fw(page, w => w.board.undo()); await fw(page, w => w.board.redo())
  check('Annotation undo/redo keeps the frozen scientific instant', await fw(page, (w, v) => w.board.doc.items.find(it => it.id === v.id).frozenTime === v.t && w.board.doc.items.at(-1).t === 's', { id, t: frozenTime }))
  for (const mode of ['stroke', 'pixel']) {
    await fw(page, (w, mode) => { w.S.eraserMode.value = mode; w.board.setTool('eraser') }, mode)
    await gesture(page, [line[1], [line[1][0] + 5, line[1][1]]], { type: 'pen' })
    check(`${mode} erasing changes annotation ink while preserving the native frame`, await fw(page, (w, entries) => w.board.doc.items.some(it => it.id === entries.id && it.t === 'l') && !w.board.doc.items.some(it => it.id === entries.annotation.id), { id, annotation }))
    await fw(page, w => w.board.undo())
  }
  await fw(page, w => w.board.setTool('pen'))
  await fw(page, w => w.replay.stop())
  const recording = await fw(page, w => w.replay.library.value.at(-1))
  check('Generic recorder captures frozen lab edits and annotations', recording.steps.some(step => step.added.some(e => e.it.t === 'l' && e.it.frozenTime === frozenTime)) && recording.steps.some(step => step.added.some(e => e.it.t === 's')))
  await fw(page, (w, id) => { w.board.setTool('select'); w.board.setSelection([w.board.doc.items.find(it => it.id === id)]) }, id)
  const moved = await fw(page, w => { const it = w.board.selection[0], time = w.board.labs.time(it); w.board.nudgeSelection(10, 0); return { same: w.board.labs.time(w.board.selection[0]) === time, params: w.board.selection[0].params } })
  check('Moving the frame leaves scientific time and parameters unchanged', moved.same && moved.params.speed === 30 && moved.params.angle === 60)
  const resize = await fw(page, w => { const it = w.board.selection[0], p = it.p, z = w.board.view.zoom, view = w.board.view; return [[(p[2] - view.x) * z, (p[3] - view.y) * z], [(p[2] - view.x) * z + 25, (p[3] - view.y) * z + 5]] })
  await gesture(page, resize)
  check('Frame handles enforce uniform resizing without changing physics', await fw(page, w => { const it = w.board.selection[0]; return Math.abs((it.p[3] - it.p[1]) / (it.p[2] - it.p[0]) - 0.64) < 1e-9 && it.params.speed === 30 }))
  await fw(page, w => w.board.toggleLockSelection())
  check('Lock disables launch and transport controls', await page.getByRole('spinbutton', { name: 'Launch speed', exact: true }).isDisabled() && await page.getByRole('button', { name: 'Play lab', exact: true }).isDisabled())
  const lockedJson = await fw(page, w => { const before = w.board.serialize(); w.board.nudgeSelection(20, 0); return before === w.board.serialize() })
  check('Locked lab resists shared move edits', lockedJson)
  await fw(page, w => w.board.toggleLockSelection())
  const pixel = await fw(page, (w, id) => {
    const it = w.board.doc.items.find(x => x.id === id)
    const ink = w.board.doc.items.at(-1), mid = Math.floor(ink.p.length / 6) * 3
    const [wx, wy] = [ink.p[mid], ink.p[mid + 1]]
    w.board.setSelection([]); w.board.seekLab(it, 0.2); w.board.frame()
    const ctx = w.board.boardCv.getContext('2d'), dpr = devicePixelRatio, x = Math.round((wx - w.board.view.x) * w.board.view.zoom * dpr), y = Math.round((wy - w.board.view.y) * w.board.view.zoom * dpr)
    const data = ctx.getImageData(x, y, 1, 1).data
    return [...data]
  }, id)
  check('Animated regional redraw retains ink above the lab', pixel[0] > 180 && pixel[1] < 100 && pixel[2] < 100)
  await fw(page, (w, id) => { const it = w.board.doc.items.find(x => x.id === id); w.board.setSelection([it]); w.board.duplicateSelection() }, id)
  const copyId = await fw(page, w => w.board.selection[0].id)
  check('Duplicate is an independent native lab with saved time', copyId !== id && await fw(page, (w, t) => w.board.selection[0].frozenTime === t, frozenTime))
  await fw(page, w => w.board.editLab(w.board.selection[0], { params: { ...w.board.selection[0].params, angle: 30 }, frozenTime: 0 }))
  check('Changing duplicate parameters preserves the original launch', await fw(page, (w, id) => w.board.doc.items.find(x => x.id === id).params.angle === 60 && w.board.selection[0].params.angle === 30, id))
  const oneActive = await fw(page, (w, id) => {
    const original = w.board.doc.items.find(x => x.id === id), copy = w.board.selection[0]
    w.board.playLab(original); w.board.playLab(copy)
    const exclusive = !w.board.labs.playing(original) && w.board.labs.playing(copy)
    w.board.pauseLab(copy)
    return exclusive
  }, id)
  check('Playing another lab pauses the previous one', oneActive)
  await fw(page, w => w.board.undo()) // restore comparable frame
  await fw(page, w => w.board.deleteSelection()) // keep one frame for snapshot/reopen
  await fw(page, (w, id) => { const it = w.board.doc.items.find(x => x.id === id); w.board.setSelection([it]); w.board.seekLab(it, it.frozenTime) }, id)
  await screenshot('projectile-annotated.png')
  const pngCheck = await fw(page, async w => {
    const bytes = new Uint8Array(await w.board.exportPng('#ffffff', true, 1)), blob = new Blob([bytes], { type: 'image/png' }), image = await createImageBitmap(blob)
    return { magic: [...bytes.slice(0, 8)], size: bytes.length, width: image.width, height: image.height }
  })
  check('PNG snapshot decodes with the native lab and annotations', pngCheck.magic.join(',') === '137,80,78,71,13,10,26,10' && pngCheck.size > 10000 && pngCheck.width > 500 && pngCheck.height > 300)
  evidence.png = pngCheck
  const bridge = await page.evaluate(() => window.api.agent.enable())
  const connection = JSON.parse(readFileSync(bridge.connectionFile, 'utf8'))
  const semantic = await (await fetch(connection.endpoint + '/call', { method: 'POST', headers: { Authorization: `Bearer ${connection.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'whiteboard_read', arguments: { ids: [id] } }) })).json()
  check('Semantic reads describe the native lab with units, version and frozen state', semantic.ok && semantic.objects[0].kind === 'lab' && semantic.objects[0].parametersSI.speed === 30 && semantic.objects[0].parameterUnits.angle === 'deg' && semantic.objects[0].frozenTimeSeconds === frozenTime && Math.abs(semantic.objects[0].frozenStateSI.vy) < 1e-9)
  // Persist the deliberate freeze, not a later transient scrub preview.
  await fw(page, (w, id) => { w.board.seekLab(w.board.doc.items.find(it => it.id === id), 0.1) }, id)
  await fw(page, async w => { await w.S.retrySave.value() })
  const saved = JSON.parse(readFileSync(join(session.userData, 'board.json'), 'utf8'))
  check('Disk save stores frozen time instead of the transient preview', saved.version === 3 && saved.items.find(x => x.id === id).frozenTime === frozenTime)
  await app.close()
  session = await launch({ userData: session.userData, inputIsolated: true }); ({ app, page } = session); await isolate()
  const reopened = await fw(page, (w, id) => { const it = w.board.doc.items.find(x => x.id === id); w.board.setTool('select'); w.board.setSelection([it]); return { it, time: w.board.labs.time(it), count: w.board.doc.items.length, recordingCount: w.replay.library.value.length } }, id)
  check('Restart reopens editable labs and their saved exact scientific time', reopened.it.t === 'l' && reopened.time === frozenTime && reopened.count === 3 && reopened.recordingCount === 1)
  check('Restart preserves the pre-existing ink and annotation', await fw(page, (w, entries) => {
    const ink = w.board.doc.items[0], original = entries.original
    return ink.id === original.id && ink.c === original.c && ink.p.length === original.p.length && ink.p.every((v, i) => Math.abs(v - original.p[i]) <= (i % 3 === 2 ? 0.000501 : 0.00501)) && w.board.doc.items.at(-1).id === entries.annotation.id
  }, { original, annotation }))
  const benchmark = await fw(page, async w => {
    const original = w.board.doc.snapshot(), it = w.board.selection[0]
    const strokes = Array.from({ length: 500 }, (_, i) => ({ t: 's', id: `qa-stress-${i}`, c: '#849bab', w: 2, m: false, v: false,
      p: Array.from({ length: 20 }, (_, j) => [it.p[0] + 30 + i % 25 * 34 + j, it.p[1] + 165 + Math.floor(i / 25) * 14 + Math.sin(j * 0.3) * 3, 0.5]).flat() }))
    w.board.doc.replaceAll([...strokes, ...original]); w.board.refresh(null); w.board.frame()
    w.board.seekLab(it, 0); w.board.playLab(it)
    clearInterval(window.__scienceQaTimer)
    const times = [], versions = w.board.doc.version, undo = w.board.history.undoStack.length
    const previousRebuild = w.board.rebuildCache.bind(w.board); let rebuilds = 0
    w.board.rebuildCache = () => { rebuilds++; previousRebuild() }
    try {
      for (let i = 0; i < 90; i++) {
        await new Promise(r => setTimeout(r, 16)); cancelAnimationFrame(w.board.raf)
        const start = performance.now(); w.board.frame(); times.push(performance.now() - start)
      }
      const ordered = times.toSorted((a, b) => a - b)
      return { frames: times.length, strokes: 500, samples: 10000, cpuMedianMs: ordered[45], cpuP95Ms: ordered[85], cpuMaxMs: ordered.at(-1), fullCacheRebuilds: rebuilds,
        revisionStable: w.board.doc.version === versions, undoStable: w.board.history.undoStack.length === undo, progressed: w.board.labs.time(it) > 0.1, viewport: w.board.size, dpr: devicePixelRatio }
    } finally {
      w.board.pauseLab(it); w.board.rebuildCache = previousRebuild
      w.board.doc.replaceAll(original); w.board.setSelection([it]); w.board.refresh(null); w.board.frame()
      window.__scienceQaTimer = setInterval(() => { cancelAnimationFrame(w.board.raf); w.board.frame() }, 16)
    }
  })
  check('A 500-stroke lesson animates with no full cache rebuilds or undo churn', benchmark.fullCacheRebuilds === 0 && benchmark.revisionStable && benchmark.undoStable && benchmark.progressed)
  evidence.scriptedAnimation = benchmark
  const offscreen = await fw(page, w => {
    const it = w.board.selection[0], view = w.board.view
    w.board.seekLab(it, 0); w.board.playLab(it); w.board.setView({ ...view, x: 1000000 }); w.board.frame()
    const paused = !w.board.labs.playing(it); w.board.setView(view); return paused
  })
  check('Panning away pauses an offscreen lab', offscreen)
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 4000, y: 40, width: 420, height: 320 }))
  await page.waitForTimeout(150)
  const compact = await page.evaluate(() => {
    const transport = document.querySelector('.science-transport'), rect = transport.getBoundingClientRect()
    return { width: innerWidth, height: innerHeight, rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      childrenInside: [...transport.querySelectorAll('button,input,select')].every(el => { const r = el.getBoundingClientRect(); return r.left >= rect.left - 1 && r.right <= rect.right + 1 && r.top >= rect.top - 1 && r.bottom <= rect.bottom + 1 }) }
  })
  check('Transport controls stay inside the minimum window', compact.rect.left >= 0 && compact.rect.top >= 28 && compact.rect.right <= compact.width && compact.rect.bottom <= compact.height && compact.childrenInside)
  evidence.compact = compact
  await fw(page, (w, id) => { const it = w.board.doc.items.find(x => x.id === id); w.board.doc.replaceAll(w.board.doc.items.map(x => x.id === id ? { ...it, modelVersion: 99 } : x)); w.board.setSelection([w.board.doc.items.find(x => x.id === id)]); w.board.refresh(null); w.S.documentRevision.value = w.board.doc.version }, id)
  check('Unsupported model version displays a compatibility warning and disables playback', (await page.getByRole('status').allTextContents()).some(t => t.includes('unavailable model version')) && await page.getByRole('button', { name: 'Play lab', exact: true }).isDisabled())
  check('Manual lab works with renderer HTTP(S) requests blocked', network.length === 0)
  check('The renderer raised no uncaught exceptions', errors.length === 0, errors.join('\n'))
  evidence.frozenTime = frozenTime; evidence.originalInkPreserved = true; evidence.errors = errors; evidence.networkRequests = network.length; evidence.checks = checks
  writeFileSync(join(target, 'projectile-results.json'), JSON.stringify(evidence, null, 2))
} finally { await app.close() }
process.exitCode = summary()
