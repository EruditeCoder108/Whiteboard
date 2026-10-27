import { launch, appDir, fw, check as report, summary, gesture } from './lib.mjs'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
const target = join(appDir, 'docs', 'showcase-qa'); mkdirSync(target, { recursive: true })
let session = await launch({ inputIsolated: true, ...(process.env.FW_QA_EXE ? { executablePath: process.env.FW_QA_EXE } : {}) }), { app, page } = session
const checks = [], errors = [], network = [], evidence = { date: new Date().toISOString(), checks, errors, network, packaged: !!process.env.FW_QA_EXE }
const check = (name, ok) => { checks.push({ name, passed: !!ok }); report(name, ok) }
async function isolate() {
  page.setDefaultTimeout(10000); await page.emulateMedia({ reducedMotion: 'reduce' })
  page.on('pageerror', e => errors.push(e.message)); await page.route(/^https?:\/\//, r => { network.push(r.request().url()); return r.abort() })
  await app.evaluate(({ BrowserWindow }) => { for (const win of BrowserWindow.getAllWindows()) win.hide() })
  await fw(page, w => { w.S.radialEnabled.value = false; window.__showcaseTimer = setInterval(() => { cancelAnimationFrame(w.board.raf); w.board.frame() }, 16) })
}
async function ui(name) {
  const data = await app.evaluate(async ({ BrowserWindow, screen }) => {
    const win = BrowserWindow.getAllWindows()[0], visible = win.isVisible(), outside = Math.max(...screen.getAllDisplays().map(d => d.bounds.x + d.bounds.width)) + 200
    win.setPosition(outside, 40); win.setFocusable(false); win.setIgnoreMouseEvents(true); win.showInactive(); await new Promise(resolve => setTimeout(resolve, 180))
    try { return (await win.capturePage(undefined, { stayAwake: true })).toPNG().toString('base64') } finally { if (!visible) win.hide() }
  }); writeFileSync(join(target, name), Buffer.from(data, 'base64'))
}
async function scene(id, t, name, theme = 'blueprint') {
  const data = await fw(page, (w, a) => {
    const m = w.science.models.find(m => m.id === a.id), c = document.createElement('canvas'); c.width = 1000; c.height = 640
    const it = { t: 'l', id: a.id, model: a.id, labVersion: 1, modelVersion: 1, p: [0,0,1000,640], c: '#007c88', w: 1, params: { ...m.defaults }, frozenTime: 0, theme: a.theme, reveal: { graphs: true, vectors: true, trajectory: true, strobes: true, energy: true, equations: true, compare: false } }
    w.science.paintLab(c.getContext('2d'), it, a.t); return c.toDataURL().split(',')[1]
  }, { id, t, theme }); writeFileSync(join(target, name), Buffer.from(data, 'base64')); return data
}
try {
  await isolate(); await gesture(page, [[65,110],[110,130],[130,108]], { type: 'pen' })
  await scene('flux-studio',0.6,'flux-studio.png'); await scene('indicator-studio',8.8,'indicator-studio.png'); await scene('heart-studio',0.73,'heart-studio.png')
  const original = await fw(page, w => w.board.doc.items[0])
  await page.getByRole('button', { name: 'Science labs', exact: true }).click()
  check('Library opens on exactly three featured showcases', await page.locator('.science-card').count() === 3)
  await ui('showcase-library.png')
  await page.getByRole('button', { name: 'Browse all', exact: true }).click()
  check('All fourteen native experiments remain accessible', await page.locator('.science-card').count() === 14)
  await page.getByRole('button', { name: 'Showcases 3', exact: true }).click()
  await page.getByRole('button', { name: 'Insert Induction studio lab', exact: true }).click()
  await page.getByRole('button', { name: 'Hide lab inspector', exact: true }).click()
  await fw(page, w => w.board.focusLab(w.board.selection[0]))
  const before = await fw(page, w => ({ it: w.board.selection[0], undo: w.board.history.undoStack.length }))
  const points = await fw(page, w => {
    const it = w.board.selection[0], coords = [[126,270],[196,270],[280,270],[380,270],[490,270],[560,270],[490,270],[380,270]]
    return coords.map(p => { const [x,y] = w.science.labToWorld(it,p); return [(x - w.board.view.x) * w.board.view.zoom, (y - w.board.view.y) * w.board.view.zoom] })
  })
  await gesture(page, points, { type: 'touch', gap: 55 })
  const moved = await fw(page, w => w.board.selection[0])
  check('Finger moves only the magnet, preserving the frame position', moved.p.join() === before.it.p.join() && moved.params.motion === 1 && moved.gesture?.length >= 7)
  check('Hand motion commits exactly one undo step', await fw(page, w => w.board.history.undoStack.length) === before.undo + 1)
  check('Releasing the magnet stops the induced voltage', await fw(page, w => w.science.labState(w.board.selection[0], w.board.labTime(w.board.selection[0])).emf === 0))
  await fw(page, w => w.board.undo())
  check('Undo restores the complete automatic model', await fw(page, (w, it) => JSON.stringify(w.board.selection[0]) === JSON.stringify(it), before.it))
  await fw(page, w => w.board.redo())
  check('Redo restores the exact recorded movement', await fw(page, (w, trace) => JSON.stringify(w.board.selection[0].gesture) === JSON.stringify(trace), moved.gesture))
  await fw(page, w => w.board.seekLab(w.board.selection[0], 0))
  await page.evaluate(([a,b]) => {
    const el = document.querySelector('.stage'), r = el.getBoundingClientRect()
    const fire = (type,p,buttons) => el.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:1,pointerType:'touch',isPrimary:true,clientX:r.left+p[0],clientY:r.top+p[1],buttons,button:0,pressure:buttons?0.5:0}))
    fire('pointerdown',a,1); fire('pointerup',b,0)
  }, [points[0],points[4]])
  check('A coalesced pointer-up retains the final magnet position', await fw(page,w => Math.abs(w.board.selection[0].gesture.at(-1).x - 0.2) < 1e-7))
  await fw(page,w => w.board.undo())
  await fw(page, w => { const it = w.board.selection[0]; w.board.seekLab(it, 0); w.board.labs.setSpeed(it, 0.25) })
  const clockBefore = await fw(page, w => ({ json: w.board.serialize(), undo: w.board.history.undoStack.length }))
  await page.getByRole('button', { name: 'Play lab', exact: true }).click(); await page.waitForTimeout(150); await page.getByRole('button', { name: 'Pause lab', exact: true }).click()
  check('Replay of hand motion advances without document mutation', await fw(page, (w, a) => w.board.labTime(w.board.selection[0]) > 0 && w.board.serialize() === a.json && w.board.history.undoStack.length === a.undo, clockBefore))
  const cancelBefore = await fw(page, w => ({ json: w.board.serialize(), undo: w.board.history.undoStack.length }))
  await fw(page, w => w.board.seekLab(w.board.selection[0], 0))
  await gesture(page, points.slice(0, 4), { type: 'touch', gap: 20, up: false }); await page.keyboard.press('Escape')
  check('Cancelling a hand movement leaves document and undo history unchanged', await fw(page, (w,a) => w.board.serialize() === a.json && w.board.history.undoStack.length === a.undo, cancelBefore))
  const ids = [moved.id]
  for (const id of ['indicator-studio','heart-studio']) {
    const it = await fw(page, (w, id) => w.board.insertLab(id), id); ids.push(it.id)
    const start = await fw(page, w => ({ json: w.board.serialize(), undo: w.board.history.undoStack.length }))
    await page.getByRole('button', { name: 'Play lab', exact: true }).click(); await page.waitForTimeout(120); await page.getByRole('button', { name: 'Pause lab', exact: true }).click()
    check(`${id}: play advances without autosave or undo mutation`, await fw(page, (w,a) => w.board.labTime(w.board.selection[0]) > 0 && w.board.serialize() === a.json && w.board.history.undoStack.length === a.undo, start))
    await page.getByRole('button', { name: id === 'indicator-studio' ? 'Reaction' : 'Eject', exact: true }).click()
    check(`${id}: guided stop seeks to the selected scientific phase`, await fw(page, (w,id) => Math.abs(w.board.labTime(w.board.selection[0]) - (id === 'indicator-studio' ? 8.8 : 0.73)) < 1e-9, id))
    await page.getByRole('button', { name: 'Step lab forward 1/30 s', exact: true }).click()
    check(`${id}: single-step advances by 1/30 s`, await fw(page, (w,id) => Math.abs(w.board.labTime(w.board.selection[0]) - (id === 'indicator-studio' ? 8.8 : 0.73) - 1/30) < 1e-9, id))
    await page.getByRole('button', { name: 'Save this frozen starting frame', exact: true }).click()
    check(`${id}: freeze persists the displayed time`, await fw(page, w => w.board.selection[0].frozenTime === w.board.labTime(w.board.selection[0])))
  }
  await ui('heart-with-controls.png')
  for (const [id, times] of [['flux-studio',[0,0.6,1,2.6]],['indicator-studio',[0,2.8,4.2,5.6,7.8,8.8,10.4,14]],['heart-studio',[0.3,0.5,0.73,0.95]]]) {
    for (const t of times) await scene(id,t,`${id}-${t}.png`)
    await scene(id, times[1], `${id}-paper.png`, 'paper')
    const first = await scene(id,times[1],`${id}.png`); await scene(id,times.at(-1),`${id}-seek.png`)
    check(`${id}: arbitrary seeks reproduce identical rendered pixels`, first === await scene(id,times[1],`${id}-repeat.png`))
  }
  await page.getByRole('button', { name: 'Freeze & annotate', exact: true }).click(); await gesture(page, [[280,560],[300,547],[330,565]], { type: 'pen' })
  check('A frozen showcase supports ordinary pen annotations', await fw(page, w => w.board.doc.items.filter(x => x.t === 's').length === 2))
  check('The pre-existing stroke is preserved exactly', await fw(page, (w,it) => JSON.stringify(w.board.doc.items.find(x => x.id === it.id)) === JSON.stringify(it), original))
  const png = await fw(page, async w => { const bytes = new Uint8Array(await w.board.exportPng('#ffffff',true,1)), image = await createImageBitmap(new Blob([bytes], {type:'image/png'})); return { magic:[...bytes.slice(0,8)], size:bytes.length, width:image.width,height:image.height } })
  check('Board PNG decodes with three native labs and annotations', png.magic.join(',') === '137,80,78,71,13,10,26,10' && png.size > 30000 && png.width > 900); evidence.png = png
  const expected = await fw(page, w => JSON.parse(w.board.serialize()).items)
  await page.getByRole('button', { name: 'Science labs', exact: true }).click()
  await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].setSize(420,320)); await page.waitForTimeout(150)
  const compact = await page.getByTestId('science-library').evaluate(el => { const r=el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && el.scrollWidth <= el.clientWidth + 1 })
  check('Featured library fits the minimum window without horizontal scrolling',compact)
  await page.getByRole('button',{name:'Insert Inside the heartbeat lab',exact:true}).scrollIntoViewIfNeeded()
  const reachable = await page.getByRole('button',{name:'Insert Inside the heartbeat lab',exact:true}).evaluate(el => { const a=el.getBoundingClientRect(),c=el.closest('.science-library-content').getBoundingClientRect();return a.top >= c.top && a.bottom <= c.bottom+1 })
  check('A featured insertion action stays reachable in the minimum window',reachable)
  await page.waitForTimeout(1800); await ui('showcase-library-compact.png')
  await app.close()
  const saved = JSON.parse(readFileSync(join(session.userData,'board.json'),'utf8')); check('Disk save includes the exact hand trace and all three models', ids.every(id => saved.items.some(x => x.id === id)) && JSON.stringify(saved.items.find(x => x.id === moved.id).gesture) === JSON.stringify(moved.gesture))
  session = await launch({userData:session.userData,inputIsolated:true,...(process.env.FW_QA_EXE ? {executablePath:process.env.FW_QA_EXE}: {})}); ({app,page}=session); await isolate()
  const reopened = await fw(page,w => JSON.parse(w.board.serialize()).items)
  const canonical = value => JSON.stringify(value, (_,v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b))) : v)
  check('Fresh process reopens all serialised native labs and annotations exactly', canonical(reopened) === canonical(expected))
  check('No external renderer requests are needed', network.length === 0); check('No uncaught renderer errors',errors.length === 0)
} finally { await app.close(); writeFileSync(join(target,process.env.FW_QA_EXE ? 'packaged-results.json' : 'results.json'),JSON.stringify(evidence,null,2)) }
process.exitCode = summary() ? 1 : 0
