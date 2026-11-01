// PowerPoint with no Office, OpenBoard lessons, video and audio clips. Run: npm run e2e:imports
import { launch, check, summary, fw, gesture, shotDir } from './lib.mjs'
import { deflateRawSync } from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { app, page, logs } = await launch({ layout: 'board' })
const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: join(shotDir, `imports-${name}.png`) }) }

/** A real ZIP, with deflated parts and a stored one, the way Office writes them. */
function zip(files) {
  const parts = [], central = []
  let at = 0
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.isBuffer(text) ? text : Buffer.from(text)
    const packed = name.endsWith('.png') ? raw : deflateRawSync(raw), method = name.endsWith('.png') ? 0 : 8
    const n = Buffer.from(name)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(method, 8)
    local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(n.length, 26)
    parts.push(local, n, packed)
    const c = Buffer.alloc(46)
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 6); c.writeUInt16LE(method, 10)
    c.writeUInt32LE(packed.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(at, 42)
    central.push(c, n)
    at += 30 + n.length + packed.length
  }
  const dir = Buffer.concat(central), end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(at, 16)
  return Buffer.concat([...parts, dir, end])
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAFCAIAAADzBuo/AAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDr9KU3AAAAABJRU5ErkJggg==', 'base64')
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
const rel = (id, type, target) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`
const rels = (...r) => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${r.join('')}</Relationships>`
const xf = (x, y, w, h) => `<a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>`
const slide1 = `<p:sld ${NS}><p:cSld><p:spTree>
  <p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="4400" b="1"/><a:t>Photosynthesis</a:t></a:r></a:p></p:txBody></p:sp>
  <p:sp><p:nvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:p><a:r><a:t>Plants make food</a:t></a:r></a:p><a:p><a:r><a:t>पौधे भोजन बनाते हैं</a:t></a:r></a:p></p:txBody></p:sp>
  <p:sp><p:nvSpPr><p:nvPr><p:ph type="body" idx="2"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:p><a:r><a:t></a:t></a:r></a:p></p:txBody></p:sp>
  <p:pic><p:blipFill><a:blip r:embed="rId2"/></p:blipFill><p:spPr>${xf(7000000, 2000000, 3000000, 1500000)}</p:spPr></p:pic>
  <p:pic><p:blipFill><a:blip r:embed="rId3"/></p:blipFill><p:spPr>${xf(0, 0, 100, 100)}</p:spPr></p:pic>
</p:spTree></p:cSld></p:sld>`
const slide2 = `<p:sld ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="22423A"/></a:solidFill></p:bgPr></p:bg><p:spTree>
  <p:sp><p:spPr>${xf(1000000, 1000000, 3000000, 1000000)}<a:prstGeom prst="roundRect"/><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:spPr><p:txBody><a:bodyPr/><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="2400"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>Sun</a:t></a:r></a:p></p:txBody></p:sp>
  <p:cxnSp><p:spPr><a:xfrm flipH="1"><a:off x="4000000" y="1500000"/><a:ext cx="2000000" cy="0"/></a:xfrm><a:ln w="25400"><a:tailEnd type="triangle"/></a:ln></p:spPr></p:cxnSp>
  <p:graphicFrame><p:xfrm>${'<a:off x="1000000" y="3000000"/><a:ext cx="6000000" cy="2000000"/>'}</p:xfrm><a:graphic><a:graphicData><a:tbl><a:tblPr firstRow="1"/><a:tblGrid><a:gridCol w="3000000"/><a:gridCol w="3000000"/></a:tblGrid>
    <a:tr h="1000000"><a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>In</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>Out</a:t></a:r></a:p></a:txBody></a:tc></a:tr>
    <a:tr h="1000000"><a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>CO2</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>O2</a:t></a:r></a:p></a:txBody></a:tc></a:tr>
  </a:tbl></a:graphicData></a:graphic></p:graphicFrame>
  <p:grpSp><p:grpSpPr><a:xfrm><a:off x="8000000" y="3000000"/><a:ext cx="2000000" cy="2000000"/><a:chOff x="0" y="0"/><a:chExt cx="1000000" cy="1000000"/></a:xfrm></p:grpSpPr>
    <p:sp><p:spPr>${xf(0, 0, 500000, 500000)}<a:prstGeom prst="ellipse"/><a:solidFill><a:srgbClr val="F5C518"/></a:solidFill></p:spPr></p:sp>
  </p:grpSp>
</p:spTree></p:cSld></p:sld>`
const layout = `<p:sldLayout ${NS}><p:cSld><p:spTree>
  <p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr>${xf(800000, 300000, 10500000, 1300000)}</p:spPr></p:sp>
  <p:sp><p:nvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr>${xf(800000, 1800000, 5500000, 4300000)}</p:spPr></p:sp>
  <p:sp><p:nvSpPr><p:nvPr><p:ph type="body" idx="2"/></p:nvPr></p:nvSpPr><p:spPr>${xf(7000000, 4000000, 4000000, 1000000)}</p:spPr></p:sp>
</p:spTree></p:cSld></p:sldLayout>`
const pptx = zip({
  'ppt/presentation.xml': `<p:presentation ${NS}><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId1"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`,
  'ppt/_rels/presentation.xml.rels': rels(rel('rId1', 'slide', 'slides/slide2.xml'), rel('rId2', 'slide', 'slides/slide1.xml'), rel('rId3', 'theme', 'theme/theme1.xml')),
  'ppt/theme/theme1.xml': `<a:theme ${NS}><a:themeElements><a:clrScheme name="x"><a:dk1><a:sysClr val="windowText" lastClr="101010"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:accent1><a:srgbClr val="2F6BFF"/></a:accent1></a:clrScheme></a:themeElements></a:theme>`,
  'ppt/slides/slide1.xml': slide1,
  'ppt/slides/_rels/slide1.xml.rels': rels(rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'), rel('rId2', 'image', '../media/image1.png'), rel('rId3', 'image', '../media/image2.emf')),
  'ppt/slides/slide2.xml': slide2,
  'ppt/slides/_rels/slide2.xml.rels': rels(rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml')),
  'ppt/slideLayouts/slideLayout1.xml': layout,
  'ppt/media/image1.png': PNG
})
const ubz = zip({
  'page001.svg': `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1280" height="960"><rect width="1280" height="960" fill="#ffffff"/><polygon points="100,100 500,100 500,400" fill="#e5484d"/><image xlink:href="images/a.png" x="600" y="100" width="300" height="150"/><script>window.__hacked = true</script></svg>`,
  'page000.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="#ffffff"/><polygon points="200,200 800,200 800,700" fill="#2f6bff"/></svg>`,
  'images/a.png': PNG,
  'metadata.rdf': '<rdf/>'
})
const drop = (bytes, name, type = '') => page.evaluate(async ({ data, name, type }) => {
  const raw = Uint8Array.from(atob(data), c => c.charCodeAt(0))
  await window.__fw.insert.insertFiles([new File([raw], name, { type })])
}, { data: bytes.toString('base64'), name, type })

try {
  await fw(page, w => w.board.convertTo('notebook'))

  // ── PowerPoint, no Office ──────────────────────────────────────────────────
  await drop(pptx, 'lesson.pptx')
  await page.waitForTimeout(150)
  const deck = await fw(page, w => ({
    pages: w.S.pageCount.value,
    first: JSON.parse(w.board.serialize()).pages.map(p => p.items.map(i => ({ t: i.t, k: i.k, text: i.text, fill: i.fill, cells: i.cells, p: i.p, fontSize: i.fontSize, list: i.list, bold: i.bold, a: i.a, align: i.align })))
  }))
  check('two slides become two pages', deck.pages === 2, String(deck.pages) + ' ' + logs.join(' | ').slice(0, 800))
  const [one, two] = deck.first
  check('slides come in showing order, not file order', one.some(i => i.text === 'Photosynthesis'), JSON.stringify(one.map(i => i.text)))
  const title = one.find(i => i.text === 'Photosynthesis')
  check('a title takes its place and size from the layout', title.p[0] > 90 && title.p[0] < 120 && title.fontSize > 60 && title.bold === true, JSON.stringify(title))
  const body = one.find(i => i.text?.includes('Plants make food'))
  check('body text keeps its lines, in Hindi too, as a list', body?.text.includes('पौधे') && body.list === 'bullet', JSON.stringify(body))
  check('an empty prompt box does not come across', one.filter(i => i.t === 't').length === 2, String(one.filter(i => i.t === 't').length))
  check('a picture comes across in its place; one it cannot read is left out', one.filter(i => i.t === 'i').length === 1 && one.find(i => i.t === 'i').p[0] > 900, JSON.stringify(one.filter(i => i.t === 'i')))
  check('it says what it could not read', (await page.locator('.toast').textContent()).includes('1 part could not be read'), await page.locator('.toast').textContent())
  await shot('pptx-1')
  const shapeSun = two.find(i => i.text === 'Sun')
  check('a shape with a theme colour and its text', shapeSun?.k === 'rect' && shapeSun.fill === '#2f6bff' && shapeSun.align === 'center', JSON.stringify(shapeSun))
  const arrow = two.find(i => i.k === 'arrow')
  check('a connector, facing the right way', arrow && arrow.p[0] > arrow.p[2], JSON.stringify(arrow))
  const table = two.find(i => i.t === 'b')
  check('a table with its cells', table?.cells.flat().join() === 'In,Out,CO2,O2', JSON.stringify(table?.cells))
  const ball = two.find(i => i.k === 'ellipse')
  check('a shape in a group lands where the group puts it', ball && Math.abs(ball.p[0] - 8000000 * 1600 / 12192000) < 2 && Math.abs((ball.p[2] - ball.p[0]) - 1000000 * 1600 / 12192000) < 2, JSON.stringify(ball?.p))
  const bg = await fw(page, w => { w.board.turnPage(1); return w.S.bgColor.value })
  check('the slide background comes across', bg === '#22423a', bg)
  await page.waitForTimeout(400)
  await shot('pptx-2')
  const edit = await fw(page, w => { const it = w.board.doc.items.find(i => i.text === 'Sun'); w.board.setTool('select'); w.board.setSelection([it]); return !it.locked })
  check('everything stays editable', edit)
  await fw(page, w => w.board.setSelection([]))
  await drop(Buffer.from('this is not a zip'), 'broken.pptx')
  check('a damaged file says so and changes nothing', (await page.locator('.toast').textContent()).includes('Could not read broken.pptx'))
  await drop(Buffer.from('old'), 'old.ppt')
  check('an old .ppt says what to do', (await page.locator('.toast').textContent()).includes('.pptx or PDF'))

  // ── OpenBoard ──────────────────────────────────────────────────────────────
  await fw(page, w => w.board.addPage())
  await drop(ubz, 'lesson.ubz')
  await page.waitForTimeout(250)
  const ob = await fw(page, w => ({ pages: w.S.pageCount.value, here: w.S.page.value, items: w.board.doc.items.map(i => ({ t: i.t, locked: i.locked })), hacked: !!window.__hacked }))
  check('each OpenBoard page becomes a locked picture', ob.pages === 4 && ob.items.length === 1 && ob.items[0].t === 'i' && ob.items[0].locked, JSON.stringify(ob))
  check('scripts inside an old file never run', !ob.hacked)
  await page.waitForTimeout(200)
  await shot('ubz')
  const colours = await page.evaluate(async () => {
    const it = window.__fw.board.doc.items.at(-1), img = new Image(); img.src = it.src; await img.decode()
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0)
    const at = (fx, fy) => [...g.getImageData(cv.width * fx, cv.height * fy, 1, 1).data]
    return { wedge: at(300 / 1280, 150 / 960) , picture: at(750 / 1280, 175 / 960) }
  })
  check('the page draws its ink and its picture', colours.wedge[0] > 180 && colours.wedge[2] < 120, JSON.stringify(colours))

  // ── clips ──────────────────────────────────────────────────────────────────
  await fw(page, w => { w.board.addPage(); w.board.setTool('pen') })
  const wav = (() => {
    const n = 8000, b = Buffer.alloc(44 + n)
    b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22)
    b.writeUInt32LE(8000, 24); b.writeUInt32LE(8000, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40)
    for (let i = 0; i < n; i++) b[44 + i] = 128 + Math.round(60 * Math.sin(i * .2))
    return b
  })()
  await drop(wav, 'Rain sound.wav', 'audio/wav')
  await page.waitForTimeout(150)
  const audio = await fw(page, w => { const it = w.board.doc.items.at(-1); return it && { t: it.t, kind: it.kind, name: it.name } })
  check('an audio clip goes on the page', audio?.t === 'm' && audio.kind === 'audio' && audio.name === 'Rain sound', JSON.stringify(audio))
  await fw(page, w => w.board.setSelection([]))
  await shot('clip-audio')
  const spot = await fw(page, w => { const it = w.board.doc.items.at(-1), v = w.board.view; return [((it.p[0] + it.p[2]) / 2 - v.x) * v.zoom, ((it.p[1] + it.p[3]) / 2 - v.y) * v.zoom] })
  await fw(page, w => w.board.setTool('pen'))
  const before = await fw(page, w => w.board.doc.items.length)
  await gesture(page, [spot], { type: 'touch' })
  await page.waitForSelector('.clip-player audio', { timeout: 3000 })
  check('a tap on its play button opens the player, with no stray ink', (await fw(page, w => w.board.doc.items.length)) === before)
  const played = await page.locator('.clip-player audio').evaluate(a => new Promise(res => { if (a.readyState >= 1) res(a.duration); else { a.onloadedmetadata = () => res(a.duration); a.onerror = () => res(-1); setTimeout(() => res(-2), 3000) } }))
  check('the player really reads the sound', Math.abs(played - 1) < .1, String(played))
  await shot('clip-playing')
  await page.getByRole('button', { name: 'Stop the clip' }).click()
  check('stop closes it', !(await page.locator('.clip-player').isVisible()))
  const saved = await fw(page, w => { const json = w.board.serialize(); const f = JSON.parse(json); const clip = f.pages[f.page].items.find(i => i.t === 'm'); return { key: !!clip.a, inline: !!clip.src, kept: !!f.assets[clip.a] && f.assets[clip.a].startsWith('data:audio/wav') } })
  check('a clip is stored once, like a picture', saved.key && !saved.inline && saved.kept, JSON.stringify(saved))
  const back = await fw(page, w => { w.board.load(w.board.serialize(), { undoable: false }); const it = w.board.doc.items.find(i => i.t === 'm'); return it ? it.src.slice(0, 15) : null })
  check('it survives saving and opening', back === 'data:audio/wav;', String(back))
  // Real video files, made here by ffmpeg when it is on this PC.
  const made = mkdtempSync(join(tmpdir(), 'fw-clips-'))
  for (const [name, codec] of [['clip.mp4', ['-c:v', 'libx264', '-pix_fmt', 'yuv420p']], ['clip.webm', ['-c:v', 'libvpx']]]) {
    const output = join(made, name)
    if (spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=10', '-t', '2', ...codec, output]).status !== 0) { check(`${name}: ffmpeg not available, skipped`, true); continue }
    await fw(page, w => { w.board.addPage(); w.board.setTool('pen') })
    await drop(readFileSync(output), name, name.endsWith('mp4') ? 'video/mp4' : 'video/webm')
    await page.waitForTimeout(250)
    const video = await fw(page, w => { const it = w.board.doc.items.at(-1); return it && { t: it.t, kind: it.kind, poster: !!it.poster, aspect: it.aspect } })
    check(`${name} goes on the page with a frame from it`, video?.kind === 'video' && video.poster && Math.abs(video.aspect - 320 / 180) < .01, JSON.stringify(video))
    await fw(page, w => w.board.setSelection([]))
    const at = await fw(page, w => { const it = w.board.doc.items.at(-1), v = w.board.view; return [((it.p[0] + it.p[2]) / 2 - v.x) * v.zoom, ((it.p[1] + it.p[3]) / 2 - v.y) * v.zoom] })
    await fw(page, w => w.board.setTool('pen'))
    await gesture(page, [at], { type: 'touch' })
    await page.waitForSelector('.clip-player video', { timeout: 3000 })
    const length = await page.locator('.clip-player video').evaluate(v => new Promise(res => { if (v.readyState >= 1) res(v.duration); else { v.onloadedmetadata = () => res(v.duration); v.onerror = () => res(-1); setTimeout(() => res(-2), 3000) } }))
    check(`${name} really plays here`, Math.abs(length - 2) < .3, String(length))
    if (name === 'clip.mp4') await shot('clip-video')
    const pageNow = await fw(page, w => { w.board.addPage(); return w.S.page.value })
    await page.waitForTimeout(100)
    check(`turning the page stops ${name}`, pageNow > 0 && !(await page.locator('.clip-player').isVisible()))
    await fw(page, w => w.board.turnPage(-1))
  }
  const sizeLimit = await page.evaluate(async () => {
    const big = new File([new Uint8Array(29 * 1024 * 1024)], 'huge.mp4', { type: 'video/mp4' })
    const n = window.__fw.board.doc.items.length
    await window.__fw.insert.insertFiles([big])
    return { added: window.__fw.board.doc.items.length - n, said: document.querySelector('.toast')?.textContent ?? '' }
  })
  check('a clip that would slow every save is refused, with the reason', sizeLimit.added === 0 && sizeLimit.said.includes('too large'), JSON.stringify(sizeLimit))

  check('no renderer errors', logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, logs.filter(l => /pageerror|\[error\]/.test(l)).slice(0, 2).join(' | '))
} catch (error) {
  check('the suite ran to the end', false, String(error).slice(0, 600))
} finally { await app.close().catch(() => {}) }
process.exit(summary() ? 1 : 0)
