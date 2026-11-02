// The ready-made circuits and rays as they really look on the board, running. Run: node e2e/parts-scene.mjs [folder]
import { launch, appDir, fw } from './lib.mjs'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const folder = process.argv[2] ?? join(appDir, 'docs', 'apparatus-qa')
mkdirSync(folder, { recursive: true })
const { app, page } = await launch({ layout: 'board' })
try {
  for (const [id, dark] of [['ohm', false], ['bulb', false], ['series', false], ['parallel', true], ['galvanometer', true], ['capacitor', false], ['lens', true]]) {
    await fw(page, (w, a) => {
      w.board.addPage(); w.board.setColor(a.dark ? '#1f2a2c' : '#ffffff')
      const items = w.apparatus.EXAMPLES.find(e => e.id === a.id).build()
      for (const it of items) if (it.t === 'a' && it.kind === 'switch') it.params.on = 1
      w.board.insertSaved(items); w.board.setSelection([]); w.board.setTool('select'); w.board.refresh(null)
    }, { id, dark })
    await page.waitForTimeout(700)
    await page.screenshot({ path: join(folder, `scene-${id}.png`) })
  }
  await fw(page, w => { w.S.popover.value = null })
} finally { await app.close() }
