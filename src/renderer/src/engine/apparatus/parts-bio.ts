import type { C, Live, Part } from './parts'
import { BLACK, STEEL, addParts, box, disc, grip, ink, line, plate, poly, shade, text } from './parts'

const base = { subject: 'biology' as const }
const LABELS = [{ key: 'labels', label: 'Show the names', toggle: true }]

/** A name with a thin line to what it names, placed clear of the drawing. */
function tag(c: C, l: Live, name: string, x: number, y: number, tx: number, ty: number, align: CanvasTextAlign = 'left'): void {
  line(c, x, y, tx, ty, ink(l), 1.4)
  disc(c, tx, ty, 2.6, ink(l))
  text(c, name, x + (align === 'left' ? 4 : -4), y, 15, ink(l), align)
}

/** What each specimen shows under the lens: shapes laid out the same way each time, so a focus change is the only change. */
function specimen(c: C, kind: number, zoom: number): void {
  c.save(); c.scale(zoom, zoom)
  if (kind === 0) { // onion peel: long brick-shaped cells, each with a nucleus
    c.fillStyle = '#efe2c8'; c.fillRect(-200, -200, 400, 400)
    for (let row = -6; row < 6; row++) for (let col = -5; col < 5; col++) {
      const x = col * 34 + (row % 2 ? 17 : 0), y = row * 18
      c.strokeStyle = '#8a5a2b'; c.lineWidth = 1.6; c.strokeRect(x, y, 34, 18)
      disc(c, x + 12 + (col * row % 7), y + 9, 3.2, '#6b3a16')
    }
  } else if (kind === 1) { // cheek cells: rounded and separate
    c.fillStyle = '#e8dff0'; c.fillRect(-200, -200, 400, 400)
    for (const [x, y] of [[-46, -30], [34, -44], [-8, 26], [58, 34], [-70, 44], [10, -86], [-92, -66], [84, -78]]) {
      c.beginPath(); c.ellipse(x, y, 30, 24, x * .02, 0, Math.PI * 2); c.fillStyle = 'rgba(190,150,215,.55)'; c.fill(); c.strokeStyle = '#7a4f9a'; c.lineWidth = 1.5; c.stroke()
      disc(c, x + 3, y - 2, 5.5, '#4b2a6a')
    }
  } else { // leaf peel: jigsaw cells around pairs of guard cells
    c.fillStyle = '#d7efc6'; c.fillRect(-200, -200, 400, 400)
    c.strokeStyle = '#4f8a3a'; c.lineWidth = 1.4
    for (let row = -5; row < 5; row++) for (let col = -5; col < 5; col++) { c.beginPath(); c.ellipse(col * 40 + (row % 2 ? 20 : 0), row * 30, 22, 16, 0, 0, Math.PI * 2); c.stroke() }
    for (const [x, y] of [[-40, -28], [36, 8], [-18, 52], [66, -58]]) {
      c.beginPath(); c.ellipse(x - 6, y, 6, 14, 0, 0, Math.PI * 2); c.ellipse(x + 6, y, 6, 14, 0, 0, Math.PI * 2); c.fillStyle = '#2f8a3a'; c.fill()
      c.beginPath(); c.ellipse(x, y, 2, 8, 0, 0, Math.PI * 2); c.fillStyle = '#123d18'; c.fill()
    }
  }
  c.restore()
}

export const BIOLOGY: Part[] = [
  { ...base, group: 'Looking closely', kind: 'microscope', name: 'Microscope', w: 560, h: 420, params: { focus: .35, mag: 1, slide: 0 },
    settings: [{ key: 'slide', label: 'Slide', choices: ['Onion peel', 'Cheek cells', 'Leaf peel'] }, { key: 'mag', label: 'Magnification', choices: ['100×', '400×', '1000×'], apply: (v, q) => { q.mag = [1, 2, 3.4][v] } }],
    controls: [{ name: 'Focus knob', at: q => [200, 150 + q.focus * 120], reach: 44, drag: (q, _x, y) => { q.focus = Math.max(0, Math.min(1, (y - 150) / 120)) } }],
    paint(c, q, l) {
      // The body: a stand, a tube and a stage.
      box(c, 40, 374, 190, 36, 8, shade(c, 0, 374, 0, 410, BLACK))
      c.beginPath(); c.moveTo(186, 376); c.quadraticCurveTo(240, 240, 150, 110); c.lineWidth = 26; c.strokeStyle = '#2b2f36'; c.lineCap = 'round'; c.stroke()
      c.save(); c.translate(110, 120); c.rotate(-.2)
      box(c, -18, -86, 36, 130, 6, shade(c, -18, 0, 18, 0, BLACK))
      box(c, -13, -108, 26, 26, 3, shade(c, -13, 0, 13, 0, STEEL))
      box(c, -12, 44, 24, 30, 3, shade(c, -12, 0, 12, 0, STEEL))
      c.restore()
      box(c, 62, 276, 130, 12, 3, shade(c, 0, 276, 0, 288, STEEL))
      box(c, 96, 268, 58, 8, 1, 'rgba(200,225,240,.85)', 'rgba(50,70,90,.6)', 1)
      disc(c, 124, 340, 22, shade(c, 104, 320, 144, 360, STEEL), 'rgba(30,30,40,.5)')
      box(c, 196, 150, 8, 120, 4, 'rgba(120,130,140,.6)', '')
      grip(c, 200, 150 + q.focus * 120, 15)
      text(c, 'Focus', 232, 150 + q.focus * 120, 14, ink(l), 'left')
      // What the eye sees: sharp only at the right focus.
      const cx = 420, cy = 170, r = 124, off = Math.abs(q.focus - .62)
      c.save(); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip()
      c.translate(cx, cy)
      c.filter = off < .02 ? 'none' : `blur(${Math.min(14, off * 34).toFixed(1)}px)`
      specimen(c, q.slide, q.mag)
      c.filter = 'none'
      c.restore()
      disc(c, cx, cy, r, 'transparent', '#17191d', 9)
      text(c, 'Through the eyepiece', cx, 318, 16, ink(l))
      plate(c, off < .02 ? 'In focus' : 'Turn the focus knob', cx, 346, 15, off < .02 ? '#1f7a4c' : '#172033')
    } },
  { ...base, group: 'Looking closely', kind: 'petri-dish', name: 'Petri dish', w: 200, h: 200, params: { colonies: 14 },
    settings: [{ key: 'colonies', label: 'Colonies grown', min: 0, max: 60, step: 1 }],
    paint(c, q, l) {
      disc(c, 100, 100, 90, l.dark ? 'rgba(235,225,180,.22)' : 'rgba(240,230,190,.55)', l.dark ? '#e6f0fa' : '#3b4d5c', 3)
      disc(c, 100, 100, 80, 'rgba(240,226,160,.5)', l.dark ? 'rgba(230,240,250,.6)' : 'rgba(60,80,100,.5)', 1.5)
      for (let i = 0; i < q.colonies; i++) {
        const a = i * 2.399963, r = 72 * Math.sqrt((i + .5) / Math.max(q.colonies, 30))
        disc(c, 100 + Math.cos(a) * r, 100 + Math.sin(a) * r, 3 + (i * 7 % 5), i % 3 ? '#e9f3d0' : '#c9dd9c', 'rgba(90,110,50,.6)', 1)
      }
    } },
  { ...base, group: 'Looking closely', kind: 'slide', name: 'Glass slide', w: 300, h: 110, params: { cover: 1 },
    settings: [{ key: 'cover', label: 'Cover slip on', toggle: true }],
    paint(c, q, l) {
      box(c, 8, 22, 284, 66, 3, l.dark ? 'rgba(210,230,245,.2)' : 'rgba(205,225,240,.45)', l.dark ? '#e6f0fa' : '#3b4d5c', 2)
      c.beginPath(); c.ellipse(150, 55, 26, 18, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(180,120,190,.55)'; c.fill()
      if (q.cover) box(c, 112, 28, 76, 54, 2, 'rgba(255,255,255,.28)', l.dark ? '#e6f0fa' : '#3b4d5c', 1.5)
      box(c, 16, 28, 44, 54, 2, 'rgba(255,255,255,.75)', 'rgba(60,70,90,.4)', 1)
    } },
  { ...base, group: 'Cells', kind: 'bacterium', name: 'Bacterium', w: 560, h: 280, params: { labels: 1 }, settings: LABELS,
    paint(c, q, l) {
      for (const [y, s] of [[110, 1], [170, -1]] as [number, number][]) { c.beginPath(); c.moveTo(390, y); c.bezierCurveTo(430, y - 34 * s, 450, y + 34 * s, 500, y); c.strokeStyle = '#8a6a2a'; c.lineWidth = 4; c.stroke() }
      box(c, 90, 70, 300, 140, 70, 'rgba(180,215,150,.45)', '#6d9a4a', 3)
      box(c, 100, 80, 280, 120, 60, '#cfe6a8', '#4f7a2a', 4)
      box(c, 110, 90, 260, 100, 50, '#e6f2c8', '#7a9a50', 2)
      c.beginPath(); for (let i = 0; i <= 30; i++) { const t = i / 30, x = 190 + t * 100, y = 140 + Math.sin(t * 20) * 22 * Math.sin(t * Math.PI); i ? c.lineTo(x, y) : c.moveTo(x, y) }
      c.strokeStyle = '#7a3b9a'; c.lineWidth = 3; c.stroke()
      for (const [x, y] of [[140, 116], [152, 164], [176, 106], [310, 110], [330, 160], [352, 130], [300, 172]]) disc(c, x, y, 4, '#3b5a22')
      if (q.labels) {
        tag(c, l, 'Capsule', 70, 40, 130, 82, 'right'); tag(c, l, 'Cell wall', 70, 240, 138, 186, 'right'); tag(c, l, 'Cell membrane', 150, 254, 184, 186, 'left')
        tag(c, l, 'DNA', 250, 30, 240, 120); tag(c, l, 'Ribosomes', 340, 40, 330, 108); tag(c, l, 'Flagellum', 440, 240, 450, 180)
      }
    } },
  { ...base, group: 'Plants', kind: 'leaf-section', name: 'Inside a leaf', w: 600, h: 340, params: { labels: 1 }, settings: LABELS,
    paint(c, q, l) {
      const x0 = 120, x1 = 430
      box(c, x0, 40, x1 - x0, 10, 3, '#e8f3b8', '#8aa84a', 1.5)
      for (let x = x0; x < x1; x += 31) box(c, x, 50, 31, 26, 4, '#d8efb0', '#6d9a4a', 1.5)
      for (let x = x0; x < x1; x += 26) { box(c, x, 76, 26, 78, 8, '#a6d57a', '#4f8a3a', 1.5); for (const y of [90, 108, 126, 142]) disc(c, x + 13, y, 4.5, '#2f7a2e') }
      for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) { const cx = x0 + 20 + i * 34 + (row % 2) * 16, cy = 172 + row * 28; c.beginPath(); c.ellipse(cx, cy, 15, 11, i * .7, 0, Math.PI * 2); c.fillStyle = '#bfe39a'; c.fill(); c.strokeStyle = '#5b9a48'; c.lineWidth = 1.5; c.stroke(); disc(c, cx - 3, cy, 2.6, '#2f7a2e'); disc(c, cx + 4, cy + 2, 2.6, '#2f7a2e') }
      disc(c, 274, 196, 26, '#c9a56c', '#7a5a2a', 2); disc(c, 274, 188, 11, '#6fb0d8', '#2f6d9e', 1.5); disc(c, 274, 208, 9, '#d98f4a', '#8a4f1e', 1.5)
      for (let x = x0; x < x1; x += 31) if (Math.abs(x - 244) > 20) box(c, x, 240, 31, 22, 4, '#d8efb0', '#6d9a4a', 1.5)
      for (const s of [-1, 1]) { c.beginPath(); c.ellipse(260 + s * 12, 251, 11, 9, 0, 0, Math.PI * 2); c.fillStyle = '#4fa63a'; c.fill(); c.strokeStyle = '#2f6b22'; c.lineWidth = 1.5; c.stroke() }
      box(c, x0, 262, x1 - x0, 8, 3, '#e8f3b8', '#8aa84a', 1.5)
      if (q.labels) {
        tag(c, l, 'Cuticle', 104, 44, 134, 45, 'right'); tag(c, l, 'Upper epidermis', 104, 64, 134, 63, 'right'); tag(c, l, 'Palisade layer', 104, 114, 134, 114, 'right'); tag(c, l, 'Spongy layer', 104, 198, 134, 198, 'right')
        tag(c, l, 'Vein', 450, 196, 300, 196); tag(c, l, 'Xylem', 450, 150, 284, 186); tag(c, l, 'Phloem', 450, 232, 284, 210); tag(c, l, 'Lower epidermis', 450, 278, 400, 252); tag(c, l, 'Stoma', 260, 306, 260, 256)
      }
    } },
  { ...base, group: 'Plants', kind: 'stoma', name: 'Stoma', w: 300, h: 300, params: { open: 1 },
    controls: [{ name: 'Open or close the stoma', at: () => [150, 130], reach: 90, tap: q => { q.open = q.open ? 0 : 1 } }],
    paint(c, q, l) {
      // Guard cells swell with water and bow apart; slack, they lie together and close the pore.
      const gap = q.open ? 26 : 3, bow = q.open ? 44 : 30
      c.fillStyle = l.dark ? 'rgba(180,225,150,.2)' : '#e3f3d0'; c.fillRect(30, 20, 240, 220)
      c.beginPath(); c.ellipse(150, 130, gap, 74, 0, 0, Math.PI * 2); c.fillStyle = '#2b3a22'; c.fill()
      for (const s of [-1, 1]) {
        c.beginPath(); c.moveTo(150, 46); c.bezierCurveTo(150 + s * (gap + bow), 72, 150 + s * (gap + bow), 188, 150, 214); c.bezierCurveTo(150 + s * gap, 180, 150 + s * gap, 80, 150, 46)
        c.fillStyle = q.open ? '#57b847' : '#8fb86a'; c.fill(); c.strokeStyle = '#2f6b22'; c.lineWidth = 3; c.stroke()
        for (const y of [86, 112, 138, 164]) disc(c, 150 + s * (gap + bow * .42), y, 5, '#1f7a2e')
      }
      plate(c, q.open ? 'Open: gases pass · tap to close' : 'Closed: saves water · tap to open', 150, 272, 13)
    } },
  { ...base, group: 'Cells', kind: 'plant-cell', name: 'Plant cell', w: 520, h: 340, params: { labels: 1 }, settings: LABELS,
    paint(c, q, l) {
      box(c, 96, 40, 300, 260, 14, '#8cc66b', '#3f7a2e', 7)
      box(c, 106, 50, 280, 240, 10, '#d9efc0', '#5b9a48', 2)
      box(c, 176, 92, 170, 150, 40, 'rgba(160,210,240,.75)', 'rgba(60,120,170,.7)', 2)
      disc(c, 142, 92, 28, '#b98ad0', '#6a3a8a', 2); disc(c, 142, 92, 10, '#6a3a8a')
      for (const [x, y] of [[130, 160], [140, 214], [176, 266], [240, 270], [310, 268], [366, 210], [368, 130], [300, 70], [222, 66]]) { c.beginPath(); c.ellipse(x, y, 17, 9, x * .03, 0, Math.PI * 2); c.fillStyle = '#3f9a38'; c.fill(); c.strokeStyle = '#1f5f1c'; c.lineWidth = 1.5; c.stroke() }
      for (const [x, y] of [[122, 248], [358, 86]]) { c.beginPath(); c.ellipse(x, y, 16, 8, .6, 0, Math.PI * 2); c.fillStyle = '#e39a5a'; c.fill(); c.strokeStyle = '#8a4f1e'; c.lineWidth = 1.5; c.stroke() }
      if (q.labels) {
        tag(c, l, 'Cell wall', 406, 300, 394, 280); tag(c, l, 'Cell membrane', 406, 268, 384, 260); tag(c, l, 'Vacuole', 406, 170, 346, 170); tag(c, l, 'Chloroplast', 406, 130, 380, 130)
        tag(c, l, 'Mitochondrion', 406, 86, 372, 86); tag(c, l, 'Nucleus', 86, 70, 124, 84, 'right'); tag(c, l, 'Cytoplasm', 86, 190, 130, 190, 'right')
      }
    } },
  { ...base, group: 'Cells', kind: 'animal-cell', name: 'Animal cell', w: 520, h: 340, params: { labels: 1 }, settings: LABELS,
    paint(c, q, l) {
      c.beginPath(); c.ellipse(250, 170, 150, 130, .1, 0, Math.PI * 2); c.fillStyle = '#f6d9c7'; c.fill(); c.strokeStyle = '#b4623c'; c.lineWidth = 4; c.stroke()
      disc(c, 240, 170, 44, '#b98ad0', '#6a3a8a', 2); disc(c, 240, 170, 16, '#6a3a8a')
      for (const [x, y, a] of [[330, 110, .5], [340, 210, -.4], [160, 100, -.6], [150, 230, .4], [260, 262, .1]]) { c.beginPath(); c.ellipse(x, y, 19, 9, a, 0, Math.PI * 2); c.fillStyle = '#e39a5a'; c.fill(); c.strokeStyle = '#8a4f1e'; c.lineWidth = 1.5; c.stroke() }
      for (const [x, y] of [[300, 160], [190, 150], [212, 244], [290, 60]]) disc(c, x, y, 7, '#a8c8e8', '#4a7aa8', 1.5)
      if (q.labels) {
        tag(c, l, 'Cell membrane', 416, 90, 362, 96); tag(c, l, 'Mitochondrion', 416, 210, 358, 210); tag(c, l, 'Vacuole', 416, 160, 306, 160)
        tag(c, l, 'Nucleus', 84, 170, 198, 170, 'right'); tag(c, l, 'Cytoplasm', 84, 262, 188, 262, 'right')
      }
    } },
  { ...base, group: 'Cells', kind: 'neuron', name: 'Nerve cell', w: 620, h: 240, params: { labels: 1 }, settings: LABELS,
    paint(c, q, l) {
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; line(c, 96, 120, 96 + Math.cos(a) * 70, 120 + Math.sin(a) * 66, '#c0669a', 5); line(c, 96 + Math.cos(a) * 56, 120 + Math.sin(a) * 52, 96 + Math.cos(a + .35) * 84, 120 + Math.sin(a + .35) * 80, '#c0669a', 3) }
      disc(c, 96, 120, 34, '#dd8fbb', '#8a3f6a', 3); disc(c, 96, 120, 12, '#6a2a50')
      line(c, 128, 120, 524, 120, '#c0669a', 7)
      for (let x = 160; x < 500; x += 62) box(c, x, 106, 52, 28, 13, '#f3e3a6', '#b9a24f')
      for (let i = -2; i <= 2; i++) { line(c, 524, 120, 574, 120 + i * 24, '#c0669a', 4); disc(c, 577, 120 + i * 24, 6, '#8a3f6a') }
      if (q.labels) {
        tag(c, l, 'Dendrites', 40, 22, 62, 66); tag(c, l, 'Cell body', 96, 214, 96, 150); tag(c, l, 'Nucleus', 186, 40, 106, 116)
        tag(c, l, 'Axon', 330, 194, 330, 124); tag(c, l, 'Myelin sheath', 410, 40, 392, 108); tag(c, l, 'Nerve endings', 500, 216, 572, 170)
      }
    } },
  { ...base, group: 'Life processes', kind: 'dna', name: 'DNA', w: 300, h: 460, params: { spin: 1 },
    settings: [{ key: 'spin', label: 'Turning', toggle: true }],
    moving: q => !!q.spin,
    paint(c, q, l) {
      const turn = q.spin ? l.time * 1.1 : 0, PAIRS = [['A', 'T', '#e5484d', '#2f6bff'], ['C', 'G', '#2fa66a', '#f2b134']] as const
      const rows = 22
      for (let i = 0; i < rows; i++) {
        const y = 24 + i * 18, a = i * .55 + turn, x = Math.sin(a) * 92, back = Math.cos(a) < 0
        const [s0, s1, c0, c1] = PAIRS[(i * 7 % 3) % 2]
        const flip = i % 4 > 1
        c.globalAlpha = back ? .55 : 1
        line(c, 150 - x, y, 150, y, flip ? c1 : c0, 7); line(c, 150, y, 150 + x, y, flip ? c0 : c1, 7)
        disc(c, 150 - x, y, 8, '#5c6b80'); disc(c, 150 + x, y, 8, '#8091a8')
        if (Math.abs(x) > 62) { text(c, flip ? s1 : s0, 150 - x * .55, y, 12, '#fff', 'center', 800); text(c, flip ? s0 : s1, 150 + x * .55, y, 12, '#fff', 'center', 800) }
        c.globalAlpha = 1
      }
      text(c, 'A pairs with T · C pairs with G', 150, 438, 15, ink(l))
    } },
  { ...base, group: 'Life processes', kind: 'lungs-model', name: 'Breathing model', w: 300, h: 420, params: { pull: 0 },
    controls: [{ name: 'Rubber sheet', at: q => [150, 330 + q.pull * 56], reach: 44, drag: (q, _x, y) => { q.pull = Math.max(0, Math.min(1, (y - 330) / 56)) } }],
    paint(c, q, l) {
      // Pulling the sheet down makes the jar larger, the pressure falls, and air comes in.
      const b = 26 + q.pull * 28
      c.beginPath(); c.moveTo(120, 34); c.lineTo(120, 74); c.lineTo(46, 130); c.lineTo(46, 330); c.moveTo(254, 330); c.lineTo(254, 130); c.lineTo(180, 74); c.lineTo(180, 34)
      c.strokeStyle = l.dark ? '#e6f0fa' : '#3b4d5c'; c.lineWidth = 4; c.lineJoin = 'round'; c.stroke()
      box(c, 112, 24, 76, 16, 4, '#8a5a2b')
      line(c, 150, 8, 150, 130, l.dark ? '#e6f0fa' : '#3b4d5c', 6)
      line(c, 150, 130, 104, 170, l.dark ? '#e6f0fa' : '#3b4d5c', 6); line(c, 150, 130, 196, 170, l.dark ? '#e6f0fa' : '#3b4d5c', 6)
      for (const x of [96, 204]) { c.beginPath(); c.ellipse(x, 176 + b * .5, b * .95, b * 1.15, 0, 0, Math.PI * 2); c.fillStyle = '#ef8fa0'; c.fill(); c.strokeStyle = '#a53a50'; c.lineWidth = 2.5; c.stroke() }
      c.beginPath(); c.moveTo(46, 330); c.quadraticCurveTo(150, 330 + q.pull * 112, 254, 330); c.strokeStyle = '#7a3b16'; c.lineWidth = 7; c.stroke()
      grip(c, 150, 330 + q.pull * 56, 14, '#7a3b16')
      const name = q.pull > .05 ? 'Breathing in: lungs fill' : 'Breathing out: lungs empty'
      plate(c, name, 150, 408, 15)
      text(c, 'Lung', 96, 136 - q.pull * 12, 14, ink(l)); text(c, 'Windpipe', 192, 18, 13, ink(l), 'left'); text(c, 'Diaphragm', 268, 348, 13, ink(l), 'right')
    } },
  { ...base, group: 'Life processes', kind: 'osmosis', name: 'Osmosis U-tube', w: 300, h: 340, params: { t: 0, on: 0 },
    controls: [{ name: 'Start or reset', at: () => [150, 26], reach: 44, tap: q => { if (q.t >= 1) { q.t = 0; q.on = 0 } else q.on = q.on ? 0 : 1 } }],
    moving: q => !!q.on && q.t < 1,
    paint(c, q, l) {
      const shift = q.t * 60, wet = '#a9d8f2'
      c.fillStyle = wet; c.fillRect(66, 150 + shift, 40, 150 - shift); c.fillRect(194, 150 - shift, 40, 150 + shift)
      c.fillStyle = 'rgba(245,190,120,.7)'; c.fillRect(194, 150 - shift, 40, 150 + shift)
      c.fillRect(106, 270, 44, 40); c.fillStyle = wet; c.fillRect(106, 270, 44, 40); c.fillStyle = 'rgba(245,190,120,.7)'; c.fillRect(150, 270, 44, 40)
      const edge = l.dark ? '#e6f0fa' : '#3b4d5c'
      c.beginPath(); c.moveTo(66, 60); c.lineTo(66, 310); c.lineTo(234, 310); c.lineTo(234, 60); c.moveTo(106, 60); c.lineTo(106, 270); c.lineTo(194, 270); c.lineTo(194, 60); c.strokeStyle = edge; c.lineWidth = 4; c.stroke()
      line(c, 150, 268, 150, 312, '#8a5a2b', 4)
      text(c, 'Water', 86, 44, 14, ink(l)); text(c, 'Sugar solution', 214, 44, 14, ink(l))
      text(c, 'Semi-permeable membrane', 150, 330, 13, ink(l))
      plate(c, q.t >= 1 ? 'Done · tap to reset' : q.on ? 'Water moves across' : 'Tap to start', 150, 22, 14)
    } },
  { ...base, group: 'Life processes', kind: 'flower', name: 'Parts of a flower', w: 540, h: 400, params: { labels: 1 }, settings: LABELS,
    paint(c, q, l) {
      line(c, 270, 300, 270, 396, '#4f8a3a', 10)
      poly(c, [270, 300, 200, 280, 170, 220, 230, 262], '#d65a7a', '#8a2f4a', 2)
      poly(c, [270, 300, 340, 280, 370, 220, 310, 262], '#d65a7a', '#8a2f4a', 2)
      poly(c, [210, 296, 150, 312, 176, 270], '#5ba046', '#2f6b22', 2); poly(c, [330, 296, 390, 312, 364, 270], '#5ba046', '#2f6b22', 2)
      c.beginPath(); c.ellipse(270, 276, 40, 28, 0, 0, Math.PI * 2); c.fillStyle = '#9ccb6a'; c.fill(); c.strokeStyle = '#4f7a2a'; c.lineWidth = 2; c.stroke()
      for (const x of [258, 282]) disc(c, x, 276, 8, '#fff3c0', '#8a7a2a', 1.5)
      line(c, 270, 252, 270, 140, '#a9cf63', 8); disc(c, 270, 130, 15, '#e0a93a', '#8a6a1a', 2)
      for (const [x, y] of [[210, 170], [330, 170]]) { line(c, 270 + (x - 270) * .3, 280, x, y, '#d8b84a', 4); c.beginPath(); c.ellipse(x, y - 8, 11, 18, (x - 270) * .004, 0, Math.PI * 2); c.fillStyle = '#b9772a'; c.fill() }
      if (q.labels) {
        tag(c, l, 'Stigma', 150, 110, 258, 128, 'right'); tag(c, l, 'Style', 150, 190, 266, 200, 'right'); tag(c, l, 'Ovary', 118, 256, 232, 276, 'right'); tag(c, l, 'Ovule', 118, 340, 256, 278, 'right')
        tag(c, l, 'Anther', 400, 120, 340, 156); tag(c, l, 'Filament', 400, 205, 318, 220); tag(c, l, 'Petal', 410, 262, 350, 256); tag(c, l, 'Sepal', 410, 318, 374, 298); tag(c, l, 'Stem', 330, 368, 276, 368)
      }
    } }
]
addParts(BIOLOGY)
