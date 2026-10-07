import { launch, gesture, check, summary, fw, shotDir } from './lib.mjs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

let session = await launch({ executablePath: process.argv[2] })
let app = session.app, page = session.page
const errors = []
const watch = () => page.on('pageerror', error => errors.push(error.message))
watch()
try {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 4000, y: 40, width: 1100, height: 740 }))
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: 'Record and replay', exact: true }).click()
  await page.getByRole('textbox', { name: 'New recording name', exact: true }).fill('Replay audit lesson')
  await page.getByRole('button', { name: 'Start recording', exact: true }).click()
  check('Record controls appear and the library panel gets out of the way', await page.getByRole('region', { name: 'Recording controls' }).isVisible() && !await page.getByTestId('replay-panel').isVisible())
  await fw(page, w => { w.S.radialEnabled.value = false; w.board.setTool('pen') })
  await gesture(page, [[180, 170], [210, 160], [240, 175], [280, 145], [315, 175]], { type: 'pen', pressure: 'ramp', gap: 70 })
  let recorded = await fw(page, w => w.replay.recorder.snapshot())
  check('Pen is captured with individual sample timing and pressure', recorded.steps.length === 1 && recorded.steps[0].ink?.times.length === recorded.steps[0].added[0].it.p.length / 3 && recorded.steps[0].ink.times.at(-1) > 150)
  await page.getByRole('button', { name: 'Pause recording', exact: true }).click()
  const pausedAt = await fw(page, w => w.replay.recorder.elapsed)
  await page.waitForTimeout(350)
  check('Recording pause freezes its clock', Math.abs(await fw(page, w => w.replay.recorder.elapsed) - pausedAt) < 2)
  await page.getByRole('button', { name: 'Resume recording', exact: true }).click()
  const bridge = await page.evaluate(() => window.api.agent.enable())
  const connection = JSON.parse(await readFile(bridge.connectionFile, 'utf8'))
  const call = async (name, args = {}) => (await fetch(connection.endpoint + '/call', { method: 'POST', headers: { Authorization: `Bearer ${connection.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name, arguments: args }) })).json()
  check('MCP discovers native recording controls', (await (await fetch(connection.endpoint + '/tools', { headers: { Authorization: `Bearer ${connection.token}` } })).json()).tools.some(tool => tool.name === 'whiteboard_replay'))
  let boardRead = await call('whiteboard_read')
  const batch = { expectedRevision: boardRead.revision, requestId: 'replay-note', label: 'Explain the conclusion', operations: [
    { op: 'create', id: 'explanation', kind: 'text', x: 130, y: 210, width: 530, height: 80, text: 'A recording can rebuild this lesson later.', fontSize: 24 },
    { op: 'create', id: 'formula', kind: 'rect', x: 130, y: 330, width: 530, height: 40, text: 'Side ×2 → Area ×4', fontSize: 18, bold: true, fill: '#eef2ff', color: '#3730a3' }
  ] }
  const applied = await call('whiteboard_apply', batch)
  check('Agent transactions retain their teaching label in the recording', applied.ok && await fw(page, w => w.replay.recorder.recording.steps.at(-1).label) === batch.label)
  await fw(page, w => { w.board.undo(); w.board.redo() })
  recorded = await fw(page, w => w.replay.recorder.snapshot())
  check('Recording includes undo and redo as visible steps', recorded.steps.slice(-2).map(step => step.label).join(',') === 'Undo,Redo')
  await page.waitForTimeout(250)
  await page.getByRole('button', { name: 'Finish', exact: true }).click()
  await page.waitForFunction(() => !window.__fw.replay.saving.value)
  const saved = JSON.parse(await readFile(join(session.userData, 'recordings.json'), 'utf8'))
  check('Finished recording is saved locally with editable steps', saved.length === 1 && saved[0].steps.length >= 4 && saved[0].duration > 500 && !await fw(page, w => w.replay.error.value))
  await page.screenshot({ path: join(shotDir, 'replay-library.png') })
  const before = await fw(page, w => w.board.serialize())
  const beforeRevision = await fw(page, w => w.board.doc.version)
  await page.getByRole('button', { name: 'Play lesson', exact: true }).click()
  await page.waitForTimeout(180)
  await page.getByRole('button', { name: 'Pause playback (Space)', exact: true }).click()
  const position = await fw(page, w => w.replay.position.value)
  await page.waitForTimeout(180)
  check('Playback pause freezes the timeline', await fw(page, w => w.replay.position.value) === position)
  await page.keyboard.press('ArrowRight')
  check('Next-step keyboard control advances to a recorded boundary', await fw(page, w => w.replay.position.value) > position)
  await page.keyboard.press('ArrowLeft')
  check('Previous-step keyboard control seeks backwards', await fw(page, w => w.replay.position.value) <= position)
  await fw(page, w => w.replay.seek(w.replay.active.value.duration))
  await page.screenshot({ path: join(shotDir, 'replay-playback.png') })
  await gesture(page, [[600, 400], [650, 430]])
  await page.keyboard.press('Delete')
  await page.keyboard.press('Control+z')
  const rejected = await call('whiteboard_apply', { ...batch, requestId: 'playback-edit', expectedRevision: beforeRevision })
  check('Playback blocks manual, keyboard and MCP edits', !rejected.ok && rejected.code === 'BUSY' && await fw(page, w => w.board.serialize()) === before)
  check('Original document and revision remain untouched throughout preview', await fw(page, w => w.board.doc.version) === beforeRevision)
  check('Original editing controls are hidden during preview', await page.locator('.history').evaluate(el => getComputedStyle(el).visibility === 'hidden') && await page.locator('.zoombar').evaluate(el => getComputedStyle(el).visibility === 'hidden'))
  await page.getByRole('button', { name: 'Keep this frame', exact: true }).click()
  let state = await fw(page, w => ({ ids: w.board.doc.items.map(it => it.id), selected: w.board.selection.map(it => it.id), active: w.S.replaying.value }))
  check('Keeping a frame adds editable objects with fresh IDs', !state.active && state.ids.length === 6 && new Set(state.ids).size === 6 && state.selected.length === 3)
  await fw(page, w => w.board.undo())
  check('Inserted diagram is one undo step; existing content survives', await fw(page, w => w.board.doc.items.length) === 3)
  // Exercise save/open through actual main-process handlers, with isolated dialog destinations.
  const stepsFile = join(session.userData, 'lesson.wbrp'), videoFile = join(session.userData, 'lesson.webm')
  await app.evaluate(({ dialog }, paths) => {
    dialog.showSaveDialog = async (_owner, options) => ({ canceled: false, filePath: options.title === 'Save playback video' ? paths.video : paths.steps })
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [paths.steps] })
  }, { steps: stepsFile, video: videoFile })
  await page.getByRole('button', { name: 'Record and replay', exact: true }).click()
  await page.getByRole('button', { name: 'Save steps', exact: true }).click()
  await page.waitForTimeout(250)
  const exported = JSON.parse(await readFile(stepsFile, 'utf8'))
  check('Reusable file export preserves timed pen points and editable objects', exported.format === 'floating-whiteboard-replay' && exported.steps[0].ink && exported.steps.length === saved[0].steps.length)
  await page.getByRole('button', { name: 'Open file', exact: true }).click()
  await page.waitForFunction(() => window.__fw.replay.library.value.length === 2 && !window.__fw.replay.saving.value)
  check('Opening a saved replay preserves the current board and existing lesson', await fw(page, w => w.board.doc.items.length) === 3 && await fw(page, w => new Set(w.replay.library.value.map(row => row.id)).size) === 2)
  await page.getByLabel('Playback speed', { exact: true }).selectOption('4')
  await page.getByRole('button', { name: 'Export video', exact: true }).click()
  await page.waitForFunction(() => window.__fw.replay.videoProgress.value === null && !window.__fw.replay.videoAbort, { timeout: 15000 })
  const videoError = await fw(page, w => w.replay.error.value)
  check('Video exporter reports success', !videoError, videoError)
  const video = await readFile(videoFile)
  check('Video export writes a real WebM container', video.byteLength > 500 && video.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])), `${video.byteLength} bytes`)
  // Decode in a separate hidden, local test window. The product's strict CSP
  // intentionally excludes embedded blob videos and remains unchanged.
  const decoderReady = app.waitForEvent('window')
  await app.evaluate(async ({ BrowserWindow }) => {
    const decoder = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false } })
    await decoder.loadURL('data:text/html,<html><body></body></html>')
  })
  const decoderPage = await decoderReady
  const decoded = await decoderPage.evaluate(async bytes => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'video/webm' }), url = URL.createObjectURL(blob), el = document.createElement('video')
    try {
      el.src = url; el.muted = true
      const metadata = await new Promise((resolve, reject) => { el.onloadedmetadata = () => resolve({ width: el.videoWidth, height: el.videoHeight, duration: el.duration }); el.onerror = () => reject(new Error(`WebM decode failed: ${el.error?.code} ${el.error?.message}`)) })
      await el.play(); await new Promise(resolve => setTimeout(resolve, 180)); el.pause()
      const time = el.currentTime
      await new Promise(resolve => { el.onseeked = resolve; el.currentTime = el.duration - .05 })
      const canvas = document.createElement('canvas'); canvas.width = el.videoWidth; canvas.height = el.videoHeight
      const ctx = canvas.getContext('2d'); ctx.drawImage(el, 0, 0)
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let inkPixels = 0
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 180 || pixels[i + 1] < 180 || pixels[i + 2] < 180) inkPixels++
      return { ...metadata, time, inkPixels }
    } finally { el.src = ''; URL.revokeObjectURL(url) }
  }, [...video])
  await decoderPage.close()
  check('Exported video decodes and plays at 1280 by 720', decoded.width === 1280 && decoded.height === 720 && decoded.time > .05)
  check('Video has the expected duration and can seek to the completed diagram', Number.isFinite(decoded.duration) && Math.abs(decoded.duration - exported.duration / 4 / 1000 - 1) < .04 && decoded.inkPixels > 500, JSON.stringify(decoded))
  await fw(page, w => { w.replay.error.value = 'Previous export failure' })
  let repeatedExports = true
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByRole('button', { name: 'Export video', exact: true }).click()
    await page.waitForFunction(() => window.__fw.replay.videoProgress.value === null && !window.__fw.replay.videoAbort, { timeout: 15000 })
    const repeated = await readFile(videoFile)
    repeatedExports &&= !await fw(page, w => w.replay.error.value) && repeated.byteLength > 500 && repeated.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
  }
  check('Three consecutive off-screen exports produce complete videos', repeatedExports)
  await page.getByRole('button', { name: 'Export video', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel export', exact: true }).click()
  await page.waitForFunction(() => window.__fw.replay.videoProgress.value === null)
  check('Video cancellation releases the exporter', await fw(page, w => !w.replay.videoAbort))
  await call('whiteboard_replay', { action: 'start', title: 'MCP recording' })
  boardRead = await call('whiteboard_read')
  await call('whiteboard_apply', { expectedRevision: boardRead.revision, requestId: 'native-record', label: 'Native replay edit', operations: [{ op: 'create', id: 'native-lesson', kind: 'note', x: 700, y: 100, text: 'Recorded through MCP' }] })
  const stopped = await call('whiteboard_replay', { action: 'stop' })
  const native = stopped.recordings.at(-1)
  check('MCP can start, record agent edits and finish a lesson', stopped.ok && !stopped.recording && native.title === 'MCP recording' && native.steps > 0)
  await call('whiteboard_replay', { action: 'play', id: native.id })
  await call('whiteboard_replay', { action: 'pause' })
  const sought = await call('whiteboard_replay', { action: 'seek', time: native.duration })
  check('MCP can play, pause and seek without altering the board', sought.ok && !sought.playing && sought.position === native.duration && await fw(page, w => w.board.doc.items.length) === 4)
  await call('whiteboard_replay', { action: 'close' })
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 4000, y: 40, width: 420, height: 320 }))
  await fw(page, w => { w.S.popover.value = 'replay' })
  await page.waitForTimeout(200)
  const fits = await page.getByTestId('replay-panel').evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight })
  check('Recording panel fits the minimum window and scrolls', fits)
  await page.screenshot({ path: join(shotDir, 'replay-small-window.png') })
  await fw(page, w => { w.replay.play(); w.replay.seek(w.replay.active.value.duration) })
  const controlsFit = await page.getByTestId('playback-controls').evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && el.scrollWidth <= el.clientWidth + 1 })
  check('Playback controls fit the minimum window', controlsFit)
  await page.screenshot({ path: join(shotDir, 'replay-small-playback.png') })
  await fw(page, w => w.replay.close())
  check('Renderer has no runtime errors', errors.length === 0, errors.join('; '))
  const exited = new Promise(resolve => app.process().once('exit', resolve))
  await page.evaluate(() => window.api.win.close())
  await exited
  await app.close().catch(() => {})
  session = await launch({ userData: session.userData, executablePath: process.argv[2] }); app = session.app; page = session.page; watch()
  check('Saved recordings survive restarting the app', await fw(page, w => w.replay.library.value.length) === 3 && await fw(page, w => w.replay.library.value.at(-1).title) === 'MCP recording')
  check('Playback never replaced the saved board', await fw(page, w => w.board.doc.items.length) === 4)
} catch (error) { check('Replay audit completes', false, error.stack); }
finally { await app.close().catch(() => {}) }
process.exitCode = summary() ? 1 : 0
